/*
 * Deutsche Begriffe für Pathfinder 2. Edition.
 * Quelle der Fachbegriffe: offizielle deutsche Regel-Terminologie
 * (Ulisses Spiele / prd.pathfinder2e.de / wiki.pathfinder2.de).
 * Maßeinheiten (Fuß, Pfund) bleiben bewusst im englischen (imperialen)
 * System, wie im deutschen Regelwerk üblich – nur die Bezeichnung ist
 * eingedeutscht ("Fuß" statt "ft", aber keine Umrechnung in Meter).
 */
(function (global) {
  "use strict";

  const ABILITIES = {
    str: { key: "str", name: "Stärke", short: "ST" },
    dex: { key: "dex", name: "Geschicklichkeit", short: "GE" },
    con: { key: "con", name: "Konstitution", short: "KO" },
    int: { key: "int", name: "Intelligenz", short: "IN" },
    wis: { key: "wis", name: "Weisheit", short: "WE" },
    cha: { key: "cha", name: "Charisma", short: "CH" },
  };

  const SAVES = {
    fortitude: { key: "fortitude", name: "Zähigkeit", ability: "con" },
    reflex: { key: "reflex", name: "Reflex", ability: "dex" },
    will: { key: "will", name: "Willen", ability: "wis" },
  };

  // Reihenfolge entspricht dem klassischen Charakterbogen-Layout.
  const SKILLS = {
    acrobatics: { name: "Akrobatik", ability: "dex" },
    arcana: { name: "Arkane Künste", ability: "int" },
    athletics: { name: "Athletik", ability: "str" },
    crafting: { name: "Handwerkskunst", ability: "int" },
    deception: { name: "Täuschung", ability: "cha" },
    diplomacy: { name: "Diplomatie", ability: "cha" },
    intimidation: { name: "Einschüchtern", ability: "cha" },
    medicine: { name: "Heilkunde", ability: "wis" },
    nature: { name: "Naturkunde", ability: "wis" },
    occultism: { name: "Okkultismus", ability: "int" },
    performance: { name: "Darbietung", ability: "cha" },
    religion: { name: "Religionskunde", ability: "wis" },
    society: { name: "Gesellschaftskunde", ability: "int" },
    stealth: { name: "Heimlichkeit", ability: "dex" },
    survival: { name: "Überlebenskunst", ability: "wis" },
    thievery: { name: "Diebeskunst", ability: "dex" },
  };

  const PERCEPTION = { name: "Wahrnehmung", ability: "wis" };

  // Kompetenzgrade (proficiency ranks). Bonus = Stufe + 2*Rang (0 = ungeübt -> +0, kein Level-Bonus).
  const PROFICIENCY_RANKS = [
    { value: 0, name: "Ungeübt", short: "U", bonus: (lvl) => 0 },
    { value: 1, name: "Geübt", short: "G", bonus: (lvl) => lvl + 2 },
    { value: 2, name: "Experte", short: "E", bonus: (lvl) => lvl + 4 },
    { value: 3, name: "Meister", short: "M", bonus: (lvl) => lvl + 6 },
    { value: 4, name: "Legende", short: "L", bonus: (lvl) => lvl + 8 },
  ];

  function proficiencyName(rank) {
    const r = PROFICIENCY_RANKS[rank] || PROFICIENCY_RANKS[0];
    return r.name;
  }

  // Aktionstypen / Handlungssymbole
  const ACTION_TYPES = {
    action: { name: "Aktion", symbol: "◆" },
    reaction: { name: "Reaktion", symbol: "⤾" },
    free: { name: "Freie Aktion", symbol: "◇" },
    passive: { name: "Passiv", symbol: "—" },
  };

  function actionSymbol(actionType, count) {
    if (actionType === "reaction") return "⤾";
    if (actionType === "free") return "◇";
    if (actionType === "passive" || !actionType) return "—";
    const n = Number(count) || 1;
    return "◆".repeat(Math.min(Math.max(n, 1), 3));
  }

  // Talent-/Herkunftskategorien (Feats)
  const FEAT_CATEGORIES = {
    ancestry: "Volkstalent",
    heritage: "Erbe",
    class: "Klassentalent",
    classfeature: "Klassenmerkmal",
    skill: "Fertigkeitstalent",
    general: "Allgemeines Talent",
    archetype: "Archetyp-Talent",
    background: "Hintergrund",
    bonus: "Bonustalent",
    familiar: "Vertrauten-Fähigkeit",
    ancestryfeature: "Volksmerkmal",
    calling: undefined,
  };

  function featCategoryName(category) {
    return FEAT_CATEGORIES[category] || "Talent";
  }

  /*
   * Zustände (Conditions). Beschreibungen sind eigene, knappe
   * Zusammenfassungen (keine wörtliche Wiedergabe des Regeltexts) und
   * dienen als Gedächtnisstütze auf dem Bogen – für den vollen Wortlaut
   * gilt weiterhin das Regelwerk.
   * value: true => Zustand hat eine Wertstufe (z.B. "Verängstigt 2")
   */
  const CONDITIONS = [
    { name: "Angeschlagen", value: true, text: "Malus auf Wahrnehmung, Rettungswürfe und Fertigkeitswürfe nach kritischen Treffern (Beginner-Box-Variante)." },
    { name: "Auf dem falschen Fuß", value: false, text: "Du kannst dich nicht richtig verteidigen: -2 auf die RK gegen die auslösende Quelle." },
    { name: "Ausgelaugt", value: true, text: "Reduziert deine maximalen TP um das Fünffache des Wertes, bis der Zustand endet." },
    { name: "Belastet", value: false, text: "Du trägst zu viel Gewicht: -10 Fuß Geschwindigkeit, Unbeholfen 1." },
    { name: "Benommen", value: true, text: "Malus auf geistige Aktionen; bei hohem Wert können evtl. keine Zauber gewirkt werden." },
    { name: "Betäubt", value: true, text: "Du kannst keine Aktionen einsetzen; verlierst Aktionen in Höhe des Wertes." },
    { name: "Bewegungsunfähig", value: false, text: "Du kannst dich nicht bewegen; Bewegungs-Aktionen schlagen automatisch fehl." },
    { name: "Bewusstlos", value: false, text: "Du bist ohnmächtig, liegend und kannst nicht handeln; -4 auf RK, Reflex und Wahrnehmung." },
    { name: "Blind", value: false, text: "Du kannst nicht sehen: alle Ziele gelten als unbemerkt, Bewegung nur zur Hälfte." },
    { name: "Blutung", value: true, text: "Anhaltender Schaden durch Blutverlust in Höhe des Wertes, bis behandelt oder gestillt." },
    { name: "Eingeschüchtert", value: true, text: "Malus auf Angriffs- und Fertigkeitswürfe in Höhe des Wertes; sinkt meist am Ende deines Zuges." },
    { name: "Entkräftet", value: true, text: "Reduziert deine Traglast/Belastungsgrenze um den Wert." },
    { name: "Ergriffen", value: false, text: "Von einer Kreatur oder Wirkung festgehalten: Bewegungsunfähig und Auf dem falschen Fuß." },
    { name: "Erschöpft", value: false, text: "Du brauchst mehr Ruhe: -1 auf RK, Rettungswürfe, Fertigkeitswürfe, Wahrnehmung und Angriffswürfe." },
    { name: "Erschüttert", value: false, text: "Emotionale Erschütterung – oft an eine konkrete Bedingung im Auslöser gekoppelt." },
    { name: "Fasziniert", value: false, text: "Du bist abgelenkt: -2 auf Wahrnehmung und fertigkeitsbasierte Aktionen, keine Konzentrations-Aktionen gegen andere Ziele." },
    { name: "Festgehalten", value: false, text: "Wie Ergriffen, zusätzlich kannst du keine Manipulieren-Aktionen mit Handbewegung ausführen." },
    { name: "Geblendet", value: false, text: "Alles ist stark verschwommen: Ziele gelten als verborgen, kein Wahrnehmungsvorteil durch Sehen." },
    { name: "Gelähmt", value: false, text: "Dein Körper ist erstarrt: Auf dem falschen Fuß und kannst nicht handeln (außer geistigen Aktionen ohne Bewegung)." },
    { name: "Geschwächt", value: true, text: "Malus auf kraftbasierte Würfe und SG (Nahkampf, Schaden, Athletik) in Höhe des Wertes." },
    { name: "Immun", value: false, text: "Du wirst von einem bestimmten Effekt, Zustand oder Schadenstyp nicht beeinflusst." },
    { name: "In Panik", value: false, text: "Du musst dich von der Angstquelle entfernen, sonst Rückzug (Fluchten) als einzig mögliche Bewegung." },
    { name: "Kampfunfähig", value: false, text: "Du kannst nicht handeln, keine Bewegung; z. B. bei Bewusstlosigkeit ohne Todeskampf." },
    { name: "Kauernd", value: false, text: "Du duckst dich hinter Deckung: +2 RK gegen Fernkampf, aber -10 Fuß Geschwindigkeit und Auf dem falschen Fuß." },
    { name: "Körperlos", value: false, text: "Du hast keinen physischen Körper und kannst durch feste Objekte fliegen." },
    { name: "Kränkelnd", value: true, text: "Malus auf alle Würfe und SG in Höhe des Wertes; verhindert bestimmte Aktionen, bis der Wert sinkt." },
    { name: "Liegend", value: false, text: "Du liegst am Boden: Auf dem falschen Fuß, -2 auf Angriffswürfe im Nahkampf." },
    { name: "Sterbend", value: true, text: "Bei 0 TP: Bewusstlos und dem Tod nahe. Bei kritischem Fehlschlag im Rettungswurf +2, sonst je nach Erfolg -1/+1. Bei Sterbend 4 stirbst du." },
    { name: "Stabilisiert", value: false, text: "Du wurdest bei 0 TP stabilisiert: Zustand Sterbend endet, du bleibst Bewusstlos mit 0 TP." },
    { name: "Taub", value: false, text: "Du kannst nicht hören: Kritische Fehlschläge bei hörbasierten Wahrnehmungswürfen, keine klanglichen Bestandteile für Zauber." },
    { name: "Todgeweiht", value: true, text: "Deine maximalen TP sinken dauerhaft; erreicht der Wert 4, stirbst du sofort." },
    { name: "Unbeholfen", value: true, text: "Malus auf geschicklichkeitsbasierte Würfe und SG (RK, Akrobatik, Angriffe) in Höhe des Wertes." },
    { name: "Unentdeckt", value: false, text: "Niemand weiß, wo du dich befindest – du profitierst von voller Deckung gegenüber diesen Kreaturen." },
    { name: "Unbemerkt", value: false, text: "Eine Kreatur weiß nicht, dass du überhaupt da bist." },
    { name: "Unsichtbar", value: false, text: "Du kannst nicht gesehen werden; giltst als unbemerkt, solange keine andere Wahrnehmung dich entdeckt." },
    { name: "Verängstigt", value: true, text: "Malus auf alle Würfe und SG in Höhe des Wertes; sinkt meist am Ende jedes Zuges um 1." },
    { name: "Verborgen", value: false, text: "Du weißt ungefähr, wo sich das Ziel befindet, kannst es aber nicht genau sehen: Zielen mit einer Chance auf Fehlschlag." },
    { name: "Verfolgt", value: false, text: "Eine Kreatur kann dir durch magische Bindung leichter folgen/dich aufspüren." },
    { name: "Vergiftet", value: false, text: "Sammelbegriff für Zustände durch Gift; siehe konkreten Effekt der Giftquelle." },
    { name: "Verlangsamt", value: true, text: "Du verlierst zu Beginn deines Zuges Aktionen in Höhe des Wertes." },
    { name: "Versteckt", value: false, text: "Du weißt in etwa, wo sich das Ziel befindet, kannst es aber nicht sehen: 50% Fehlschlagchance beim Zielen." },
    { name: "Versteinert", value: false, text: "Du wirst zu Stein: Bewegungsunfähig, kein Sehen/Hören, giltst als Objekt." },
    { name: "Verwirrt", value: false, text: "Du handelst zufällig und giltst als Auf dem falschen Fuß; kannst Verbündete nicht bewusst als Ziel wählen." },
    { name: "Verwundet", value: true, text: "Erhöht bei erneutem Sterben den Sterbend-Wert um diesen Wert." },
    { name: "Zerbrochen", value: false, text: "Ein Gegenstand oder eine Konstruktkreatur mit 0 TP: eingeschränkt nutzbar, bis repariert." },
  ];

  const UNITS = {
    ft: "Fuß",
    mile: "Meilen",
    lb: "Pfund",
  };

  global.PF2_I18N = {
    ABILITIES,
    SAVES,
    SKILLS,
    PERCEPTION,
    PROFICIENCY_RANKS,
    proficiencyName,
    ACTION_TYPES,
    actionSymbol,
    FEAT_CATEGORIES,
    featCategoryName,
    CONDITIONS,
    UNITS,
  };
})(window);
