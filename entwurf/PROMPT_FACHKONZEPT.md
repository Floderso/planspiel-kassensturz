# Fachkonzept-Prompt: Planspiel „Kassensturz"

> Dieser Prompt beschreibt ausschließlich das inhaltliche Konzept, die
> Rechenlogik und die Zahlen, die dargestellt werden müssen. Er enthält
> bewusst **keine** Angaben zu Layout, Farben, Bedienelementen, Navigation
> oder sonstiger rein optischer Gestaltung.

---

## 1. Grundidee

Baue ein wirtschaftspolitisches Planspiel für Lehrveranstaltungen. Studierende
übernehmen in Teams die Rolle einer Regierungskoalition und legen für mehrere
aufeinanderfolgende Legislaturperioden die Parameter der Steuer-, Abgaben-,
Sozial- und Klimapolitik Deutschlands fest. Die Simulation beantwortet sofort
und vollständig deterministisch die Frage: Was kostet das, wer zahlt es, wer
profitiert, was passiert mit Schulden, Ungleichheit, Emissionen und Wachstum?

Kernpunkte des didaktischen Konzepts:

- **Zielkonflikte sichtbar machen.** Kein Parametersatz erfüllt alle Ziele
  gleichzeitig. Haushaltssanierung, Umverteilung, Klimaschutz, Standort­
  attraktivität und Generationengerechtigkeit stehen quantifiziert gegen­
  einander.
- **Jede Zahl hat eine Quelle.** Sämtliche Ausgangsdaten, Elastizitäten und
  Formeln sind mit Institut, Jahr und Publikation belegt. Das Modell ist
  wissenschaftlich begründet, nicht frei erfunden. Formeln und Quellen werden
  zu jeder ausgewiesenen Kennzahl mitgeführt und sind abrufbar.
- **Mehrperiodige Dynamik.** Entscheidungen einer Periode verändern den
  Ausgangszustand der nächsten (Schuldenstand, BIP, kumulierte Emissionen,
  Arbeitsmarktzustand, Demografie). Fehler wirken verzögert.
- **Exogene Schocks.** Die Lehrperson kann Perioden mit externen Ereignissen
  belegen, die unabhängig von den politischen Hebeln wirken.
- **Vollständig deterministisch und offline lauffähig.** Gleiche Parameter
  ergeben immer das gleiche Ergebnis; ein Server ist optional.

---

## 2. Spielablauf und Rollenmodell

### Akteure
- **Lehrperson (Administration):** legt eine Kurssitzung an, konfiguriert sie,
  setzt Schocks und Lernziele, sperrt Perioden, vergleicht Teams, moderiert
  das Debriefing.
- **Team (Regierungskoalition):** 1–n Studierende, standardmäßig 4. Ein Team
  teilt einen gemeinsamen Parametersatz je Periode.

### Ablauf
1. Lehrperson erstellt eine Sitzung und erhält eine Beitrittsadresse.
2. Studierende treten der Sitzung bei und ordnen sich einem Team zu.
3. Je Periode stellt das Team die Politikparameter ein; das Ergebnis wird
   sofort neu berechnet (Rechenzeit unter 5 ms, keine Serverrunde nötig).
4. Teammitglieder stimmen über den Abschluss der Periode ab. Ist das Quorum
   (Mindestteilnahmequote × Teamgröße) erreicht, wird die Periode gesperrt
   und ihre Parameter sind fixiert.
5. Der Endzustand der gesperrten Periode ist der Ausgangszustand der nächsten.
6. Nach der letzten Periode: Vergleich aller Teams über den gesamten Zeitpfad
   und strukturiertes Debriefing.

### Konfigurierbare Kursparameter
| Parameter | Bereich | Standard |
|---|---|---|
| Anzahl Spielperioden | 3–12 | 5 |
| Jahre je Periode | 1–4 (auch je Periode einzeln) | 4 |
| Teamgröße | ≥ 1 | 4 |
| Mindestteilnahmequote für Periodensperre | 0–1 | 0,5 |
| Abstimmungsfrist | Stunden | 48 |
| Sandbox-Modus (keine Sperre, keine Wertung) | an/aus | an |
| Komplexitätsstufe | Einsteiger / Fortgeschritten / Experte | Fortgeschritten |
| Schocks | Liste aus {Schock-ID, Periode} | leer |
| Lernziele | Liste aus {Kennzahl, Operator, Zielwert} | leer |

Die Komplexitätsstufe steuert, welche Parametergruppen und Ergebnisgrößen
überhaupt zum Spiel gehören: Einsteiger = Einkommensteuer, Mehrwertsteuer,
CO₂, Unternehmensteuern, Investitionsimpuls; Fortgeschritten zusätzlich
Sozialversicherung, Vermögen/Erbschaft, Transfers, Grundeinkommen;
Experte zusätzlich Verbrauchsteuern, Rentenreform, GKV-Strukturreform sowie
die Ergebnisgrößen Laffer-Kurve und Grenzabgabensätze.

