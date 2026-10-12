/*
 * Parser: wandelt einen Foundry-VTT-"pf2e"-Charakterexport ("Export Data",
 * type "character") in ein fertig berechnetes, deutsches Charaktermodell um.
 *
 * Wichtig: Foundry exportiert nur die *Quelldaten* – Attributsmodifikatoren,
 * RK, TP-Maximum, Rettungswürfe, Fertigkeitsboni usw. stehen NICHT in der
 * Datei, sondern werden von Foundry erst beim Laden berechnet. Dieser Parser
 * bildet die wichtigsten Teile dieser Berechnung nach (Attributsteigerungen,
 * Kompetenzgrade aus Klasse/Hintergrund/Talenten, Regelelemente wie
 * "ActiveEffectLike", "FlatModifier", "MartialProficiency", Runen …).
 * Situationsabhängige Boni (z. B. "+2 gegen Furcht") werden bewusst NICHT
 * eingerechnet – sie stehen als Text bei der jeweiligen Fähigkeit.
 */
(function (global) {
  "use strict";

  const D = global.PF2_DICT;
  const I18N = global.PF2_I18N;

  const ATTRS = ["str", "dex", "con", "int", "wis", "cha"];
  const SKILLS = Object.keys(I18N.SKILLS);
  const SAVES = ["fortitude", "reflex", "will"];
  const SAVE_ATTR = { fortitude: "con", reflex: "dex", will: "wis" };
  const PHYSICAL = ["weapon", "armor", "shield", "equipment", "consumable", "treasure", "backpack", "ammo", "book", "kit"];

  /* ---------------- kleine Helfer ---------------- */

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback === undefined ? 0 : fallback;
  }

  function get(obj, path, fallback) {
    let cur = obj;
    for (const p of String(path).split(".")) {
      if (cur == null) return fallback;
      cur = cur[p];
    }
    return cur == null ? fallback : cur;
  }

  function setPath(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function traitsOf(item) {
    const t = get(item, "system.traits.value", []);
    return Array.isArray(t) ? t : [];
  }

  function profBonus(rank, level) {
    return rank > 0 ? level + 2 * rank : 0;
  }

  /* ---------------- Formeln & Prädikate ---------------- */

  /** Wertet einfache Foundry-Formeln aus: Zahlen, @actor.level, ternary(gte(…),a,b), min/max/floor/ceil … */
  function evalFormula(value, ctx) {
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value && typeof value === "object") {
      // Bracketed values: { brackets: [{start, end, value}], field? }
      if (Array.isArray(value.brackets)) {
        const field = value.field || "actor|level";
        const x = /level/.test(field) ? ctx.level : ctx.level;
        const b = value.brackets.find((br) => (br.start == null || x >= br.start) && (br.end == null || x <= br.end));
        return b ? evalFormula(b.value, ctx) : null;
      }
      return null;
    }
    if (typeof value !== "string") return null;
    let expr = value.trim();
    if (expr === "") return null;
    expr = expr
      .replace(/@actor\.level|@actor\.system\.details\.level\.value/g, String(ctx.level))
      .replace(/@item\.level|@item\.system\.level\.value/g, String(ctx.itemLevel != null ? ctx.itemLevel : ctx.level))
      .replace(/@actor\.(?:abilities|system\.abilities)\.(\w+)\.mod/g, (_, a) => String(ctx.attrs ? Math.trunc(ctx.attrs[a] || 0) : 0))
      .replace(/@item\.(?:system\.)?badge\.value/g, "1")
      .replace(/@\w+(?:\.\w+)*/g, "NaN");
    if (!/^[\d\s+\-*/().,a-z]*$/i.test(expr)) return null;
    const fns = {
      ternary: (c, a, b) => (c ? a : b),
      gte: (a, b) => a >= b,
      gt: (a, b) => a > b,
      lte: (a, b) => a <= b,
      lt: (a, b) => a < b,
      eq: (a, b) => a === b,
      min: Math.min,
      max: Math.max,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      abs: Math.abs,
    };
    const words = expr.match(/[a-z]+/gi) || [];
    if (words.some((w) => !(w in fns) && w !== "NaN")) return null;
    try {
      // eslint-disable-next-line no-new-func
      const f = new Function(...Object.keys(fns), `"use strict"; return (${expr});`);
      const r = f(...Object.values(fns));
      const n = typeof r === "boolean" ? (r ? 1 : 0) : Number(r);
      return Number.isFinite(n) ? n : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Prädikate (Bedingungen) auswerten. Unbekannte Bedingungen gelten als
   * NICHT erfüllt – dadurch werden situative Boni nicht fest eingerechnet.
   */
  function testPredicate(pred, options) {
    if (pred == null) return true;
    if (!Array.isArray(pred)) pred = [pred];
    return pred.every((p) => testAtom(p, options));
  }

  function numericOption(options, key) {
    if (typeof key === "number") return key;
    const n = Number(key);
    if (Number.isFinite(n)) return n;
    const prefix = key + ":";
    for (const o of options) {
      if (o.startsWith(prefix)) {
        const v = Number(o.slice(prefix.length));
        if (Number.isFinite(v)) return v;
      }
    }
    return null;
  }

  function testAtom(p, options) {
    if (typeof p === "string") {
      if (p.startsWith("not:")) return !options.has(p.slice(4));
      return options.has(p);
    }
    if (!p || typeof p !== "object") return false;
    if (p.and) return p.and.every((q) => testAtom(q, options));
    if (p.or) return p.or.some((q) => testAtom(q, options));
    if (p.nor) return !p.nor.some((q) => testAtom(q, options));
    if (p.nand) return !p.nand.every((q) => testAtom(q, options));
    if (p.not) return !testAtom(p.not, options);
    for (const op of ["gte", "gt", "lte", "lt", "eq"]) {
      if (Array.isArray(p[op])) {
        const a = numericOption(options, p[op][0]);
        const b = numericOption(options, p[op][1]);
        if (a == null || b == null) return false;
        return { gte: a >= b, gt: a > b, lte: a <= b, lt: a < b, eq: a === b }[op];
      }
    }
    return false;
  }

  /** Platzhalter wie {item|flags.system.rulesSelections.skill} auflösen. */
  function resolvePlaceholders(str, item) {
    if (typeof str !== "string") return str;
    return str.replace(/\{(item|actor)\|([^}]+)\}/g, (m, scope, path) => {
      if (scope !== "item") return m;
      if (path === "_id" || path === "id") return item._id || "";
      if (path === "name") return item.name || "";
      let v = get(item, path, null);
      if (v == null && path.startsWith("flags.system.rulesSelections.")) {
        const flag = path.slice("flags.system.rulesSelections.".length);
        v = get(item, `flags.pf2e.rulesSelections.${flag}`, null);
        if (v == null) {
          const cs = (get(item, "system.rules", []) || []).find((r) => r.key === "ChoiceSet" && r.flag === flag);
          if (cs && cs.selection != null) v = cs.selection;
        }
      }
      return v == null ? m : typeof v === "object" ? JSON.stringify(v) : String(v);
    });
  }

  function resolveDeep(value, item) {
    if (typeof value === "string") return resolvePlaceholders(value, item);
    if (Array.isArray(value)) return value.map((v) => resolveDeep(v, item));
    if (value && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = resolveDeep(v, item);
      return out;
    }
    return value;
  }

  /* ---------------- Modifikator-Sammlung (Bonus-Stapelregeln) ---------------- */

  function stackModifiers(mods) {
    // Pro Typ zählt nur der höchste Bonus und der schlechteste Malus; "untyped" addiert sich.
    let total = 0;
    const bonus = {};
    const penalty = {};
    for (const m of mods) {
      const type = m.type || "untyped";
      if (type === "untyped") {
        total += m.value;
        continue;
      }
      if (m.value >= 0) bonus[type] = Math.max(bonus[type] ?? 0, m.value);
      else penalty[type] = Math.min(penalty[type] ?? 0, m.value);
    }
    for (const v of Object.values(bonus)) total += v;
    for (const v of Object.values(penalty)) total += v;
    return total;
  }

  /* ---------------- Hauptfunktion ---------------- */

  function parseFoundryActor(raw) {
    const warnings = [];
    if (!raw || typeof raw !== "object") throw new Error("Die Datei enthält kein gültiges JSON-Objekt.");
    if (raw.type && raw.type !== "character") {
      warnings.push(`Achtung: Der Actor-Typ ist „${raw.type}“, erwartet wurde „character“ (Spielercharakter). Es wird trotzdem versucht, die Daten zu lesen.`);
    }
    if (!raw.system && raw.data) raw = Object.assign({}, raw, { system: raw.data }); // sehr alte Exporte

    const system = raw.system || {};
    const items = Array.isArray(raw.items) ? raw.items : [];
    const byType = (t) => items.filter((it) => it.type === t);
    const first = (t) => byType(t)[0] || null;

    const ancestry = first("ancestry");
    const heritage = first("heritage");
    const background = first("background");
    const cls = first("class");
    const deity = first("deity");

    if (!cls) warnings.push("Keine Klasse im Export gefunden – Kompetenzen konnten nur teilweise berechnet werden.");
    if (!ancestry) warnings.push("Kein Volk im Export gefunden.");

    const level = Math.max(1, Math.min(20, num(get(system, "details.level.value", 1), 1)));

    /* ---- Attribute ---- */
    const attrs = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const manual = system.abilities && typeof system.abilities === "object" && Object.keys(system.abilities).length > 0;
    if (manual) {
      for (const a of ATTRS) {
        const node = system.abilities[a] || {};
        attrs[a] = num(node.mod != null ? node.mod : node.value, 0);
      }
    } else {
      const boost = (a) => {
        if (!(a in attrs)) return;
        attrs[a] += attrs[a] >= 4 ? 0.5 : 1;
      };
      const selectedOf = (slots) =>
        Object.values(slots || {})
          .map((s) => s && (s.selected || (Array.isArray(s.value) && s.value.length === 1 ? s.value[0] : null)))
          .filter(Boolean);

      // Volk
      const ancBoosts = [];
      const ancFlaws = [];
      if (ancestry) {
        const alt = get(ancestry, "system.alternateAncestryBoosts", null);
        if (Array.isArray(alt) && alt.length) ancBoosts.push(...alt);
        else {
          ancBoosts.push(...selectedOf(get(ancestry, "system.boosts", {})));
          ancFlaws.push(...selectedOf(get(ancestry, "system.flaws", {})));
        }
        const vol = get(ancestry, "system.voluntary", null);
        if (vol) {
          if (vol.legacy && vol.boost) ancBoosts.push(vol.boost);
          if (Array.isArray(vol.flaws)) ancFlaws.push(...vol.flaws);
        }
      }
      ancBoosts.forEach(boost);
      ancFlaws.forEach((a) => {
        if (a in attrs) attrs[a] -= 1;
      });
      // Hintergrund
      if (background) selectedOf(get(background, "system.boosts", {})).forEach(boost);
      // Klasse (Schlüsselattribut)
      if (cls) {
        const key = get(cls, "system.keyAbility.selected", null) || (get(cls, "system.keyAbility.value", []).length === 1 ? cls.system.keyAbility.value[0] : null);
        if (key) boost(key);
      }
      // Stufenaufstiege 1/5/10/15/20
      const lvlBoosts = get(system, "build.attributes.boosts", {}) || {};
      for (const l of [1, 5, 10, 15, 20]) {
        if (l > level) continue;
        const b = lvlBoosts[l];
        (Array.isArray(b) ? b.slice(0, 4) : []).forEach(boost);
      }
      const apex = get(system, "build.attributes.apex", null);
      if (apex && apex in attrs) attrs[apex] = Math.max(attrs[apex] + 1, 4);
    }

    /* ---- Basiswerte aus Klasse/Volk/Hintergrund ---- */
    const r = {
      skills: {},
      saves: { fortitude: 0, reflex: 0, will: 0 },
      perception: 0,
      attacks: { simple: 0, martial: 0, advanced: 0, unarmed: 0 },
      defenses: { unarmored: 0, light: 0, medium: 0, heavy: 0 },
      spellcasting: 0,
      classDC: cls ? 1 : 0,
    };
    for (const s of SKILLS) r.skills[s] = Math.max(0, Math.min(4, num(get(system, `skills.${s}.rank`, 0), 0)));
    const srcAttacks = get(system, "proficiencies.attacks", {}) || {};
    for (const [k, v] of Object.entries(srcAttacks)) r.attacks[k] = num(v && v.rank, 0);
    const srcDefs = get(system, "proficiencies.defenses", {}) || {};
    for (const [k, v] of Object.entries(srcDefs)) r.defenses[k] = num(v && v.rank, 0);

    if (cls) {
      const cs = cls.system || {};
      r.perception = Math.max(r.perception, num(cs.perception, 0));
      for (const s of SAVES) r.saves[s] = Math.max(r.saves[s], num(get(cs, `savingThrows.${s}`, 0), 0));
      for (const k of ["simple", "martial", "advanced", "unarmed"]) r.attacks[k] = Math.max(r.attacks[k] || 0, num(get(cs, `attacks.${k}`, 0), 0));
      for (const k of ["unarmored", "light", "medium", "heavy"]) r.defenses[k] = Math.max(r.defenses[k] || 0, num(get(cs, `defenses.${k}`, 0), 0));
      for (const s of get(cs, "trainedSkills.value", []) || []) if (s in r.skills) r.skills[s] = Math.max(r.skills[s], 1);
      r.spellcasting = Math.max(r.spellcasting, num(cs.spellcasting, 0));
    }
    if (background) {
      for (const s of get(background, "system.trainedSkills.value", []) || []) if (s in r.skills) r.skills[s] = Math.max(r.skills[s], 1);
    }

    /* ---- Regelelemente einsammeln ---- */
    const featSlugs = new Set();
    const featureSlugs = new Set();
    items.filter((it) => it.type === "feat").forEach((it) => {
      const sl = get(it, "system.slug", null) || D.slug(it.name);
      featSlugs.add(sl);
      if (["classfeature", "ancestryfeature"].includes(get(it, "system.category", ""))) featureSlugs.add(sl);
    });

    function isActiveItem(it) {
      if (it.type === "effect" || it.type === "condition") return false; // vorübergehend
      if (it.type === "spell" || it.type === "spellcastingEntry" || it.type === "lore") return false;
      if (PHYSICAL.includes(it.type)) {
        const eq = get(it, "system.equipped", {}) || {};
        const carry = eq.carryType || "worn";
        if (carry === "stowed" || carry === "dropped") return false;
        if (it.type === "armor" && eq.inSlot === false) return false;
        if (traitsOf(it).includes("invested") && eq.invested === false) return false;
        if (traitsOf(it).includes("invested") && eq.invested == null && it.type !== "armor") return false;
        return true;
      }
      return true;
    }

    const rules = [];
    items.forEach((it) => {
      if (!isActiveItem(it)) return;
      const list = get(it, "system.rules", []) || [];
      list.forEach((rule) => {
        if (!rule || typeof rule !== "object" || rule.ignored) return;
        rules.push({ rule: resolveDeep(rule, it), item: it });
      });
    });

    function baseOptions() {
      const o = new Set([`self:level:${level}`, "self:type:character"]);
      if (cls) o.add(`class:${get(cls, "system.slug", null) || D.slug(cls.name)}`);
      if (ancestry) o.add(`ancestry:${get(ancestry, "system.slug", null) || D.slug(ancestry.name)}`);
      if (heritage) o.add(`heritage:${get(heritage, "system.slug", null) || D.slug(heritage.name)}`);
      if (background) o.add(`background:${get(background, "system.slug", null) || D.slug(background.name)}`);
      featSlugs.forEach((s) => o.add(`feat:${s}`));
      featureSlugs.forEach((s) => o.add(`feature:${s}`));
      if (deity) o.add(`deity:primary:${get(deity, "system.slug", null) || D.slug(deity.name)}`);
      ((get(system, "traits.value", []) || []).concat(ancestry ? traitsOf(ancestry) : [])).forEach((t) => o.add(`self:trait:${t}`));
      for (const a of ATTRS) o.add(`attribute:${a}:mod:${Math.trunc(attrs[a])}`);
      for (const s of SKILLS) o.add(`skill:${s}:rank:${r.skills[s]}`);
      for (const s of SAVES) o.add(`save:${s}:rank:${r.saves[s]}`);
      o.add(`perception:rank:${r.perception}`);
      return o;
    }

    /* ---- ActiveEffectLike: Ränge & Werte anheben ---- */
    const numeric = { ancestryhp: null, focusMax: 0, bulkMax: 0, bulkEnc: 0, attrAdd: {}, favoredWeaponRank: 0 };
    function applyAE(rule, item, opts) {
      const path = String(rule.path || "");
      if (/\{(item|actor)\|/.test(path)) return; // nicht auflösbar
      if (rule.predicate && !testPredicate(rule.predicate, opts)) return;
      const val = evalFormula(rule.value, { level, itemLevel: num(get(item, "system.level.value", level), level), attrs });
      if (val == null) return;
      const mode = rule.mode;
      const apply = (cur) => {
        switch (mode) {
          case "upgrade": return Math.max(cur, val);
          case "downgrade": return Math.min(cur, val);
          case "override": return val;
          case "add": return cur + val;
          case "subtract": return cur - val;
          case "multiply": return cur * val;
          default: return cur;
        }
      };
      let m;
      if ((m = path.match(/^system\.skills\.([\w-]+)\.rank$/)) && m[1] in r.skills) r.skills[m[1]] = clampRank(apply(r.skills[m[1]]));
      else if ((m = path.match(/^system\.saves\.(\w+)\.rank$/)) && m[1] in r.saves) r.saves[m[1]] = clampRank(apply(r.saves[m[1]]));
      else if (/^system\.(?:attributes\.)?perception\.rank$/.test(path)) r.perception = clampRank(apply(r.perception));
      else if ((m = path.match(/^system\.proficiencies\.attacks\.([\w-]+)\.rank$/))) r.attacks[m[1]] = clampRank(apply(r.attacks[m[1]] || 0));
      else if ((m = path.match(/^system\.proficiencies\.defenses\.([\w-]+)\.rank$/))) r.defenses[m[1]] = clampRank(apply(r.defenses[m[1]] || 0));
      else if (/^system\.proficiencies\.spellcasting\.rank$/.test(path)) r.spellcasting = clampRank(apply(r.spellcasting));
      else if (/^system\.proficiencies\.classDCs\.[\w-]+\.rank$/.test(path)) r.classDC = clampRank(apply(r.classDC));
      else if (path === "system.attributes.ancestryhp") numeric.ancestryhp = apply(numeric.ancestryhp ?? num(get(ancestry, "system.hp", 0), 0));
      else if (path === "system.resources.focus.max") numeric.focusMax = apply(numeric.focusMax);
      else if (path === "flags.system.favoredWeaponRank") numeric.favoredWeaponRank = apply(numeric.favoredWeaponRank);
      else if (path === "inventory.bulk.maxAddend") numeric.bulkMax = apply(numeric.bulkMax);
      else if (path === "inventory.bulk.encumberedAfterAddend") numeric.bulkEnc = apply(numeric.bulkEnc);
      else if ((m = path.match(/^system\.abilities\.(\w+)\.mod$/)) && m[1] in attrs && !manual) {
        numeric.attrAdd[m[1]] = apply(numeric.attrAdd[m[1]] || 0);
      }
    }
    function clampRank(v) {
      return Math.max(0, Math.min(4, Math.round(v)));
    }

    // Zweimal anwenden, damit Regeln, die von anderen Rängen abhängen, greifen.
    for (let pass = 0; pass < 2; pass++) {
      const opts = baseOptions();
      rules.filter((x) => x.rule.key === "ActiveEffectLike").forEach((x) => applyAE(x.rule, x.item, opts));
    }
    for (const [a, v] of Object.entries(numeric.attrAdd)) attrs[a] += v;
    for (const a of ATTRS) attrs[a] = Math.trunc(Math.max(-5, Math.min(10, attrs[a])));

    const options = baseOptions();

    /* ---- FlatModifier sammeln ---- */
    const flatMods = [];
    rules.forEach(({ rule, item }) => {
      if (rule.key !== "FlatModifier") return;
      const selectors = Array.isArray(rule.selector) ? rule.selector : [rule.selector];
      flatMods.push({
        selectors: selectors.filter(Boolean),
        type: rule.type || "untyped",
        value: rule.value,
        predicate: rule.predicate,
        slug: rule.slug || null,
        item,
        attribute: rule.ability || rule.attribute || null,
      });
    });

    const adjustments = [];
    rules.forEach(({ rule }) => {
      if (rule.key !== "AdjustModifier" || !rule.slug) return;
      adjustments.push({ slug: rule.slug, mode: rule.mode, value: rule.value, predicate: rule.predicate });
    });

    /** Summe aller passenden, nicht-situativen Modifikatoren für die Selektoren. */
    function modsFor(selectorList, opts, extra) {
      const optSet = opts || options;
      const list = [];
      flatMods.forEach((m) => {
        if (!m.selectors.some((s) => selectorList.includes(s))) return;
        if (!testPredicate(m.predicate, optSet)) return;
        const v = evalFormula(m.value, { level, itemLevel: num(get(m.item, "system.level.value", level), level), attrs });
        if (v == null || v === 0) return;
        if (m.type === "ability") return; // Attributsersatz – hier nicht behandelt
        let value = v;
        adjustments.forEach((a) => {
          if (a.slug !== m.slug || !testPredicate(a.predicate, optSet)) return;
          const av = evalFormula(a.value, { level, attrs });
          if (av == null) return;
          if (a.mode === "upgrade") value = Math.max(value, av);
          else if (a.mode === "downgrade") value = Math.min(value, av);
          else if (a.mode === "override") value = av;
          else if (a.mode === "add") value += av;
          else if (a.mode === "subtract") value -= av;
        });
        list.push({ type: m.type, value, slug: m.slug });
      });
      if (extra) list.push(...extra);
      return stackModifiers(list);
    }

    /* ---- Rüstung & Schild ---- */
    const armor = items.find((it) => it.type === "armor" && get(it, "system.equipped.inSlot", false) && get(it, "system.category", "") !== "shield");
    const shield = items.find((it) => it.type === "shield" && get(it, "system.equipped.carryType", "") === "held") ||
      items.find((it) => it.type === "armor" && get(it, "system.category", "") === "shield" && get(it, "system.equipped.carryType", "") === "held");

    const armorCat = armor ? get(armor, "system.category", "unarmored") : "unarmored";
    const dexCap = armor ? num(get(armor, "system.dexCap", 99), 99) : 99;
    const armorStr = armor ? num(get(armor, "system.strength", 0), 0) : 0;
    const meetsStr = !armor || !armorStr || attrs.str >= armorStr || armorStr > 5 && attrs.str * 2 + 10 >= armorStr;
    const checkPenalty = armor && !meetsStr ? num(get(armor, "system.checkPenalty", 0), 0) : 0;
    let speedPenalty = armor ? num(get(armor, "system.speedPenalty", 0), 0) : 0;
    if (armor && meetsStr && speedPenalty < 0) speedPenalty = Math.min(0, speedPenalty + 5);

    const armorRank = r.defenses[armorCat] || 0;
    const acItemBonus = armor ? num(get(armor, "system.acBonus", 0), 0) + num(get(armor, "system.runes.potency", 0), 0) : 0;
    const acOpts = new Set(options);
    acOpts.add(`armor:category:${armorCat}`);
    const acValue =
      10 +
      Math.min(attrs.dex, dexCap) +
      profBonus(armorRank, level) +
      modsFor(["ac", "all"], acOpts, [{ type: "item", value: acItemBonus }]);

    const resilient = armor ? num(get(armor, "system.runes.resilient", 0), 0) : 0;

    /* ---- Werte berechnen ---- */
    function statMod(rank, attr, selectors, extraMods) {
      return profBonus(rank, level) + attrs[attr] + modsFor(selectors.concat([`${attr}-based`, "all"]), options, extraMods);
    }

    const saves = {};
    SAVES.forEach((s) => {
      saves[s] = {
        rank: r.saves[s],
        mod: statMod(r.saves[s], SAVE_ATTR[s], [s, "saving-throw"], resilient ? [{ type: "item", value: resilient }] : []),
      };
    });

    const perception = {
      rank: r.perception,
      mod: statMod(r.perception, "wis", ["perception", "check"]),
      senses: [],
    };

    const skills = {};
    SKILLS.forEach((s) => {
      const attr = I18N.SKILLS[s].ability;
      const extra = [];
      if (checkPenalty && (attr === "str" || attr === "dex") && !(traitsOf(armor).includes("flexible") && (s === "acrobatics" || s === "athletics"))) {
        extra.push({ type: "item", value: checkPenalty });
      }
      skills[s] = {
        rank: r.skills[s],
        mod: statMod(r.skills[s], attr, [s, "skill-check", "check"], extra),
        armorPenalty: extra.length ? checkPenalty : 0,
      };
    });

    const lores = byType("lore").map((it) => {
      const rank = clampRank(num(get(it, "system.proficient.value", 0), 0));
      const loreSlug = get(it, "system.slug", null) || D.slug(it.name);
      return {
        name: D.itemName(it),
        rank,
        mod: statMod(rank, "int", [loreSlug, `${loreSlug}-lore`, "lore-skill-check", "skill-check", "check"]),
      };
    });

    const keyAttr = (cls && (get(cls, "system.keyAbility.selected", null) || (get(cls, "system.keyAbility.value", []) || [])[0])) || get(system, "details.keyability.value", "str");
    const classDC = {
      rank: r.classDC,
      attr: keyAttr,
      value: cls ? 10 + profBonus(r.classDC, level) + attrs[keyAttr] + modsFor(["class", "class-dc", `${keyAttr}-based`, "all"]) : null,
    };

    /* ---- Trefferpunkte ---- */
    const ancestryHP = numeric.ancestryhp ?? num(get(ancestry, "system.hp", 0), 0);
    const classHP = num(get(cls, "system.hp", 0), 0);
    const hpMax =
      ancestryHP +
      (classHP + attrs.con) * level +
      modsFor(["hp"]) +
      modsFor(["hp-per-level"]) * level;
    const hpSrc = get(system, "attributes.hp", {}) || {};
    const hp = {
      max: Math.max(1, hpMax),
      value: Math.min(Math.max(1, hpMax), num(hpSrc.value, hpMax)),
      temp: num(hpSrc.temp, 0),
    };

    /* ---- Bewegung & Sinne ---- */
    const baseSpeed = num(get(ancestry, "system.speed", 25), 25);
    const speed = {
      value: Math.max(5, baseSpeed + speedPenalty + modsFor(["land-speed", "speed", "all-speeds"])),
      others: [],
      penalty: speedPenalty,
    };
    rules.forEach(({ rule }) => {
      if (rule.key === "BaseSpeed" && testPredicate(rule.predicate, options)) {
        const v = evalFormula(rule.value, { level, attrs });
        if (v) speed.others.push({ type: rule.selector, value: v });
      }
    });

    const vision = get(ancestry, "system.vision", "normal");
    const senseSet = new Map();
    if (vision && vision !== "normal") senseSet.set(vision, null);
    rules.forEach(({ rule }) => {
      if (rule.key === "Sense" && testPredicate(rule.predicate, options) && rule.selector) {
        if (rule.selector === "darkvision") senseSet.delete("low-light-vision");
        const range = evalFormula(rule.range, { level, attrs });
        senseSet.set(rule.selector, range && range < 1000 ? range : null);
      }
    });
    if (senseSet.has("darkvision") || senseSet.has("greater-darkvision")) senseSet.delete("low-light-vision");
    const SENSES = {
      darkvision: "Dunkelsicht",
      "greater-darkvision": "Verbesserte Dunkelsicht",
      "low-light-vision": "Dämmersicht",
      scent: "Geruchssinn",
      tremorsense: "Erschütterungssinn",
      echolocation: "Echolot",
      "see-invisibility": "Unsichtbares sehen",
      lifesense: "Lebenssinn",
      thoughtsense: "Gedankensinn",
      wavesense: "Wellensinn",
    };
    perception.senses = Array.from(senseSet.entries()).map(([k, range]) => `${SENSES[k] || D.term(k)}${range ? ` (${range} Fuß)` : ""}`);

    /* ---- Waffenangriffe ---- */
    const martialProfs = rules
      .filter(({ rule }) => rule.key === "MartialProficiency" && testPredicate(rule.predicate, options))
      .map(({ rule }) => ({ definition: rule.definition, value: num(evalFormula(rule.value, { level, attrs }), 0) }));
    // Waffenspezialisierung: neuere Systemversionen liefern sie als FlatModifier im Talent
    // (dann wird sie über modsFor erfasst), ältere nur als Klassenmerkmal ohne Regel.
    const specAsRule = flatMods.some((m) => m.slug === "weapon-specialization" || m.slug === "greater-weapon-specialization");
    const weaponSpec = specAsRule ? 0 : featSlugs.has("greater-weapon-specialization") ? 2 : featSlugs.has("weapon-specialization") ? 1 : 0;

    const favoredWeapons = (deity && get(deity, "system.weapons", [])) || [];

    function weaponRank(w, opts) {
      const s = w.system || {};
      const cat = s.category || "simple";
      let rank = r.attacks[cat] || 0;
      if (s.baseItem && r.attacks[`weapon-base-${s.baseItem}`] != null) rank = Math.max(rank, r.attacks[`weapon-base-${s.baseItem}`]);
      if (s.group && r.attacks[`weapon-group-${s.group}`] != null) rank = Math.max(rank, r.attacks[`weapon-group-${s.group}`]);
      // Lieblingswaffe der Gottheit (Kleriker u. a.)
      if (numeric.favoredWeaponRank && s.baseItem && favoredWeapons.includes(s.baseItem)) {
        rank = Math.max(rank, numeric.favoredWeaponRank, cat === "simple" || cat === "unarmed" ? r.attacks.simple || 0 : 0);
      }
      martialProfs.forEach((mp) => {
        if (testPredicate(mp.definition, opts)) rank = Math.max(rank, mp.value);
      });
      return rank;
    }

    function buildStrike(w, kind) {
      const s = w.system || {};
      const traits = traitsOf(w);
      const ranged = kind === "ranged" || (kind == null && num(s.range, 0) > 0);
      const thrown = ranged && traits.some((t) => /^thrown/.test(t));
      const opts = new Set(options);
      opts.add(`item:category:${s.category || "simple"}`);
      if (s.group) opts.add(`item:group:${s.group}`);
      if (s.baseItem) opts.add(`item:base:${s.baseItem}`);
      if (s.baseItem && favoredWeapons.includes(s.baseItem)) opts.add("item:deity-favored");
      opts.add(`item:slug:${s.slug || D.slug(w.name)}`);
      opts.add(ranged ? "item:ranged" : "item:melee");
      traits.forEach((t) => opts.add(`item:trait:${t}`));
      const rank = weaponRank(w, opts);
      opts.add(`item:proficiency:rank:${rank}`); // auch für gte-Vergleiche nutzbar

      let attr = ranged ? "dex" : "str";
      if (!ranged && traits.includes("finesse") && attrs.dex > attrs.str) attr = "dex";
      const potency = num(get(s, "runes.potency", 0), 0);
      const itemBonus = Math.max(potency, num(get(s, "bonus.value", 0), 0));
      const id = w._id || "";
      const attackSelectors = ["attack", "attack-roll", "strike-attack-roll", ranged ? "ranged-strike-attack-roll" : "melee-strike-attack-roll", `${id}-attack`, "all", "check", `${attr}-based`];
      const bonus = profBonus(rank, level) + attrs[attr] + modsFor(attackSelectors, opts, itemBonus ? [{ type: "item", value: itemBonus }] : []);

      // Schaden
      const dmg = s.damage || {};
      const dice = num(dmg.dice, 1) + num(get(s, "runes.striking", 0), 0);
      const die = (dmg.die || "").replace("d", "W");
      let dmgMod = 0;
      if (!ranged || thrown) dmgMod += attrs.str;
      else if (traits.includes("propulsive")) dmgMod += attrs.str > 0 ? Math.floor(attrs.str / 2) : attrs.str;
      dmgMod += num(get(s, "bonusDamage.value", 0), 0);
      const specMods = [];
      if (weaponSpec && rank >= 2) specMods.push({ type: "untyped", value: weaponSpec * (rank === 2 ? 2 : rank === 3 ? 3 : 4) });
      const damageSelectors = ["damage", "strike-damage", "weapon-damage", ranged ? "ranged-strike-damage" : "melee-strike-damage", `${id}-damage`, `${s.group}-weapon-group-damage`];
      dmgMod += modsFor(damageSelectors.concat(["unarmed-damage"].filter(() => (s.category || "") === "unarmed")), opts, specMods);
      const damageType = D.damageType(dmg.damageType || "");
      const damage = `${die ? dice + die : ""}${dmgMod ? (dmgMod > 0 ? "+" : "") + dmgMod : ""} ${damageType}`.trim();

      const agile = traits.includes("agile");
      return {
        name: D.itemName(w),
        ranged,
        bonus,
        map: [bonus, bonus - (agile ? 4 : 5), bonus - (agile ? 8 : 10)],
        damage: damage || "—",
        traits: traits.filter((t) => t !== "magical").map(D.trait),
        unarmed: (s.category || "") === "unarmed",
        range: num(s.range, 0) || (thrown ? num((traits.find((t) => /^thrown-\d+/.test(t)) || "").split("-")[1], 10) : 0),
        rank,
        equipped: get(s, "equipped.carryType", "") === "held",
      };
    }

    const strikes = [];
    const weapons = byType("weapon").filter((w) => !["stowed", "dropped"].includes(get(w, "system.equipped.carryType", "worn")));
    weapons.forEach((w) => {
      const st = buildStrike(w, null);
      strikes.push(st);
      // Nahkampfwaffen mit "Geworfen" zusätzlich als Fernkampfangriff
      if (!st.ranged && traitsOf(w).some((t) => /^thrown/.test(t))) {
        strikes.push(Object.assign(buildStrike(w, "ranged"), { name: st.name + " (geworfen)" }));
      }
    });

    // Strike-Regelelemente (Klauen, Fäuste besonderer Art …)
    rules.forEach(({ rule, item }) => {
      if (rule.key !== "Strike" || !testPredicate(rule.predicate, options)) return;
      const base = get(rule, "damage.base", {}) || {};
      const fake = {
        _id: (item._id || "") + "-strike",
        name: rule.label && !/^PF2E\./.test(rule.label) ? rule.label : item.name,
        system: {
          slug: rule.slug,
          category: rule.category || "unarmed",
          group: rule.group || "brawling",
          baseItem: rule.baseType || null,
          damage: { dice: num(base.dice, 1), die: base.die || "d4", damageType: base.damageType || "bludgeoning" },
          traits: { value: rule.traits || [] },
          range: rule.range && typeof rule.range === "object" ? num(rule.range.increment, 0) : num(rule.range, 0),
          runes: {},
        },
      };
      const st = buildStrike(fake, null);
      if (rule.label && /^PF2E\./.test(rule.label)) st.name = D.itemName(item);
      strikes.push(st);
    });

    // Waffenloser Angriff (Faust) – hat jeder Charakter
    const hasUnarmed = strikes.some((s) => s.unarmed);
    if (!hasUnarmed && get(raw, "flags.pf2e.showBasicUnarmed", true) !== false) {
      const fist = {
        _id: "fist",
        name: "Faust",
        system: {
          slug: "fist",
          category: "unarmed",
          group: "brawling",
          baseItem: "fist",
          damage: { dice: 1, die: "d4", damageType: "bludgeoning" },
          traits: { value: ["agile", "finesse", "nonlethal", "unarmed"] },
          runes: {},
        },
      };
      const st = buildStrike(fist, null);
      st.name = "Faust";
      strikes.push(st);
    }

    // Doppelte Einträge (z. B. zwei gleiche Dolche) zusammenfassen
    const strikeKeys = new Set();
    for (let i = strikes.length - 1; i >= 0; i--) {
      const k = `${strikes[i].name}|${strikes[i].bonus}|${strikes[i].damage}`;
      if (strikeKeys.has(k)) strikes.splice(i, 1);
      else strikeKeys.add(k);
    }

    /* ---- Fähigkeiten (Talente, Klassenmerkmale, Aktionen) ---- */
    const abilities = parseAbilities(items, level);

    /* ---- Stufenplan 1–20 ---- */
    const levelPlan = buildLevelPlan(items, cls, level);

    /* ---- Zauber ---- */
    const spellcasting = parseSpellcasting(items, { level, attrs, rank: r.spellcasting, modsFor, focusMax: numeric.focusMax, system });

    /* ---- Inventar & Geld ---- */
    const inv = parseInventory(items, attrs, numeric);

    /* ---- Schild ---- */
    const shieldInfo = shield
      ? {
          name: D.itemName(shield),
          bonus: num(get(shield, "system.acBonus", 0), 0),
          hardness: num(get(shield, "system.hardness", 0), 0),
          hp: num(get(shield, "system.hp.value", 0), 0),
          hpMax: num(get(shield, "system.hp.max", 0), 0),
        }
      : null;

    /* ---- Resistenzen etc. ---- */
    const iwr = { resistances: [], weaknesses: [], immunities: [] };
    rules.forEach(({ rule }) => {
      if (!testPredicate(rule.predicate, options)) return;
      const types = Array.isArray(rule.type) ? rule.type : [rule.type];
      if (rule.key === "Resistance") {
        const v = evalFormula(rule.value, { level, attrs });
        if (v) types.forEach((t) => iwr.resistances.push(`${D.damageType(t) || D.term(t)} ${v}`));
      } else if (rule.key === "Weakness") {
        const v = evalFormula(rule.value, { level, attrs });
        if (v) types.forEach((t) => iwr.weaknesses.push(`${D.damageType(t) || D.term(t)} ${v}`));
      } else if (rule.key === "Immunity") {
        types.forEach((t) => iwr.immunities.push(D.trait(t)));
      }
    });

    /* ---- Sprachen ---- */
    const langSet = new Set();
    (get(ancestry, "system.languages.value", []) || []).forEach((l) => langSet.add(l));
    (get(system, "details.languages.value", []) || []).forEach((l) => langSet.add(l));
    (get(system, "traits.languages.value", []) || []).forEach((l) => langSet.add(l));
    rules.forEach(({ rule }) => {
      if (rule.key === "ActiveEffectLike" && rule.path === "system.build.languages.granted" && rule.value) {
        const v = typeof rule.value === "object" ? rule.value.slug : rule.value;
        if (v && !/[{|]/.test(v)) langSet.add(v);
      }
    });

    const model = {
      warnings,
      meta: {
        name: raw.name || "Unbenannter Charakter",
        level,
        ancestry: ancestry ? D.itemName(ancestry) : "",
        heritage: heritage ? D.itemName(heritage) : "",
        background: background ? D.itemName(background) : "",
        className: cls ? D.itemName(cls) : "",
        deity: deity ? D.itemName(deity) : "",
        size: D.size(get(ancestry, "system.size", "med")),
        languages: Array.from(langSet).map(D.language),
        age: get(system, "details.age.value", ""),
        gender: get(system, "details.gender.value", ""),
        keyAttr,
        heroPoints: num(get(system, "resources.heroPoints.value", 1), 1),
        heroPointsMax: num(get(system, "resources.heroPoints.max", 3), 3),
        xp: num(get(system, "details.xp.value", 0), 0),
        manualAttributes: manual,
      },
      abilities: attrs,
      hp,
      ac: { value: acValue, armor: armor ? D.itemName(armor) : "Keine Rüstung", armorCategory: armorCat, dexCap: dexCap < 99 ? dexCap : null, rank: armorRank },
      shield: shieldInfo,
      saves,
      perception,
      classDC,
      speed,
      skills,
      lores,
      strikes,
      abilitiesList: abilities,
      levelPlan,
      spellcasting,
      inventory: inv.items,
      currency: inv.currency,
      bulk: inv.bulk,
      iwr,
      proficiencies: { attacks: r.attacks, defenses: r.defenses, spellcasting: r.spellcasting },
      conditions: byType("condition").map((it) => ({ name: D.itemName(it), value: get(it, "system.value.value", null) })),
    };

    const untranslated = abilities.filter((a) => !a.summary).length;
    if (untranslated) {
      warnings.push(`${untranslated} Fähigkeit(en) haben keine deutsche Kurzfassung (z. B. sehr neue oder selbst erstellte Inhalte) – dort steht nur der Name.`);
    }
    return model;
  }

  /* ---------------- Fähigkeiten ---------------- */

  const COMBAT_TRAITS = ["attack", "flourish", "stance", "press", "open", "rage", "finisher", "spellshape", "metamagic", "aura", "manipulate", "move"];
  const OUTSIDE_TRAITS = ["exploration", "downtime"];

  const COMBAT_WORDS = /Angriff|Schaden|\bRK\b|Rüstungsklasse|Rettungswurf|Reflex|Zähigkeit|Willen|Initiative|Trefferpunkt|\bTP\b|Reaktion|Kampf|Waffe|Schild|Gegner|Treffer|Verbündete|Zustand|Malus|im Nahkampf|Fernkampf|Haltung|Zug\b|Runde/;
  const OUTSIDE_WORDS = /Auszeit|Erkundung|Handwerk|herstellen|Herstellen|Einkommen|Formel|Gold|Händler|Preis|Reise|Wildnis|Tage?\b|Woche|Stunden?\b|Minuten\b|Informationen|Gesellschaft|Sprache|Schloss|Spuren|Gespräch|Verhandl|Identifizieren|Gegenstände herstellen|Ruhe|Unterkunft|kaufen|verkaufen/;

  const CATEGORY_DE = {
    ancestry: "Volkstalent",
    ancestryfeature: "Volksmerkmal",
    heritage: "Erbe",
    class: "Klassentalent",
    classfeature: "Klassenmerkmal",
    skill: "Fertigkeitstalent",
    general: "Allgemeines Talent",
    archetype: "Archetyp-Talent",
    bonus: "Bonustalent",
    pfsboon: "Gunst",
    deityboon: "Göttliche Gunst",
    curse: "Fluch",
    calling: "Berufung",
  };

  // Rein technische Klassenmerkmale ohne Spielrelevanz am Tisch
  const SKIP_SLUGS = new Set(["ancestry-and-background", "initial-proficiencies", "skill-feats", "general-feats", "skill-increases", "attribute-boosts", "ancestry-feats", "class-feats", "ability-boosts"]);

  // Regeln, die nur Zahlen auf dem Bogen verändern (dort also schon eingerechnet sind)
  const BUILD_RULE_KEYS = new Set(["GrantItem", "ChoiceSet", "MartialProficiency", "Sense", "BaseSpeed", "ActorTraits", "CreatureSize", "TokenLight", "TokenEffectIcon", "CraftingAbility", "SpecialResource"]);
  const BUILD_TEXT = /Kompetenzgrad[^.]*(steigt|verbessert|erhöht)|erhältst (?:ein|einen|ein zusätzliches|ein weiteres) [^.]*Talent|erhältst [^.]*den Kompetenzgrad (?:Geübt|Experte|Meister|Legende)|Erhöhe deine Maximal-TP|Deine Bewegungsrate erhöht sich/;

  function isBuildOnly(item, summary) {
    const rules = get(item, "system.rules", []) || [];
    const text = summary ? [summary.s, summary.trigger].filter(Boolean).join(" ") : "";
    if (summary && summary.trigger) return false;
    const rulesBuild =
      rules.length > 0 &&
      rules.every((r) => {
        if (BUILD_RULE_KEYS.has(r.key)) return true;
        if (r.key === "ActiveEffectLike") return /\.rank$|^system\.build\.|ancestryhp|focus\.max/.test(String(r.path || ""));
        if (r.key === "FlatModifier") return !r.predicate && ["hp", "hp-per-level", "land-speed", "speed"].includes(String(r.selector));
        return false;
      });
    if (rulesBuild && rules.some((r) => r.key !== "ChoiceSet")) return !text || BUILD_TEXT.test(text) || rules.every((r) => r.key === "GrantItem" || r.key === "ChoiceSet");
    return !!text && BUILD_TEXT.test(text) && text.length < 140;
  }

  function parseAbilities(items, level) {
    const seen = new Set();
    // Reaktionen/Aktionen, die als eigenes "action"-Item vorliegen (z. B. Reaktionsangriff)
    const actionCosts = new Map();
    items.filter((it) => it.type === "action").forEach((it) => {
      const t = get(it, "system.actionType.value", "passive");
      if (t !== "passive") actionCosts.set(D.slug(it.name), { t, n: get(it, "system.actions.value", null) });
    });
    const out = [];
    const candidates = items.filter((it) => it.type === "feat" || it.type === "action" || it.type === "heritage");
    candidates.forEach((it) => {
      const s = it.system || {};
      const slug = s.slug || D.slug(it.name);
      if (SKIP_SLUGS.has(slug)) return;
      const key = D.slug(it.name);
      if (seen.has(key)) return;
      seen.add(key);
      // Grundaktionen wie "Cast a Spell" ohne Mehrwert ausblenden
      if (it.type === "action" && ["cast-a-spell", "strike", "stride", "interact"].includes(slug)) return;

      const traits = traitsOf(it);
      let actionType = get(s, "actionType.value", "passive") || "passive";
      let actions = get(s, "actions.value", null);
      const summary = D.itemSummary(it);
      if (actionType === "passive" && actionCosts.has(key)) {
        actionType = actionCosts.get(key).t;
        actions = actionCosts.get(key).n;
      }
      if (actionType === "passive" && summary && summary.trigger) actionType = "reaction";
      const name = D.itemName(it);
      const category = it.type === "heritage" ? "heritage" : it.type === "action" ? "action" : s.category || (traits.includes("archetype") ? "archetype" : "class");

      let when;
      if (actionType === "passive" && isBuildOnly(it, summary)) when = "eingerechnet";
      else if (traits.some((t) => OUTSIDE_TRAITS.includes(t))) when = "ausserhalb";
      else if (actionType !== "passive") when = "kampf";
      else {
        const text = summary ? [summary.s, summary.trigger, summary.req].filter(Boolean).join(" ") : "";
        const c = (text.match(new RegExp(COMBAT_WORDS.source, "g")) || []).length + (traits.some((t) => COMBAT_TRAITS.includes(t)) ? 2 : 0);
        const o = (text.match(new RegExp(OUTSIDE_WORDS.source, "g")) || []).length;
        if (c > o) when = "kampf-passiv";
        else if (o > c) when = "ausserhalb";
        else when = "immer";
      }

      out.push({
        name,
        slug,
        level: num(get(s, "level.taken", null) ?? get(s, "level.value", 0), 0),
        category,
        categoryName: it.type === "action" ? "Aktion" : CATEGORY_DE[category] || "Talent",
        actionType,
        actions,
        cost: actionCost(actionType, actions),
        traits: traits.filter((t) => !["general", "skill", "class", "ancestry"].includes(t)).map(D.trait),
        summary: summary ? summary.s || "" : "",
        trigger: summary ? summary.trigger || "" : "",
        requirement: summary ? summary.req || "" : "",
        frequency: summary ? summary.freq || "" : "",
        when,
      });
    });
    return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "de"));
  }

  /** Für jede Stufe: welche Talentplätze/Steigerungen es gibt und was gewählt wurde. */
  function buildLevelPlan(items, cls, level) {
    const cs = (cls && cls.system) || {};
    const lv = (k, def) => (get(cs, `${k}.value`, def) || def);
    const slots = {
      ancestry: lv("ancestryFeatLevels", [1, 5, 9, 13, 17]),
      class: lv("classFeatLevels", [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]),
      skill: lv("skillFeatLevels", [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]),
      general: lv("generalFeatLevels", [3, 7, 11, 15, 19]),
    };
    const skillInc = lv("skillIncreaseLevels", [3, 5, 7, 9, 11, 13, 15, 17, 19]);
    const LABEL = { ancestry: "Volkstalent", class: "Klassentalent", skill: "Fertigkeitstalent", general: "Allgemeines Talent" };
    const feats = items.filter((it) => it.type === "feat");
    const bySlot = new Map();
    feats.forEach((f) => {
      const loc = get(f, "system.location", null);
      if (typeof loc === "string" && /^[a-z]+-\d+$/.test(loc)) bySlot.set(loc, D.itemName(f));
    });
    const features = cls ? feats.filter((f) => get(f, "system.location", null) === cls._id) : [];
    const plan = [];
    for (let l = 1; l <= 20; l++) {
      const entries = [];
      if (l <= level) {
        features
          .filter((f) => num(get(f, "system.level.value", 0), 0) === l)
          .forEach((f) => entries.push({ kind: "Klassenmerkmal", name: D.itemName(f) }));
      } else {
        // Künftige Klassenmerkmale stehen in der Klasse selbst (system.items)
        Object.values(cs.items || {})
          .filter((f) => f && num(f.level, 0) === l)
          .forEach((f) => entries.push({ kind: "Klassenmerkmal", name: D.itemName({ name: f.name, system: {} }), future: true }));
      }
      for (const k of ["ancestry", "class", "skill", "general"]) {
        if (slots[k].includes(l)) entries.push({ kind: LABEL[k], name: bySlot.get(`${k}-${l}`) || "" });
      }
      if (skillInc.includes(l)) entries.push({ kind: "Fertigkeitssteigerung", name: "" });
      if ([5, 10, 15, 20].includes(l)) entries.push({ kind: "Attributsteigerungen (4×)", name: "" });
      plan.push({ level: l, reached: l <= level, entries });
    }
    return plan;
  }

  function actionCost(type, count) {
    if (type === "reaction") return "R";
    if (type === "free") return "F";
    if (type === "action") return Math.max(1, Math.min(3, num(count, 1)));
    return null;
  }

  /* ---------------- Zauber ---------------- */

  function parseSpellcasting(items, ctx) {
    const { level, attrs, rank: baseRank, modsFor } = ctx;
    const entries = items.filter((it) => it.type === "spellcastingEntry");
    const spells = items.filter((it) => it.type === "spell");
    const KIND = { prepared: "Vorbereitet", spontaneous: "Spontan", innate: "Angeboren", focus: "Fokus", items: "Gegenstand", ritual: "Ritual" };
    const TRAD = { arcane: "Arkan", divine: "Göttlich", occult: "Okkult", primal: "Primal" };

    const outEntries = entries.map((e) => {
      const s = e.system || {};
      const kind = get(s, "prepared.value", "prepared");
      let rank = Math.max(num(get(s, "proficiency.value", 0), 0), baseRank);
      if (kind === "innate") rank = Math.max(rank, 1);
      const attr = get(s, "ability.value", "cha") || "cha";
      const tradition = get(s, "tradition.value", "");
      const mods = modsFor(["spell-attack-dc", `${attr}-based`, "all", `${tradition}-spell-dc`, "spell-dc"]);
      const atkMods = modsFor(["spell-attack-dc", `${attr}-based`, "all", `${tradition}-spell-attack`, "spell-attack", "spell-attack-roll", "attack", "attack-roll"]);
      const dc = 10 + profBonus(rank, level) + attrs[attr] + mods;
      const attack = profBonus(rank, level) + attrs[attr] + atkMods;

      const slots = [];
      for (let i = 0; i <= 10; i++) {
        const max = num(get(s, `slots.slot${i}.max`, 0), 0);
        if (max) slots.push({ rank: i, max });
      }
      const preparedIds = new Set();
      Object.values(get(s, "slots", {}) || {}).forEach((sl) => (sl && Array.isArray(sl.prepared) ? sl.prepared : []).forEach((p) => p && p.id && preparedIds.add(p.id)));

      const own = spells
        .filter((sp) => get(sp, "system.location.value", null) === e._id)
        .map((sp) => {
          const traits = traitsOf(sp);
          const sum = D.itemSummary(sp);
          const cantrip = traits.includes("cantrip");
          const time = String(get(sp, "system.time.value", ""));
          return {
            name: D.itemName(sp),
            rank: cantrip ? 0 : num(get(sp, "system.level.value", 1), 1),
            cantrip,
            focus: traits.includes("focus"),
            cost: /^[123]$/.test(time)
              ? Number(time)
              : /^(\d) to (\d)$/.test(time)
                ? time.replace(/^(\d) to (\d)$/, "$1–$2 ◆")
                : /reaction/i.test(time) ? "R" : /free/i.test(time) ? "F" : time ? time.replace(/(\d+)\s*minutes?/i, "$1 Min.").replace(/(\d+)\s*hours?/i, "$1 Std.").replace(/(\d+)\s*days?/i, "$1 Tage") : null,
            range: translateRange(get(sp, "system.range.value", "")),
            defense: defenseName(get(sp, "system.defense", null)),
            summary: sum ? sum.s || "" : "",
            prepared: preparedIds.has(sp._id),
            traits: traits.filter((t) => !["cantrip", "focus", "concentrate", "manipulate"].includes(t)).map(D.trait),
          };
        })
        .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "de"));

      return {
        name: D.term(e.name) !== e.name ? D.term(e.name) : /^(arcane|divine|occult|primal)\b|spells?$/i.test(e.name) ? "Zauber" : e.name,
        kind: KIND[kind] || kind,
        kindKey: kind,
        tradition: TRAD[tradition] || D.trait(tradition),
        attr,
        rank,
        dc,
        attack,
        slots,
        spells: own,
      };
    });

    const focusMax = Math.min(3, Math.max(num(get(ctx.system, "resources.focus.max", 0), 0), ctx.focusMax || 0, outEntries.some((e) => e.kindKey === "focus") ? 1 : 0));
    return {
      entries: outEntries.filter((e) => e.spells.length || e.slots.length),
      focus: { value: num(get(ctx.system, "resources.focus.value", 0), 0), max: focusMax },
    };
  }

  function defenseName(def) {
    if (!def) return "";
    const save = get(def, "save.statistic", null);
    const basic = get(def, "save.basic", false);
    const passive = get(def, "passive.statistic", null);
    const names = { fortitude: "Zähigkeit", reflex: "Reflex", will: "Willen", ac: "RK" };
    if (save) return (basic ? "einfacher " : "") + (names[save] || save);
    if (passive) return names[passive] || passive;
    return "";
  }

  function translateRange(r) {
    if (!r) return "";
    return String(r)
      .replace(/(\d+)\s*(?:feet|foot|ft\.?)/i, "$1 Fuß")
      .replace(/^touch$/i, "Berührung")
      .replace(/^planetary$/i, "planetar")
      .replace(/(\d+)\s*miles?/i, "$1 Meilen")
      .replace(/^self$/i, "selbst")
      .replace(/unlimited/i, "unbegrenzt");
  }

  /* ---------------- Inventar ---------------- */

  const RUNE_TIERS = ["", "", "-greater", "-major"];

  /** Beschreibung, Runen und gespeicherte Zauber eines Gegenstands. */
  function itemDetails(it) {
    const s = it.system || {};
    const traits = traitsOf(it);
    const runes = [];
    const rs = s.runes || {};
    const runeEntry = (slug) => {
      const e = D.entry("eq:" + slug);
      return { name: (e && e.n) || D.term(slug), summary: (e && e.s) || "" };
    };
    if (num(rs.potency, 0) > 0) runes.push(runeEntry(`${it.type === "armor" ? "armor" : "weapon"}-potency-${num(rs.potency, 0)}`));
    if (num(rs.striking, 0) > 0) runes.push(runeEntry(`striking${RUNE_TIERS[num(rs.striking, 0)] || ""}`));
    if (num(rs.resilient, 0) > 0) runes.push(runeEntry(`resilient${RUNE_TIERS[num(rs.resilient, 0)] || ""}`));
    if (num(rs.reinforcing, 0) > 0) runes.push(runeEntry(["", "reinforcing-rune-minor", "reinforcing-rune-lesser", "reinforcing-rune-moderate", "reinforcing-rune-greater", "reinforcing-rune-major", "reinforcing-rune-supreme"][num(rs.reinforcing, 0)] || "reinforcing-rune-minor"));
    (Array.isArray(rs.property) ? rs.property : []).filter(Boolean).forEach((p) => runes.push(runeEntry(p)));

    // Zauberstab / Schriftrolle: enthaltener Zauber
    let spell = null;
    if (s.spell && s.spell.name) {
      const sp = Object.assign({ type: "spell" }, s.spell);
      const sum = D.itemSummary(sp);
      spell = {
        name: D.itemName(sp),
        rank: num(get(s.spell, "system.location.heightenedLevel", null) ?? get(s.spell, "system.level.value", 1), 1),
        summary: sum ? sum.s || "" : "",
      };
    }

    const sum = D.itemSummary(it);
    const magical = traits.includes("magical") || traits.includes("invested") || traits.includes("alchemical") || runes.length > 0 || !!spell ||
      ["arcane", "divine", "occult", "primal"].some((t) => traits.includes(t));
    return {
      magical,
      rarity: get(s, "traits.rarity", "common"),
      traitsDe: traits.filter((t) => !["magical"].includes(t)).map(D.trait),
      desc: sum
        ? { s: sum.s || "", act: sum.act || "", freq: sum.freq || "", eff: sum.eff || "", trigger: sum.trigger || "", req: sum.req || "", sp: sum.sp || [] }
        : null,
      runes,
      spell,
      usage: get(s, "usage.value", ""),
    };
  }

  function parseInventory(items, attrs, numeric) {
    const physical = items.filter((it) => PHYSICAL.includes(it.type));
    const containers = new Map(items.filter((it) => it.type === "backpack").map((b) => [b._id, b]));
    const currency = { pp: 0, gp: 0, sp: 0, cp: 0 };
    const list = [];
    let bulkTenths = 0;

    physical.forEach((it) => {
      const s = it.system || {};
      const qty = num(s.quantity, 1);
      const isCoin = it.type === "treasure" && (s.category === "coin" || s.stackGroup === "coins" || /-pieces$/.test(s.slug || ""));
      if (isCoin) {
        const price = get(s, "price.value", {}) || {};
        for (const d of ["pp", "gp", "sp", "cp"]) currency[d] += num(price[d], 0) * qty;
        bulkTenths += Math.floor(qty / 1000) * 10;
        return;
      }
      const carry = get(s, "equipped.carryType", "worn");
      let bulk = num(get(s, "bulk.value", 0), 0);
      const inContainer = s.containerId && containers.get(s.containerId);
      // Behälter mit "ignored": Inhalte bis zu diesem Wert zählen nicht
      const bulkLabel = bulk === 0 ? "–" : bulk < 1 ? "L" : String(bulk);
      if (it.type === "backpack" && carry !== "dropped") bulk = num(get(s, "bulk.heldOrStowed", bulk), bulk) || bulk;
      const itemBulk = Math.round(bulk * 10) * (it.type === "ammo" || it.type === "consumable" ? Math.ceil(qty / (bulk < 1 && /arrow|bolt|pfeil/i.test(it.name) ? 10 : 1)) : qty);
      if (carry !== "dropped") bulkTenths += itemBulk;
      list.push({
        name: D.itemName(it),
        type: it.type,
        quantity: qty,
        bulk: bulkLabel,
        equipped: ["held", "worn"].includes(carry) && (it.type !== "armor" || get(s, "equipped.inSlot", true)) && !inContainer,
        held: carry === "held",
        invested: traitsOf(it).includes("invested") ? !!get(s, "equipped.invested", false) : null,
        container: inContainer ? D.itemName(inContainer) : null,
        level: num(get(s, "level.value", 0), 0),
        ...itemDetails(it),
      });
    });

    // Behälter-Ignorieren grob berücksichtigen (z. B. Rucksack ignoriert 2 Traglast)
    containers.forEach((c) => {
      const ignored = num(get(c, "system.bulk.ignored", 0), 0);
      if (!ignored) return;
      const content = physical.filter((it) => get(it, "system.containerId", null) === c._id).reduce((sum, it) => sum + Math.round(num(get(it, "system.bulk.value", 0), 0) * 10) * num(get(it, "system.quantity", 1), 1), 0);
      bulkTenths -= Math.min(content, ignored * 10);
    });

    return {
      items: list.sort((a, b) => Number(b.equipped) - Number(a.equipped) || a.name.localeCompare(b.name, "de")),
      currency,
      bulk: {
        value: Math.floor(bulkTenths / 10),
        light: bulkTenths % 10,
        encumbered: 5 + attrs.str + (numeric.bulkEnc || 0),
        max: 10 + attrs.str + (numeric.bulkMax || 0),
      },
    };
  }

  global.PF2_PARSER = { parseFoundryActor, _internal: { evalFormula, testPredicate } };
})(typeof window !== "undefined" ? window : globalThis);
