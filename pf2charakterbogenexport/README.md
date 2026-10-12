# Pathfinder 2e – Charakterbogen-Export (Foundry VTT → Papierbogen, Deutsch)

Ein rein clientseitiges Web-Tool: Es liest einen in **Foundry VTT** (System `pf2e`) angelegten
Charakter aus der exportierten **JSON-Datei** und erzeugt daraus einen **druckfertigen,
komplett deutschen Charakterbogen im Stil der Pathfinder-2-Einsteigerbox** – für **Stufe 1 bis 20**.

Kein Server, kein Upload, keine Installation – alles läuft lokal im Browser.

## Was der Bogen kann

- **Optik wie der Einsteigerbox-Bogen**: rote Banner, Attributskästen, RK-Schild, Trefferpunkte,
  Rettungswürfe, Fertigkeitsliste, Angriffe. Kompetenz als Kästchen **G / E / M / L**
  (Geübt, Experte, Meister, Legende), damit auch hohe Stufen abgebildet werden.
- **Werte werden berechnet**: Foundry exportiert nur Rohdaten (keine fertigen Boni). Das Tool
  rechnet Attribute (inkl. Teilsteigerungen ab +4), RK, TP, Rettungswürfe, Wahrnehmung,
  Fertigkeiten, Klassen-SG, Angriffe/Schaden (Runen, Waffenspezialisierung, Lieblingswaffe …)
  und Zauber-SG selbst aus.
  Situative Boni („+2 gegen Furcht“) werden nicht eingerechnet – sie stehen bei der Fähigkeit.
- **Fähigkeiten auf das Nötigste reduziert und nach Einsatz sortiert**:
  - **Im Kampf**: deine Aktionen & Reaktionen (mit Auslöser/Voraussetzung), passive Kampfvorteile
    und **Fertigkeitsaktionen** wie *Hindurchturnen* (Tumble Through), *Ergreifen*,
    *Demoralisieren* – jeweils mit deinem Bonus und wogegen gewürfelt wird.
  - **Außerhalb des Kampfes**: Erkundungsaktivitäten, Fertigkeitsaktionen wie *Wunden versorgen*,
    *Informationen sammeln*, Auszeit-Fähigkeiten.
  - **Immer aktiv** und **Schon eingerechnet** (Talente, die nur Zahlen verändern, erscheinen nur
    als Name).
- **Grundaktionen** (Laufen, Schritt, Schild heben …) als Kurzreferenz.
- **Zauber** mit Zauber-SG, Zauberangriff, Zauberplätzen zum Abhaken und Kurzbeschreibung.
- **Ausrüstung, Traglast, Vermögen, Notizen** und ein **Stufenplan 1–20**: bereits gewählte
  Talente sind eingetragen, künftige Klassenmerkmale vorgemerkt, freie Talentplätze zum Ausfüllen.
- **Zustände** zum Ankreuzen mit Kurzerklärung.
- **Komplett deutsch**: Namen von Talenten, Zaubern, Gegenständen, Merkmalen, Sprachen usw.
  stammen aus der offiziellen deutschen Übersetzung (siehe unten). Maßeinheiten bleiben – wie im
  deutschen Regelwerk – in Fuß.

## Benutzung

1. **In Foundry exportieren**: Im Actor-Verzeichnis mit Rechtsklick auf den Charakter →
   **„Export Data“** → eine `.json`-Datei wird heruntergeladen.
2. `index.html` im Browser öffnen (Doppelklick genügt).
3. Die `.json`-Datei hineinziehen (oder den Inhalt einfügen) → **„Bogen erzeugen“**.
4. **„Drucken / Als PDF speichern“** → im Druckdialog *Hintergrundgrafiken* aktivieren und
   „Als PDF speichern“ wählen (oder direkt drucken).

Die Beispiel-Charaktere (Valeros, Ezren, Kyra) lassen sich nur laden, wenn die Seite über einen
lokalen Webserver läuft (z. B. `python3 -m http.server` im Ordner und dann
`http://localhost:8000` öffnen) – Browser blockieren das Nachladen über `file://`.
Die eigentliche Funktion (eigene Datei laden) geht auch ohne Server.

## Grenzen

- Die Berechnung bildet die wichtigsten Foundry-Regeln nach. Exotische Regelelemente
  (z. B. Verwandlungen, Effekte, Homebrew-Skripte) werden nicht ausgewertet. Aktive Effekte
  (Buffs) aus Foundry werden bewusst ignoriert, der Bogen zeigt die Grundwerte.
- Für sehr neue oder selbst erstellte Inhalte gibt es eventuell keine deutsche Übersetzung –
  dann steht dort der Originalname und ein Hinweis.

## Projektstruktur

```
index.html                 Oberfläche (Upload + Bogen-Ausgabe)
src/data/dictionary-de.js  Deutsches Wörterbuch (automatisch erzeugt, s. u.)
src/summarize.js           Kürzt deutsche Beschreibungen auf 1–2 Sätze
src/dictionary.js          Nachschlagen deutscher Namen/Kurzfassungen/Merkmale
src/i18n.js                Grundbegriffe (Attribute, Fertigkeiten, Zustände)
src/skill-actions.js       Grund-, Fertigkeits- und Erkundungsaktionen mit Kurztexten
src/explanations.js        Erklär-Kästen
src/parser.js              Foundry-JSON → berechnetes Charaktermodell
src/render.js              Charaktermodell → druckfertiges HTML
src/main.js                UI (Datei laden, Beispiele, Drucken)
styles/sheet.css           Aussehen des Bogens (Bildschirm + Druck)
styles/app.css             Aussehen der Oberfläche
sample/                    Beispiel-Charaktere im echten Foundry-Exportformat
tools/build-dictionary.mjs Erzeugt src/data/dictionary-de.js
tools/test-parser.js       Testet Parser + Renderer mit Foundry-JSON-Dateien
```

### Wörterbuch neu erzeugen

```
git clone --depth 1 https://github.com/Foundry-VTT-PF2-German/lang-de-pf2e
git clone --depth 1 https://github.com/foundryvtt/pf2e
node tools/build-dictionary.mjs lang-de-pf2e pf2e/static/lang/en.json pf2e/packs/pf2e
```

### Testen

```
node tools/test-parser.js sample                      # Beispiele
node tools/test-parser.js pf2e/packs/pf2e/iconics     # alle Iconics des pf2e-Systems
```

## Quellen & Lizenzen

- Deutsche Namen und Kurzfassungen: Foundry-Modul **„German [Pathfinder 2e]“**
  ([lang-de-pf2e](https://github.com/Foundry-VTT-PF2-German/lang-de-pf2e), MIT-Lizenz,
  © Marco Seither), basierend auf den deutschen Texten von Ulisses Spiele.
- Beispiel-Charaktere: Iconics aus dem [pf2e-System für Foundry VTT](https://github.com/foundryvtt/pf2e)
  (Beschreibungstexte entfernt).
- Inoffizielles Fan-Projekt, nicht mit Paizo Inc. oder Ulisses Spiele verbunden. Pathfinder ist
  eine Marke von Paizo Inc. Dieses Werk nutzt Material gemäß der Paizo Community Use Policy.
