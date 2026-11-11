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
  const ITEM_COLS = `<colgroup><col style="width:8mm"><col style="width:14mm"><col style="width:17mm"><col style="width:18mm"><col style="width:46mm"><col></colgroup>`;

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
      return `<i>Zusatzeffekt für ${keyActionNames(a).map((n) => `<b>${esc(n)}</b>`).join(" und ")} – siehe „Deine Kernaktionen“ oben.</i>`;
    }
    if (a.trigger) parts.push(`<b>Auslöser:</b> ${esc(a.trigger)}`);
    if (a.requirement) parts.push(`<b>Voraussetzung:</b> ${esc(a.requirement)}`);
    if (a.frequency) parts.push(`<b>Häufigkeit:</b> ${esc(a.frequency)}`);
    if (a.summary) parts.push(esc(a.summary));
    return parts.join(" ");
  }

  let currentKeyActions = [];
  function keyActionNames(a) {
    return currentKeyActions.filter((k) => (a.keyActions || []).includes(k.slug)).map((k) => k.name);
  }

  /** Kernaktionen: Wurf, Regeltext und alle Zusatzeffekte aus Talenten/Merkmalen. */
  function keyActionRows(model) {
    const list = model.keyActions || [];
    if (!list.length) return "";
    return (
      groupRow("Deine Kernaktionen", 5, "nutzt du voraussichtlich oft – mehrere Talente verbessern sie") +
      list
        .map((k) => {
          const roll = k.skillName
            ? `<b>${esc(k.skillName)} ${blank.level || k.bonus == null ? "______" : esc(sign(k.bonus))}${k.vs ? ` gegen ${esc(k.vs)}` : ""}.</b> `
            : "";
          const effects = k.by
            .map((b) => `<li><b>${esc(b.name)}:</b> ${esc(b.summary || "")}</li>`)
            .join("");
          return `<tr class="cs-key">
          <td class="c">–</td>
          <td>${k.skillName ? "Fertigkeitsaktion" : "Aktion"}</td>
          <td class="b">${esc(k.name)}</td>
          <td class="c act">${costSymbol(k.cost)}</td>
          <td class="desc">${roll}${esc(k.text)}<div class="cs-key-fx"><b>Zusatzeffekte durch deine Talente:</b><ul>${effects}</ul></div></td>
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
          <td class="b">${esc(st.name)}</td>
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
            <td class="c">${s.cantrip ? "Trick" : s.focus ? `F${s.rank || ""}` : s.rank}</td>
            <td class="b">${esc(s.name)}</td>
            <td class="c act">${costSymbol(s.cost)}</td>
            <td>${esc(s.range || "")}</td>
            <td>${esc(s.defense || "")}</td>
            <td class="desc">${esc(s.summary)}</td>
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
    if (d.s) parts.push(esc(d.s));
    (it.runes || []).forEach((r) => parts.push(`<b>${esc(r.name)}</b>`));
    return parts.join(" ");
  }

  function inventoryPage(model) {
    const items = model.inventory || [];
    const rows = items
      .map(
        (it) => `<tr>
        <td class="c ico">${ICONS ? ICONS.icon(it.kind) : ""}</td>
        <td class="c">${esc(it.quantity)}</td>
        <td class="c">${esc(it.bulk == null || it.bulk === "" ? "–" : it.bulk)}</td>
        <td class="c">${it.invested ? "✔ inv." : it.equipped ? "✔" : ""}</td>
        <td class="b">${it.container ? "↳ " : ""}${esc(it.name)}</td>
        <td class="desc">${itemInfo(it)}</td>
      </tr>`
      )
      .join("");
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
        <table class="cs-table">
          ${ITEM_COLS}
          <thead><tr><th class="c">Art</th><th class="c">Anzahl</th><th class="c">Traglast</th><th class="c">Angelegt</th><th>Gegenstand</th><th>Wirkung / Kurzinfo</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${lines(ITEM_COLS, 6)}
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

  global.PF2_RENDER = { render };
})(typeof window !== "undefined" ? window : globalThis);
