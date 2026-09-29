# Recherche: Abläufe und Strukturen für mehr Tiefe

**Stand 12.09.2026.** Ergänzt [REDESIGN.md](REDESIGN.md).
Anschauen: `entwurf/tiefe.html` — vier der Muster laufen dort mit
echten Daten aus deinem Projekt.

---

## Was ich abgesucht habe

| Quelle | Ergebnis |
|---|---|
| **Mobbin** (Flow-Katalog) | **Bezahlschranke.** Die Suche verlangt ein kostenpflichtiges Abo. Nicht genutzt. |
| **Beautiful UI** (beautifului.dev) | Ergiebigste Quelle. Zwölf Bausteine, MIT-Lizenz, sechs davon passen direkt |
| **Linear** | Aktivitätsprotokoll — das Muster, das dem Teamspiel fehlt |
| **Stripe-Dokumentation** | Schichtung: Erklärung neben dem Objekt, nicht in einem eigenen Bereich |
| **shadcn/ui Blocks** | Das Standard-Dashboard. Kennst du schon, bringt hier nichts Neues |

---

## Der Befund, der mich am meisten überrascht hat

In `js/rechner/` liegen **25 belegte Quellenangaben** — Formel,
Fundstelle, Anmerkung, sauber gepflegt in den `FORMEL_QUELLEN_*`-Objekten:

| Datei | Belege |
|---|---|
| `berechne.js` | 10 |
| `verteilung.js` | 6 |
| `rente.js` | 5 |
| `einkommensteuer.js` | 4 |

Deine `CLAUDE.md` erklärt das zur nicht verhandelbaren Regel: *„Eine
Zahl ohne Beleg ist in einem Lehrplanspiel wertlos."*

**Und keine einzige dieser Quellen erscheint in der Oberfläche.** Ich
habe `planspiel.js`, `explainer.js`, `debriefing.js` und `admin.js`
durchsucht — `FORMEL_QUELLEN` kommt dort nirgends vor.

Das ist keine Designfrage, sondern die größte inhaltliche Lücke, die
ich gefunden habe. Die Arbeit ist getan, sie ist nur unsichtbar. Genau
hier setzt Muster 1 an.

---

## Die Tiefenstruktur: vier Ebenen

Tiefe heißt nicht „mehr auf den Bildschirm". Sie heißt: **jede Frage
hat eine Ebene, auf der sie beantwortet wird** — und man kommt dorthin,
ohne den Ort zu verlieren.

| Ebene | Die Frage | Heute |
|---|---|---|
| **1 — Stand** | Was gilt gerade? | Kennzahlen, vorhanden |
| **2 — Zug** | Was haben wir getan? | fehlt fast ganz |
| **3 — Ursache** | Warum ist das so? | fehlt, obwohl das Material da ist |
| **4 — Umfeld** | Was verlangt die Lage, was machen andere? | teils als Banner |

---

## Die sieben Muster

### Gebaut und anzusehen in `tiefe.html`

**1 · Herleitung auf Abruf** — Ebene 3
*Beautiful UI „Thinking / Expandable traces" (MIT) + Schichtung nach Stripe*

Unter jeder Kennzahl eine Zeile: „Wie kommt diese Zahl zustande?"
Aufgeklappt erscheint die Rechenkette Schritt für Schritt — welcher
Hebel, welcher Beitrag, welche Formel — und darunter die Quellenkarten
aus `FORMEL_QUELLEN_*`.

Das ist der Kern. Aus einem Zahlenbrett wird ein Lehrwerkzeug, ohne
dass eine einzige Zahl neu erhoben werden muss.

**2 · Entscheidungskarte statt Banner** — Ebene 4
*Beautiful UI „Approval Card" (MIT)*

Heute läuft ein Schock aus deiner Schock-Bibliothek als Hinweisbanner
durch, auf das man nichts erwidern kann. Als Karte mit zwei bis drei
Optionen — jede mit sichtbarem Preis — wird daraus ein Spielzug.
Zielkonflikte werden erfahrbar statt behauptet.

