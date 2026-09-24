<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- Copyright 2025 Florian Aram Feuerriegel — kassensturz.org -->

# Planung · Ausbau zum vollständigen Planspiel

**Stand:** 21.09.2026 · **Status:** Entwurf zur Abstimmung, nichts davon gebaut

Diese Datei plant, sie baut nicht. Sie beschreibt, welche Seiten es geben
soll, was jede leistet, was bewusst **nicht** darauf steht, und in welcher
Reihenfolge das entstehen kann.

---

## 1. Die eine Änderung, aus der alles folgt

Bisher: **ein Gerät je Team**, vier Personen davor, jede übernimmt ein
Ressort. Künftig: **eine Person = ein Ressort**, jede an ihrem eigenen Gerät —
und jede stimmt über *alle* Vorlagen mit ab.

Das ist keine Erweiterung, das ist ein anderer Betrieb. Drei Dinge folgen
daraus zwingend:

1. **`member.rolle` wird Pflicht.** Ohne verbindliche Rollenzuordnung lässt
   sich nicht sagen, wer für ein Ressort sprechen darf. Das Feld liegt seit
   dem 20.09. im Typ, ist aber noch unbenutzt.
2. **Aus Unterschriften wird eine Abstimmung.** Heute zeichnet ein Ressort
   seine eigene Mappe. Künftig bringt ein Ressort eine **Vorlage** ein, und
   *alle* Mitglieder stimmen darüber ab. Das ist der eigentliche Lerninhalt:
   man muss die eigene Politik den anderen erklären.
3. **Nebenläufigkeit wird zum Problem.** Siehe Abschnitt 10 — das ist der
   riskanteste Punkt des ganzen Plans.

---

## 2. Rollen und was sie dürfen

| Rolle | Darf | Darf nicht |
|---|---|---|
| **Studierende** | genau **ein** Ressort bearbeiten · über **alle** Vorlagen abstimmen · den eigenen Schaukasten zusammenstellen · präsentieren | fremde Ressorts bearbeiten · Perioden freischalten · Schocks setzen |
| **Team** (kollektiv) | Anzeigenamen vergeben · Runde schließen, wenn das Quorum steht | den Systemnamen ändern |
| **Lehrperson** | alles verwalten · Perioden und Schocks steuern · Zulassung · jede Auswertung sehen · präsentieren | eine Vorlage für ein Team beschließen |

**Bewusst offen gelassen:** ob die Lehrperson im Notfall eine Runde
zwangsschließen darf (Team zerstritten, Zeit um). Ich halte das für nötig —
siehe Abschnitt 12, offene Entscheidung 3.

---

## 3. Der Seitenbaum

Fünf Bereiche, **22 Seiten**. Die Tiefe ist Absicht: lieber eine Ebene mehr
als eine überladene Seite.

```
A · ANMELDUNG UND AUFSTELLUNG          (6 Seiten, einmal je Kurs)
  A0  Anmeldung                         Matrikelnummer + Kennwort
    A0a  Erstanmeldung                  Name und Kennwort setzen
    A0b  Zugang zurücksetzen            Einmalcode der Lehrperson eingeben
  A1  Beitritt                          Kurs-Code prüfen, Zulassung prüfen
  A2  Teamzuordnung                     Raster Team 01–100
  A3  Ressortwahl                       vier Plätze im eigenen Team
  A4  Teamname                          erst wenn die Zuordnung schließt

B · DER TISCH                          (6 Seiten, das Spiel)
  B0  Tisch                             ⟵ Heimatbasis, immer erreichbar
  B1  Ressortansicht                    eine Mappe von außen
    B1a  Werkbank                       nur das eigene Ressort, volle Tiefe
    B1b  Schaukasten                    selbstgewählte Diagramme
  B2  Abstimmung                        alle offenen Vorlagen
  B3  Rundenprotokoll                   was beschlossen wurde

C · AUSWERTUNG                         (4 Seiten)
  C1  Gesamtauswertung                  das eigene Team über alle Perioden
  C2  Ressortauswertung                 was ein Ressort bewirkt hat
  C3  Diagrammbaukasten                 Auswahl für den Schaukasten
  C4  Teamvergleich                     erst nach Kursende freigegeben

D · PRÄSENTATION                       (2 Seiten)
  D1  Bühne                             Vollbild, eine Aussage je Schritt
  D2  Regie                             Reihenfolge zusammenstellen

E · VERWALTUNG                         (8 Seiten, Lehrperson)
  E1  Sitzung anlegen
  E2  Zulassung                         Matrikelnummernliste
    E2a  Nachzügler                     einzeln zulassen, ohne Neuladen
  E3  Aufstellung                       Teams und Rollen überwachen
    E3a  Personenblatt                  Notfallwerkzeuge zu einer Person
  E4  Perioden                          Länge · Freischaltung · Frist
  E5  Ereignisse                        Schocks und Lernziele
  E6  Leitstand                         laufende Sitzung, Eingriff, Export
```

**26 Seiten.** Die vier zusätzlichen gegenüber der ersten Fassung sind
Anmeldung und Notfallwerkzeuge — beides kam am 21.09. dazu.

---

## 4. Die Flows

### Flow A — Vom Hörsaal an den Tisch

```
Kurs-Code (QR)
   ↓
A1 Beitritt ────── Matrikelnummer nicht zugelassen? → Hinweis, Abbruch
   ↓
A2 Teamzuordnung ─ „Ich bin in Team 20, kommt auch dahin"
   ↓                (Raster, freie Plätze sichtbar, Wechsel möglich
   ↓                 solange die Zuordnung offen ist)
A3 Ressortwahl ─── vier Plätze, jeder genau einmal
   ↓                letzte Person sieht: Team vollständig
A4 Teamname ────── erst freigeschaltet, wenn die Lehrperson
   ↓                die Zuordnung schließt
B0 Der Tisch
```

**Wartezustände sind Seiten, keine Spinner.** Wer als Erste im Team ist,
sieht „3 Plätze frei — sag deinen Leuten: Team 20", nicht einen Ladebalken.

### Flow B — Eine Periode spielen

```
B0 Tisch (Übersicht)
   ↓ eigene Mappe anklicken
B1a Werkbank ──── Stellgrößen ändern, Wirkung sofort sichtbar
   ↓              Begründung schreiben (Pflichtfeld)
   ↓ „Zur Abstimmung stellen"
B2 Abstimmung ─── alle vier Vorlagen nebeneinander
   ↓              jede Person: Zustimmung · Ablehnung · Enthaltung
   ↓              abgelehnt → zurück in die Werkbank, Fassung 2
   ↓ Quorum für alle vier erreicht
B0 Tisch ──────── „Runde schließen" wird frei
   ↓
B3 Protokoll ──── was beschlossen wurde, wer wie gestimmt hat
   ↓
   nächste Periode (Engine rechnet den Übergang)
```

