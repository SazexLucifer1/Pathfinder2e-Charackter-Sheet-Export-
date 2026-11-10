/*
 * Baut aus dem normalisierten Charaktermodell (PF2_PARSER) die
 * mehrseitige, druckfertige HTML-Ansicht des Charakterbogens.
 *
 * Seite 1 (klassischer Bogen) kommt aus src/front.js, die Folgeseiten
 * (Zustände, Talente, Zauber, Ausrüstung) verwenden dasselbe Design.
 */
(function (global) {
  "use strict";

  const I18N = global.PF2_I18N;
  const FRONT = global.PF2_FRONT;

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

  function shorten(text, max) {
    if (!text) return "";
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)) + " …";
  }

  /** Seitenkopf wie auf Seite 1: Marke links, Seitentitel rechts, Name darunter. */
  // Bogen-Art: siehe PF2_FRONT.blankFor – wird in render() gesetzt.
  let blank = { session: true, level: false };

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

  const FEAT_COLS = `<colgroup><col style="width:9mm"><col style="width:27mm"><col style="width:38mm"><col style="width:11mm"><col></colgroup>`;
  const SPELL_COLS = `<colgroup><col style="width:12mm"><col style="width:42mm"><col style="width:22mm"><col></colgroup>`;
  const ITEM_COLS = `<colgroup><col style="width:16mm"><col style="width:16mm"><col style="width:18mm"><col></colgroup>`;

  function page(title, model, body, extraCls) {
    return `<section class="sheet-page cs-page ${extraCls || ""}">${pageHead(title, model)}${body}</section>`;
  }

  /* ------------------------------------------------------------ Zustände */

  function conditionsPage(model) {
    const active = new Map((model.conditions || []).map((c) => [c.name, c.value]));
    const rows = I18N.CONDITIONS.map((c) => {
      const on = !blank.session && active.has(c.name);
      const val = active.get(c.name);
      return `
      <div class="cs-cond ${on ? "on" : ""}">
        <span class="cs-check ${on ? "on" : ""}"></span>
        <div class="cs-cond-body">
          <div class="cs-cond-head"><strong>${esc(c.name)}</strong>${
            c.value ? `<span class="cs-cond-val">${on && val != null ? esc(val) : ""}</span>` : ""
          }</div>
          <div class="cs-cond-text">${esc(c.text)}</div>
        </div>
      </div>`;
    }).join("");
    return page(
      "Zustände",
      model,
      `<div class="cs-panel cs-fill"><div class="cs-bar">Zustände <small>– ankreuzen, Wert ins Kästchen</small></div>
        <div class="cs-cond-grid">${rows}</div></div>`
    );
  }

  /* ------------------------------------------------------------- Talente */

  function featsPage(model) {
    const rows = model.feats
      .map(
        (f) => `
      <tr>
        <td class="c">${f.level || "–"}</td>
        <td>${esc(I18N.featCategoryName(f.category))}</td>
        <td class="b">${esc(f.name)}</td>
        <td class="c act">${esc(I18N.actionSymbol(f.actionType, f.actionCount))}</td>
        <td class="desc">${esc(shorten(f.description, 230))}</td>
      </tr>`
      )
      .join("");
    return page(
      "Talente & Fähigkeiten",
      model,
      `<div class="cs-panel cs-fill">
        <div class="cs-bar">Talente &amp; Klassenmerkmale</div>
        <table class="cs-table">
          ${FEAT_COLS}
          <thead><tr><th>Stufe</th><th>Art</th><th>Name</th><th>Aktion</th><th>Kurzbeschreibung</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="desc">Keine Talente im Export gefunden.</td></tr>`}</tbody>
        </table>
        ${lines(FEAT_COLS, 5)}
      </div>`
    );
  }

  /* -------------------------------------------------------------- Zauber */

  const TRADITIONS = { arcane: "Arkan", divine: "Göttlich", occult: "Okkult", primal: "Primal" };
  const trad = (t) => TRADITIONS[t] || t || "";

  function spellsPage(model) {
    const sc = model.spellcasting;
    if (!sc.entries.length && !sc.spells.length) return "";
    const entry = sc.entries[0] || {};
    const focus = entry.focusPoints != null ? Number(entry.focusPoints) : null;
    const focusPips = Array.from({ length: 3 }, (_, i) => `<span class="cs-pip ${!blank.session && focus != null && i < focus ? "on" : ""}"></span>`).join("");
    const stats = `
      <div class="cs-stat-row">
        <div class="cs-stat"><span class="cs-stat-box wide">${esc(sc.entries.map((e) => trad(e.tradition)).filter(Boolean).join(", "))}</span><em>Tradition</em></div>
        <div class="cs-stat"><span class="cs-stat-box">${esc(entry.dc != null && !blank.level ? entry.dc : "")}</span><em>Zauber-SG</em></div>
        <div class="cs-stat"><span class="cs-stat-box">${esc(entry.attack != null && !blank.level ? sign(entry.attack) : "")}</span><em>Zauberangriff</em></div>
        <div class="cs-stat"><span class="cs-stat-pips">${focusPips}</span><em>Fokuspunkte</em></div>
      </div>`;
    const slotCols = ["Trick", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const slots = `
      <table class="cs-slots">
        <tr><th>Rang</th>${slotCols.map((r) => `<th>${r}</th>`).join("")}</tr>
        <tr><th>Plätze</th>${slotCols.map(() => "<td></td>").join("")}</tr>
        <tr><th>Verbraucht</th>${slotCols.map(() => "<td></td>").join("")}</tr>
      </table>`;
    const rows = sc.spells
      .map(
        (s) => `<tr>
        <td class="c">${s.level === 0 ? "Trick" : s.level}</td>
        <td class="b">${esc(s.name)}</td>
        <td>${esc(s.traditions.map(trad).join(", "))}</td>
        <td class="desc">${esc(shorten(s.description, 200))}</td>
      </tr>`
      )
      .join("");
    return page(
      "Zauber",
      model,
      `<div class="cs-panel"><div class="cs-bar">Zauberwirken</div>${stats}${slots}</div>
      <div class="cs-panel cs-fill">
        <div class="cs-bar">Zauber</div>
        <table class="cs-table">
          ${SPELL_COLS}
          <thead><tr><th>Rang</th><th>Name</th><th>Tradition</th><th>Kurzbeschreibung</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${lines(SPELL_COLS, 4)}
      </div>`
    );
  }

  /* ---------------------------------------------------------- Ausrüstung */

  function bulkText(b) {
    if (b === "" || b == null) return "–";
    const n = Number(b);
    if (Number.isNaN(n)) return String(b);
    if (n === 0) return "–";
    if (n < 1) return "L";
    return String(n);
  }

  function inventoryPage(model) {
    const items = model.inventory;
    let bulk = 0;
    items.forEach((it) => {
      const n = Number(it.bulk);
      // Leichte Gegenstände (L) zählen je 0,1; 10 davon ergeben 1 Traglast.
      if (!Number.isNaN(n) && n > 0) bulk += (n < 1 ? 0.1 : n) * (Number(it.quantity) || 1);
    });
    bulk = Math.floor(bulk);
    const str = model.abilities.str || 0;
    const rows = items
      .map(
        (it) => `<tr>
        <td class="c">${esc(it.quantity)}</td>
        <td class="c">${esc(bulkText(it.bulk))}</td>
        <td class="c">${it.equipped ? "✔" : ""}</td>
        <td class="b">${esc(it.name)}</td>
      </tr>`
      )
      .join("");
    const cur = model.currency;
    const coin = (v, l) => `<div class="cs-stat"><span class="cs-stat-box">${esc(v || "")}</span><em>${l}</em></div>`;
    return page(
      "Ausrüstung",
      model,
      `<div class="cs-inv-top">
        <div class="cs-panel"><div class="cs-bar">Vermögen</div>
          <div class="cs-stat-row">${coin(cur.pp, "Platin (PM)")}${coin(cur.gp, "Gold (GM)")}${coin(cur.sp, "Silber (SM)")}${coin(cur.cp, "Kupfer (KM)")}</div>
        </div>
        <div class="cs-panel"><div class="cs-bar">Traglast</div>
          <div class="cs-stat-row">
            <div class="cs-stat"><span class="cs-stat-box">${esc(bulk)}</span><em>Getragen</em></div>
            <div class="cs-stat"><span class="cs-stat-box">${esc(blank.level ? "" : 5 + str)}</span><em>Belastet ab</em></div>
            <div class="cs-stat"><span class="cs-stat-box">${esc(blank.level ? "" : 10 + str)}</span><em>Maximum</em></div>
          </div>
        </div>
      </div>
      <div class="cs-panel cs-fill">
        <div class="cs-bar">Gegenstände</div>
        <table class="cs-table">
          ${ITEM_COLS}
          <thead><tr><th class="c">Anzahl</th><th class="c">Traglast</th><th class="c">Angelegt</th><th>Gegenstand</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${lines(ITEM_COLS, 4)}
      </div>
      <div class="cs-panel cs-notes-panel"><div class="cs-bar">Notizen</div>${lines("<colgroup><col></colgroup>", 1)}</div>`
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
   *   spielbereit – alles ausgefüllt außer Werten, die sich in der Spielrunde ändern
   *   aufstieg    – zusätzlich alles leer, was sich beim Stufenaufstieg ändert
   */
  function render(model, opts) {
    const mode = (opts && opts.mode) || "spielbereit";
    blank = FRONT.blankFor(mode);
    return `<div class="pf2-sheet">${warningsBlock(model)}${FRONT.render(model, { mode })}${conditionsPage(model)}${featsPage(model)}${spellsPage(
      model
    )}${inventoryPage(model)}</div>`;
  }

  global.PF2_RENDER = { render };
})(window);
