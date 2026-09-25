# Kassensturz Planspiel — Arbeitsanweisungen

Wirtschaftspolitik-Planspiel für Lehrveranstaltungen. Studierende stellen
Steuerpolitik-Parameter ein, die Simulation zeigt sofort Haushaltssaldo,
Ungleichheit, CO₂ und BIP.

**Sprache: Deutsch.** Code-Kommentare, Bezeichner, Commit-Nachrichten und
Oberfläche sind durchgehend deutsch. Das bitte beibehalten.

## Erst lesen, dann fragen

Das Projekt ist ausführlich dokumentiert. Bevor du Architekturfragen stellst
oder rätst, sieh dort nach:

| Datei | Inhalt |
|---|---|
| `docs/ARCHITECTURE.md` | Systemüberblick, Datenfluss, Komponenten |
| `docs/ENGINE.md` | Wie die Rechenmodule arbeiten — ohne Code zu lesen |
| `docs/RECHTSSTAND.md` | Rechtsstand des Status quo (2026), je Zahl die Rechtsgrundlage — bei jeder Änderung am Status quo mitpflegen |
| `docs/API.md` | Alle Endpunkte mit Beispielen |
| `docs/DEPLOYMENT.md` | Frontend und Backend ausrollen |
| `docs/adrs/001–004` | Warum Engine im Client, warum Hono/Cloudflare, warum KV, warum Polling |
| `docs/modell/modell.pdf` | Die Engine in Worten, in Formeln und als gemessener Wirkungsgraph. Nach Änderungen an `js/rechner/` oder `data.js`: `node docs/modell/messung.js`, dann `cd docs/modell && latexmk -pdf modell.tex` — `tests/modelldoku.test.js` wird sonst rot |

Diese Datei wiederholt das nicht. Sie hält nur fest, was sonst nirgends steht.

## Befehle

```bash
npm start          # statischer Server auf :8000 (werkzeug/entwicklungsserver.js)
                   # sendet no-store — python3 -m http.server tat das nicht,
                   # und veraltete Module haben dadurch Seiten zerschossen (ADR 005)
npm test           # node --test tests/*.test.js  → aktuell rund 145 Tests
```

Unterprojekte haben eigene `package.json`:

```bash
cd api && npm run dev      # Cloudflare Worker lokal
cd api && npm run deploy   # ausrollen — nur nach Rücksprache
cd makro-planspiel && npm test
```

## Regeln, die nicht verhandelbar sind

**Modellannahmen stehen einmal, nicht zweimal.** Zinssatz und nominales
Wachstum leben in `data.js` und werden von `berechne.js`, `transition.js`
und `abgeleitet.js` importiert. Vorher rechnete der Haushalt mit 1,06 %
Zinsen, während die Schuldenfortschreibung 2,5 % ansetzte — 41 Mrd. €
jährlich, die niemandem auffielen. Siehe `entwurf/PRUEFUNG.md`.

**Jede ökonomische Annahme braucht eine Quelle.** Elastizitäten, Faktoren und
Tarifformeln stehen nicht frei im Code, sondern in `FORMEL_QUELLEN_*`-Objekten
(`BERECHNE`, `EST`, `RENTE`, `VERT`) mit `formel`, `ref` und `note`. Wer eine
Zahl ändert oder ergänzt, ergänzt dort die Fundstelle — Institut, Jahr,
Publikation. Eine Zahl ohne Beleg ist in einem Lehrplanspiel wertlos.

**SPDX-Kopf in jeder Quelldatei.** Alle 25 Dateien tragen ihn, neue auch:

```js
// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
```

**Genau eine Datei spricht mit dem Server.** Alle Netzwerkaufrufe liegen in
`js/dienste/server.js`, das Fachsprache spricht (`holeSitzung`,
`stimmeAb`) statt HTTP. Keine Oberflächendatei kennt eine URL, ein Verb
oder eine Statuszahl. `tests/architektur.test.js` erzwingt das — wer
anderswo ein `fetch(` schreibt, bekommt einen roten Test.

**Keine Adressen im Code.** Server-Adressen, Token und Schalter stehen
ausschließlich in `/konfig.js` und werden über `js/konfig.js` gelesen. Wer
eine URL direkt in eine Quelldatei schreibt, macht das Ausrollen kaputt —
und die nächste Umgebung unmöglich. Ist `api_basis` leer, läuft das
Planspiel vollständig offline; das ist ein gültiger Betriebsfall.

**Admin-Token nie in die URL.** Er geht als `Authorization: Bearer …` raus
und steht in Links nur im Fragment (`#token=…`), das kein Server je sieht.
`?token=` existiert noch als Rückfallebene für alte Links und soll
verschwinden.

