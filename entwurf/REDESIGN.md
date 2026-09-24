# Redesign-Vorschlag — Kassensturz Planspiel

**Stand 12.09.2026 · Entwurf, noch nichts umgesetzt.**
Das laufende Projekt ist unberührt. Alles Neue liegt in `entwurf/`.

Anschauen: `npm start`, dann `http://localhost:8000/entwurf/mockup.html`

---

## 1. Was ich vorgefunden habe

Kein Totalschaden — im Gegenteil. Die Newsroom-Idee trägt, die
Kennzahlen sind gut gewählt, und es gibt bereits Design-Tokens mit
sinnvollen Namen (`--accent`, `--ink`, `--surface`). Das Fundament
steht. Was fehlt, ist die Disziplin, es auch zu benutzen.

| Was | Zahl |
|---|---|
| CSS-Zeilen, in vier HTML-Dateien einbetoniert | 2 921 |
| Feste Farbwerte neben den Tokens | 235 |
| davon allein in `index.html` | 117 |
| `js/planspiel.js` — Zustand, Anzeige und Server in einer Datei | 102 KB |
| `fetch()`-Aufrufe über diese Datei verstreut | 6 |

### Die vier Befunde

**Die Tokens sind da, aber sie regieren nicht.** Neben 34 sauber
benannten Variablen stehen 235 feste Farbwerte. Eine Farbe zu ändern
heißt heute: 235 Stellen suchen und hoffen, keine übersehen zu haben.

**Die Tokens driften schon auseinander.** `--radius` ist in drei
Dateien 6px und in `demo.html` 8px. Niemand hat das entschieden, es ist
passiert. Genau so fangen vier Blautöne an.

**Die Grundschrift ist 13px.** Für eine Anwendung, die im Hörsaal an
die Wand geworfen wird, ist das zu klein. Das ist der Befund, der am
meisten Menschen betrifft und am leichtesten zu beheben ist.

**Die Schrift kommt von Google.** Jeder Seitenaufruf meldet sich bei
`fonts.googleapis.com`. Bei einer Uni-Anwendung mit Matrikelnummern im
Spiel ist das unnötig — die Schriften können im Projekt liegen.

---

## 2. Der Vorschlag zur Trennung

Du wolltest Frontend und Backend klarer trennen. Der eigentliche Bruch
liegt woanders: **Frontend und Backend sind bereits getrennt** (Browser
gegen Cloudflare Worker, sauber per REST, in ADR 001 bis 004
begründet). Was fehlt, ist die Trennung *innerhalb* des Frontends.

Heute macht `js/planspiel.js` auf 102 KB vier Dinge gleichzeitig:
Zustand halten, rechnen lassen, Bildschirm zeichnen, mit dem Server
reden. Deshalb kann man das Aussehen nicht ändern, ohne die Spiellogik
anzufassen — und umgekehrt.

### So sähe es danach aus

```
css/
  tokens.css           ← die einzige Quelle für Farbe, Schrift, Abstand, Zeit
  basis.css            ← Grundgerüst, Typografie, Fokus
  bausteine/           ← karte · hebel · kennzahl · knopf · marke …
  seiten/              ← planspiel · admin · debriefing

js/
  rechner/             ← unverändert. Reine Rechenlogik, 70 Tests bleiben grün
  daten/               ← unverändert
  dienste/
    api.js             ← die EINZIGE Datei mit fetch(). Sonst nirgends
    speicher.js        ← localStorage, an einer Stelle
    zustand.js         ← der Spielstand und wer darauf hört
  oberflaeche/
    kabinett.js        ← zeichnet die Hebel
    lage.js            ← zeichnet Schlagzeile und Wirkung
    kennzahlen.js      ← zeichnet die rechte Spalte
    runde.js           ← Periodenwechsel, Freigabe
```

Die Regel dahinter in einem Satz: **Genau eine Datei spricht mit dem
Server, genau eine Datei kennt den Spielstand, und keine Datei, die
zeichnet, tut beides.**

