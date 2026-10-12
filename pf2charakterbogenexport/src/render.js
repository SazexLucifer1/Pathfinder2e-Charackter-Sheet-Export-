/*
 * Baut aus dem berechneten Charaktermodell (PF2_PARSER) den mehrseitigen,
 * druckfertigen Charakterbogen im Stil der Pathfinder-2-Einsteigerbox.
 *
 * Seiten:
 *   1  Übersicht (Attribute, RK, TP, Rettungswürfe, Fertigkeiten, Angriffe)
 *   2  Im Kampf (Dein Zug, Grundaktionen, Aktionen/Reaktionen, Fertigkeitsaktionen)
 *   3  Außerhalb des Kampfes (Erkundung, Auszeit, passive Fähigkeiten)
 *   4  Zauber (nur wenn vorhanden)
 *   5  Ausrüstung, Stufenplan 1–20 & Notizen
 *   6  Zustände (Nachschlagen & Ankreuzen)
 */
(function (global) {
  "use strict";

  const I18N = global.PF2_I18N;
  const EXP = global.PF2_EXPLANATIONS;
  const ACT = global.PF2_ACTIONS;
  const D = global.PF2_DICT;

  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtMod(n) {
    if (n == null || Number.isNaN(n)) return "–";
    return n >= 0 ? `+${n}` : `${n}`;
  }

  /* ---------- Bausteine ---------- */

  /** Englischer Originalname klein in Klammern */
  function enTag(en) {
    return en ? ` <span class="en-name">(${esc(en)})</span>` : "";
  }

  function banner(title, extra) {
    return `<div class="banner"><span>${esc(title)}</span>${extra ? `<span class="banner-extra">${extra}</span>` : ""}</div>`;
  }

  function tip(key) {
    const e = EXP[key];
    if (!e) return "";
    return `<div class="tip"><strong>${esc(e.title)}</strong> ${esc(e.text)}</div>`;
  }

  /** Aktionssymbol als kleines Abzeichen: ◆ ◆◆ ◆◆◆ ⤾ ◇ */
  function costBadge(cost) {
    if (cost == null || cost === "") return `<span class="cost cost-passive" title="passiv">—</span>`;
    if (cost === "R") return `<span class="cost cost-reaction" title="Reaktion">⤾</span>`;
    if (cost === "F") return `<span class="cost cost-free" title="Freie Aktion">◇</span>`;
    if (cost === "E") return `<span class="cost cost-text" title="Erkundungsaktivität">Erk.</span>`;
    if (cost === "A") return `<span class="cost cost-text" title="Auszeit">Ausz.</span>`;
    if (cost === "M") return `<span class="cost cost-text" title="dauert Minuten">Min.</span>`;
    if (typeof cost === "number") return `<span class="cost" title="${cost} Aktion${cost > 1 ? "en" : ""}">${"◆".repeat(cost)}</span>`;
    return `<span class="cost cost-text">${esc(cost)}</span>`;
  }

  /** Kompetenz als Kästchen U G E M L (wie die Einsteigerbox-Kästchen, erweitert bis Legende) */
  function rankBoxes(rank) {
    const letters = ["G", "E", "M", "L"];
    return `<span class="rank-boxes" title="${esc(I18N.proficiencyName(rank))}">${letters
      .map((l, i) => `<span class="rb ${rank >= i + 1 ? "on" : ""}">${l}</span>`)
      .join("")}</span>`;
  }

  /* ---------- Seite 1: Übersicht ---------- */

  const ATTR_HINT = {
    str: "Nahkampf-Schaden, Athletik, Traglast",
    dex: "RK, Reflex, Fernkampf, Akrobatik, Heimlichkeit",
    con: "Trefferpunkte, Zähigkeit",
    int: "Wissen, Sprachen, Fertigkeiten",
    wis: "Wahrnehmung, Willen, Heilkunde",
    cha: "Soziales, manche Zauber",
  };

  function headerBlock(model) {
    const m = model.meta;
    const field = (label, value, cls) =>
      `<div class="hf ${cls || ""}"><div class="hf-value">${esc(value) || "&nbsp;"}</div><div class="hf-label">${esc(label)}</div></div>`;
    return `
    <header class="sheet-head">
      <div class="logo">
        <div class="logo-main">Pathfinder</div>
        <div class="logo-sub">Charakterbogen · 2. Edition</div>
      </div>
      <div class="head-fields">
        ${field("Charaktername", m.name, "wide")}
        ${field("Spieler:in", "", "")}
        <div class="level-badge"><div class="lvl">${esc(m.level)}</div><div class="hf-label">Stufe</div></div>
        ${field("Volk & Erbe", [m.ancestry, m.heritage].filter(Boolean).join(" · "), "wide")}
        ${field("Hintergrund", m.background)}
        ${field("Klasse", m.className)}
        ${field("Gottheit", m.deity)}
        ${field("Größe", m.size)}
        ${field("Sprachen", (m.languages || []).join(", "), "wide2")}
      </div>
    </header>
    <div class="level-track">
      <span class="lt-label">Stufe</span>
      ${Array.from({ length: 20 }, (_, i) => i + 1)
        .map((l) => `<span class="lt-pip ${l <= m.level ? "on" : ""} ${l === m.level ? "now" : ""}">${l}</span>`)
        .join("")}
      <span class="lt-xp">EP: <span class="write-line short">${m.xp || ""}</span> / 1000</span>
    </div>`;
  }

  function attributeColumn(model) {
    return `
    <section class="col col-attr">
      ${banner("Attribute")}
      ${Object.values(I18N.ABILITIES)
        .map((a) => {
          const mod = model.abilities[a.key] || 0;
          const key = model.meta.keyAttr === a.key;
          return `
        <div class="attr-box ${key ? "key" : ""}">
          <div class="attr-name">${esc(a.name)}${key ? ' <span class="key-mark" title="Schlüsselattribut deiner Klasse">★</span>' : ""}</div>
          <div class="attr-mod">${fmtMod(mod)}</div>
          <div class="attr-hint">${esc(ATTR_HINT[a.key])}</div>
        </div>`;
        })
        .join("")}
      ${tip("abilityScores")}
    </section>`;
  }

  function defenseColumn(model) {
    const ac = model.ac;
    const sh = model.shield;
    const saves = Object.values(I18N.SAVES)
      .map((s) => {
        const n = model.saves[s.key];
        return `<div class="save-box">
          <div class="save-name">${esc(s.name)}</div>
          <div class="save-mod">${fmtMod(n.mod)}</div>
          ${rankBoxes(n.rank)}
        </div>`;
      })
      .join("");
    const dying = [1, 2, 3, 4].map((i) => `<span class="chk" title="Sterbend ${i}"></span>`).join("");
    const wounded = [1, 2, 3].map(() => `<span class="chk"></span>`).join("");
    return `
    <section class="col col-def">
      <div class="ac-hp-row">
        <div class="ac-shield" title="Rüstungsklasse">
          <svg viewBox="0 0 100 116" aria-hidden="true"><path d="M50 3 L95 18 C95 62 78 94 50 113 C22 94 5 62 5 18 Z"/></svg>
          <div class="ac-label">RK</div>
          <div class="ac-value">${esc(ac.value)}</div>
        </div>
        <div class="hp-box">
          <div class="box-title">Trefferpunkte</div>
          <div class="hp-grid">
            <div><div class="hp-max">${esc(model.hp.max)}</div><div class="mini">Maximum</div></div>
            <div><div class="hp-write"></div><div class="mini">Aktuell</div></div>
            <div><div class="hp-write small"></div><div class="mini">Temporär</div></div>
          </div>
          <div class="dying-row"><span>Sterbend</span>${dying}<span>Verwundet</span>${wounded}</div>
        </div>
      </div>
      <div class="ac-detail">${esc(ac.armor)}${ac.dexCap != null ? ` · GE-Max. +${esc(ac.dexCap)}` : ""} · ${rankBoxes(ac.rank)}</div>
      ${
        sh
          ? `<div class="shield-box"><strong>${esc(sh.name)}</strong> · erhoben: +${esc(sh.bonus)} RK · Härte ${esc(sh.hardness)} · TP ${esc(sh.hpMax)} (Bruch ${Math.floor(sh.hpMax / 2)}) <span class="shield-hp">aktuell: <span class="write-line short"></span></span></div>`
          : ""
      }
      ${banner("Rettungswürfe")}
      <div class="saves-row">${saves}</div>
      <div class="stat-grid">
        <div class="stat">
          <div class="box-title">Wahrnehmung</div>
          <div class="stat-val">${fmtMod(model.perception.mod)}</div>
          ${rankBoxes(model.perception.rank)}
          <div class="mini">${model.perception.senses.length ? esc(model.perception.senses.join(", ")) : "auch für Initiative"}</div>
        </div>
        <div class="stat">
          <div class="box-title">Geschwindigkeit</div>
          <div class="stat-val">${esc(model.speed.value)} <small>Fuß</small></div>
          <div class="mini">${model.speed.others.map((o) => `${esc(D.term(o.type) || o.type)} ${esc(o.value)} Fuß`).join(", ") || "pro Aktion Laufen"}</div>
        </div>
        <div class="stat">
          <div class="box-title">Klassen-SG</div>
          <div class="stat-val">${model.classDC.value != null ? esc(model.classDC.value) : "–"}</div>
          ${rankBoxes(model.classDC.rank)}
        </div>
        <div class="stat">
          <div class="box-title">Heldenpunkte</div>
          <div class="hero">${[0, 1, 2].map((i) => `<span class="hero-pip ${i < model.meta.heroPoints ? "on" : ""}"></span>`).join("")}</div>
          <div class="mini">Neu würfeln oder dem Tod entgehen</div>
        </div>
      </div>
      ${iwrBlock(model)}
      ${tip("saves")}
    </section>`;
  }

  function iwrBlock(model) {
    const { resistances, weaknesses, immunities } = model.iwr;
    if (!resistances.length && !weaknesses.length && !immunities.length) return "";
    return `<div class="iwr">
      ${resistances.length ? `<div><strong>Resistenzen:</strong> ${esc(resistances.join(", "))}</div>` : ""}
      ${weaknesses.length ? `<div><strong>Schwächen:</strong> ${esc(weaknesses.join(", "))}</div>` : ""}
      ${immunities.length ? `<div><strong>Immunitäten:</strong> ${esc(immunities.join(", "))}</div>` : ""}
    </div>`;
  }

  function skillsColumn(model) {
    const rows = Object.entries(I18N.SKILLS)
      .map(([key, s]) => {
        const n = model.skills[key];
        return `<div class="skill-row ${n.rank ? "trained" : ""}">
          <span class="sk-mod">${fmtMod(n.mod)}</span>
          <span class="sk-name">${esc(s.name)} <span class="sk-attr">${esc(I18N.ABILITIES[s.ability].short)}</span>${n.armorPenalty ? ` <span class="sk-pen" title="Rüstungsmalus eingerechnet">R${n.armorPenalty}</span>` : ""}</span>
          ${rankBoxes(n.rank)}
        </div>`;
      })
      .join("");
    const lores = (model.lores.length ? model.lores : [{ name: "", rank: 0, mod: null }])
      .map(
        (l) => `<div class="skill-row ${l.rank ? "trained" : ""}">
          <span class="sk-mod">${l.name ? fmtMod(l.mod) : ""}</span>
          <span class="sk-name">${esc(l.name) || "Kenntnis: ______________"} <span class="sk-attr">IN</span></span>
          ${rankBoxes(l.rank)}
        </div>`
      )
      .join("");
    return `
    <section class="col col-skills">
      ${banner("Fertigkeiten")}
      <div class="skill-list">${rows}${lores}</div>
      <div class="legend">Kästchen: <b>G</b>eübt · <b>E</b>xperte · <b>M</b>eister · <b>L</b>egende. Fett = mindestens geübt.</div>
      ${tip("skills")}
    </section>`;
  }

  function strikesBlock(model) {
    const rows = model.strikes
      .map(
        (s) => `<tr>
        <td class="st-name">${esc(s.name)}<span class="st-kind">${s.ranged ? `Fernkampf${s.range ? ` · ${s.range} Fuß` : ""}` : "Nahkampf"}</span></td>
        <td class="st-bonus">${fmtMod(s.map[0])}</td>
        <td class="st-map">${fmtMod(s.map[1])}</td>
        <td class="st-map">${fmtMod(s.map[2])}</td>
        <td class="st-dmg">${esc(s.damage)}</td>
        <td class="st-traits">${esc(s.traits.join(", "))}</td>
      </tr>`
      )
      .join("");
    const blanks = Array.from({ length: Math.max(0, 2 - model.strikes.length) }, () => `<tr class="blank"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
    return `
    <section class="strikes">
      ${banner("Angriffe", "◆ je Angriff · 2./3. Angriff im selben Zug mit Malus")}
      <table class="tbl strikes-tbl">
        <thead><tr><th>Waffe</th><th>1. Angriff</th><th>2.</th><th>3.</th><th>Schaden</th><th>Merkmale</th></tr></thead>
        <tbody>${rows}${blanks}</tbody>
      </table>
    </section>`;
  }

  function page1(model) {
    return `
    <section class="sheet-page p1">
      ${headerBlock(model)}
      ${warningsBlock(model)}
      <div class="p1-grid">
        ${attributeColumn(model)}
        ${defenseColumn(model)}
        ${skillsColumn(model)}
      </div>
      ${strikesBlock(model)}
      ${banner("Notizen")}
      <div class="notes">${Array.from({ length: 6 }, () => '<div class="note-line"></div>').join("")}</div>
      ${footer(model)}
    </section>`;
  }

  /* ---------- Fähigkeitskarten ---------- */

  function abilityCard(a, compact) {
    const meta = [a.categoryName, a.level ? `Stufe ${a.level}` : ""].filter(Boolean).join(" · ");
    return `<div class="ab-card ${compact ? "compact" : ""}">
      <div class="ab-head">${costBadge(a.cost)}<span class="ab-name">${esc(a.name)}${enTag(a.en)}</span><span class="ab-meta">${esc(meta)}</span></div>
      ${a.frequency ? `<div class="ab-line"><b>Häufigkeit:</b> ${esc(a.frequency)}</div>` : ""}
      ${a.trigger ? `<div class="ab-line"><b>Auslöser:</b> ${esc(a.trigger)}</div>` : ""}
      ${a.requirement ? `<div class="ab-line"><b>Voraussetzung:</b> ${esc(a.requirement)}</div>` : ""}
      <div class="ab-text">${a.summary ? esc(a.summary) : '<em class="muted">Keine deutsche Kurzfassung verfügbar – Details in Foundry nachlesen.</em>'}</div>
    </div>`;
  }

  function abilitySection(title, list, hint, compact) {
    if (!list.length) return "";
    return `${banner(title)}${hint ? `<div class="sec-hint">${esc(hint)}</div>` : ""}<div class="ab-grid">${list.map((a) => abilityCard(a, compact)).join("")}</div>`;
  }

  /* ---------- Fertigkeitsaktionen ---------- */

  function skillBonusFor(model, skill) {
    if (skill === "perception") return { name: "Wahrnehmung", mod: model.perception.mod, rank: model.perception.rank };
    if (skill === "knowledge" || skill === "magic") {
      const pool = skill === "magic" ? ACT.MAGIC_SKILLS : ACT.KNOWLEDGE_SKILLS;
      let best = null;
      pool.forEach((k) => {
        const n = model.skills[k];
        if (!best || n.mod > best.mod) best = { name: I18N.SKILLS[k].name, mod: n.mod, rank: n.rank };
      });
      model.lores.forEach((l) => {
        if (skill === "knowledge" && (!best || l.mod > best.mod)) best = { name: l.name, mod: l.mod, rank: l.rank };
      });
      return best;
    }
    if (skill === "any") {
      let best = null;
      Object.keys(I18N.SKILLS).forEach((k) => {
        const n = model.skills[k];
        if (n.rank && (!best || n.mod > best.mod)) best = { name: I18N.SKILLS[k].name, mod: n.mod, rank: n.rank };
      });
      return best || { name: "–", mod: null, rank: 0 };
    }
    const n = model.skills[skill];
    return { name: I18N.SKILLS[skill].name, mod: n.mod, rank: n.rank };
  }

  function skillActionTable(model, when, title) {
    const usable = ACT.SKILL_ACTIONS.filter((a) => a.when === when)
      .map((a) => {
        const e = D.entry(a.slug);
        return { a, sk: skillBonusFor(model, a.skill), name: (e && e.n) || a.slug };
      })
      .filter(({ a, sk }) => sk && (!a.trained || sk.rank >= 1));
    // Nur das Nötigste: wichtige Aktionen + alles, worin du geübt bist
    const shown = usable.filter(({ a, sk }) => ACT.CORE.has(a.slug) || sk.rank >= 1);
    const rest = usable.filter((x) => !shown.includes(x));
    if (!shown.length && !rest.length) return "";
    const rows = shown
      .sort((x, y) => (y.sk.rank ? 1 : 0) - (x.sk.rank ? 1 : 0) || y.sk.mod - x.sk.mod || x.name.localeCompare(y.name, "de"))
      .map(
        ({ a, sk, name }) => `<tr class="${sk.rank ? "trained" : ""}">
          <td class="sa-cost">${costBadge(a.cost)}</td>
          <td class="sa-name">${esc(name)}${enTag(D.titleFromSlug(a.slug))}</td>
          <td class="sa-skill">${esc(sk.name)} <b>${fmtMod(sk.mod)}</b></td>
          <td class="sa-vs">${esc(a.vs || "")}</td>
          <td class="sa-text">${esc(a.text)}</td>
        </tr>`
      )
      .join("");
    return `${banner(title)}
      <table class="tbl sa-tbl">
        <thead><tr><th></th><th>Aktion</th><th>Fertigkeit</th><th>gegen</th><th>Was passiert?</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${
        rest.length
          ? `<div class="sec-hint">Außerdem (ungeübt) möglich: ${rest
              .map(({ name, sk }) => `${esc(name)} (${esc(sk.name)} ${fmtMod(sk.mod)})`)
              .join(" · ")}</div>`
          : ""
      }`;
  }

  /* ---------- Seite 2: Im Kampf ---------- */

  function page2(model) {
    const list = model.abilitiesList;
    const actions = list.filter((a) => a.when === "kampf");
    const passive = list.filter((a) => a.when === "kampf-passiv");
    const order = { 1: 1, 2: 2, 3: 3, F: 4, R: 5 };
    actions.sort((a, b) => (order[a.cost] || 9) - (order[b.cost] || 9) || a.name.localeCompare(b.name, "de"));
    return `
    <section class="sheet-page">
      <h2 class="page-title">Im Kampf</h2>
      <div class="turn-box">
        <div class="turn-icons"><span class="cost big">◆</span><span class="cost big">◆</span><span class="cost big">◆</span><span class="plus">+</span><span class="cost cost-reaction big">⤾</span></div>
        <div class="turn-text">
          <b>Dein Zug:</b> 3 Aktionen und 1 Reaktion (die Reaktion darfst du auch im Zug anderer nutzen, sobald ihr Auslöser eintritt).
          <b>Initiative:</b> Wahrnehmung ${fmtMod(model.perception.mod)} (oder die Fertigkeit, die zur Situation passt, z. B. Heimlichkeit beim Anschleichen).
          <b>Mehrfachangriff:</b> 2. Angriff −5, 3. Angriff −10 (Agil: −4/−8) – siehe Angriffe auf Seite 1.
        </div>
      </div>
      ${abilitySection("Deine Aktionen & Reaktionen", actions, "Nur das Nötigste – genaue Regeln in Foundry oder im Regelwerk.")}
      ${skillActionTable(model, "kampf", "Fertigkeitsaktionen im Kampf")}
      ${abilitySection("Immer an im Kampf (passiv)", passive, "", true)}
      ${footer(model)}
    </section>`;
  }

  /* ---------- Seite 3: Außerhalb des Kampfes ---------- */

  function page3(model) {
    const list = model.abilitiesList;
    const outside = list.filter((a) => a.when === "ausserhalb");
    const always = list.filter((a) => a.when === "immer");
    const builtin = list.filter((a) => a.when === "eingerechnet");
    return `
    <section class="sheet-page">
      <h2 class="page-title">Außerhalb des Kampfes</h2>
      <div class="sec-hint">Grundaktionen und Erkundungsaktivitäten (Laufen, Schritt, Absuchen …) stehen auf dem gemeinsamen Tischreferenz-Blatt.</div>
      ${skillActionTable(model, "ausserhalb", "Fertigkeitsaktionen außerhalb des Kampfes")}
      ${abilitySection("Deine Fähigkeiten außerhalb des Kampfes", outside, "Erkundung, Auszeit, Gespräche und Handwerk.")}
      ${abilitySection("Immer aktiv / allgemein", always, "Gilt jederzeit – im Kampf wie außerhalb.", true)}
      ${
        builtin.length
          ? `${banner("Schon auf dem Bogen eingerechnet")}
        <div class="builtin">${builtin.map((a) => `<span>${esc(a.name)}</span>`).join("")}</div>
        <div class="sec-hint">Diese Talente/Merkmale verändern nur Zahlen (Kompetenz, TP, Geschwindigkeit …) – die Werte auf Seite 1 enthalten sie bereits.</div>`
          : ""
      }
      ${footer(model)}
    </section>`;
  }

  /* ---------- Seite 4: Zauber ---------- */

  function spellsPage(model) {
    const sc = model.spellcasting;
    if (!sc.entries.length) return "";
    const entries = sc.entries
      .map((e) => {
        const slotBoxes = e.slots
          .filter((s) => s.rank > 0)
          .map((s) => `<span class="slot"><b>${s.rank}.</b> ${Array.from({ length: s.max }, () => '<span class="chk"></span>').join("")}</span>`)
          .join("");
        const byRank = new Map();
        e.spells.forEach((sp) => {
          const k = sp.cantrip ? 0 : sp.rank;
          if (!byRank.has(k)) byRank.set(k, []);
          byRank.get(k).push(sp);
        });
        const rows = Array.from(byRank.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([rank, spells]) =>
            spells
              .map(
                (sp, i) => `<tr>
              ${i === 0 ? `<td class="sp-rank" rowspan="${spells.length}">${rank === 0 ? "Trick" : rank + "."}</td>` : ""}
              <td class="sp-name">${esc(sp.name)}${enTag(sp.en)}</td>
              <td class="sp-cost">${costBadge(sp.cost)}</td>
              <td class="sp-range">${esc(sp.range)}</td>
              <td class="sp-def">${esc(sp.defense)}</td>
              <td class="sp-text">${sp.summary ? esc(sp.summary) : '<em class="muted">–</em>'}</td>
            </tr>`
              )
              .join("")
          )
          .join("");
        return `
        <div class="spell-entry">
          ${banner(`${e.name} · ${e.tradition} · ${e.kind}`)}
          <div class="spell-stats">
            <div class="stat small"><div class="box-title">Zauber-SG</div><div class="stat-val">${esc(e.dc)}</div></div>
            <div class="stat small"><div class="box-title">Zauberangriff</div><div class="stat-val">${fmtMod(e.attack)}</div></div>
            <div class="stat small"><div class="box-title">Kompetenz</div>${rankBoxes(e.rank)}</div>
            ${slotBoxes ? `<div class="slots"><div class="box-title">Zauberplätze pro Tag (abhaken)</div>${slotBoxes}</div>` : ""}
          </div>
          <table class="tbl spell-tbl">
            <thead><tr><th>Grad</th><th>Zauber</th><th></th><th>Reichweite</th><th>Verteidigung</th><th>Kurz erklärt</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      })
      .join("");
    const focus = sc.focus.max
      ? `<div class="focus-row"><b>Fokuspunkte:</b> ${Array.from({ length: sc.focus.max }, (_, i) => `<span class="hero-pip ${i < sc.focus.value ? "on" : ""}"></span>`).join("")} <span class="mini">(Fokus erneuern: 10 Minuten → 1 Punkt zurück)</span></div>`
      : "";
    return `
    <section class="sheet-page">
      <h2 class="page-title">Zauber</h2>
      ${tip("spells")}
      ${focus}
      ${entries}
      ${footer(model)}
    </section>`;
  }

  /* ---------- Seite 5: Ausrüstung, Stufenplan & Notizen ---------- */

  function itemDescriptions(model) {
    const seen = new Set();
    const magic = [];
    const mundane = [];
    model.inventory.forEach((it) => {
      if (seen.has(it.name)) return;
      seen.add(it.name);
      const d = it.desc;
      const isGear = ["weapon", "armor", "shield"].includes(it.type);
      // Werte normaler Waffen/Rüstungen stehen schon auf Seite 1 – dort nur Magisches erklären
      if (isGear && !it.magical) return;
      if (it.magical) {
        if (d || it.runes.length || it.spell) magic.push(it);
      } else if (d && (d.s || d.act || d.eff)) mundane.push(it);
    });
    magic.sort((x, y) => y.level - x.level || x.name.localeCompare(y.name, "de"));
    mundane.sort((x, y) => x.name.localeCompare(y.name, "de"));

    const line = (label, text) => (text ? `<div class="ab-line"><b>${label}:</b> ${esc(text)}</div>` : "");
    const magicCards = magic
      .map((it) => {
        const d = it.desc || {};
        const isGear = ["weapon", "armor", "shield"].includes(it.type);
        const meta = [it.level ? `Stufe ${it.level}` : "", it.invested ? "investiert" : it.traitsDe.includes(D.trait("invested")) ? "muss investiert werden" : ""]
          .filter(Boolean)
          .join(" · ");
        const traits = it.traitsDe.filter((t) => t !== D.trait("invested")).join(", ");
        return `<div class="ab-card item-card">
          <div class="ab-head"><span class="item-star">✦</span><span class="ab-name">${esc(it.name)}</span><span class="ab-meta">${esc(meta)}</span></div>
          ${traits ? `<div class="item-traits">${esc(traits)}</div>` : ""}
          ${line("Aktivierung", d.act)}
          ${line("Häufigkeit", d.freq)}
          ${line("Auslöser", d.trigger)}
          ${line("Voraussetzung", d.req)}
          ${d.s && !(isGear && it.runes.length) ? `<div class="ab-text">${esc(d.s)}</div>` : ""}
          ${line("Effekt", d.eff)}
          ${d.sp && d.sp.length ? line("Zauber", d.sp.join(" · ")) : ""}
          ${it.spell ? `<div class="ab-line"><b>Enthaltener Zauber:</b> ${esc(it.spell.name)} (${esc(it.spell.rank)}. Grad)${it.spell.summary ? " – " + esc(it.spell.summary) : ""}</div>` : ""}
          ${it.runes.map((r) => `<div class="ab-line"><b>Rune ${esc(r.name)}:</b> ${esc(r.summary)}</div>`).join("")}
          ${!d.s && !d.act && !d.eff && !it.runes.length && !it.spell ? '<div class="ab-text"><em class="muted">Keine deutsche Beschreibung verfügbar – Details in Foundry nachlesen.</em></div>' : ""}
        </div>`;
      })
      .join("");
    const mundaneRows = mundane
      .map((it) => {
        const d = it.desc;
        const text = [d.act ? `Aktivierung ${d.act}.` : "", d.s, d.eff].filter(Boolean).join(" ");
        return `<div class="mundane"><b>${esc(it.name)}:</b> ${esc(text)}</div>`;
      })
      .join("");
    if (!magicCards && !mundaneRows) return "";
    return `
      ${magicCards ? `${banner("Magische & besondere Gegenstände – kurz erklärt")}<div class="ab-grid">${magicCards}</div>` : ""}
      ${mundaneRows ? `${banner("Weitere Ausrüstung – kurz erklärt")}<div class="mundane-list">${mundaneRows}</div>` : ""}`;
  }

  function gearPage(model) {
    const rows = model.inventory
      .map(
        (it) => `<tr class="${it.equipped ? "equipped" : ""}">
        <td>${it.magical ? '<span class="item-star">✦</span> ' : ""}${esc(it.name)}${it.container ? ` <span class="mini">(in ${esc(it.container)})</span>` : ""}</td>
        <td class="num">${it.level || ""}</td>
        <td class="num">${esc(it.quantity)}</td>
        <td class="num">${esc(it.bulk)}</td>
        <td class="num">${it.held ? "in der Hand" : it.equipped ? "getragen" : ""}${it.invested ? " · investiert" : ""}</td>
      </tr>`
      )
      .join("");
    const cur = model.currency;
    const b = model.bulk;
    return `
    <section class="sheet-page">
      <h2 class="page-title">Ausrüstung</h2>
      <div class="gear-grid">
        <div>
          ${banner("Alle Gegenstände", "✦ = magisch/besonders – Erklärung unten")}
          <table class="tbl inv-tbl">
            <thead><tr><th>Gegenstand</th><th>Stufe</th><th>Anz.</th><th>Trag&shy;last</th><th>Status</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5" class="muted">Keine Gegenstände im Export.</td></tr>'}
            ${Array.from({ length: 3 }, () => '<tr class="blank"><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join("")}</tbody>
          </table>
        </div>
        <div>
          ${banner("Traglast")}
          <div class="bulk-box">
            <div><b>Getragen:</b> ${esc(b.value)}${b.light ? ` + ${esc(b.light)} L` : ""}</div>
            <div><b>Belastet ab:</b> mehr als ${esc(b.encumbered)}</div>
            <div><b>Maximum:</b> ${esc(b.max)}</div>
          </div>
          ${tip("bulk")}
          ${banner("Vermögen")}
          <div class="coins">
            <div class="coin"><span>${esc(cur.pp)}</span>Platin</div>
            <div class="coin"><span>${esc(cur.gp)}</span>Gold</div>
            <div class="coin"><span>${esc(cur.sp)}</span>Silber</div>
            <div class="coin"><span>${esc(cur.cp)}</span>Kupfer</div>
          </div>
          ${tip("invested")}
        </div>
      </div>
      ${itemDescriptions(model)}
      ${footer(model)}
    </section>`;
  }

  /* ---------- Stufenplan & Notizen ---------- */

  function planPage(model) {
    const plan = model.levelPlan
      .map(
        (p) => `<tr class="${p.reached ? "reached" : "future"}">
        <td class="lp-lvl">${p.level}</td>
        <td class="lp-entries">${p.entries
          .map(
            (e) =>
              `<span class="lp-e ${e.future ? "future-feature" : ""}"><span class="lp-kind">${esc(e.kind)}:</span> ${e.name ? esc(e.name) : '<span class="write-line"></span>'}</span>`
          )
          .join("")}</td>
      </tr>`
      )
      .join("");
    return `
    <section class="sheet-page">
      <h2 class="page-title">Entwicklung &amp; Notizen</h2>
      ${banner("Stufenplan 1–20", "für Stufenaufstiege – leere Felder von Hand ausfüllen")}
      <table class="tbl plan-tbl"><tbody>${plan}</tbody></table>
      ${banner("Notizen")}
      <div class="notes">${Array.from({ length: 14 }, () => '<div class="note-line"></div>').join("")}</div>
      ${footer(model)}
    </section>`;
  }

  /* ---------- Zustände ---------- */

  function englishCondition(slug) {
    if (slug === "off-guard") return "Off-Guard";
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function conditionsPage(model) {
    const active = new Map((model.conditions || []).map((c) => [D.slug(c.name), c.value]));
    const cards = I18N.CONDITIONS.map((c) => {
      const e = D.entry("cond:" + c.slug) || D.entry(c.slug) || {};
      return Object.assign({}, c, { name: e.n || c.slug });
    })
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .map((c) => {
      const name = c.name;
      const isActive = active.has(D.slug(name)) || active.has(c.slug);
      return `<div class="cond">
        <div class="cond-head"><span class="chk ${isActive ? "on" : ""}"></span><b>${esc(name)}</b> <span class="en-name">(${esc(englishCondition(c.slug))})</span>${c.value ? '<span class="cond-val">Wert <span class="write-box"></span></span>' : ""}</div>
        <div class="cond-text">${esc(c.text)}</div>
      </div>`;
    }).join("");
    return `
    <section class="sheet-page">
      <h2 class="page-title">Zustände</h2>
      ${tip("conditions")}
      <div class="cond-grid">${cards}</div>
      ${footer(model)}
    </section>`;
  }

  /* ---------- Sonstiges ---------- */

  function warningsBlock(model) {
    if (!model.warnings || !model.warnings.length) return "";
    return `<div class="warnings no-print-optional"><strong>Hinweise zum Import:</strong><ul>${model.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>`;
  }

  function footer(model) {
    return `<div class="page-foot"><span>${esc(model.meta.name)} · Stufe ${esc(model.meta.level)} ${esc(model.meta.className)}</span><span>Seite #</span></div>`;
  }

  /* ---------- Tischreferenz (einmal pro Tisch) ---------- */

  function referencePage() {
    const card = (slug, name, cost, text) => {
      const e = D.entry(slug);
      return `<div class="basic"><div class="basic-head">${costBadge(cost)} <b>${esc((e && e.n) || name)}</b>${enTag(D.titleFromSlug(slug))}</div><div class="basic-text">${esc(text)}</div></div>`;
    };
    const basic = ACT.BASIC_ACTIONS.map((b) => card(b.slug, b.name, b.cost, b.text)).join("");
    const explore = ACT.EXPLORATION.map((x) => card(x.slug, x.name, "E", x.text)).join("");
    return `
    <section class="sheet-page reference">
      <h2 class="page-title">Tischreferenz</h2>
      <div class="turn-box">
        <div class="turn-icons"><span class="cost big">◆</span><span class="cost big">◆</span><span class="cost big">◆</span><span class="plus">+</span><span class="cost cost-reaction big">⤾</span></div>
        <div class="turn-text">
          <b>Dein Zug:</b> 3 Aktionen und 1 Reaktion (die Reaktion darfst du auch im Zug anderer nutzen, sobald ihr Auslöser eintritt). Freie Aktionen (◇) kosten nichts.
          <b>Mehrfachangriff:</b> 2. Angriff −5, 3. Angriff −10 (Agil: −4/−8).
          <b>Würfe:</b> W20 + Bonus gegen SG – 10 drüber = kritischer Erfolg, 10 drunter = kritischer Fehlschlag; eine natürliche 20/1 verbessert/verschlechtert das Ergebnis um eine Stufe.
        </div>
      </div>
      ${banner("Grundaktionen", "kann jede:r")}
      <div class="basic-grid">${basic}</div>
      ${banner("Erkundung – was tust du unterwegs?")}
      <div class="sec-hint">Wähle beim Reisen eine Erkundungsaktivität. Sie bestimmt oft, womit du die Initiative würfelst, wenn ein Kampf beginnt.</div>
      <div class="basic-grid">${explore}</div>
      ${banner("Deckung & Flankieren")}
      <div class="basic-grid">
        <div class="basic"><div class="basic-head"><b>Deckung</b>${enTag("Cover")}</div><div class="basic-text">Leicht: +1 RK · Normal: +2 RK, Reflex und Heimlichkeit · Groß: +4. Ermöglicht Verstecken.</div></div>
        <div class="basic"><div class="basic-head"><b>Flankieren</b>${enTag("Flanking")}</div><div class="basic-text">Du und ein Verbündeter steht auf gegenüberliegenden Seiten eines Gegners: Er ist für eure Nahkampfangriffe Auf dem falschen Fuß (−2 RK).</div></div>
      </div>
      <div class="page-foot"><span>Pathfinder 2 · Tischreferenz – einmal pro Tisch ausdrucken</span><span></span></div>
    </section>`;
  }

  function numberPages(pages) {
    let n = 0;
    return pages.join("").replace(/<span>Seite #<\/span>/g, () => `<span>Seite ${++n} / ${pages.length}</span>`);
  }

  function render(model, options) {
    const opts = options || {};
    const pages = [page1, page2, page3, spellsPage, gearPage, planPage, conditionsPage].map((fn) => fn(model)).filter(Boolean);
    const ref = opts.includeReference ? referencePage() : "";
    return `<div class="pf2-sheet">${numberPages(pages)}${ref}</div>`;
  }

  /** Nur das Tischreferenz-Blatt (Grundaktionen & Erkundung) */
  function renderReference() {
    return `<div class="pf2-sheet">${referencePage()}</div>`;
  }

  global.PF2_RENDER = { render, renderReference };
})(typeof window !== "undefined" ? window : globalThis);
