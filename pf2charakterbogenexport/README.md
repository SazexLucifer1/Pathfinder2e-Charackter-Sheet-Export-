# Pathfinder 2e – Charakterbogen-Export (Foundry VTT → Papierbogen, Deutsch)

Ein rein clientseitiges Web-Tool: Es liest einen in **Foundry VTT** (System `pf2e`) angelegten
Charakter aus der exportierten **JSON-Datei** und erzeugt daraus einen **druckfertigen,
komplett deutschen Charakterbogen im Stil der Pathfinder-2-Einsteigerbox** – für **Stufe 1 bis 20**.

Kein Server, kein Upload, keine Installation – alles läuft lokal im Browser.

## Was der Bogen kann

- **Seite 1 = klassischer Charakterbogen** im Aufbau des bekannten Einsteigerbox-Bogens:
  Würfel-, Aktions- und Kompetenzleiste links; Attributsmodifikatoren, Trefferpunkte,
  Bewegungsrate, Wahrnehmung (mit Sinnen), Fertigkeiten; Rüstungsklasse mit Schild,
  Rettungswürfe, 6 Angriffsplätze mit Mehrfachangriffsmalus, Waffenkompetenzen.
  Jeder Wert steht mit Aufschlüsselung da (Attribut + Kompetenz + Gegenstand, bei Fertigkeiten
  zusätzlich Rüstungsmalus); Kompetenz als Kästchen **G / E / M / L**.
- **Werte werden berechnet**: Foundry exportiert nur Rohdaten (keine fertigen Boni). Das Tool
  rechnet Attribute (inkl. Teilsteigerungen ab +4), RK, TP, Rettungswürfe, Wahrnehmung,
  Fertigkeiten, Angriffe/Schaden (Runen, Waffenspezialisierung, Lieblingswaffe …), Zauber-SG,
  Zauberplätze und Traglast selbst aus. Situative Boni („+2 gegen Furcht“) werden nicht
  eingerechnet – sie stehen bei der Fähigkeit.
- **Zwei Bogen-Arten**:
  - **Spielbereit** – alles ausgefüllt; leer bleibt nur, was sich während einer Spielrunde ändert
    (aktuelle TP, temporäre TP, Heldenpunkte, Sterbend/Verwundet, Zustände, aktuelle Fokuspunkte).
  - **Für Stufenaufstieg** – zusätzlich bleibt alles leer, was sich beim Stufenaufstieg ändert
    (Stufe, EP, maximale TP, Attributsmodifikatoren, Kompetenzen und Kompetenzboni, RK,
    Rettungswürfe, Wahrnehmung, Fertigkeiten, Angriffswerte inkl. Mehrfachangriffsmalus,
    Zauber-SG/-angriff, Zauberplätze, Traglast-Grenzen). Namen, Ausrüstung, Waffenwürfel
    (z. B. „2W8 + ST“), Gegenstandsboni, Talente und Zauber bleiben stehen – ideal, um die Werte
    mit Bleistift zu führen.
- **Angriffe**: Die 6 Plätze werden automatisch verteilt (normal 3 Nah- und 3 Fernkampf; gibt es
  von einer Art weniger, bekommt die andere die freien Plätze). Eine Wurfwaffe mit gleichem Angriff
  und Schaden steht nur einmal da („Nahkampfwaffe · auch Wurf 20 Fuß“). Angriffe, für die kein Platz
  mehr ist, stehen unter „Weitere Angriffe“ auf der Fähigkeiten-Seite.
- **Kernaktionen**: Sobald ein Talent oder Merkmal eine Aktion verbessert (z. B. „Dahinterturnen“
  *Hindurchturnen*), wird die Aktion ganz oben auf der Fähigkeiten-Seite erklärt – mit deinem Bonus,
  wogegen gewürfelt wird, und allen Zusatzeffekten, die deine Talente dabei auslösen. Kampfaktionen
  zuerst; Aktionen, die von denselben Talenten verbessert werden (z. B. alle Athletik-Manöver durch
  „Riesenringer“), stehen zusammen in einer Zeile.
- **Fähigkeiten & Talente** in vollständigen Sätzen (nie mitten im Satz abgeschnitten) und nach Einsatz sortiert: Aktionen &
  Reaktionen im Kampf (mit Auslöser/Voraussetzung), im Kampf immer aktiv, außerhalb des Kampfes,
  immer aktiv, schon auf Seite 1 eingerechnet.
- **Stufenplan 1–20**: bereits Gewähltes ist eingetragen – Talente, Klassenmerkmale,
  Attributsteigerungen (mit den Attributwerten danach) und Fertigkeitssteigerungen (mit dem Bonus auf
  dieser Stufe). Foundry speichert bei Fertigkeiten nur den Endstand; welche Fertigkeit auf welcher
  Stufe gesteigert wurde, wird daraus zurückgerechnet (Talent-Voraussetzungen und Regeln wie „Meister
  ab Stufe 7“ bestimmen die Reihenfolge, sonst ist sie als geschätzt markiert). Künftige
  Klassenmerkmale sind vorgemerkt, freie Plätze als Linien zum Ausfüllen.
- **Zauber** mit allen Zauberquellen (Zauber-SG, Zauberangriff), Zauberplätzen für Rang 1–10 zum
  Abhaken, Fokuspunkten und Kurzbeschreibung, Reichweite und Verteidigung jedes Zaubers.