Was das praktisch bringt: Das Backend lässt sich austauschen, ohne die
Oberfläche anzufassen. Die Oberfläche lässt sich umbauen, ohne dass die
Simulation etwas merkt. Und wenn etwas kaputtgeht, weiß man, wo.

**Kein Build-Schritt, keine neue Abhängigkeit.** Das bleibt so. CSS
wird über mehrere `<link>` geladen, JavaScript über die ES-Module, die
der Browser ohnehin schon selbst auflöst. Die Regeln aus `CLAUDE.md`
und ADR 001 gelten unverändert.

---

## 3. Der Vorschlag zum Aussehen

### Deine Farben, als System

Aus `Designe idehen planspiel/Farben.rtf`:

| Farbe | Wert | Rolle |
|---|---|---|
| Fresh Sky | `#00a7e1` | Akzent — Knöpfe, Auswahl, aktive Periode |
| Dusty Mauve | `#b0413e` | Negativsignal — Defizit, verfehlte Grenze |
| Sage Green | `#6baa75` | Positivsignal — Entlastung, Ziel erreicht |

Eine Einschränkung, die du kennen musst: **alle drei sind als Vollton
zu hell für weißen Text.** Fresh Sky mit Weiß darauf erreicht 2,5:1 —
gefordert sind 4,5:1. Deshalb liegen sie im Entwurf nicht als drei
Einzelfarben vor, sondern als drei *Familien* mit je zwölf Stufen. Der
Originalton bleibt als helle Stufe erhalten, für Text und Knopfflächen
wird eine dunklere Stufe derselben Farbe benutzt. Von außen sieht man
weiter deine Palette, sie ist nur lesbar.

Geprüft mit `kontrast-pruefen.py`: **22 Farbpaare, alle bestehen
WCAG 2.2 AA — hell und dunkel.**

### Ein dunkles Thema, „Hörsaal-Modus"

Kostet nichts, weil nur die Rohwerte getauscht werden. Nützlich, wenn
projiziert wird oder abends gespielt.

### Keine getönten Flächen

**Entschieden am 12.09.2026.** Blass hinterlegte Marken — ein Rosa-Feld
hinter „Schuldenbremse verfehlt", ein Grün-Feld hinter „entlastet" —
wirken hingehaucht statt entschieden. Sie sind im Entwurf durchgehend
ersetzt:

| Wo | Vorher | Jetzt |
|---|---|---|
| Rubrik, Urteile, Stufenmarken | getönte Fläche | fett gesetzter Text in der Signalfarbe |
| Aktive Periode | hellblaue Fläche | Vollton-Kreis, Rahmen und Text in Akzentfarbe |
| Erledigte Periode | grüne Fläche | Kontur und Häkchen in Grün |
| Nummernkreise, Ressortsymbole, Zähler | graue Fläche | 1px-Kontur |
| Zeilen im Wirkungsband | graue Fläche | Trennlinie darüber |

Die Regel dahinter: **Flächen tragen keine Bedeutung. Bedeutung tragen
Text, Kante und Vollton.** Eine Ausnahme bleibt — die Bahn des
Schiebereglers, weil man sonst nicht sieht, wie weit der Regler noch
kann. Sie ist im CSS als Ausnahme kommentiert.

Das hat eine Folge, die man wissen muss: Ohne Fläche hängt die
Lesbarkeit allein am Text. Deshalb liegt in `entwurf/` ein zweites
Prüfskript, das genau diese Paare nachrechnet:

```bash
python3 entwurf/kontrast-projektpaare.py entwurf/tokens.css
```

22 Paare, alle bestehen — hell wie dunkel. Die niedrigsten Werte sind
die Konturen mit 3,34:1 (gefordert: 3,0 für Bedienelemente), der
schwächste Text liegt bei 6,57:1 (gefordert: 4,5).

### Schrift

| Rolle | Schrift | Anmerkung |
|---|---|---|
| Logo | Bespoke Stencil | **als SVG, nicht als Schriftdatei** — siehe unten |
| Schlagzeilen | Newsreader | bleibt, passt zur Zeitungsmetapher |
| Oberfläche | Inter | bleibt |
| Zahlen | JetBrains Mono | bleibt, wichtig für Tabellenziffern |

