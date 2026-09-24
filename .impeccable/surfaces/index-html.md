---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface brief — Spielflaeche (Studierendenansicht)

Scope: die Hauptoberflaeche des Planspiels, Studierendenansicht. Modus: Operate.
Leitstand und Auswertung folgen spaeter im selben System; `demo.html` wird gestrichen.

Publikum: Teams von 3-5 Studierenden, erstes Mal Steuerpolitik, eigene Laptops
und Handys, Hoersaal, Doppelstunde. Aufgabe: Parameter einstellen, Folgen
verstehen, Periode beschliessen. Beleg: 25 Formelquellen der Engine, die bisher
nirgends sichtbar sind. Rahmen: kein Build-Schritt, Engine unberuehrt, BITV 2.0
verbindlich, Deutsch durchgehend, lokale Schriften.

## Direction contract

**THESIS.** Das Planspiel ist ein Haushalt, also ist die Oberflaeche der
Haushaltsplan — und ein Haushaltsplan wird nicht bedient, er wird geaendert.
Der Spielzug ist das Ueberschreiben eines Titels an seiner Stelle im Dokument.
Verweigert wird die Anordnung, auf der diese Kategorie sonst landet und auf der
die heutige Fassung liegt: Schieberegler in einem Bedienfeld, Kennzahlen als
Kachelreihe daneben, Wirkung hinter einer Schublade. Ein Einzelplan hat keine
Karten. Er hat Kapitel, Titel, Spalten, Summen und einen Erlaeuterungsapparat.

**OWN-WORLD.** Bundeshaushaltsplan in echten Einzelplaenen: Finanzen 08,
Wirtschaft und Klimaschutz 09, Arbeit und Soziales 11, Umwelt 16. Jeder Hebel
ist ein Titel mit Titelnummer und Zweckbestimmung. Kuehles Kontorpapier
(#EDEEE8), Tinte (#191C1A), Linienblau (#1F4E6B) — Linien, niemals Rahmen oder
Karten. Zwei Signaltinten im Vollton, die ganze Spalten besetzen statt
Abzeichen zu setzen: Oxidrot (#6B2118) fuer Mindereinnahmen und Defizit,
Fichtengruen (#2F4A3A) fuer Mehreinnahmen und Entlastung. Kein Mittelgrau als
Ausweichfarbe, kein Creme, keine Schatten, keine Verlaeufe, kein Rundfunk.
Inter mit Tabellenziffern fuer alles Gesetzte, JetBrains Mono ausschliesslich
fuer Titelnummern, wo feste Breite die Spalte traegt. Randstrich links an jeder
geaenderten Zeile, wie eine Aenderungsmarke im Gesetzestext.

**STORY.** Die Studierende sieht ein Dokument, das sie kennt, ohne es zu kennen:
eine Haushaltsseite. Sie versteht, dass die Zahl in der Soll-Spalte ihr gehoert.
Sie ueberschreibt sie, sieht dieselbe Zeile ihre Veraenderung ausweisen und
unten im Gesamtplan den Saldo wandern. Sie klappt die Erlaeuterung auf und
liest, ueber welche Formel und aus welcher Fundstelle das kommt. Sie glaubt,
dass hier nichts behauptet wird. Sie beschliesst die Periode als Beschluss, mit
Vorher-Nachher vor Augen, nicht als Klick auf einen abgeschnittenen Knopf.

**FIRST VIEWPORT.** Kopfzeile schmal: Haushaltsjahr als Ordinate, Team,
Kurskonfiguration im Klartext ablesbar, Verbindungsstand. Darunter die
Dokumentflaeche, zwei Spalten im Verhaeltnis 3:2. Links der Einzelplan: Kapitel
je Ressort mit Nummer, darunter Titelzeilen — Titelnummer mono, Zweckbestimmung
gesetzt, dann SOLL als ueberschreibbares Feld ohne Kasten, nur mit Grundlinie,
daneben STATUS QUO blass und VERAENDERUNG in Signaltinte. Unter jeder Zeile eine
Erlaeuterungszeile auf Abruf. Rechts der Gesamtplan: vier Kennzahlen auf einer
gemeinsamen Messachse mit durchgehender Nulllinie, Status quo als zweite blasse
Spur, darunter die Schlagzeile der Periode als gesetzter Absatz, nicht als
Banner. Fusszeile: Summenzeile mit Saldo und der Beschlussschaltflaeche rechts,
Hoehe aus dem Inhalt, niemals fest. Die Primaerhandlung ist das Zahlenfeld
selbst, nicht ein Knopf daneben.

**FORM.** Der Einzelplan (Bundeshaushaltsplan), Platz 1 meiner nach Resonanz
geordneten Liste; als IMPECCABLE'S PICK gespielt und vom Nutzer gepinnt, gegen
die Zuweisung Index 3 (Das Tafelwerk). Seed key 06f1297b. Code-led, da keine
Bildgenerierung verfuegbar. Signaturinteraktion: das Ueberschreiben eines Titels
im Dokument, das Zeile, Randstrich, Summe und Gesamtplan zugleich fortschreibt.
Bewegungsgrammatik: ein Haushaltsplan animiert nicht, er wird korrigiert —
Werte setzen in einem 90-ms-Schritt ohne Weichzeichnung, kein Easing irgendwo,
weshalb prefers-reduced-motion nichts zu entfernen findet. Fuenf Anhebungen aus
abgelehnten Herausforderern: gemeinsame Messachse mit Status-quo-Spur
(Oszilloskop) · keine Grauzone, voller Kontrast fuer die Projektion (Ikeda) ·
Signaltinte besetzt ganze Spalten (Dumbar) · die Periode ist die Ordinate, an
der jede Zahl haengt (Tauchgang) · ein Beschluss bleibt lebendig und traegt
seine Herleitung bis zur Formel und Fundstelle mit (Steinbruch).

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance

## Unresolved

- Gini-Schwelle: Modellfrage, nicht Designfrage. Die Oberflaeche leitet Schwellen
  bis zur Klaerung aus der Modellbasislinie ab, nicht aus 0,285.
- Beamer-Modus als zweiter Typo-Massstab desselben Dokuments: entschieden, aber
  in dieser Etappe noch nicht gebaut.
- Leitstand und Auswertung im selben System: offen.
