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
      // Aktionssymbole der Foundry-Schrift
      .replace(/<span class="action-glyph">\s*([^<]*?)\s*<\/span>/gi, (_, g) => ({ "1": "◆", A: "◆", a: "◆", "2": "◆◆", D: "◆◆", d: "◆◆", "3": "◆◆◆", T: "◆◆◆", t: "◆◆◆", R: "⤾", r: "⤾", F: "◇", f: "◇" })[g] || g)
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
      const labelMatch = block.match(/^\s*(?:<p>)?\s*(?:<em>)?\s*<strong>([^<]+)<\/strong>(.*)$/is);
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
          // Englische Varianten (noch nicht übersetzt) weglassen
          if (vt && !looksEnglish(labelMatch[2])) variantParts.push({ label: labelMatch[1].trim().replace(/[:\s]+$/, ""), text: vt });
          continue;
        }
      }
      const txt = htmlToText(block);
      if (txt) bodyParts.push(txt);
      if (bodyParts.join(" ").length > maxLen * 3) break;
    }
    const body = bodyParts.join(" ") || (variantParts[0] && variantParts[0].text) || "";
    if (body) res.s = shorten(splitSentences(body), maxLen);
    // Klassenvarianten ("Streiter: …", "Mystiker: …") – zur Laufzeit passend zur Klasse gewählt
    if (variantParts.length > 1) {
      res.v = variantParts.map((v) => [v.label, shorten(splitSentences(v.text), maxLen)]);
    }
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

  /**
   * Kurzfassung für Gegenstände: Beschreibung + Aktivierung/Häufigkeit/Effekt
   * und ggf. die Zauberliste von Stecken.
   */
  const ITEM_LABELS = {
    aktivierung: "act", aktivieren: "act", activate: "act",
    häufigkeit: "freq", frequency: "freq",
    effekt: "eff", effect: "eff",
    auslöser: "trigger", trigger: "trigger",
    voraussetzung: "req", voraussetzungen: "req", anforderungen: "req", requirements: "req",
    nutzung: "use", usage: "use",
  };
  const ITEM_RULE_RE =
    /\d|Bonus|Malus|SG\b|Schaden|TP\b|Aktion|Reaktion|Wurf|würf|Angriff|Zustand|Rüstungsklasse|\bRK\b|Rettungs|Fertigkeit|Kompetenz|Zauber|erhältst|erhält|Erhöhe|erhöh|Treffer|Bewegungsrate|Ladung|investier|aktivier|kannst|Resistenz|Immun|Runde|Minute|Stunde|Traglast|Wirkung|Effekt|Rune/i;
  const SKIP_LABEL = /herstellung|craft|hinweis|note|kritisch|erfolg|fehlschlag|success|failure|typ\b|type\b|stufe\s*\d|level/i;

  function summarizeItem(html, maxLen) {
    if (!html) return null;
    maxLen = maxLen || 260;
    const blocks = String(html)
      .split(/<\/p>|<hr\s*\/?>|<\/li>|<\/h\d>/i)
      .map((b) => b.trim())
      .filter(Boolean);
    const res = {};
    const body = [];
    const spells = [];
    for (const block of blocks) {
      const m = block.match(/^\s*(?:<ul>\s*)?(?:<li>|<p>)?\s*<strong>([^<]+)<\/strong>(.*)$/is);
      if (m) {
        const rawLabel = m[1].trim();
        const label = rawLabel.toLowerCase().replace(/[:\s]+$/, "");
        const text = htmlToText(m[2]).replace(/^[:\s–—-]+/, "");
        const key = ITEM_LABELS[label.split(/\s*[—–-]\s*/)[0]];
        if (key) {
          const extra = key === "act" && /[—–-]/.test(rawLabel) ? rawLabel.split(/\s*[—–-]\s*/).slice(1).join(" ") + ": " : "";
          if (text && !res[key]) res[key] = shorten(splitSentences(extra + text), key === "eff" ? 240 : 160);
          continue;
        }
        if (/^(zaubertrick|cantrip|grad \d+|\d+\.? grad|rank \d+|\d+(st|nd|rd|th))/i.test(label)) {
          if (text) spells.push(`${rawLabel.replace(/:$/, "")}: ${text}`);
          continue;
        }
        if (SKIP_LABEL.test(label)) continue;
      }
      if (/^\s*<p>\s*<em>\s*(Hinweis|Note)/i.test(block)) continue;
      const t = htmlToText(block);
      if (t) body.push(t);
      if (body.join(" ").length > maxLen * 3) break;
    }
    if (body.length) {
      // Nur Sätze mit Regelinhalt; reiner Stimmungstext ("Ihre Klingen sind schwer …") entfällt
      const all = splitSentences(body.join(" "));
      const rules = all.filter((x) => ITEM_RULE_RE.test(x));
      let out = "";
      for (const x of rules) {
        if (!out) out = x.length > maxLen ? x.slice(0, maxLen - 1).replace(/\s+\S*$/, "") + " …" : x;
        else if (out.length + 1 + x.length <= maxLen) out += " " + x;
        else break;
      }
      if (!out && all.join(" ").length <= 60) out = all.join(" ");
      if (out) res.s = out;
    }
    if (spells.length) res.sp = spells.slice(0, 12);
    return Object.keys(res).length ? res : null;
  }

  return { summarize, summarizeItem, looksEnglish, htmlToText };
});
