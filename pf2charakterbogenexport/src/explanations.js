/*
 * Erklärtexte im Stil der Randnotizen aus der Pathfinder-2-Einsteigerbox:
 * kurze, für Neulinge verständliche Kästen, die direkt neben dem
 * jeweiligen Wert auf dem Bogen stehen. Eigene, freie Formulierungen.
 */
(function (global) {
  "use strict";

  const EXPLANATIONS = {
    proficiency: {
      title: "Was ist Kompetenz?",
      text:
        "Kompetenz zeigt, wie gut du in etwas bist. Es gibt 5 Stufen: " +
        "Ungeübt (+0), Geübt (+2), Experte (+4), Meister (+6), Legende (+8). " +
        "Bist du mindestens Geübt, zählst du zusätzlich deine Charakterstufe dazu. " +
        "Beispiel: Stufe 5, Geübt in Akrobatik → Bonus = 5 + 2 = +7. " +
        "Der Kompetenzbonus wird auf Fertigkeits-, Angriffs- und Rettungswürfe, " +
        "Wahrnehmung sowie die RK addiert.",
    },
    abilityScores: {
      title: "Attribute & Modifikator",
      text:
        "Deine sechs Attribute (Stärke, Geschicklichkeit, Konstitution, Intelligenz, " +
        "Weisheit, Charisma) bestimmen, wie gut dein Charakter in bestimmten Bereichen ist. " +
        "Der Modifikator (die Zahl mit + oder -) wird bei Würfen addiert, nicht der Wert selbst.",
    },
    ac: {
      title: "Was ist die RK?",
      text:
        "Die Rüstungsklasse (RK) ist der Schwierigkeitsgrad, den ein Angriff gegen dich " +
        "erreichen oder übertreffen muss, um zu treffen. " +
        "RK = 10 + Geschicklichkeitsmodifikator (bis zur Rüstungsgrenze) + Kompetenzbonus " +
        "in Rüstungen + Rüstungsbonus + sonstige Boni.",
    },
    hp: {
      title: "Trefferpunkte (TP)",
      text:
        "TP zeigen, wie viel Schaden du einstecken kannst, bevor du bewusstlos wirst. " +
        "Sinken deine TP auf 0, erhältst du den Zustand Sterbend. Trage aktuelle TP im " +
        "linken, maximale TP im rechten Feld ein; temporäre TP separat, sie gehen zuerst verloren.",
    },
    saves: {
      title: "Rettungswürfe",
      text:
        "Zähigkeit (Konstitution) widersteht körperlichen Effekten wie Gift oder Krankheit. " +
        "Reflex (Geschicklichkeit) weicht Flächenangriffen aus. " +
        "Willen (Weisheit) widersteht geistiger Beeinflussung. " +
        "Würfle W20 + Kompetenzbonus + Attributsmodifikator gegen den Schwierigkeitsgrad (SG) des Effekts.",
    },
    perception: {
      title: "Wahrnehmung",
      text:
        "Wahrnehmung zeigt, wie aufmerksam du bist – z. B. um versteckte Kreaturen zu " +
        "entdecken oder Initiative zu würfeln. Trotz des Namens ist sie technisch keine " +
        "Fertigkeit, funktioniert aber genauso (W20 + Kompetenzbonus + Weisheitsmodifikator).",
    },
    skills: {
      title: "Fertigkeitswürfe",
      text:
        "Ein Fertigkeitswurf ist W20 + Kompetenzbonus + Attributsmodifikator (+ sonstige Boni/Mali). " +
        "Vergleiche das Ergebnis mit dem Schwierigkeitsgrad (SG). Kritischer Erfolg bei 10+ über dem " +
        "SG oder einer natürlichen 20, kritischer Fehlschlag bei 10+ darunter oder einer natürlichen 1.",
    },
    classDC: {
      title: "Klassen-SG",
      text:
        "Manche Klassenfähigkeiten (z. B. Zauber, besondere Manöver) verwenden statt eines " +
        "Angriffswurfs einen festen Schwierigkeitsgrad: den Klassen-SG. " +
        "Klassen-SG = 10 + Kompetenzbonus + Schlüsselattributs-Modifikator deiner Klasse.",
    },
    actions: {
      title: "Aktionen im Kampf",
      text:
        "Zu Beginn deines Zuges hast du 3 Aktionen (◆) und danach eine Reaktion (⤾), die du " +
        "auch außerhalb deines Zuges einsetzen kannst. Freie Aktionen (◇) kosten nichts. " +
        "Ein Angriffswurf kostet 1 Aktion; jeder weitere Angriff im selben Zug erhält die " +
        "Vielfachangriffs-Malus (MAP): -5 beim zweiten Versuch, -10 beim dritten " +
        "(bei leichten/handlichen Waffen nur -4/-8).",
    },
    conditions: {
      title: "Wie funktionieren Zustände?",
      text:
        "Zustände beschreiben besondere Umstände wie Verletzungen oder magische Effekte. " +
        "Manche haben einen Wert (z. B. Verängstigt 2) – dieser wird meist als Malus auf " +
        "betroffene Würfe abgezogen und sinkt oft am Ende deines Zuges um 1. " +
        "Hast du denselben Zustand mehrfach, gilt nur der höchste Wert. Hake aktive " +
        "Zustände hier während des Spiels ab und streiche sie, sobald sie enden.",
    },
    feats: {
      title: "Was sind Talente?",
      text:
        "Talente (Feats) sind besondere Fähigkeiten, die du im Laufe deiner Karriere erlernst. " +
        "Volkstalente erhältst du durch dein Volk, Klassentalente durch deine Klasse, " +
        "Fertigkeitstalente durch hohe Kompetenz in einer Fertigkeit, und Allgemeine Talente " +
        "kannst du frei wählen. Die Symbole ◆/◆◆/◆◆◆ zeigen an, wie viele Aktionen ein " +
        "Talent kostet, ⤾ steht für eine Reaktion, ◇ für eine freie Aktion, — für passive Talente ohne Aktivierung.",
    },
    bulk: {
      title: "Traglast",
      text:
        "Jeder Gegenstand hat eine Traglast (0, L für leicht, oder eine Zahl). Du kannst " +
        "problemlos Traglast bis zu 5 + Stärkemodifikator tragen; darüber hinaus bist du " +
        "Belastet, bis 10 + Stärkemodifikator kannst du dich noch bewegen.",
    },
    heroPoints: {
      title: "Heldenpunkte",
      text:
        "Heldenpunkte kannst du ausgeben, um einen W20-Wurf neu zu würfeln, oder bei 0 TP, " +
        "um dich selbst wieder aufzurappeln. Du beginnst jede Sitzung mit 1 Heldenpunkt; " +
        "die Spielleitung vergibt weitere für gutes Rollenspiel oder clevere Ideen (max. 3).",
    },
  };

  global.PF2_EXPLANATIONS = EXPLANATIONS;
})(window);
