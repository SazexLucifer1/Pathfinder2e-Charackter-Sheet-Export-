# Pathfinder 2e – Charakterbogen-Export (Foundry VTT → Papierbogen, Deutsch)

Ein kleines, rein clientseitiges Web-Tool, das einen in **Foundry VTT** (System: `pf2e`)
angelegten Charakter einliest und daraus einen **druckfertigen, deutschsprachigen
Papier-Charakterbogen** im Stil der Pathfinder-2-**Einsteigerbox** erzeugt.

Kein Server, kein Upload, keine Installation nötig – alles läuft lokal im Browser.

## Eigenschaften

- **Seite 1 = klassischer Charakterbogen**: Aufbau wie der bekannte Einsteigerbox-Bogen
  (Würfel-, Aktions- und Kompetenzleiste links; Attributsmodifikatoren, Trefferpunkte,
  Bewegungsrate, Wahrnehmung, Fertigkeiten; Rüstungsklasse, Rettungswürfe, Waffen & Angriffe
  mit Mehrfachangriffsmalus, Waffenkompetenzen). Alle Werte werden mit ihrer Aufschlüsselung
  (Attribut + Kompetenz + Gegenstand) eingetragen; die Kompetenzkästchen **G/E/M/L**
  (Geübt, Experte, Meister, Legendär) und die Formel „Kompetenz = 2/4/6/8 + Stufe" machen den
  Bogen bis Stufe 20 von Hand fortschreibbar.
- **Komplett auf Deutsch** übersetzt (Fertigkeiten, Zustände, Kompetenzstufen, Rettungswürfe usw.),
  basierend auf der offiziellen deutschen PF2-Terminologie.
- **Maßeinheiten bleiben im englischen (imperialen) System** – Geschwindigkeit wird z. B. als
  „25 Fuß" angezeigt, nicht in Meter umgerechnet (so wie es auch im deutschen Regelwerk üblich ist).
- **Stufen 1–20**: Alle Werte sind aufgeschlüsselt und mit G/E/M/L-Kästchen versehen; Talente-,
  Zauber- und Ausrüstungsseite haben leere Zeilen zum Nachtragen bei jedem Stufenaufstieg.
- **Zustände-Seite**: Alle Pathfinder-2-Zustände mit Ankreuzkästchen und Wertfeld, um den
  aktuellen Zustand des Charakters während des Spiels zu markieren.
- **Talente & Fähigkeiten-Seite**: Listet alle importierten Talente/Merkmale mit Stufe, Quelle
  (Volkstalent, Klassentalent, Fertigkeitstalent, Allgemeines Talent, Klassenmerkmal …) und
  Beschreibung auf.
- **Einheitliches Design** auf allen Seiten: Charakterbogen, Zustände, Talente & Fähigkeiten,
  Zauber (nur bei Zauberwirkern, mit Zauberplätzen für Rang 1–10) und Ausrüstung (Vermögen,
  Traglast, Gegenstände, Notizen).

## Benutzung

1. **Charakter aus Foundry exportieren**: Im Actor-Verzeichnis mit Rechtsklick auf den Charakter
   → **„Export Data"** → es wird eine `.json`-Datei heruntergeladen.
2. `index.html` in einem Browser öffnen (Doppelklick genügt, es wird kein Server benötigt).
3. Die `.json`-Datei per Drag & Drop in das Feld ziehen (oder den Inhalt in das Textfeld einfügen).
4. Auf **„Bogen erzeugen"** klicken.
5. Auf **„Drucken / Als PDF speichern"** klicken und im Druckdialog des Browsers als PDF speichern
   oder direkt ausdrucken.

Zum Ausprobieren kann über den Button **„Beispiel-Charakter laden"** ein mitgelieferter
Beispiel-Charakter geladen werden (`sample/beispiel-charakter.json`). Dieser Button funktioniert
nur, wenn die Seite über einen lokalen Webserver aufgerufen wird (z. B. `python3 -m http.server`),
da Browser das Nachladen von Dateien über `file://` aus Sicherheitsgründen blockieren – die
Kernfunktion (Drag & Drop / Einfügen) ist davon nicht betroffen.

## Technische Hinweise

- Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne externe Abhängigkeiten.
- Der Parser (`src/parser.js`) liest ein Foundry-`pf2e`-Actor-Export-JSON defensiv aus:
  Foundry-Exporte unterscheiden sich je nach Systemversion leicht in ihrer Struktur; fehlende
  Felder führen zu Hinweisen auf dem Bogen statt zu Fehlern.
- Die Kurztexte zu den Zuständen sind eigene Zusammenfassungen – maßgeblich bleibt immer das
  offizielle Regelwerk.

## Layout-Prüfung

`tools/layout-check.js` erzeugt aus einer Foundry-JSON das PDF sowie je Seite einen Screenshot
und prüft das Druck-Layout automatisch auf überlappende oder zu eng stehende Texte, Texte, die aus
ihren Kästen oder Formen (Herz, Schild, Lupe …) ragen, Rahmen außerhalb ihres Bereichs sowie
abgeschnittene Inhalte. Benötigt Node.js und Playwright (`npm i -D playwright`).

```bash
node tools/layout-check.js                      # Beispiel-Charakter
node tools/layout-check.js mein-charakter.json  # eigener Export
```

Ergebnis landet in `layout-check/` (PDF + `seite-N.png`); bei Problemen endet das Skript mit Exit-Code 1.

## Projektstruktur

```
index.html              Haupt-App (Upload-Oberfläche + Bogen-Ausgabe)
src/i18n.js              Deutsche Begriffsdatenbank (Fertigkeiten, Zustände, Kompetenz, …)
src/parser.js            Foundry-Actor-JSON → normalisiertes Charaktermodell
src/front.js              Seite 1: klassischer Charakterbogen
src/render.js             Charaktermodell → druckfertiges HTML (alle Seiten)
src/main.js               UI-Verdrahtung (Datei-Upload, Buttons, Fehlerbehandlung)
styles/front.css          Aussehen aller Bogen-Seiten
styles/sheet.css          Seitengerüst (Bildschirm + Druck)
styles/app.css            Aussehen der Upload-Oberfläche
sample/beispiel-charakter.json   Beispiel-Charakter zum Testen
tools/layout-check.js     Automatische Layout-Prüfung mit Screenshots
```

## Haftungsausschluss

Inoffizielles Fan-Projekt, nicht mit Paizo Inc. oder Ulisses Spiele verbunden.
