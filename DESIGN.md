---
name: Kassensturz Registerband
description: Die Spielfläche als Registerblatt — Vollton-Karton, aufgelegte Acetatfolie, Lage ist der einzige Rang.
colors:
  register-ultramarin: "#2B3A8C"
  register-petrol: "#1C6B63"
  register-sienna: "#7A4E14"
  register-weinrot: "#6B2233"
  register-olivgruen: "#3F5220"
  karton: "#2B3A8C"
  papier: "#F8F7F2"
  tinte: "#14140F"
  pult: "#262622"
  zinnober: "#D93A1E"
  errata: "#A32912"
  folienton-neben: "#3D4557"
  richtung-mehr: "#0E3D2B"
  richtung-minder: "#6B160B"
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.015em"
    fontFeature: "'tnum' 1"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
    fontFeature: "'tnum' 1"
  body-neben:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  klein:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.15em"
  kennung:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    letterSpacing: "0.13em"
rounded:
  kante: "0"
  stanzloch: "50%"
spacing:
  zeile: "0.35rem"
  eng: "0.7rem"
  spalte: "1.1rem"
  block: "1.4rem"
  abschnitt: "1.6rem"
  rand: "clamp(1.1rem, 2.6vw, 2rem)"
  ziel: "44px"
  kamm: "88px"
components:
  stellfeld:
    backgroundColor: "transparent"
    textColor: "{colors.papier}"
    typography: "{typography.body}"
    rounded: "{rounded.kante}"
    padding: "0 0.2rem"
    height: "{spacing.ziel}"
  stellfeld-fehler:
    textColor: "{colors.papier}"
    rounded: "{rounded.kante}"
  klappe:
    backgroundColor: "transparent"
    textColor: "{colors.papier}"
    typography: "{typography.body}"
    rounded: "{rounded.kante}"
    padding: "0 0.8rem"
    height: "{spacing.ziel}"
  klappe-gedrueckt:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.karton}"
  schliessen:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.tinte}"
    typography: "{typography.body}"
    rounded: "{rounded.kante}"
    padding: "0 1.2rem"
    height: "{spacing.ziel}"
  zurueck:
    backgroundColor: "transparent"
    textColor: "{colors.tinte}"
    typography: "{typography.body}"
    rounded: "{rounded.kante}"
    padding: "0 1rem"
    height: "{spacing.ziel}"
  weiter:
    backgroundColor: "{colors.tinte}"
    textColor: "{colors.papier}"
    rounded: "{rounded.kante}"
    padding: "0 1rem"
    height: "{spacing.ziel}"
  reiter:
    backgroundColor: "{colors.register-petrol}"
    textColor: "{colors.papier}"
    typography: "{typography.kennung}"
    rounded: "{rounded.kante}"
    padding: "0.7rem 0"
    width: "{spacing.ziel}"
  folie:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.kante}"
    padding: "1rem 1.2rem 1.1rem 2.2rem"
    width: "min(400px, 36%)"
  errata-streifen:
    backgroundColor: "{colors.errata}"
    textColor: "{colors.papier}"
    typography: "{typography.klein}"
    rounded: "{rounded.kante}"
    padding: "0.4rem 0.7rem"
  registerzeile:
    backgroundColor: "{colors.pult}"
    textColor: "{colors.papier}"
    typography: "{typography.body-neben}"
    rounded: "{rounded.kante}"
    padding: "0.6rem clamp(1.1rem, 2.6vw, 2rem)"
    height: "{spacing.ziel}"
---

# Design System: Kassensturz Registerband

## Overview

**Creative North Star: „Das Acetat-Registerband"**

Die Spielfläche ist ein aufgeschlagenes Registerband. Eine Legislaturperiode ist
ein Registerblatt: ganzflächiger Vollton-Karton, der die Stellgrößen trägt,
darüber — einen Millimeter, nicht eine Ebene — die gestanzte Milchacetatfolie mit
der Auswertung. Rechts steht der Reiterkamm über die volle Höhe, ein Reiter je
Periode. Es gibt keine Karten, keine Kacheln, keine Schubladen und keine
Bedienfelder; es gibt ein Blatt, eine Folie und Reiter.

Der Ton ist amtlich-handwerklich, nicht digital-freundlich: Aktenmaterial, das
jemand tatsächlich in der Hand hatte. Die Dichte ist hoch — Zeilen statt Boxen,
Linien statt Abstände —, die Farbe dagegen kommt in großen, ruhigen Flächen. Die
gesamte Tiefe entsteht aus Physik: Papier liegt auf Karton, Karton liegt auf dem
Pult. Nichts wird weichgezeichnet, nichts schwebt, nichts glüht.

