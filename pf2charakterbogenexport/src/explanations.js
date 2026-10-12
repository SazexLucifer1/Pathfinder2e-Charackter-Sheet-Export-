/*
 * Kurze Erklärkästen im Stil der Randnotizen aus der Pathfinder-2-Einsteigerbox.
 * Eigene, bewusst knappe Formulierungen – maßgeblich bleibt das Regelwerk.
 */
(function (global) {
  "use strict";

  const EXPLANATIONS = {
    abilityScores: {
      title: "Attribute:",
      text: "Die Zahl wird zu passenden Würfen addiert. ★ = Schlüsselattribut deiner Klasse.",
    },
    saves: {
      title: "Rettungswürfe:",
      text:
        "Zähigkeit gegen Gift & Krankheit, Reflex gegen Explosionen & Fallen, Willen gegen Geistesbeeinflussung. " +
        "W20 + Bonus gegen den SG des Effekts.",
    },
    skills: {
      title: "Fertigkeitswurf:",
      text:
        "W20 + Bonus. Erreichst du den SG, ist es ein Erfolg; 10 oder mehr darüber (oder eine natürliche 20) ist ein kritischer Erfolg, " +
        "10 oder mehr darunter (oder eine natürliche 1) ein kritischer Fehlschlag.",
    },
    conditions: {
      title: "Zustände:",
      text:
        "Kreuze an, was gerade auf dich wirkt. Bei Zuständen mit Wert (z. B. Verängstigt 2) zieht man den Wert meist als Malus ab; " +
        "von mehreren gleichen gilt nur der höchste.",
    },
    bulk: {
      title: "Traglast:",
      text: "L = leicht (10 L = 1 Traglast). Trägst du mehr als 5 + Stärke, bist du Belastet (Unbeholfen 1, −10 Fuß Geschwindigkeit).",
    },
    invested: {
      title: "Investieren:",
      text: "Magische Gegenstände mit dem Merkmal „Investiert“ wirken nur, wenn du sie zu Tagesbeginn investierst – höchstens 10 Stück.",
    },
    spells: {
      title: "Zauber wirken:",
      text:
        "Die meisten Zauber kosten 2 Aktionen (◆◆). Zaubertricks kannst du beliebig oft wirken, andere Zauber verbrauchen einen Zauberplatz " +
        "ihres Grades. Gegner würfeln ihren Rettungswurf gegen deinen Zauber-SG; bei Angriffszaubern würfelst du mit deinem Zauberangriff gegen ihre RK.",
    },
  };

  global.PF2_EXPLANATIONS = EXPLANATIONS;
})(typeof window !== "undefined" ? window : globalThis);