- **Ausrüstung** gegliedert nach Ort – in der Hand, angelegt, am Körper/Gürtel (griffbereit), je
  Behälter (z. B. „Im Rucksack“), abgelegt – und darin nach Art sortiert; darunter leere Zeilen für
  „Neue Gegenstände“, die bis zum Ende der letzten Seite reichen. Alle Gegenstände mit Piktogramm je Art (Waffe, Rüstung, Schild, Trank, Öl,
  Schriftrolle, Zauberstab, Talisman, Schmuck, Werkzeug, Behälter …), Anzahl, Traglast,
  angelegt/investiert und Kurzinfo
  (Aktivierung, Wirkung, Runen); Vermögen, Traglast und Notizen.
- **Zustände** zum Ankreuzen mit Wertkästchen, Kurzerklärung und englischem Namen.
- **Komplett deutsch**: Namen von Talenten, Zaubern, Gegenständen, Merkmalen usw. stammen aus der
  offiziellen deutschen Übersetzung (siehe unten). Maßeinheiten bleiben – wie im deutschen
  Regelwerk – in Fuß.

## Benutzung

1. **In Foundry exportieren**: Im Actor-Verzeichnis mit Rechtsklick auf den Charakter →
   **„Export Data“** → eine `.json`-Datei wird heruntergeladen.
2. `index.html` im Browser öffnen (Doppelklick genügt).
3. Die `.json`-Datei hineinziehen (oder den Inhalt einfügen).
4. **Art des Bogens** wählen (spielbereit / für Stufenaufstieg) und **„Bogen erzeugen“** klicken.
   Ein Wechsel der Bogen-Art baut den Bogen sofort neu auf.
5. **„Drucken / Als PDF speichern“** → im Druckdialog *Hintergrundgrafiken* aktivieren und
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
- Seite 1 hat Platz für 3 Nah- und 3 Fernkampfangriffe (Waffen vor waffenlosen Angriffen).

## Projektstruktur

```
index.html                 Oberfläche (Upload, Bogen-Art, Bogen-Ausgabe)
src/data/dictionary-de.js  Deutsches Wörterbuch (automatisch erzeugt, s. u.)
src/summarize.js           Kürzt deutsche Beschreibungen auf 1–2 Sätze
src/dictionary.js          Nachschlagen deutscher Namen/Kurzfassungen/Merkmale
src/i18n.js                Grundbegriffe (Attribute, Fertigkeiten, Zustände)
src/skill-actions.js       Grund- und Fertigkeitsaktionen (für die Einordnung von Fähigkeiten)
src/parser.js              Foundry-JSON → berechnetes Charaktermodell
src/front.js               Seite 1: klassischer Charakterbogen
src/item-icons.js          Piktogramme für die Ausrüstungsliste
src/render.js              Folgeseiten + Bogen-Arten (spielbereit / Stufenaufstieg)
src/main.js                UI (Datei laden, Beispiele, Bogen-Art, Drucken)
styles/front.css           Aussehen aller Bogen-Seiten
styles/sheet.css           Seitengerüst (Bildschirm + Druck)
styles/app.css             Aussehen der Oberfläche
sample/                    Beispiel-Charaktere im echten Foundry-Exportformat
tools/build-dictionary.mjs Erzeugt src/data/dictionary-de.js
tools/test-parser.js       Testet Parser + Renderer (beide Bogen-Arten) mit Foundry-JSON-Dateien
tools/layout-check.js      Automatische Layout-Prüfung mit PDF und Screenshots
```

### Wörterbuch neu erzeugen

```bash
git clone --depth 1 https://github.com/Foundry-VTT-PF2-German/lang-de-pf2e
git clone --depth 1 https://github.com/foundryvtt/pf2e
node tools/build-dictionary.mjs lang-de-pf2e pf2e/static/lang/en.json pf2e/packs/pf2e
```

### Testen

```bash
node tools/test-parser.js sample                      # Beispiele: berechnete Werte je Charakter
node tools/test-parser.js pf2e/packs/pf2e/iconics     # alle Iconics des pf2e-Systems
```

### Layout-Prüfung

`tools/layout-check.js` erzeugt aus einer Foundry-JSON für beide Bogen-Arten das PDF sowie je Seite
einen Screenshot und prüft das Druck-Layout automatisch auf überlappende oder zu eng stehende
Texte, Texte, die aus ihren Kästen oder Formen (Herz, Schild, Lupe …) ragen, Rahmen außerhalb
ihres Bereichs sowie abgeschnittene Inhalte. Benötigt Node.js und Playwright (`npm i -D playwright`).

```bash
node tools/layout-check.js                      # Beispiel: Valeros
node tools/layout-check.js mein-charakter.json  # eigener Export
```

Das Ergebnis landet in `layout-check/spielbereit/` und `layout-check/aufstieg/`
(PDF + `seite-N.png`); bei Problemen endet das Skript mit Exit-Code 1.

## Quellen & Lizenzen

- Deutsche Namen und Kurzfassungen: Foundry-Modul **„German [Pathfinder 2e]“**
  ([lang-de-pf2e](https://github.com/Foundry-VTT-PF2-German/lang-de-pf2e), MIT-Lizenz,
  © Marco Seither), basierend auf den deutschen Texten von Ulisses Spiele.
- Beispiel-Charaktere: Iconics aus dem [pf2e-System für Foundry VTT](https://github.com/foundryvtt/pf2e)
  (Beschreibungstexte entfernt).
- Inoffizielles Fan-Projekt, nicht mit Paizo Inc. oder Ulisses Spiele verbunden. Pathfinder ist
  eine Marke von Paizo Inc. Dieses Werk nutzt Material gemäß der Paizo Community Use Policy.
