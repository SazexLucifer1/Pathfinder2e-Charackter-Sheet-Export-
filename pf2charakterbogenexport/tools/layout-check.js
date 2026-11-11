#!/usr/bin/env node
/*
 * Layout-Prüfung für den Charakterbogen.
 *
 *   node tools/layout-check.js [beispiel.json] [ausgabe-ordner]
 *
 * Startet einen lokalen Server, lädt die JSON (Standard: Beispiel-Charakter),
 * erzeugt daraus für beide Bogen-Arten ("spielbereit" und "aufstieg") das PDF
 * und je Seite einen PNG-Screenshot (Unterordner je Art) und prüft im
 * Druck-Layout automatisch:
 *   - Texte, die sich überlappen oder zu eng beieinander stehen
 *   - Texte, die aus ihrem Kasten, Feld oder ihrer Form (Herz, Schild …) ragen
 *   - Rahmen/Kästchen, die über ihr Panel oder die Seite hinausragen
 *   - abgeschnittene Inhalte und JavaScript-Fehler
 * Exit-Code 1, wenn etwas gefunden wurde.
 *
 * Benötigt Playwright mit Chromium (npm i -D playwright).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const jsonPath = path.resolve(process.argv[2] || path.join(ROOT, "sample/valeros-kaempfer-stufe-7.json"));
const outDir = path.resolve(process.argv[3] || path.join(ROOT, "layout-check"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html");
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  let failed = false;
  for (const mode of ["spielbereit", "aufstieg"]) {
  const dir = path.join(outDir, mode);
  fs.mkdirSync(dir, { recursive: true });
  const p = await (await b.newContext({ deviceScaleFactor: 2 })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(url);
  await p.check(`input[name="sheet-mode"][value="${mode}"]`);
  // Große Exporte direkt setzen (fill() tippt zu langsam)
  await p.evaluate((t) => { document.getElementById("json-paste").value = t; }, fs.readFileSync(jsonPath, "utf8"));
  await p.click("#generate-btn");
  await p.waitForSelector(".cs-front");
  await p.pdf({ path: path.join(dir, "charakterbogen.pdf"), format: "A4", printBackground: true });
  // Druck-Layout nachstellen: A4 minus 8 mm Rand = 194 mm ≈ 733 px Breite
  await p.emulateMedia({ media: "print" });
  await p.setViewportSize({ width: 733, height: 1000 });
  await p.waitForTimeout(200);
  const pages = await p.$$(".sheet-page");
  for (let i = 0; i < pages.length; i++) {
    await pages[i].screenshot({ path: path.join(dir, `seite-${i + 1}.png`), scale: "device" });
  }
  const issues = await p.evaluate(() => {
    const out = [];
    const label = (el) => {
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      const panel = el.closest('.cs-panel');
      const where = panel ? ' in ' + [...panel.classList].filter((c) => c !== 'cs-panel')[0] : '';
      return `${el.className || el.tagName}「${t}」${where}`;
    };
    // 1) Text-Rechtecke pro Textknoten sammeln
    const texts = [];
    const walker = document.createTreeWalker(document.querySelector('.pf2-sheet'), NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const rc of r.getClientRects()) if (rc.width > 0.5 && rc.height > 0.5) texts.push({ el, rc, page: el.closest('.sheet-page') });
    }
    // 2) Überlappung zwischen Texten verschiedener Elemente
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], c = texts[j];
      if (a.el === c.el || a.page !== c.page) continue;
      const ox = Math.min(a.rc.right, c.rc.right) - Math.max(a.rc.left, c.rc.left);
      const oy = Math.min(a.rc.bottom, c.rc.bottom) - Math.max(a.rc.top, c.rc.top);
      if (ox > 0.8 && oy > 2) out.push(`ÜBERLAPPUNG ${label(a.el)} ↔ ${label(c.el)} (${ox.toFixed(1)}×${oy.toFixed(1)}px)`);
    }
    // 3) Text ragt aus Panel / Formfeld / Seite heraus
    const boxSel = '.cs-panel, .cs-shape, .cs-stat-box, .cs-abil-box, .cs-map, .cs-cond-val, .cs-id > div, .cs-skill-calc, .sheet-page, td, th';
    for (const t of texts) {
      const box = t.el.closest(boxSel); if (!box) continue;
      const br = box.getBoundingClientRect();
      const tol = -0.5; // Text muss mind. 0,5 px Abstand zum Rand seines Kastens haben
      if (t.rc.left < br.left - tol || t.rc.right > br.right + tol || t.rc.top < br.top - tol || t.rc.bottom > br.bottom + tol)
        out.push(`RAGT HERAUS ${label(t.el)} aus ${box.className || box.tagName}`);
    }
    // 3b) Texte, die eine gezeichnete Form berühren, müssen in deren Innenbereich liegen
    const SAFE = { heart: [0.2, 0.27, 0.2, 0.3], lens: [0.15, 0.15, 0.33, 0.33], shield: [0.1, 0.08, 0.1, 0.18],
      box: [0.08, 0.1, 0.08, 0.1], arrow: [0.04, 0.24, 0.36, 0.24], melee: [0.05, 0.1, 0.2, 0.1], ranged: [0.24, 0.32, 0.24, 0.04] };
    document.querySelectorAll('.cs-shape').forEach((sh) => {
      const kind = [...sh.classList].find((c) => c.startsWith('cs-shape-')).slice(9);
      const f = SAFE[kind]; if (!f) return;
      const r = sh.getBoundingClientRect();
      const safe = { l: r.left + r.width * f[0], t: r.top + r.height * f[1], r: r.right - r.width * f[2], b: r.bottom - r.height * f[3] };
      for (const t of texts) {
        const hit = t.rc.right > r.left && t.rc.left < r.right && t.rc.bottom > r.top && t.rc.top < r.bottom;
        if (!hit) continue;
        if (t.rc.left < safe.l || t.rc.right > safe.r || t.rc.top < safe.t || t.rc.bottom > safe.b)
          out.push('BERÜHRT KONTUR ' + label(t.el) + ' in Form ' + kind);
      }
    });
    // 3c) Mindestabstand zwischen Texten (1 px ≈ 0,26 mm)
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], c = texts[j];
      if (a.el === c.el || a.page !== c.page) continue;
      const gx = Math.max(a.rc.left, c.rc.left) - Math.min(a.rc.right, c.rc.right);
      const gy = Math.max(a.rc.top, c.rc.top) - Math.min(a.rc.bottom, c.rc.bottom);
      // Buchstaben in getrennten, umrandeten Kästchen (G/E/M/L, W/S/H, Sterbend 1–4) stören sich nicht
      const boxed = '.cs-teml, .cs-dtype, .cs-dying';
      if (a.el.closest(boxed) && a.el.closest(boxed) === c.el.closest(boxed)) continue;
      if (gx < 1.2 && gy < 0.5 && !(gx < 0.8 && gy < -2)) out.push('ZU ENG ' + label(a.el) + ' ↔ ' + label(c.el));
    }
    // 3d) Rahmen/Kästchen/Formen müssen vollständig in ihrem Panel bzw. ihrer Seite liegen
    document.querySelectorAll('.pf2-sheet .sheet-page *').forEach((el) => {
      if (el.closest('svg') || el.closest('.cs-lines')) return; // .cs-lines: Füllzeilen, bewusst abgeschnitten
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
      const cont = el.parentElement.closest('.cs-panel, .cs-id, .sheet-page');
      if (!cont) return;
      const c = cont.getBoundingClientRect();
      if (r.left < c.left - 0.5 || r.right > c.right + 0.5 || r.top < c.top - 0.5 || r.bottom > c.bottom + 0.5)
        out.push('BOX RAGT HERAUS ' + label(el) + ' aus ' + (cont.className || cont.tagName) + ' (' + Math.round(Math.max(c.left - r.left, r.right - c.right, c.top - r.top, r.bottom - c.bottom)) + 'px)');
    });
    // 4) abgeschnittene Inhalte
    document.querySelectorAll('.pf2-sheet *').forEach((el) => {
      if (el.classList.contains('cs-lines')) return;
      const cs = getComputedStyle(el);
      if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
        out.push(`ABGESCHNITTEN ${label(el)} ${el.clientWidth}/${el.scrollWidth} × ${el.clientHeight}/${el.scrollHeight}`);
    });
    return [...new Set(out)];
  });
  console.log(`== Bogen-Art: ${mode} ==`);
  console.log(errs.length ? "JS-FEHLER: " + errs.join("; ") : "JS-Fehler: keine");
  console.log(issues.length ? issues.join("\n") : "Keine Layout-Probleme gefunden.");
  console.log(`${pages.length} Seiten – PDF und Screenshots in ${dir}`);
  if (errs.length || issues.length) failed = true;
  await p.close();
  }
  await b.close();
  server.close();
  process.exit(failed ? 1 : 0);
})();
