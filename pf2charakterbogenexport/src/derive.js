/*
 * Ableitung (Berechnung) der Spielwerte aus einem "rohen" Foundry-Export.
 *
 * Wichtig: Der "Export Data"-Befehl von Foundry VTT speichert nur die
 * Quelldaten eines Charakters (Attributsteigerungen, Kompetenzränge,
 * Items) – NICHT die daraus berechneten Werte wie Attributsmodifikatoren,
 * RK, maximale TP oder Rettungswurfboni. Diese Datei rechnet die Werte
 * nach den Regeln der Pathfinder-2-Remastered-Ausgabe nach, so wie es das
 * pf2e-System in Foundry beim Laden des Charakters tut.
 *
 * Berücksichtigt werden: Attributsteigerungen (inkl. Teilsteigerungen ab +4),
 * Kompetenzen aus Klasse + Klassenmerkmalen, Trefferpunkte, RK aus angelegter
 * Rüstung, Rettungswürfe, Wahrnehmung, Klassen-SG, Fertigkeiten,
 * Waffenangriffe/-schaden, Zauber-SG, Geschwindigkeit und einfache,
 * bedingungslose Boni (z. B. Zähigkeit, Gegenstandsboni investierter Items).
 * Situative Boni (Umstands-/Zustandsboni mit Bedingungen) werden bewusst
 * NICHT eingerechnet – sie gelten nur in bestimmten Situationen.
 */