**Kein Build-Schritt.** `index.html` lädt `js/verhandlungstisch.js` als
`type="module"`, der Browser löst die Imports selbst auf. Kein Bundler, kein
Transpiler, keine `node_modules` im Frontend. Wer eine npm-Abhängigkeit
einführen will, fragt vorher — das würde die Architektur ändern (siehe ADR 001).

**Ladereihenfolge der Engine beachten.** `js/rechner/berechne.js` dokumentiert
seine Abhängigkeiten im Kopf: erst `data.js`, dann `einkommensteuer.js` und
`verteilung.js`, dann die Hauptsimulation. Diese Kette nicht umbauen, ohne die
Kommentare mitzuziehen.

## Tests

`node:test` und `node:assert/strict`, kein Framework. Zwei Sorten:

- **Dimensionen** (`dimensionen.test.js`) — prüft Einheiten und Vorzeichen
  der Fiskalindikatoren, nicht Größenordnungen. Entstanden nach der
  Fachprüfung vom 12.09.2026, die zwei Skalierungsfehler fand, die keiner
  der damaligen 70 Tests fangen konnte. **Zins und Wachstum kommen aus
  `data.js` (`ZINS_EFFEKTIV`, `BIP_WACHSTUM_NOMINAL_JAHR`) — nie eigene
  Werte in einem Modul definieren**
- **Architekturgrenzen** (`architektur.test.js`) — hält die Trennung von
  Oberfläche, Kern und Außenwelt maschinell nach. Ein `todo`-Eintrag darin
  zeigt jeweils die nächste offene Etappe an
- **Invarianten** — für jede zulässige Parameterkombination müssen alle
  Kennzahlen endlich sein und in ihrem Definitionsbereich liegen
- **Komparative Statik** — die Vorzeichen der Reaktionen müssen der
  ökonomischen Theorie entsprechen
- **Keine dominante Strategie** (`dominanz.test.js`) — keine Stellgröße darf
  Saldo und alle Dezile verbessern, ohne dass Gini, Emissionen oder BIP
  schlechter werden. Entstanden nach der zweiten Fachprüfung
  (`entwurf/PRUEFUNG-2.md` I.1): Eine Senkung der Rentenbeiträge sanierte den
  Haushalt und machte alle reicher. Wer eine neue Stellgröße einführt, nimmt
  sie dort mit auf

Wer an der Engine rechnet, schreibt in dieser Form weiter. Ein Test, der nur
den Ist-Zustand festschreibt, hilft hier nicht: Er merkt nicht, wenn das
Modell ökonomisch unsinnig wird.

**Nach jeder Änderung an `js/rechner/` `npm test` laufen lassen.**

## Struktur

```
index.html            Spielfläche — Der Verhandlungstisch (seit 20.09.2026)
index-klassisch.html  die vorherige Spielfläche, bleibt als Rückfallebene
admin.html · debriefing.html · demo.html                Oberflächen, statisch
konfig.js             Laufzeitkonfiguration — wird beim Ausrollen ersetzt
css/schriften.css     lokale Schriften (fonts/), kein Google
js/konfig.js          liest konfig.js, ergänzt Vorgaben
js/dienste/server.js  der EINZIGE Ort mit fetch()
js/verhandlungstisch.js  UI-Steuerung der Spielfläche
js/spielkern.js       Übersetzung zur Engine — Stellgrößen, Kennzahlen, Runden
js/felder.js          Eingabe und Fehlerverhalten
js/planspiel.js       UI-Steuerung der klassischen Fläche
js/data.js            Wirtschaftsdaten, Kurskonfiguration, Schocks
js/data/              ausgelagerte Datensätze (presse_pool.js)
js/rechner/           die Engine — siehe docs/ENGINE.md
api/src/index.ts      Hono.js auf Cloudflare Workers (eigenes npm-Projekt)
makro-planspiel/      eigenständiges Teilprojekt mit eigenen Tests
tests/                node --test
docs/                 Architektur, Engine, API, Deployment, ADRs
entwurf/ansaetze/     zehn Gestaltungsentwürfe, fünf davon bedienbar
```

**Die Spielfläche ist der Verhandlungstisch.** Vier Ressorts, ein Gerät je
Team: keine Runde schließt, bevor alle vier gezeichnet haben. Die Regel liegt
in `js/verhandlungstisch.js` und ist bewusst KEINE Eigenschaft des Modells —
`js/spielkern.js` weiß nichts von Unterschriften.

## Vorsicht

- **`api/` ist ein getrenntes Projekt** mit eigener `package.json` und
  `wrangler.toml`. Befehle von der Wurzel aus greifen dort nicht.
- **Nichts ausrollen ohne Rückfrage.** `npm run deploy` veröffentlicht.
- **Privates Repo.** Nicht öffentlich machen, keine Inhalte nach außen geben.
