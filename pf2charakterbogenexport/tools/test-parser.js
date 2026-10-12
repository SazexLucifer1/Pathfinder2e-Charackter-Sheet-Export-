#!/usr/bin/env node
/*
 * Testet den Parser mit echten Foundry-Charakterdateien (z. B. den Iconics/Pregens
 * aus dem pf2e-System-Repository).
 *   node tools/test-parser.js <datei.json|ordner> [...]
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
globalThis.window = globalThis;
for (const f of ["src/data/dictionary-de.js", "src/summarize.js", "src/i18n.js", "src/dictionary.js", "src/explanations.js", "src/skill-actions.js", "src/parser.js", "src/render.js"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) eval(fs.readFileSync(p, "utf-8")); // eslint-disable-line no-eval
}
function collect(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) return fs.readdirSync(p).flatMap((f) => collect(path.join(p, f)));
  return p.endsWith(".json") && !path.basename(p).startsWith("_") ? [p] : [];
}
const files = process.argv.slice(2).flatMap(collect);
const fmt = (n) => (n >= 0 ? "+" + n : String(n));
let failures = 0;
for (const f of files) {
  const raw = JSON.parse(fs.readFileSync(f, "utf-8"));
  if (raw.type !== "character") continue;
  try {
    const m = window.PF2_PARSER.parseFoundryActor(raw);
    const a = m.abilities;
    console.log(
      `${path.basename(f).padEnd(40)} L${m.meta.level} ${m.meta.className.padEnd(12)} ` +
        `ST${fmt(a.str)} GE${fmt(a.dex)} KO${fmt(a.con)} IN${fmt(a.int)} WE${fmt(a.wis)} CH${fmt(a.cha)} ` +
        `RK ${m.ac.value} TP ${m.hp.max} Zäh${fmt(m.saves.fortitude.mod)} Ref${fmt(m.saves.reflex.mod)} Wil${fmt(m.saves.will.mod)} ` +
        `Wahr${fmt(m.perception.mod)} Gesch ${m.speed.value} | ` +
        m.strikes.map((s) => `${s.name} ${fmt(s.bonus)} ${s.damage}`).join("; ")
    );
    if (process.env.VERBOSE) console.log(JSON.stringify(m, null, 1));
    if (window.PF2_RENDER) window.PF2_RENDER.render(m);
  } catch (e) {
    failures++;
    console.log(`${path.basename(f)}: FEHLER ${e.stack}`);
  }
}
process.exit(failures ? 1 : 0);