**Lage ist der einzige Rang.** Wichtigkeit wird ausschließlich durch
Übereinanderliegen ausgedrückt — nie durch eine getönte Fläche, eine Umrandung,
eine Akzentfarbe oder einen Zierschatten. Wer in dieser Welt etwas hervorheben
will, legt es obenauf oder lässt es.

**Key Characteristics:**
- Ein Vollton je Register, ganzflächig auf dem Karton
- Radius 0 ausnahmslos; das einzige runde Element ist das Stanzloch
- Tiefe nur als harte Versatzkante ohne Weichzeichnung
- Deckkraft der Folie und des Nebentons wird zur Laufzeit gegen den Kartonton gerechnet, nie gesetzt
- Zustandssprache aus der Welt: gestanzt, Bildseite nach unten, halb eingehängt, Zinnober-Errata
- Genau eine Bewegung: das Scharnier, 90 ms, zweistufig, kein Easing
- Inter mit Tabellenziffern; JetBrains Mono nur für Kennungen

## Colors

Fünf gesättigte, dunkle Volltöne als Papierfarben, dagegen Papierweiß und
Volltinte; ein einziges Rot, das ausschließlich Fehler bedeutet.

### Primary
- **Ultramarin** (`#2B3A8C`): Vollton von Register 1 und damit der aktuelle
  Kartonton. Der Karton ist keine Zierfläche, sondern der Träger der gesamten
  Bedienung; er füllt die Hauptspalte von Kante zu Kante.
- **Petrol** (`#1C6B63`), **Sienna** (`#7A4E14`), **Weinrot** (`#6B2233`),
  **Olivgrün** (`#3F5220`): die Volltöne der Register 2 bis 5. Jede Periode
  bekommt genau einen Ton; er erscheint als Kartonfläche, sobald das Register
  läuft, und als Reiterfläche im Kamm, solange es das nicht tut. Register 1 ist
  in dieser Etappe das einzige bespielbare; die anderen vier Volltöne sind
  derzeit nur am Reiter zu sehen.

### Secondary
- **Zinnober** (`#D93A1E`): ausschließlich die 4px-Kante des Errata-Streifens
  und die verdickte Unterlinie eines abgewiesenen Stellfelds. Kein Akzent, kein
  Hinweis, keine Zierde.
- **Errata-Rot** (`#A32912`): die Fläche unter dem Errata-Streifen, dunkel genug,
  dass Papierweiß darauf 6,8:1 hält. Zinnober selbst trüge den Text nicht.

### Neutral
- **Papierweiß** (`#F8F7F2`): jede Schrift auf dem Karton, die Folienfläche, die
  gedrückte Klappe, der Schließen-Knopf, der Fokusring.
- **Volltinte** (`#14140F`): jede Schrift auf der Folie und im Dialog, der
  Weiter-Knopf, das gefüllte Freigabeloch.
- **Pult** (`#262622`): die Unterlage, auf der das Band liegt — Seitenhintergrund,
  Reiterkamm, Registerzeile, Dialoghintergrund und die Tiefe jedes Stanzlochs.
- **Folien-Nebenton** (`#3D4557`): Beschriftungen, Einheiten und Vermerke auf der
  Folie. Auf dem Karton gibt es dafür keinen Festwert (siehe Regel unten).
- **Mehr** (`#0E3D2B`) und **Minder** (`#6B160B`): ausschließlich die fette Zahl
  in der Veränderungszeile der Folie — Richtung gegenüber dem Rundenstart,
  gemessen am Status quo dieses Modells, nie an einer Realweltzahl.

### Named Rules

**Die Gelöste-Deckkraft-Regel.** Nebenrollen bekommen ihre Deckkraft gegen den
Kartonton **gelöst, nicht gesetzt.** `loeseNebenton()` sucht per Binärsuche (24
Schritte) die kleinste Deckkraft, bei der Papierweiß auf dem jeweiligen
Registerton 4,6:1 erreicht; über die fünf Töne ergibt das α 0,600 (Weinrot) bis
0,829 (Petrol). Ein fester Wert fiel durch die Pflicht: 0,74 kam auf Petrol auf
4,01:1 und auf Sienna auf 4,49:1. Dieselbe Suche gilt in `loeseDeckkraft()` für
die Folie selbst, Ziel 13:1, α 0,805 bis 0,844. Wer eine neue Nebenrolle
einführt, nimmt `--neben-alpha` bzw. `--folie-alpha` — ein handgeschriebenes
`opacity` oder `rgb(... / .7)` auf Kartonfläche ist in dieser Welt ein Fehler.

