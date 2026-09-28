# Zweite Fachprüfung: Modellfehler, Aktualität, Quellenarbeit

**Stand 24.09.2026.** Geprüft wurde die Rechenengine auf dem Stand von
`ausbau/verhandlungstisch` (Commit `5c9d3b2`), vor der Gini-Reparatur.
Alle Zahlen sind mit der Engine selbst nachgerechnet.

Die erste Prüfung (`entwurf/PRUEFUNG.md`, 12.09.) bleibt gültig; diese Datei
ergänzt sie. Befunde bleiben unverändert stehen, erledigte werden in der
Statusspalte von Abschnitt VI abgehakt.

> **Bereits erledigt:** B3 (Gini) am 24.09., Commit `4d05baa`. Gini und
> Palma rechnen auf Äquivalenzeinkommen; Status quo Gini 0,303, Palma 1,25.
> Die Zahlen unten (Gini 0,377) zeigen den Stand davor.
>
> **Nachgerechnet und bestätigt am 24.09.:** I.1 (RV 10 % → Saldo −69,9, alle
> zwölf Dezile gewinnen; KV 10 % → −103,0, ebenso), I.2 (ESt 370,6 und MwSt
> 290,3 über alle Perioden fest, Einnahmenquote 36,8 % → 26,5 %), I.4
> Kindergeld (Haushaltsseite 36,5 Mio. Kinder, `berechne.js:247` bucht 17 Mio.).

---

## I · Schwere Modellfehler (neu, nicht in PRUEFUNG.md)

### I.1 Wer die Sozialbeiträge senkt, saniert den Haushalt und macht alle reicher

In `berechne.js:295-299` sind die Sozialausgaben proportional an den
Beitragssatz gekoppelt. Das ist als Umlageprinzip gemeint.

| Politik | Saldo | D1 | D5 | D10c | Gini |
|---|---|---|---|---|---|
| Status quo | −115,9 | 0 | 0 | 0 | 0,377 |
| RV 18,6 → 10 % | −69,9 | +518 € | +1.475 € | +3.667 € | 0,374 |
| RV 18,6 → 22 % | −134,1 | −205 € | −583 € | −1.450 € | 0,378 |

- **Die Richtung ist falsch.** Eine Beitragserhöhung verschlechtert den
  Saldo, weil pro Beitragspunkt 21 Mrd. mehr ausgegeben als 17,5 Mrd.
  eingenommen werden. In der Wirklichkeit folgt der Beitragssatz den Ausgaben
  (§ 158 SGB VI), nicht umgekehrt. Über den Nachhaltigkeitsfaktor wirkt ein
  höherer Satz sogar leicht dämpfend auf die Rentenanpassung.
- **Die Rentenkürzung taucht bei niemandem auf.** Die Haushaltsseite kennt
  keine Rentner. Rund 180 Mrd. weniger Rentenausgaben treffen keinen einzigen
  Haushalt.
- Bei der Krankenversicherung gilt dasselbe: KV 10 % verbessert den Saldo um
  13 Mrd., und niemand verliert Gesundheitsleistungen.

**Didaktische Folge:** Das Sozialressort hat eine dominante Strategie, nämlich
die Beiträge zu senken. Den Demografiedruck kann man über Beiträge überhaupt
nicht finanzieren.

### I.2 Der Staat wächst 20 Jahre lang nicht mit

Einkommensteuer (370,6), Mehrwertsteuer (290,3), Sozialbeiträge und alle
Ausgaben bleiben über alle fünf Perioden nominal auf dem Stand von 2025. Das
BIP wächst dagegen von 4.470 auf 6.380 Mrd. Nur die Körperschaftsteuer
skaliert mit dem BIP.

- Die Einnahmenquote schmilzt dadurch von rund 37 % auf rund 26 % des BIP.
  Die Aufkommenselastizität liegt im Modell bei null statt bei etwa 1.
- Es gibt weder kalte Progression noch Tarifindexierung.
- Der Schuldenpfad entsteht deshalb aus einer Mischung von nominal
  eingefrorenen Strömen und wachsendem Nenner. Wie belastbar die 84,9 % im Jahr
  2041 sind, lässt sich nicht beurteilen.

### I.3 Die Makroökonomik ist asymmetrisch zugunsten schuldenfinanzierter Investitionen

