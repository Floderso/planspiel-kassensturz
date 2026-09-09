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
| `docs/API.md` | Alle Endpunkte mit Beispielen |
| `docs/DEPLOYMENT.md` | Frontend und Backend ausrollen |
| `docs/adrs/001–004` | Warum Engine im Client, warum Hono/Cloudflare, warum KV, warum Polling |

Diese Datei wiederholt das nicht. Sie hält nur fest, was sonst nirgends steht.

## Befehle

```bash
npm start          # statischer Server auf :8000 (python3 -m http.server)
npm test           # node --test tests/*.test.js  → aktuell 70 Tests
```

Unterprojekte haben eigene `package.json`:

```bash
cd api && npm run dev      # Cloudflare Worker lokal
cd api && npm run deploy   # ausrollen — nur nach Rücksprache
cd makro-planspiel && npm test
```

## Regeln, die nicht verhandelbar sind

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

**Kein Build-Schritt.** `index.html` lädt `js/planspiel.js` als
`type="module"`, der Browser löst die Imports selbst auf. Kein Bundler, kein
Transpiler, keine `node_modules` im Frontend. Wer eine npm-Abhängigkeit
einführen will, fragt vorher — das würde die Architektur ändern (siehe ADR 001).

**Ladereihenfolge der Engine beachten.** `js/rechner/berechne.js` dokumentiert
seine Abhängigkeiten im Kopf: erst `data.js`, dann `einkommensteuer.js` und
`verteilung.js`, dann die Hauptsimulation. Diese Kette nicht umbauen, ohne die
Kommentare mitzuziehen.

## Tests

`node:test` und `node:assert/strict`, kein Framework. Zwei Sorten:

- **Invarianten** — für jede zulässige Parameterkombination müssen alle
  Kennzahlen endlich sein und in ihrem Definitionsbereich liegen
- **Komparative Statik** — die Vorzeichen der Reaktionen müssen der
  ökonomischen Theorie entsprechen

Wer an der Engine rechnet, schreibt in dieser Form weiter. Ein Test, der nur
den Ist-Zustand festschreibt, hilft hier nicht: Er merkt nicht, wenn das
Modell ökonomisch unsinnig wird.

**Nach jeder Änderung an `js/rechner/` `npm test` laufen lassen.**

## Struktur

```
index.html · admin.html · debriefing.html · demo.html   Oberflächen, statisch
js/planspiel.js       UI-Steuerung, URL-Konfiguration, API-Abgleich
js/data.js            Wirtschaftsdaten, Kurskonfiguration, Schocks
js/data/              ausgelagerte Datensätze (presse_pool.js)
js/rechner/           die Engine — siehe docs/ENGINE.md
api/src/index.ts      Hono.js auf Cloudflare Workers (eigenes npm-Projekt)
makro-planspiel/      eigenständiges Teilprojekt mit eigenen Tests
tests/                node --test
docs/                 Architektur, Engine, API, Deployment, ADRs
```

## Vorsicht

- **`api/` ist ein getrenntes Projekt** mit eigener `package.json` und
  `wrangler.toml`. Befehle von der Wurzel aus greifen dort nicht.
- **Nichts ausrollen ohne Rückfrage.** `npm run deploy` veröffentlicht.
- **Privates Repo.** Nicht öffentlich machen, keine Inhalte nach außen geben.