**Die Zinnober-Regel.** Zinnober gehört ausschließlich dem Errata-Streifen.
Nicht für Hinweise, nicht für Vorbehalte, nicht für den wichtigsten Knopf. Der
Vorbehalt in der Beschlussvorlage trägt deshalb zwei Haarlinien und den
Folien-Nebenton, kein Rot — er ist kein Fehler.

**Die Modellmaßstab-Regel.** Farbige Richtungsangaben werden gegen den Status quo
**dieses Modells** gebildet, nie gegen eine Realweltschwelle. Andernfalls kann
eine Politik nicht gelingen und die Farbe lügt.

## Typography

**Body Font:** Inter (lokal aus `fonts/`, Fallback `system-ui, sans-serif`),
variabel 400–700, durchgehend mit Tabellenziffern (`font-variant-numeric:
tabular-nums`, `font-feature-settings: 'tnum' 1`).
**Label/Mono Font:** JetBrains Mono (lokal, Fallback `ui-monospace, monospace`).

**Character:** Eine Familie trägt alles, von der Registerüberschrift bis zur
Fußnote; die Unterschiede macht Größe, Gewicht und Laufweite, nicht ein zweiter
Schnitt. Mono erscheint nur dort, wo etwas eine Kennung oder eine Formel ist.
Weil jede Zahl in Spalten steht, sind Tabellenziffern global und nicht lokal
gesetzt.

### Hierarchy
- **Headline** (700, 1.5rem, 1.22, `-0.02em`, `text-wrap: balance`, max. 38ch):
  die Lage-Überschrift unter dem Blatt und der Registertitel in der Kopfzeile.
- **Title** (700, 1.375rem, `-0.015em`): der Kennzahlenwert auf der Folie — die
  größte Zahl der Fläche.
- **Body** (400, 17px, 1.45): Zeilenbezeichnungen, Stellfelder, Klappen, Knöpfe.
  Fließtext bricht bei 70ch, Definitionslisten bei 66ch.
- **Body-Neben** (400, 0.9375rem): Einheiten, Fortschreibungswert, Delta-Zelle,
  Registerzeile, Kurs- und Teamangabe.
- **Klein** (400/600, 0.875rem): Errata-Streifen, Sperrnotiz, Herleitung,
  Freigabe, Vermerk.
- **Label** (700, 0.75rem, `0.15em`, Versalien): Ressortüberschrift und
  Folienüberschrift. Das ist eine Abschnittsmarke über einer echten Gruppe.
- **Kennung** (400, 0.8125rem, Mono, `0.08–0.13em`): Registernummer, Formeln,
  Reiterbeschriftung, die Auf- und Zuklappmarke der Herleitung.

### Named Rules

**Die Kennungs-Regel.** Mono bedeutet „das ist eine Kennung oder ein Rechenweg",
nicht „das ist technisch". Registernummer, Formel und Reiterjahre tragen sie;
Kennzahlen und Geldbeträge nicht — die stehen in Inter mit Tabellenziffern.

**Die Anzeigedifferenz-Regel.** Eine angezeigte Differenz wird aus den
**angezeigten** Werten gebildet, nicht aus den rohen. Sonst stehen −119, −53 und
„+65" nebeneinander und die Bilanz geht um eins daneben.

## Layout

Zwei Spalten: der Karton (`minmax(0, 1fr)`) und rechts der Reiterkamm (`--kamm`,
88px), zusammen mindestens volle Viewporthöhe. Der Karton trägt innen einen
Randabstand von `clamp(1.1rem, 2.6vw, 2rem)` und 7rem Luft unten, damit die fest
stehende Registerzeile nichts verdeckt. Kopfzeile und Blatt sind um 1,7rem nach
innen gerückt — die Marge, in der die Stanzlöcher der Heftung und der geänderten
Zeilen sitzen.