### Flow C — „Ich erkläre euch, was ich gemacht habe"

Das ist der Flow, den die Aufgabenstellung in den Mittelpunkt stellt.

```
C3 Diagrammbaukasten ── Spielerin wählt 3–5 Diagramme aus dem Katalog,
   ↓                     ordnet sie, schreibt je einen Satz dazu
B1b Schaukasten ─────── ihre Zusammenstellung, für alle im Team sichtbar
   ↑
B0 Tisch ── Mitspieler klickt auf „Soziales" → sieht GENAU DAS,
            was die Soziales-Spielerin zusammengestellt hat —
            nicht eine generische Kennzahlentafel
```

### Flow D — Vorstellen

```
D2 Regie ── Quellen wählen: eigene Schaukästen, Team-Gesamtauswertung,
   ↓         Periodenvergleiche. Reihenfolge festlegen.
D1 Bühne ── Vollbild, Pfeiltasten, eine Aussage je Schritt,
            Zahlen groß genug für die letzte Reihe
```

Lehrpersonen betreten D1 aus dem Leitstand und können das Team wählen.

### Flow E — Verwalten

```
E1 Sitzung anlegen ─→ E2 Zulassung ─→ (Kurs-Code ausgeben)
                          ↓
                      E3 Aufstellung ── beobachten, Zuordnung schließen
                          ↓
                      E4 Perioden ───── Periode 1 freischalten
                          ↓
                      E6 Leitstand ──── läuft · eingreifen · nächste Periode
                          ↓
                      E5 Ereignisse ─── Schock für Periode 3 setzen
                          ↓
                      D1 Bühne ──────── Ergebnisse vorstellen
```

---

## 5. Seite für Seite

Jede Seite hat einen **Satz Zweck**, eine Liste dessen, was darauf steht,
und — genauso wichtig — was bewusst **nicht** darauf steht.

### A2 · Teamzuordnung

> **Zweck:** Sich selbst in ein Team einordnen, das man mündlich mit anderen
> verabredet.

Ein Raster aus Kacheln, Team 01 bis Team *n* (Lehrperson setzt *n*). Je
Kachel: Systemname groß, Belegung als vier Punkte (●●○○). Volle Teams sind
ausgegraut, nicht versteckt — man muss sehen, dass 20 voll ist, um 21 zu
nehmen.

Gewählt wird durch Antippen. Der Wechsel bleibt möglich, solange die
Lehrperson die Zuordnung nicht geschlossen hat; das eigene Team ist
hervorgehoben und oben angeheftet.

**Nicht darauf:** Namen anderer Studierender. Wer in Team 20 sitzt, geht
niemanden außerhalb etwas an — im Hörsaal spricht man sich ab, das Raster
zeigt nur Zahlen.

### A3 · Ressortwahl

> **Zweck:** Innerhalb des Teams die vier Ressorts genau einmal vergeben.

Die vier Mappen als Karten, jede mit einem Satz, was das Ressort tut und
welche Kennzahl es verantwortet. Belegte Ressorts zeigen den Vornamen der
Person. Ein Ressort kann freigegeben und getauscht werden, solange das Team
nicht vollständig ist.

**Nicht darauf:** Stellgrößen. Wer noch nicht weiß, ob er Umwelt macht,
braucht noch keine CO₂-Preise zu sehen.

#### A3.1 · Der Tausch zwischen den Runden

**Ergänzt am 22.09.2026.** Ein Ressort ist keine Lebensstellung. Nach jedem
Rundenschluss kann jede Person in ein anderes wechseln — über fünf Runden
sieht damit fast jede fast jeden Bereich, und das ist der eigentliche
Lerngewinn: wer einmal den CO₂-Preis gestellt hat, argumentiert danach
anders über ihn.

**Der Tausch geht nur ZWISCHEN zwei Runden.** Mitten in einer Runde hängen
Unterschrift und Begründung an einem Ressort; wer es dann abgibt, hinterlässt
eine Unterschrift ohne Unterschreibende. Die Regel ist deshalb hart:

| Zeitpunkt | Tausch |
|---|---|
| während einer Runde | **gesperrt** |
| nach dem Rundenschluss, vor dem ersten Beschluss | frei |
| in der letzten Runde | gesperrt — es folgt nichts mehr |

Die Oberfläche bietet ihn genau dann an, wenn er erlaubt ist, und nennt das
dabei mit: *„Du hattest Finanzen. Für Runde 2 könnt ihr tauschen — dann sieht
jede einmal jeden Bereich."*

**Offen:** ob die Lehrperson den Tausch erzwingen können soll (Rotation nach
Plan statt nach Absprache). Dafür spricht die Vollständigkeit, dagegen, dass
ein Team sich einspielt. Siehe Abschnitt 14.

### A4 · Teamname

> **Zweck:** Dem Team ein Gesicht geben, ohne die Systemordnung zu verlieren.

Ein Feld, ein Knopf, eine Vorschau: **Die Wirtschaftsverwalter (Team 20)**.
Freigeschaltet erst, wenn die Zuordnung geschlossen ist — vorher wüsste
niemand, wer eigentlich mitbenennt.

Siehe Abschnitt 8 zu den zwei Namen.

### B0 · Der Tisch

> **Zweck:** Heimatbasis. In drei Sekunden erkennen: Wo stehen wir, was
> fehlt noch, wo muss ich hin?

Die vier Mappen wie bisher, aber:

- Die **eigene** Mappe ist hervorgehoben und trägt einen Bearbeiten-Knopf.
- Die drei **fremden** Mappen zeigen je **drei Zahlen, nicht dreizehn**:
  die Leitkennzahl des Ressorts, ihre Veränderung, den Stand der Vorlage.
- Darunter das gemeinsame Blatt: Saldo, Gini, Emissionen, BIP, plus ein
  Satz, was als Nächstes dran ist.

**Nicht darauf:** einzelne Stellgrößen fremder Ressorts, Quellenapparat,
Verlauf, Diagramme. Das liegt alles genau einen Klick tiefer.

> **Die Regel gegen die Überfrachtung:** Auf B0 steht nichts, was nicht in
> einem Satz erklärt, ob gehandelt werden muss. Alles Übrige ist eine Ebene
> tiefer — und eine Ebene tiefer darf dann ausführlich sein.

