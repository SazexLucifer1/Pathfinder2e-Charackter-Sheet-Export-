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

  // Foundry-"Enricher" (z. B. @UUID[...]{Name}, @Check[...], [[/r 1d6]]) in Lesetext umwandeln.
  function cleanEnrichers(text) {
    return String(text)
      .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, "$1")
      .replace(/@Check\[([^\]]*)\]/g, (_, inner) => {
        const parts = inner.split("|");
        const type = (parts[0].replace(/^type:/, "") || "").trim();
        const dc = parts.map((p) => p.match(/^dc:(\d+)/)).find(Boolean);
        const name = (global.PF2_I18N.SKILLS[type] || global.PF2_I18N.SAVES[type] || {}).name || type;
        return dc ? `${name} (SG ${dc[1]})` : name;
      })
      .replace(/@Damage\[((?:[^\[\]]|\[[^\[\]]*\])*)\](?:\{([^}]*)\})?/g, (_, inner, label) => {
        if (label) return label;
        return inner
          .replace(/\|.*$/, "")
          .replace(/\[([\w,-]+)\]/g, (m, t) => " " + t.split(",").map((x) => global.PF2_I18N.damageTypeName(x)).join(", "))
          .replace(/[()]/g, "")
          .replace(/(\d)d(\d)/g, "$1W$2");
      })
      .replace(/@Template\[[^\]]*?(\w+)\|distance:(\d+)[^\]]*\]/g, "$2-Fuß-$1")
      .replace(/@\w+\[[^\]]*\]/g, "")
      .replace(/\[\[\/\w+\s+([^\]]*)\]\](?:\{([^}]*)\})?/g, (_, f, label) => label || f);
  }

  function stripHtml(html) {
    if (!html) return "";
    const div = document.createElement("div");
    div.innerHTML = html;
    return cleanEnrichers(div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
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
          level: get(s, "level.taken", null) != null ? num(get(s, "level.taken"), itemLevel(it)) : itemLevel(it),
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
          category: get(it, "flags.pf2e.grantedBy", null) ? "classfeature" : "action",
          actionType: get(s, "actionType.value", "passive"),
          actionCount: get(s, "actions.value", null),
          descriptionHtml: get(s, "description.value", ""),
          description: stripHtml(get(s, "description.value", "")),
          traits: get(s, "traits.value", []) || [],
        };
      });

    // Klassenmerkmale wie "Shield Block", die nur das gleichnamige Talent gewähren, nicht doppelt aufführen
    const deduped = feats.filter(
      (f) => !(f.category === "classfeature" && feats.some((g) => g !== f && g.category !== "classfeature" && g.name === f.name))
    );
    return deduped.concat(features).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "de"));
  }

  function dieDe(die) {
    return String(die || "").replace(/^d/, "W");
  }

  function formatDamage(dice, die, bonus, type, extras) {
    const I = global.PF2_I18N;
    if (!die) return "—";
    let str = `${dice}${dieDe(die)}`;
    if (bonus) str += bonus > 0 ? `+${bonus}` : `${bonus}`;
    if (type) str += ` ${I.damageTypeName(type)}`;
    (extras || []).forEach((e) => {
      str += ` + ${e.value} ${I.damageTypeName(e.type)}`;
    });
    return str;
  }

  function mapString(bonus, agile) {
    if (bonus == null) return null;
    const step = agile ? 4 : 5;
    const f = (n) => (n >= 0 ? `+${n}` : `${n}`);
    return `${f(bonus)} / ${f(bonus - step)} / ${f(bonus - 2 * step)}`;
  }

  function parseAttacks(items, derivedAttacks) {
    const derivedById = new Map((derivedAttacks || []).map((a) => [a.id, a]));
    const carryOrder = { held: 0, worn: 1, stowed: 2, dropped: 3 };
    return (items || [])
      .filter((it) => it.type === "weapon")
      .map((it) => {
        const s = get(it, "system", {});
        const d = derivedById.get(it._id);
        const explicitBonus = get(s, "bonus.value", null);
        // In echten Foundry-Exporten ist bonus.value nur ein manueller Zusatzbonus (meist 0),
        // nicht der Gesamt-Angriffsbonus – dann wird der berechnete Wert verwendet.
        const hasDerivedNumbers = d && d.die;
        const bonus = hasDerivedNumbers ? d.bonus : explicitBonus;
        const agile = (get(s, "traits.value", []) || []).includes("agile");
        let damage;
        if (hasDerivedNumbers) {
          damage = formatDamage(d.dice, d.die, d.damageBonus, d.damageType, d.extraDamage);
        } else {
          const dmg = get(s, "damage", {});
          damage = formatDamage(dmg.dice != null ? dmg.dice : 1, dmg.die, num(get(s, "bonusDamage.value", 0), 0), dmg.damageType);
        }
        const traits = (d ? d.traits : get(s, "traits.value", []) || []).map((t) => global.PF2_I18N.traitName(t));
        const range = get(s, "range", null);
        if (range != null && !(get(s, "traits.value", []) || []).some((t) => t.startsWith("thrown"))) {
          traits.unshift(`Grundreichweite ${range} Fuß`);
        }
        return {
          name: it.name || "Waffe",
          bonus,
          bonusMap: mapString(bonus, agile),
          damage,
          traits,
          ranged: d ? d.isRanged : range != null,
          carryType: get(s, "equipped.carryType", ""),
        };
      })
      .sort((a, b) => (carryOrder[a.carryType] ?? 9) - (carryOrder[b.carryType] ?? 9));
  }

  function carryLabel(it, containers) {
    const eq = get(it, "system.equipped", {}) || {};
    const containerId = get(it, "system.containerId", null);
    if (containerId) {
      const c = containers.get(containerId);
      return `In: ${c ? c.name : "Behälter"}`;
    }
    const traits = get(it, "system.traits.value", []) || [];
    switch (eq.carryType) {
      case "held":
        return eq.handsHeld ? `In der Hand (${eq.handsHeld})` : "In der Hand";
      case "worn":
        if (it.type === "armor") return eq.inSlot === false ? "Mitgeführt" : "Angelegt";
        if (traits.includes("invested")) return eq.invested ? "Getragen (investiert)" : "Getragen (nicht investiert)";
        return it.type === "equipment" && get(it, "system.usage.value", "") === "worn" ? "Getragen" : "Am Körper";
      case "stowed":
        return "Verstaut";
      case "dropped":
        return "Abgelegt";
      default:
        return get(it, "system.equipped.value", false) ? "Angelegt" : "—";
    }
  }

  function bulkLabel(b) {
    if (b === "" || b == null) return "—";
    const n = Number(b);
    if (!Number.isFinite(n)) return String(b);
    if (n === 0) return "—";
    if (n > 0 && n < 1) return "L";
    return String(n);
  }

  function parseInventory(items) {
    const types = ["armor", "equipment", "consumable", "treasure", "backpack", "weapon", "shield", "ammo", "book"];
    const containers = new Map((items || []).filter((it) => it.type === "backpack").map((it) => [it._id, it]));
    return (items || [])
      .filter((it) => types.includes(it.type))
      .filter((it) => !(it.type === "treasure" && get(it, "system.category", "") === "coin"))
      .map((it) => {
        const s = get(it, "system", {});
        const rawBulk = get(s, "bulk.value", get(s, "bulk.heldOrStowed", ""));
        const bulk = typeof rawBulk === "object" ? "" : rawBulk;
        return {
          id: it._id,
          name: it.name || "Gegenstand",
          type: it.type,
          quantity: num(get(s, "quantity.value", get(s, "quantity", 1)), 1),
          bulk,
          bulkLabel: bulkLabel(bulk),
          stackSize: Math.max(1, num(get(s, "price.per", 1), 1)),
          containerId: get(s, "containerId", null),
          carry: carryLabel(it, containers),
          equipped: !!get(s, "equipped.value", false),
        };
      })
      .sort((a, b) => (a.containerId ? 1 : 0) - (b.containerId ? 1 : 0));
  }

  // Gesamttraglast nach PF2-Regeln: 10 leichte (L) Gegenstände = 1 Traglast;
  // Behälter wie ein Rucksack ignorieren einen Teil ihres Inhalts.
  function computeBulk(items, inventory, coinsTotal) {
    let light = 0; // Anzahl L-Einheiten
    let bulk = 0;
    const containerContents = new Map();
    inventory.forEach((it) => {
      const per = Number(it.bulk) || 0;
      if (!per) return;
      const units = it.quantity / (it.stackSize || 1);
      const amount = per * Math.ceil(units);
      if (it.containerId) containerContents.set(it.containerId, (containerContents.get(it.containerId) || 0) + amount);
      else if (per < 1) light += Math.ceil(units);
      else bulk += amount;
    });
    // Behälter selbst (getragen: bulk.value, sonst heldOrStowed) wurden oben über bulk.value erfasst.
    containerContents.forEach((amount, id) => {
      const c = (items || []).find((x) => x._id === id);
      const ignored = num(get(c, "system.bulk.ignored", 0), 0);
      const rest = Math.max(0, amount - ignored);
      const whole = Math.floor(rest);
      bulk += whole;
      light += Math.round((rest - whole) * 10);
    });
    bulk += Math.floor(light / 10) + Math.floor(coinsTotal / 1000);
    return { bulk, light: light % 10 };
  }

  function parseSpells(items, derived, level) {
    const entries = (items || []).filter((it) => it.type === "spellcastingEntry");
    const spellItems = (items || []).filter((it) => it.type === "spell");
    const derivedById = new Map(((derived && derived.spellEntries) || []).map((e) => [e.id, e]));
    const entryById = new Map(entries.map((e) => [e._id, e]));
    const heightenTo = Math.ceil(level / 2);
    const spells = spellItems.map((it) => {
      const s = get(it, "system", {});
      const traits = get(s, "traits.value", []) || [];
      const entry = entryById.get(get(s, "location.value", null));
      const isFocus = traits.includes("focus");
      const isCantrip = traits.includes("cantrip");
      let traditions = get(s, "traits.traditions", get(s, "traditions.value", [])) || [];
      if (!traditions.length && entry) traditions = [get(entry, "system.tradition.value", "")].filter(Boolean);
      return {
        name: it.name || "Zauber",
        level: num(get(s, "level.value", 0), 0),
        rankLabel: isCantrip ? `Trick (Grad ${heightenTo})` : isFocus ? `Fokus (Grad ${heightenTo})` : String(num(get(s, "level.value", 0), 0)),
        actions: get(s, "time.value", ""),
        range: get(s, "range.value", ""),
        traditions: traditions.map((t) => TRADITIONS[t] || t),
        description: stripHtml(get(s, "description.value", "")),
      };
    });
    return {
      entries: entries.map((e) => {
        const d = derivedById.get(e._id);
        const dcRaw = num(get(e, "system.spelldc.dc", 0), 0);
        const atkRaw = num(get(e, "system.spelldc.value", 0), 0);
        return {
          name: e.name,
          tradition: TRADITIONS[get(e, "system.tradition.value", "")] || get(e, "system.tradition.value", ""),
          ability: get(e, "system.ability.value", ""),
          dc: dcRaw ? dcRaw : d ? d.dc : null,
          attack: atkRaw ? atkRaw : d ? d.attack : null,
          rank: d ? d.rank : num(get(e, "system.proficiency.value", 0), 0),
          isFocus: get(e, "system.prepared.value", "") === "focus",
          focusPoints: get(e, "system.focus.points", null),
        };
      }),
      spells: spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "de")),
    };
  }

  const TRADITIONS = { arcane: "Arkan", divine: "Göttlich", occult: "Okkult", primal: "Primal" };

  function parseCurrency(items) {
    const coins = (items || []).filter(
      (it) => it.type === "treasure" && (get(it, "system.category", "") === "coin" || get(it, "system.stackGroup", "") === "coins")
    );
    const out = { pp: 0, gp: 0, sp: 0, cp: 0 };
    coins.forEach((it) => {
      const q = num(get(it, "system.quantity.value", get(it, "system.quantity", 0)), 0);
      const priceKeys = Object.keys(get(it, "system.price.value", {}) || {});
      let denom = priceKeys.length === 1 ? priceKeys[0] : null;
      if (!denom) {
        const n = (it.name || "").toLowerCase();
        if (n.includes("platin")) denom = "pp";
        else if (n.includes("gold")) denom = "gp";
        else if (n.includes("silber") || n.includes("silver")) denom = "sp";
        else if (n.includes("kupfer") || n.includes("copper")) denom = "cp";
      }
      if (denom && denom in out) out[denom] += q;
    });
    return out;
  }

  function findItemsByType(items, type) {
    return (items || []).filter((it) => it.type === type);
  }

  function pick(explicit, derived) {
    return explicit != null ? explicit : derived;
  }

  function parseFoundryActor(raw) {
    const warnings = [];
    const notes = [];
    if (!raw || typeof raw !== "object") {
      throw new Error("Die Datei enthält kein gültiges JSON-Objekt.");
    }
    if (raw.type && raw.type !== "character") {
      warnings.push(`Achtung: Der Actor-Typ ist "${raw.type}", erwartet wurde "character". Es wird trotzdem versucht, die Daten zu lesen.`);
    }

    const I = global.PF2_I18N;
    const system = raw.system || raw.data || {};
    const items = raw.items || [];

    const ancestryItem = findItemsByType(items, "ancestry")[0];
    const heritageItem = findItemsByType(items, "heritage")[0];
    const backgroundItem = findItemsByType(items, "background")[0];
    const classItem = findItemsByType(items, "class")[0];
    const deityItem = findItemsByType(items, "deity")[0];

    if (!classItem) warnings.push("Keine Klasse (Item vom Typ „class“) im Export gefunden.");
    if (!ancestryItem) warnings.push("Kein Volk (Item vom Typ „ancestry“) im Export gefunden.");

    const level = num(get(system, "details.level.value", 1), 1);
    const derived = global.PF2_DERIVE.derive(raw);

    // Hat der Export bereits berechnete Werte (z. B. aus einem Modul oder älteren Versionen)?
    const hasExplicitAbilities = Object.keys(I.ABILITIES).some((k) => {
      const a = get(system, `abilities.${k}`, null);
      return a && (a.mod != null || a.value != null);
    });

    const abilities = {};
    Object.keys(I.ABILITIES).forEach((key) => {
      abilities[key] = hasExplicitAbilities ? abilityMod(system, key) : derived.abilities[key];
    });
    const usedDerived = !hasExplicitAbilities && derived.hasSourceData;

    const parsedSkills = parseSkills(system, items, warnings);
    const skills = {};
    Object.keys(I.SKILLS).forEach((key) => {
      const ex = parsedSkills.skills[key] || { rank: 0, mod: null };
      const dv = derived.skills[key] || { rank: 0, mod: null };
      const rank = Math.max(ex.rank, usedDerived ? dv.rank : 0);
      skills[key] = { rank, mod: pick(ex.mod, usedDerived ? dv.mod : null) };
    });
    const lores = usedDerived
      ? derived.lores
      : parsedSkills.lores.map((l) => ({ ...l, mod: l.mod === 0 ? null : l.mod }));

    const explicitSaves = parseSaves(system);
    const saves = {};
    Object.keys(I.SAVES).forEach((key) => {
      const ex = explicitSaves[key];
      const dv = derived.saves[key];
      saves[key] = ex.mod != null || ex.rank ? ex : usedDerived ? dv : ex;
    });

    const perceptionNode = get(system, "attributes.perception", get(system, "perception", {})) || {};
    let perception = {
      rank: proficiencyRankOf(perceptionNode),
      mod: perceptionNode.mod != null ? num(perceptionNode.mod, null) : null,
    };
    if (perception.mod == null && !perception.rank && usedDerived) perception = derived.perception;

    const classDcNode = get(system, "attributes.classDC", get(system, "attributes.classdc", null));
    let classDC = classDcNode
      ? { rank: proficiencyRankOf(classDcNode), dc: classDcNode.value != null ? num(classDcNode.value, null) : classDcNode.dc != null ? num(classDcNode.dc, null) : null }
      : { rank: 0, dc: null };
    if (classDC.dc == null && usedDerived) classDC = derived.classDC;

    const speedNode = get(system, "attributes.speed", {});
    const otherSpeeds = (get(speedNode, "otherSpeeds", []) || []).map((s) => ({
      type: s.type || "",
      value: num(s.value, 0),
    }));

    const hpMaxExplicit = get(system, "attributes.hp.max", null);
    const acExplicit = get(system, "attributes.ac.value", null);

    const sizeKey = get(system, "traits.size.value", null) || derived.size || "med";
    const explicitLanguages = get(system, "traits.languages.value", null);
    const languages = (explicitLanguages && explicitLanguages.length ? explicitLanguages : derived.languages).map(
      (l) => I.LANGUAGES[l] || l
    );
    const explicitTraits = get(system, "traits.value", null);
    const traits = (explicitTraits && explicitTraits.length ? explicitTraits : derived.traits).map((t) => I.traitName(t));

    const ancestrySlug = get(ancestryItem, "system.slug", "");
    const classSlug = get(classItem, "system.slug", "");

    const inventory = parseInventory(items);
    const currency = parseCurrency(items);
    const coinsTotal = currency.pp + currency.gp + currency.sp + currency.cp;
    const totalBulk = computeBulk(items, inventory, coinsTotal);

    const explicitResist = get(system, "attributes.resistances", null);

    const model = {
      warnings,
      notes,
      meta: {
        name: raw.name || "Unbenannter Charakter",
        player: "",
        level,
        ancestry: ancestryItem ? I.ANCESTRIES[ancestrySlug] || ancestryItem.name : get(system, "details.ancestry.name", ""),
        heritage: heritageItem ? heritageItem.name : "",
        background: backgroundItem ? backgroundItem.name : "",
        className: classItem ? I.CLASSES[classSlug] || classItem.name : get(system, "details.class.name", ""),
        deity: deityItem ? deityItem.name : get(system, "details.deity.value", ""),
        alignment: get(system, "details.alignment.value", "") || I.SANCTIFICATION[derived.sanctification] || "",
        alignmentLabel: get(system, "details.alignment.value", "") ? "Gesinnung" : "Weihe",
        size: I.SIZES[sizeKey] || sizeKey,
        traits,
        languages,
        senses: (derived.senses || []).map((s) => I.SENSES[s] || s),
        age: get(system, "details.age.value", ""),
        gender: String(get(system, "details.gender.value", "")).trim(),
        heroPoints: num(get(system, "resources.heroPoints.value", get(system, "attributes.heroPoints.value", 0)), 0),
        heroPointsMax: num(get(system, "resources.heroPoints.max", get(system, "attributes.heroPoints.max", 3)), 3),
        xp: get(system, "details.xp.value", null),
        keyAbility: derived.keyAbility,
      },
      abilities,
      hp: {
        value: num(get(system, "attributes.hp.value", 0), 0),
        max: hpMaxExplicit != null ? num(hpMaxExplicit, 0) : usedDerived ? derived.hp.max : 0,
        temp: num(get(system, "attributes.hp.temp", 0), 0),
      },
      ac: acExplicit != null ? num(acExplicit, 10) : usedDerived ? derived.ac : 10,
      armor: derived.armor,
      shield: derived.shield,
      saves,
      perception,
      classDC,
      speed: {
        value: speedNode.value != null ? num(speedNode.value, 25) : usedDerived ? derived.speed : 25,
        others: otherSpeeds,
      },
      skills,
      lores,
      feats: parseFeats(items, warnings),
      attacks: parseAttacks(items, usedDerived ? derived.attacks : null),
      inventory,
      totalBulk,
      bulkLimits: { encumbered: 5 + abilities.str, max: 10 + abilities.str },
      spellcasting: parseSpells(items, usedDerived ? derived : null, level),
      focus: usedDerived ? derived.focus : null,
      currency,
      resistances: (explicitResist && explicitResist.length ? explicitResist : derived.resistances).map((r) => ({
        type: I.damageTypeName(r.type),
        value: r.value,
      })),
      weaknesses: (get(system, "attributes.weaknesses", []) || []).map((r) => ({ type: I.damageTypeName(r.type), value: r.value })),
      immunities: (get(system, "attributes.immunities", []) || []).map((r) => (typeof r === "string" ? { type: r } : { type: r.type })),
      conditions: (items || [])
        .filter((it) => it.type === "condition" && get(it, "system.active", true))
        .map((it) => ({ name: it.name, value: get(it, "system.value.value", null) })),
    };

    if (usedDerived) {
      notes.push(
        "Foundry speichert beim Export nur die Grunddaten. Attribute, TP, RK, Rettungswürfe, Fertigkeiten, Angriffe und Zauber-SG wurden daraus nach den PF2-Regeln berechnet. Situative Boni (z. B. Umstandsboni, aktive Effekte, erhobener Schild) sind nicht eingerechnet – im Zweifel mit dem Foundry-Bogen vergleichen."
      );
      const notInvested = items.filter(
        (it) => (get(it, "system.traits.value", []) || []).includes("invested") && get(it, "system.equipped.invested", null) !== true
      );
      if (notInvested.length) {
        notes.push(
          `Nicht investiert (deren Boni sind daher nicht eingerechnet): ${notInvested.map((i) => i.name).join(", ")}. In Foundry investierte Gegenstände werden automatisch berücksichtigt.`
        );
      }
    }

    if (model.abilities.str === 0 && model.abilities.dex === 0 && model.abilities.con === 0 && !derived.hasSourceData) {
      warnings.push("Alle Attributs-Modifikatoren sind 0 – bitte prüfen, ob die Datei ein vollständiger Foundry-Charakterexport ist.");
    }

    return model;
  }

  global.PF2_PARSER = { parseFoundryActor };
})(window);
