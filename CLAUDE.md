# Hinweise für Claude

Werkzeug: `pf2charakterbogenexport/` wandelt Foundry-VTT-pf2e-Exporte (Actor-JSON) in druckbare
deutsche Charakterbögen um. Reines HTML/CSS/JS, kein Build-Schritt – `index.html` im Browser öffnen.

## Das Layout ist festgelegt – nicht neu erfinden

Die Spieler sind den Bogen aus der Beginner Box gewohnt. Das aktuelle Design ist mit dem Nutzer
abgestimmt; Änderungen nur auf ausdrücklichen Wunsch.

- **Seite 1** (`src/front.js`, `styles/front.css`): Beginner-Box-Layout auf Deutsch, bis Stufe 20
  nutzbar. 6 Angriffsfelder, Nah-/Fernkampf flexibel aufgeteilt, Wurfvarianten mit gleichen Werten
  zusammengefasst, Material farbig in Klammern.
- **Folgeseiten** (`src/render.js`) im selben Stil: Fähigkeiten & Talente (mit „Deine Kernaktionen“),
  Stufenplan, Zauber, Ausrüstung (nach Ort/Art gegliedert, Piktogramme, Leerzeilen für neue
  Gegenstände), Zustände, Notizen. Keine Erklärkästen.
- **Drei Bogen-Arten**: `spielbereit` (nur Sitzungswerte leer), `kompakt` (dazu Stichwort-Texte aus
  `src/data/stichworte.js`), `aufstieg` (zusätzlich alle stufenabhängigen Werte leer).
- Texte nie mitten im Satz abschneiden. Keine Regeltexte erfinden – unsichere Stichworte weglassen.

## Prüfen nach jeder Änderung

```bash
cd pf2charakterbogenexport
node tools/test-parser.js
node tools/layout-check.js sample/valeros-kaempfer-stufe-7.json
```

`layout-check.js` erzeugt PDF + Screenshots je Bogen-Art und meldet Überlappungen/Überläufe – die
Screenshots auch selbst ansehen. Für neue Figuren: `node tools/stichworte-fehlend.js figur.json`
listet Texte ohne Stichwortfassung.

Private Spieler-Exporte (z. B. Dettlaff, Zarion) nicht ins Repository committen.
