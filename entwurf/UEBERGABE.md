<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- Copyright 2025 Florian Aram Feuerriegel — kassensturz.org -->

# Übergabe — Weiterbau am Verhandlungstisch

**Stand:** 24.09.2026 · **Für:** wer die Vollintegration fortsetzt
**Vorgänger-PR:** [#2](https://github.com/Floderso/planspiel-kassensturz/pull/2)

Du übernimmst ein Planspiel, das durchspielbar ist. Diese Datei sagt dir, was
steht, was fehlt, was **nicht neu verhandelt wird** — und wo die Fallen liegen,
in die ich schon getreten bin.

Lies zuerst `CLAUDE.md` (Hausregeln) und `entwurf/PLANUNG-AUSBAU.md` (der Plan,
26 Seiten in fünf Bereichen, mit Baustand je Stufe). Diese Datei wiederholt
beides nicht.

---

## 1. Wo wir stehen

Der Kurs ist von Anfang bis Ende spielbar:

```
anmelden → aufstellen → verhandeln → abstimmen → auswerten → vortragen
```

| Fläche | Datei | Zustand |
|---|---|---|
| Spielfläche | `index.html` · `js/verhandlungstisch.js` | fünf Ansichten, hash-geroutet |
| Aufstellung | `aufstellung.html` · `js/aufstellung.js` | Team, Ressort, Teamname |
| Leitung | `leitung.html` · `js/leitung.js` | Zulassung, Aufstellung, Perioden, Leitstand, Notfallwerkzeuge |
| Auswertung | `auswertung.html` · `js/auswertung.js` | Gesamtauswertung, Werkstattbericht, Diagrammbaukasten |
| Bühne | `buehne.html` · `js/buehne.js` | Regie und Vollbildvortrag |
| klassische Fläche | `index-klassisch.html` | bleibt bedienbar, unangetastet |

Von elf Planstufen sind neun gebaut. Offen: Stufe 2 (Anmeldung mit Kennwort)
und Stufe 11 (Ereignisse, Teamvergleich).

**Zum Anschauen:** `cd api && npm run dev`, dann `npm start`, dann
`node werkzeug/demo-sitzung.js` — das legt eine gefüllte Sitzung an und gibt
alle Adressen aus.

---

## 2. Dein Auftrag — die sechs offenen Punkte

Der Auftraggeber ist mit der **Gestaltung** des Verhandlungstischs zufrieden.
Das ist der Rahmen: nicht neu entwerfen, sondern vervollständigen.

### 2.1 Externe Schocks, von der Lehrperson einstellbar

**Gebraucht:** E5 aus dem Plan. Die Lehrperson setzt je Periode ein Ereignis —
Energiepreisschock, Rezession —, das auf alle Teams wirkt.

**Schon da:**
- `SCHOCK_BIBLIOTHEK` in `js/data.js`: **10 Einträge** mit `name`, `staerke`,
  `effekte` (`bip_malus`, `invest_malus`, `schuld_bonus`, `co2_reduktion`)
- `SessionData.schocks: SchockEvent[]` im Typ
- `PUT /api/sessions/:id/schocks` und `setzeSchocks()` in `js/dienste/server.js`
- `applySchock(zustand, schock)` in `js/rechner/transition.js`

**Fehlt:** die Oberfläche in `leitung.html`, und die Anwendung im Spiel —
`js/spielkern.js` ruft `applySchock` derzeit **nicht** auf.

> **Vorsicht, und zwar ernsthaft:** Ein Schock, der gesetzt wird, *nachdem* eine
> Periode freigegeben ist, ändert rückwirkend ein Ergebnis, das Teams schon
> gesehen und beschlossen haben. Das muss die Oberfläche verhindern oder
> mindestens unübersehbar warnen. Ein Planspiel, in dem sich die Vergangenheit
> ändert, ist kein Planspiel mehr.

### 2.2 Einrichtungsseite — ein Spiel anlegen

**Gebraucht:** E1 aus dem Plan. Eine Seite in der Sprache des
Verhandlungstischs, auf der ein Kurs entsteht: Name, Periodenanzahl,
Periodenlängen, Teamanzahl, Teamgröße, Quorum, Ressorts.

**Schon da:** `POST /api/sessions` nimmt all das entgegen (siehe
`api/src/index.ts`, Abschnitt „Sitzung anlegen"), und `admin.html` hat ein
Formular dafür — aber in der **alten** Gestaltung, und es kennt weder Quorum
noch Ressorts.

**Fehlt:** `einrichtung.html`. Sie gehört an den Anfang der Kette und muss am
Ende den Kurs-Code und den Admin-Link ausgeben — **mit dem Token im Fragment**,
nie in der Abfrage (Hausregel).

### 2.3 Progressive Freischaltung von Werkzeugen

**Das ist der Punkt, der schon fast fertig ist und nur nicht verdrahtet wurde.**

**Schon da:**
- `SessionData.perioden_werkzeuge?: Record<string, string[]>` — freigegebene
  Ressorts je Periode
- `PUT /api/sessions/:id/werkzeuge` und `setzeWerkzeuge()` in server.js
- `MOD_DEFS` in `js/data.js` — die Module (Einkommensteuer, Unternehmen,
  Mehrwertsteuer, CO₂, Vermögen, Sozialversicherung, …)
- `RESSORTS[].ab` in `js/spielkern.js` — ein Feld für „ab welcher Runde", das
  heute überall auf `1` steht und nirgends ausgewertet wird

**Fehlt:** die Einstellung in `leitung.html` und die Auswertung in
`js/spielkern.js` / `js/verhandlungstisch.js`. Ein gesperrtes Werkzeug muss
**sichtbar gesperrt** sein, nicht unsichtbar — Studierende sollen wissen, dass
es später mehr gibt. In der Werkbank wäre das eine zugeklappte Gruppe mit
„ab Runde 3".

### 2.4 Diagramme in der Spielfläche

**Der Befund stimmt:** `js/verhandlungstisch.js` zeichnet **null** Diagramme.
Die Spielfläche zeigt ausschließlich Zahlen. Bilder gibt es nur in
`js/schaukasten.js` (Balken) und `js/auswertung.js` (Zeitreihen).

**Wo sie hingehören** — mein Vorschlag, nicht bindend:

| Ort | Was |
|---|---|
| Werkbank, Wirkungsleiste | ein Sparkline je Kennzahl statt nur der Zahl |
| Ressortansicht, „Wirkung" | Vorher/Nachher als Balkenpaar |
| Tisch, gemeinsames Blatt | eine kleine Verlaufskurve je Kennzahl |
| Abstimmung | was die Vorlage an den vier Kennzahlen bewegt, als Balken |

**Bedingungen, die nicht verhandelbar sind:** jedes Diagramm trägt seine Zahlen
auch als Text (Vorlesesoftware, Beamer in der letzten Reihe), `aria-label` mit
den Werten, und es hält AA-Kontrast. `js/schaukasten.js` macht beides schon
vor — `balken()` dort ist wiederverwendbar.

### 2.5 Zu viel erklärender Text an den Bedienelementen

**Berechtigt.** Ich habe erklärt, wo ich hätte gestalten sollen. Beispiele zum
Anfangen:

- `index.html`, `.bu` unter jeder Überschrift — oft zwei Sätze, wo einer reicht
- `#wirkung-hinweis` in der Ressortansicht: drei Zeilen Fließtext
- `#einbringen-hinweis` in der Werkbank
- `aufstellung.html`, die `.bu`-Absätze unter „Welches Team?" und
  „Welches Ressort?"

**Faustregel für den Umbau:** Ein Hinweis, der beschreibt, *was das Element
tut*, ist überflüssig — dann ist das Element falsch beschriftet. Ein Hinweis,
der sagt, *was daraus folgt*, bleibt. „Anhaken, was auf die Bühne soll" kann
weg; „Höchstens fünf — die Grenze ist Absicht" bleibt.

**Nicht wegkürzen:** die Stellen, die eine *Ehrlichkeitsauskunft* geben — die
Fußzeile unter „Meine Beschlüsse", der Hinweis, dass die Landkarte nicht
regional rechnet, die Warnung an der Auslassungsrechnung. Die sind kein
Beiwerk, sie halten die Fläche redlich.

### 2.6 „Woher die Zahlen kommen" nimmt zu viel Platz

**Berechtigt.** Der Block steht in `index.html` unten als eigene Spalte
(`#quellen-liste`, gefüllt in `js/verhandlungstisch.js`) und trägt alle sieben
Quellen ausgeschrieben.

**Vom Auftraggeber gewünscht:** in ein Ausklappfeld.

**Achtung, hier steckt eine Falle:** In der Werkbank hängt an *jeder*
Stellgröße ein eigenes `<details class="quelle">`. Das ist Absicht — es ist die
dritte Fassung, nachdem zweimal eine wiederholte Offenlegungszeile unter jeder
Zeile als Fehler gemeldet wurde. **Verschiebe den unteren Block ins Ausklappfeld,
aber ersetze nicht die Quellen in der Werkbank durch etwas Wiederholtes.**

Die Hausregel dahinter steht in `CLAUDE.md`: *jede ökonomische Annahme braucht
eine Quelle.* Sie darf kleiner werden, aber nicht verschwinden.

---

## 3. Entscheidungen, die nicht neu verhandelt werden

Diese sind mit dem Auftraggeber abgestimmt. Wenn du sie ändern willst, frag —
aber fang nicht damit an.

| Entscheidung | Datum | Warum |
|---|---|---|
| **Es wird nicht zugerechnet.** Kein Ressort bekommt eine Zahl für „seinen Anteil" | 21.09. | Die Engine rechnet Wechselwirkungen; jede Zerlegung wäre Scheingenauigkeit. Der Werkstattbericht zeigt eine **Abfolge**: was geändert wurde, was danach anders war. Die dritte Spalte heißt nicht „meine Wirkung". |
| **Eine Person = ein Ressort, alle stimmen über alles ab** | 21.09. | Der Lerninhalt ist, die eigene Politik mehrheitsfähig zu machen. |
| **Ausgezählt wird erst, wenn alle gestimmt haben** | 22.09. | Früher wäre schneller, aber eine Vorlage wäre entschieden, bevor alle geredet haben. |
| **Zwei Namen je Team**: `Team 20` bleibt Schlüssel, Anzeigename ist frei | 21.09. | Trennung von Schlüssel und Anzeige. Der Anzeigename wird serverseitig geprüft. |
| **Ressorttausch nur zwischen den Runden** | 22.09. | Mitten drin hingen Unterschrift und Begründung an einem Ressort, das man abgibt. |
| **Kein Durable-Objects-Weg** | 21.09. | `entwurf/BETRIEB.md` hat Cloudflare als Ziel ausgeschlossen (Matrikelnummern bei einem US-Anbieter). Siehe ADR 006. |
| **Wer dazukommt, übernimmt** | 23.09. | Ein zweites Gerät adoptiert den Teamstand, statt ihn zu überschreiben. |
| **Die Fünfergrenze im Schaukasten** | 23.09. | Wer alles zeigen darf, wählt nicht aus. |

---

## 4. Wo was liegt

```
js/spielkern.js        Übersetzung zur Engine: Stellgrößen, Kennzahlen, Runden,
                       Rundenschluss mit Periodenübergang, spieleNach(),
                       vorausschau(). Weiß NICHTS von Abstimmung.
js/felder.js           Eingabe und Fehlerverhalten, gemeinsam für alle Flächen
js/schaukasten.js      Zeichnet Schaukästen — von Baukasten UND Tisch benutzt
js/dienste/server.js   der EINZIGE Ort mit fetch()
js/dienste/speicher.js der EINZIGE Ort mit localStorage
api/src/typen.ts       die Form der Sitzungsdaten
api/src/speicher/      Speicherschnittstelle (ADR 006) — kv.ts sagt, was sie nicht kann
api/src/namenspruefung.ts   Teamnamen, serverseitig
werkzeug/entwicklungsserver.js  statischer Server mit no-store
werkzeug/demo-sitzung.js        gefüllte Demositzung anlegen
```

**Die Abstimmungsregel liegt in `js/verhandlungstisch.js`, nicht im Spielkern.**
Das ist Absicht: sie ist eine Regel dieser Fläche, keine Eigenschaft des
Modells. Halte das so.

---

## 5. Fallen, in die ich getreten bin

**Der Browser liefert alte Module aus.** `python3 -m http.server` sendet keine
Cache-Header; Browser cachen dann heuristisch, und eine geänderte Oberfläche
trifft auf ein veraltetes Modul — die Seite bleibt schwarz, die Konsole meldet
einen fehlenden Export, den es längst gibt. Deshalb
`werkzeug/entwicklungsserver.js`. **Wenn etwas unerklärlich nicht wirkt: prüf
zuerst, ob der Browser deine Fassung hat** (`fetch(url, {cache:'reload'})` und
die Länge vergleichen). Siehe ADR 005.

**`git status` zeigt dir nicht, was der Browser sieht.** Ich habe zweimal
„repariert", was schon repariert war.

**`replace` ohne Prüfung läuft still ins Leere.** Ein Kurzschluss in
`zeigeBeitritt()` war dadurch monatelang — nun, tagelang — verschwunden, und
Studierende bekamen bei jedem Besuch das Beitrittsformular. Prüf jede
Textersetzung.

**`PUT /teams/:team` ersetzte den Teamstand komplett.** Vorlagen,
Begründungen, Unterschriften, Schaukästen und Anzeigenamen wurden dabei
gelöscht. Sie werden jetzt ausdrücklich bewahrt — **wenn du ein Feld an
`TeamState` hängst, trag es dort nach**, sonst verschwindet es beim ersten
Speichern eines anderen Geräts.

**CORS erlaubte kein DELETE.** Jeder Löschaufruf sah im Browser wie ein
Netzwerkfehler aus. Behoben, aber merk dir das Muster: „Netzwerkfehler" bei
einem Aufruf, der per curl funktioniert, ist fast immer der Preflight.

**Zeitzonen.** `toISOString().slice(0,16)` in ein `datetime-local` zu schreiben
verschiebt die Zeit bei jedem Laden um den UTC-Versatz. `alsOrtszeit()` in
`js/leitung.js` macht es richtig.

**`innerText` zeigt keine Feldinhalte.** Ich hätte fast einen Fehler
„behoben", den es nicht gab. Prüf mit `outerHTML` oder `.value`.

---

## 6. Wie hier geprüft wird

Kein Werkzeug, sondern eine Gewohnheit — bitte beibehalten:

1. **Kontrast messen, nicht schätzen.** Ich habe jede Fläche mit einem Skript
   über alle Textknoten gemessen (Vordergrund gegen den tatsächlich wirksamen
   Hintergrund, 4,5:1 bzw. 3:1 bei großer Schrift). Das hat jedes Mal Befunde
   ergeben, die mit dem Auge nicht auffielen — einmal **1,31:1** im
   Startzustand einer Seite.
2. **Bei 375 px und 1280 px.** Überlauf hat sich mehrfach erst am Telefon
   gezeigt. Tabellen dürfen in sich rollen, die Seite nicht.
3. **Gegen die laufende API**, nicht gegen Annahmen. Vier der schwersten Fehler
   sind erst im Durchspielen aufgefallen.
4. **`npm test`** nach jeder Änderung; `cd api && ./node_modules/.bin/tsc
   --noEmit -p tsconfig.json` nach jeder API-Änderung.

Die Zahlen zum Vergleich: 99 Tests (98 grün, 1 todo), TypeScript unter
`strict`, Tisch, Leitung und Einrichtung ohne Kontrastunterschreitung
(nachgemessen am 24.09. — dabei zwei alte Befunde behoben, siehe 10).

---

## 7. Was nicht bei dir liegt

Fang damit nicht an, und bau nichts, was davon abhängt:

- **Stufe 2, Anmeldung mit Kennwort.** Gehört vor dem Bau mit IT-Sicherheit und
  Datenschutz der Hochschule abgestimmt. Heute weist sich niemand aus: wer eine
  fremde Matrikelnummer kennt, kann sie eintragen. Der Plan (Abschnitt 9)
  beschreibt den Entwurf samt Einmalcode-Rücksetzung.
- **Die Live-Abstimmung.** Hängt am Umzug auf einen Uni-Server (ADR 006). KV ist
  eventually consistent; der Zählstand kann bis zu eine Minute alt sein.
- **Ausrollen.** `npm run deploy` veröffentlicht — nur nach Rücksprache.

---

## 8. Noch nicht committet (Stand 24.09.)

Auf dem Arbeitsbaum, nicht im PR:

- `api/wrangler.toml` — `http://localhost:8000` in `ALLOWED_ORIGINS`, sonst
  scheitert jede Demo nach Anleitung an CORS
- `js/verhandlungstisch.js` — abgeschlossene Runden werden beim Öffnen
  nachgespielt. **Ohne das landet jeder, der neu lädt, wieder in Runde 1.**
  Das gehört in den PR, es ist kein Demo-Detail.
- `werkzeug/demo-sitzung.js` — neu

---

## 9. Wenn du nur eine Sache mitnimmst

Die Flächen sind so gebaut, dass sie **nicht mehr behaupten, als sie wissen**.
Der Werkstattbericht rechnet nicht zu. Die Landkarte sagt, dass das Modell
nicht regional rechnet. Die Vorausschau heißt Vergleichsrechnung, nicht
Prognose. Der Leitstand spielt nach statt zu schätzen.

Das ist in einem Lehrplanspiel kein Stil, sondern die Sache selbst. Wenn eine
neue Ansicht eine Zahl zeigt, muss beantwortbar sein, woher sie kommt — und
wenn sie es nicht ist, gehört das dazugeschrieben.

---

## 10. Fortsetzung am 24.09.2026 — was aus den sechs Punkten wurde

Alle sechs Punkte aus Abschnitt 2 sind gebaut und gegen die laufende API
durchgespielt (Einrichtung → Leitung → Tisch über drei Runden → Auswertung,
bei 1280 und 375 px).

| Punkt | Wo | Kern |
|---|---|---|
| 2.1 Ereignisse | `leitung.html` „Ereignisse“, `js/spielkern.js` | Der Tisch rechnet sie wie `simulierePfad()`. Der **Server** lehnt Änderungen an gesehenen Perioden mit 409 ab (`periodeGesehen` in `api/src/index.ts`); die Freigabe fragt nach, wenn sie ein Ereignis festschreibt |
| 2.2 Einrichtung | `einrichtung.html` · `js/einrichtung.js` | Token nur im Fragment; prüft „weniger Plätze als Ressorts“ |
| 2.3 Werkzeuge | `WERKZEUGE`, `istOffen()` im Spielkern; Leitung „Werkzeuge“ | Einheit ist das Werkzeug aus `MOD_DEFS`, nicht das Ressort — so hat jedes Ressort ab Runde 1 etwas zu tun. Gesperrtes steht schraffiert mit „ab Runde n“ in der Werkbank. `RESSORTS[].ab` ist entfallen |
| 2.4 Diagramme | `js/diagramme.js` | Verlaufskurve mit ○ ohne / ● mit Beschluss (Tisch, Werkbank-Leiste, Ressortansicht); Wirkungsbalken „für sich allein“ in der Abstimmung, je Kennzahl über alle Vorlagen gleich skaliert |
| 2.5 Text | `index.html`, `verhandlungstisch.js`, `aufstellung.html` | Nach der Faustregel gekürzt; Reste des alten Unterschriftenmodells entfernt |
| 2.6 Quellen | `index.html` | Unterer Block im Ausklappfeld; die Quellen je Stellgröße in der Werkbank bleiben unverändert |

**Der Tisch kennt jetzt den Kurs.** Vorher rechnete er fest mit 5 Runden zu
4 Jahren und allen vier Ressorts, egal wie die Sitzung angelegt war.
`kursAus()` liest Runden, Längen, Ereignisse, Werkzeuge und Ressorts;
`erzeugeSpiel`, `spieleNach` und `vorausschau` nehmen den Kurs mit. Leitstand,
Auswertung, Bühne und Schaukasten reichen ihn durch. `tests/spielkern.test.js`
prüft, dass Tisch, Nachspielen und Engine mit Ereignissen und ungleichen
Längen **dieselben** Zahlen liefern.

### Beim Durchspielen gefunden und behoben

- **Eine Vorlage ging verloren.** Begründung tippen, direkt einbringen: `change`
  und `blur` speicherten die Begründung zweimal, gleichzeitig mit der Vorlage,
  und der spätere Schreibvorgang überschrieb sie. Jetzt laufen die
  Schreibvorgänge eines Geräts nacheinander (`nacheinander()`).
- **Jedes Gerät sah nur die eigenen Werte**, und wer die Runde schloss,
  meldete nur die eigenen Beschlüsse. Jetzt übernimmt jedes Gerät die Werte
  aus den Vorlagen der anderen (`uebernimmFremdeWerte()`).
- **Die anderen Geräte merkten den Rundenschluss nicht.** `GET …/vorlagen`
  meldet jetzt `locked`; der Tisch rückt nach.
- **Kontrast:** „Protokoll“ auf dem Filz 1,18:1, Grau auf den Mappen 3,97:1.

### Offen — bewusst nicht angefasst

- **`min_teilnahme_quote`:** Mit der Vorgabe 0,5 sperrt der Rundenschluss
  des Tischs die Periode nie (ein Gerät = eine Stimme, der Server will zwei).
  Die Einrichtung setzt 0. Sitzungen aus `admin.html` und aus
  `werkzeug/demo-sitzung.js` haben weiter 0,5 — die Demo sperrt über den
  Admin-Endpunkt und merkt es darum nicht.
- **Der Tisch erzwingt die Freigabe nicht.** Ein Team kann über
  `perioden_freigegeben` hinaus spielen. Der Ereignisschutz rechnet damit.
- **Werkzeuge prüft nur die Oberfläche**, nicht der Server.
- **`invest_malus` und `co2_reduktion`** stehen in der Bibliothek, rechnet
  `applySchock()` aber nicht. Überall als „im Modell nicht gerechnet“ markiert.
  Einbauen hieße: Wirkungskanal festlegen und Quelle angeben.
- **Beitrittsformular:** „bleibt auf dem Server der Hochschule“ stimmt, solange
  Cloudflare läuft, nicht.
- **Zwischen Geräten** kann KV weiter Schreibvorgänge verlieren (ADR 006).