### Lernziele als Wertungsmaßstab
Die Lehrperson definiert Lernziele als Schwellenbedingungen auf fünf
Kennzahlen: Haushaltssaldo in % BIP, Schuldenquote, Gini-Koeffizient,
kumulierte CO₂-Emissionen, BIP. Operatoren: `<`, `<=`, `>`, `>=`. Ausgewiesen
wird je Team, wie viele Lernziele erreicht sind, und je Lernziel der Istwert.

---

## 3. Einstellbare Politikparameter

Alle Parameter sind je Periode getrennt einstellbar. Angegeben sind Bereich,
Schrittweite und der Status-quo-Wert (Rechtsstand Deutschland 2025).

### Einkommensteuer
| Parameter | Einheit | Bereich | Schritt | Status quo |
|---|---|---|---|---|
| Grundfreibetrag | € | 8.000–20.000 | 100 | 12.348 |
| Eingangssteuersatz | % | 10–30 | 0,5 | 14 |
| Spitzensteuersatz | % | 35–65 | 0,5 | 45 |
| Einkommensgrenze Spitzensatz | € | — | — | 277.826 |
| Synthetische Besteuerung (Kapital wie Arbeit) | an/aus | — | — | aus |
| Abgeltungsteuersatz auf Kapital | % | — | — | 25 |

### Mehrwertsteuer
| Regelsatz | % | 15–30 | 0,5 | 19 |
|---|---|---|---|---|
| Ermäßigter Satz | % | 0–15 | 0,5 | 7 |

### CO₂-Bepreisung
| CO₂-Preis | €/t | 25–350 | 5 | 55 |
|---|---|---|---|---|
| Klimageld auszahlen (70 % Rückverteilung pro Kopf) | an/aus | — | — | an |

### Unternehmensteuern
| Körperschaftsteuer | % | 5–30 | 0,5 | 15 |
|---|---|---|---|---|
| Gewerbesteuer-Äquivalent | % | 0–20 | 0,5 | 14 |
| Gewerbesteuer abschaffen | an/aus | — | — | aus |

### Sozialversicherung
| Rentenbeitragssatz (AN+AG) | % | 14–26 | 0,1 | 18,6 |
|---|---|---|---|---|
| Krankenversicherungsbeitrag | % | 12–22 | 0,1 | 16,3 |
| Arbeitslosen- + Pflegeversicherung | % | — | — | 6,2 |
| Beitragsbemessungsgrenze | € | 63.000–180.000 | 1.000 | 90.000 |
| Bürgerversicherung | an/aus | — | — | aus |

### Vermögen und Erbschaft
| Erbschaftsteuersatz | % | 0–50 | 0,5 | 20 |
|---|---|---|---|---|
| Betriebsvermögen-Privileg | an/aus | — | — | an |
| Bodenwertsteuer | % | 0–2 | 0,05 | 0,4 |
| Vermögensteuer | % | 0–2 | 0,1 | 0 |
| Zucman-Mindeststeuer auf Ultravermögen | % | 0–2 | 0,1 | 0 |

### Transfers und Sozialstaat
| Bürgergeld-Regelsatz | €/Monat | 0–1.000 | 10 | 563 |
|---|---|---|---|---|
| Kindergeld | €/Monat | 0–400 | 10 | 259 |
| Negative Einkommensteuer | an/aus | — | — | aus |

### Bedingungsloses Grundeinkommen
| BGE-Höhe | €/Monat | 0–1.600 | 50 | 0 |
|---|---|---|---|---|
| Renten-Einkommensgrenze | € | 15.000–60.000 | 1.000 | 35.000 |
| Ziel-Rentenniveau Geringverdiener | % | 50–100 | 5 | 80 |
| Ziel-Rentenniveau Gutverdiener | % | 30–80 | 5 | 50 |

### Investitionen
| Öffentlicher Investitionsimpuls | Mrd. €/Jahr | −30 bis +120 | 5 | 0 |
|---|---|---|---|---|

### Verbrauchsteuern (Expertenstufe)
| Kleine Verbrauchsteuern aktiv (Energie, Tabak, Kfz, Versicherung, Soli/Abgeltung) | an/aus | — | — | an |
|---|---|---|---|---|

### Rentenreform (Expertenstufe)
| Fondsquote des RV-Aufkommens | % | 0–20 | 1 | 0 |
|---|---|---|---|---|
| Erwartete Jahresrendite | % | 3–10 | 0,5 | 7 |
| Startjahr der Fondsinvestition | Jahr | 2000–2025 | 1 | 2020 |

