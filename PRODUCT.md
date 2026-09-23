# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Studierende** in BWL-/VWL-Lehrveranstaltungen, in Teams von typisch 3–5
Personen, an eigenen Laptops und Handys, im Hoersaal, innerhalb einer
Doppelstunde. Die meisten simulieren zum ersten Mal Steuerpolitik und bringen
kein Vorwissen zu Gini, Domar, Palma, HANK oder METR mit.

**Lehrende** richten eine Sitzung ein, geben Perioden frei, steuern welche
Handlungsfelder in welcher Periode offen sind, und moderieren die Auswertung —
vorne im Raum, oft gleichzeitig projizierend. Nicht nur der Autor: auch
Kolleginnen und Kollegen derselben Hochschule sollen eigene Sitzungen
aufsetzen koennen, ohne zu fragen. Der Leitstand muss sich daher selbst
erklaeren, und die aktive Kurskonfiguration muss jederzeit ablesbar sein.

## Product Purpose

Studierende stellen steuer- und sozialpolitische Parameter ein; die Simulation
zeigt sofort die Folgen fuer Haushaltssaldo, Ungleichheit, CO₂ und BIP. Ueber
mehrere Legislaturperioden werden Zielkonflikte erfahrbar statt behauptet.

Erfolg ist nicht, dass Teams gute Kennzahlen erreichen, sondern dass sie im
Debriefing benennen koennen, **warum** ihre Politik so gewirkt hat — und worin
sie sich von der der anderen Teams unterscheidet.

## Positioning

Ein Rechenkern mit belegten Annahmen, der seine Ergebnisse in politische
Sprache uebersetzt. Zwei Dinge zusammen kann sonst nichts in dieser Kategorie:

- **Belegte Oekonomie.** § 32a EStG als amtlicher Formeltarif, DICE-Klimaschaden,
  HANK-Multiplikator, Domar/S2/GGI, Aufkommen gegen BMF-/Destatis-Ist-Werte
  kalibriert. 25 Formelquellen mit Fundstelle, nicht als Zierrat sondern als
  Projektregel: eine Zahl ohne Beleg gilt hier als wertlos.
- **Uebersetzung in Folgen.** Das Modell schreibt aus seinen eigenen Zahlen eine
  Schlagzeile. Ein Spitzensteuersatz wird nicht zu einem Balken, sondern zu
  „Haushaltsloch reisst Schuldenbremse um 116 Mrd. Euro". Das ist die
  Erfindung dieses Produkts.

Dazu die Didaktik als Produktfunktion, nicht als Einstellung: drei
Komplexitaetsstufen und die Freigabe von Handlungsfeldern je Periode geben der
Lehrperson die Steuerung ueber den Lernaufbau.

## Operating Context

- Hoersaal, Doppelstunde, Beamer. Die Lehrperson moderiert vorne und bedient
  gleichzeitig den Leitstand. Projiziert wird tatsaechlich, regelmaessig.
- Hochschul-WLAN mit vielen Geraeten gleichzeitig. Verbindungsabbrueche sind
  der Normalfall, nicht die Ausnahme.
- Studierende kommen ueber einen Join-Link, teils mit Matrikelnummer. Geraete
  sind gemischt: eigene Laptops, Handys, gelegentlich Pool-Rechner, auf denen
  schon ein fremder Spielstand liegen kann.
- Ablauf einer Sitzung: Sitzung einrichten → Link verteilen → Teams stellen
  Parameter ein → Periode abschliessen (Quorum) → Lehrperson gibt naechste
  Periode frei → nach der letzten Periode Debriefing mit Teamvergleich.
- Das Debriefing folgt einem 4-Phasen-Moderationsleitfaden nach Kriz &
  Thiagarajan.

## Capabilities and Constraints

**Funktion.** 35 Parameter in 11 Modulen, nach Komplexitaetsstufe gestaffelt
(10 Einsteiger, 26 Fortgeschritten, 35 Experte). 4 Kabinettsressorts. 32
Lernziele, 10 Schockereignisse, 7 Voreinstellungen. Mehrperiodenbetrieb mit
Legislaturlogik und Quorum. Teamvergleich und Debriefing.

**Nicht verhandelbar** (aus CLAUDE.md und ADR 001–004):

- Kein Build-Schritt. `index.html` laedt ES-Module, der Browser loest sie auf.
  Kein Bundler, kein Transpiler, keine `node_modules` im Frontend. Eine neue
  npm-Abhaengigkeit im Frontend aendert die Architektur und braucht Rueckfrage.
- Die Engine (`js/rechner/`, `js/data.js`) bleibt unberuehrt. 85 Tests,
  darunter Dimensions- und komparativ-statische Pruefungen. Modellannahmen
  stehen genau einmal, in `data.js`.
- Jede oekonomische Annahme traegt ihre Quelle in `FORMEL_QUELLEN_*`.
- Genau eine Datei spricht mit dem Server: `js/dienste/server.js`. Maschinell
  erzwungen durch `tests/architektur.test.js`.
- Keine Adressen im Code. Alles ueber `/konfig.js`. Leeres `api_basis` heisst
  vollstaendiger Offline-Betrieb — ein gueltiger Betriebsfall, kein Fehler.
- Admin-Token nie in der URL, nur im Fragment (`#token=`).
- Schriften liegen lokal. Kein Google, kein CDN: die IP-Adresse einer
  studierenden Person geht nicht an einen Drittanbieter.
- SPDX-Kopf in jeder Quelldatei. Deutsch durchgehend — Oberflaeche, Bezeichner,
  Kommentare, Commit-Nachrichten.

**Offen / bekannt kaputt** (Stand 16.09.2026, aus der Designpruefung):