(function (global) {
  "use strict";

  const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
  const SAVE_ABILITY = { fortitude: "con", reflex: "dex", will: "wis" };
  const SKILL_ABILITY = {
    acrobatics: "dex", arcana: "int", athletics: "str", crafting: "int",
    deception: "cha", diplomacy: "cha", intimidation: "cha", medicine: "wis",
    nature: "wis", occultism: "int", performance: "cha", religion: "wis",
    society: "int", stealth: "dex", survival: "wis", thievery: "dex",
  };

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback ?? 0;
  }

  function get(obj, path, fallback) {
    let cur = obj;
    for (const p of path.split(".")) {
      if (cur == null) return fallback;
      cur = cur[p];
    }
    return cur == null ? fallback : cur;
  }

  function profBonus(rank, level) {
    return rank > 0 ? level + 2 * rank : 0;
  }

  /* ---------- Hilfsfunktionen für Foundry-Regelelemente ---------- */

  // Löst Platzhalter wie "{item|flags.pf2e.rulesSelections.damageType}" auf.
  function resolveSelection(item, text) {
    if (typeof text !== "string") return text;
    return text.replace(/\{item\|flags\.pf2e\.rulesSelections\.([\w-]+)\}/g, (_, flag) => {
      const fromFlags = get(item, `flags.pf2e.rulesSelections.${flag}`, null);
      if (fromFlags != null) return String(fromFlags);
      const choice = (get(item, "system.rules", []) || []).find((r) => r.key === "ChoiceSet" && r.flag === flag);
      return choice && choice.selection != null ? String(choice.selection) : "";
    });
  }

  function resolveValue(value, ctx) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const v = value.trim();
      if (v === "@actor.level") return ctx.level;
      if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    }
    return null; // komplexe Formeln werden nicht ausgewertet
  }

  // Sehr einfache Auswertung von Foundry-Prädikaten. Unbekannte Bedingungen
  // gelten als "nicht erfüllt", sodass im Zweifel nichts eingerechnet wird.
  function testPredicate(pred, options) {
    if (pred == null) return true;
    if (Array.isArray(pred)) return pred.every((p) => testPredicate(p, options));
    if (typeof pred === "string") return options.has(pred);
    if (typeof pred === "object") {
      if (pred.not !== undefined) return !testPredicate(pred.not, options);
      if (pred.and) return pred.and.every((p) => testPredicate(p, options));
      if (pred.or) return pred.or.some((p) => testPredicate(p, options));
      if (pred.nor) return !pred.nor.some((p) => testPredicate(p, options));
      if (pred.nand) return !pred.nand.every((p) => testPredicate(p, options));
    }
    return false;
  }

  /* ---------- Attribute ---------- */

  function boostFromSlot(slot) {
    if (!slot) return null;
    const values = Array.isArray(slot.value) ? slot.value : [];
    if (slot.selected) return slot.selected;
    if (values.length === 1) return values[0];
    return null;
  }

  function computeAbilities(system, ancestry, background, classItem, level) {
    const mods = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const partial = { str: false, dex: false, con: false, int: false, wis: false, cha: false };
    let anyData = false;

    function boost(key) {
      if (!ABILITY_KEYS.includes(key)) return;
      anyData = true;
      // Remaster: Steigerung eines Attributs von +4 oder höher zählt nur halb
      // (zwei Teilsteigerungen ergeben +1).
      if (mods[key] >= 4) {
        if (partial[key]) {
          mods[key] += 1;
          partial[key] = false;
        } else {
          partial[key] = true;
        }
      } else {
        mods[key] += 1;
      }
    }
    function flaw(key) {
      if (!ABILITY_KEYS.includes(key)) return;
      anyData = true;
      mods[key] -= 1;
    }

    const ancestryBoosts = get(ancestry, "system.boosts", {});
    const ancestryFlaws = get(ancestry, "system.flaws", {});
    const voluntary = get(system, "build.attributes.flaws.ancestry", []) || [];
    const altBoosts = get(system, "build.attributes.alternateAncestryBoosts", null)
      || get(ancestry, "system.alternateAncestryBoosts", null);

    if (Array.isArray(altBoosts) && altBoosts.length) {
      altBoosts.forEach(boost);
    } else {
      Object.values(ancestryBoosts).forEach((slot) => {
        const k = boostFromSlot(slot);
        if (k) boost(k);
      });
      Object.values(ancestryFlaws).forEach((slot) => {
        const k = boostFromSlot(slot);
        if (k) flaw(k);
      });
    }
    voluntary.forEach(flaw);

    Object.values(get(background, "system.boosts", {})).forEach((slot) => {
      const k = boostFromSlot(slot);
      if (k) boost(k);
    });

    const keyAbility = boostFromSlot(get(classItem, "system.keyAbility", null)) || get(system, "details.keyability.value", null);
    if (keyAbility) boost(keyAbility);

    const levelBoosts = get(system, "build.attributes.boosts", {}) || {};
    Object.keys(levelBoosts)
      .map(Number)
      .filter((lvl) => lvl <= level)
      .sort((a, b) => a - b)
      .forEach((lvl) => (levelBoosts[lvl] || []).forEach(boost));

    return { mods, keyAbility, anyData };
  }

  /* ---------- Hauptfunktion ---------- */

  function derive(raw) {
    const system = raw.system || {};
    const items = raw.items || [];
    const byType = (t) => items.filter((it) => it.type === t);
    const level = Math.max(1, num(get(system, "details.level.value", 1), 1));

    const ancestry = byType("ancestry")[0];
    const heritage = byType("heritage")[0];
    const background = byType("background")[0];
    const classItem = byType("class")[0];
    const deity = byType("deity")[0];
    const classSlug = get(classItem, "system.slug", null);

    const { mods: abilities, keyAbility, anyData } = computeAbilities(system, ancestry, background, classItem, level);

    // Roll-Options für Prädikate
    const options = new Set();
    if (classSlug) options.add(`class:${classSlug}`);
    if (ancestry) options.add(`ancestry:${get(ancestry, "system.slug", "")}`);
    if (heritage) options.add(`heritage:${get(heritage, "system.slug", "")}`);
    byType("feat").forEach((f) => {
      const slug = get(f, "system.slug", null);
      if (!slug) return;
      options.add(`feat:${slug}`);
      if (get(f, "system.category", "") === "classfeature") options.add(`feature:${slug}`);
    });

    // Sanktifizierung (heilig/unheilig) aus dem Gottheits-Merkmal des Champions
    let sanctification = null;
    byType("feat").forEach((f) => {
      (get(f, "system.rules", []) || []).forEach((r) => {
        if (r.key === "ChoiceSet" && r.rollOption === "sanctification" && r.selection) sanctification = r.selection;
      });
    });
    if (sanctification) options.add(`sanctification:${sanctification}`);

    /* --- Kompetenzen aus der Klasse --- */
    const cs = get(classItem, "system", {});
    const prof = {
      perception: num(get(cs, "perception", 0), 0),
      saves: {
        fortitude: num(get(cs, "savingThrows.fortitude", 0), 0),
        reflex: num(get(cs, "savingThrows.reflex", 0), 0),
        will: num(get(cs, "savingThrows.will", 0), 0),
      },
      attacks: {
        simple: num(get(cs, "attacks.simple", 0), 0),
        martial: num(get(cs, "attacks.martial", 0), 0),
        advanced: num(get(cs, "attacks.advanced", 0), 0),
        unarmed: num(get(cs, "attacks.unarmed", 0), 0),
      },
      defenses: {
        unarmored: num(get(cs, "defenses.unarmored", 0), 0),
        light: num(get(cs, "defenses.light", 0), 0),
        medium: num(get(cs, "defenses.medium", 0), 0),
        heavy: num(get(cs, "defenses.heavy", 0), 0),
      },
      classDC: classItem ? 1 : 0,
      spellcasting: num(get(cs, "spellcasting", 0), 0),
      skills: {},
    };

    Object.keys(SKILL_ABILITY).forEach((k) => {
      prof.skills[k] = num(get(system, `skills.${k}.rank`, 0), 0);
    });
    const trainSkill = (k) => {
      if (k in prof.skills) prof.skills[k] = Math.max(prof.skills[k], 1);
    };
    (get(cs, "trainedSkills.value", []) || []).forEach(trainSkill);
    (get(background, "system.trainedSkills.value", []) || []).forEach(trainSkill);
    if (deity && get(deity, "system.category", "deity") === "deity") {
      (get(deity, "system.skill", []) || []).forEach(trainSkill);
    }

    // Ziel-Pfad eines ActiveEffectLike-Regelelements auf das Kompetenzobjekt abbilden
    function applyRankRule(path, mode, value) {
      let m;
      const apply = (obj, key) => {
        if (!(key in obj) && obj !== prof.attacks) return;
        const cur = num(obj[key], 0);
        if (mode === "upgrade") obj[key] = Math.max(cur, value);
        else if (mode === "override") obj[key] = value;
        else if (mode === "add") obj[key] = cur + value;
      };
      if ((m = path.match(/^system\.(?:attributes\.)?perception\.rank$/))) {
        const holder = { v: prof.perception };
        apply(holder, "v");
        prof.perception = holder.v;
      } else if ((m = path.match(/^system\.saves\.(\w+)\.rank$/))) apply(prof.saves, m[1]);
      else if ((m = path.match(/^system\.proficiencies\.attacks\.([\w-]+)\.rank$/))) apply(prof.attacks, m[1]);
      else if ((m = path.match(/^system\.proficiencies\.defenses\.(\w+)\.rank$/))) apply(prof.defenses, m[1]);
      else if ((m = path.match(/^system\.skills\.(\w+)\.rank$/))) apply(prof.skills, m[1]);
      else if (/^system\.(?:proficiencies\.classDCs\.[\w-]+|attributes\.classDC)\.rank$/.test(path)) {
        const holder = { v: prof.classDC };
        apply(holder, "v");
        prof.classDC = holder.v;
      } else if (/^system\.proficiencies\.spellcasting\.rank$/.test(path)) {
        const holder = { v: prof.spellcasting };
        apply(holder, "v");
        prof.spellcasting = holder.v;
      }
    }

    /* --- Regelelemente sammeln --- */
    const ctx = { level };
    const flatMods = []; // { selector, value, type, damageType, sourceId }
    const resistances = [];
    const senses = [];
    const actorTraits = [];

    function isActiveItem(it) {
      const physical = ["weapon", "armor", "shield", "equipment", "consumable", "backpack", "treasure"];
      if (!physical.includes(it.type)) return true;
      const eq = get(it, "system.equipped", {}) || {};
      if (eq.carryType === "dropped" || eq.carryType === "stowed") return false;
      if (get(it, "system.containerId", null)) return false;
      const traits = get(it, "system.traits.value", []) || [];
      if (traits.includes("invested") && eq.invested !== true) return false;
      if (it.type === "armor" && eq.inSlot === false) return false;
      return true;
    }

    items.forEach((it) => {
      if (!isActiveItem(it)) return;
      (get(it, "system.rules", []) || []).forEach((r) => {
        if (!r || r.ignored) return;
        if (r.predicate && !testPredicate(r.predicate, options)) return;
        if (r.key === "ActiveEffectLike" && typeof r.path === "string" && /\.rank$/.test(r.path)) {
          const v = resolveValue(r.value, ctx);
          if (v != null) applyRankRule(r.path, r.mode, v);
        } else if (r.key === "FlatModifier") {
          const v = resolveValue(r.value, ctx);
          if (v == null) return;
          flatMods.push({
            selector: resolveSelection(it, r.selector).replace("{item|_id}", it._id || ""),
            value: v,
            type: r.type || "untyped",
            damageType: r.damageType || null,
          });
        } else if (r.key === "Resistance") {
          const type = resolveSelection(it, r.type);
          const v = resolveValue(r.value, ctx);
          if (type && v != null) resistances.push({ type, value: v });
        } else if (r.key === "Sense") {
          senses.push(r.selector);
        } else if (r.key === "ActorTraits") {
          (r.add || []).forEach((t) => {
            const tr = resolveSelection(it, t);
            if (tr && tr !== "none") actorTraits.push(tr);
          });
        }
      });
    });

    // Boni nach PF2-Stapelregeln addieren: pro Bonustyp zählt nur der höchste,
    // untypisierte Boni addieren sich.
    function sumMods(selectors) {
      const list = flatMods.filter((m) => selectors.includes(m.selector) && !m.damageType);
      const typed = {};
      let total = 0;
      list.forEach((m) => {
        if (m.type === "untyped") total += m.value;
        else if (m.value < 0) total += m.value;
        else typed[m.type] = Math.max(typed[m.type] || 0, m.value);
      });
      return total + Object.values(typed).reduce((a, b) => a + b, 0);
    }

    // Am Actor selbst gespeicherte Waffenkompetenzen (z. B. von Hand gesetzte)
    Object.entries(get(system, "proficiencies.attacks", {}) || {}).forEach(([k, v]) => {
      const r = num(get(v, "rank", 0), 0);
      prof.attacks[k] = Math.max(prof.attacks[k] ?? 0, r);
    });
    // Im Regelwerk steigen einfache Waffen und waffenlose Angriffe bei
    // "Waffenexpertise" & Co. immer mit den Kriegswaffen mit; das Foundry-
    // Regelelement erhöht teils nur "martial". Kein PF2-Grundklassen-Fortschritt
    // stellt Kriegswaffen über einfache Waffen.
    const baseAttacks = get(cs, "attacks", {});
    if (num(baseAttacks.simple, 0) >= num(baseAttacks.martial, 0)) {
      prof.attacks.simple = Math.max(prof.attacks.simple, prof.attacks.martial);
    }
    if (num(baseAttacks.unarmed, 0) >= num(baseAttacks.martial, 0)) {
      prof.attacks.unarmed = Math.max(prof.attacks.unarmed, prof.attacks.martial);
    }

    /* --- Rüstung & Schild --- */
    const armors = byType("armor");
    let armor =
      armors.find((a) => get(a, "system.equipped.inSlot", false) === true) ||
      armors.find((a) => get(a, "system.equipped.inSlot", null) == null && get(a, "system.equipped.carryType", "") === "worn" && num(get(a, "system.acBonus", 0)) > 0) ||
      null;
    const armorCat = armor ? get(armor, "system.category", "unarmored") : "unarmored";
    const armorPotency = armor ? num(get(armor, "system.runes.potency", 0), 0) : 0;
    const armorResilient = armor ? num(get(armor, "system.runes.resilient", 0), 0) : 0;
    const dexCap = armor && get(armor, "system.dexCap", null) != null ? num(get(armor, "system.dexCap"), 99) : 99;
    const strReq = armor ? get(armor, "system.strength", null) : null;
    const meetsStr = strReq == null || abilities.str >= num(strReq, 0);
    const checkPenalty = armor && !meetsStr ? num(get(armor, "system.checkPenalty", 0), 0) : 0;
    let speedPenalty = armor ? num(get(armor, "system.speedPenalty", 0), 0) : 0;
    if (meetsStr && speedPenalty < 0) speedPenalty = Math.min(0, speedPenalty + 5);

    const acItemBonus = Math.max(armorPotency, 0);
    const ac =
      10 +
      Math.min(abilities.dex, dexCap) +
      profBonus(prof.defenses[armorCat] ?? 0, level) +
      (armor ? num(get(armor, "system.acBonus", 0), 0) : 0) +
      acItemBonus +
      sumMods(["ac"]);

    const shieldItem =
      byType("shield").find((s) => get(s, "system.equipped.carryType", "") === "held") || byType("shield")[0] || null;
    const shield = shieldItem
      ? {
          name: shieldItem.name,
          acBonus: num(get(shieldItem, "system.acBonus", 0), 0),
          hardness: num(get(shieldItem, "system.hardness", 0), 0),
          hp: num(get(shieldItem, "system.hp.value", 0), 0),
          maxHp: num(get(shieldItem, "system.hp.max", 0), 0),
          brokenThreshold: Math.floor(num(get(shieldItem, "system.hp.max", 0), 0) / 2),
          held: get(shieldItem, "system.equipped.carryType", "") === "held",
        }
      : null;

    /* --- Trefferpunkte --- */
    const ancestryHp = num(get(ancestry, "system.hp", 0), 0);
    const classHp = num(get(classItem, "system.hp", 0), 0);
    const hpMax =
      ancestryHp +
      (classHp + abilities.con) * level +
      sumMods(["hp"]) +
      sumMods(["hp-per-level"]) * level;

    /* --- Rettungswürfe, Wahrnehmung, Klassen-SG --- */
    const saves = {};
    Object.entries(SAVE_ABILITY).forEach(([key, ab]) => {
      saves[key] = {
        rank: prof.saves[key],
        mod: profBonus(prof.saves[key], level) + abilities[ab] + armorResilient + sumMods([key, "saving-throw"]),
      };
    });
    const perception = {
      rank: prof.perception,
      mod: profBonus(prof.perception, level) + abilities.wis + sumMods(["perception"]),
    };
    const classDC = {
      rank: prof.classDC,
      dc: keyAbility ? 10 + profBonus(prof.classDC, level) + abilities[keyAbility] + sumMods(["class", "class-dc"]) : null,
    };

    /* --- Fertigkeiten --- */
    const skills = {};
    Object.entries(SKILL_ABILITY).forEach(([key, ab]) => {
      let mod = profBonus(prof.skills[key], level) + abilities[ab] + sumMods([key, `${ab}-based`, "skill-check"]);
      if ((ab === "str" || ab === "dex") && checkPenalty) mod += checkPenalty;
      skills[key] = { rank: prof.skills[key], mod };
    });
    const lores = byType("lore").map((it) => {
      const rank = num(get(it, "system.proficient.value", 0), 0);
      return { name: it.name || "Kenntnis", rank, mod: profBonus(rank, level) + abilities.int };
    });

    /* --- Geschwindigkeit --- */
    const baseSpeed = num(get(ancestry, "system.speed", 25), 25);
    const speed = Math.max(5, baseSpeed + speedPenalty + sumMods(["land-speed", "speed", "all-speeds"]));

    /* --- Waffen --- */
    const hasSpec = byType("feat").some((f) => get(f, "system.slug", "") === "weapon-specialization");
    const hasGreaterSpec = byType("feat").some((f) => get(f, "system.slug", "") === "greater-weapon-specialization");
    const deityWeapons = get(deity, "system.weapons", []) || [];

    const attacks = byType("weapon").map((w) => {
      const s = w.system || {};
      const traits = get(s, "traits.value", []) || [];
      let category = get(s, "category", "simple");
      const baseItem = get(s, "baseItem", null) || get(s, "slug", null);
      const deityFavored = deityWeapons.includes(baseItem);
      if (category === "advanced" && deityFavored && options.has("feat:deific-weapon")) category = "martial";
      const rank = prof.attacks[category] ?? 0;
      const isRanged = get(s, "range", null) != null && !traits.some((t) => t.startsWith("thrown"));
      const isFinesse = traits.includes("finesse");
      const attackAbility = isRanged ? abilities.dex : isFinesse ? Math.max(abilities.str, abilities.dex) : abilities.str;
      const potency = num(get(s, "runes.potency", 0), 0);
      const bonus = profBonus(rank, level) + attackAbility + potency + num(get(s, "bonus.value", 0), 0);

      const striking = num(get(s, "runes.striking", 0), 0);
      const dice = num(get(s, "damage.dice", 1), 1) + striking;
      let die = get(s, "damage.die", "");
      if (deityFavored && options.has("feat:deific-weapon") && (category === "simple" || (category === "unarmed" && die === "d4"))) {
        die = { d4: "d6", d6: "d8", d8: "d10", d10: "d12" }[die] || die;
      }
      let dmgBonus = num(get(s, "bonusDamage.value", 0), 0);
      if (!isRanged) dmgBonus += abilities.str;
      else if (traits.includes("propulsive")) dmgBonus += abilities.str > 0 ? Math.floor(abilities.str / 2) : abilities.str;
      if (hasSpec && rank >= 2) dmgBonus += (hasGreaterSpec ? 2 : 1) * (rank === 2 ? 2 : rank === 3 ? 3 : 4);

      const extraDamage = flatMods
        .filter((m) => m.damageType && m.selector === `${w._id}-damage`)
        .map((m) => ({ value: m.value, type: m.damageType }));

      return {
        id: w._id,
        name: w.name,
        bonus,
        agile: traits.includes("agile"),
        isRanged,
        range: get(s, "range", null),
        dice,
        die,
        damageBonus: dmgBonus,
        damageType: get(s, "damage.damageType", ""),
        extraDamage,
        traits: sanctification && sanctification !== "none" ? traits.concat([sanctification]) : traits.slice(),
        carryType: get(s, "equipped.carryType", ""),
      };
    });

    /* --- Zauber --- */
    const spellEntries = byType("spellcastingEntry").map((e) => {
      const ab = get(e, "system.ability.value", "cha");
      const rank = Math.max(num(get(e, "system.proficiency.value", 0), 0), prof.spellcasting);
      const pb = profBonus(rank, level) + (abilities[ab] || 0);
      return { id: e._id, rank, dc: 10 + pb, attack: pb };
    });
    const focusSpells = byType("spell").filter((sp) => (get(sp, "system.traits.value", []) || []).includes("focus"));
    const focusMax = Math.min(3, num(get(system, "resources.focus.max", focusSpells.length), focusSpells.length));

    return {
      hasSourceData: anyData,
      abilities,
      keyAbility,
      hp: { max: hpMax },
      ac,
      armor: armor ? { name: armor.name, category: armorCat, checkPenalty, speedPenalty } : null,
      shield,
      saves,
      perception,
      classDC,
      skills,
      lores,
      speed,
      attacks,
      spellEntries,
      focus: { value: num(get(system, "resources.focus.value", 0), 0), max: focusMax },
      resistances,
      senses,
      traits: Array.from(new Set((get(ancestry, "system.traits.value", []) || []).concat(actorTraits))),
      sanctification,
      size: get(ancestry, "system.size", "med"),
      languages: Array.from(
        new Set((get(ancestry, "system.languages.value", []) || []).concat(get(system, "details.languages.value", []) || []))
      ),
    };
  }

  global.PF2_DERIVE = { derive, testPredicate, resolveSelection };
})(window);
