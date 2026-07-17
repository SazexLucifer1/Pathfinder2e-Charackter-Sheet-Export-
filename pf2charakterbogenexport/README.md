# Pathfinder 2e – Charakterbogen-Export (Foundry VTT → Papierbogen, Deutsch)

Ein kleines, rein clientseitiges Web-Tool, das einen in **Foundry VTT** (System: `pf2e`)
angelegten Charakter einliest und daraus einen **druckfertigen, deutschsprachigen
Papier-Charakterbogen** im Stil der Pathfinder-2-**Einsteigerbox** erzeugt.

Kein Server, kein Upload, keine Installation nötig – alles läuft lokal im Browser.

## Eigenschaften

- **Komplett auf Deutsch** übersetzt (Fertigkeiten, Zustände, Kompetenzstufen, Rettungswürfe usw.),
  basierend auf der offiziellen deutschen PF2-Terminologie.
- **Maßeinheiten bleiben im englischen (imperialen) System** – Geschwindigkeit wird z. B. als
  „25 Fuß" angezeigt, nicht in Meter umgerechnet (so wie es auch im deutschen Regelwerk üblich ist).
- **Für Einsteiger erklärt**: Randnotiz-Kästen erklären Kompetenz, Rüstungsklasse, Trefferpunkte,
  Rettungswürfe, Aktionen im Kampf, Zustände, Traglast usw. – im Stil der Einsteigerbox.
- **Stufen 1–20**: Der Bogen zeigt einen Stufenverlauf und hält auf der Talente-Seite genug
  leere Zeilen bereit, um neue Talente bis Stufe 20 von Hand nachzutragen.
- **Zustände-Seite**: Alle Pathfinder-2-Zustände mit Ankreuzkästchen und Wertfeld, um den
  aktuellen Zustand des Charakters während des Spiels zu markieren.
- **Talente & Fähigkeiten-Seite**: Listet alle importierten Talente/Merkmale mit Stufe, Quelle
  (Volkstalent, Klassentalent, Fertigkeitstalent, Allgemeines Talent, Klassenmerkmal …) und
  Beschreibung auf.
- Zusätzliche Seiten für Fertigkeiten & Kampf, Zauber (falls vorhanden) und Ausrüstung/Inventar.

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
- Alle Regel-Erklärtexte sind eigene, kurze Zusammenfassungen zum besseren Verständnis –
  maßgeblich bleibt immer das offizielle Regelwerk.

## Projektstruktur

```
index.html              Haupt-App (Upload-Oberfläche + Bogen-Ausgabe)
src/i18n.js              Deutsche Begriffsdatenbank (Fertigkeiten, Zustände, Kompetenz, …)
src/explanations.js      Erklär-Texte für die Randnotiz-Kästen
src/parser.js            Foundry-Actor-JSON → normalisiertes Charaktermodell
src/render.js             Charaktermodell → druckfertiges HTML
src/main.js               UI-Verdrahtung (Datei-Upload, Buttons, Fehlerbehandlung)
styles/sheet.css          Aussehen des Charakterbogens (Bildschirm + Druck)
styles/app.css            Aussehen der Upload-Oberfläche
sample/beispiel-charakter.json   Beispiel-Charakter zum Testen
```

## Haftungsausschluss

Inoffizielles Fan-Projekt, nicht mit Paizo Inc. oder Ulisses Spiele verbunden.