- Die URL-Kurskonfiguration wird nach dem ersten Spiel auf einem Geraet
  dauerhaft ignoriert. Mit fremden Lehrenden als Nutzergruppe ist das der
  gewichtigste Defekt im Produkt.
- Netzwerk- und Abstimmungsfehler werden verschluckt; kein Verbindungsstand.
- Der Periodenabschluss ist unbestaetigt und unumkehrbar.
- Die Gini-Schwelle (0,285) ist aus Realweltzahlen geliehen, waehrend die
  Modellbasislinie bei 0,3766 liegt und die spielbare Spanne 0,019 betraegt.
  Ob das Modell hier genug Bewegung zulaesst, ist eine **offene Modellfrage**,
  keine Designfrage.
- `localStorage` liegt noch verstreut (Architektur-Schritt 2, als `todo`
  markiert).

## Brand Commitments

**Verbindlich ist der Name** — „Kassensturz Planspiel", kassensturz.org — und
sonst nichts. Ausdruecklich **nicht** verbindlich (entschieden 16.09.2026):

- Die Palette in `Designe idehen planspiel/Farben.rtf` (Fresh Sky `#00a7e1`,
  Dusty Mauve `#b0413e`, Sage Green `#6baa75`) war ein Versuch und kommt im
  Produkt nicht vor. Die Farbwelt ist frei.
- Bespoke Stencil wird nicht eingesetzt. Die Fontshare-EULA untersagt das
  Hochladen der Schriftdatei auf einen oeffentlichen Server; ein Weg ueber die
  Fontshare-API wuerde die Seite wieder an einen fremden Server haengen.

Lizenz: Engine-Code CC-BY-4.0 (kassensturz.org). Privates Repo, Inhalte gehen
nicht nach aussen.

## Evidence on Hand

- 25 belegte Formelquellen in `js/rechner/` (`FORMEL_QUELLEN_*`: `berechne` 10,
  `verteilung` 6, `rente` 5, `einkommensteuer` 4) — **in der Oberflaeche
  bisher nirgends sichtbar.**
- 85 Tests, darunter Kalibrierung gegen amtliche BMF-/Destatis-Ist-Werte 2024
  und ein fixierter Status-quo-Regressionspfad.
- Echte Ausgangsdaten: 12 Einkommensdezile mit Bruttoeinkommen, Kapitalanteil,
  Konsumquote und Vermoegen; Staatsausgaben und Basisaufkommen nach Steuerart.
- 10 Schockereignisse, 32 Lernziele, 7 Reformvoreinstellungen (u. a.
  Kirchhof-Reform, Skandinavisches Modell).
- `entwurf/mockup.html` und `entwurf/tiefe.html` sind **statische Bilder ohne
  Engine** — die Zahlen darin sind eingetippt. Kein Belegmaterial fuer
  Modellverhalten.

**Nicht vorhanden und nicht zu erfinden:** echte Kursergebnisse, Zitate
Studierender, Evaluationsdaten, Nutzungszahlen. Kein Preis, kein Kunde, keine
Referenz.

## Product Principles

1. **Ursache und Wirkung gehoeren auf eine Flaeche.** Wer an einem Hebel zieht,
   muss die Folge dabei sehen. Ein Muster, das die Wirkung verdeckt, waehrend
   sie entsteht, widerspricht dem Zweck des Produkts.
2. **Keine Zahl ohne Herkunft.** Was die Engine belegt, muss die Oberflaeche
   zeigen koennen. Das ist die Projektregel, nur bisher unerfuellt.
3. **Schwellen kommen aus dem eigenen Modell.** „Gut" und „schlecht" werden
   relativ zum Status quo dieses Modells definiert, nicht aus Realweltzahlen
   geliehen. Sonst kann eine Politik nicht gelingen, und die Farbe luegt.
4. **Die Didaktik der Lehrperson ist erstklassige Funktion.** Komplexitaetsstufen
   und Freigabe je Periode sind keine Einstellungen, sondern das Werkzeug, mit
   dem unterrichtet wird — und sie muessen sich fremden Lehrenden erklaeren.
5. **Der Raum ist Teil des Produkts.** Projektion, Entfernung, geteiltes WLAN
   und 90 Minuten sind Entwurfsbedingungen, keine Randfaelle.
6. **Unterscheiden statt bewerten.** Die Auswertung hat zu zeigen, wodurch sich
   Teams unterscheiden; das Gemeinsame wird einmal erklaert, nicht je Team
   wiederholt.

## Accessibility & Inclusion

**Formale Pflicht.** Die Anwendung laeuft an einer Hochschule als oeffentlicher
Stelle; BITV 2.0 und EN 301 549 gelten verbindlich, WCAG 2.1 AA ist
Untergrenze und Abnahmebedingung, nicht Empfehlung. Konkret:

- Vollstaendige Tastaturbedienbarkeit, sichtbarer Fokus auf allem Bedienbaren.
- Screenreader-Durchlauf vor dem Kurseinsatz — Handarbeit, nicht automatisierbar.
- Kontrast AA in jedem Thema; Bedeutung nie allein ueber Farbe (Vorzeichen,
  Farbe und Wort zusammen).
- Trefferflaechen mindestens 44 × 44 px.
- Respekt vor `prefers-reduced-motion`.

Ausgangslage Stand 16.09.2026: **0 `aria`-Attribute, 0 `role`-Attribute,
kein `:focus-visible`, dreimal entferntes `outline`** in allen vier
Oberflaechen und allen 15 JS-Dateien. Die Pflicht ist derzeit nicht erfuellt.

Dazu kommt Datenschutz als Inklusionsfrage: Matrikelnummern sind
personenbezogen, weshalb keine Schrift, kein Skript und kein Stil von einem
fremden Server geladen wird.
