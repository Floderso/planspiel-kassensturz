# Architekturvorschlag — Trennung von Oberfläche und Logik

**Stand 12.09.2026 · Vorschlag, noch nichts umgesetzt.**
Ergänzt [REDESIGN.md](REDESIGN.md): dort geht es um das Aussehen,
hier um den Schnitt darunter.

---

## 1. Was heute wirklich vermischt ist

Frontend und Backend sind bereits sauber getrennt (Browser gegen
Cloudflare Worker, ADR 001–004). Der Bruch liegt **innerhalb des
Frontends**, und er lässt sich beziffern:

| Befund in `js/planspiel.js` (2 379 Zeilen) | Zahl |
|---|---|
| Zugriffe aufs DOM (`getElementById`) | 107 |
| Stellen, die HTML zusammenbauen (`innerHTML`) | 29 |
| `fetch()`-Aufrufe, über die Datei verstreut | 6 |
| CSS-Zeilen in `index.html` einbetoniert | 1 780 |

Eine Datei hält den Spielstand, ruft die Simulation, formatiert Zahlen,
zeichnet SVG-Diagramme, kennt die Spielregeln, schreibt deutsche
Fließtexte und redet mit dem Server.

### Das Beispiel, an dem man es am besten sieht

`showLockedRessortNotice()` (Zeile 892) macht in einer Funktion vier
Dinge gleichzeitig:

1. **Regel:** ab welcher Periode ein gesperrtes Ressort wieder frei wird
2. **Text:** der didaktische Erklärtext dazu
3. **Aussehen:** `style="margin-bottom:10px; color:var(--muted)"` im String
4. **DOM:** `modal.style.display = 'flex'`

Willst du nur den Abstand ändern, fasst du die Datei an, in der die
Spielregel steht. Willst du die Regel ändern, fasst du Text und Layout an.

### Der Beweis, dass es weh tut: die Tests

`tests/scaffolding.test.js` definiert die Freischaltungsregel oben im
Test **noch einmal neu** (`SCAFFOLD_PRESETS`). Nicht aus Bequemlichkeit
— die echte Regel steckt in der Oberfläche und lässt sich von außen gar
nicht importieren. Der Test prüft also eine Kopie, nicht das Original.
Die beiden können auseinanderlaufen, ohne dass irgendetwas rot wird.

`tests/modular_ui.test.js` liest `index.html` als Textdatei und sucht
nach Zeichenketten. Auch das ist kein Test der Logik, sondern ein
Notbehelf.

**Das ist der eigentliche Preis der Vermischung: Die Spielregeln sind
nicht prüfbar, weil sie in der Anzeige wohnen.**

---

## 2. Die gute Nachricht: das Muster steht schon im Repo

`makro-planspiel/` ist genau so gebaut, wie du es dir wünschst:

- `src/` — **headless**, das ganze Spiel ohne einen einzigen Bildschirm.
  Eine Datei, `src/index.js`, ist der öffentliche Zugang: „the ONLY
  entry point a UI (or a backend, or a test) needs".
- `ui/` — eine Oberfläche obendrauf, die nichts weiter tut als anzeigen.

Dort steht sogar schon die Eigenschaft, die alles zusammenhält:
gespeichert werden **nur die Eingaben** (Konfiguration, Entscheidungen,
Schocks). Der Spielzustand wird immer neu durchgerechnet. Aufzeichnung
und Simulation können gar nicht auseinanderlaufen.

Ich schlage nicht vor, etwas Neues zu erfinden, sondern **dieses Muster
auf das Hauptprojekt zu übertragen**. Es ist im selben Repo erprobt.

---

## 3. Der Vorschlag: vier Schichten, eine Richtung

```
┌─ oberflaeche/ ──────────────────────────────────────┐
│  zeichnet. Sonst nichts.                            │
│  kabinett · lage · kennzahlen · runde               │
└───────────┬──────────────────────────▲──────────────┘
            │ aktion(…)                │ ansicht
┌───────────▼──────────────────────────┴──────────────┐
│  kern/spiel.js  ── DIE FASSADE ─────────────────────│
│  der einzige Zugang. Nimmt Aktionen, gibt Ansichten │
└───────────┬──────────────────────────▲──────────────┘
            │                          │
┌───────────▼──────────┐   ┌───────────┴──────────────┐
│ kern/regeln/         │   │ kern/rechner/            │
│ Perioden, Freigabe,  │   │ UNVERÄNDERT              │
│ Quorum, Sperren      │   │ 70 Tests bleiben grün    │
└──────────────────────┘   └──────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────┐
│  dienste/  server.js · speicher.js · uhr.js         │
│  die einzigen Dateien, die die Außenwelt anfassen   │
└─────────────────────────────────────────────────────┘
```