| Pfad 2025–2044 | BIP 2041 | Schuldenquote 2041 |
|---|---|---|
| Status quo | 6.380 | 84,9 % |
| Investitionsschub (600 Mrd. über 12 Jahre) | 7.333 (+15 %) | 81,2 % |
| Sparkurs (Bürgergeld 400 €, Kindergeld 200 €, MwSt 22 %) | 6.380 (±0) | 69,5 % |

- **Der Multiplikator wird als dauerhafter Niveaueffekt gebucht und
  kumuliert.** Die Formel `1 + I·n·μ/BIP` in `transition.js:99` behandelt
  Nachfrage als bleibenden Kapitalstock, ohne Abschreibung. Seriöse Schätzungen
  für das Sondervermögen Infrastruktur liegen etwa eine Größenordnung darunter.
  Der langfristige Effekt öffentlicher Investitionen läuft über die Elastizität
  des öffentlichen Kapitals (Bom/Ligthart 2014: etwa 0,08–0,12), nicht über
  μ = 1,2 × n.
- **Konsolidierung kostet kein Wachstum.** Steuer- und Transferänderungen
  haben keinen Nachfrageeffekt. Das widerspricht der Literatur seit
  Blanchard/Leigh (2013).
- **Es gibt keine automatischen Stabilisatoren.** Eine Rezession senkt das
  BIP, aber nicht die Steuereinnahmen.
- Der „HANK-Multiplikator" verwendet die durchschnittliche Konsumquote als
  marginale Konsumneigung (Befund C4 der alten Prüfung, offen). Er macht
  außerdem den Investitionsmultiplikator von der Verteilung von
  Steueränderungen abhängig. Mit Kaplan/Moll/Violante hat das außer dem Namen
  nichts zu tun.

### I.4 Haushaltsseite und Staatsseite rechnen mit verschiedenen Welten

| Größe | Was die Haushalte erhalten oder tragen | Was der Staat bucht |
|---|---|---|
| Kinder (Kindergeld) | 36,5 Mio. | 17 Mio. |
| Bürgergeld | 26,3 Mrd. | 37,2 Mrd. |
| CO₂-Last bei 55 €/t | 60,8 Mrd. | 18,0 Mrd. Aufkommen |

- Beim Kindergeld kommt bei den Haushalten mehr als das Doppelte dessen an,
  was der Staat ausgibt. Umverteilung über Kindergeld erscheint dadurch zu
  stark.
- Die CO₂-Belastung der Haushalte ist mehr als dreimal so hoch wie das
  Aufkommen. Für D10c ergeben sich 7.000 € im Jahr, was rund 127 t CO₂ je
  Haushalt entspräche. Die Regressivität der CO₂-Bepreisung wird massiv
  überzeichnet, und das Klimageld kann sie rechnerisch nie ausgleichen.

### I.5 Der Klimakanal erzeugt einen nationalen Wachstumsgewinn, den es nicht gibt

Ein dauerhafter CO₂-Preis von 250 €/t bringt im Modell +2,9 % BIP bis 2041.
Grund ist der weiterhin offene Befund A2 (Klimasensitivität um Faktor 1.100 zu
hoch). Hinzu kommt ein konzeptioneller Fehler: Deutsche Emissionen erwärmen im
Modell Deutschland, und Deutschland trägt allein die Schäden.

Dazu kommen veraltete oder falsch zugeordnete Klimaparameter:

- **Schadensparameter:** d₂ = 0,00267 entspricht DICE-2013R, zitiert wird aber
  „Nordhaus 2023". DICE-2023 (Barrage/Nordhaus 2024, PNAS) verwendet 0,003467.
- **Erwärmung heute:** `T_BASELINE = 1,2 °C` ist veraltet. Die vom Menschen
  verursachte Erwärmung lag 2024 bei rund 1,36 °C (IGCC).
- **CO₂-Budget:** `CO2_BUDGET_DE = 6.600 Mt` ist für 1,5 °C nicht mehr
  haltbar. Das globale Restbudget lag Anfang 2025 bei nur noch rund 130 Gt,
  gut drei Jahre heutiger Emissionen (IGCC 2025).
- **Kein Basispfad:** Die Emissionen bleiben im Status quo 20 Jahre konstant
  bei 327 Mt. Das Klimaschutzgesetz (−65 % bis 2030, Neutralität 2045) und die
  sinkende ETS-Obergrenze fehlen ganz.

---

## II · Aus der ersten Prüfung weiterhin offen

