/*
 * Parser: wandelt ein Foundry-VTT "pf2e"-Actor-Export (type: "character")
 * in ein normalisiertes, sprachneutrales Charaktermodell um.
 *
 * Foundry-Exporte unterscheiden sich je nach Systemversion leicht in ihrer
 * Struktur. Dieser Parser greift daher überall defensiv zu (mehrere
 * mögliche Pfade, Fallback auf 0/"" ) und wirft nie eine Exception wegen
 * eines fehlenden Feldes - stattdessen wird eine Warnung gesammelt.
 */
(function (global) {
  "use strict";

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback ?? 0;
  }

  function get(obj, path, fallback) {
    try {
      const parts = path.split(".");
      let cur = obj;
      for (const p of parts) {
        if (cur == null) return fallback;
        cur = cur[p];
      }
      return cur == null ? fallback : cur;
    } catch (e) {
      return fallback;
    }
  }

  function stripHtml(html) {
    if (!html) return "";
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
  }

  function abilityMod(system, key) {
    // Neuere Systeme: system.abilities.str.mod
    // Ältere Systeme: system.abilities.str.value (war z.T. schon der Modifikator)
    const a = get(system, `abilities.${key}`, {});
    if (a.mod != null) return num(a.mod, 0);
    if (a.value != null) return num(a.value, 0);
    return 0;
  }

  function proficiencyRankOf(node) {
    if (!node) return 0;
    const r = node.rank ?? node.value ?? 0;
    return Math.max(0, Math.min(4, num(r, 0)));
  }

  function parseSkills(system, items, warnings) {
    const out = {};
    const src = get(system, "skills", {});
    Object.keys(global.PF2_I18N.SKILLS).forEach((key) => {
      const node = src[key];
      if (!node) {
        out[key] = { rank: 0, mod: null };
        return;
      }
      out[key] = {
        rank: proficiencyRankOf(node),
        mod: node.mod != null ? num(node.mod, 0) : node.totalModifier != null ? num(node.totalModifier, 0) : null,
      };
    });

    // Lore-Fertigkeiten stecken meist als eigene Items (type "lore"), in
    // manchen Exporten aber auch direkt unter system.skills.<name>-lore.
    const lores = [];
    (items || [])
      .filter((it) => it.type === "lore")
      .forEach((it) => {
        const s = get(it, "system", {});
        const profSrc = s.proficient != null ? s.proficient : s.rank;
        lores.push({
          name: it.name || "Kenntnis",
          rank: proficiencyRankOf(typeof profSrc === "object" ? profSrc : { rank: profSrc }),
          mod: s.mod != null ? (typeof s.mod === "object" ? num(s.mod.value, null) : num(s.mod, null)) : null,
        });
      });
    Object.keys(src).forEach((key) => {
      if (key.endsWith("-lore") || key.endsWith("Lore")) {
        const node = src[key];
        if (node && node.label) {
          lores.push({ name: node.label, rank: proficiencyRankOf(node), mod: node.mod != null ? num(node.mod, null) : null });
        }
      }
    });

    return { skills: out, lores };
  }

  function parseSaves(system) {
    const out = {};
    Object.keys(global.PF2_I18N.SAVES).forEach((key) => {
      const node = get(system, `saves.${key}`, {});
      out[key] = {
        rank: proficiencyRankOf(node),
        mod: node.mod != null ? num(node.mod, null) : node.value != null ? num(node.value, null) : null,
      };
    });
    return out;
  }

  function itemLevel(item) {
    return num(get(item, "system.level.value", get(item, "system.level", 0)), 0);
  }

  function guessFeatCategory(item) {
    const cat = get(item, "system.category", null);
    if (cat) return cat;
    const traits = get(item, "system.traits.value", []) || [];
    if (traits.includes("archetype")) return "archetype";
    return "class";
  }

  function parseFeats(items, warnings) {
    const feats = (items || [])
      .filter((it) => it.type === "feat")
      .map((it) => {
        const s = get(it, "system", {});
        const actionType = get(s, "actionType.value", "passive");
        const actionCount = get(s, "actions.value", null);
        return {
          name: it.name || "Unbenanntes Talent",
          level: itemLevel(it),
          category: guessFeatCategory(it),
          actionType,
          actionCount,
          descriptionHtml: get(s, "description.value", ""),
          description: stripHtml(get(s, "description.value", "")),
          traits: get(s, "traits.value", []) || [],
        };
      });

    const features = (items || [])
      .filter((it) => it.type === "action" && get(it, "system.category", "") !== "attack")
      .map((it) => {
        const s = get(it, "system", {});
        return {
          name: it.name || "Aktion",
          level: itemLevel(it),
          category: "classfeature",
          actionType: get(s, "actionType.value", "passive"),
          actionCount: get(s, "actions.value", null),
          descriptionHtml: get(s, "description.value", ""),
          description: stripHtml(get(s, "description.value", "")),
          traits: get(s, "traits.value", []) || [],
        };
      });

    return feats.concat(features).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "de"));
  }

  function parseAttacks(items) {
    return (items || [])
      .filter((it) => it.type === "weapon")
      .map((it) => {
        const s = get(it, "system", {});
        const dmg = get(s, "damage", {});
        const dice = dmg.dice != null ? dmg.dice : 1;
        const die = dmg.die || "";
        const dmgType = dmg.damageType || "";
        const bonusDmg = num(get(dmg, "bonusDamage.value", 0), 0);
        let dmgStr = die ? `${dice}${die}` : "";
        if (bonusDmg) dmgStr += (dmgStr ? "+" : "") + bonusDmg;
        if (dmgType) dmgStr += dmgStr ? ` ${dmgType}` : dmgType;
        return {
          name: it.name || "Waffe",
          bonus: get(s, "bonus.value", null),
          damage: dmgStr || "—",
          traits: get(s, "traits.value", []) || [],
          equipped: !!get(s, "equipped.value", get(s, "equipped", false)),
        };
      });
  }

  function parseInventory(items) {
    const types = ["armor", "equipment", "consumable", "treasure", "backpack", "weapon"];
    return (items || [])
      .filter((it) => types.includes(it.type))
      .map((it) => {
        const s = get(it, "system", {});
        return {
          name: it.name || "Gegenstand",
          type: it.type,
          quantity: num(get(s, "quantity.value", get(s, "quantity", 1)), 1),
          bulk: get(s, "bulk.value", get(s, "bulk.heldOrStowed", "")),
          equipped: !!get(s, "equipped.value", get(s, "equipped", false)),
          invested: get(s, "equipped.invested.value", null),
        };
      });
  }

  function parseSpells(items) {
    const entries = (items || []).filter((it) => it.type === "spellcastingEntry");
    const spellItems = (items || []).filter((it) => it.type === "spell");
    const spells = spellItems.map((it) => {
      const s = get(it, "system", {});
      return {
        name: it.name || "Zauber",
        level: num(get(s, "level.value", 0), 0),
        traditions: get(s, "traditions.value", []) || [],
        description: stripHtml(get(s, "description.value", "")),
      };
    });
    return {
      entries: entries.map((e) => ({
        name: e.name,
        tradition: get(e, "system.tradition.value", ""),
        dc: get(e, "system.spelldc.dc", null),
        attack: get(e, "system.spelldc.value", null),
        focusPoints: get(e, "system.focus.points", null),
      })),
      spells: spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "de")),
    };
  }

  function parseCurrency(items) {
    const treasure = (items || []).filter((it) => it.type === "treasure" && get(it, "system.stackGroup", "") === "coins");
    const out = { pp: 0, gp: 0, sp: 0, cp: 0 };
    treasure.forEach((it) => {
      const denom = (it.name || "").toLowerCase();
      const q = num(get(it, "system.quantity.value", get(it, "system.quantity", 0)), 0);
      if (denom.includes("platin")) out.pp += q;
      else if (denom.includes("gold")) out.gp += q;
      else if (denom.includes("silber")) out.sp += q;
      else if (denom.includes("kupfer")) out.cp += q;
    });
    return out;
  }

  function findItemsByType(items, type) {
    return (items || []).filter((it) => it.type === type);
  }

  function parseFoundryActor(raw) {
    const warnings = [];
    if (!raw || typeof raw !== "object") {
      throw new Error("Die Datei enthält kein gültiges JSON-Objekt.");
    }
    if (raw.type && raw.type !== "character") {
      warnings.push(`Achtung: Der Actor-Typ ist "${raw.type}", erwartet wurde "character". Es wird trotzdem versucht, die Daten zu lesen.`);
    }

    const system = raw.system || raw.data || {};
    const items = raw.items || [];

    const ancestryItem = findItemsByType(items, "ancestry")[0];
    const heritageItem = findItemsByType(items, "heritage")[0];
    const backgroundItem = findItemsByType(items, "background")[0];
    const classItem = findItemsByType(items, "class")[0];
    const deityItem = findItemsByType(items, "deity")[0];

    if (!classItem) warnings.push("Keine Klasse (Item vom Typ „class“) im Export gefunden.");
    if (!ancestryItem) warnings.push("Kein Volk (Item vom Typ „ancestry“) im Export gefunden.");

    const abilities = {};
    Object.keys(global.PF2_I18N.ABILITIES).forEach((key) => {
      abilities[key] = abilityMod(system, key);
    });

    const { skills, lores } = parseSkills(system, items, warnings);
    const saves = parseSaves(system);

    const perceptionNode = get(system, "attributes.perception", {});
    const perception = {
      rank: proficiencyRankOf(perceptionNode),
      mod: perceptionNode.mod != null ? num(perceptionNode.mod, null) : null,
    };

    const classDcNode = get(system, "attributes.classDC", get(system, "attributes.classdc", {}));
    const classDC = {
      rank: proficiencyRankOf(classDcNode),
      mod: classDcNode.value != null ? num(classDcNode.value, null) : null,
    };

    const speedNode = get(system, "attributes.speed", {});
    const otherSpeeds = (get(speedNode, "otherSpeeds", []) || []).map((s) => ({
      type: s.type || "",
      value: num(s.value, 0),
    }));

    const model = {
      warnings,
      meta: {
        name: raw.name || "Unbenannter Charakter",
        player: get(raw, "prototypeToken.name", "") ,
        level: num(get(system, "details.level.value", 1), 1),
        ancestry: ancestryItem ? ancestryItem.name : get(system, "details.ancestry.name", ""),
        heritage: heritageItem ? heritageItem.name : "",
        background: backgroundItem ? backgroundItem.name : "",
        className: classItem ? classItem.name : get(system, "details.class.name", ""),
        deity: deityItem ? deityItem.name : get(system, "details.deity.value", ""),
        alignment: get(system, "details.alignment.value", ""),
        size: get(raw, "system.traits.size.value", get(system, "traits.size.value", "med")),
        traits: get(system, "traits.value", []) || [],
        languages: get(system, "traits.languages.value", []) || [],
        age: get(system, "details.age.value", ""),
        gender: get(system, "details.gender.value", ""),
        heroPoints: num(get(system, "resources.heroPoints.value", get(system, "attributes.heroPoints.value", 0)), 0),
        heroPointsMax: num(get(system, "resources.heroPoints.max", get(system, "attributes.heroPoints.max", 3)), 3),
      },
      abilities,
      hp: {
        value: num(get(system, "attributes.hp.value", 0), 0),
        max: num(get(system, "attributes.hp.max", 0), 0),
        temp: num(get(system, "attributes.hp.temp", 0), 0),
      },
      ac: num(get(system, "attributes.ac.value", 10), 10),
      saves,
      perception,
      classDC,
      speed: {
        value: num(get(speedNode, "value", 25), 25),
        others: otherSpeeds,
      },
      skills,
      lores,
      feats: parseFeats(items, warnings),
      attacks: parseAttacks(items),
      inventory: parseInventory(items),
      spellcasting: parseSpells(items),
      currency: parseCurrency(items),
      resistances: (get(system, "attributes.resistances", []) || []).map((r) => ({ type: r.type, value: r.value })),
      weaknesses: (get(system, "attributes.weaknesses", []) || []).map((r) => ({ type: r.type, value: r.value })),
      immunities: (get(system, "attributes.immunities", []) || []).map((r) => (typeof r === "string" ? { type: r } : { type: r.type })),
      conditions: (items || [])
        .filter((it) => it.type === "condition" && get(it, "system.active", true))
        .map((it) => ({ name: it.name, value: get(it, "system.value.value", null) })),
    };

    if (model.abilities.str === 0 && model.abilities.dex === 0 && model.abilities.con === 0) {
      warnings.push("Alle Attributs-Modifikatoren sind 0 – bitte prüfen, ob die Datei ein vollständiger Foundry-Charakterexport ist.");
    }

    return model;
  }

  global.PF2_PARSER = { parseFoundryActor };
})(window);
