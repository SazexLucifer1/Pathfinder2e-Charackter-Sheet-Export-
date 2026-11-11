/*
 * Piktogramme für die Ausrüstungsliste (je Gegenstandsart, siehe
 * itemKind() im Parser). Einheitlicher Stil: schwarze Kontur, orange Akzent,
 * viewBox 0 0 20 20.
 */
(function (global) {
  "use strict";

  const K = 'stroke="#111" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"';
  const O = "#e0661b";
  const svg = (body) => `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  const ICONS = {
    // Schwert
    waffe: svg(`<path d="M15.5 2.5 L17.5 2.5 L17.5 4.5 L8 14 L6 12 Z" fill="#fff" ${K}/><path d="M4 10.5 L9.5 16" fill="none" ${K} stroke-width="2"/><path d="M5.2 14.8 L2.5 17.5" fill="none" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>`),
    // Bogen mit Pfeil
    fernkampf: svg(`<path d="M7.5 2 C15.5 5 15.5 15 7.5 18" fill="none" ${K} stroke-width="1.9"/><path d="M7.5 2 L7.5 18" fill="none" stroke="#111" stroke-width="0.9"/><path d="M2.5 10 L17.5 10" fill="none" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/><path d="M15 7.8 L17.8 10 L15 12.2" fill="none" stroke="${O}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`),
    // Stecken (Stab mit Kristall)
    stecken: svg(`<path d="M5 18 L13.5 6.5" fill="none" ${K} stroke-width="2.2"/><path d="M15 1.8 L18 4.8 L15 7.8 L12 4.8 Z" fill="${O}" ${K}/>`),
    // Brustpanzer
    ruestung: svg(`<path d="M6 2.5 L9 4 L11 4 L14 2.5 L17 5 L15.5 8.5 L15.5 17 L4.5 17 L4.5 8.5 L3 5 Z" fill="#fff" ${K}/><path d="M10 4.5 L10 16.5 M6.5 10 L13.5 10" fill="none" stroke="${O}" stroke-width="1.3"/>`),
    // Schild
    schild: svg(`<path d="M10 2 L17 4.5 L17 9.5 C17 14 13.5 16.6 10 18 C6.5 16.6 3 14 3 9.5 L3 4.5 Z" fill="#fff" ${K}/><path d="M10 4.6 L14.6 6.2 L14.6 9.6 C14.6 12.6 12.4 14.4 10 15.4 Z" fill="${O}"/>`),
    // Trank (Kolben)
    trank: svg(`<path d="M8 2.5 L12 2.5 M8.6 2.5 L8.6 7 L4.5 14.5 C3.8 16 4.8 17.5 6.4 17.5 L13.6 17.5 C15.2 17.5 16.2 16 15.5 14.5 L11.4 7 L11.4 2.5" fill="#fff" ${K}/><path d="M6.2 12 L13.8 12 L15.3 14.8 C15.8 16 15.1 16.8 13.6 16.8 L6.4 16.8 C4.9 16.8 4.2 16 4.7 14.8 Z" fill="${O}"/>`),
    // Öl (Tropfen)
    oel: svg(`<path d="M10 2 C10 2 4.5 9 4.5 12.5 C4.5 15.5 7 18 10 18 C13 18 15.5 15.5 15.5 12.5 C15.5 9 10 2 10 2 Z" fill="${O}" ${K}/><path d="M7.4 12.6 C7.4 14.2 8.4 15.3 9.6 15.5" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>`),
    // Schriftrolle
    schriftrolle: svg(`<path d="M5 3.5 L15 3.5 L15 16.5 L5 16.5 Z" fill="#fff" ${K}/><path d="M3.5 3.5 L16.5 3.5 M3.5 16.5 L16.5 16.5" fill="none" ${K} stroke-width="2.4"/><path d="M7 7 L13 7 M7 10 L13 10 M7 13 L11 13" fill="none" stroke="${O}" stroke-width="1.2" stroke-linecap="round"/>`),
    // Zauberstab mit Funken
    zauberstab: svg(`<path d="M3 17 L12.5 7.5" fill="none" ${K} stroke-width="2"/><path d="M15 2 L15.7 4.3 L18 5 L15.7 5.7 L15 8 L14.3 5.7 L12 5 L14.3 4.3 Z" fill="${O}" stroke="${O}" stroke-width="0.6" stroke-linejoin="round"/>`),
    // Talisman (Anhänger)
    talisman: svg(`<path d="M5 2.5 C5 7 15 7 15 2.5" fill="none" ${K}/><path d="M10 7.5 L15 12.5 L10 17.5 L5 12.5 Z" fill="${O}" ${K}/>`),
    // Munition (drei Pfeile)
    munition: svg(`<path d="M5 18 L5 5 M10 18 L10 3 M15 18 L15 5" fill="none" ${K}/><path d="M3.6 6.4 L5 3.5 L6.4 6.4 M8.6 4.4 L10 1.5 L11.4 4.4 M13.6 6.4 L15 3.5 L16.4 6.4" fill="${O}" stroke="${O}" stroke-width="1" stroke-linejoin="round"/>`),
    // Schmuck / getragener Gegenstand (Ring mit Stein)
    schmuck: svg(`<circle cx="10" cy="12.5" r="5" fill="none" ${K} stroke-width="1.8"/><path d="M10 2 L13 5 L10 8 L7 5 Z" fill="${O}" ${K}/>`),
    // Werkzeug (Hammer)
    werkzeug: svg(`<path d="M4 17.5 L11 10.5" fill="none" ${K} stroke-width="2.2"/><path d="M9 4.5 L13.5 2.5 L17.5 6.5 L15.5 11 Z" fill="${O}" ${K}/>`),
    // Buch
    buch: svg(`<path d="M3.5 4 C6 3 8.5 3 10 4.5 C11.5 3 14 3 16.5 4 L16.5 16.5 C14 15.5 11.5 15.5 10 17 C8.5 15.5 6 15.5 3.5 16.5 Z" fill="#fff" ${K}/><path d="M10 4.5 L10 17" fill="none" stroke="${O}" stroke-width="1.4"/>`),
    // Behälter (Rucksack)
    behaelter: svg(`<path d="M7 5 C7 2.5 13 2.5 13 5" fill="none" ${K}/><path d="M4.5 6.5 C4.5 5.5 5.5 5 6.5 5 L13.5 5 C14.5 5 15.5 5.5 15.5 6.5 L15.5 16.5 C15.5 17.2 15 17.5 14.5 17.5 L5.5 17.5 C5 17.5 4.5 17.2 4.5 16.5 Z" fill="#fff" ${K}/><path d="M7 10.5 L13 10.5 L13 14.5 L7 14.5 Z" fill="${O}" ${K} stroke-width="1"/>`),
    // Licht (Fackel)
    licht: svg(`<path d="M8.5 10 L11.5 10 L10.6 18 L9.4 18 Z" fill="#fff" ${K}/><path d="M10 1.8 C12.8 4.4 13.6 6.5 12.4 8.4 C11.8 9.3 8.2 9.3 7.6 8.4 C6.6 6.8 7.6 5.4 8.6 4.6 C8.8 5.8 9.4 6.3 10 6.4 C9.6 4.8 9.6 3.4 10 1.8 Z" fill="${O}" ${K} stroke-width="1"/>`),
    // Schatz (Edelstein)
    schatz: svg(`<path d="M5.5 4 L14.5 4 L18 8 L10 17.5 L2 8 Z" fill="${O}" ${K}/><path d="M2 8 L18 8 M7.5 4 L6.5 8 L10 17.5 L13.5 8 L12.5 4" fill="none" stroke="#111" stroke-width="0.9" stroke-linejoin="round"/>`),
    // Verbrauchsgegenstand (Beutel)
    verbrauch: svg(`<path d="M7.5 4.5 L12.5 4.5 L11.5 6.5 C15 8 16.5 11 16.5 13.5 C16.5 16.5 14 17.5 10 17.5 C6 17.5 3.5 16.5 3.5 13.5 C3.5 11 5 8 8.5 6.5 Z" fill="#fff" ${K}/><path d="M8.3 6.5 L11.7 6.5" fill="none" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>`),
    // Sonstige Ausrüstung (Kiste)
    ausruestung: svg(`<path d="M3 7 L10 3.5 L17 7 L17 14 L10 17.5 L3 14 Z" fill="#fff" ${K}/><path d="M3 7 L10 10.5 L17 7 M10 10.5 L10 17.5" fill="none" ${K}/><path d="M6.5 5.2 L13.5 8.8" fill="none" stroke="${O}" stroke-width="1.5"/>`),
  };

  const LABELS = {
    waffe: "Waffe", fernkampf: "Fernkampfwaffe", stecken: "Stecken", ruestung: "Rüstung", schild: "Schild", trank: "Trank/Elixier",
    oel: "Öl", schriftrolle: "Schriftrolle", zauberstab: "Zauberstab", talisman: "Talisman", munition: "Munition", schmuck: "getragener Gegenstand",
    werkzeug: "Werkzeug", buch: "Buch", behaelter: "Behälter", licht: "Licht", schatz: "Schatz", verbrauch: "Verbrauchsgegenstand", ausruestung: "Ausrüstung",
  };

  function icon(kind) {
    const k = ICONS[kind] ? kind : "ausruestung";
    return `<span class="cs-item-ico" title="${LABELS[k]}">${ICONS[k]}</span>`;
  }

  global.PF2_ITEM_ICONS = { icon, ICONS, LABELS };
})(typeof window !== "undefined" ? window : globalThis);