- **B1/B2, Spitzensteuersatz** (✔ erledigt 25.09., siehe PRUEFUNG.md G6)**:** Wer den Regler „Spitzensteuersatz" auf 55 %
  stellt, hebt den 42-%-Satz auf 51 % an. D5 zahlt 318 € mehr. Die
  Reichensteuer bringt real etwa 5–8 Mrd., das Modell zeigt 28 Mrd.
  Mehreinnahmen.
- **B3, Gini:** ~~Das Modell liefert 0,377 … das Feld `gewicht` wird nirgends
  benutzt.~~ **Erledigt 24.09.** (siehe oben).
- **B5, Klimageld:** Das Klimageld steckt weiterhin im Status quo, obwohl es
  nie eingeführt wurde.
- **C3, Ausgleichsposten** (Verwaltung und Verbrauchsteuer-Erhebungskosten ✔ erledigt 25.09.; D9/D10a-Vermögen, Abgeltung/Soli und `capital_supply`/`evasion` aus IV ebenso)**:** Der Posten beträgt nun −144 Mrd. Auch
  `berechne.js:304` ersetzt die gesamten Verwaltungsausgaben (140 Mrd.) durch
  errechnete Erhebungskosten von 59 Mrd. Davon entfallen 22 Mrd. auf „kleine
  Verbrauchsteuern", weil für sie eine Erhebungskostenquote von 20 % angesetzt
  ist. Das ist für die Energiesteuer etwa zehnfach zu hoch und begünstigt den
  Kirchhof-Pfad.
- **Veraltete Doku:** `ENGINE.md` und der Kopf von `transition.js` nennen noch
  1,5 % nominales Wachstum.

---

## III · Aktualität: Stand September 2026