### GKV-Strukturreform (Expertenstufe)
| PKV abschaffen | an/aus | — | — | aus |
|---|---|---|---|---|
| Kapitalerträge KV-pflichtig | an/aus | — | — | aus |
| KV-Beitragsbemessungsgrenze abschaffen | an/aus | — | — | aus |
| Anzahl Krankenkassen | Kassen | 20–95 | 5 | 95 |
| Prävention-Investitionen | Mrd. € | 0–10 | 0,5 | 0 |

### Vordefinierte Parametersätze
Es existieren komplette, benennbare Alternativsätze zum Status quo:
synthetische Einkommensteuer, Kirchhof-Flat-Tax (25 %), radikale Umverteilung,
vereinfachtes System, nordisches Modell, Koalitionsvertrag-Variante und ein
BGE-Szenario (1.200 €/Monat, Spitzensatz 60 %, MwSt 22 %, Bürgergeld ersetzt).

---

## 4. Datenbasis

### Haushaltsstruktur
12 Einkommensgruppen: D1 bis D9 (je 4,1 Mio. Haushalte) plus die Aufspaltung
des obersten Dezils in D10a (P90–95, 2,05 Mio.), D10b (P95–99, 1,64 Mio.) und
D10c (Top 1 %, 0,41 Mio.). Je Gruppe hinterlegt: Bruttojahreseinkommen des
Haushalts (14.000 € in D1 bis 220.000 € in D10b und darüber in D10c),
Kapitaleinkommensanteil (1 % in D1 bis 18 % und mehr oben), Konsumquote
(1,00 in D1 fallend auf 0,52 und darunter), Nettovermögen (1.000 € bis mehrere
Mio. €) und Haushaltszahl. Datenbasis: SOEP v40, Destatis Mikrozensus 2024,
DINA-DE, DIW Vermögensbericht 2024.

### Makroökonomische Ausgangsgrößen 2025
| Größe | Wert |
|---|---|
| Nominales BIP | 4.470 Mrd. € |
| Schuldenquote (Maastricht) | 63,5 % BIP |
| Schuldenstand | 2.838 Mrd. € |
| Unternehmensgewinne vor Steuern | 400 Mrd. € |
| CO₂-bepreiste Emissionen | 327 Mt/Jahr |
| Erbschaftsmasse pro Jahr | 400 Mrd. € |
| Bodenwert Deutschland | 5.000 Mrd. € |
| Steuerpflichtiges Vermögen über 2 Mio. € | 3.500 Mrd. € |
| Sozialversicherungspflichtige Lohnsumme | 1.750 Mrd. € |
| Effektivzins auf den Schuldenbestand | 2,0 % |
| Nominales BIP-Wachstum | 2,5 % p. a. |

Zins und Wachstum sind **eine einzige Modellannahme für alle Rechenwege** —
Haushaltsrechnung und Schuldenfortschreibung müssen zwingend denselben Zinssatz
verwenden.

### Steuer- und Beitragsaufkommen Status quo (Mrd. €)
Lohnsteuer 255 · veranlagte ESt und KapESt 90 · Mehrwertsteuer 303 ·
Körperschaftsteuer 45 · Gewerbesteuer 75 · Soli/Abgeltung 12 · Energiesteuer 37 ·
CO₂ 18 · Tabak 15 · Grundsteuer 16 · Erbschaftsteuer 8 · Kfz 10 · sonstige 35 ·
Rentenbeiträge 310 · Krankenversicherungsbeiträge 290 · Arbeitslosen-/Pflege 105.

### Staatsausgaben Status quo (Mrd. €)
Sozial 850 · Gesundheit 320 · Bildung 180 · Verteidigung 90 · Infrastruktur 120 ·
Verwaltung 140 · Zinsen 54 (Gesamtstaat) · Sonstiges 140 · Gegenposten
nichtsteuerliche Einnahmen −144. Der Status-quo-Saldo ist so kalibriert, dass er
dem VGR-Finanzierungssaldo entspricht (−118,8 Mrd. €, −2,7 % BIP).

### Demografiepfad 2025–2045
Jahresweise interpoliert: Rentenlast-Faktor von 1,000 (2025) über 1,140 (2033)
auf 1,270 (2045); Altersquotient (65+ / 20–64) von 0,350 auf 0,492.
Quelle: Destatis 14. koordinierte Bevölkerungsvorausberechnung.