Die Pfeile gehen nur in eine Richtung. Der Kern weiß nicht, dass es
eine Oberfläche gibt — er kennt weder `document` noch `window` noch
`fetch` noch `localStorage`.

### Was wohin wandert

| Was heute in `planspiel.js` steht | Neue Heimat |
|---|---|
| `state`, `loadState`, `saveState` | `kern/spiel.js` + `dienste/speicher.js` |
| `simulate()`, `simulierePfad` | `kern/rechner/` (bleibt) |
| `istRessortAktiv`, Sperrlogik, Freischaltung | `kern/regeln/freigabe.js` |
| `lockPeriode`, Quorum, Periodenwechsel | `kern/regeln/runde.js` |
| `fmt`, `deltaClass`, `ermittleHeroStory` | `kern/ansicht.js` |
| `apiPushState`, `apiPollSession`, 6× `fetch` | `dienste/server.js` |
| `svgLineChart`, `renderKpiStrip`, alle `render*` | `oberflaeche/` |
| `RESSORT_DEFS`, `SLIDER_SECTIONS`, `TOOLTIPS` | `kern/daten/` |

---

## 4. Das Kernstück: der Vertrag

Damit die Oberfläche wirklich jederzeit komplett austauschbar ist,
braucht es genau **zwei Berührungspunkte** — nicht mehr:

```js
import { erstelleSpiel } from '../kern/spiel.js';

const spiel = erstelleSpiel({ konfig });

spiel.abonniere(ansicht => zeichneAlles(ansicht));   // lesen
spiel.aktion({ typ: 'hebelStellen', id: 'est_spitze', wert: 45 });  // schreiben
```

Mehr darf eine Oberflächen-Datei nicht importieren. Kein `berechne.js`,
kein `fetch`, kein `localStorage`.

### Was in der „Ansicht" steht

Die Ansicht ist ein **stumpfes Datenobjekt**: fertig gerechnet, fertig
formuliert, fertig formatiert — aber ohne eine einzige Farbe, Klasse
oder HTML-Zeile.

```js
{
  periode: { nummer: 2, von: 5, gesperrt: false },

  kennzahlen: [
    { id: 'saldo', name: 'Haushaltssaldo',
      wert: -42.1, text: '−42 Mrd.',
      delta: '+8,3', signal: 'besser',
      beleg: 'BMF Haushaltsrechnung 2024' }
  ],

  ressorts: [
    { id: 'klima', name: 'Klima', gesperrt: true,
      hinweis: 'In Periode 2 nicht zur Disposition.',
      freiAbPeriode: 3 }
  ],

  erlaubt: {
    periodeAbschliessen: { ja: false, grund: 'Warten auf 2 Teams' }
  }
}
```

Drei Eigenschaften machen das stark:

**`signal: 'besser'` statt einer Farbe.** Der Kern sagt, *was* der Fall
ist. Welches Grün das ist, entscheidet allein `tokens.css`. Genau hier
greift REDESIGN.md.

**`erlaubt` statt verteilter `if`-Abfragen.** Heute prüft jede
Zeichenfunktion selbst, ob ein Knopf aktiv sein darf. Künftig sagt es
der Kern einmal — samt Begründung im Klartext.

**`beleg`.** FLOWS.md hat den wunden Punkt gefunden: 25 gepflegte
Quellenangaben in `FORMEL_QUELLEN_*`, keine einzige davon auf dem
Bildschirm. Wenn die Ansicht sie mitliefert, ist das keine Extraarbeit
mehr, sondern passiert von selbst.

---

## 5. Die Absicherung, damit es nicht wieder verwässert

Eine Ordnerstruktur allein hält nicht. Nach drei Monaten steht das
erste `fetch()` wieder in einer Zeichenfunktion. Deshalb gehören zwei
maschinelle Wächter dazu:

**`tests/architektur.test.js`** — liest alle Dateien und prüft:

- keine Datei in `oberflaeche/` importiert aus `kern/rechner/`,
  `dienste/` oder ruft `fetch` / `localStorage`
- keine Datei in `kern/` enthält `document`, `window`, `innerHTML`
- `fetch(` kommt in genau einer Datei vor: `dienste/server.js`

**Steht seit 12.09.2026 als `tests/architektur.test.js`** und hat beim
ersten Lauf sofort etwas gefunden: den QR-Code-Dienst `api.qrserver.com`,
der die Beitritts-URL an einen Fremdanbieter schickt. Er ist jetzt in
`konfig.js` abschaltbar.

Der Test prüft heute vier Grenzen und trägt eine fünfte als `todo` —
so zeigt die Testausgabe selbst an, welche Etappe als Nächstes ansteht.

**Die Regeltests werden echt.** `scaffolding.test.js` importiert dann
`kern/regeln/freigabe.js`, statt die Regel abzuschreiben. Damit prüft
er zum ersten Mal das, was im Spiel wirklich passiert.

---

## 6. Was das konkret bringt

**Die Oberfläche komplett umbauen, ohne die Simulation anzufassen.**
Das Newsroom-Layout aus REDESIGN.md, ein Hörsaal-Modus, später
vielleicht React oder Svelte — alles eine reine Frage von
`oberflaeche/`. Der Kern merkt davon nichts. (Kein Build-Schritt
bleibt trotzdem die Vorgabe; ADR 001 gilt unverändert.)

**Vier Seiten, ein Kern.** `index`, `admin`, `debriefing` und `demo`
bauen heute jede ihre eigene Variante derselben Logik. Künftig sind es
vier Oberflächen auf derselben Fassade — `admin.js` (1 073 Zeilen) und
`debriefing.js` (756) schrumpfen erheblich.

**Der Beweis ist einfach zu führen.** Wenn `entwurf/mockup.html` und
`index.html` denselben Kern benutzen und beide funktionieren, ist die
Trennung echt. Zwei Oberflächen auf einem Kern ist der einzige
belastbare Test dafür.

**Das Backend wird austauschbar.** Cloudflare durch etwas anderes
ersetzen heißt dann: eine Datei neu schreiben.

---

## 7. Weg dahin — in Etappen, nichts auf einmal

Das Planspiel ist im Lehrbetrieb. Kein Großumbau, sondern sechs
Schritte, nach jedem läuft alles:

| # | Schritt | Risiko |
|---|---|---|
| 1 | ✔ **erledigt 12.09.2026** — `js/dienste/server.js`, alle 9 Netzwerkaufrufe | gering |
| 2 | `dienste/speicher.js` — `localStorage` an eine Stelle | gering |
| 3 | `kern/regeln/` — Sperren, Freigabe, Quorum herausziehen, echte Tests dazu | mittel |
| 4 | `kern/spiel.js` — Fassade und `abonniere()` einziehen | mittel |
| 5 | `kern/ansicht.js` — Formatierung und Textbausteine dorthin | mittel |
| 6 | `oberflaeche/` — die `render*`-Funktionen aufteilen, CSS nach REDESIGN.md | hoch |

Schritt 1 und 2 sind an einem Abend erledigt und lohnen sich schon für
sich. Schritt 3 bringt den größten Gewinn, weil dort die Tests echt
werden. Erst Schritt 6 fasst das Aussehen an — und zu dem Zeitpunkt ist
es risikolos, weil darunter nichts mehr liegt, was kaputtgehen kann.

---

## 8. Was ausdrücklich bleibt

- **Kein Build-Schritt, keine npm-Abhängigkeit im Frontend** (ADR 001)
- **`js/rechner/` unverändert** — die Engine ist bereits sauber: kein
  `document`, kein `window`, kein `Math.random`. Sie ist nicht das Problem.
- **Deutsch als Projektsprache**, auch in den neuen Ordnernamen
- **Die Belegpflicht** aus `CLAUDE.md` — sie wird durch `beleg` in der
  Ansicht sogar sichtbar belohnt
- **Die 70 Tests** bleiben grün; es kommen welche dazu, es fällt keiner weg