Eine Stellgrößenzeile ist ein Raster aus vier Spalten (Bezeichnung
`minmax(0,1fr)`, Wert 7,5rem, Fortschreibung 6,5rem, Veränderung 8,5rem) mit
1,1rem Spaltenabstand, an der Grundlinie ausgerichtet, unten von einer Haarlinie
aus Papierweiß bei 20 % geschlossen. Zeilen, Ressortüberschriften und
Sperrnotizen tragen rechts eine Aussparung von der Breite der Folie
(`--folie-breite` = `min(400px, 36%)`), damit die Linien unter der Folie
verschwinden und jenseits ihrer Kante wieder auftauchen. Die Folie klebt
(`position: sticky`, 1rem vom oberen Rand) in einer Bahn, die absichtlich keine
eigene Fläche hat — nur die Folie selbst behauptet Rang. Sie ragt über die
Kartonkante hinaus.

Der vertikale Rhythmus ist eng und linienbasiert: 0,35rem Zeilenpolsterung,
0,7rem innerhalb einer Gruppe, 1,1rem zwischen Spalten, 1,4rem zwischen Blöcken,
1,6rem zwischen Ressorts. Jedes Bedienelement hält 44px Mindestmaß (`--ziel`),
auch die Zusammenfassung der Herleitung.

**Der Bruch liegt bei 62rem** und ist ein echter Umbau, keine Verkleinerung:
der Reiterkamm klappt von senkrecht auf waagerecht und wandert vor den Karton
(`order: -1`); die Folie hört auf zu kleben und steht fest oben über dem Blatt,
weil sie klebend 413 von 844 px einnahm und vier Zeilen übrig ließ; die
Zeileneinrückung nach rechts entfällt vollständig; die Zeile schrumpft auf zwei
Spalten, die Fortschreibung entfällt, die Veränderung rutscht auf die volle
Breite; die Aufklappmarke der Herleitung wechselt von hinten nach vorn, damit sie
nicht als Waise in eine eigene Zeile fällt. Unter 34rem verschwinden die
Heftlöcher, die Einrückung geht auf 0 und der Schließen-Knopf wird volle Breite.

Der laufende Abschluss steht in der fest am unteren Rand stehenden Registerzeile
und trägt schmal das, was die Folie breit trägt.

## Elevation & Depth

**Diese Welt kennt keinen Weichschatten.** Tiefe entsteht aus zwei Materialien:
einer harten Versatzkante ohne jede Weichzeichnung, weil Papier so fällt, und
einer eingedrückten Stanzung. Es gibt keinen Blur-Radius größer 2px, keinen
Schein, keine Transparenzebene außer der gerechneten Folie. Hervorhebung durch
Erhebung existiert nicht: Rang kommt aus der Lage.

### Shadow Vocabulary
- **Folienkante** (`box-shadow: -2px 0 0 rgb(0 0 0 / .3), 9px 10px 0 rgb(0 0 0 / .26)`):
  die aufgelegte Acetatfolie. Erster Teil ist die Kante an der Heftseite, zweiter
  der Schlagschatten auf dem Karton. Nur die Folie und der modale Beschluss
  (`9px 10px 0 rgb(0 0 0 / .3)`) tragen ihn.
- **Stanzung** (`background: var(--pult); box-shadow: inset 0 1px 2px rgb(0 0 0 / .4–.55)`):
  jedes Loch — Heftung, geänderte Zeile, Folienheftung. Die Fläche zeigt das
  Pult, die Innenkante die Materialstärke.

### Named Rules

**Die Lage-ist-Rang-Regel.** Es liegt genau eine Sache über einer anderen: die
Folie über dem Karton. Eine zweite Ebene, ein aufsteigender Schatten beim Hover,
eine schwebende Karte oder ein Weichzeichner sind in dieser Welt nicht
vorgesehen.

**Die Entzugsflächen-Regel.** Die getönte Vollbreitenfläche
(`rgb(0 0 0 / .3)` über das Ressort) **entzieht Rang und verleiht ihn nie.** Sie
bedeutet ausschließlich „Bildseite nach unten": ein Ressort, das in diesem
Register noch nicht freigegeben ist — die unbedruckte Rückseite desselben
Kartons. Sie darf nicht zu einem Kartensystem verallgemeinert werden, nicht zur
Gruppierung, nicht zur Betonung, nicht als Panel. Kein Ausgrauen der Schrift:
die Erklärtexte müssen lesbar bleiben, sie sagen ja, wann es aufgeht.

## Shapes

**Radius 0, ausnahmslos.** Jeder Knopf, jedes Feld, jeder Streifen, der Dialog
und der Reiter haben rechte Winkel; `border-radius: 0` wird dort ausdrücklich
gesetzt, wo der Browser von sich aus rundet. Die einzige Rundung der Welt ist der
Kreis: das Stanzloch (`border-radius: 50%`, 9–13px), und es ist nie Dekor,
sondern immer ein Zustand.