### Verhaltenselastizitäten
| Reaktion | Wert | Quelle |
|---|---|---|
| Arbeitsangebot (intensive margin) | 0,20 | Saez/Chetty/Gruber |
| Arbeitsangebot Top 1 % | 0,40 | Piketty/Saez/Stantcheva 2014 |
| Steuervermeidung Top 1 % ab GS > 45 % | 0,50 | Kleven/Schultz 2014 |
| Wegzug Top 1 % ab GS > 60 % | 0,10 | Brülhart et al. 2019 |
| Kapitalangebot | 0,50 | Kleven/Schultz |
| Konsum auf MwSt | −0,35 | Lewbel/Pendakur 2009 |
| Emissionen auf CO₂-Preis | −0,30 | EWI/DIW BEHG-Evaluation 2023 |
| Investitionen auf Unternehmensteuer | −0,40 | Gechert/Heimberger 2022 |
| Schattenwirtschaft | 0,25 | Schneider 2023 |

### Verwaltungskostenquoten (Anteil am jeweiligen Aufkommen)
Einkommensteuer 2,5 % · Kapitaleinkünfte 6 % · Mehrwertsteuer 1,0 % ·
Körperschaftsteuer 4 % · Gewerbesteuer 5 % · CO₂ 2 % · Erbschaft 8 % ·
Grundsteuer 2 % · Vermögensteuer 5 % · Kleinverbrauchsteuern 20 % ·
Sozialversicherung 1,5 % · Transferverwaltung 5 % · BGE-Verwaltung 0,8 %.

---

## 5. Rechenlogik einer Periode

### 5.1 Einkommensteuertarif
Deutscher Formeltarif nach § 32a EStG als Integral einer stückweise linearen
Grenzsteuerkurve über fünf Zonen. Die Zonenbreiten (5.347 € / 51.037 € /
209.345 € im Status quo) werden proportional zur eingestellten Spitzensatz­
grenze skaliert, sodass beliebige Tarifreformen abbildbar bleiben. Der Tarif
ist an allen Zonengrenzen sprungfrei. Bei Status-quo-Parametern reproduziert er
die amtliche Formel mit unter 1 % Abweichung.

Umrechnung Haushalt → Steuerpflichtiger: zu versteuerndes Einkommen =
79 % des Haushaltsbruttos (Werbungskosten, Vorsorgeaufwendungen, Sonderausgaben);
Splitting-Faktor 1,6 Tarifeinheiten je Haushalt. Damit trifft das ESt-Aufkommen
im Status quo die amtliche Größenordnung von rund 350 Mrd. € inklusive
Kapitalerträgen.

### 5.2 Arbeitsangebotsreaktion je Dezil
Für jede Einkommensgruppe wird die Änderung des Nettolohns nach Grenzsteuersatz
gegenüber dem Status quo bestimmt und mit der Arbeitsangebotselastizität
multipliziert. Der resultierende Faktor wird auf [0,55; 1,25] begrenzt. Für das
oberste Prozent kommen Steuervermeidung (ab Grenzsteuersatz 45 %) und Wegzug
(ab 60 %) als zusätzliche, multiplikative Minderung hinzu, begrenzt auf
mindestens 40 % der Ausgangsbasis. Bei aktivem Grundeinkommen wirkt zusätzlich
ein dezilabhängiger Substitutionseffekt (D1 −15 %, D2 −12 %, fallend bis 0 %
ab D10a), skaliert mit der BGE-Höhe relativ zu 1.200 €.

### 5.3 Aufkommen je Steuerart
- **Einkommensteuer:** je Dezil getrennt auf Arbeits- und Kapitaleinkommen;
  bei synthetischer Besteuerung gemeinsam im Tarif, sonst Kapital zum
  Abgeltungsatz.
- **Körperschaft- und Gewerbesteuer:** auf eine Gewinnbasis, die mit dem
  Investitionsfaktor reagiert (Referenz: kombinierte Belastung 30 %).
  Investitionsfaktor begrenzt auf [0,7; 1,2].
- **Mehrwertsteuer:** je Dezil aus dem Konsum des Nettoeinkommens nach ESt und
  Sozialabgaben; Aufteilung 70 % Regelsatz / 30 % ermäßigter Satz mit je
  eigener Konsumreaktion. Korrekturen: Basisfaktor 1,68 (die Dezil-Konsumbasis
  erfasst nur rund 60 % der tatsächlichen MwSt-Basis) und VAT-Gap-Faktor 0,963.
- **CO₂:** Emissionen reagieren preiselastisch, begrenzt auf 40–110 % der
  Basis; Aufkommen = Emissionen × Preis; bei aktivem Klimageld werden 70 % pro
  Kopf zurückverteilt.
- **Erbschaftsteuer:** effektiver Satz abhängig vom Betriebsvermögen-Privileg
  (Faktor 0,3 bzw. 0,9); obere 60 % der Erbmasse voll, untere 40 % zum
  halbierten, auf 15 % gedeckelten Satz; darauf die steuerpflichtige Quote 45 %
  nach persönlichen Freibeträgen.
- **Bodenwert- und Vermögensteuer:** Satz auf die jeweilige Bemessungsbasis.
- **Zucman-Mindeststeuer:** Basis 2.870 Mrd. € (Top 1 % Nettovermögen),
  Vermeidungsabschlag bis 15 % bei 2 % Satz.
