/*
 * Baut aus dem Charaktermodell (PF2_PARSER) die mehrseitige, druckfertige
 * HTML-Ansicht des Charakterbogens.
 *
 * Seite 1 (klassischer Bogen) kommt aus src/front.js; die Folgeseiten
 * (Fähigkeiten, Stufenplan, Zauber, Ausrüstung, Zustände) verwenden dasselbe
 * Design. Zwei Bogen-Arten, siehe render():
 *   spielbereit – alles ausgefüllt außer Werten, die sich in der Spielrunde ändern
 *   aufstieg    – zusätzlich alles leer, was sich beim Stufenaufstieg ändert
 */
(function (global) {
  "use strict";

  const I18N = global.PF2_I18N;
  const D = global.PF2_DICT;
  const FRONT = global.PF2_FRONT;
  const ICONS = global.PF2_ITEM_ICONS;
  const SUM = global.PF2_SUMMARIZE;

  /**
   * Beschreibungstext je nach Bogen-Art: voll oder (Kompakt) Stichwortfassung.
   * Kompakt: von Hand geschriebene Stichworte (src/data/stichworte.js), sonst
   * automatisch auf ganze Regelsätze gekürzt. Ergänzte Hinweise („→ …“,
   * „Aktuell: …“) bleiben immer erhalten.
   */
  function T(text, key) {
    if (!text && !(key && global.PF2_STICHWORTE && key in global.PF2_STICHWORTE)) return "";
    if (!blank.compact) return text || "";
    const SW = global.PF2_STICHWORTE || {};
    if (key && key in SW) {
      const notes = (String(text || "").match(/(?:→|Aktuell:)[^→]*$/) || [""])[0].trim();
      return [SW[key], notes].filter(Boolean).join(" ");
    }
    return SUM && SUM.compact ? SUM.compact(text) : text;
  }

  /** Gesteigerte Zauberwerte: aktueller Grad (nicht im Stufenaufstieg) und Zuwachs je Grad. */
  function spellHeighten(s) {
    const out = [];
    if (s.heightenNow && !blank.level) out.push(`<b>Aktuell (Grad ${s.castRank}):</b> ${esc(s.heightenNow)}.`);
    else if (s.heightenStep) out.push(`<b>Gesteigert:</b> ${esc(s.heightenStep)}.`);
    return out.length ? ` <span class="cs-heighten">${out.join(" ")}</span>` : "";
  }

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sign(n) {
    if (n == null || Number.isNaN(Number(n))) return "";
    n = Number(n);
    return n >= 0 ? `+${n}` : `${n}`;
  }

  /** Aktionskosten als Symbol (HTML): gezeichnete Symbole wie auf Seite 1, sonst Kurztext. */
  function costSymbol(cost) {
    const icon = FRONT.actionIcon(cost);
    if (icon) return icon;
    if (cost == null || cost === "") return "—";
    const TEXT = { E: "Erk.", A: "Ausz.", M: "Min." };
    return esc(TEXT[cost] || String(cost));
  }

  // Bogen-Art: siehe PF2_FRONT.blankFor – wird in render() gesetzt.
  let blank = { session: true, level: false };

  /** Seitenkopf wie auf Seite 1: Marke links, Seitentitel rechts, Name darunter. */
  function pageHead(title, model) {
    return `
    <div class="cs-top">
      <div class="cs-brand">PATHFINDER<span>2. Edition</span></div>
      <div class="cs-title">${esc(title)}</div>
    </div>
    <div class="cs-pagename"><span>${esc(model.meta.name)}</span><em>${blank.level ? "" : `Stufe ${esc(model.meta.level)} · `}${esc(model.meta.className)}</em></div>`;
  }

  /**
   * Leere Zeilen, die eine Tabelle bis zum Seitenende fortsetzen. Sie nutzen
   * dieselbe Spaltendefinition (colgroup) wie die Tabelle darüber und liegen
   * daher exakt deckungsgleich; was nicht mehr auf die Seite passt, wird
   * abgeschnitten.
   */
  function lines(colgroup, cols) {
    const row = `<tr>${"<td></td>".repeat(cols)}</tr>`;
    return `<div class="cs-lines"><table class="cs-table cs-table-blank">${colgroup}<tbody>${row.repeat(45)}</tbody></table></div>`;
  }

  const ABILITY_COLS = `<colgroup><col style="width:11mm"><col style="width:28mm"><col style="width:40mm"><col style="width:14mm"><col></colgroup>`;
  const PLAN_COLS = `<colgroup><col style="width:12mm"><col style="width:7mm"><col></colgroup>`;
  const SPELL_COLS = `<colgroup><col style="width:12mm"><col style="width:36mm"><col style="width:13mm"><col style="width:19mm"><col style="width:24mm"><col></colgroup>`;
  const ITEM_COLS = `<colgroup><col style="width:8mm"><col style="width:11mm"><col style="width:11mm"><col style="width:18mm"><col style="width:42mm"><col style="width:17mm"><col></colgroup>`;

  function page(title, model, body, extraCls) {
    return `<section class="sheet-page cs-page ${extraCls || ""}">${pageHead(title, model)}${body}</section>`;
  }

  function groupRow(title, cols, hint) {
    return `<tr class="cs-grp"><td colspan="${cols}">${esc(title)}${hint ? ` <small>– ${esc(hint)}</small>` : ""}</td></tr>`;
  }

  /* ------------------------------------------------ Fähigkeiten & Talente */

  const WHEN_GROUPS = [
    ["kampf", "Aktionen & Reaktionen im Kampf", ""],
    ["kampf-passiv", "Im Kampf – immer aktiv", ""],
    ["ausserhalb", "Außerhalb des Kampfes", "Erkundung, Auszeit, Gespräche, Handwerk"],
    ["immer", "Immer aktiv", ""],
    ["eingerechnet", "Schon auf Seite 1 eingerechnet", "verändern nur Zahlen"],
  ];

  function abilityDesc(a) {
    const parts = [];
    // Zusatzeffekt einer Kernaktion: steht vollständig bei der Kernaktion oben
    if (a.keyActions && a.keyActions.length && keyActionNames(a).length) {
      const names = keyActionNames(a).map((n) => `<b>${esc(n)}</b>`);
      const joined = names.length > 1 ? names.slice(0, -1).join(", ") + " und " + names[names.length - 1] : names[0];
      return `<i>Zusatzeffekt für ${joined} – siehe „Deine Kernaktionen“ oben.</i>`;
    }
    // Die Aktion ist selbst eine Kernaktion: steht dort komplett
    if (currentKeyActions.some((k) => k.slug === a.slug)) return `<i>Kernaktion – steht mit allen Zusatzeffekten bei „Deine Kernaktionen“ oben.</i>`;
    const dot = (t) => (/[.!?:]$/.test(t.trim()) ? t.trim() : t.trim() + ".");
    if (a.trigger) parts.push(`<b>Auslöser:</b> ${esc(dot(a.trigger))}`);
    if (a.requirement) parts.push(`<b>Voraussetzung:</b> ${esc(dot(a.requirement))}`);
    if (a.frequency) parts.push(`<b>Häufigkeit:</b> ${esc(dot(a.frequency))}`);
    // Kompakt: „schon eingerechnet“ braucht keinen Text – steckt in den Zahlen
    if (a.summary && !(blank.compact && a.when === "eingerechnet")) parts.push(esc(T(a.summary, a.slug)));
    return parts.join(" ");
  }

  let currentKeyActions = [];
  function keyActionNames(a) {
    return currentKeyActions.filter((k) => (a.keyActions || []).includes(k.slug)).map((k) => k.name);
  }

  /**
   * Kernaktionen: Wurf, Regeltext und alle Zusatzeffekte aus Talenten/Merkmalen.
   * Aktionen, die von genau denselben Talenten verbessert werden (z. B. alle
   * Athletik-Manöver durch „Riesenringer“), stehen zusammen in einer Zeile,
   * damit derselbe Zusatzeffekt nicht mehrfach dasteht.
   */
  function keyActionRows(model) {
    const list = model.keyActions || [];
    if (!list.length) return "";
    const groups = [];
    list.forEach((k) => {
      const key = k.when + "|" + k.by.map((b) => b.name).sort().join("|");
      let g = groups.find((x) => x.key === key);
      if (!g) groups.push((g = { key, items: [] }));
      g.items.push(k);
    });
    const val = (b) => (blank.level || b == null ? "______" : esc(sign(b)));
    const rollOf = (k) => {
      const vs = k.vs ? ` gegen ${esc(k.vs)}` : "";
      if (k.choices && k.choices.length) return `${k.choices.map((c) => `${esc(c.name)} ${val(c.bonus)}`).join(" · ")}${vs}`;
      if (k.choices) return `Passende Wissensfertigkeit${vs}`;
      if (k.skillName) return `${esc(k.skillName)} ${val(k.bonus)}${vs}`;
      return "";
    };
    return (
      groupRow("Deine Kernaktionen", 5, "deine Talente verbessern sie – du nutzt sie voraussichtlich oft") +
      groups
        .map((g) => {
          const multi = g.items.length > 1;
          const first = g.items[0];
          const rules = g.items
            .map((k) => {
              const roll = rollOf(k);
              const pre = [k.trigger && `<b>Auslöser:</b> ${esc(k.trigger.replace(/[.\s]+$/, ""))}.`, k.requirement && `<b>Voraussetzung:</b> ${esc(k.requirement.replace(/[.\s]+$/, ""))}.`].filter(Boolean).join(" ");
              if (pre) return `${multi ? `<div class="cs-key-act"><b>${esc(k.name)}:</b> ` : ""}${pre} ${esc(T(k.text, "act:" + k.slug))}${multi ? "</div>" : ""}`;
              if (multi) return `<div class="cs-key-act"><b>${esc(k.name)}${roll ? ` (${roll})` : ""}:</b> ${esc(T(k.text, "act:" + k.slug))}</div>`;
              return `${roll ? `<b>${roll}.</b> ` : ""}${esc(T(k.text, "act:" + k.slug))}`;
            })
            .join("");
          // Talente, die selbst eine Aktion sind (z. B. Feldsanitäter), mit Symbol, Auslöser und Voraussetzung
          const effects = first.by
            .map((b) => {
              const extra = [];
              if (b.cost != null && b.cost !== "") extra.push(`${costSymbol(b.cost)} eigene Aktion`);
              if (b.trigger) extra.push(`<b>Auslöser:</b> ${esc(b.trigger)}`);
              if (b.requirement) extra.push(`<b>Voraussetzung:</b> ${esc(b.requirement)}`);
              if (b.frequency) extra.push(`<b>Häufigkeit:</b> ${esc(b.frequency)}`);
              const head = extra.length ? extra.join(" · ").replace(/[.\s]+$/, "") + ". " : "";
              return `<li><b>${esc(b.name)}:</b> ${head}${esc(T(b.summary || "", b.slug))}</li>`;
            })
            .join("");
          const isSkill = g.items.some((k) => k.skillName || k.choices);
          const sameCost = g.items.every((k) => k.cost === first.cost);
          return `<tr class="cs-key">
          <td class="c">–</td>
          <td>${isSkill ? "Fertigkeitsaktion" : g.items.every((k) => k.cost === "R") ? "Reaktion" : "Aktion"}${first.when === "ausserhalb" ? "<br><small>außerhalb des Kampfes</small>" : ""}</td>
          <td class="b">${g.items.map((k) => esc(k.name)).join("<br>")}</td>
          <td class="c act">${sameCost ? costSymbol(first.cost) : g.items.map((k) => costSymbol(k.cost)).join("<br>")}</td>
          <td class="desc">${rules}<div class="cs-key-fx"><b>Zusatzeffekte durch deine Talente:</b><ul>${effects}</ul></div></td>
        </tr>`;
        })
        .join("")
    );
  }

  function abilitiesPage(model) {
    currentKeyActions = model.keyActions || [];
    const list = model.abilitiesList || [];
    const order = { 1: 1, 2: 2, 3: 3, F: 4, R: 5 };
    const body = WHEN_GROUPS.map(([key, title, hint]) => {
      const items = list.filter((a) => a.when === key);
      if (!items.length) return "";
      items.sort((a, b) => (order[a.cost] || 9) - (order[b.cost] || 9) || (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name, "de"));
      return (
        groupRow(title, 5, hint) +
        items
          .map(
            (a) => `<tr>
          <td class="c">${a.level || "–"}</td>
          <td>${esc(a.categoryName || "")}</td>
          <td class="b">${esc(a.name)}</td>
          <td class="c act">${costSymbol(a.cost)}</td>
          <td class="desc">${abilityDesc(a)}</td>
        </tr>`
          )
          .join("")
      );
    }).join("");
    // Angriffe ohne Platz auf Seite 1 (mehr als 3 Nah- oder Fernkampfangriffe)
    const rest = FRONT.attackSlots(model).rest;
    const restRows = rest.length
      ? groupRow("Weitere Angriffe", 5, "kein Platz mehr auf Seite 1") +
        rest
          .map(
            (st) => `<tr>
          <td class="c">–</td>
          <td>${st.ranged ? "Fernkampf" : "Nahkampf"}${st.unarmed ? " (waffenlos)" : ""}</td>
          <td class="b">${esc(st.name)}${st.material ? `<span class="cs-mat"> (${esc(st.material)})</span>` : ""}</td>
          <td class="c act">${costSymbol(1)}</td>
          <td class="desc">${
            blank.level
              ? `<b>Angriff:</b> ______ (2./3.: ______ / ______) · <b>Schaden:</b> ${esc(st.dice || "")}${st.damageAttr === "str" ? " + ST" : st.damageAttr === "str/2" ? " + ½ST" : ""}`
              : `<b>Angriff:</b> ${esc(sign(st.bonus))} (2./3.: ${esc(sign(st.map[1]))} / ${esc(sign(st.map[2]))}) · <b>Schaden:</b> ${esc(st.damage)}`
          }${st.traits && st.traits.length ? ` · ${esc(st.traits.join(", "))}` : ""}</td>
        </tr>`
          )
          .join("")
      : "";
    return page(
      "Fähigkeiten & Talente",
      model,
      `<div class="cs-panel cs-fill">
        <div class="cs-bar">Talente, Klassenmerkmale &amp; Aktionen</div>
        <table class="cs-table">
          ${ABILITY_COLS}
          <thead><tr><th class="c">Stufe</th><th>Art</th><th>Name</th><th class="c">Aktion</th><th>Kurzbeschreibung</th></tr></thead>
          <tbody>${keyActionRows(model)}${restRows}${body || `<tr><td colspan="5" class="desc">Keine Talente im Export gefunden.</td></tr>`}</tbody>
        </table>
        ${lines(ABILITY_COLS, 5)}
      </div>`
    );
  }

  /* ---------------------------------------------------------- Stufenplan */

  function levelPlanPage(model) {
    const plan = model.levelPlan || [];
    if (!plan.length) return "";
    const rows = plan
      .map((lv) => {
        // Auf dem Stufenaufstieg-Bogen wird „erreicht“ nicht vorgegeben.
        const reached = lv.reached && !blank.level;
        const entries = (lv.entries || [])
          .map(
            (e) =>
              `<span class="cs-plan-entry"><em>${esc(e.kind)}</em>${
                e.name && !(blank.level && e.note) ? `<b>${esc(e.name)}</b>` : `<i class="cs-plan-blank"></i>`
              }${e.note && !blank.level ? `<small>(${esc(e.note)})</small>` : ""}</span>`
          )
          .join("");
        return `<tr class="${reached ? "reached" : ""}">
          <td class="c b">${esc(lv.level)}</td>
          <td class="c"><span class="cs-check ${reached ? "on" : ""}"></span></td>
          <td><div class="cs-plan-cell">${entries || "–"}</div></td>
        </tr>`;
      })
      .join("");
    return page(
      "Stufenplan",
      model,
      `<div class="cs-panel cs-fill">
        <div class="cs-bar">Stufenaufstieg 1–20</div>
        <table class="cs-table cs-plan">
          ${PLAN_COLS}
          <thead><tr><th class="c">Stufe</th><th class="c">✔</th><th>Was du auf dieser Stufe erhältst</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    );
  }

  /* -------------------------------------------------------------- Zauber */

  const SLOT_RANKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  function spellsPage(model) {
    const sc = model.spellcasting || { entries: [], focus: { value: 0, max: 0 } };
    const entries = sc.entries || [];
    if (!entries.length) return "";
    const focus = sc.focus || { value: 0, max: 0 };
    const focusPips = Array.from(
      { length: Math.max(blank.level ? 3 : focus.max || 0, focus.max ? 1 : 0) },
      (_, i) => `<span class="cs-pip ${!blank.session && i < (focus.value || 0) ? "on" : ""}"></span>`
    ).join("");
    const entryRows = entries
      .map(
        (e) => `<tr>
        <td class="b">${esc(e.name)}</td>
        <td>${esc(e.kind || "")}</td>
        <td>${esc(e.tradition || "")}</td>
        <td class="c cs-num">${esc(blank.level || e.dc == null ? "" : e.dc)}</td>
        <td class="c cs-num">${esc(blank.level || e.attack == null ? "" : sign(e.attack))}</td>
      </tr>`
      )
      .join("");
    const entryStats = `
      <div class="cs-spell-head">
        <table class="cs-table cs-entries">
          <colgroup><col><col style="width:22mm"><col style="width:18mm"><col style="width:19mm"><col style="width:25mm"></colgroup>
          <thead><tr><th>Zauberquelle</th><th>Art</th><th>Tradition</th><th class="c">Zauber-SG</th><th class="c">Zauberangriff</th></tr></thead>
          <tbody>${entryRows}</tbody>
        </table>
        ${focus.max || blank.level ? `<div class="cs-focus"><span class="cs-stat-pips">${focusPips}</span><em>Fokuspunkte</em></div>` : ""}
      </div>`;
    const withSlots = entries.filter((e) => (e.slots || []).some((s) => s.max));
    const slotRows = withSlots
      .map((e) => {
        const max = new Map((e.slots || []).map((s) => [s.rank, s.max]));
        const label = withSlots.length > 1 ? `<span class="cs-slot-src">${esc(e.name)}</span>` : "";
        return `<tr><th>${label}Plätze</th>${SLOT_RANKS.map((r) => `<td>${blank.level ? "" : esc(max.get(r) || "")}</td>`).join("")}</tr>
          <tr><th>Verbraucht</th>${SLOT_RANKS.map(() => "<td></td>").join("")}</tr>`;
      })
      .join("");
    const slots = `
      <table class="cs-slots ${withSlots.length > 1 ? "multi" : ""}">
        <tr><th>Rang</th>${SLOT_RANKS.map((r) => `<th>${r === 0 ? "Trick" : r}</th>`).join("")}</tr>
        ${slotRows || `<tr><th>Plätze</th>${SLOT_RANKS.map(() => "<td></td>").join("")}</tr><tr><th>Verbraucht</th>${SLOT_RANKS.map(() => "<td></td>").join("")}</tr>`}
      </table>`;
    const rows = entries
      .map((e) => {
        const spells = (e.spells || []).slice().sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "de"));
        if (!spells.length) return "";
        return (
          (entries.length > 1 ? groupRow(e.name, 6, [e.kind, e.tradition].filter(Boolean).join(" · ")) : "") +
          spells
            .map(
              (s) => `<tr>
            <td class="c">${s.cantrip ? "Trick" : s.focus ? `F${blank.level ? "" : s.castRank || s.rank || ""}` : s.rank}</td>
            <td class="b">${esc(s.name)}</td>
            <td class="c act">${costSymbol(s.cost)}</td>
            <td>${esc(s.range || "")}</td>
            <td>${esc(s.defense || "")}</td>
            <td class="desc">${esc(T(s.summary, "sp:" + s.slug))}${spellHeighten(s)}</td>
          </tr>`
            )
            .join("")
        );
      })
      .join("");
    return page(
      "Zauber",
      model,
      `<div class="cs-panel"><div class="cs-bar">Zauberwirken</div>
        ${entryStats}
        ${slots}
      </div>
      <div class="cs-panel cs-fill">
        <div class="cs-bar">Zauber</div>
        <table class="cs-table">
          ${SPELL_COLS}
          <thead><tr><th class="c">Rang</th><th>Name</th><th class="c">Akt.</th><th>Reichweite</th><th>Verteidigung</th><th>Kurzbeschreibung</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${lines(SPELL_COLS, 6)}
      </div>`
    );
  }

  /* ---------------------------------------------------------- Ausrüstung */

  function itemInfo(it) {
    const parts = [];
    const d = it.desc || {};
    if (d.act) parts.push(`<b>${esc(d.act)}</b>`);
    // Kompakt: Waffen/Rüstungen brauchen keine Beschreibung – Merkmale, Material und Runen stehen schon da
    const SW = global.PF2_STICHWORTE || {};
    const ds = !blank.compact
      ? d.s
      : TAG_KINDS.has(it.kind)
        ? ""
        : "eq:" + it.slug in SW
          ? SW["eq:" + it.slug]
          : SUM && SUM.compactItem ? SUM.compactItem(d.s) : d.s;
    if (ds) parts.push(esc(ds));
    (it.runes || []).forEach((r) => parts.push(`<b>${esc(r.name)}</b>`));
    return parts.join(" ");
  }

  // Leere Zeilen für Gegenstände, die in der Sitzung dazukommen
  const MIN_NEW_ITEM_ROWS = 8;
  const NEW_ITEM_ROW = `<tr class="cs-new">${"<td></td>".repeat(7)}</tr>`;

  /** Kupfer → „1 GM 5 SM“ (Platin wird als Gold gezählt, wie im Handel üblich). */
  function money(cp) {
    if (!cp) return "";
    const gp = Math.floor(cp / 100), sp = Math.floor((cp % 100) / 10), c = cp % 10;
    return [gp && `${gp.toLocaleString("de-DE")} GM`, sp && `${sp} SM`, c && `${c} KM`].filter(Boolean).join(" ");
  }
  function itemPrice(it) {
    if (!it.priceCp) return "–";
    const unit = money(it.priceCp) + (it.pricePer > 1 ? ` / ${it.pricePer}` : "");
    const total = it.quantity > 1 ? Math.round((it.priceCp * it.quantity) / it.pricePer) : 0;
    return esc(unit) + (it.quantity > it.pricePer && total ? `<small>ges. ${esc(money(total))}</small>` : "");
  }

  // Reihenfolge der Gegenstandsarten innerhalb einer Gruppe
  const KIND_ORDER = ["waffe", "fernkampf", "stecken", "munition", "ruestung", "schild", "schmuck", "trank", "oel", "schriftrolle",
    "zauberstab", "talisman", "werkzeug", "licht", "buch", "behaelter", "verbrauch", "ausruestung", "schatz"];
  const LOCATION_GROUPS = [
    ["hand", "In der Hand"],
    ["angelegt", "Angelegt", "Rüstung, Kleidung, Schmuck – investiert oder im Slot"],
    ["koerper", "Am Körper / Gürtel", "griffbereit, nicht verstaut"],
    ["behaelter", null],
    ["abgelegt", "Abgelegt / zurückgelassen", "zählt nicht zur Traglast"],
  ];

  // Bei Waffen, Rüstungen, Schilden und Munition sind die Merkmale am Tisch relevant
  const TAG_KINDS = new Set(["waffe", "fernkampf", "stecken", "ruestung", "schild", "munition"]);
  function itemTags(it) {
    const tags = TAG_KINDS.has(it.kind) ? (it.traitsDe || []).filter(Boolean) : [];
    return (
      (it.material ? `<div class="cs-item-mat">${esc(it.material)}</div>` : "") +
      (tags.length ? `<div class="cs-item-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join(" · ")}</div>` : "")
    );
  }

  function itemRow(it) {
    return `<tr>
        <td class="c ico">${ICONS ? ICONS.icon(it.kind) : ""}</td>
        <td class="c">${esc(it.quantity)}</td>
        <td class="c">${esc(it.bulk == null || it.bulk === "" ? "–" : it.bulk)}</td>
        <td class="c">${it.invested ? "✔" : ""}</td>
        <td class="b">${esc(it.name)}${itemTags(it)}</td>
        <td class="c price">${itemPrice(it)}</td>
        <td class="desc">${itemInfo(it)}</td>
      </tr>`;
  }

  function inventoryPage(model) {
    const items = model.inventory || [];
    const kindIdx = (k) => (KIND_ORDER.indexOf(k) < 0 ? 99 : KIND_ORDER.indexOf(k));
    const sortItems = (list) => list.slice().sort((a, b) => kindIdx(a.kind) - kindIdx(b.kind) || a.name.localeCompare(b.name, "de"));
    let rows = "";
    LOCATION_GROUPS.forEach(([loc, title, hint]) => {
      const inLoc = items.filter((it) => (it.location || "koerper") === loc);
      if (!inLoc.length) return;
      if (loc === "behaelter") {
        // je Behälter eine eigene Gruppe
        Array.from(new Set(inLoc.map((it) => it.container))).forEach((c) => {
          rows += groupRow(`Im ${c}`, 7, "verstaut") + sortItems(inLoc.filter((it) => it.container === c)).map(itemRow).join("");
        });
      } else {
        rows += groupRow(title, 7, hint) + sortItems(inLoc).map(itemRow).join("");
      }
    });
    const cur = model.currency || {};
    const bulk = model.bulk || {};
    const coin = (v, l) => `<div class="cs-stat"><span class="cs-stat-box">${esc(v || "")}</span><em>${l}</em></div>`;
    const bulkNow = bulk.value != null ? `${bulk.value}${bulk.light ? ` + ${bulk.light} L` : ""}` : "";
    return page(
      "Ausrüstung",
      model,
      `<div class="cs-inv-top">
        <div class="cs-panel"><div class="cs-bar">Vermögen</div>
          <div class="cs-stat-row">${coin(cur.pp, "Platin (PM)")}${coin(cur.gp, "Gold (GM)")}${coin(cur.sp, "Silber (SM)")}${coin(cur.cp, "Kupfer (KM)")}</div>
        </div>
        <div class="cs-panel"><div class="cs-bar">Traglast</div>
          <div class="cs-stat-row">
            <div class="cs-stat"><span class="cs-stat-box">${esc(bulkNow)}</span><em>Getragen</em></div>
            <div class="cs-stat"><span class="cs-stat-box">${esc(blank.level ? "" : bulk.encumbered)}</span><em>Belastet ab</em></div>
            <div class="cs-stat"><span class="cs-stat-box">${esc(blank.level ? "" : bulk.max)}</span><em>Maximum</em></div>
          </div>
        </div>
      </div>
      <div class="cs-panel cs-fill">
        <div class="cs-bar">Gegenstände</div>
        <table class="cs-table" data-fill-rows="6" data-min-rows="${MIN_NEW_ITEM_ROWS}">
          ${ITEM_COLS}
          <thead><tr><th class="c">Art</th><th class="c">Anz.</th><th class="c">Last</th><th class="c">Investiert</th><th>Gegenstand</th><th class="c">Wert</th><th>Wirkung / Kurzinfo</th></tr></thead>
          <tbody>${rows}${groupRow("Neue Gegenstände", 7, "in der Sitzung gefunden oder gekauft")}${NEW_ITEM_ROW}</tbody>
        </table>
        ${lines(ITEM_COLS, 7)}
      </div>
      <div class="cs-panel cs-notes-panel"><div class="cs-bar">Notizen</div>${lines("<colgroup><col></colgroup>", 1)}</div>`
    );
  }

  /* ------------------------------------------------------------ Zustände */

  function englishCondition(slug) {
    if (slug === "off-guard") return "Off-Guard";
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function conditionsPage(model) {
    const active = new Map((model.conditions || []).map((c) => [D.slug(c.name), c.value]));
    const list = I18N.CONDITIONS.map((c) => {
      const e = D.entry("cond:" + c.slug) || D.entry(c.slug) || {};
      return Object.assign({}, c, { name: e.n || englishCondition(c.slug) });
    }).sort((a, b) => a.name.localeCompare(b.name, "de"));
    const rows = list
      .map((c) => {
        const key = active.has(D.slug(c.name)) ? D.slug(c.name) : c.slug;
        const on = !blank.session && active.has(key);
        const val = active.get(key);
        return `
      <div class="cs-cond ${on ? "on" : ""}">
        <span class="cs-check ${on ? "on" : ""}"></span>
        <div class="cs-cond-body">
          <div class="cs-cond-head"><strong>${esc(c.name)}</strong><span class="cs-cond-en">${esc(englishCondition(c.slug))}</span>${
          c.value ? `<span class="cs-cond-val">${on && val != null ? esc(val) : ""}</span>` : ""
        }</div>
          <div class="cs-cond-text">${esc(c.text)}</div>
        </div>
      </div>`;
      })
      .join("");
    return page(
      "Zustände",
      model,
      `<div class="cs-panel cs-fill"><div class="cs-bar">Zustände <small>– ankreuzen, Wert ins Kästchen</small></div>
        <div class="cs-cond-grid" style="grid-template-rows: repeat(${Math.ceil(list.length / 2)}, 1fr)">${rows}</div></div>`
    );
  }

  function warningsBlock(model) {
    if (!model.warnings || !model.warnings.length) return "";
    return `
    <div class="warnings-box">
      <strong>Hinweise zum Import:</strong>
      <ul>${model.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
    </div>`;
  }

  /**
   * @param {object} model  Charaktermodell aus PF2_PARSER
   * @param {object} [opts] { mode: "spielbereit" (Standard) | "aufstieg" }
   */
  function render(model, opts) {
    const mode = (opts && opts.mode) || "spielbereit";
    blank = FRONT.blankFor(mode);
    return `<div class="pf2-sheet">${warningsBlock(model)}${FRONT.render(model, { mode })}${abilitiesPage(model)}${levelPlanPage(
      model
    )}${spellsPage(model)}${inventoryPage(model)}${conditionsPage(model)}</div>`;
  }

  /**
   * Füllt die Ausrüstungsseite bis zum Ende der letzten Druckseite mit leeren
   * Zeilen für neue Gegenstände. Dazu wird der Seitenumbruch des Drucks
   * nachgebildet: Zeilen werden nicht geteilt (sie rutschen ganz auf die
   * nächste Seite), der Tabellenkopf wiederholt sich, der Notizblock bleibt
   * zusammen. Gemessen wird in der Bildschirmansicht – sie hat dieselbe
   * Inhaltsbreite wie der Druck (194 mm), daher stimmen die Zeilenhöhen.
   * Passt alles auf eine Seite (mit genug freien Zeilen), füllt das Layout
   * selbst (.cs-lines).
   */
  function fillPages(root) {
    const PAGE_MM = 279; // nutzbare Höhe einer A4-Druckseite (297 mm − 2 × 8 mm Rand, kleiner Puffer)
    root.querySelectorAll("table[data-fill-rows]").forEach((table) => {
      const sec = table.closest(".sheet-page");
      const tbody = table.tBodies[0];
      const proto = tbody && tbody.querySelector("tr.cs-new");
      if (!sec || !proto) return;
      const px = sec.getBoundingClientRect().width / 210;
      if (!px) return;
      const top = sec.getBoundingClientRect().top + parseFloat(getComputedStyle(sec).paddingTop);
      const mm = (v) => v / px;
      const rows = Array.from(tbody.rows).map((r) => mm(r.getBoundingClientRect().height));
      const firstRowTop = mm(tbody.rows[0].getBoundingClientRect().top - top);
      const theadH = table.tHead ? mm(table.tHead.getBoundingClientRect().height) : 0;
      const rowH = mm(proto.getBoundingClientRect().height) || 7;
      const notes = sec.querySelector(".cs-notes-panel");
      const notesH = notes ? mm(notes.getBoundingClientRect().height) : 0;
      const gap = notes ? mm(notes.getBoundingClientRect().top - table.closest(".cs-panel").getBoundingClientRect().bottom) : 0;
      const minRows = parseInt(table.dataset.minRows || "0", 10);

      // Druck nachbilden: n zusätzliche Leerzeilen → Seitenzahl und Rest auf der letzten Seite
      const simulate = (n) => {
        let page = 1;
        let y = firstRowTop;
        const all = rows.concat(Array(n).fill(rowH));
        for (const h of all) {
          if (y + h > page * PAGE_MM) {
            y = page * PAGE_MM + theadH + 1; // Tabellenkopf + Rahmen auf der neuen Seite
            page++;
          }
          y += h;
        }
        y += 0.6 + gap; // Rahmen unten + Abstand
        if (y + notesH > page * PAGE_MM) {
          y = page * PAGE_MM;
          page++;
        }
        return page;
      };
      const pages = simulate(minRows);
      if (pages === 1) return; // passt auf ein Blatt – die Linien des Layouts füllen den Rest
      let n = minRows;
      while (n < 400 && simulate(n + 1) === pages) n++;
      for (let i = 1; i < n; i++) tbody.appendChild(proto.cloneNode(true)); // eine Leerzeile steht schon im HTML
    });
  }

  global.PF2_RENDER = { render, fillPages };
})(typeof window !== "undefined" ? window : globalThis);
