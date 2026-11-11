/*
 * Vorderseite des Charakterbogens im klassischen Einsteigerbox-Layout
 * (Würfel-/Aktions-/Kompetenz-Leiste links, Attribute, TP, Bewegung,
 * Wahrnehmung, Fertigkeiten, RK, Rettungswürfe, Waffen & Angriffe).
 *
 * Werte aus dem Foundry-Export werden eingetragen, alle Felder bleiben aber
 * so gestaltet, dass man sie bei einem Stufenaufstieg (bis Stufe 20) von Hand
 * überschreiben kann. Kompetenzstufen: G = Geübt, E = Experte, M = Meister,
 * L = Legendär.
 */
(function (global) {
  "use strict";

  const I18N = global.PF2_I18N;

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sign(n) {
    if (n == null || Number.isNaN(n)) return "";
    return n >= 0 ? `+${n}` : `${n}`;
  }

  function plain(n) {
    if (n == null || Number.isNaN(n)) return "";
    return String(n);
  }

  /** Kompetenzbonus: ungeübt 0, sonst Stufe + 2/4/6/8. */
  function profBonus(level, rank) {
    return rank > 0 ? level + 2 * rank : 0;
  }

  /*
   * Bogen-Art (wird von render() gesetzt):
   *   blank.session – Werte, die sich während einer Spielrunde ändern, leer lassen
   *   blank.level   – zusätzlich alles leer lassen, was sich beim Stufenaufstieg ändert
   */
  let blank = { session: false, level: false };
  /** Wert nur ausgeben, wenn er nicht zur Spielrunde gehört. */
  const S = (v) => (blank.session ? "" : v);
  /** Wert nur ausgeben, wenn er sich beim Stufenaufstieg nicht ändert. */
  const L = (v) => (blank.level ? "" : v);
  /** Kompetenzstufe (G/E/M/L) – beim Stufenaufstieg-Bogen leer. */
  const R = (rank) => (blank.level ? null : rank);

  const RANK_LETTERS = ["G", "E", "M", "L"];

  /** Kompetenz-Kästchen G/E/M/L; erreichte Stufen sind ausgefüllt. */
  function teml(rank, mode) {
    const cells = RANK_LETTERS.map(
      (l, i) => `<span class="${rank != null && rank >= i + 1 ? "on" : ""}">${l}</span>`
    ).join("");
    return `<span class="cs-teml ${mode || "grid"}">${cells}</span>`;
  }

  /**
   * Schriftgröße für lange Einträge: statt abzuschneiden wird die Schrift
   * kleiner und darf umbrechen ("long" = 2 Zeilen, "xlong" = 3 Zeilen).
   */
  function lengthClass(text, longFrom, xlongFrom) {
    const n = String(text || "").length;
    return n > xlongFrom ? "xlong" : n > longFrom ? "long" : "";
  }

  /** Unterstrichenes Feld mit kleinem Etikett darunter. */
  function field(value, label, cls) {
    return `<span class="cs-blank ${cls || ""}"><span class="v">${esc(value)}</span><span class="l">${esc(label)}</span></span>`;
  }

  /* ---------------------------------------------------------- Symbole */

  const DICE = {
    d4: `<svg viewBox="0 0 40 40"><polygon points="20,3 37,35 3,35" fill="#f4e300" stroke="#111" stroke-width="2" stroke-linejoin="round"/></svg>`,
    d6: `<svg viewBox="0 0 40 40"><polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="#a066b0" stroke="#111" stroke-width="2" stroke-linejoin="round"/><polyline points="4,11 20,20 36,11" fill="none" stroke="#111" stroke-width="1.6"/><line x1="20" y1="20" x2="20" y2="38" stroke="#111" stroke-width="1.6"/></svg>`,
    d8: `<svg viewBox="0 0 40 40"><polygon points="20,2 36,12 36,28 20,38 4,28 4,12" fill="#e57b2c" stroke="#111" stroke-width="2" stroke-linejoin="round"/><polygon points="20,8 31,28 9,28" fill="none" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/><path d="M20 2V8M4 28H9M36 28H31M4 12L9 28M36 12L31 28M20 38L9 28M20 38L31 28" stroke="#111" stroke-width="1.2" fill="none"/></svg>`,
    d10: `<svg viewBox="0 0 40 40"><polygon points="20,2 37,19 20,38 3,19" fill="#3fb44b" stroke="#111" stroke-width="2" stroke-linejoin="round"/><polygon points="20,10 29,20 20,26 11,20" fill="none" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/><path d="M20 2V10M3 19L11 20M37 19L29 20M20 38V26" stroke="#111" stroke-width="1.2"/></svg>`,
    d12: `<svg viewBox="0 0 40 40"><polygon points="20,2 30.6,5.4 37.1,14.4 37.1,25.6 30.6,34.6 20,38 9.4,34.6 2.9,25.6 2.9,14.4 9.4,5.4" fill="#1f6db3" stroke="#111" stroke-width="2" stroke-linejoin="round"/><polygon points="20,10 29.5,17 26,28 14,28 10.5,17" fill="none" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/><path d="M20 2V10M37.1 14.4L29.5 17M30.6 34.6L26 28M9.4 34.6L14 28M2.9 14.4L10.5 17" stroke="#111" stroke-width="1.2"/></svg>`,
    d20: `<svg viewBox="0 0 40 40"><polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="#d42a2a" stroke="#111" stroke-width="2" stroke-linejoin="round"/><polygon points="20,11 30,27 10,27" fill="none" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/><path d="M20 2V11M4 11L20 11M36 11L20 11M4 11L10 27M36 11L30 27M4 29L10 27M36 29L30 27M20 38L10 27M20 38L30 27" stroke="#111" stroke-width="1.1" fill="none"/></svg>`,
  };

  const diamond = (x, fill) =>
    `<polygon points="${x},10 ${x + 8},2 ${x + 16},10 ${x + 8},18" fill="${fill}" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/><polyline points="${x + 5},6 ${x + 9},10 ${x + 5},14" fill="none" stroke="#fff" stroke-width="2"/>`;

  // Reaktion: gebogener Pfeil gegen den Uhrzeigersinn
  const REACTION_SVG = `<svg viewBox="0 0 24 20"><path d="M12 17.5 A7.5 7.5 0 1 0 4.8 8" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/><polygon points="1,4.5 9.5,6.5 3,12.5" fill="#111"/></svg>`;
  const FREE_SVG = `<svg viewBox="0 0 20 20"><polygon points="2,10 10,2 18,10 10,18" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/><polygon points="6,10 10,6 14,10 10,14" fill="#111"/></svg>`;

  /** Aktionssymbol als HTML (für Tabellen der Folgeseiten): 1–3 Aktionen, F, R, sonst Text. */
  function actionIcon(cost) {
    if (cost === "R") return `<span class="cs-ico">${REACTION_SVG}</span>`;
    if (cost === "F") return `<span class="cs-ico">${FREE_SVG}</span>`;
    if (typeof cost === "number" && cost >= 1) {
      const n = Math.min(cost, 3);
      let d = "";
      for (let i = 0; i < n; i++) d += diamond(2 + i * 10, "#111");
      return `<span class="cs-ico n${n}"><svg viewBox="0 0 ${n * 10 + 10} 20">${d}</svg></span>`;
    }
    return "";
  }

  const ACTION_ICONS = [
    { label: "Einzelaktion", svg: `<svg viewBox="0 0 20 20">${diamond(2, "#111")}</svg>` },
    { label: "Zwei-Aktionen-Aktivität", svg: `<svg viewBox="0 0 30 20">${diamond(2, "#111")}${diamond(12, "#111")}</svg>` },
    { label: "Drei-Aktionen-Aktivität", svg: `<svg viewBox="0 0 40 20">${diamond(2, "#111")}${diamond(12, "#111")}${diamond(22, "#111")}</svg>` },
    {
      label: "Freie Aktion",
      svg: FREE_SVG,
    },
    {
      label: "Reaktion",
      svg: REACTION_SVG,
    },
  ];

  const SHAPE = {
    heart: `<svg viewBox="0 0 100 80" preserveAspectRatio="none"><path d="M50 76 C20 56 3 40 3 22 C3 10 13 3 25 3 C36 3 45 10 50 18 C55 10 64 3 75 3 C87 3 97 10 97 22 C97 40 80 56 50 76Z" fill="#fff" stroke="#e0661b" stroke-width="5" stroke-linejoin="round"/></svg>`,
    shield: `<svg viewBox="0 0 100 80" preserveAspectRatio="none"><path d="M18 4 H82 L96 18 V44 C96 60 74 72 50 77 C26 72 4 60 4 44 V18 Z" fill="#fff" stroke="#e0661b" stroke-width="5" stroke-linejoin="round"/></svg>`,
    arrow: `<svg viewBox="0 0 120 50" preserveAspectRatio="none"><path d="M3 13 H78 V3 L117 25 L78 47 V37 H3 Z" fill="#fff" stroke="#e0661b" stroke-width="4" stroke-linejoin="round"/></svg>`,
    lens: `<svg viewBox="0 0 100 100"><line x1="68" y1="68" x2="94" y2="94" stroke="#e0661b" stroke-width="12" stroke-linecap="round"/><circle cx="42" cy="42" r="36" fill="#fff" stroke="#e0661b" stroke-width="7"/></svg>`,
    melee: `<svg viewBox="0 0 120 60" preserveAspectRatio="none"><path d="M3 10 C3 5 6 3 11 3 H98 L117 30 L98 57 H11 C6 57 3 55 3 50 Z" fill="#fff" stroke="#e0661b" stroke-width="4" stroke-linejoin="round"/></svg>`,
    ranged: `<svg viewBox="0 0 120 60" preserveAspectRatio="none"><path d="M5 57 C10 30 30 4 60 3 C90 4 110 30 115 57 Z" fill="#fff" stroke="#e0661b" stroke-width="4" stroke-linejoin="round"/></svg>`,
    box: `<svg viewBox="0 0 100 60" preserveAspectRatio="none"><path d="M10 3 H90 C94 3 97 6 97 10 V20 L93 30 L97 40 V50 C97 54 94 57 90 57 H10 C6 57 3 54 3 50 V40 L7 30 L3 20 V10 C3 6 6 3 10 3 Z" fill="#fff" stroke="#e0661b" stroke-width="4" stroke-linejoin="round"/></svg>`,
  };

  function shaped(kind, value, extraCls) {
    return `<span class="cs-shape cs-shape-${kind} ${extraCls || ""}">${SHAPE[kind]}<span class="val">${esc(value)}</span></span>`;
  }

  /* -------------------------------------------------------- Bausteine */

  function header(model) {
    const m = model.meta;
    const heroMax = Math.max(m.heroPointsMax || 3, 3);
    const hero = Array.from({ length: heroMax }, (_, i) => `<span class="cs-hero ${!blank.session && i < m.heroPoints ? "on" : ""}"></span>`).join("");
    const ancestry = [m.ancestry, m.heritage].filter(Boolean).join(" / ");
    return `
    <div class="cs-top">
      <div class="cs-brand">PATHFINDER<span>2. Edition</span></div>
      <div class="cs-title">Charakterbogen</div>
    </div>
    <div class="cs-id">
      <div class="cs-id-name">
        <div class="cs-bar">Charaktername</div>
        <div class="cs-id-val big">${esc(m.name)}</div>
        <div class="cs-id-player"><span>${esc(m.player && m.player !== m.name ? m.player : "")}</span><em>Spielername</em></div>
      </div>
      <div><div class="cs-bar">Stufe</div><div class="cs-id-val">${esc(L(m.level))}</div></div>
      <div><div class="cs-bar">EP</div><div class="cs-id-val">${esc(L(m.xp != null ? m.xp : ""))}</div></div>
      <div><div class="cs-bar">Heldenpunkte</div><div class="cs-id-val">${hero}</div></div>
      <div><div class="cs-bar">Volk / Erbe</div><div class="cs-id-val">${esc(ancestry)}</div></div>
      <div><div class="cs-bar">Hintergrund</div><div class="cs-id-val">${esc(m.background)}</div></div>
      <div><div class="cs-bar">Klasse</div><div class="cs-id-val">${esc(m.className)}</div></div>
    </div>`;
  }

  function sidebar() {
    const dice = ["d4", "d6", "d8", "d10", "d12", "d20"]
      .map((d) => `<div class="cs-die">${DICE[d]}<span>W${d.slice(1)}</span></div>`)
      .join("");
    const actions = ACTION_ICONS.map((a) => `<div class="cs-act">${a.svg}<span>${esc(a.label)}</span></div>`).join("");
    const prof = I18N.PROFICIENCY_RANKS.map(
      (r) => `<div class="cs-prof"><strong>${esc(r.value === 4 ? "Legendär" : r.name)}</strong><span>${r.value ? `${r.value * 2} + Stufe` : "0"}</span></div>`
    ).join("");
    return `
    <aside class="cs-side">
      <div class="cs-side-bar">Würfel</div>
      <div class="cs-dice">${dice}</div>
      <div class="cs-side-bar">Aktionen</div>
      <div class="cs-acts">${actions}</div>
      <div class="cs-side-bar">Kompetenz</div>
      <div class="cs-profs">${prof}</div>
    </aside>`;
  }

  function abilities(model) {
    const rows = Object.values(I18N.ABILITIES)
      .map(
        (a) => `
        <div class="cs-abil">
          <div class="cs-abil-name"><strong>${esc(a.name)}</strong><label><span class="cs-check ${!blank.level && model.partialBoosts && model.partialBoosts[a.key] ? "on" : ""}"></span>Teilsteigerung</label></div>
          <div class="cs-abil-box">${esc(L(sign(model.abilities[a.key] || 0)))}</div>
          <div class="cs-abil-short">${esc(a.short)}</div>
        </div>`
      )
      .join("");
    return `<div class="cs-panel cs-abils"><div class="cs-bar">Attributsmodifikatoren</div>${rows}</div>`;
  }

  function vitals(model) {
    const level = model.meta.level;
    const dying = blank.session ? 0 : model.dying || 0;
    const dyingCells = [1, 2, 3, 4].map((i) => `<span class="${i <= dying ? "on" : ""}">${i}</span>`).join("");
    const per = model.perception;
    const wis = model.abilities.wis || 0;
    const perProf = profBonus(level, per.rank);
    const perTotal = per.mod != null ? per.mod : wis + perProf;
    const perItem = perTotal - wis - perProf;
    return `
    <div class="cs-vitals">
      <div class="cs-panel cs-hp">
        <div class="cs-bar">Trefferpunkte</div>
        <div class="cs-hp-top">
          <div class="cs-hp-cur">${shaped("heart", S(model.hp.value))}<span class="l">Aktuell</span></div>
          <div class="cs-hp-max"><span class="v">${esc(L(model.hp.max))}</span><span class="l">Max</span></div>
          <div class="cs-hp-temp"><span class="v">${esc(S(model.hp.temp || ""))}</span><span class="l">Temp</span></div>
        </div>
        <div class="cs-hp-cond">
          <div><strong>Sterbend</strong><span class="cs-dying">${dyingCells}</span></div>
          <div><strong>Verwundet</strong><span class="cs-wounded">${esc(S(model.wounded || ""))}</span></div>
        </div>
      </div>
      <div class="cs-panel cs-speed">
        <div class="cs-bar">Bewegungsrate</div>
        <div class="cs-speed-row">${shaped("arrow", model.speed.value)}<span class="cs-unit">Fuß</span></div>
        ${
          model.speed.others.length
            ? `<div class="cs-speed-other">${model.speed.others.map((s) => (typeof s === "string" ? esc(s) : `${esc(s.label || s.type)} ${esc(s.value)} Fuß`)).join(", ")}</div>`
            : ""
        }
      </div>
      <div class="cs-panel cs-perc">
        <div class="cs-bar">Wahrnehmung</div>
        <div class="cs-perc-row">
          ${shaped("lens", L(sign(perTotal)))}
          <span class="cs-eq">=</span>${field(L(sign(wis)), "WE")}<span class="cs-op">+</span>${field(L(plain(perProf)), "KOMP.")}
          ${teml(R(per.rank), "grid")}
        </div>
        ${perItem && !blank.level ? `<div class="cs-perc-item">Gegenstand/Sonstiges: ${esc(sign(perItem))}</div>` : ""}
        ${(per.senses || []).length ? `<div class="cs-perc-item">Sinne: ${esc(per.senses.join(", "))}</div>` : ""}
      </div>
    </div>`;
  }

  // Fertigkeiten mit Rüstungsmalus (wie im Original markiert)
  const ARMOR_SKILLS = new Set(["acrobatics", "athletics", "stealth", "thievery"]);

  function skillRow(name, attrKey, rank, explicitMod, model, armor, nameIsInput, armorPenalty) {
    const level = model.meta.level;
    const attr = model.abilities[attrKey] || 0;
    const prof = profBonus(level, rank);
    const total = explicitMod != null ? explicitMod : attr + prof;
    // Rüstungsmalus (negativ) separat; der Rest sind Gegenstands-/sonstige Boni.
    const penalty = armorPenalty || 0;
    const item = total - attr - prof - penalty;
    const short = I18N.ABILITIES[attrKey].short;
    return `
      <div class="cs-skill">
        <div class="cs-skill-name">${nameIsInput ? `<span class="cs-lore ${lengthClass(name, 16, 30)}">${esc(name)}</span><span class="cs-lore-suffix">Kenntnis</span>` : esc(name)}</div>
        ${shaped("box", nameIsInput && !name ? "" : L(sign(total)))}
        <div class="cs-skill-calc">
          <span class="cs-eq">=</span>${field(nameIsInput && !name ? "" : L(sign(attr)), short)}
          <span class="cs-op">+</span>${field(nameIsInput && !name ? "" : L(plain(prof)), "KOMP.")}${teml(R(rank), "grid")}
          <span class="cs-op">+</span>${field(item ? plain(item) : "", "GEG.", "wide")}
          ${armor ? `<span class="cs-op">−</span>${field(penalty ? plain(-penalty) : "", "RÜST.", "wide")}` : ""}
        </div>
      </div>`;
  }

  function skills(model) {
    const entries = Object.entries(I18N.SKILLS).map(([key, s]) => {
      const node = model.skills[key] || { rank: 0, mod: null };
      return { sortName: s.name, html: skillRow(s.name, s.ability, node.rank, node.mod, model, ARMOR_SKILLS.has(key), false, node.armorPenalty) };
    });
    // „Kenntnis (Handel)“ → „Handel“ (das Wort „Kenntnis“ steht schon unter dem Feld)
    const lores = model.lores.slice(0, 2).map((l) => Object.assign({}, l, { name: String(l.name || "").replace(/^Kenntnis\s*\((.*)\)$/, "$1") }));
    while (lores.length < 2) lores.push({ name: "", rank: 0, mod: null });
    // Kenntnis-Zeilen stehen im Original zwischen Einschüchtern und Heilkunde.
    const loreHtml = lores.map((l) => skillRow(l.name, "int", l.rank, l.mod, model, false, true)).join("");
    const idx = Object.keys(I18N.SKILLS).indexOf("medicine");
    const rows = entries.slice(0, idx).map((e) => e.html).join("") + loreHtml + entries.slice(idx).map((e) => e.html).join("");
    return `<div class="cs-panel cs-skills"><div class="cs-bar">Fertigkeiten</div>${rows}</div>`;
  }

  function armorClass(model) {
    const level = model.meta.level;
    const a = model.ac || {};
    const dex = model.abilities.dex || 0;
    const dexPart = a.dexCap != null ? Math.min(dex, a.dexCap) : dex;
    const rank = a.rank;
    const prof = rank != null ? profBonus(level, rank) : null;
    // Gegenstandsanteil (Rüstung inkl. Runen und sonstige Boni) – bleibt auch beim Stufenaufstieg-Bogen stehen.
    const item = prof != null ? a.value - 10 - dexPart - prof : null;
    const dp = (model.proficiencies && model.proficiencies.defenses) || {};
    const sh = model.shield || {};
    const armorProf = [
      ["Ungerüstet", dp.unarmored],
      ["Leicht", dp.light],
      ["Mittel", dp.medium],
      ["Schwer", dp.heavy],
    ]
      .map(([n, r]) => `<span class="cs-ap"><em>${n}</em>${teml(R(r), "row")}</span>`)
      .join("");
    return `
    <div class="cs-panel cs-ac">
      <div class="cs-bar">Rüstungsklasse</div>
      <div class="cs-ac-grid">
        <div class="cs-ac-main">
          <div class="cs-ac-row">
            <strong class="cs-ac-label">RK</strong>${shaped("shield", L(a.value))}
            <span class="cs-eq">=</span>
            <div class="cs-ac-calc">
              <div>${field(item != null ? plain(item) : "", "GEGENST.")}<span class="cs-op">+</span>${field(prof != null ? L(plain(prof)) : "", "KOMP.")}</div>
              <div>${field(L(sign(dexPart)), "GE")}<span class="cs-op">+</span>${field("10", "BASIS", "fixed")}</div>
            </div>
            ${teml(R(rank), "col")}
          </div>
          <div class="cs-ac-row">
            <strong class="cs-ac-label">+Schild</strong>${shaped("shield", sh.bonus != null ? `+${sh.bonus}` : "")}
            <span class="cs-eq">=</span>
            <div class="cs-ac-calc">
              <div>${field(sh.hp != null ? sh.hp : "", "TP")}<span class="cs-op">•</span>${field(sh.hardness != null ? sh.hardness : "", "HÄRTE")}</div>
              <div>${field(sh.brokenThreshold != null ? sh.brokenThreshold : "", "BP")}<span class="cs-op">•</span>${field(sh.hpMax != null ? sh.hpMax : "", "MAX")}</div>
            </div>
          </div>
          ${a.armor || sh.name ? `<div class="cs-ac-items">${esc([a.armor, sh.name].filter(Boolean).join(" · "))}</div>` : ""}
        </div>
        <div class="cs-notes"><span>Notizen</span></div>
      </div>
      <div class="cs-ac-prof"><strong>Rüstungs&shy;kompetenzen</strong><div class="cs-ap-grid">${armorProf}</div></div>
    </div>`;
  }

  function saves(model) {
    const level = model.meta.level;
    const rows = Object.values(I18N.SAVES)
      .map((s) => {
        const node = model.saves[s.key];
        const attr = model.abilities[s.ability] || 0;
        const prof = profBonus(level, node.rank);
        const total = node.mod != null ? node.mod : attr + prof;
        const rest = total - attr - prof;
        return `
        <div class="cs-save">
          <strong>${esc(s.name)}</strong>
          ${shaped("box", L(sign(total)))}
          <span class="cs-eq">=</span>${field(L(sign(attr)), I18N.ABILITIES[s.ability].short)}<span class="cs-op">+</span>${field(L(plain(prof)), "KOMP.")}${
          rest ? `<span class="cs-op">+</span>${field(plain(rest), "GEG.")}` : ""
        }
          ${teml(R(node.rank), "grid")}
        </div>`;
      })
      .join("");
    return `
    <div class="cs-panel cs-saves">
      <div class="cs-bar">Rettungswürfe</div>
      <div class="cs-saves-grid"><div>${rows}</div><div class="cs-notes"><span>Notizen</span></div></div>
    </div>`;
  }

  const DMG_LETTER = { bludgeoning: "W", piercing: "S", slashing: "H" };

  function weaponBlock(w, ranged) {
    const has = !!w;
    let total = "";
    let attr = "";
    let prof = "";
    let item = "";
    let second = "";
    let third = "";
    let dmg = "";
    let dmgType = "";
    let rank = null;
    if (has) {
      dmgType = DMG_LETTER[w.damageTypeKey] || "";
      // Gegenstands-/sonstige Boni bleiben auch auf dem Stufenaufstieg-Bogen stehen.
      item = w.otherBonus ? plain(w.otherBonus) : "";
      if (blank.level) {
        const strPart = w.damageAttr === "str" ? " + ST" : w.damageAttr === "str/2" ? " + ½ST" : "";
        dmg = w.dice ? `${w.dice}${strPart}` : "";
      } else {
        total = sign(w.bonus);
        second = sign(w.map[1]);
        third = sign(w.map[2]);
        attr = sign(w.attrMod);
        prof = plain(w.profBonus);
        rank = w.rank;
        // Schadensart steht in den W/S/H-Kästchen – nur zusätzliche Arten (z. B. „+1 Feuer“) bleiben im Text.
        const typeWord = { W: "Wucht", S: "Stich", H: "Hieb" }[dmgType];
        dmg = typeWord ? w.damage.replace(new RegExp("\\s*" + typeWord + "\\b"), "") : w.damage;
      }
    }
    // Wurfwaffe mit gleichen Werten: ein Feld, Hinweis am Namen
    const name = has ? w.name : "";
    // Wurfwaffe mit gleichen Werten: Hinweis in der Beschriftung unter dem Namen
    const thrownNote = has && w.thrownRange != null ? ` · AUCH WURF${w.thrownRange ? ` ${w.thrownRange} FUSS` : ""}` : "";
    const attrLabel = has ? (w.attr === "dex" ? "GE" : "ST") : ranged ? "GE" : "ST";
    // Hinterhältiger Angriff: Zusatzwürfel orange hinter dem Schaden (Würfelzahl steigt mit der Stufe)
    const sneak = has && w.sneak ? (blank.level ? "+__W6" : `+${w.sneak}`) : "";
    const dmgField = sneak
      ? `<span class="cs-blank cs-dmg-sneak"><span class="v">${esc(dmg)} <b class="cs-sneak">${esc(sneak)}</b></span><span class="l">SCHADEN · HINTERHÄLTIG</span></span>`
      : field(dmg, "SCHADEN");
    const typeCells = ["W", "S", "H"].map((l) => `<span class="${dmgType === l ? "on" : ""}">${l}</span>`).join("");
    return `
    <div class="cs-wpn">
      <div class="cs-wpn-shape">${shaped(ranged ? "ranged" : "melee", total)}<span class="cs-wpn-tag">Angriff</span></div>
      <div class="cs-wpn-map">
        <span class="cs-map"><em>2. Angriff</em><b>${esc(second)}</b></span>
        <span class="cs-map"><em>3. Angriff</em><b>${esc(third)}</b></span>
        <span class="cs-map-note">*Mehrfach&shy;angriffsmalus</span>
      </div>
      <div class="cs-wpn-calc"><span class="cs-eq">=</span>${field(attr, attrLabel)}<span class="cs-op">+</span>${field(prof, "KOMP.")}<span class="cs-op">+</span>${field(item, "GEGENST.")}</div>
      <div class="cs-wpn-name">${field(name, (ranged ? "FERNKAMPFWAFFE" : "NAHKAMPFWAFFE") + thrownNote, has ? lengthClass(name, 30, 60) : "")}</div>
      <div class="cs-wpn-dmg">${dmgField}</div>
      <div class="cs-wpn-side">${teml(rank, "col")}<span class="cs-dtype">${typeCells}</span></div>
    </div>`;
  }

  /**
   * Verteilt die Angriffe auf die 6 Angriffsplätze von Seite 1.
   *  - Eine Wurf-Variante („Sternmesser (geworfen)“) mit gleichem Angriff und
   *    Schaden wie die Nahkampfwaffe wird nicht doppelt aufgeführt; die
   *    Nahkampfwaffe bekommt stattdessen den Hinweis „auch geworfen“.
   *  - Normal 3 Nah- und 3 Fernkampfplätze; gibt es von einer Art weniger,
   *    bekommt die andere die freien Plätze.
   *  - Reihenfolge: gehaltene Waffen zuerst, waffenlose Angriffe zuletzt.
   * Liefert die 6 Plätze (null = leerer Platz, mit Art) und "rest" (kein Platz).
   */
  function attackSlots(model) {
    const strikes = (model.strikes || []).map((s) => Object.assign({}, s));
    const merged = [];
    strikes.forEach((s) => {
      const m = /^(.*) \(geworfen\)$/.exec(s.name);
      const base = m && strikes.find((o) => !o.ranged && o.name === m[1]);
      if (base && base.bonus === s.bonus && base.damage === s.damage) {
        base.thrownRange = s.range || null;
      } else {
        merged.push(s);
      }
    });
    const order = (a) => (a.unarmed ? 2 : 0) + (a.equipped ? 0 : 1);
    const sorted = merged.sort((a, b) => order(a) - order(b));
    const meleeAll = sorted.filter((a) => !a.ranged);
    const rangedAll = sorted.filter((a) => a.ranged);
    const SLOTS = 6;
    let meleeN;
    let rangedN;
    if (meleeAll.length + rangedAll.length <= SLOTS) {
      meleeN = meleeAll.length;
      rangedN = rangedAll.length;
    } else {
      rangedN = rangedAll.length ? Math.min(rangedAll.length, Math.max(1, SLOTS - meleeAll.length)) : 0;
      meleeN = SLOTS - rangedN;
    }
    const melee = meleeAll.slice(0, meleeN);
    const ranged = rangedAll.slice(0, rangedN);
    // Leere Plätze: möglichst auf 3/3 auffüllen
    const free = SLOTS - melee.length - ranged.length;
    const emptyMelee = Math.min(Math.max(0, 3 - melee.length), free);
    const emptyRanged = free - emptyMelee;
    const slots = melee
      .map((w) => ({ w, ranged: false }))
      .concat(Array.from({ length: emptyMelee }, () => ({ w: null, ranged: false })))
      .concat(ranged.map((w) => ({ w, ranged: true })))
      .concat(Array.from({ length: emptyRanged }, () => ({ w: null, ranged: true })));
    return { slots, rest: meleeAll.slice(meleeN).concat(rangedAll.slice(rangedN)) };
  }

  function weapons(model) {
    // Waffen vor waffenlosen Angriffen, getragene vor verstauten; je 3 Plätze Nah-/Fernkampf
    const blocks = attackSlots(model).slots.map((sl) => weaponBlock(sl.w, sl.ranged)).join("");
    const wp = (model.proficiencies && model.proficiencies.attacks) || {};
    return `
    <div class="cs-panel cs-weapons">
      <div class="cs-bar">Waffen &amp; Angriffe</div>
      ${blocks}
    </div>
    <div class="cs-panel cs-wprof">
      <div class="cs-wprof-title">Waffenkompetenzen</div>
      <div class="cs-wprof-grid">
        <span><em>Einfach</em>${teml(R(wp.simple), "row")}</span>
        <span><em>Kriegswaffen</em>${teml(R(wp.martial), "row")}</span>
        <span><em>Fortgeschr.</em>${teml(R(wp.advanced), "row")}</span>
        <span><em>Waffenlos</em>${teml(R(wp.unarmed), "row")}</span>
        <span class="wide"><em>Andere</em><i class="cs-line"></i>${teml(null, "row")}</span>
      </div>
      <div class="cs-wprof-crit"><em>Kritische Spezialisierung</em><i class="cs-line"></i></div>
    </div>`;
  }

  /**
   * @param {object} model  Charaktermodell aus PF2_PARSER
   * @param {object} [opts] { mode: "spielbereit" | "aufstieg" }
   */
  function render(model, opts) {
    const mode = (opts && opts.mode) || "spielbereit";
    blank = { session: true, level: mode === "aufstieg" };
    return `
    <section class="sheet-page cs-front">
      ${header(model)}
      <div class="cs-body">
        ${sidebar()}
        <div class="cs-colA">
          <div class="cs-colA-top">${abilities(model)}${vitals(model)}</div>
          ${skills(model)}
        </div>
        <div class="cs-colB">
          ${armorClass(model)}
          ${saves(model)}
          ${weapons(model)}
        </div>
      </div>
    </section>`;
  }

  global.PF2_FRONT = { render, attackSlots, actionIcon, blankFor: (mode) => ({ session: true, level: mode === "aufstieg" }) };
})(window);