Grundgröße **13px → 16px**.

**Zur Lizenz von Bespoke Stencil:** Die Fontshare-EULA
(`License/FFL.txt`, Abschnitt 27) untersagt ausdrücklich, die
Schriftdatei auf einen öffentlichen Server zu laden. Auf
kassensturz.org dürfte sie also nicht als `.ttf` liegen. Erlaubt ist
dagegen, aus der Schrift ein Logo zu setzen und als Vektorgrafik zu
exportieren — das steht in derselben Lizenz unter „Grant of License".
Für ein Logo ist das ohnehin der bessere Weg: kein fremder Server,
kein Nachladen, gestochen scharf. Für Fließtext wäre eine
Schablonenschrift auch schlecht lesbar.

Im Mockup ist sie lokal eingebunden, damit du sie in Aktion siehst.
Das ist zulässig, solange es auf deinem Rechner bleibt.

---

## 4. Der Vorschlag zur Bedienung

Hier steckt die eigentliche Änderung — und die eine These, über die du
entscheiden musst.

### Das Problem

Heute steckt der eigentliche Spielzug — an den Hebeln drehen — hinter
einem Dialog. Man öffnet das Dossier, verstellt etwas, schließt es
wieder und sucht dann, was sich geändert hat. **Ursache und Wirkung
sind nie gleichzeitig sichtbar.** Genau das ist aber das, was
Studierende lernen sollen.

Dazu kommen drei Wege zur selben Sache: ein Dropdown „Ministerium
konsultieren", ein Knopf „Alle 4 Ministerien-Karten einblenden" und die
Ressort-Kacheln. Und der „Lagebericht" startet leer und bleibt leer,
bis man ein Menü findet.

### Die Lösung: drei Zonen, alles gleichzeitig sichtbar

```
┌──────────────────────────────────────────────────────────────┐
│  Kassensturz Planspiel    Team A   2025–2028   [Hörsaal] …   │
├──────────────────────────────────────────────────────────────┤
│  ✓2021–24   ①2025–28   ②2029–32   ③2033–36   ④…   ⑤…       │
├───────────────┬─────────────────────────────┬────────────────┤
│  KABINETT     │  LAGE                       │  KENNZAHLEN    │
│               │                             │                │
│  € Finanzen ③ │  VERFASSUNGSSTREIT          │ HAUSHALTSSALDO │
│   Grundfrei…  │                             │  −116   +18,4  │
│   ▬▬▬●▬▬▬▬    │  Haushaltsloch reißt        │  ╭─╮───────    │
│   Eingangs…   │  Schuldenbremse um          │  Defizit       │
│   ▬▬●▬▬▬▬▬    │  116 Mrd. Euro              │                │
│   Spitzen…    │                             │ SONNTAGSFRAGE  │
│   ▬▬▬▬●▬▬▬    │  ─────────────────────      │  40 %   −2,1   │
│               │  Was deine drei             │                │
│  ⚕ Soziales ⓪ │  Änderungen bewirken        │ GINI           │
│  ♻ Klima    ⓪ │   Saldo    +18,4  entlastet │  0,377  −0,006 │
│  ⚙ Wirtschaft⓪│   Gini     −0,006 gleicher  │                │
│               │   Sonntag  −2,1   unbeliebt │ SCHULDENSTAND  │
│               │   BIP      −0,1   kaum      │  63,5 %  ±0,0  │
├───────────────┴─────────────────────────────┴────────────────┤
│ Periode 1/5  −116 Mrd. €  3 Hebel   Freigabe ●●○○  [Abschl.] │
└──────────────────────────────────────────────────────────────┘
```

**Links stehen die Hebel, rechts stehen die Folgen, und beide bleiben
beim Scrollen stehen.** Man dreht am Spitzensteuersatz und sieht rechts
die Zahl wandern — ohne einen Dialog zu schließen.

### Das neue Kernstück: „Was deine Änderungen bewirken"

