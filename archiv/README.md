# Archiv

Seit 29.09.2026 ist der Verhandlungstisch (`/index.html`) die einzige
Spielfläche. Was hier liegt, ist abgelöst, wird nicht gepflegt und von
`npm test` nicht geprüft.

Die Ordnerstruktur spiegelt die des Projekts, damit die Seiten sich
weiterhin gegenseitig finden. Verweise auf Engine, Schriften und
`konfig.js` zeigen auf die lebenden Dateien außerhalb von `archiv/` —
die Seiten öffnen sich also noch (`npm start`, dann
`http://localhost:8000/archiv/…`), rechnen aber mit der aktuellen Engine.

| Was | Wo |
|---|---|
| Klassische Spielfläche | `index-klassisch.html`, `js/planspiel.js` |
| Prototyp-Demo | `demo.html` |
| Gestaltungsversuche nach dem Redesign | `kabinett.html`, `registerband.html`, `haushaltsplan.html` mit `js/` und `css/` |
| Startoberfläche, fünf Konzepte | `news_portal_mockup.html` |
| Zehn Ansätze, vier Welten, Mockups | `entwurf/`, `js/entwurf/` |
| Test der klassischen Fläche | `tests/modular_ui.test.js` — `node --test archiv/tests/` |

Die API hält die Endpunkte der klassischen Fläche weiter bereit
(`docs/API.md`). Ob sie entfallen können, ist nicht entschieden.