**3 · Kabinettsprotokoll** — Ebene 2
*Aktivitätsprotokoll aus Linear*

Wer hat wann welchen Hebel bewegt. Das Planspiel ist ein Teamspiel;
heute sieht niemand, wer was getan hat. Fürs Debriefing ist das die
interessanteste Frage überhaupt — und die Daten dafür laufen ohnehin
schon durch das Backend.

**4 · Periodenvergleich** — Ebene 2
*Beautiful UI „Diff Table" (MIT)*

Beim Periodenwechsel Zeile für Zeile: alter Wert, neuer Wert, Wirkung.
Unveränderte Hebel treten zurück, ohne zu verschwinden.

### Empfohlen, aber noch nicht gebaut

**5 · Beraterstimme mit Sicherheitsgrad** — Ebene 4
*Beautiful UI „Recommendation Card" (MIT)*

Ein Ressort empfiehlt etwas und sagt dazu, wie sicher es sich ist —
„hohe Sicherheit", „umstritten", „keine belastbare Evidenz". Passt zu
deiner Ressort-Struktur und ist ökonomisch ehrlich: nicht jede
Elastizität in `FORMEL_QUELLEN_*` ist gleich gut belegt, und die
`note`-Felder sagen das teilweise schon.

**6 · Teamvergleich als Tabelle** — Ebene 4
*Beautiful UI „Records Table" (MIT)*

Alle Teams nebeneinander, sortierbar nach Saldo, Gini, CO₂. Der
Endpunkt `GET /api/sessions/:id/results` liefert die Daten bereits.

**7 · Freigabestand live** — Ebene 2
*Beautiful UI „Task Rows" (MIT)*

Welches Team ist fertig, welches rechnet noch. Heute steckt der Stand
im Knopftext („0/4"). Als eigene Zeile mit Namen wird aus dem Warten
eine Information.

---

## Was das für die Struktur bedeutet

Die drei Zonen aus [REDESIGN.md](REDESIGN.md) bleiben. Die Tiefe kommt
nicht durch neue Bildschirme, sondern durch **Aufklappen am Ort**:

```
Kennzahl (Ebene 1)
  └─ Herleitung          ▸ aufklappen      (Ebene 3)
       └─ Quellenkarten  ▸ aufklappen      (Ebene 3)

Lage (Ebene 4)
  └─ Entscheidungskarte mit Optionen
  └─ Beraterstimme je Ressort

Kabinett (Ebene 2)
  └─ Protokoll           ▸ Seitenstreifen
  └─ Periodenvergleich   ▸ beim Wechsel
```

Kein Muster verlangt eine neue Seite, keines einen Dialog. Das ist
Absicht: Der Grund, warum das heutige Dossier stört, ist ja gerade,
dass es den Blick auf die Wirkung verdeckt.

**Keine neue Abhängigkeit.** Beautiful UI steht unter MIT — der Code
wird kopiert und auf die Tokens dieses Projekts umgeschrieben, so wie
die Bausteine im übrigen Entwurf auch. Kein Bundler, kein npm im
Frontend, ADR 001 bleibt unberührt.

---

## Reihenfolge, wenn du das willst

| # | Muster | Aufwand | Was es bringt |
|---|---|---|---|
| 1 | Herleitung + Quellenkarten | mittel | schließt die größte inhaltliche Lücke |
| 2 | Periodenvergleich | gering | Daten liegen vor |
| 3 | Freigabestand live | gering | Backend liefert es schon |
| 4 | Kabinettsprotokoll | mittel | Backend muss mitschreiben |
| 5 | Entscheidungskarte | mittel | Schock-Bibliothek braucht Optionen je Schock |
| 6 | Teamvergleich | gering | Endpunkt existiert |
| 7 | Beraterstimme | höher | verlangt eine Einschätzung je Quelle |

Nummer 1 ist die, bei der ich anfangen würde — sie kostet keine neuen
Inhalte, nur das Sichtbarmachen dessen, was du längst geschrieben hast.