Begrenzung passiert durch Linien, nicht durch Kästen. Vorherrschend ist die
untere Haarlinie: 1px Papierweiß bei 20 % unter einer Zeile, bei 28 % unter einer
Ressortüberschrift, bei 38 % unter der Kopfzeile. Eingaben sind Felder ohne
Kasten — nur eine 1,5px-Unterlinie, gepunktet wenn gesperrt, zinnoberrot und
2,5px wenn abgewiesen. Ein Abschluss wird durch eine dreifach starke Doppellinie
(`3px double`) gezogen, wie in einem Rechnungsbuch. Die zwei ikonischen
Zeichen — der Haken des erledigten Registers und die Marke der Sperrnotiz — sind
aus Rändern gezeichnet, nicht als Glyphe gesetzt.

## Components

### Stellfeld (überschreibbarer Wert)
Der Kern der Fläche: ein Wert, den man überschreibt, kein Regler.
- **Form:** kasenlos, nur Unterlinie (1,5px Papierweiß bei 55 %), Radius 0,
  rechtsbündig, 700, Tabellenziffern, Mindesthöhe 44px.
- **Hover:** Unterlinie geht auf volles Papierweiß.
- **Fokus:** 2px Papierweiß-Ring, 2px Versatz (auf der Folie: Volltinte).
- **Gesperrt:** Unterlinie gepunktet, Deckkraft 0,8.
- **Abgewiesen:** Unterlinie Zinnober, 2,5px, `aria-invalid="true"`, darunter der
  Errata-Streifen mit dem zulässigen Bereich im Klartext.

### Klappe (Ja/Nein)
Das einzige gerahmte Bedienelement der Fläche.
- **Form:** 1,5px Rahmen Papierweiß bei 55 %, Radius 0, mindestens 5rem breit.
- **Gedrückt** (`aria-pressed="true"`): Fläche Papierweiß, Schrift im Kartonton —
  das Feld kippt um, statt ein Häkchen zu bekommen.

### Knöpfe
- **Register schließen:** Papierweiße Vollfläche, Volltinte, 700, Radius 0, 44px
  hoch, 1,2rem Innenrand. Deaktiviert, solange nichts bewegt ist: dann nur ein
  Rahmen aus Papierweiß bei 30 % und Schrift bei 50 %.
- **Zurück:** Umriss aus Volltinte bei 55 % auf der Folienfläche.
- **Beschluss fassen:** dieselbe Form, aber Volltinte gefüllt, Papierweiß
  beschriftet. Die Bestätigung ist der dunkelste Punkt des Dialogs, nicht der
  bunteste.

### Reiter (Registerkamm)
Ein Reiter je Periode, senkrecht gesetzt (`writing-mode: vertical-rl`), in Mono,
die Fläche im Vollton des Registers, mit 3px Fuge dazwischen.
- **Höhe:** proportional zum Umfang des Registers (`flex` = Zahl der bis dahin
  freigegebenen Stellgrößen). Die didaktische Freischaltung wird zur Form des
  Bandes.
- **Laufend** (`aria-current="true"`): 700 und 10px nach links geschoben — der
  Reiter schiebt sich unter den Karton, trägt also keine eigene Kante.
- **Andere:** Deckkraft 0,62, `disabled`.
- **Erledigt:** zusätzlich der gezeichnete Haken.
- **Schmal:** waagerecht, horizontal scrollend, über dem Karton; der laufende
  Reiter schiebt sich statt nach links um 6px nach unten.

### Folie (aufgelegte Auswertung)
Die Signaturfläche. Milchacetat über Vollton: Papierweiß mit zur Laufzeit
gelöster Deckkraft, Volltinte, zwei Stanzlöcher an der Heftkante, harte
Versatzkante, `position: sticky`. Innen: Folienüberschrift als Label, vier
Kennzahlen als Definitionsliste (Wert 1,375rem rechtsbündig, darunter eine
Veränderungszeile über die volle Breite), der Abschluss unter einer Doppellinie,
die Freigabe als Reihe halb gefüllter Löcher, zuletzt der Vermerk nach gefasstem
Beschluss. Sie schreibt sich bei jeder Änderung mit um und bekommt dafür
dasselbe Scharnier wie die Delta-Zelle.