- **Sozialbeiträge:** Beitragssatz auf die sozialversicherungspflichtige
  Lohnsumme; eine Anhebung der Beitragsbemessungsgrenze über 90.000 € erweitert
  die Basis um 12 % je 90.000 € Erhöhung. Bürgerversicherung: Faktor 1,15 auf
  die Krankenversicherungsbasis. Zuschläge für KV-Pflicht auf Kapitalerträge
  und für den Wegfall der KV-Bemessungsgrenze, skaliert mit dem Beitragssatz.
- **Kleine Verbrauchsteuern:** Summe aus Energie, Tabak, Kfz, Sonstige und
  Soli/Abgeltung, ein-/abschaltbar.

### 5.4 Ausgabenseite
Basisausgaben plus: Bürgergeld (5,5 Mio. Bedarfsgemeinschaften × Regelsatz),
Kindergeld (17 Mio. Kinder × Satz), ggf. negative Einkommensteuer (30 Mrd. €),
BGE-Bruttokosten (70 Mio. Erwachsene × Höhe × 12), Verwaltungskosten,
dynamische Zinslast (Effektivzins × aktueller Schuldenstand), Kopplung der
Sozialversicherungsausgaben an die Beitragssätze (Umlagesystem: RV 390 Mrd.,
KV 290 Mrd., ALV/Pflege 90 Mrd. skalieren proportional — *seit 24.09.2026
entfernt: die Ausgaben folgen dem Rentenniveau, siehe PRUEFUNG-2.md I.1*), demografischer
Aufschlag auf die Rentenausgaben (390 Mrd. × Rentenfaktor − 1) sowie der
öffentliche Investitionsimpuls. Bei aktivem BGE wird die Renteneinsparung aus
Ziel-Rentenniveaus und Aufstockungsbedarf berechnet.

### 5.5 Verteilungsrechnung je Dezil
Für jede der 12 Gruppen wird das verfügbare Einkommen vollständig aufgebaut:
Brutto − Einkommensteuer − Sozialabgaben (nur auf Arbeitseinkommen, getrennte
Bemessungsgrenzen für RV/ALV und KV/Pflege) − Mehrwertsteuer auf den Konsum −
CO₂-Last (einkommensanteilig von 4,0 % in D1 bis 1,0 % in D10c) + Klimageld
(pro Kopf gleich) + Transfers (Bürgergeld nach Bezugsquote 60 %/25 %/8 %/2 %
in D1–D4, Kindergeld nach Kinderzahl je Dezil, BGE für 1,71 Erwachsene je
Haushalt). Verglichen wird immer gegen ein identisch gerechnetes
Status-quo-Nettoeinkommen, damit unveränderte Parameter exakt Null-Deltas
ergeben.

---

## 6. Kennzahlen, die je Periode ausgewiesen werden müssen

### Haushalt und Fiskus
| Kennzahl | Einheit |
|---|---|
| Gesamteinnahmen | Mrd. € |
| Aufkommen je Steuerart (13 Positionen einzeln) | Mrd. € |
| Gesamtausgaben | Mrd. € |
| Haushaltssaldo | Mrd. € |
| Haushaltssaldo | % BIP |
| Einhaltung der Schuldenbremse (Saldo ≥ −0,35 % BIP) | ja/nein |
| Zinsaufwand der Periode | Mrd. € |
| Verwaltungskosten des Steuersystems | Mrd. € |
| Anzahl aktiver Steuerarten | Anzahl |
| Dynamisches Scoring: verhaltensbedingte Aufkommensabweichung, getrennt nach Körperschaftsteuer- und Einkommensteuereffekt sowie in Summe | Mrd. € |

### Verteilung
| Kennzahl | Einheit |
|---|---|
| Nettoeinkommensänderung gegenüber Status quo für alle 12 Dezile | € pro Haushalt und Jahr |
| Absolutes verfügbares Einkommen je Dezil | € |
| Gesamtabgabenquote je Dezil | % des Bruttoeinkommens |
| Gini-Koeffizient (haushaltsgewichtete Lorenzkurve) | 0–1 |
| Palma-Verhältnis (Einkommensanteil Top 10 % / untere 40 %) | Verhältnis |
| Gewichtetes Medianeinkommen | € |
| Armutsrisikogrenze (60 % des Medians) | € |
| Armutsrisikoquote | % |
| Marginale effektive Abgabenquote je Dezil (Grenzsteuersatz + Grenzsozialabgaben + Transferentzug, gedeckelt bei 99 %) | % |

### Verhalten und Effizienz
| Kennzahl | Einheit |
|---|---|
| Arbeitsangebotsindex (Status quo = 100) | Index |
| Konsumindex | Index |
| Investitionsindex | Index |
| CO₂-Index | Index |
| Wohlfahrtsverlust (Harberger-Dreiecke, je Dezil summiert) | Mrd. € |