### B1 · Ressortansicht *(eine Mappe von außen)*

> **Zweck:** Verstehen, was ein anderes Ressort vorhat und warum.

Drei Reiter:

| Reiter | Inhalt |
|---|---|
| **Vorlage** | Was geändert werden soll, von welchem auf welchen Wert, mit der geschriebenen Begründung |
| **Wirkung** | Was diese Vorlage an den vier Kennzahlen bewirkt — gegen den Rundenstart |
| **Schaukasten** | Was die Person selbst zusammengestellt hat (B1b) |

Für das **eigene** Ressort kommt ein vierter Reiter dazu: **Werkbank**.

### B1a · Werkbank *(nur das eigene Ressort)*

> **Zweck:** In Ruhe und mit voller Tiefe an den eigenen Stellgrößen
> arbeiten.

Hier darf es ausführlich sein — das ist der Ort, für den „Untermenü"
gedacht ist. Aufbau:

- **Stellgrößen in Gruppen**, je Gruppe aufklappbar. Geöffnet ist nur, was
  bewegt wurde; der Rest ist zugeklappt mit Kurzfassung („5 Stellgrößen,
  unverändert").
- Je Stellgröße: Feld, Einheit, zulässiger Bereich, **Vorwert**, und auf
  Wunsch die Fundstelle.
- **Sofortige Wirkung**: eine schmale Leiste zeigt, was sich an den vier
  Kennzahlen ändert, während man tippt.
- **Was-wäre-wenn**: ein zweiter Wert probeweise daneben, ohne die Vorlage
  zu ändern.
- **Begründung** — Pflichtfeld, mindestens ein Satz. Ohne sie lässt sich
  nichts zur Abstimmung stellen. Das ist bewusst unbequem.

### B2 · Abstimmung

> **Zweck:** Über die vier Vorlagen entscheiden.

Alle offenen Vorlagen untereinander. Je Vorlage: Ressort, Kurzfassung der
Änderung, Begründung, Wirkung auf die Kennzahlen, und die eigene Stimme als
drei Knöpfe — **Zustimmung · Ablehnung · Enthaltung**.

Der Zählstand steht daneben: „2 von 4 · fehlt: Umwelt, Wirtschaft". Wer
ablehnt, kann einen Satz dazuschreiben; die Vorlage geht damit an das
Ressort zurück.

**Nicht darauf:** die Werkbank. Abstimmen und Bearbeiten sind getrennte
Tätigkeiten und gehören nicht auf eine Seite.

### C1 · Gesamtauswertung

> **Zweck:** Der eigene Kurs über alle Perioden — was haben wir erreicht?

- **Oben eine Aussage**, kein Diagramm: „Ihr habt das Defizit von 119 auf
  61 Milliarden gedrückt und die Emissionen um ein Drittel gesenkt. Die
  Schuldenbremse habt ihr in keiner Periode eingehalten."
- Darunter vier Zeitreihen, eine je Kennzahl, mit den Periodengrenzen.
- Darunter eine Tabelle: je Periode die Beschlüsse, wer sie einbrachte, wie
  abgestimmt wurde.
- **Gegen das Nichtstun**: dieselbe Vorausschau, die die Brückenwache schon
  rechnet — was wäre passiert, wenn das Team nie etwas beschlossen hätte.

### C2 · Werkstattbericht *(vormals „Ressortauswertung")*

> **Zweck:** „Das habe ich in meinem Ressort geändert, und das habe ich
> danach beobachtet."

**Entscheidung vom 21.09.2026: Es wird nicht zugerechnet.** Ein Ressort
bekommt keine Zahl, die behauptet, *sein* Anteil am Ergebnis sei so und so
groß. Die Engine rechnet Wechselwirkungen; jede Zerlegung wäre eine
Scheingenauigkeit, und im Seminar würde über die Zerlegung gestritten statt
über die Politik.

Stattdessen dokumentiert die Seite eine **Abfolge**, keine Kausalität:

| Spalte | Inhalt |
|---|---|
| Was ich geändert habe | Stellgröße, von → auf, in welcher Periode |
| Warum | die Begründung, die schon bei der Vorlage geschrieben wurde |
| Was danach anders war | die Kennzahlen vor und nach dem Beschluss |

Die Überschrift der dritten Spalte ist bewusst **„was danach anders war"**
und nicht „meine Wirkung". Der Unterschied ist der Lerninhalt: in einer
Volkswirtschaft wirkt nichts allein.

Darunter ein Feld für einen eigenen Absatz — die Person schreibt selbst, was
sie für ihren Beitrag hält. Das ist eine Behauptung der Spielerin, sichtbar
als solche, und genau deshalb diskutierbar.

### C3 · Diagrammbaukasten

> **Zweck:** Die Spielerin stellt selbst zusammen, womit sie ihre Politik
> erklären will.

Ein Katalog links, die Zusammenstellung rechts. Katalog (Erstausstattung):

| Diagramm | Zeigt |
|---|---|
| Zeitreihe | eine Kennzahl über alle Perioden |
| Vorher / Nachher | eine Periode, gegen den Rundenstart |
| Dezilwirkung | Grenzbelastung je Einkommensdezil |
| Haushalt | Einnahmen und Ausgaben aufgegliedert |
| Meine Beschlüsse | was dieses Ressort entschieden hat — **nicht**, was es bewirkt hat |
| Gegen das Nichtstun | beschlossener Pfad gegen Fortschreibung |
| Einzelwert | eine große Zahl mit einem Satz |

Je gewähltem Diagramm: Kennzahl wählen, Zeitraum wählen, **eine Bildunterschrift
schreiben**. Höchstens fünf — die Begrenzung ist der eigentliche Dienst an der
Sache, sie zwingt zur Auswahl.

### D1 · Bühne

> **Zweck:** Vorstellen, an einem Beamer, vor einem Raum.

Vollbild, dunkler Grund, ein Schritt je Aussage. Steuerung mit Pfeiltasten,
Leertaste, Pos1 und Ende. Je Schritt: eine große Zahl oder ein Diagramm, eine
Zeile Text, die Quelle klein am Fuß.

Die Schritte kommen aus den Schaukästen (Stufe 9) plus sechs Team-Bausteinen
(Titel, Aussage, die vier Kennzahlen, Gegen das Nichtstun). **Nichts wird
hier zweitens zusammengestellt** — wer etwas anderes zeigen will, ändert
seinen Schaukasten. Sonst gäbe es zwei Orte für dieselbe Entscheidung.

**Nicht darauf:** Navigation, Menüs, Bedienelemente. Die Bühne verlässt man
mit Escape.

### E4 · Perioden

> **Zweck:** Den Takt des Kurses steuern.

Je Periode eine Zeile: Nummer, Zustand (gesperrt · offen · geschlossen),
Länge in Jahren, Frist, wie viele Teams fertig sind. Freischalten geht
fortlaufend: Periode *n* wird frei, wenn *n−1* frei ist.

**Eine Frist sperrt nichts.** Sie sagt, bis wann gerechnet wird; geschlossen
wird von Hand. Eine Runde, die um Mitternacht von selbst zuklappt, während
ein Team noch diskutiert, nimmt dem Planspiel seinen Sinn.

Die **Periodenlänge** ist je Periode einstellbar — das kann die Engine
bereits (`perioden_laenge_jahre` als Array).

### E5 · Ereignisse

> **Zweck:** Schocks und Lernziele setzen.

Die zehn Einträge aus `SCHOCK_BIBLIOTHEK` als Karten mit Namen, Stärke und
den Effekten im Klartext. Zuordnung zu einer Periode per Auswahl. Darunter
die Lernziele (`KPI_BENCH` und die 32 `CHALLENGES` stehen schon bereit).

**Vorsicht:** Ein Schock, der nach der Freigabe einer Periode gesetzt wird,
ändert rückwirkend das Ergebnis. Die Seite muss das verhindern oder
wenigstens deutlich warnen.

### E3a · Personenblatt

> **Zweck:** Alles zu **einer** Person auf einer Seite — und jedes
> Notfallwerkzeug genau hier, nicht verstreut.

Erreichbar durch Anklicken einer Person in der Aufstellung oder über die
Suche nach Matrikelnummer. Oben: Name, Matrikelnummer, Team (beide Namen),
Ressort, letzte Anmeldung, Zustand.

Darunter die Werkzeuge aus 9.5, jedes mit einer Rückfrage, die den Fall
benennt statt „Sind Sie sicher?":

> **Zugang zurücksetzen**
> Das bisherige Kennwort wird sofort ungültig. Sie erhalten einen
> Einmalcode, den Sie der Person vorlesen. Sie sehen das neue Kennwort
> nicht und setzen es nicht.
> [ Abbrechen ] [ Einmalcode erzeugen ]

> **Aus dem Kurs entfernen**
> Das Ressort *Soziales* in Team 20 wird frei. Stimmen aus abgeschlossenen
> Perioden bleiben im Protokoll stehen. Die Matrikelnummer bleibt
> zugelassen — die Person kann sich neu anmelden.
> [ Abbrechen ] [ Entfernen ]

Jeder Eingriff wird mit Zeitpunkt vermerkt und ist im Leitstand sichtbar.
Eine Lehrperson, die zurücksetzt, hinterlässt eine Spur — auch zum eigenen
Schutz.

### E6 · Leitstand

> **Zweck:** Sehen, wo die Teams stehen, und eingreifen können.

Ein Raster aller Teams. Je Team: Systemname, Anzeigename, laufende Periode,
angenommene Vorlagen, letzter Kontakt und die vier Kennzahlen. Farbe nur für
„meldet sich länger nicht" — als solches definiert: über 15 Minuten still
**und** noch nicht fertig. Diese Teams stehen oben.

**Die Zahlen werden nachgespielt.** Die Sitzungsverwaltung speichert nur
Parameter; `spieleNach()` in `js/spielkern.js` rechnet den Weg jedes Teams
mit denselben Funktionen nach, mit denen auch am Tisch gerechnet wird. Zwei
Wege zur selben Zahl wären der Anfang vom Ende der Glaubwürdigkeit.

Der Direktsprung in Auswertung und Bühne fehlt noch — die Seiten gibt es
erst ab Stufe 8.

---

## 6. Das Abstimmungsmodell

Eine **Vorlage** ist der Vorschlag eines Ressorts für eine Periode.

```
Entwurf ──„zur Abstimmung stellen"──→ Eingebracht
                                         │
              ┌──────────────────────────┼───────────────────┐
              ↓                          ↓                   ↓
         Angenommen                  Abgelehnt          Zurückgezogen
       (Quorum erreicht)        (zurück in die Werkbank,   (vom Ressort)
                                     Fassung +1)
```

**Quorum**, von der Lehrperson je Sitzung einstellbar:

| Regel | Bedeutung |
|---|---|
| Einfache Mehrheit | mehr Zustimmung als Ablehnung (Vorgabe) |
| Absolute Mehrheit | mehr als die Hälfte **aller** Mitglieder |
| Einstimmig | alle vier, Enthaltung zählt nicht als Ablehnung |

Die einbringende Person stimmt automatisch zu — wer etwas vorschlägt, ist
dafür. Sie kann die Vorlage zurückziehen, das ersetzt die Gegenstimme.

**Eine Runde schließt**, wenn jedes Ressort eine angenommene Vorlage hat.
Eine Vorlage ohne Änderungen ist zulässig und heißt „keine Änderung" — sie
braucht trotzdem eine Begründung und wird trotzdem abgestimmt. Nichtstun ist
eine Entscheidung und wird als solche behandelt.

**Gebaut am 22.09.2026.** Die Unterschrift aus der Zwischenstufe ist
ersatzlos entfallen: eine Ablehnung mit Grund ist der Einspruch, nur
schärfer — sie zwingt zur Überarbeitung, statt nur zu blockieren.

---

## 7. Gegen die Überfrachtung

Vier Regeln, an denen sich jede Seite messen lassen muss:

1. **Drei Zahlen, nicht dreizehn.** Eine Übersicht zeigt je Gegenstand
   höchstens drei Werte. Wer mehr will, klickt.
2. **Jede Ebene beantwortet eine Frage.** B0: „Muss ich handeln?" ·
   B1: „Was will das Ressort und warum?" · B1a: „Wie stelle ich es ein?"
3. **Zugeklappt ist der Normalfall.** In der Werkbank ist offen, was bewegt
   wurde. Der Rest zeigt eine Kurzfassung.
4. **Wartezustände sind Inhalte.** „3 Plätze frei" statt eines Ladebalkens,
   „fehlt: Umwelt" statt einer leeren Liste.

---

## 8. Die zwei Namen eines Teams

Der Wunsch, beide Namen zu trennen, ist **kein Umweg** — es ist genau die
richtige Trennung von Schlüssel und Anzeige:

| Feld | Beispiel | Eigenschaften |
|---|---|---|
| `team_system` | `Team 20` | bei der Zuordnung vergeben, **unveränderlich**, Schlüssel in allen Daten, in jeder Verwaltungsansicht führend |
| `team_anzeige` | `Die Wirtschaftsverwalter` | vom Team gesetzt, änderbar, optional, von der Lehrperson zurücksetzbar |

**Anzeigeregel, überall gleich:**

- Studierendenansicht: **Die Wirtschaftsverwalter** <small>(Team 20)</small>
- Verwaltungsansicht: **Team 20** — Die Wirtschaftsverwalter
- Export und Protokoll: immer `team_system`, der Anzeigename als Spalte

So kann ein Team heißen, wie es will, ohne dass jemand die Zuordnung
verliert.

### 8.1 Prüfung der Anzeigenamen

Ein freies Textfeld vor einem Hörsaal voller Studierender braucht eine
Prüfung. Vier Stufen, in dieser Reihenfolge:

1. **Form.** 3 bis 40 Zeichen. Keine Adressen, keine Ziffernfolgen, die wie
   Matrikelnummern aussehen, keine reinen Zeichenwiederholungen.
2. **Normalisieren, dann prüfen.** Kleinschreibung, Leerzeichen und
   Sonderzeichen entfernen, Ziffernersatz auflösen (`4`→`a`, `3`→`e`,
   `0`→`o`, `1`→`i`). Ohne diesen Schritt ist jede Wortliste in dreißig
   Sekunden umgangen.
3. **Wortliste.** Gepflegt, deutsch und englisch, mit Teilwortprüfung auf dem
   normalisierten Text.
4. **Menschliche Nachkontrolle.** Der Leitstand zeigt alle Anzeigenamen
   untereinander; Zurücksetzen ist ein Klick.

**Die Liste gehört auf den Server, nicht ins Frontend.** Im Browser lässt
sich eine schnelle Vorabprüfung machen, damit die Rückmeldung sofort kommt —
verbindlich ist aber nur die Prüfung im Worker. Eine Wortliste im
ausgelieferten JavaScript ist eine Anleitung zum Umgehen.

**Keine Filterliste fängt alles.** Darum ist Stufe 4 keine Notlösung,
sondern Teil des Entwurfs. Abgelehnte Versuche werden **nicht gespeichert**;
gezählt wird nur, wie oft ein Team abgelehnt wurde — drei Versuche setzen im
Leitstand einen Hinweis.

Die Ablehnung ist sachlich formuliert: *„Dieser Name geht nicht durch.
Sucht euch einen anderen."* Keine Belehrung, kein Vorwurf.

---

## 9. Anmeldung, Kennwort und die Notfallwerkzeuge

Heute gibt es **keine Authentifizierung**: wer eine Matrikelnummer kennt,
kann sie eintragen. Mit einem Ressort je Person und einer Abstimmung, an der
Stimmen hängen, reicht das nicht mehr — sonst kann jemand für eine andere
abstimmen.

### 9.1 Der Ablauf

```
Erste Anmeldung          Spätere Anmeldung
─────────────────        ─────────────────
Matrikelnummer           Matrikelnummer
   ↓ in der Liste?          ↓
Name eintragen           Kennwort
Kennwort setzen (2×)        ↓
   ↓                     Tisch
Teamzuordnung
```

### 9.2 Was dabei nicht verhandelbar ist

- **Das Kennwort wird nie im Klartext gespeichert.** PBKDF2-SHA-256 über
  die WebCrypto-API des Workers, eigenes Zufallssalz je Person,
  Iterationszahl nach aktueller OWASP-Empfehlung. Gespeichert werden Salz,
  Hash und Iterationszahl — sonst nichts.
- **Das Kennwort steht nie in einer Adresse und nie in einem Protokoll.**
  Dieselbe Regel, die für den Admin-Token schon gilt.
- **Die Lehrperson sieht das Kennwort nie und setzt es nie.** Siehe 9.4.
- **Versuchsbegrenzung.** Nach mehreren Fehlversuchen je Matrikelnummer eine
  wachsende Wartezeit.

> **Studierende benutzen hier Kennwörter, die sie auch anderswo benutzen.**
> Das ist nicht zu verhindern und deshalb einzuplanen: Ein Leck in diesem
> Planspiel wäre dann ein Leck für fremde Dienste. Genau darum steht oben
> „nie im Klartext" an erster Stelle.

### 9.3 Vorher zu klären: braucht es überhaupt ein Kennwort?

Ich plane es, weil du es so beschrieben hast — nenne aber die Alternative,
weil die Entscheidung Folgen hat:

| Weg | Wie es sich anfühlt | Preis |
|---|---|---|
| **Kennwort** (geplant) | vertraut | echte Zugangsverwaltung: Hashen, Versuchsbegrenzung, Rücksetzen; bei einer öffentlichen Einrichtung zustimmungspflichtig |
| **Gerätecode** | einmal beitreten, Gerät merkt sich einen Zufallsschlüssel; kein Kennwort zum Vergessen | Gerät verloren oder Browser geleert → derselbe Rücksetzvorgang wie beim Kennwort |
| **Nur Matrikelnummer** (heute) | nichts zu merken | jede Person kann für jede andere abstimmen |

**Was ich dazu sagen muss:** Eine Zugangsverwaltung für personenbezogene
Daten an einer öffentlichen Hochschule ist nichts, was nebenbei entsteht.
Das gehört vor dem Bau mit der IT-Sicherheit und dem Datenschutz der
Einrichtung abgestimmt — nicht als Formalie, sondern weil sie Vorgaben haben
werden, die den Entwurf ändern können.

### 9.4 Kennwort zurücksetzen — ohne dass jemand es sieht

Der Fall aus deiner Beschreibung: jemand hat das Kennwort vergessen, steht
vor der Lehrperson, weist sich aus.

```
Studierende meldet sich                    Lehrperson im Leitstand
   „ich komme nicht rein"        ──→       sucht die Matrikelnummer
                                              ↓ prüft den Ausweis
                                           „Zugang zurücksetzen"
                                              ↓
                                           EINMALCODE erscheint,
                                           z. B. 7F2K-QX9  (10 Minuten gültig)
   gibt Code + neues Kennwort  ←──         liest den Code vor
      ↓
   drin
```

**Warum nicht einfacher?** Weil die Lehrperson sonst ein Kennwort *setzt* und
es damit kennt. Der Einmalcode hält sie aus der Zugangskennung heraus: sie
erlaubt den Neustart, sie führt ihn nicht durch. Der Code ist einmal
verwendbar, läuft ab und macht das alte Kennwort sofort ungültig.

### 9.5 Die übrigen Notfallwerkzeuge

Alle im Leitstand (E6) und in der Aufstellung (E3), alle mit Vermerk im
Protokoll — wer eingreift, hinterlässt eine Spur.

| Werkzeug | Fall | Was passiert |
|---|---|---|
| **Nachzügler zulassen** | „Das ist meine Matrikelnummer, ich stand nicht auf der Liste" | Nummer wird der Zulassung hinzugefügt, einzeln, ohne die Liste neu zu laden |
| **Zugang zurücksetzen** | Kennwort vergessen | Einmalcode, siehe 9.4 |
| **Studierende entfernen** | Kurswechsel, Doppelanmeldung, Tippfehler | siehe 9.6 |
| **In anderes Team setzen** | falsches Team erwischt, Zuordnung schon geschlossen | Platz im Ziel muss frei sein; Ressort wird frei |
| **Ressort freigeben** | jemand hat das falsche genommen und ist weg | Ressort wird frei, Team kann neu vergeben |
| **Anzeigename zurücksetzen** | unpassender Teamname | Systemname bleibt, Team darf neu benennen |

### 9.6 Was beim Entfernen mit den Daten geschieht

Das muss vorher festgelegt sein, sonst entscheidet es der Zufall im Code:

| Gegenstand | Regel | Begründung |
|---|---|---|
| Ressort | wird frei | das Team muss weiterspielen können |
| Stimmen in **laufender** Periode | verfallen, Quorum rechnet neu | eine Stimme ohne Person ist keine |
| Stimmen in **abgeschlossenen** Perioden | **bleiben**, mit Vermerk „ausgeschieden" | ein Protokoll, das nachträglich umgeschrieben wird, ist kein Protokoll |
| Eingebrachte Vorlagen | bleiben, Urheberin bleibt genannt | dito |
| Schaukasten | wird gelöscht | eigene Zusammenstellung, kein Protokollbestandteil |
| Zugangsdaten | gelöscht | kein Grund, sie zu behalten |
| Matrikelnummer in der Zulassung | **bleibt** stehen | sonst sperrt ein versehentliches Entfernen die Person aus |

---

## 10. Synchronisation — und warum Abschnitt 12 davon abhängt

Jede Person sitzt an ihrem eigenen Gerät. Damit wird die Frage, die du
gestellt hast, zur zentralen: **wie schnell sehen die anderen, was ich tue?**

### 10.1 Was wie schnell sein muss

| Vorgang | Anspruch | Warum |
|---|---|---|
| Platz in Team 20 belegen | **kollisionssicher**, sofort | zwei gleichzeitige Klicks auf dasselbe Team |
| Ressort belegen | kollisionssicher, sofort | jedes Ressort genau einmal |
| Vorlage eingebracht | wenige Sekunden | man wartet ohnehin aufs Lesen |
| **Stimme abgegeben** | **sofort sichtbar** | der Zählstand ist der ganze Vorgang |
| Runde geschlossen | sofort | alle vier müssen gleichzeitig weiterkommen |

### 10.2 Der Befund, der die Sache dreht

Getrennte Schlüssel je Team lösen das **Verlieren** von Stimmen — aber nicht
das **Veralten**.

> Workers KV ist **eventually consistent**. Der vorherige Wert eines
> Schlüssels kann an einem Ort so lange sichtbar bleiben, wie dort die
> Cache-TTL läuft.
>
> | Wert | Dauer |
> |---|---|
> | Vorgabe | **60 Sekunden** |
> | kleinster einstellbarer Wert (`cacheTtl`) | **30 Sekunden** |
>
> Die 30 Sekunden gibt es erst seit dem 30.01.2026; davor waren 60 das
> Minimum. Auch Nichttreffer werden mitgecacht.

Für eine Abstimmung, die sich „fast live" anfühlen soll, ist das
unbrauchbar: Der Zählstand kann bei vier Personen eine halbe bis ganze
Minute lang vier verschiedene Werte zeigen. Häufigeres Abfragen hilft
nicht — es fragt dieselbe veraltete Antwort nur häufiger ab.

*Geprüft am 21.09.2026 gegen die Cloudflare-Dokumentation
(`kv/reference/faq`, `kv/api/read-key-value-pairs`).*

### 10.3 Was stattdessen — und warum nicht Durable Objects

Cloudflare **Durable Objects** wären fachlich genau das Richtige: einfädig,
stark konsistent, können WebSockets halten. Ihr eigenes Lehrbeispiel ist
eine Sitzplatzbuchung — derselbe Fall wie „zwei drücken gleichzeitig auf
Team 20".

**Sie kommen trotzdem nicht in Frage.** `entwurf/BETRIEB.md` hält am
12.09.2026 fest: *„Cloudflare scheidet als Ziel aus […] Ziel ist ein
Uni-Server."* Durable Objects gibt es nur bei Cloudflare. Darauf zu bauen
hieße, die Abstimmung an die Plattform zu binden, die aus Datenschutzgründen
verlassen werden soll — der Umbau käme ein zweites Mal.

**Der Ausweg ist einfacher als das Problem.** Was am Rand des Netzes
schwierig ist, ist auf einem gewöhnlichen Server der Normalfall:

| Gebraucht | Durable Object | Node + SQLite (Zielbild B) |
|---|---|---|
| Schreibzugriffe serialisieren | eingebaut | eine Datenbanktransaktion |
| stark konsistent lesen | eingebaut | von sich aus |
| Änderungen melden | WebSocket | WebSocket, direkt im Prozess |
| auf dem Uni-Server verfügbar | **nein** | ja |

Eine SQLite-Datei ist dafür gebaut. Durable Objects existieren, um
Edge-Workern zu geben, was ein einzelner Server ohnehin hat.

**Entschieden in ADR 006:** nicht das Produkt wählen, sondern die
Eigenschaft — und sie hinter die Schnittstelle legen, die BETRIEB.md schon
skizziert:

```
speicher/schnittstelle.js   was ein Speicher können muss
speicher/sqlite.js          Uni-Server — Zielbild B, mit Live-Abstimmung
speicher/kv.js              Cloudflare — Übergang, OHNE Live-Abstimmung
```

Zuschnitt bleibt wie beschrieben: ein Bereich je **Kurs** (Zulassung,
Teamraster, Perioden) und einer je **Team** (Ressorts, Vorlagen, Stimmen).
Dein Gedanke „ein Bereich je Team" trägt unverändert — er hängt nicht am
Werkzeug.

### 10.4 Der Rückfallweg

WebSockets fallen in Hochschulnetzen gelegentlich aus (Proxys, Filter).
Deshalb:

1. WebSocket versuchen.
2. Geht das nicht, **auf dasselbe Durable Object abfragen**, alle 3 Sekunden.
   Das ist stark konsistent und damit korrekt — nur weniger flott.
3. Die Oberfläche sagt, in welchem Zustand sie ist: ein stiller Punkt
   „verbunden" gegenüber „Abgleich alle 3 s". Nicht als Warnung, sondern
   damit niemand rätselt, warum etwas hängt.

### 10.5 Der Übergang, solange noch Cloudflare läuft

Bis der Uni-Server steht, läuft das Planspiel weiter bei Cloudflare. Dort
gibt es **keine Live-Abstimmung** — KV kann das nicht (10.2), und Durable
Objects sind verworfen (10.3). Der Übergangsspeicher kann nur:

> **eingereicht — Ergebnis nach dem Schließen**

Das funktioniert, ist aber ein schwächeres Spiel: das Ringen um die
Mehrheit wird unsichtbar. Es muss in der Oberfläche **benannt** werden
(„Ergebnis erscheint, wenn alle abgestimmt haben"), nicht als Fehler
kaschiert.

Getrennte Schlüssel je Team lohnen sich auch im Übergang: sie lösen das
Verlieren von Stimmen, auch wenn sie das Veralten nicht lösen.

---

## 11. Was die API dafür braucht

Aufbauend auf dem, was am 20.09. entstanden ist.

**Erweiterungen am Datenmodell**

```
Member
  + rolle            Pflicht ab Aufstellung: 'fin'|'wir'|'soz'|'umw'
  team               heißt künftig ausdrücklich team_system

TeamState
  + anzeigename      frei gewählt, optional
  + aufstellung_ok   alle vier Rollen vergeben

TeamPeriod
  + vorlagen[]       { id, ressort, fassung, stand, aenderungen{},
                       begruendung, eingebracht_von, eingebracht_am,
                       stimmen{ rolle: 'ja'|'nein'|'enthaltung' },
                       ablehnungsgruende[] }
  (zeichnungen/einsprueche entfallen — die Vorlage ersetzt sie)

Member
  + schaukasten[]    { diagramm, kennzahl, zeitraum, bildunterschrift }

SessionData
  + team_anzahl          wie viele Teams das Raster anbietet
  + zuordnung_offen      Teamwahl noch möglich?
  + quorum               'einfach'|'absolut'|'einstimmig'
  + praesentation_frei   C4 und fremde Schaukästen sichtbar?
```

**Neue Endpunkte**

```
PUT    /sessions/:id/members/:matrikel/rolle      Ressort belegen/freigeben
PUT    /sessions/:id/teams/:team/anzeigename      Teamname setzen
PUT    /sessions/:id/zuordnung                    Zuordnung schließen (Admin)

POST   /sessions/:id/teams/:team/vorlagen         Vorlage einbringen
PUT    /sessions/:id/teams/:team/vorlagen/:vid    überarbeiten (neue Fassung)
DELETE /sessions/:id/teams/:team/vorlagen/:vid    zurückziehen
POST   /sessions/:id/teams/:team/vorlagen/:vid/stimme   abstimmen

PUT    /sessions/:id/members/:matrikel/schaukasten
GET    /sessions/:id/auswertung/:team             fertig gerechnet
```

**Zugang und Notfallwerkzeuge**

```
POST   /kurs/:id/anmeldung            Matrikelnummer + Kennwort → Sitzungstoken
POST   /kurs/:id/erstanmeldung        Name + Kennwort setzen (nur beim ersten Mal)
POST   /kurs/:id/zugang/einloesen     Einmalcode + neues Kennwort

PUT    /kurs/:id/zulassung/:matrikel        Nachzügler zulassen      (Lehrperson)
POST   /kurs/:id/personen/:matrikel/ruecksetzen   → Einmalcode        (Lehrperson)
DELETE /kurs/:id/personen/:matrikel               entfernen            (Lehrperson)
PUT    /kurs/:id/personen/:matrikel/team          umsetzen             (Lehrperson)
DELETE /kurs/:id/teams/:team/anzeigename          Namen zurücksetzen   (Lehrperson)
```

**Live-Verbindung**

```
GET  /team/:id/strom        WebSocket — Stand und Änderungen
GET  /team/:id/stand        Rückfallweg: derselbe Stand als Abruf
```

**Am Datenmodell zusätzlich**

```
Member
  + kennwort { salz, hash, iterationen }    nie im Klartext
  + zugang_code { hash, gueltig_bis }       Einmalcode, auch gehasht
  + letzte_anmeldung
  + zustand      'aktiv' | 'ausgeschieden'

TeamState
  + anzeigename_versuche   Zähler, nicht die Inhalte

Kurs
  + namensliste_version    damit die Wortliste ohne Neubau wechseln kann
```

**Was bleibt:** `/vote` und die Zeichnungs-Endpunkte bleiben bestehen,
solange `index-klassisch.html` existiert. Erst wenn die alte Fläche
abgeschaltet ist, können sie weg.

**Was wegfällt:** Die Matrikelnummer verschwindet aus den Adressen der
Studierendenaufrufe. Sie ist personenbezogen und hat in einem Pfad nichts
verloren, der in Protokollen landet — dieselbe Regel wie beim Admin-Token.
Nach der Anmeldung spricht ein Sitzungstoken für die Person.

---

## 12. Die Speicherung — entschieden, siehe ADR 006

**Kurzfassung.** Der Zuschnitt, den du vorgeschlagen hast — ein Bereich je
Team — bleibt. Das Werkzeug ist ein anderes, als ich zuerst empfohlen habe.

| | |
|---|---|
| **Gebraucht** | serialisierte Schreibzugriffe · starke Konsistenz · Meldung von Änderungen |
| **Zuerst empfohlen** | Cloudflare Durable Objects |
| **Verworfen, weil** | `entwurf/BETRIEB.md` hat am 12.09.2026 festgehalten, dass Cloudflare als Ziel ausscheidet — personenbezogene Daten deutscher Studierender bei einem US-Anbieter. Durable Objects gibt es nur dort. |
| **Entschieden** | die Eigenschaft hinter `speicher/`-Schnittstelle, umgesetzt mit Node + SQLite (Zielbild B) |

Dass die Hosting-Frage „noch nicht geklärt" ist, stimmt für den **Zeitpunkt**
und den **konkreten Server** — nicht für die Richtung. Die steht seit dem
12.09. Genau deshalb ist die Schnittstelle die richtige Antwort auf dein
„erst die bessere Version, Hosting später": sie erlaubt, jetzt die bessere
Version zu bauen, **ohne** die Hosting-Entscheidung vorwegzunehmen.

Deine Einschätzung, dass 400 gleichzeitige Zugriffe unwahrscheinlich sind,
teile ich für den Normalbetrieb. Sie trifft nur dann nicht zu, wenn es am
meisten weh tut: in der Minute nach „Periode 1 ist frei" und in der Minute
vor Fristablauf.

## 13. Reihenfolge des Baus

Jede Stufe ist für sich benutzbar — keine lässt den Kurs unbespielbar zurück.

| Stufe | Inhalt | Warum hier |
|---|---|---|
| **0** | ~~Entscheidung zur Speicherung~~ → **erledigt, ADR 006** | — |
| **1** | `speicher/`-Schnittstelle, `js/dienste/speicher.js` ✓ **gebaut 22.09.** | Alles Weitere schreibt dagegen. Später ist teurer. |
| **2** | A0–A1 Anmeldung mit Kennwort, Zulassung, Rücksetzen | Ohne Identität keine Stimme. **Vorher mit der IT abstimmen.** |
| **3** | A2–A4 Teamzuordnung, Ressortwahl, Teamname ✓ **gebaut 22.09.** | Ohne Rollen kein Abstimmen. |
| **4** | B0/B1/B1a Tisch, Ressortansicht, Werkbank ✓ **gebaut 22.09.** | Die Spielfläche, wie sie sein soll. |
| **5** | B2 Abstimmung ✓ **22.09.** · B3 Protokoll ✓ **23.09.** · Live-Verbindung fehlt (ADR 006) | Der eigentliche Lerninhalt. |
| **6** | E2/E2a/E3/E3a ✓ **gebaut 23.09.** als `leitung.html` — ohne Kennwort-Rücksetzung (hängt an Stufe 2) | Spätestens wenn der erste echte Kurs läuft — vorher fehlt die Feuerwehr. |
| **7** | E4/E6 Perioden und Leitstand ✓ **gebaut 23.09.** in `leitung.html` | Takt und Überblick. |
| **8** | C1/C2 ✓ **gebaut 23.09.** als `auswertung.html` | Nach der ersten durchgespielten Runde. |
| **9** | C3/B1b Baukasten und Schaukasten ✓ **gebaut 23.09.** | Setzt C1/C2 voraus. |
| **10** | D1/D2 Präsentation ✓ **gebaut 23.09.** als `buehne.html` | Setzt die Schaukästen voraus. |
| **11** | E5 Ereignisse, C4 Teamvergleich | Kür. |

**Stufe 6 ist weiter vorn als in der ersten Fassung.** Notfallwerkzeuge sind
kein Komfort: der erste Kurs, in dem jemand sein Kennwort vergisst und nicht
weiterkommt, ist ein verlorener Seminartermin.

---

## 14. Offene Entscheidungen

**Erledigt am 21.09.2026**

- ~~Zurechnung je Ressort~~ → **entfällt.** Kein Zurechnen, stattdessen der
  Werkstattbericht (C2): was ich geändert habe, was danach anders war.
- ~~Speicherung~~ → **getrennt je Team**, umgesetzt als Durable Object
  (§12). Die Kostenfrage bleibt.

**Noch offen**

1. **Erlaubt die Hochschule Node?** Das ist Zielbild B in BETRIEB.md und
   die Voraussetzung für die Live-Abstimmung. Erlaubt sie nur statisches
   Hosting (Zielbild A), gibt es gar keine Sitzungsverwaltung und der
   gesamte Ausbau sieht anders aus. **Das ist die eine Frage, die wirklich
   blockiert** — nicht sofort, aber vor Stufe 5.
2. **Kennwort oder Gerätecode?** (9.3) Ich plane das Kennwort, weil du es so
   beschrieben hast. Der Gerätecode wäre für Studierende bequemer und für
   dich weniger Verantwortung.
3. **Abstimmung mit der IT-Sicherheit und dem Datenschutz.** Kein technischer
   Punkt, aber einer, der den Entwurf ändern kann. *Blockiert Stufe 2.*
4. **„Crash-Verwaltung"** — ich lese es weiter als Schockverwaltung (E5).
   Falls du hängende Sitzungen meintest, gehört das in den Leitstand.
5. **Zwangsschluss durch die Lehrperson**, wenn ein Team sich nicht einigt.
   Vorschlag: ja, mit sichtbarem Vermerk im Protokoll.
6. **Sichtbarkeit fremder Schaukästen** — nur im eigenen Team, oder nach
   Kursende für alle?
7. **Teamgröße ≠ 4.** Vorschlag: mehrere Personen dürfen sich ein Ressort
   teilen, das Ressort hat aber **eine** Stimme.
8. **Wer pflegt die Wortliste?** (8.1) Sie muss ohne neuen Bau änderbar sein,
   sonst ist sie nach dem ersten Kurs veraltet.
9. **Ressorttausch: freiwillig oder nach Plan?** (A3.1) Gebaut ist der
   freiwillige Tausch zwischen den Runden. Ob die Lehrperson eine Rotation
   erzwingen können soll, ist offen.

---

## 15. Was dieser Plan nicht enthält

- Keine fertigen Bildschirmentwürfe. Die Gestaltung der einzelnen Seiten
  folgt der Sprache des Verhandlungstischs (Filz, Karton, Mappen) und wird
  je Stufe entworfen.
- Keinen Aufwand in Stunden. Den kann ich nennen, sobald Abschnitt 10
  entschieden ist — davor wäre jede Zahl geraten.
- Keine Entscheidung über den Abschied von `index-klassisch.html`. Solange
  sie existiert, müssen die alten Endpunkte bleiben.
- **Keine fertige Wortliste.** Sie gehört zusammengestellt, nicht geraten —
  und zwar von jemandem, der die Sprache der Studierenden kennt.
- **Keine Entscheidung zwischen SQLite und Postgres.** Beide passen hinter
  die Schnittstelle; BETRIEB.md Frage 3 hält das offen. Für eine
  Lehrveranstaltung reicht SQLite.
- **Keinen Zeitplan für den Umzug auf den Uni-Server.** Der hängt an der
  Hochschule, nicht an diesem Plan.
