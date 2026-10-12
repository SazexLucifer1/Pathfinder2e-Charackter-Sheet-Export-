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
   * Zustände (Conditions): englischer Schlüssel, Wert-Zustand?, eigene Kurzfassung.
   * Die deutschen Namen kommen aus dem Wörterbuch (offizielle Übersetzung).
   * Kurzfassungen sind eigene, knappe Gedächtnisstützen – maßgeblich ist das Regelwerk.
   */
  const CONDITIONS = [
    ["blinded", false, "Du siehst nichts: Normales Gelände ist für dich schwierig, auf Sicht beruhende Wahrnehmungswürfe misslingen kritisch, −4 auf Wahrnehmung."],
    ["broken", false, "Gegenstand mit TP auf/unter dem Bruchwert: unbrauchbar. Beschädigte Rüstung gibt zusätzlich −1/−2/−3 RK (leicht/mittel/schwer)."],
    ["clumsy", true, "−Wert auf GE-basierte Würfe und SG: RK, Reflex, Fernkampf, Akrobatik, Heimlichkeit, Diebeskunst."],
    ["concealed", false, "Du bist schwer zu sehen (Nebel, Dunst): Wer dich angreift, braucht zuerst einen Glückswurf SG 5."],
    ["confused", false, "Auf dem falschen Fuß, du hältst niemanden für verbündet, keine Reaktionen; du greifst ein zufälliges Ziel an. Bei Schaden: Glückswurf SG 11 beendet es."],
    ["controlled", false, "Jemand anderes bestimmt, was du tust."],
    ["dazzled", false, "Ist Sicht dein einziger genauer Sinn, ist alles für dich verborgen (Glückswurf SG 5 beim Zielen)."],
    ["deafened", false, "Du hörst nichts: auf Gehör beruhende Wahrnehmung misslingt kritisch, −2 auf Wahrnehmung; hörbare Aktionen brauchen einen Glückswurf SG 5."],
    ["doomed", true, "Du stirbst schon bei Sterbend (4 − Wert). Sinkt um 1 nach einer vollen Nachtruhe."],
    ["drained", true, "−Wert auf KO-basierte Würfe (Zähigkeit); du verlierst Wert × Stufe TP und dein Maximum sinkt. Sinkt um 1 nach Nachtruhe."],
    ["dying", true, "Bei 0 TP: bewusstlos. Zu Beginn deines Zuges Genesungswurf (Glückswurf SG 10 + Wert). Bei Sterbend 4 stirbst du."],
    ["encumbered", false, "Zu viel Traglast: Unbeholfen 1 und −10 Fuß auf alle Geschwindigkeiten."],
    ["enfeebled", true, "−Wert auf ST-basierte Würfe und SG: Nahkampfangriff, Nahkampfschaden, Athletik."],
    ["fascinated", false, "−2 auf Wahrnehmung und Fertigkeitswürfe; du kannst dich nur auf die Quelle konzentrieren. Endet bei feindlichen Handlungen gegen dich."],
    ["fatigued", false, "−1 auf RK und Rettungswürfe; beim Reisen keine Erkundungsaktivität. Endet nach voller Nachtruhe."],
    ["fleeing", false, "Du musst deine Aktionen nutzen, um von der Quelle wegzukommen."],
    ["frightened", true, "−Wert auf alle Würfe und SG. Sinkt am Ende jedes deiner Züge um 1."],
    ["grabbed", false, "Auf dem falschen Fuß und bewegungsunfähig; Handhaben-Aktionen brauchen einen Glückswurf SG 5. Befreien: Entkommen."],
    ["hidden", false, "Der Gegner kennt dein Feld, sieht dich aber nicht: Glückswurf SG 11, um dich zu treffen."],
    ["immobilized", false, "Du kannst dich nicht von der Stelle bewegen."],
    ["invisible", false, "Man kann dich nicht sehen – du bist für andere mindestens versteckt."],
    ["off-guard", false, "−2 auf die RK (z. B. beim Flankieren)."],
    ["paralyzed", false, "Auf dem falschen Fuß, du kannst nur noch denken (Wissen abrufen und rein geistige Aktionen)."],
    ["persistent-damage", false, "Erleide den Schaden am Ende deines Zuges, dann Glückswurf SG 15: Bei Erfolg endet er."],
    ["petrified", false, "Du bist zu Stein geworden: keine Aktionen, keine Wahrnehmung."],
    ["prone", false, "Du liegst: Auf dem falschen Fuß, −2 auf Angriffe; nur Kriechen oder Aufstehen als Bewegung."],
    ["quickened", false, "1 zusätzliche Aktion pro Zug (oft nur für bestimmte Aktionen)."],
    ["restrained", false, "Gefesselt/festgehalten: Auf dem falschen Fuß, bewegungsunfähig; außer Entkommen keine Angriffe oder Handhaben-Aktionen."],
    ["sickened", true, "−Wert auf alle Würfe und SG; du kannst nichts schlucken. 1 Aktion Würgen: Zähigkeitswurf, um den Wert zu senken."],
    ["slowed", true, "Du erhältst zu Beginn deines Zuges entsprechend weniger Aktionen."],
    ["stunned", true, "Du verlierst insgesamt so viele Aktionen wie der Wert, dann endet es. Ohne Wert: keine Aktionen für die Dauer."],
    ["stupefied", true, "−Wert auf IN-, WE- und CH-basierte Würfe und SG (Willen, Zauber); beim Zaubern Glückswurf SG 5 + Wert, sonst ist der Zauber verloren."],
    ["unconscious", false, "Bewusstlos: −4 auf RK, Wahrnehmung und Reflex, blind, auf dem falschen Fuß und liegend."],
    ["undetected", false, "Der Gegner weiß nicht, wo du bist: Er muss ein Feld raten und einen Glückswurf SG 11 schaffen."],
    ["unnoticed", false, "Der Gegner weiß nicht einmal, dass du da bist."],
    ["wounded", true, "Wirst du erneut Sterbend, steigt Sterbend zusätzlich um diesen Wert. Endet durch Wunden versorgen oder volle TP + 10 Min. Rast."],
  ].map(([slug, value, text]) => ({ slug, value, text }));

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
})(typeof window !== "undefined" ? window : globalThis);