### Klima
| Kennzahl | Einheit |
|---|---|
| Jahresemissionen im bepreisten Bereich | Mt CO₂ |
| Kumulierte Emissionen seit 2025 | Mt CO₂ |
| Verbleibendes deutsches 1,5-°C-Budget (Startwert 6.600 Mt) | Mt CO₂ |
| Anteil des verbrauchten Budgets | % |

### Tragfähigkeit (abgeleitete Fiskalindikatoren)
| Kennzahl | Formel | Einheit |
|---|---|---|
| Schuldenquote | Schuldenstand / BIP | % BIP |
| Primärsaldo | Gesamtsaldo + Zinslast | Prozentpunkte BIP |
| Zins minus Wachstum (r − g) | 2,0 % − 2,5 % | Prozentpunkte |
| Domar-Zielprimärsaldo | (r − g) × Schuldenquote | Prozentpunkte BIP |
| S2-Tragfähigkeitslücke | Primärsaldo − Zielprimärsaldo; > 0 = tragfähig | Prozentpunkte BIP |
| Generationengerechtigkeit-Index | 50 % Schuldenkomponente (60 % = kein Risiko, 150 % = ausgereizt) + 50 % CO₂-Budgetkomponente | 0–1 |
| HANK-Fiskalmultiplikator der Periode | siehe unten | Faktor, Referenz 1,2 |

### Weitere darzustellende Verläufe
- **Einkommensteuer-Tarifkurve:** Grenz- und Durchschnittssteuersatz über dem
  Einkommen, im Vergleich zum Status-quo-Tarif.
- **Laffer-Kurve:** Einkommensteueraufkommen als Funktion des Spitzensteuer­
  satzes über den gesamten zulässigen Bereich, inklusive der Position des
  aktuell eingestellten Satzes.
- **Schuldenquotenpfad 2025–2045** gegen die Maastricht-Grenze von 60 %.
- **Rentenbeitragssatz-Projektion 2025–2045** in zwei Varianten: ohne Reform
  (+0,3 Prozentpunkte pro Jahr Demografiedruck ab 18,6 %) und mit Fondsreform
  (abzüglich der Beitragsentlastung aus dem Kapitalertrag, Untergrenze 12 %).
  Zusätzlich: aufgebauter Kapitalstock in Mrd. €, Jahresertrag in Mrd. €,
  Beitragsentlastung in Prozentpunkten.
- **GKV-Strukturreform-Effekte** einzeln und in Summe in Mrd. €:
  PKV-Abschaffung (11 Mio. Versicherte, Einnahmen minus Mehrausgaben),
  Kassenfusion (12 Mrd. € Verwaltungskosten, 45 % Fixkostendegression),
  Prävention (Kapitalrendite 1,5).

---

## 7. Periodenübergang (Mehrperiodendynamik)

Am Ende jeder Periode wird der Ausgangszustand der nächsten aus fünf Größen
neu berechnet: BIP, Schuldenquote, kumulierte Emissionen, Arbeitsmarkt-
Zustandsindex, Rentenlast-Faktor.

**BIP-Fortschreibung:** Basiswachstum 2,5 % nominal je Jahr, multiplikativ
verknüpft mit
- einem privaten Investitionsbonus (15 % der Abweichung des Investitionsindex),
- einem Arbeitsmarktbonus (10 % der Abweichung des Arbeitsangebotsindex),
- dem Effekt des öffentlichen Investitionsimpulses (Impuls × Jahre ×
  Fiskalmultiplikator, relativ zum BIP),
- dem Klimaschadensfaktor.

**HANK-Fiskalmultiplikator:** Der Basismultiplikator 1,2 wird mit dem
Verhältnis der einkommensgewichteten durchschnittlichen Konsumneigung der
begünstigten Dezile zum Referenzwert 0,45 skaliert. Entlastungen unterer
Dezile (Konsumquote nahe 1) erzeugen dadurch einen deutlich größeren
Wachstumsbeitrag als Entlastungen oberer Dezile.

**Klimaschaden:** Kumulierte Zusatzemissionen werden mit 5·10⁻⁴ °C je Mt in
einen Temperaturanstieg über dem Basiswert von 1,2 °C übersetzt; daraus folgt
ein quadratischer BIP-Schaden mit dem DICE-Parameter 0,00267.

**Schuldenfortschreibung:** jahresweise nach der Lehrbuchform
Schuld(t+1) = Schuld(t) × (1 + Zins) − Primärsaldo. Es muss zwingend der
Primärsaldo eingesetzt werden, nicht der Gesamtsaldo — dieser enthält die
Zinsausgabe bereits, sie würde sonst doppelt anfallen.

