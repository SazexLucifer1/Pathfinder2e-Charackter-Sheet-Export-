#!/usr/bin/env node
/*
 * Listet die Texte eines oder mehrerer Foundry-Exporte, für die es in
 * src/data/stichworte.js noch keine Stichwortfassung gibt (diese werden in der
 * Bogen-Art „Spielbereit, kompakt“ automatisch gekürzt).
 *
 *   node tools/stichworte-fehlend.js mein-charakter.json [weitere.json …]
 *
 * Ausgabe je fehlendem Eintrag: Schlüssel, Name und voller Text – als Vorlage
 * für neue Einträge in src/data/stichworte.js.
 */
const fs = require("fs");
const path = require("path");
globalThis.window = globalThis;
const root = path.join(__dirname, "..");
for (const f of ["src/data/dictionary-de.js", "src/data/stichworte.js", "src/i18n.js", "src/dictionary.js", "src/skill-actions.js", "src/parser.js"])
  eval(fs.readFileSync(path.join(root, f), "utf8")); // eslint-disable-line no-eval
window.PF2_SUMMARIZE = require(path.join(root, "src/summarize.js"));

const SW = window.PF2_STICHWORTE || {};
// Waffen/Rüstungen zeigen in der Kompakt-Variante keine Beschreibung
const TAG_KINDS = new Set(["waffe", "fernkampf", "stecken", "ruestung", "schild", "munition"]);
const found = {};
const add = (key, name, text) => {
  if (key && text && !(key in SW) && !found[key]) found[key] = { name, text };
};
for (const file of process.argv.slice(2)) {
  const m = window.PF2_PARSER.parseFoundryActor(JSON.parse(fs.readFileSync(file, "utf8")));
  m.abilitiesList.forEach((a) => a.when !== "eingerechnet" && add(a.slug, a.name, a.summary));
  m.inventory.forEach((i) => i.desc && i.desc.s && !TAG_KINDS.has(i.kind) && add("eq:" + i.slug, i.name, i.desc.s));
  m.spellcasting.entries.forEach((e) => e.spells.forEach((s) => add("sp:" + s.slug, s.name, s.summary)));
  (m.keyActions || []).forEach((k) => add("act:" + k.slug, k.name, k.text));
}
const keys = Object.keys(found);
if (!keys.length) console.log("Alle Texte haben eine Stichwortfassung.");
keys.forEach((k) => console.log(`"${k}": "",  // ${found[k].name}: ${found[k].text}`));
