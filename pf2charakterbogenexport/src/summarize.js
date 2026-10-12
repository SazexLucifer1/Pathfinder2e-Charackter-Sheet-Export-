/*
 * Kürzt eine (deutsche) Foundry-Beschreibung auf das Nötigste:
 * Auslöser / Voraussetzung / Häufigkeit getrennt, dazu 1–2 Sätze Regeltext.
 * Wird sowohl im Browser als auch vom Build-Skript (Node) verwendet.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PF2_SUMMARIZE = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const CHECK_NAMES = {
    fortitude: "Zähigkeitswurf",
    reflex: "Reflexwurf",
    will: "Willenswurf",
    flat: "Glückswurf",
    perception: "Wahrnehmungswurf",
  };

  function cleanInline(html) {
    return String(html || "")
      // Verweise auf Effekt-Gegenstände ("Zaubereffekt: …") sind nur Foundry-Technik
      .replace(/@UUID\[[^\]]*effect[^\]]*\](\{[^}]*\})?/gi, "")
      .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1")
      .replace(/@UUID\[[^\]]*?([^.\]]+)\]/g, "$1")
      .replace(/@Check\[[^\]]*\]\{([^}]*)\}/g, "$1")
      .replace(/@Check\[(?:type:)?(\w+)[^\]]*\]/g, (_, t) => CHECK_NAMES[t] || "Wurf")
      .replace(/@Damage\[(?:[^\[\]]|\[[^\]]*\])*\]\{([^}]*)\}/g, "$1")
      .replace(/@Damage\[\(?([\dd+\-@\w.]+)\)?\[([\w,]+)\]\]/g, (_, f, t) => `${f.replace(/(\d)d(\d)/g, "$1W$2")} ${t}`)
      .replace(/@Template\[[^\]]*\]\{([^}]*)\}/g, "$1")
      .replace(/@Template\[[^\]]*distance:(\d+)[^\]]*\]/g, "$1 Fuß")
      .replace(/@Embed\[[^\]]*\](\{[^}]*\})?/g, "")
      .replace(/@Localize\[[^\]]*\]/g, "")
      .replace(/\[\[[^\]]*\]\]\{([^}]*)\}/g, "$1")
      .replace(/\[\[\/\w+ ([^\]#]*?)(?: #[^\]]*)?\]\]/g, (_, f) => f.replace(/(\d)d(\d)/g, "$1W$2"))
      .replace(/@(?:actor|item|target|self)\S*/g, "")
      // Maßeinheiten bleiben imperial: "30 Fuß/9 m" → "30 Fuß"
      .replace(/(\d+\s*Fuß)\s*\/\s*[\d.,]+\s*(?:m|Meter)\b/g, "$1")
      .replace(/(\d+\s*Meilen?)\s*\/\s*[\d.,]+\s*km\b/g, "$1");
  }

  function htmlToText(html) {
    return cleanInline(html)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  const MECHANIC_RE =
    /\d|Bonus|Malus|SG\b|Schaden|TP\b|Aktion|Reaktion|Wurf|würf|Angriff|Zustand|Stufe|Rüstungsklasse|RK\b|Rettungs|Fertigkeit|Kompetenz|Zauber|erhältst|Erhöhe|erhöh|Treffer|Bewegungsrate|Ziel|Runde|Minute|Stunde|Fokus|wirkst|Talent|immun|Resistenz|Schwäche|Sicht\b|Dunkelsicht|Wähle|Handlung|Fuß\b|Falschen Fuß|Hand\b/i;

  function splitSentences(text) {
    // Abkürzungen ("z. B.") und Ordnungszahlen ("5. Stufe") schützen
    const protectedText = text
      .replace(/\b(z|d|u|bzw|ggf|ca|evtl|max|min|bspw|inkl|vgl|usw|S|Nr)\.\s?(?=\w)/g, "$1§ ")
      .replace(/(\d)\.\s(?=(?:Stufe|Grad|Rang|Kreis)\b)/g, "$1§ ");
    return protectedText
      .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"(])/)
      .map((s) => s.replace(/§/g, ".").trim())
      .filter(Boolean);
  }

  function shorten(sentences, maxLen) {
    // Einleitende Sätze ohne Regelmechanik (reiner Stimmungstext) überspringen
    let start = 0;
    if (sentences.length > 1 && !MECHANIC_RE.test(sentences[0])) start = 1;
    let out = "";
    for (let i = start; i < sentences.length; i++) {
      const s = sentences[i];
      if (!out) {
        out = s;
        if (out.length > maxLen) out = out.slice(0, maxLen - 1).replace(/\s+\S*$/, "") + " …";
        continue;
      }
      if (out.length + 1 + s.length > maxLen) break;
      out += " " + s;
    }
    return out;
  }

  const LABELS = {
    auslöser: "trigger",
    trigger: "trigger",
    voraussetzung: "req",
    voraussetzungen: "req",
    anforderungen: "req",
    anforderung: "req",
    requirements: "req",
    häufigkeit: "freq",
    frequency: "freq",
    kosten: "cost",
  };

  function summarize(html, maxLen) {
    if (!html) return null;
    maxLen = maxLen || 220;
    const blocks = String(html)
      .split(/<\/p>|<hr\s*\/?>|<\/li>|<\/h\d>/i)
      .map((b) => b.trim())
      .filter(Boolean);
    const res = {};
    const bodyParts = [];
    const variantParts = []; // Absätze mit Klassen-Überschrift ("<strong>Magier</strong> …")
    for (const block of blocks) {
      const labelMatch = block.match(/^\s*(?:<p>)?\s*<strong>([^<]+)<\/strong>(.*)$/is);
      if (labelMatch) {
        const label = labelMatch[1].trim().toLowerCase().replace(/[:\s]+$/, "");
        const kind = LABELS[label];
        if (kind) {
          const txt = htmlToText(labelMatch[2]).replace(/^[:\s]+/, "");
          if (txt && !res[kind]) res[kind] = shorten(splitSentences(txt), 200);
          continue;
        }
        // Erfolgsgrade und Verstärkungen gehören nicht in die Kurzfassung
        if (/erfolg|fehlschlag|success|failure|heightened|verstärkt|\(\+\d|\(\d/i.test(label)) continue;
        // Kurze Überschrift (z. B. Klassenname) → Variante, nur nutzen, wenn sonst nichts da ist
        if (label.length < 40) {
          const vt = htmlToText(labelMatch[2]);
          if (vt) variantParts.push(vt);
          continue;
        }
      }
      const txt = htmlToText(block);
      if (txt) bodyParts.push(txt);
      if (bodyParts.join(" ").length > maxLen * 3) break;
    }
    const body = bodyParts.join(" ") || variantParts[0] || "";
    if (body) res.s = shorten(splitSentences(body), maxLen);
    return Object.keys(res).length ? res : null;
  }

  // Grobe Erkennung, ob ein Text englisch ist – dann lieber keine Kurzfassung.
  function looksEnglish(html) {
    const t = htmlToText(html).toLowerCase();
    if (!t) return false;
    const en = (t.match(/\b(the|you|your|and|of|with|when|can|this|creature)\b/g) || []).length;
    const de = (t.match(/\b(der|die|das|du|dein|deine|und|mit|wenn|kannst|eine?n?)\b/g) || []).length;
    return en > de;
  }

  return { summarize, looksEnglish, htmlToText };
});