**Arbeitsmarkt-Zustandsindex:** Mean Reversion mit einer Anpassungs­
geschwindigkeit, die mit der Periodenlänge skaliert (maximal 0,30), begrenzt
auf [0,70; 1,30].

**Demografie:** Der Rentenlast-Faktor des Startjahres der neuen Periode wird
aus dem Demografiepfad übernommen und erhöht die Sozialausgaben automatisch.

---

## 8. Exogene Schocks

Die Lehrperson kann jeder Periode einen Schock zuweisen. Ein Schock verändert
den Ausgangszustand der Periode, nicht die Politikparameter. Vier Typen in
je zwei bis drei Stärkegraden, jeweils mit Beschreibung und Quelle:

| Typ | Beispiele | Wirkgrößen |
|---|---|---|
| Energie | leichter Anstieg / signifikanter Schock / Lieferstopp | BIP-Malus 0,4–2,8 %, Investitions-Malus 0,8–4,5 %, Schuldenaufschlag bis 4,0 Prozentpunkte |
| Nachfrage | Nachfragerückgang / milde Rezession / schwere Rezession | BIP-Malus 0,6–4,5 %, Schuldenaufschlag bis 8,0 Prozentpunkte, Emissionsrückgang 3–9 % |
| Finanz | Zinsanstieg / regionale Bankenkrise | Zinsaufschlag 0,3–0,6 Prozentpunkte, Schuldenaufschlag 2,0–6,0 Prozentpunkte, BIP-Malus bis 2,0 % |
| Geopolitisch | Handelsfriktionen / eskalierter Handelskrieg | BIP-Malus 0,8–2,2 %, Investitions-Malus 1,2–3,0 %, Schuldenaufschlag bis 3,5 Prozentpunkte |

Darzustellen ist stets, welche Kennzahlen sich allein durch das Ereignis und
nicht durch die eigene Politik verändert haben.

---

## 9. Vordefinierte Zukunftsszenarien

Vier vollständige Parametertrajektorien über alle Perioden, als Vergleichs-
oder Referenzpfade:
1. **Demografie-Baseline:** Status-quo-Politik, steigende Rentenlasten.
2. **Klimatransformation 2045:** CO₂-Preispfad 55 → 80 → 120 → 180 → 250 €/t.
3. **Fiskalische Konsolidierung:** Spitzensatz 47 %, Erbschaftsteuer 28 %,
   CO₂ 65 €/t; Ziel Schuldenquote unter 60 % BIP.
4. **Investitionsschub:** frontgeladene Investitionsimpulse 60/60/30/0/0 Mrd. €.

---

## 10. Zielvorgaben und Herausforderungen

Ein Katalog von Zielvorgaben in drei Schwierigkeitsstufen, jeweils als
prüfbare Schwellenbedingung auf den Ergebniskennzahlen, mit Ist-Wert,
Zielwert und Referenzwert:

- **Einfach (ein Ziel):** Gini unter 0,285 · Defizit unter 50 Mrd. €  ·
  Verwaltungskosten unter 120 Mrd. € · Arbeitsangebotsindex über 101 ·
  Armutsrisiko unter 8 % · CO₂-Index unter 85 · höchstens 12 Steuerarten ·
  Investitionsindex über 101 · Palma unter 1,8 · Wohlfahrtsverlust unter
  50 Mrd. € · Schuldenquotenänderung unter 1 Prozentpunkt.
- **Mittel:** Gini unter 0,270 · ausgeglichener Haushalt · höchstens
  7 Steuerarten · Armutsrisiko unter 5 % · sinkende Schuldenquote · CO₂-Index
  unter 70 · Verwaltungskosten unter 100 Mrd. € · Schuldenbremse eingehalten ·
  Grenzabgabenquote des untersten Dezils unter 70 %.
- **Schwer (Kombinationen):** z. B. Gini unter 0,280 bei Defizit unter
  30 Mrd. €; Arbeitsangebot über 101 bei CO₂-Index unter 80; Armut unter 6 %,
  Investitionen über 101 und Defizit unter 40 Mrd. €; sinkende Schuldenquote,
  CO₂-Index unter 80 und Investitionen über 102.

Zu jeder Kennzahl werden internationale und historische Vergleichswerte
mitgeführt, etwa: Gini Deutschland 0,295, Dänemark 0,281, Schweden 0,273,
USA 0,395; Armutsrisiko Deutschland 14,8 % (EU-SILC 2023), EU-Durchschnitt
16,5 %; Defizit Deutschland 2025 −119 Mrd. € bzw. −2,7 % BIP; Schuldenquote
63,5 % gegen Maastricht-Grenze 60 %; Zahl der Steuerarten in Deutschland rund
40; Verwaltungskosten rund 2 % des Steueraufkommens (OECD-Durchschnitt);
Grenzabgabenquote im untersten Dezil im Status quo rund 99 %.

