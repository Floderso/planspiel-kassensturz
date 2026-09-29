---
version: 1
slug: "registerband-html"
primary_target: "registerband.html"
related_targets: []
---

# Surface brief — Spielflaeche (Studierendenansicht)

Scope: die Hauptoberflaeche des Planspiels, Studierendenansicht, Datei
`registerband.html`. Modus: Operate. Leitstand und Auswertung folgen spaeter im
selben System; `demo.html` wird gestrichen.

Publikum: Teams von 3-5 Studierenden, erstes Mal Steuerpolitik, eigene Laptops
und Handys, Hoersaal, Doppelstunde. Aufgabe: Parameter einstellen, Folgen
verstehen, Periode beschliessen. Beleg: die Quellenangaben der Engine. Rahmen:
kein Build-Schritt, Engine unberuehrt, BITV 2.0 verbindlich, Deutsch durchgehend,
lokale Schriften.

Vorgeschichte: Die erste Fassung dieser Flaeche wurde als **Der Einzelplan**
gebaut (`haushaltsplan.html`, Richtungsvertrag siehe `index-html.md`). Der Nutzer
hat nach dem Vergleich der Konzeptbilder auf **Das Acetat-Registerband**
umgeschwenkt. Diese gepinnte Entscheidung schlaegt Wurf und Vorgaenger.
`haushaltsplan.html` bleibt zum Vergleich stehen, ist aber nicht mehr die
Zielrichtung.

## Direction contract

**THESIS.** Das Planspiel ist ein Registerband, und eine Periode ist ein
Registerblatt. Der Karton traegt die Stellgroessen im Vollton; die Auswertung
liegt als gestanzte Folie einen Millimeter darueber. **Lage ist der einzige
Rang** — keine Karte, kein Schatten als Zierrat, keine getoente Flaeche
entscheidet, was wichtig ist, sondern ausschliesslich, was oben liegt.
Verweigert wird die Anordnung, auf der diese Kategorie landet und auf der die
heutige Fassung liegt: Regler im Bedienfeld, Kennzahlen als Kachelreihe, Wirkung
hinter einer Schublade. Verweigert wird ebenso die Loesung des Vorgaengers, die
Wirkung neben die Ursache zu setzen: hier liegt sie darueber.

**OWN-WORLD.** Ein Vollton je Periode, ganzflaechig: Ultramarin `#2B3A8C`,
Petrol `#1C6B63`, Sienna `#7A4E14`, Weinrot `#6B2233`, Olivgruen `#3F5220`.
Schrift darauf in Papierweiss `#F8F7F2`. Die Folie ist Milchacetat: ihre
Deckkraft wird **zur Laufzeit** gegen den Kartonton ausgerechnet, bis das
Lesefeld in einem festen Helligkeitsband landet — das ist die Webleistung
dieser Welt und zugleich die Bedingung, unter der BITV haelt. Stanzloecher
ueberall dort, wo geheftet oder gewaehlt wird. Zinnober `#D93A1E` ausschliesslich
fuer den Errata-Streifen, nie als Akzent. Radius 0. Schatten nur als harte
Versatzkante ohne Weichzeichnung, weil Papier so faellt. Inter mit
Tabellenziffern, JetBrains Mono nur fuer Kennungen.

**STORY.** Die Studierende sieht ein aufgeschlagenes Registerband. Sie versteht
ohne Erklaerung, dass der farbige Karton ihre Periode ist und die Reiter rechts
die anderen. Sie aendert eine Stellgroesse auf dem Karton und sieht das
Stanzloch erscheinen; gleichzeitig schreibt sich die Folie darueber um. Sie hebt
die Folie an, um darunter die Herleitung zu lesen. Sie schliesst das Register
mit einem Beschluss, der ihr vorher zeigt, was er bewirkt.

**FIRST VIEWPORT.** Ganzflaechiger Vollton-Karton, rechts der gestufte
Reiterkamm ueber die volle Hoehe, ein Reiter je Periode, Reiterhoehe
proportional zum Umfang des Registers; der aktive Reiter ist der Karton selbst
und traegt keine eigene Kante. Auf dem Karton oben die Kopfzeile mit Registernummer
und Legislatur, darunter die Ressorts als Abschnitte, je Abschnitt die
Stellgroessen als Zeilen: Bezeichnung links, Wert als ueberschreibbares Feld
ohne Kasten, Veraenderung rechts. Geaenderte Zeilen tragen ihr Stanzloch in der
Marge. Rechts oben, ueber den Karton gelegt und ueber seine Kante hinausragend,
die Acetatfolie mit den vier Kennzahlen, ihrer Veraenderung und dem Abschluss.
Unten die Registerzeile mit Abschluss, Zahl der bewegten Stellgroessen und dem
Knopf, der das Register schliesst.

**FORM.** Das Acetat-Registerband, Katalogherkunft `rw-manual-acetate-tab-board`,
in der Richtungsrunde als Herausforderer mit Verdikt **competitive** gefuehrt:
gewinnt die Produktklarheit, verliert die Publikumsidentifikation. Vom Nutzer
nach dem Vergleich der Konzeptbilder gepinnt. Seed key 06f1297b. Code-led, da
keine Bildgenerierung verfuegbar. Signaturinteraktion: das Ueberschreiben einer
Stellgroesse auf dem Karton, das Stanzloch, Folie und Registerzeile zugleich
fortschreibt. Bewegungsgrammatik: ausschliesslich das Scharnier — 90 ms,
`steps(2, jump-none)`, kein Easing an keiner Stelle, weshalb
prefers-reduced-motion nichts zu entfernen findet. Zustandssprache vollstaendig
aus der Welt: **gestanzt** = gewaehlt, **Bildseite nach unten** = gesperrt,
**halb eingehaengt** = Freigabe steht aus, **Zinnober-Errata** = Fehler.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance

## Unresolved

- Reiterkamm mit senkrechter Schrift: schoen, aber bei 200 % Zoom und fuer
  Screenreader heikel. Ab 62 rem abwaerts und bei starkem Zoom waagerecht.
- Beamer-Modus als zweiter Typo-Massstab: entschieden, in dieser Etappe nicht
  gebaut.
- Gini-Schwelle bleibt Modellfrage; Schwellen werden aus der Modellbasislinie
  abgeleitet, nicht aus 0,285.
- Leitstand und Auswertung im selben System: offen.
