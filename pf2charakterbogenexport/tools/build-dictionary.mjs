#!/usr/bin/env node
/*
 * Erzeugt src/data/dictionary-de.js aus dem deutschen Übersetzungsmodul
 * für Foundry VTT (https://github.com/Foundry-VTT-PF2-German/lang-de-pf2e,
 * MIT-Lizenz) und der englischen Sprachdatei des pf2e-Systems
 * (https://github.com/foundryvtt/pf2e, static/lang/en.json).
 *
 * Benutzung:
 *   node tools/build-dictionary.mjs <pfad/zu/lang-de-pf2e> <pfad/zu/pf2e/static/lang/en.json> [<pfad/zu/pf2e/packs/pf2e>]
 *
 * Der optionale dritte Pfad (englische Kompendien des pf2e-Systems) wird nur
 * für die Übersetzung von Kenntnis-Fertigkeiten ("Warfare Lore") benötigt.
 *
 * Das Ergebnis enthält nur, was der Bogen braucht:
 *   - deutsche Namen (Talente, Klassenmerkmale, Aktionen, Zauber, Ausrüstung, …)
 *   - eine stark gekürzte deutsche Kurzfassung (1–2 Sätze) für Talente,
 *     Merkmale, Aktionen und Zauber
 *   - deutsche Begriffe für Merkmale (Traits), Schadensarten, Sprachen, Größen, …
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const [, , deDir, enJsonPath, enPacksDir] = process.argv;
if (!deDir || !enJsonPath) {
  console.error("Benutzung: node tools/build-dictionary.mjs <lang-de-pf2e> <pf2e/static/lang/en.json>");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, "..", "src", "data", "dictionary-de.js");

// Muss identisch zu PF2_DICT.slug() in src/dictionary.js sein.
function slug(text) {
  return String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const require = createRequire(import.meta.url);
const { summarize, looksEnglish } = require("../src/summarize.js");

/* ---------- Kompendien ---------- */

const comp = (name) => path.join(deDir, "translation", "de", "compendium", `pf2e.${name}.json`);

// [Datei, Kurzfassung erzeugen?, max. Länge, Präfix]
// Mit Präfix wird zusätzlich ein typgebundener Schlüssel abgelegt ("eq:mug" = Becher),
// damit gleichnamige Talente/Gegenstände/Zauber sich nicht überschreiben.
const PACKS = [
  ["feats-srd", true, 230],
  ["classfeatures", true, 230],
  ["ancestryfeatures", true, 200],
  ["actionspf2e", true, 200],
  ["spells-srd", true, 170, "sp:"],
  ["familiar-abilities", true, 160],
  ["ancestries", false],
  ["heritages", true, 200],
  ["backgrounds", false],
  ["classes", false],
  ["deities", false],
  ["equipment-srd", false, 0, "eq:"],
  ["conditionitems", false, 0, "cond:"],
];

const items = {};
let shortCount = 0;
for (const [pack, withShort, maxLen, prefix] of PACKS) {
  const file = comp(pack);
  if (!fs.existsSync(file)) {
    console.warn("fehlt:", file);
    continue;
  }
  const entries = readJson(file).entries || {};
  for (const [enName, entry] of Object.entries(entries)) {
    const key = slug(enName);
    if (!key) continue;
    if (!prefix && items[key]) continue;
    const deName = entry.name && entry.name !== enName ? entry.name : null;
    const english = looksEnglish(entry.description);
    let sum = null;
    if (withShort && entry.description && !english) sum = summarize(entry.description, maxLen);
    if (!deName && !sum) continue;
    const rec = { n: deName || undefined };
    if (sum) {
      Object.assign(rec, sum);
      shortCount++;
    }
    if (prefix) items[prefix + key] = rec;
    if (!items[key]) items[key] = rec;
  }
}

/* ---------- UI-Begriffe ---------- */

const en = readJson(enJsonPath).PF2E;
const de = readJson(path.join(deDir, "translation", "de", "de.json")).PF2E;

const traits = {};
for (const [k, v] of Object.entries(en)) {
  const m = k.match(/^Trait([A-Z].*)$/);
  if (!m || m[1].startsWith("Description") || typeof v !== "string") continue;
  const deV = de[k];
  if (typeof deV !== "string" || !deV) continue;
  traits[slug(v)] = deV;
}

function pick(prefixRe, src = en, dst = de) {
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    const m = k.match(prefixRe);
    if (!m || typeof v !== "string" || typeof dst[k] !== "string") continue;
    out[slug(v)] = dst[k];
  }
  return out;
}

const languages = {};
const enLang = en.Actor?.Creature?.Language || {};
const deLang = de.Actor?.Creature?.Language || {};
for (const [k, v] of Object.entries(enLang)) {
  if (typeof v === "string" && typeof deLang[k] === "string") languages[k] = deLang[k];
}

/* ---------- Kenntnisse (Lore) aus Hintergründen ---------- */
const lores = {};
const bgDir = enPacksDir && path.join(enPacksDir, "backgrounds");
if (bgDir && fs.existsSync(bgDir)) {
  const deBg = readJson(comp("backgrounds")).entries || {};
  for (const f of fs.readdirSync(bgDir)) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue;
    const bg = readJson(path.join(bgDir, f));
    const enL = (bg.system && bg.system.trainedSkills && bg.system.trainedSkills.lore) || [];
    const deEntry = deBg[bg.name];
    const deL = deEntry && Array.isArray(deEntry.trainedLore) ? deEntry.trainedLore : [];
    enL.forEach((en, i) => {
      let d = deL[i];
      if (!d || !/Lore$/i.test(en)) return;
      if (!/^Kenntnis/.test(d)) d = `Kenntnis (${d})`;
      if (!lores[slug(en)]) lores[slug(en)] = d;
    });
  }
} else {
  console.warn("Hinweis: ohne pf2e-Kompendienpfad werden Kenntnis-Namen nicht übersetzt.");
}

const ui = {
  lores,
  traits,
  weaponGroups: pick(/^WeaponGroup([A-Z]\w*)$/),
  armorGroups: pick(/^ArmorGroup([A-Z]\w*)$/),
  sizes: pick(/^ActorSize([A-Z]\w*)$/),
  languages,
};

const header = `/*
 * AUTOMATISCH ERZEUGT von tools/build-dictionary.mjs – nicht von Hand bearbeiten.
 *
 * Deutsche Namen und Kurzfassungen stammen aus dem Foundry-Modul
 * "German [Pathfinder 2e]" (lang-de-pf2e, https://github.com/Foundry-VTT-PF2-German/lang-de-pf2e),
 * MIT-Lizenz, Copyright (c) 2023 Marco Seither. Die Texte basieren auf den deutschen
 * Regeltexten von Ulisses Spiele; Kurzfassungen sind automatisch gekürzt.
 */
`;
const body = `window.PF2_DICT_DATA = ${JSON.stringify({ items, ui })};\n`;
fs.writeFileSync(outFile, header + body);
console.log(
  `geschrieben: ${outFile} (${(Buffer.byteLength(body) / 1024 / 1024).toFixed(2)} MB, ` +
    `${Object.keys(items).length} Einträge, ${shortCount} Kurzfassungen, ${Object.keys(traits).length} Merkmale, ${Object.keys(lores).length} Kenntnisse)`
);