---

## 11. Automatische Wirkungsanalyse

Nach jeder Berechnung wird die dominante ökonomische Kausalkette rekonstruiert
und als Erklärung ausgegeben. Jede Erklärung nennt ausdrücklich den Mechanismus
und die Quelle. Abgedeckte Themen:

- Schuldenbremse und Verfassungskonformität (Art. 109 GG, −0,35 % BIP)
- Spitzensteuersatz und Arbeitsangebotsreaktion (Elastizität 0,20)
- Grundfreibetrag, Existenzminimum und Breitenwirkung
- Mehrwertsteuer, Konsumreaktion und Regressivität nach Konsumquoten
- Unternehmensteuer und Investitionselastizität
- CO₂-Preis, Emissionsreaktion und Verteilungswirkung des Klimageldes
- Grundeinkommen: Arbeitsangebotseffekt und Ersatz von Sozialtransfers
- HANK-Multiplikator und Grenzkonsumneigung
- Öffentliche Investitionen und Kapitalstock
- Domar-Bedingung und fiskalische Tragfähigkeit
- Wirkung eines exogenen Schocks

Zusätzlich wird eine hypothetische Zustimmungsgröße berechnet — ein
gewichteter Index aus drei Teilgruppen (Arbeitnehmer und Familien 40 %,
Wirtschaft und Mittelstand 25 %, Klima und Generationen 15 %, Basiswert 20 %),
jeder Teilindex begrenzt auf 10–90, der Gesamtwert auf 15–85, mit Abschlag bei
Verletzung der Schuldenbremse und Zuschlag bei Überschuss. Ausgewiesen werden
der Gesamtwert, die Abweichung vom Basiswert 48 und die drei Teilindizes.
Die Zustimmungsgröße ist eine Heuristik, keine Wahlprognose, und muss als
solche gekennzeichnet sein.

---

## 12. Teamvergleich und Debriefing

Am Ende ist über alle Teams hinweg auszuweisen:
- Der vollständige Zeitpfad je Team: Haushaltssaldo, Schuldenquote, Gini,
  Emissionen und BIP je Periode.
- Die erreichten Lernziele je Team mit Istwerten.
- Eine regelbasierte Kurzeinschätzung je Team entlang vier Achsen:
  Haushaltslage (ausgeglichen / knapp im Rahmen / strukturelles Defizit /
  kritisch), Schuldenstand (unter 55 % / unter 65 % / unter 80 % / kritisch),
  Ungleichheit (Gini unter 0,265 / 0,285 / 0,31 / darüber) und Klimaziel
  (über 60 % / 25 % / 0 % des CO₂-Budgets verbleibend / überschritten).
- Ein moderiertes Debriefing in Phasen, beginnend mit der Distanzierung von der
  gespielten Rolle, gefolgt von der Analyse der Zielkonflikte entlang der
  quantifizierten Mechanismen.

---

## 13. Verbindliche Modellregeln

1. **Jede ökonomische Annahme trägt eine Quelle** — Institut, Jahr,
   Publikation — und ist zusammen mit der verwendeten Formel abrufbar.
   Eine Zahl ohne Beleg ist in einem Lehrplanspiel wertlos.
2. **Jede Modellannahme existiert genau einmal.** Zins und Wachstum insbesondere
   müssen in Haushaltsrechnung, Schuldenfortschreibung und Tragfähigkeits­
   analyse denselben Wert haben.
3. **Der Status quo ist der Nullpunkt.** Bei unveränderten Parametern müssen
   alle Deltas exakt null sein und alle Indizes exakt 100 betragen. Die
   Status-quo-Referenz wird mit demselben Modell und denselben Konventionen
   gerechnet wie das Szenario.
4. **Einheiten und Vorzeichen sind zu prüfen.** Prozent, Prozentpunkte,
   Mrd. €, € pro Haushalt und Mt dürfen nicht verwechselt werden; für jede
   Kennzahl ist die Einheit anzugeben.
5. **Für jede zulässige Parameterkombination** müssen alle Kennzahlen endlich
   sein und in ihrem Definitionsbereich liegen.
6. **Die Vorzeichen der Reaktionen müssen der ökonomischen Theorie
   entsprechen** (komparative Statik): höhere Steuersätze senken das
   Arbeitsangebot, höhere CO₂-Preise senken die Emissionen, höhere
   Unternehmensteuern senken die Investitionen, Transfers an untere Dezile
   senken Gini und Armutsrisiko.
7. **Die Berechnung ist deterministisch und ohne Seiteneffekte.** Gleiche
   Eingaben ergeben immer gleiche Ausgaben; der gesamte Spielstand lässt sich
   aus den Parametern aller Perioden reproduzieren.
