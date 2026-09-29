---
version: 1
slug: "kabinett-html"
primary_target: "kabinett.html"
related_targets: []
---

# Surface brief — Spielflaeche (Studierendenansicht)

Scope: die Hauptoberflaeche des Planspiels, Studierendenansicht, Datei
`kabinett.html`. Modus: Operate.

Publikum: Teams von 3-5 Studierenden, erstes Mal Steuerpolitik, eigene Laptops
und Handys, Hoersaal, Doppelstunde. Rahmen: kein Build-Schritt, Engine
unberuehrt, BITV 2.0 verbindlich, Deutsch durchgehend, lokale Schriften.

Vorgeschichte: Diese Flaeche wurde zweimal gebaut — als **Der Einzelplan**
(`haushaltsplan.html`) und als **Das Acetat-Registerband** (`registerband.html`,
abgenommen mit ship). Der Nutzer hat danach ein Bild als Vorlage gegeben und
ausdruecklich gesagt: der Stil und die Stimmung, nicht die Farben. Diese
gepinnte Aesthetik schlaegt Wurf und beide Vorgaenger. Beide Dateien bleiben
zum Vergleich liegen, sind aber nicht mehr die Zielrichtung.

Was die Vorlage zeigt, als Mittel gelesen: eine gleichmaessig dicke Konturlinie
um alles · flache Fuellung ohne Verlauf im Objekt · runde, gedrungene Formen ·
minimale Gesichter aus zwei Punkten und einem Bogen · eine dichte
Stapelkomposition, in der Figuren einander ueberlappen und halten.
Stimmung: gemeinschaftlich, ausgelassen, ungefaehrlich.

## Direction contract

**THESIS.** Das Kabinett ist eine Versammlung von Figuren, und Regieren ist das,
was mit ihren Gesichtern passiert. Eine Kennzahl ist keine Kachel, sondern ein
Wesen, das guckt. Verweigert werden drei Anordnungen: das Hauptbuch der beiden
Vorgaenger, das Kennzahlen-Dashboard der Kategorie, und der Dialog, der die
Wirkung verdeckt. Verweigert wird ebenso das Maskottchen: **keine Figur ist
Dekoration.** Jede traegt ihre Zahl und ihr Wort; das Gesicht ist das vierte
Signal neben Vorzeichen, Farbe und Wort, nie das einzige.

**OWN-WORLD.** Vollgesaettigter Violettgrund `#4B2BC4` mit einem weichen
radialen Schein hinter der Mitte — der Schein ist der einzige Verlauf der ganzen
Flaeche und gehoert dem Grund, nie einer Form. Darauf flache Fuellungen ohne
jeden Verlauf, jede Form von einer gleichmaessig dicken Tintenkontur `#17141F`
umschlossen (3px, mit der Form skalierend). Radius gross und weich, das genaue
Gegenteil des abgeloesten Registerbands. Gesichter aus zwei Punktaugen und einem
Bogenmund in drei Zustaenden: ruhig, erleichtert, besorgt. Signalgruen `#1E8A4C`
und Signalrot `#D4453B` sind ausschliesslich der Richtung vorbehalten, nie
Flaechenschmuck. Baloo 2 spricht (Ueberschriften, Namen, Woerter), Inter mit
Tabellenziffern zaehlt (alle Zahlen) — zwei Schriften, klare Arbeitsteilung,
beide lokal.

**STORY.** Die Studierende sieht oben eine Gruppe von vier Wesen, die
einander ueberlappen und sie ansehen: Saldo, Gini, Emissionen, Wirtschaft. Sie
versteht ohne Erklaerung, dass die vier zusammengehoeren und dass es ihnen
gerade so lala geht. Sie aendert unten eine Stellgroesse und sieht im selben
Augenblick zwei Gesichter kippen: das des zustaendigen Ressorts und das der
betroffenen Kennzahl. Sie liest daneben, um wie viel und warum, und klappt die
Fundstelle auf. Sie schliesst die Runde mit einem Beschluss, der ihr vorher
zeigt, wie die Versammlung danach dasteht.

**FIRST VIEWPORT.** Violettgrund, Schein hinter der Mitte. Oben **Der Rat**:
vier gezeichnete Wesen als ueberlappender Stapel, nicht als Reihe — sie sitzen
ineinander wie in der Vorlage, jedes mit Gesicht, grosser Zahl und Wort. Ihr
Ausdruck folgt dem Abstand zum Rundenstart. Darunter das **Kabinett**: vier
Ressorts, jedes angefuehrt von seiner Ministerfigur, darunter seine
Stellgroessen als dicke, konturierte Zeilen — Name links, Wert als grosses
ueberschreibbares Feld, Veraenderung rechts mit Vorzeichen, Farbe und Wort.
Gesperrte Ressorts liegen als geschlossene Figur da, die schlaeft, mit der
Angabe, wann sie aufwacht. Unten eine feste Leiste mit Abschluss, Zahl der
bewegten Stellgroessen und dem Knopf, der die Runde schliesst.

**FORM.** Vom Nutzer per Bild gepinnte Aesthetik; keine Richtungsrunde, weil ein
gepinnter Brief den Wurf schlaegt. Code-led, keine Bildgenerierung verfuegbar —
alle Figuren sind von Hand ausgezeichnetes Inline-SVG, keine Rastergrafik, kein
Fremdmaterial. Signaturinteraktion: eine Stellgroesse aendern und dabei zwei
Gesichter zugleich kippen sehen, das des Ressorts und das der Kennzahl.
Bewegungsgrammatik: genau ein Moment — das betroffene Wesen sackt einmal kurz
ein und richtet sich auf (180 ms, exponentielles Ausklingen), sonst bewegt sich
nichts. Bei `prefers-reduced-motion` wechselt das Gesicht ohne das Sacken.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance

## Unresolved

- Der Ernst der belegten Oekonomie gegen die Leichtigkeit des Stils: das
  ausgewiesene Risiko dieser Richtung. Die Fundstellen bleiben deshalb im
  Wortlaut der Engine stehen und werden nicht kindlich umformuliert.
- Beamer-Modus: entschieden, in dieser Etappe nicht gebaut.
- Nur Runde 1 bespielbar; kein Rundenwechsel.
- Leitstand und Auswertung stehen weiter aus.
