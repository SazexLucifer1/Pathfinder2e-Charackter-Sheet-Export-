/*
 * Nachschlagen deutscher Namen/Kurzfassungen im erzeugten Wörterbuch
 * (src/data/dictionary-de.js). Funktioniert für englische Exporte
 * (Normalfall) und für Exporte, die in Foundry schon deutsch sind.
 */
(function (global) {
  "use strict";

  const DATA = global.PF2_DICT_DATA || { items: {}, ui: {} };
  const SUM = global.PF2_SUMMARIZE;

  // Muss identisch zu slug() in tools/build-dictionary.mjs sein.
  function slug(text) {
    return String(text || "")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, "-");
  }

  let reverse = null;
  function reverseIndex() {
    if (reverse) return reverse;
    reverse = {};
    for (const [key, rec] of Object.entries(DATA.items)) {
      if (rec.n) {
        const k = slug(rec.n);
        if (!reverse[k]) reverse[k] = key;
      }
    }
    return reverse;
  }

  function entry(key) {
    if (!key) return null;
    const pm = String(key).match(/^(eq|sp|cond):(.*)$/);
    if (pm) return DATA.items[`${pm[1]}:${slug(pm[2])}`] || null;
    const k = slug(key);
    if (DATA.items[k]) return DATA.items[k];
    const r = reverseIndex()[k];
    return r ? DATA.items[r] : null;
  }

  const PHYSICAL = ["weapon", "armor", "shield", "equipment", "consumable", "treasure", "backpack", "ammo", "book", "kit"];
  function prefixFor(item) {
    if (PHYSICAL.includes(item.type)) return "eq:";
    if (item.type === "spell") return "sp:";
    if (item.type === "condition") return "cond:";
    return "";
  }

  /** Eintrag mit typgebundenem Schlüssel zuerst ("eq:…"), sonst allgemein. */
  function typed(item, key) {
    if (!key) return null;
    const p = prefixFor(item);
    if (p) {
      const k = slug(key);
      if (DATA.items[p + k]) return DATA.items[p + k];
    }
    return entry(key);
  }

  /** Eintrag zu einem Foundry-Item (per slug, Name oder Name ohne Klammerzusatz). */
  function lookupItem(item) {
    const name = item.name || "";
    const sys = item.system || {};
    const base = name.replace(/\s*\([^)]*\)\s*$/, "");
    return typed(item, sys.slug) || typed(item, name) || (base !== name ? typed(item, base) : null);
  }

  const SKILL_DE = {
    acrobatics: "Akrobatik", arcana: "Arkane Künste", athletics: "Athletik", crafting: "Handwerkskunst",
    deception: "Täuschung", diplomacy: "Diplomatie", intimidation: "Einschüchtern", medicine: "Heilkunde",
    nature: "Naturkunde", occultism: "Okkultismus", performance: "Darbietung", religion: "Religionskunde",
    society: "Gesellschaftskunde", stealth: "Heimlichkeit", survival: "Überlebenskunst", thievery: "Diebeskunst",
  };

  /** Übersetzt einen beliebigen kurzen Begriff (Klammerzusatz, Auswahl …). */
  function term(text) {
    if (!text) return text;
    const k = slug(text);
    if (SKILL_DE[k]) return SKILL_DE[k];
    const ui = DATA.ui || {};
    for (const table of ["weaponGroups", "traits", "languages", "armorGroups"]) {
      if (ui[table] && ui[table][k]) return ui[table][k];
    }
    const e = entry(text);
    if (e && e.n) return e.n;
    // "Lore" → "Kenntnis"
    const lore = String(text).match(/^(.*)\s+Lore$/i);
    if (lore) return loreName(text);
    return text;
  }

  /** "Warfare Lore" → "Kenntnis (Kriegsführung)" */
  function loreName(text) {
    const lores = (DATA.ui && DATA.ui.lores) || {};
    const k = slug(text);
    if (lores[k]) return lores[k];
    const m = String(text).match(/^(.*?)\s+Lore$/i);
    return m ? `Kenntnis (${m[1]})` : text;
  }

  /** Deutscher Name eines Items; Klammerzusätze werden mitübersetzt. */
  function itemName(item) {
    const name = item.name || "";
    const sys = item.system || {};
    const paren = name.match(/\(([^)]*)\)\s*$/);
    // 1) Voller Name (oder slug) bekannt → deutscher Name passt bereits
    const full = typed(item, name) || (sys.slug && !paren ? typed(item, sys.slug) : null);
    if (full && full.n) return full.n;
    if (/\sLore$/i.test(name)) return loreName(name);
    // 2) Name ohne Klammerzusatz bekannt → Zusatz einzeln übersetzen
    const base = name.replace(/\s*\([^)]*\)\s*$/, "");
    const eb = typed(item, base) || (sys.slug ? typed(item, sys.slug) : null);
    if (eb && eb.n) {
      if (paren && !/\(/.test(eb.n)) return `${eb.n} (${paren[1].split(/,\s*/).map(term).join(", ")})`;
      return eb.n;
    }
    return name;
  }

  /** Kurzfassung {s, trigger, req, freq} oder null. */
  function itemSummary(item) {
    const e = lookupItem(item);
    if (e && (e.s || e.trigger || e.req || e.act || e.eff || e.sp)) return e;
    // Fallback: eigene Beschreibung kürzen, falls sie bereits deutsch ist
    const html = item.system && item.system.description && item.system.description.value;
    if (html && SUM && !SUM.looksEnglish(html)) {
      return prefixFor(item) === "eq:" ? SUM.summarizeItem(html, 260) : SUM.summarize(html, 220);
    }
    return null;
  }

  function trait(t) {
    if (!t) return "";
    const traits = (DATA.ui && DATA.ui.traits) || {};
    if (traits[t]) return traits[t];
    // Merkmale mit Wert: deadly-d10, thrown-20, volley-30, reload-1, versatile-p …
    const m = String(t).match(/^(.*?)-(d\d+|\d+(?:-ft)?|[a-z])$/);
    if (m && traits[m[1]]) {
      let v = m[2];
      if (/^d\d+$/.test(v)) v = "W" + v.slice(1);
      else if (/^\d+/.test(v) && /thrown|volley|range|reach|aura|emanation/.test(m[1])) v = parseInt(v, 10) + " Fuß";
      else if (/^[a-z]$/.test(v)) v = { p: "S", s: "H", b: "W" }[v] || v.toUpperCase();
      return `${traits[m[1]]} ${v}`;
    }
    return t;
  }

  const DAMAGE = {
    slashing: "Hieb", piercing: "Stich", bludgeoning: "Wucht", fire: "Feuer", cold: "Kälte",
    electricity: "Elektrizität", acid: "Säure", sonic: "Schall", poison: "Gift", mental: "Geist",
    force: "Kraft", vitality: "Vitalität", void: "Leere", spirit: "Spirituell", bleed: "Blutung",
    positive: "Positiv", negative: "Negativ", untyped: "", precision: "Präzision",
  };
  function damageType(t) {
    if (t in DAMAGE) return DAMAGE[t];
    return trait(t);
  }

  function language(l) {
    const langs = (DATA.ui && DATA.ui.languages) || {};
    return langs[l] || term(l);
  }

  function size(s) {
    const map = { tiny: "Winzig", sm: "Klein", small: "Klein", med: "Mittelgroß", medium: "Mittelgroß", lg: "Groß", large: "Groß", huge: "Riesig", grg: "Gigantisch", gargantuan: "Gigantisch" };
    return map[s] || s || "";
  }

  global.PF2_DICT = { slug, entry, lookupItem, itemName, itemSummary, term, trait, damageType, language, size, SKILL_DE };
})(typeof window !== "undefined" ? window : globalThis);
