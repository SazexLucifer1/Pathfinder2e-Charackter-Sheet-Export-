/*
 * Grundaktionen und Fertigkeitsaktionen (z. B. Hindurchturnen) – mit
 * eigenen, bewusst sehr kurzen Erklärungen in eigenen Worten.
 * Die deutschen Namen entsprechen der offiziellen Übersetzung.
 *
 * cost:  1 / 2 / 3 = Aktionen, "R" = Reaktion, "F" = freie Aktion,
 *        "E" = Erkundungsaktivität, "A" = Auszeit, "M" = dauert Minuten
 * when:  "kampf" = typischerweise im Kampf, "ausserhalb" = außerhalb des Kampfes
 * skill: Schlüssel der Fertigkeit (oder "perception"); fehlt bei Grundaktionen
 * trained: true = nur nutzbar, wenn mindestens Geübt
 * vs:    wogegen gewürfelt wird (kurz)
 */
(function (global) {
  "use strict";

  const BASIC_ACTIONS = [
    { slug: "strike", name: "Angriff", cost: 1, text: "Greife mit einer Waffe oder waffenlos an. Jeder weitere Angriff im selben Zug: −5 / −10 (mit „Agil“-Waffen −4 / −8)." },
    { slug: "stride", name: "Laufen", cost: 1, text: "Bewege dich bis zu deiner Geschwindigkeit." },
    { slug: "step", name: "Schritt", cost: 1, text: "Bewege dich 5 Fuß, ohne Reaktionen wie den Reaktionsangriff auszulösen." },
    { slug: "interact", name: "Interagieren", cost: 1, text: "Waffe ziehen, Trank nehmen, Tür öffnen, Gegenstand aufheben …" },
    { slug: "raise-a-shield", name: "Schild heben", cost: 1, text: "Mit erhobenem Schild erhältst du seinen RK-Bonus bis zu deinem nächsten Zug." },
    { slug: "take-cover", name: "In Deckung gehen", cost: 1, text: "Hinter Deckung oder liegend: Deckung wird besser (+4 statt +2 RK)." },
    { slug: "seek", name: "Suchen", cost: 1, skill: "perception", text: "Suche nach versteckten Kreaturen oder Dingen (Wahrnehmungswurf)." },
    { slug: "stand", name: "Aufstehen", cost: 1, text: "Steh auf, wenn du liegst." },
    { slug: "drop-prone", name: "Sich fallenlassen", cost: 1, text: "Wirf dich zu Boden (Zustand Liegend)." },
    { slug: "aid", name: "Jemand Anderem helfen", cost: "R", text: "Nach Vorbereitung in deinem Zug: Gib einem Verbündeten einen Bonus auf seinen Wurf." },
    { slug: "ready", name: "Vorbereiten", cost: 2, text: "Lege eine Aktion samt Auslöser fest; du führst sie als Reaktion aus, wenn der Auslöser eintritt." },
    { slug: "delay", name: "Verzögern", cost: "F", text: "Handle später in der Runde; deine Initiative ändert sich entsprechend." },
    { slug: "escape", name: "Entkommen", cost: 1, text: "Befreie dich aus Ergriffen/Gefesselt: Angriffsbonus, Akrobatik oder Athletik gegen den SG." },
    { slug: "crawl", name: "Kriechen", cost: 1, text: "Bewege dich liegend 5 Fuß weit." },
    { slug: "leap", name: "Springen", cost: 1, text: "Springe 10 Fuß weit (bei Geschwindigkeit ab 30 Fuß: 15 Fuß) oder 3 Fuß hoch." },
    { slug: "point-out", name: "Hinweisen", cost: 1, text: "Zeige Verbündeten, wo eine Kreatur ist, die nur du bemerkt hast." },
    { slug: "sustain", name: "Aufrechterhalten", cost: 1, text: "Verlängere einen Effekt (z. B. Zauber) mit „Aufrechterhalten“ bis zum Ende deines nächsten Zuges." },
  ];

  const SKILL_ACTIONS = [
    // ---- Akrobatik
    { slug: "tumble-through", skill: "acrobatics", cost: 1, when: "kampf", vs: "Reflex-SG", text: "Bewege dich durch das Feld eines Gegners hindurch. Misslingt es, bleibt deine Bewegung davor stehen." },
    { slug: "balance", skill: "acrobatics", cost: 1, when: "kampf", vs: "SG des Untergrunds", text: "Bewege dich über schmalen oder rutschigen Untergrund, ohne zu fallen." },
    { slug: "maneuver-in-flight", skill: "acrobatics", cost: 1, when: "kampf", trained: true, vs: "SG", text: "Schwieriges Flugmanöver (nur wenn du fliegen kannst)." },
    { slug: "squeeze", skill: "acrobatics", cost: "M", when: "ausserhalb", trained: true, vs: "SG", text: "Zwänge dich durch einen sehr engen Spalt." },
    // ---- Athletik
    { slug: "grapple", skill: "athletics", cost: 1, when: "kampf", vs: "Zähigkeits-SG", text: "Packe einen Gegner mit freier Hand: Erfolg = Ergriffen, krit. Erfolg = Festgehalten.", attack: true },
    { slug: "shove", skill: "athletics", cost: 1, when: "kampf", vs: "Zähigkeits-SG", text: "Stoße einen Gegner 5 Fuß weg (krit. Erfolg 10 Fuß).", attack: true },
    { slug: "trip", skill: "athletics", cost: 1, when: "kampf", vs: "Reflex-SG", text: "Bring einen Gegner zu Fall: Er wird Liegend.", attack: true },
    { slug: "disarm", skill: "athletics", cost: 1, when: "kampf", trained: true, vs: "Reflex-SG", text: "Schlage einem Gegner die Waffe aus der Hand (Erfolg: −2 auf seine Angriffe mit ihr).", attack: true },
    { slug: "reposition", skill: "athletics", cost: 1, when: "kampf", vs: "Zähigkeits-SG", text: "Schiebe einen Gegner, den du ergriffen hast oder der neben dir steht, um 5 Fuß.", attack: true },
    { slug: "climb", skill: "athletics", cost: 1, when: "kampf", vs: "SG der Wand", text: "Klettere ein Stück eine Wand, Klippe o. Ä. hinauf." },
    { slug: "swim", skill: "athletics", cost: 1, when: "kampf", vs: "SG des Wassers", text: "Schwimme durch Wasser; bei Misserfolg kommst du nicht voran." },
    { slug: "high-jump", skill: "athletics", cost: 2, when: "kampf", vs: "SG 30", text: "Laufen + Sprung in die Höhe (nach mind. 10 Fuß Anlauf)." },
    { slug: "long-jump", skill: "athletics", cost: 2, when: "kampf", vs: "SG = Weite in Fuß", text: "Laufen + Sprung in die Weite (nach mind. 10 Fuß Anlauf)." },
    { slug: "force-open", skill: "athletics", cost: 1, when: "ausserhalb", vs: "SG", text: "Brich eine Tür, ein Fenster oder Schloss mit Gewalt auf.", attack: true },
    // ---- Täuschung
    { slug: "feint", skill: "deception", cost: 1, when: "kampf", trained: true, vs: "Wahrnehmungs-SG", text: "Täusche einen Gegner neben dir: Er ist gegen deinen nächsten Angriff Auf dem falschen Fuß." },
    { slug: "create-a-diversion", skill: "deception", cost: 1, when: "kampf", vs: "Wahrnehmungs-SG", text: "Lenke Gegner ab, damit du dich verstecken oder davonschleichen kannst." },
    { slug: "lie", skill: "deception", cost: "M", when: "ausserhalb", vs: "Wahrnehmungs-SG", text: "Bring jemanden dazu, eine Lüge zu glauben." },
    { slug: "impersonate", skill: "deception", cost: "M", when: "ausserhalb", vs: "Wahrnehmungs-SG", text: "Verkleide dich als jemand anderes." },
    // ---- Diplomatie
    { slug: "make-an-impression", skill: "diplomacy", cost: "M", when: "ausserhalb", vs: "Willens-SG", text: "Verbessere die Einstellung einer Person dir gegenüber (1 Min. Gespräch)." },
    { slug: "request", skill: "diplomacy", cost: 1, when: "ausserhalb", vs: "SG", text: "Bitte eine freundlich gesinnte Person um einen Gefallen." },
    { slug: "gather-information", skill: "diplomacy", cost: "E", when: "ausserhalb", vs: "SG", text: "Hör dich in der Stadt um (ca. 2 Stunden), um Gerüchte und Infos zu sammeln." },
    // ---- Einschüchtern
    { slug: "demoralize", skill: "intimidation", cost: 1, when: "kampf", vs: "Willens-SG", text: "Erschrecke einen Gegner bis 30 Fuß: Er wird Verängstigt 1 (krit. Erfolg: 2)." },
    { slug: "coerce", skill: "intimidation", cost: "M", when: "ausserhalb", vs: "Willens-SG", text: "Bedrohe jemanden, damit er tut, was du willst." },
    // ---- Heilkunde
    { slug: "administer-first-aid", skill: "medicine", cost: 2, when: "kampf", vs: "SG", text: "Stabilisiere eine sterbende Kreatur oder stille eine Blutung (Heilerwerkzeug nötig)." },
    { slug: "treat-wounds", skill: "medicine", cost: "M", when: "ausserhalb", trained: true, vs: "SG 15", text: "10 Minuten: Heile eine Kreatur um 2W8 TP (krit. Erfolg 4W8). Danach 1 Stunde nicht erneut." },
    { slug: "treat-disease", skill: "medicine", cost: "A", when: "ausserhalb", trained: true, vs: "SG der Krankheit", text: "Pflege einen Kranken: Bonus auf seinen nächsten Rettungswurf." },
    { slug: "treat-poison", skill: "medicine", cost: 1, when: "kampf", trained: true, vs: "SG des Gifts", text: "Bonus auf den nächsten Rettungswurf eines Vergifteten." },
    // ---- Natur
    { slug: "command-an-animal", skill: "nature", cost: 1, when: "kampf", vs: "Willens-SG des Tieres", text: "Gib einem Tier einen Befehl, den es ausführen soll." },
    // ---- Darbietung
    { slug: "perform", skill: "performance", cost: 1, when: "ausserhalb", vs: "SG", text: "Führe etwas vor, um Publikum zu beeindrucken." },
    // ---- Heimlichkeit
    { slug: "hide", skill: "stealth", cost: 1, when: "kampf", vs: "Wahrnehmungs-SG", text: "Verstecke dich hinter Deckung oder im Verborgenen vor Gegnern." },
    { slug: "sneak", skill: "stealth", cost: 1, when: "kampf", vs: "Wahrnehmungs-SG", text: "Bewege dich mit halber Geschwindigkeit, ohne entdeckt zu werden." },
    { slug: "conceal-an-object", skill: "stealth", cost: 1, when: "ausserhalb", vs: "Wahrnehmungs-SG", text: "Verstecke einen kleinen Gegenstand am Körper." },
    // ---- Überleben
    { slug: "sense-direction", skill: "survival", cost: "E", when: "ausserhalb", vs: "SG", text: "Finde die Himmelsrichtung und verirre dich nicht." },
    { slug: "subsist", skill: "survival", cost: "A", when: "ausserhalb", vs: "SG", text: "Finde Nahrung und Unterschlupf in der Wildnis." },
    { slug: "track", skill: "survival", cost: "E", when: "ausserhalb", trained: true, vs: "SG", text: "Folge Spuren von Kreaturen." },
    { slug: "cover-tracks", skill: "survival", cost: "E", when: "ausserhalb", trained: true, vs: "Überlebens-SG", text: "Verwische deine Spuren, damit man dir nicht folgen kann." },
    // ---- Diebeskunst
    { slug: "palm-an-object", skill: "thievery", cost: 1, when: "ausserhalb", vs: "Wahrnehmungs-SG", text: "Lass unbemerkt einen kleinen Gegenstand verschwinden." },
    { slug: "steal", skill: "thievery", cost: 1, when: "ausserhalb", vs: "Wahrnehmungs-SG", text: "Stiehl etwas, das jemand bei sich trägt." },
    { slug: "disable-a-device", skill: "thievery", cost: 2, when: "kampf", trained: true, vs: "SG der Falle", text: "Entschärfe eine Falle oder einen Mechanismus." },
    { slug: "pick-a-lock", skill: "thievery", cost: 2, when: "ausserhalb", trained: true, vs: "SG des Schlosses", text: "Öffne ein Schloss (Diebeswerkzeug nötig)." },
    // ---- Handwerkskunst
    { slug: "repair", skill: "crafting", cost: "M", when: "ausserhalb", vs: "SG", text: "Repariere einen beschädigten Gegenstand (10 Min., Werkzeug nötig)." },
    { slug: "craft", skill: "crafting", cost: "A", when: "ausserhalb", trained: true, vs: "SG", text: "Stelle einen Gegenstand her (mehrere Tage, Material & Formel nötig)." },
    // ---- Wissensfertigkeiten
    { slug: "recall-knowledge", skill: "knowledge", cost: 1, when: "kampf", vs: "SG", text: "Erinnere dich an Wissen, z. B. über die Schwächen eines Monsters (Arkane Künste, Natur, Okkultismus, Religion, Gesellschaft …)." },
    { slug: "identify-magic", skill: "magic", cost: "E", when: "ausserhalb", trained: true, vs: "SG", text: "Finde heraus, welche Magie in einem Gegenstand oder Effekt steckt (Arkane Künste, Natur, Okkultismus, Religion)." },
    { slug: "learn-a-spell", skill: "magic", cost: "A", when: "ausserhalb", trained: true, vs: "SG", text: "Lerne einen neuen Zauber (nur für Zauberwirkende)." },
    { slug: "decipher-writing", skill: "knowledge", cost: "E", when: "ausserhalb", trained: true, vs: "SG", text: "Entschlüssle fremde, alte oder verschlüsselte Texte." },
    // ---- Wahrnehmung
    { slug: "sense-motive", skill: "perception", cost: 1, when: "ausserhalb", vs: "Täuschungs-SG", text: "Erkenne, ob jemand lügt oder etwas verbirgt." },
    // ---- Jeder
    { slug: "earn-income", skill: "any", cost: "A", when: "ausserhalb", trained: true, vs: "SG", text: "Verdiene in der Auszeit Geld mit Handwerk, Darbietung oder einer Kenntnis." },
  ];

  // Erkundungsaktivitäten (Bewegung außerhalb des Kampfes)
  const EXPLORATION = [
    { slug: "avoid-notice", name: "Unbemerkt bleiben", text: "Heimlich reisen – Initiative mit Heimlichkeit." },
    { slug: "search", name: "Absuchen", text: "Umgebung nach Fallen, Geheimtüren und Verborgenem absuchen (Wahrnehmung)." },
    { slug: "scout", name: "Spähen", text: "Vorauskundschaften: Gruppe erhält +1 auf die nächste Initiative." },
    { slug: "defend", name: "Verteidigen", text: "Mit erhobenem Schild reisen – Schild ist bei Kampfbeginn schon oben." },
    { slug: "detect-magic", name: "Magie entdecken", text: "Ständig nach Magie Ausschau halten (benötigt den Zaubertrick)." },
    { slug: "investigate", name: "Umsehen", text: "Unterwegs Wissen abrufen über das, was ihr seht." },
    { slug: "follow-the-expert", name: "Am Experten orientieren", text: "Einem Verbündeten folgen, der die Fertigkeit gut beherrscht: Er hilft dir beim Wurf." },
    { slug: "hustle", name: "Eilen", text: "Doppelt so schnell reisen – aber nur kurze Zeit (Konstitution × 10 Minuten)." },
    { slug: "refocus", name: "Fokus erneuern", text: "10 Minuten: 1 Fokuspunkt zurückgewinnen (nur mit Fokuszaubern)." },
  ];

  // Diese Aktionen stehen immer in der Tabelle; alle anderen nur, wenn du in der
  // Fertigkeit mindestens geübt bist (sonst nur als kurze Namensliste).
  const CORE = new Set([
    "tumble-through", "grapple", "shove", "trip", "demoralize", "recall-knowledge", "hide", "sneak",
    "create-a-diversion", "administer-first-aid", "feint", "seek",
    "make-an-impression", "request", "gather-information", "coerce", "lie", "sense-motive", "treat-wounds",
    "subsist", "repair", "identify-magic", "earn-income",
  ]);

  const KNOWLEDGE_SKILLS = ["arcana", "nature", "occultism", "religion", "society", "crafting", "medicine"];
  const MAGIC_SKILLS = ["arcana", "nature", "occultism", "religion"];

  global.PF2_ACTIONS = { BASIC_ACTIONS, SKILL_ACTIONS, EXPLORATION, CORE, KNOWLEDGE_SKILLS, MAGIC_SKILLS };
})(typeof window !== "undefined" ? window : globalThis);