| Thema | Im Projekt | Tatsächlich |
|---|---|---|
| Generationenkapital | „Rentenpaket II 2024: 12 Mrd./Jahr beschlossen" | Nie beschlossen, mit der Ampel gescheitert. Stattdessen Rentenpaket 2025 (Bundestag 05.12.2025): Haltelinie 48 % bis 2031, Mütterrente, Aktivrente |
| Bürgergeld | Regelsatz-Regler; im Tooltip „5,5 Mio. Bedarfsgemeinschaften" | Seit 01.07.2026 Grundsicherungsgeld mit verschärften Sanktionen. 5,5 Mio. sind Personen, keine Bedarfsgemeinschaften. Kosten der Unterkunft fehlen |
| Schuldenbremse | Challenge: Gesamtstaats-Ist-Saldo ≥ −0,35 %, „Art. 109 GG" | Grundgesetzänderung März 2025: Verteidigung über 1 % des BIP ausgenommen, Sondervermögen 500 Mrd., Länder 0,35 %. Es gibt keine Konjunkturkomponente, und die EU-Fiskalregeln (Nettoausgabenpfad) fehlen |
| Verteidigung | fest 90 Mrd. | Das NATO-Ziel von 3,5 % des BIP bis 2035 ist die größte Haushaltsdynamik dieses Jahrzehnts und kommt im Modell nicht vor |
| Beitragsbemessungsgrenze RV | 90.000 € (Tooltip: „90.600 € West 2025") | 2025: 96.600 €, 2026: 101.400 € |
| KV-Beitrag / KV-BBG | 16,3 % / 66.150 € | 2026: 17,5 % (14,6 % + 2,9 % Zusatzbeitrag) / 69.750 € |
| Kindergeld | „ab 2025: 259 €" | 2025: 255 €, 2026: 259 € |
| CO₂-Preis | 55 €/t, BEHG | 2026/27 Preiskorridor 55–65 €/t; ETS 2 startet erst 2028 |
| Demografie | „14. Bevölkerungsvorausberechnung 2021" | Die 14. erschien 2019, aktuell ist die 15. (2022). Nur die Rente altert im Modell; Krankenversicherung, Pflege und das schrumpfende Arbeitskräftepotenzial fehlen |
| Grundsteuer | „Länder prüfen eigene Modelle" | Seit 2025 in Kraft (Baden-Württemberg Bodenwert, Bayern Fläche, Hamburg Wohnlage …) |
| Gewerbesteuer | Regler „Gewerbesteuer-Messzahl" = 14 % | Die Messzahl beträgt 3,5 %; 14 % sind die effektive Belastung |

---

## IV · Quellenarbeit: Die Belege stimmen nicht immer mit der Behauptung überein

Die Regel „jede Zahl braucht eine Quelle" wird formal eingehalten, aber ein
Verweis ist noch kein Beleg:

- **DIW Wochenbericht 4/2026** (Bach/Sinclair) behandelt die
  Erbschaftsteuer. Zitiert wird er für die synthetische Einkommensteuer und
  für die KV-Beitragsbemessungsgrenze.
- **Brülhart et al.** ist eine Studie zur Schweizer Vermögensteuer, erschienen
  in AEJ: Economic Policy 2022. Zitiert wird sie als JPubEc 2019 für Wegzug bei
  einem Grenzsteuersatz über 60 %. Ausgerechnet ihr Kernbefund fehlt dort, wo
  er zählt: 1 Prozentpunkt weniger Steuer führt zu +43 % deklariertem
  Vermögen. Die Vermögensteuer rechnet im Modell dagegen linear ohne
  Ausweichreaktion.
- **Zucman:** Vorgeschlagen ist eine Mindeststeuer auf Milliardäre mit
  Anrechnung der Einkommensteuer. Das Modell erhebt stattdessen eine
  Pauschalsteuer auf alle Top-1-%-Haushalte (2.870 Mrd.
  Bemessungsgrundlage), ohne Anrechnung und zusätzlich zur Vermögensteuer.
- **Piketty/Saez/Stantcheva (2014)** finden nur eine kleine reale
  Angebotsreaktion der Spitzeneinkommen. Das Modell verwendet sie für eine
  hohe Elastizität an der extensiven Marge.
- **„S2-Lücke":** Das S2 der EU-Kommission schließt die Alterungskosten über
  einen unendlichen Horizont ein. Berechnet wird hier nur die
  Primärsaldo-Lücke.
- **Bourguignon-Elastizität:** Sie wurde für absolute Armut in
  Entwicklungsländern geschätzt und wird hier auf eine relative Armutsquote
  übertragen. Die Challenges „Armut unter 5 %" und „unter 8 %" liegen unter
  jedem Wert, den ein reales Land erreicht.
- **Kleinere Fehler:** Das Durchschnittsvermögen von D9 (620.000 €) liegt über
  dem von D10a (450.000 €). Abgeltungsteuer und Soli stecken sowohl in der
  Einkommensteuer als auch in den „kleinen Verbrauchsteuern". `capital_supply`
  und `evasion` stehen mit Quelle da, werden aber nicht verwendet.

---

## V · Was trägt

- Der Einkommensteuertarif ist praktisch exakt.
- Die Belegkultur ist außergewöhnlich. Nur ihretwegen ist diese Prüfung
  überhaupt möglich.
- Die Zinsdoppelzählung und die Primärsaldo-Einheit sind sauber behoben.
- Die Dimensionstests sind die richtige Idee.
- Status-quo-Saldo, Schuldenstand 2025 (63,5 %, Bundesbank) und Defizit
  (−2,7 %) treffen die Wirklichkeit.
- Der Zielkonflikt zwischen Haushalt, Verteilung und Armut wird in der Richtung
  korrekt gezeigt.

---

## VI · Reihenfolge der Reparatur

| # | Was | Befunde | Status |
|---|---|---|---|
| 1 | **Sozialversicherung entkoppeln.** Ausgaben über das Leistungsniveau steuern, Renten als Haushaltseinkommen. Sonst bleibt die dominante Strategie bestehen | I.1 | ✔ **erledigt** 24.09. Stufe 1: Ausgaben folgen dem Rentenniveau (48 %), KV/AL/PV fest, `tests/dominanz.test.js`. Stufe 2: Rentenanteil je Dezil, Niveauänderung kommt bei den Haushalten an (Σ Haushalte = Staatsbuchung, `tests/rentenniveau.test.js`), Regler am Tisch 40–53 %. **Offen:** Rentenanteile sind eine Näherung (Tabelle nach Einkommensdezil fehlt); Steuer/KV auf die Rentenänderung, Nachhaltigkeitsfaktor und die Beitragsbasis der Rentner (Renten tragen im Modell noch RV-/AL-Beiträge) nicht abgebildet |
| 2 | **Nominale Fortschreibung.** Einnahmen und Ausgaben mit dem nominalen BIP, Aufkommenselastizität etwa 1 | I.2 | ✔ **erledigt** 24.09.: Einnahmen mit dem BIP der Periode (Elastizität 1, Tarif indexiert), Ausgaben mit dem nominalen Trend, Haushaltswerte in Preisen von 2025; Einnahmenquote bleibt bei 36,8 %, Rezession wirkt als automatischer Stabilisator. Schuldenquote 2041 im Status quo 84,9 → 98,5 %; davon rund 1,5 Pp. Primärdefizit aus dem Klimaschaden (A2), der jetzt voll auf den Haushalt durchschlägt — **Punkt 5 wird dringlicher**. Doku 1,5 % (II) korrigiert |
| 3 | **Multiplikator symmetrisch und als Stromgröße.** Auch für Steuern und Transfers; Investitionen über einen öffentlichen Kapitalstock mit Abschreibung | I.3, C4 | ✔ **erledigt** 25.09.: Nachfragelücke je Periode aus Haushaltseinkommen × MPC je Dezil (0,65 → 0,15, statt Konsumquote) × 0,6/0,48 und Investitionen × 1,0, symmetrisch, nicht fortgeschrieben; öffentlicher Kapitalstock mit 4 % Abschreibung und Elastizität 0,08 auf 1.600 Mrd. Investitionsschub 600 Mrd./12 J.: BIP 2041 +2,0 % statt +15 %; Sparkurs −0,5 % BIP in der Periode. Nachtrag 25.09.: private Investitionen und Arbeitsangebot wirken jetzt als Niveau (Kapitalanteil 0,35, Anpassung 7 % p. a.; Arbeit 0,65 sofort) statt je Periode zu kumulieren — KSt 30 %: BIP 2041 −1,4 % statt −3,6 %, Grenzwert ~−2 % |
| 4 | **Haushalts- und Staatsseite abgleichen** (Kinder, CO₂-Last, Bürgergeld), mit Test „Σ Haushalte = Staatsbuchung" | I.4 | ✔ **erledigt** 25.09.: eine Quelle je Größe in `data.js`, der Staat bucht die Summe über die Haushalte. Kindergeld 17 Mio. Kinder (+100 € wirkt jetzt 20,4 Mrd. auf beiden Seiten), CO₂-Last = Bruttoaufkommen (D10c 2.072 € statt 7.000 €), Bürgergeld-Regelbedarf 26,3 Mrd. über die Haushalte, Unterkunft/Mehrbedarfe 10,8 Mrd. fest und ebenfalls bei den Haushalten. N1: KSt/GewSt je hälftig auf Arbeits- und Kapitaleinkommen (Fuest/Peichl/Siegloch 2018), ErbSt/VermSt nach Vermögen, Zucman D10c. `tests/buchung.test.js`. Gini-Status-quo 0,303 → 0,310; Feedback urteilt seitdem relativ zum Status quo. MwSt und SV-Beiträge nachgezogen (25.09.): Haushalte tragen die ganze Änderung gegenüber dem Status quo — bei der MwSt auf der vollen Bemessungsgrundlage, bei den Beiträgen auch den Arbeitgeberanteil (Melguizo/González-Páramo 2013); Abweichung jetzt ±9 % statt Faktor 1,5–2,2. **Offen:** der Rest aus Konsumreaktion und Lohnsumme gegen Dezillöhne |
| 5 | **Klima:** nationalen Schaden entfernen, Emissionsbasispfad nach KSG, CO₂-Budget nach IGCC 2025 | I.5, A2, C2 | ✔ **erledigt** 24.09.: Klimaschaden aus deutschen Emissionen entfernt (CO₂ 250 €/t: BIP-Effekt 0 statt +2,9 %); Emissionen = alle THG (649 Mt 2025) entlang Projektionsbericht 2025 (−63 % 2030, −80 % 2040), Preis wirkt auf den bepreisten Anteil; Budget 5.380 Mt (DE-Anteil am 1,7-°C-Budget, IGCC 2025), im Status quo um 2037 aufgebraucht. Schuldenquote 2041: 91,7 %. **Offen:** Budget in CO₂, Verbrauch in CO₂e (vereinfacht); Pfad 2040–2045 fortgeschrieben; ETS-2-Start 2028 nicht eigens abgebildet |
| 6 | **Rechtsstand-Blatt „Stand 01.2026"**: Rentenpaket 2025, Grundsicherung, Schuldenbremse 2025 mit Sondervermögen, Verteidigung, BBG, ETS 2 | III, B5, B6 | **Teil 1 erledigt** 25.09.: `docs/RECHTSSTAND.md`; Tarif § 32a 2026, KV 17,5 % (mit GKV-Ausgaben +21 Mrd.), BBG 101.400 / 69.750 €, Klimageld aus dem Status quo (CO₂-Einnahmen in den Klimafonds, schrumpft mit dem Emissionspfad), Tooltips (Rentenpaket 2025 statt II, Grundsicherung, BBG), Regler „Gewerbesteuer, effektiv". Dabei gefunden: Grundsteuer ohne Inzidenz (jetzt nach Vermögen) und ein Fehler im Dominanztest (verglich gegen 2025 statt gegen den Status-quo-Pfad). **Teil 2 erledigt** 25.09.: Verteidigung nach NATO-Plan (3,5 % ab 2029), Sondervermögen Infrastruktur 500 Mrd. (mit Kapitalstock), Schuldenbremse 2025 strukturell mit Ausnahmen und Konjunkturkomponente (Tisch zeigt die Lücke daraus). Schuldenquote 2041 im Status quo 108 %. Nachtrag: KSt-Senkung 2028–2032 und RV-Beitragssatz nach § 158 SGB VI (RVB 2025) als gesetzliche Pfade zusätzlich zu den Reglern — Schuldenquote 2041 im Status quo 102,5 %. **Offen:** EU-Fiskalregeln, 15. Bevölkerungsvorausberechnung (nur die Rente altert), Schuldenbremse getrennt nach Bund und Ländern |
| 7 | **Alle Zitate im Wortlaut gegen die Originalquelle prüfen.** Einige Belege wirken, als seien sie nach Plausibilität statt aus der Quelle gesetzt | IV | **Die benannten Fälle erledigt** 25.09.: DIW 4/2026 aus synthetischer ESt und KV-BBG entfernt; Brülhart et al. richtig zitiert (AEJ: EP 2022, Vermögensteuer) und ihr Befund als Ausweichreaktion der Vermögensteuer eingebaut (halbiert); Wegzug-Elastizität „Beleg ausstehend“; Zucman als Mindeststeuer auf Milliardäre mit Anrechnung (2 %: 8,7 statt 48,8 Mrd.); PSS 2014 als Einkommenselastizität inkl. Verlagerung beschrieben; S2 heißt Primärsaldo-Lücke; Bourguignon als übertragene Näherung markiert; Armutsziele 11–13 % statt 5–8 %. **Offen:** systematische Prüfung aller übrigen Zitate im Wortlaut — Primärquellen aus dieser Umgebung nicht erreichbar |
| – | Gini auf Äquivalenzeinkommen | B3 | ✔ **erledigt** 24.09. |

**Der dringendste fehlende Test:** „Keine Politik darf zugleich den Saldo, das
Einkommen aller Dezile und den Gini verbessern." Heute schlägt er bei einer
RV-Senkung sofort an.

> **Umgesetzt 24.09.** als `tests/dominanz.test.js`, gerechnet über fünf
> Perioden: Keine Stellgröße und kein Paar von Stellgrößen am Tisch darf den
> Saldo und alle Dezile verbessern, ohne dass Gini, Emissionen oder BIP
> schlechter werden. Vor der Entkopplung rot für RV und KV, danach grün.
>
> **Dabei gefunden (N1):** Körperschaft-, Gewerbe- und Erbschaftsteuer treffen
> keinen Haushalt. KSt 40 % verbessert den Saldo um 76 Mrd., und in der
> Periode verliert niemand etwas, auch das BIP nicht; die Kosten erscheinen
> erst über den Pfad (Investitionen → BIP 2041: 6.154 statt 6.380 bei KSt
> 30 %). Die Inzidenz dieser Steuern gehört zu Punkt 4.

---

## Quellen der Prüfung

- Bundesbank: Schuldenquote 2025 steigt auf 63,5 %
- Bundestag: Rentenpaket beschlossen (05.12.2025)
- BMAS: Rentenpaket 2025 beschlossen
- Bundestag: Umgestaltung des Bürgergelds zur Grundsicherung beschlossen
- Bundesregierung: Neue Grundsicherung
- Bundesregierung: Beitragsbemessungsgrenzen 2026
- Durchschnittlicher Zusatzbeitrag 2026: 2,9 %
- IHK Schwaben: ETS 2 verschoben auf 2028
- Stiftung Umweltenergierecht: Update CO₂-Bepreisung
- IGCC 2025: drei Jahre Restbudget für 1,5 °C
- Barrage/Nordhaus 2024: DICE-2023, PNAS
- NBER: Results from the DICE-2023 Model
- Brülhart et al. 2022, AEJ: Economic Policy
- DIW Wochenbericht 4/2026