Ein Band in der Mitte, das nur eines zeigt: **die Differenz zum
Rundenstart.** Nicht „Saldo: −116 Mrd." sondern „Saldo: +18,4 Mrd.
besser als beim Rundenstart — entlastet".

Das ist der Unterschied zwischen einem Zahlenbrett und einem Planspiel.
Heute muss sich ein Team merken, wo es hergekommen ist. Künftig steht
es da.

Jede Richtungsangabe trägt **drei** Signale: Vorzeichen, Farbe und
Wort. Das ist kein Zierrat — bei Rot-Grün-Schwäche trägt die Farbe
allein nicht, und über einen Beamer erst recht nicht.

### Was noch aufgeräumt wird

| Heute | Künftig |
|---|---|
| Drei Wege zu den Ressorts | einer — die Liste links |
| Hebel im Dialog versteckt | immer sichtbar |
| Lagebericht startet leer | drei Auswertungen sind von Anfang an da |
| Kennzahl ohne Vorher | Kennzahl mit Differenz und Verlaufslinie |
| Freigabestand im Knopftext | eigene Anzeige, vier Punkte |

---

## 5. Barrierefreiheit

Geprüft am Mockup, nicht behauptet:

- Grundschrift 16px
- Alle Farbpaare bestehen WCAG 2.2 AA, hell und dunkel — 22 Standardpaare
  über das Skript des Oberflächen-Skills, 22 projekteigene über
  `entwurf/kontrast-projektpaare.py`
- Jedes Eingabefeld hat eine Beschriftung — **0 Verstöße**
- Jeder Knopf hat einen lesbaren Namen — **0 Verstöße**
- Sichtbarer Fokusring auf allem Bedienbaren, per Tastatur geprüft
- Sprungmarke „Direkt zu den Stellschrauben" als erstes Tab-Ziel
- Sieben Landmarken, saubere Überschriftenkette ab `h1`
- Dekorative Grafiken sind vor Screenreadern versteckt, die Zahl
  daneben steht als Text
- Wer Bewegung abgeschaltet hat, bekommt keine

Was das **nicht** abdeckt: ein echter Screenreader-Durchlauf. Der
bleibt Handarbeit und sollte vor dem Einsatz im Kurs einmal passieren.

---

## 6. Wenn du zustimmst: die Reihenfolge

Jeder Schritt ist für sich lauffähig. Du kannst nach jedem aufhören.

| # | Schritt | Risiko |
|---|---|---|
| 1 | `css/tokens.css` anlegen, alle vier Seiten binden sie ein | keins — nichts sieht anders aus |
| 2 | Die 235 festen Farbwerte durch `var(--…)` ersetzen | gering, rein mechanisch |
| 3 | CSS aus den HTML-Dateien in `css/` holen | gering |
| 4 | Schriften ins Projekt, Logo als SVG | gering |
| 5 | `dienste/api.js` — alle 6 `fetch()` dorthin | mittel, Tests decken es ab |
| 6 | `zustand.js` und `speicher.js` herauslösen | mittel |
| 7 | Drei-Zonen-Layout, Wirkungsband | die eigentliche Änderung |
| 8 | `admin.html` und `debriefing.html` nachziehen | gering |

Schritt 1 bis 4 ändern nur, *wo* die Dinge stehen, nicht *was* sie tun.
Erst ab 5 wird es inhaltlich. Die 70 Tests in `tests/` laufen
durchgehend mit — `js/rechner/` wird überhaupt nicht angefasst.

---

## 7. Wo ich deine Entscheidung brauche

1. **Drei Zonen statt Dialog** — die eine große Änderung. Ja oder nein?
2. **Bespoke Stencil nur fürs Logo, als SVG.** Oder soll sie eine
   größere Rolle spielen? Dann müssen wir den Lizenzweg über die
   Fontshare-API gehen, und damit hängt die Seite wieder an einem
   fremden Server.
3. **Fresh Sky als Akzent** — im Entwurf zu sehen. Oder lieber beim
   jetzigen Blau bleiben?
4. **Wie weit?** Nur aufräumen (Schritt 1–4) oder ganz durch (1–8)?
