/*
 * Baut aus dem normalisierten Charaktermodell (PF2_PARSER) die
 * mehrseitige, druckfertige HTML-Ansicht des Charakterbogens im
 * Stil der Pathfinder-2-Einsteigerbox.
 */
(function (global) {
  "use strict";

  const I18N = global.PF2_I18N;
  const EXP = global.PF2_EXPLANATIONS;

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtMod(n) {
    if (n == null || Number.isNaN(n)) return "–";
    return n >= 0 ? `+${n}` : `${n}`;
  }

  function calcSkillMod(level, ability, rank, abilities, explicitMod) {
    if (explicitMod != null) return explicitMod;
    const rankInfo = I18N.PROFICIENCY_RANKS[rank] || I18N.PROFICIENCY_RANKS[0];
    const abilityMod = abilities[ability] || 0;
    return rankInfo.bonus(level) + abilityMod;
  }

  function explainBox(key, extraClass) {
    const e = EXP[key];
    if (!e) return "";
    return `
      <div class="explain-box ${extraClass || ""}">
        <div class="explain-title">${esc(e.title)}</div>
        <div class="explain-text">${esc(e.text)}</div>
      </div>`;
  }

  function proficiencyDots(rank) {
    let dots = "";
    for (let i = 1; i <= 4; i++) {
      dots += `<span class="dot ${rank >= i ? "filled" : ""}"></span>`;
    }
    return `<span class="prof-dots" title="${esc(I18N.proficiencyName(rank))}">${dots}</span>`;
  }

  function abilityBlock(model) {
    return Object.values(I18N.ABILITIES)
      .map((a) => {
        const mod = model.abilities[a.key] || 0;
        return `
        <div class="ability-box">
          <div class="ability-name">${esc(a.name)}</div>
          <div class="ability-short">${esc(a.short)}</div>
          <div class="ability-mod">${fmtMod(mod)}</div>
        </div>`;
      })
      .join("");
  }

  function headerBlock(model) {
    const m = model.meta;
    return `
    <div class="sheet-header">
      <div class="title-block">
        <h1>Charakterbogen</h1>
        <div class="subtitle">Pathfinder 2. Edition — im Stil der Einsteigerbox</div>
      </div>
      <div class="field-grid">
        <label>Name<input type="text" value="${esc(m.name)}"></label>
        <label>Spieler:in<input type="text" value="${esc(m.player)}"></label>
        <label>Stufe<input type="number" min="1" max="20" value="${esc(m.level)}"></label>
        <label>Volk<input type="text" value="${esc(m.ancestry)}"></label>
        <label>Erbe<input type="text" value="${esc(m.heritage)}"></label>
        <label>Klasse<input type="text" value="${esc(m.className)}"></label>
        <label>Hintergrund<input type="text" value="${esc(m.background)}"></label>
        <label>Gesinnung<input type="text" value="${esc(m.alignment)}"></label>
        <label>Gottheit<input type="text" value="${esc(m.deity)}"></label>
        <label>Größe<input type="text" value="${esc(m.size)}"></label>
        <label>Alter<input type="text" value="${esc(m.age)}"></label>
        <label>Geschlecht<input type="text" value="${esc(m.gender)}"></label>
      </div>
      <div class="languages"><strong>Sprachen:</strong> ${esc((m.languages || []).join(", ")) || "—"}</div>
      <div class="level-track">
        <strong>Stufenverlauf:</strong>
        ${Array.from({ length: 20 }, (_, i) => i + 1)
          .map((lvl) => `<span class="level-pip ${lvl <= m.level ? "reached" : ""}">${lvl}</span>`)
          .join("")}
        <span class="hint">(Bogen unterstützt Einträge bis Stufe 20 — siehe Talente-Seite)</span>
      </div>
    </div>`;
  }

  function statBoxes(model) {
    const level = model.meta.level;
    return `
    <div class="stat-row">
      <div class="stat-box big">
        <div class="stat-label">RK</div>
        <div class="stat-value">${esc(model.ac)}</div>
        ${explainBox("ac")}
      </div>
      <div class="stat-box big">
        <div class="stat-label">Trefferpunkte</div>
        <div class="hp-fields">
          <input type="number" class="hp-current" value="${esc(model.hp.value)}"> /
          <span class="hp-max">${esc(model.hp.max)}</span>
        </div>
        <div class="hp-temp-row">Temp. TP: <input type="number" class="hp-temp" value="${esc(model.hp.temp || 0)}"></div>
        ${explainBox("hp")}
      </div>
      <div class="stat-box big">
        <div class="stat-label">Geschwindigkeit</div>
        <div class="stat-value">${esc(model.speed.value)} Fuß</div>
        ${
          model.speed.others.length
            ? `<div class="speed-others">${model.speed.others.map((s) => `${esc(s.type)}: ${esc(s.value)} Fuß`).join(", ")}</div>`
            : ""
        }
      </div>
      <div class="stat-box big">
        <div class="stat-label">Heldenpunkte</div>
        <div class="stat-value">${Array.from({ length: Math.max(model.meta.heroPointsMax, 3) }, (_, i) =>
          `<span class="hero-pip ${i < model.meta.heroPoints ? "filled" : ""}"></span>`
        ).join("")}</div>
        ${explainBox("heroPoints")}
      </div>
    </div>
    <div class="stat-row">
      ${Object.values(I18N.SAVES)
        .map((s) => {
          const node = model.saves[s.key];
          const mod = calcSkillMod(level, s.ability, node.rank, model.abilities, node.mod);
          return `
        <div class="stat-box">
          <div class="stat-label">${esc(s.name)}</div>
          <div class="stat-value">${fmtMod(mod)}</div>
          ${proficiencyDots(node.rank)} <span class="rank-name">${esc(I18N.proficiencyName(node.rank))}</span>
        </div>`;
        })
        .join("")}
      <div class="stat-box">
        <div class="stat-label">${esc(I18N.PERCEPTION.name)}</div>
        <div class="stat-value">${fmtMod(calcSkillMod(level, I18N.PERCEPTION.ability, model.perception.rank, model.abilities, model.perception.mod))}</div>
        ${proficiencyDots(model.perception.rank)} <span class="rank-name">${esc(I18N.proficiencyName(model.perception.rank))}</span>
      </div>
      <div class="stat-box">
        <div class="stat-label">Klassen-SG</div>
        <div class="stat-value">${model.classDC.mod != null ? fmtMod(model.classDC.mod) : "–"}</div>
        ${proficiencyDots(model.classDC.rank)} <span class="rank-name">${esc(I18N.proficiencyName(model.classDC.rank))}</span>
      </div>
    </div>
    ${explainBox("saves")}${explainBox("perception")}${explainBox("classDC")}`;
  }

  function skillsTable(model) {
    const level = model.meta.level;
    const rows = Object.entries(I18N.SKILLS)
      .map(([key, s]) => {
        const node = model.skills[key] || { rank: 0, mod: null };
        const mod = calcSkillMod(level, s.ability, node.rank, model.abilities, node.mod);
        return `
        <tr>
          <td class="skill-name">${esc(s.name)} <span class="skill-ability">(${esc(I18N.ABILITIES[s.ability].short)})</span></td>
          <td class="skill-mod">${fmtMod(mod)}</td>
          <td>${proficiencyDots(node.rank)}</td>
          <td class="rank-name">${esc(I18N.proficiencyName(node.rank))}</td>
        </tr>`;
      })
      .join("");

    const loreRows = (model.lores.length ? model.lores : [{ name: "", rank: 0, mod: null }, { name: "", rank: 0, mod: null }])
      .map((l) => {
        const mod = l.mod != null ? l.mod : I18N.PROFICIENCY_RANKS[l.rank].bonus(level) + (model.abilities.int || 0);
        return `
        <tr>
          <td class="skill-name">Kenntnis: <input type="text" value="${esc(l.name)}" class="lore-input"> <span class="skill-ability">(IN)</span></td>
          <td class="skill-mod">${l.name ? fmtMod(mod) : ""}</td>
          <td>${proficiencyDots(l.rank)}</td>
          <td class="rank-name">${l.name ? esc(I18N.proficiencyName(l.rank)) : ""}</td>
        </tr>`;
      })
      .join("");

    return `
    <table class="skills-table">
      <thead><tr><th>Fertigkeit (Attribut)</th><th>Bonus</th><th>Kompetenz</th><th></th></tr></thead>
      <tbody>${rows}${loreRows}</tbody>
    </table>
    ${explainBox("skills")}`;
  }

  function attacksTable(model) {
    if (!model.attacks.length) {
      return `<p class="empty-hint">Keine Waffen im Export gefunden – hier von Hand eintragen.</p>
      <table class="attacks-table"><thead><tr><th>Waffe</th><th>Bonus</th><th>Schaden</th><th>Merkmale</th></tr></thead>
      <tbody>${Array.from({ length: 4 }, () => `<tr><td><input type="text"></td><td><input type="text"></td><td><input type="text"></td><td><input type="text"></td></tr>`).join("")}</tbody></table>`;
    }
    return `
    <table class="attacks-table">
      <thead><tr><th>Waffe</th><th>Bonus</th><th>Schaden</th><th>Merkmale</th></tr></thead>
      <tbody>
        ${model.attacks
          .map(
            (a) => `<tr>
          <td>${esc(a.name)}</td>
          <td>${a.bonus != null ? fmtMod(a.bonus) : "–"}</td>
          <td>${esc(a.damage)}</td>
          <td>${esc(a.traits.join(", "))}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
  }

  function conditionsPage(model) {
    const activeMap = new Map((model.conditions || []).map((c) => [c.name, c.value]));
    const cards = I18N.CONDITIONS.map((c) => {
      const isActive = activeMap.has(c.name);
      const activeValue = activeMap.get(c.name);
      return `
      <div class="condition-card">
        <label class="condition-check">
          <input type="checkbox" ${isActive ? "checked" : ""}>
          <span class="cond-name">${esc(c.name)}</span>
          ${c.value ? `<span class="cond-value">Wert: <input type="text" class="cond-value-input" maxlength="2" value="${activeValue != null ? esc(activeValue) : ""}"></span>` : ""}
        </label>
        <div class="cond-text">${esc(c.text)}</div>
      </div>`;
    }).join("");

    return `
    <section class="sheet-page">
      <h2>Zustände</h2>
      ${explainBox("conditions", "wide")}
      <div class="condition-grid">${cards}</div>
    </section>`;
  }

  function featsPage(model) {
    const maxLevel = Math.max(model.meta.level, 1);
    const rows = model.feats
      .map(
        (f) => `
      <tr>
        <td class="feat-level">${f.level || "–"}</td>
        <td class="feat-source">${esc(I18N.featCategoryName(f.category))}</td>
        <td class="feat-name">${esc(f.name)}</td>
        <td class="feat-action">${esc(I18N.actionSymbol(f.actionType, f.actionCount))}</td>
        <td class="feat-desc">${esc(f.description) || "<em>Keine Beschreibung im Export vorhanden.</em>"}</td>
      </tr>`
      )
      .join("");

    const blankRowsCount = Math.max(6, 20 - model.feats.length);
    const blankRows = Array.from({ length: blankRowsCount }, () => `
      <tr class="blank-row">
        <td><input type="text" class="lvl-input"></td>
        <td><input type="text"></td>
        <td><input type="text"></td>
        <td><input type="text" class="tiny"></td>
        <td><input type="text"></td>
      </tr>`).join("");

    return `
    <section class="sheet-page">
      <h2>Talente &amp; Fähigkeiten</h2>
      ${explainBox("feats", "wide")}
      <table class="feats-table">
        <thead>
          <tr><th>Stufe</th><th>Quelle</th><th>Name</th><th>Aktion</th><th>Beschreibung</th></tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="5" class="empty-hint">Keine Talente/Merkmale im Export gefunden.</td></tr>`}
          ${blankRows}
        </tbody>
      </table>
      <p class="hint">Leere Zeilen sind für neue Talente bis Stufe 20 vorgesehen — beim nächsten Stufenaufstieg einfach von Hand ergänzen (Stufe, Quelle, Name, Aktionssymbol, kurze Beschreibung).</p>
    </section>`;
  }

  function spellsPage(model) {
    const sc = model.spellcasting;
    if (!sc.entries.length && !sc.spells.length) return "";
    const rows = sc.spells
      .map(
        (s) => `<tr>
        <td>${s.level === 0 ? "Trick" : s.level}</td>
        <td>${esc(s.name)}</td>
        <td>${esc(s.traditions.join(", "))}</td>
        <td>${esc(s.description).slice(0, 200)}${s.description.length > 200 ? "…" : ""}</td>
      </tr>`
      )
      .join("");
    return `
    <section class="sheet-page">
      <h2>Zauber</h2>
      <div class="spell-entries">
        ${sc.entries
          .map(
            (e) => `<div class="spell-entry-box">
          <strong>${esc(e.name)}</strong> (${esc(e.tradition)}) —
          Zauber-SG: ${e.dc != null ? esc(e.dc) : "–"},
          Angriffsbonus: ${e.attack != null ? fmtMod(e.attack) : "–"}
          ${e.focusPoints != null ? `, Fokuspunkte: ${esc(e.focusPoints)}` : ""}
        </div>`
          )
          .join("")}
      </div>
      <table class="spells-table">
        <thead><tr><th>Grad</th><th>Name</th><th>Tradition</th><th>Beschreibung</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }

  function inventoryPage(model) {
    const rows = model.inventory
      .map(
        (it) => `<tr>
        <td>${esc(it.name)}</td>
        <td>${esc(it.quantity)}</td>
        <td>${esc(it.bulk === "" || it.bulk == null ? "—" : it.bulk)}</td>
        <td>${it.equipped ? "Ja" : "Nein"}</td>
      </tr>`
      )
      .join("");
    const cur = model.currency;
    return `
    <section class="sheet-page">
      <h2>Ausrüstung &amp; Inventar</h2>
      ${explainBox("bulk")}
      <table class="inventory-table">
        <thead><tr><th>Gegenstand</th><th>Anzahl</th><th>Traglast</th><th>Angelegt</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="empty-hint">Keine Gegenstände im Export gefunden.</td></tr>`}</tbody>
      </table>
      <div class="currency-row">
        <strong>Vermögen:</strong>
        Platin: <input type="text" value="${esc(cur.pp)}" class="tiny">
        Gold: <input type="text" value="${esc(cur.gp)}" class="tiny">
        Silber: <input type="text" value="${esc(cur.sp)}" class="tiny">
        Kupfer: <input type="text" value="${esc(cur.cp)}" class="tiny">
      </div>
    </section>`;
  }

  function warningsBlock(model) {
    if (!model.warnings || !model.warnings.length) return "";
    return `
    <div class="warnings-box">
      <strong>Hinweise zum Import:</strong>
      <ul>${model.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
    </div>`;
  }

  function render(model) {
    const page1 = `
    <section class="sheet-page">
      ${headerBlock(model)}
      ${warningsBlock(model)}
      <div class="two-col">
        <div class="col-main">
          <div class="abilities-row">${abilityBlock(model)}</div>
          ${explainBox("abilityScores")}
          ${statBoxes(model)}
        </div>
        <div class="col-side">
          ${explainBox("proficiency")}
        </div>
      </div>
    </section>`;

    const page2 = `
    <section class="sheet-page">
      <h2>Fertigkeiten</h2>
      ${skillsTable(model)}
      <h2>Kampf</h2>
      ${explainBox("actions")}
      ${attacksTable(model)}
    </section>`;

    const page3 = conditionsPage(model);
    const page4 = featsPage(model);
    const page5 = spellsPage(model);
    const page6 = inventoryPage(model);

    return `<div class="pf2-sheet">${page1}${page2}${page3}${page4}${page5}${page6}</div>`;
  }

  global.PF2_RENDER = { render };
})(window);