### Errata-Streifen
Eingelegt, nicht eingefärbt: er spannt über alle Spalten der Zeile, Fläche
Errata-Rot, 4px Zinnoberkante links, Papierweiß, 600, klein. Er trägt immer den
zulässigen Bereich im Klartext und wird derselben Zeile per `aria-describedby`
zugeordnet. Er ist der einzige Ort der Welt, an dem Rot vorkommt.

### Herleitung
`<details>` unter der Bezeichnung, nicht daneben. Die Zusammenfassung ist 44px
hoch, der Marker ist entfernt und durch `+` / `−` (U+2212) in Mono ersetzt —
hinten auf breit, vorn auf schmal. Geöffnet wird die Zusammenfassung fett; der
Inhalt ist eine Definitionsliste mit linker Haarlinie, 66ch breit, mit Rechenweg
(Mono), Fundstelle und Anmerkung.

### Registerzeile
Fest am unteren Rand, Pultfläche, 1px Oberlinie, `--rand` seitlich, mindestens
44px hoch, umbruchfähig. Trägt Registerstand, laufenden Abschluss, Zahl der
bewegten Stellgrößen und rechts den Schließen-Knopf. Fette Werte stehen in vollem
Papierweiß, ihre Beschriftungen bei 82 %.

### Beschlussvorlage
`<dialog>` auf Folienfläche, Radius 0, max. 46rem, harte Versatzkante,
Pult-Backdrop bei 72 %. Dreigeteilt durch Haarlinien: Kopf, Rumpf mit zwei
Tabellen (rechtsbündige Zahlen, linksbündige erste Spalte, Zeilen durch
Haarlinien getrennt, scrollbar bis 50vh), Fuß mit Zurück links und Beschluss
fassen rechts.

## Do's and Don'ts

### Do:
- **Do** den Kartonton pro Register setzen und `--folie-alpha` sowie
  `--neben-alpha` derselben Binärsuche überlassen (Ziel 13:1 bzw. 4,6:1).
- **Do** Rang durch Lage ausdrücken: die Folie liegt über dem Karton, sonst
  nichts über nichts.
- **Do** Radius 0 verwenden und `border-radius: 0` dort ausdrücklich setzen, wo
  der Browser von sich aus rundet.
- **Do** Tiefe als harte Versatzkante schreiben (`9px 10px 0`) und Stanzungen als
  Pultfläche mit `inset 0 1px 2px`.
- **Do** Zustände in der Sprache der Welt benennen: gestanzt = gewählt,
  Bildseite nach unten = gesperrt, halb eingehängt = Freigabe steht aus,
  Zinnober-Errata = Fehler.
- **Do** jede Bewegung auf das Scharnier beschränken: 90 ms,
  `steps(2, jump-none)`, kein Easing an keiner Stelle — deshalb findet
  `prefers-reduced-motion` nichts zu entfernen.
- **Do** 44px Mindestmaß für jedes Bedienelement halten, auch für eine
  `<summary>`.
- **Do** Fehlertext im Klartext mit zulässigem Bereich in den Errata-Streifen
  schreiben und ihn sofort ansagen, nicht entprellt.
- **Do** Schriften lokal aus `fonts/` einbinden; kein externer Schriftdienst.

### Don't:
- **Don't** eine Deckkraft für eine Nebenrolle von Hand setzen. Ein fester Wert
  fiel auf Petrol (4,01:1) und Sienna (4,49:1) durch die Pflicht.
- **Don't** die getönte Vollbreitenfläche zum Kartensystem machen. Sie entzieht
  Rang und verleiht ihn nie; sie bedeutet genau eines: Bildseite nach unten.
- **Don't** Zinnober außerhalb des Errata-Streifens und der abgewiesenen
  Feldunterlinie verwenden — auch nicht für Vorbehalte oder Hinweise.
- **Don't** einen weichgezeichneten Schatten, einen Schein oder ein Leuchten
  einführen; Tiefe fällt hier hart.
- **Don't** Werte in Kacheln, Karten oder Panels gruppieren; Gruppen entstehen
  aus Überschrift und Haarlinie.
- **Don't** Regler oder Bedienfelder bauen. Ein Wert wird überschrieben.
- **Don't** einen Easing-Verlauf, eine Übergangsdauer oder eine zweite Animation
  ergänzen.
- **Don't** ein gesperrtes Ressort ausgrauen — seine Erklärung muss lesbar
  bleiben.
- **Don't** Richtungsfarben gegen eine Realweltschwelle bilden; Maßstab ist der
  Status quo dieses Modells.
