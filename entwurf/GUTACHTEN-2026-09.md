# Gutachten: Wissenschaftliche Tragfähigkeit und Aktualität

**Stand 24.09.2026.** Geprüft wurden die Rechenengine (`js/rechner/`,
`js/data.js`), die Tooltips und Quellenangaben in `data.js` sowie die
Stellgrößen der Spielfläche (`js/spielkern.js`). Stand des Codes: Commit
`5c9d3b2` auf `ausbau/verhandlungstisch`.

Dieses Gutachten setzt `PRUEFUNG.md` (12.09.2026) fort. Dort behobene Befunde
werden nicht wiederholt, dort offene nur kurz genannt. Alles Neue steht in
Abschnitt A.

---

## Wie geprüft wurde

1. **Nachgerechnet statt nachgelesen.** Jede Zahl in Abschnitt A stammt aus
   einem Lauf von `berechne()` bzw. `simulierePfad()` mit den genannten
   Parametern. Wie man sie reproduziert, steht in Abschnitt G.
2. **Haushaltsseite gegen Staatsseite.** Was die Dezile erhalten oder tragen,
   wurde aufsummiert und mit dem verglichen, was der Haushalt bucht.
3. **Rechtsstand gegen Gesetzeslage September 2026.** Die Tooltips und Presets
   wurden mit dem aktuellen Recht abgeglichen: Rentenpaket 2025,
   Grundsicherung, Schuldenbremse, Rechengrößen der Sozialversicherung und
   ETS 2.
4. **Stichproben der Belege.** Bei einem Teil der Zitate wurde geprüft, ob
   die Quelle existiert und ob sie sagt, wofür sie zitiert wird.

**Nicht geprüft:** die Oberfläche, die API und `makro-planspiel/`. Die Belege
wurden nicht vollständig geprüft, nur als Stichprobe.

---

## Gesamturteil

**Das Modell rechnet sauber, aber es rechnet die falsche Ökonomie.** Einzelne
Bausteine sind handwerklich gut, allen voran der Einkommensteuertarif. Das
Zusammenspiel der Module erzeugt aber Strategien, die immer gewinnen und
ökonomisch unsinnig sind. Die Faktenbasis liegt ein bis anderthalb Jahre
hinter der Gesetzeslage.

Die Testsuite ist grün (99 Tests, 98 bestanden, 1 todo). **Keiner der
folgenden Befunde fällt einem Test auf.**

Für den Lehreinsatz heißt das: Wer das Spiel geschickt spielt, lernt falsche
Lektionen. Das Sozialressort hat eine dominante Strategie,
schuldenfinanzierte Investitionen tragen sich scheinbar selbst, und
Klimapolitik bringt Deutschland binnen 20 Jahren einen Wachstumsgewinn, den
es nicht gibt.

---

## A · Schwere Modellfehler (neu)

### A1 · Sozialbeitrag senken saniert den Haushalt und macht alle reicher

`berechne.js:295–299` koppelt die Ausgaben der Sozialversicherung
proportional an den Beitragssatz:

```js
const sv_ausgaben_delta =
  SV_AUSG.rv   * (params.rv   / 18.6 - 1) +   // 390 Mrd. je 18,6 Punkte
  SV_AUSG.kv   * (params.kv   / 16.3 - 1) + …
```

Gemeint ist das Umlageprinzip. Die Wirkung:

| Politik | Saldo (Mrd. €) | Δ D1 | Δ D5 | Δ D10c | Gini |
|---|---|---|---|---|---|
| Status quo | −115,9 | 0 | 0 | 0 | 0,377 |
| **RV 18,6 → 10 %** | **−69,9** | **+518 €** | **+1.475 €** | **+3.667 €** | **0,374** |
| RV 18,6 → 22 % | −134,1 | −205 € | −583 € | −1.450 € | 0,378 |
| KV 16,3 → 10 % | −103,0 | +379 € | +1.081 € | +1.974 € | 0,373 |
| KV 16,3 → 20 % | −123,4 | −223 € | −635 € | −1.159 € | 0,379 |

Drei Fehler greifen ineinander:

- **Die Richtung ist falsch.** Ein Beitragspunkt RV bringt 17,5 Mrd. ein
  (1.750 × 1 %), aber 21 Mrd. Ausgaben (390 / 18,6). Wer die Beiträge erhöht,
  verschlechtert den Saldo. Tatsächlich folgt der Beitragssatz den Ausgaben
  (§ 158 SGB VI), nicht umgekehrt. Die Ausgaben bestimmt das Rentenniveau.
  Über den Nachhaltigkeits- und Beitragssatzfaktor (§ 68 SGB VI) dämpft ein
  höherer Satz die Rentenanpassung sogar leicht.
- **Die Leistungskürzung trifft niemanden.** `berechneDezilDelta()` kennt
  keine Renten. Rund 180 Mrd. weniger Rentenausgaben bei RV 10 % tauchen in
  keinem Haushalt auf.
- **Der Kommentar zitiert die falsche Norm.** § 213 SGB VI regelt den
  Bundeszuschuss, nicht die Ausgabenhöhe.

**Didaktische Folge:** Beiträge senken ist immer richtig, und den
Demografiedruck (`demografie_aufschlag`) kann man über Beiträge nicht
finanzieren. Das ist die falsche Lektion über die Sozialversicherung.

Nebenbei rechnen drei Stellen mit drei verschiedenen RV-Ausgaben:
`BASIS_MAKRO.rv_ausgaben_sq = 430`, `SV_AUSG.rv = 390` und im Kommentar
„~390“.

### A2 · Der Staat wächst nicht mit

Status quo über fünf Perioden zu je vier Jahren:

| Periode | BIP | ESt | MwSt | Zinsen | Demografie | Saldo | Saldo % BIP | Schuldenquote |
|---|---|---|---|---|---|---|---|---|
| 2025–28 | 4.470 | 370,6 | 290,3 | 56,8 | 0,0 | −118,6 | −2,65 | 63,5 % |
| 2029–32 | 4.937 | 370,6 | 290,3 | 66,5 | 23,4 | −140,2 | −2,84 | 67,4 % |
| 2033–36 | 5.424 | 370,6 | 290,3 | 78,1 | 54,6 | −170,8 | −3,15 | 72,0 % |
| 2037–40 | 5.912 | 370,6 | 290,3 | 92,2 | 78,0 | −196,2 | −3,32 | 78,0 % |
| 2041–44 | 6.380 | 370,6 | 290,3 | 108,4 | 97,5 | −220,2 | −3,45 | 84,9 % |

- ESt, MwSt, SV-Beiträge und sämtliche Ausgaben bleiben **nominal auf dem
  Stand von 2025**. `bip_faktor` wirkt nur auf die Gewinne, also auf KSt und
  GewSt. Die Dezil-Einkommen in `DEZILE` wachsen nie.
- Die Einnahmenquote sinkt dadurch von rund 37 % auf rund 26 % des BIP. Die
  Aufkommenselastizität liegt im Modell bei null statt bei etwa 1,0 (BMF,
  Steuerschätzung). Es gibt weder kalte Progression noch Tarifindexierung.
- Der Schuldenpfad entsteht aus nominal eingefrorenen Strömen, einem
  wachsenden Nenner und nominal wachsenden Zinsen. Welche Aussagekraft die
  84,9 % im Jahr 2041 haben, lässt sich nicht bestimmen.

### A3 · Asymmetrische Makroökonomik zugunsten schuldenfinanzierter Investitionen

| Pfad 2025–2044 | BIP 2041 | Schuldenquote 2041 |
|---|---|---|
| Status quo | 6.380 | 84,9 % |
| Szenario „Investitionsschub“ (60/60/30/0/0 Mrd. je Jahr) | **7.333 (+15 %)** | **81,2 %** |
| Sparkurs (Bürgergeld 400 €, Kindergeld 200 €, MwSt 22 %) | **6.380 (±0)** | 69,5 % |

- **Der Multiplikator wird als bleibender Niveaueffekt gebucht und
  kumuliert.** `transition.js:99` rechnet `1 + I · n · μ / BIP`: Vier Jahre
  zu 60 Mrd. mit μ = 1,2 erhöhen das BIP-Niveau dauerhaft um 6,4 %. Danach
  wächst dieser Zuschlag mit, ohne Abschreibung. Ein Multiplikator beschreibt
  aber eine Stromgröße, er wirkt, solange die Ausgabe fließt. Langfristige
  Effekte öffentlicher Investitionen laufen über den öffentlichen Kapitalstock
  (Bom/Ligthart 2014: Output-Elastizität etwa 0,08–0,12). Gängige Schätzungen
  für das Sondervermögen Infrastruktur liegen etwa eine Größenordnung unter
  den +15 %.
- **Konsolidierung kostet kein Wachstum.** Steuer- und Transferänderungen
  haben keinen Nachfrageeffekt. `hh_delta` wirkt nur als Gewicht auf den
  Investitionsmultiplikator. Das widerspricht der Literatur seit
  Blanchard/Leigh (2013).
- **Es gibt keine automatischen Stabilisatoren.** Ein Rezessionsschock senkt
  das BIP, aber nicht die Steuereinnahmen, weil diese nicht vom BIP abhängen
  (A2).
- **Der „HANK-Multiplikator“ trägt seinen Namen zu Unrecht.** Er verwendet die
  durchschnittliche Konsumquote als marginale Konsumneigung (PRUEFUNG C4) und
  macht den *Investitions*multiplikator von der Verteilung von
  *Steuer*änderungen abhängig. Mit Kaplan/Moll/Violante (2018) hat das außer
  dem Zitat nichts gemeinsam.

### A4 · Haushalts- und Staatsseite rechnen mit verschiedenen Welten

| Größe | Summe über die Dezile | Staatsbuchung |
|---|---|---|
| Kinder mit Kindergeld | **36,5 Mio.** (`kg_quote` × Haushalte) | 17 Mio. |
| Bürgergeld bei 563 € | 26,3 Mrd. (`bg_quote`) | 37,2 Mrd. (5,5 Mio. × 563 × 12) |
| CO₂-Last bei 55 €/t | **60,8 Mrd.** (`co2_share` × Brutto) | 18,0 Mrd. Aufkommen |

- **Kindergeld:** Bei den Haushalten kommt mehr als das Doppelte dessen an,
  was der Staat ausgibt. Kindergeld +100 € kostet 21 Mrd. und verteilt 44 Mrd.
  Umverteilung über Kindergeld erscheint dadurch zu wirksam. Die
  Günstigerprüfung mit dem Kinderfreibetrag fehlt.
- **CO₂:** Die Belastung der Haushalte ist 3,4-mal so hoch wie das Aufkommen.
  D10c trägt 7.000 € im Jahr, was etwa 127 t CO₂ je Haushalt entspräche. Die
  Regressivität der CO₂-Bepreisung wird massiv überzeichnet, und das
  Klimageld kann sie rechnerisch nie ausgleichen. Der Regler zeigt einen
  Zielkonflikt, der in dieser Stärke nicht existiert. Die Anteile von 4 % bis
  1 % entsprechen eher Energiekostenanteilen als der CO₂-Preis-Last.
- **Bürgergeld:** 5,5 Mio. sind *Leistungsberechtigte*, keine
  Bedarfsgemeinschaften, wie der Tooltip behauptet. Alle werden mit dem
  Regelsatz für Alleinstehende gerechnet, die Kosten der Unterkunft fehlen.
- **Klimageld:** Laut Tooltip wird es „pro Kopf“ ausgezahlt, gerechnet wird
  es pro Haushalt.

### A5 · Der Klimakanal erzeugt einen nationalen Wachstumsgewinn

Ein dauerhafter CO₂-Preis von 250 €/t ergibt **BIP 2041: 6.564 statt 6.380
(+2,9 %)**.

- PRUEFUNG **A2 ist weiter offen**: `KLIMA_SENS_PER_MT = 5e-4` ist um
  Faktor ~1.100 zu hoch. Hinzu kommt ein Konstruktionsfehler: Deutsche
  Emissionen erwärmen im Modell die Erde, und Deutschland trägt allein die
  Schäden. Ein nationales Modell kann höchstens globale Temperaturpfade
  exogen übernehmen.
- **Der Schadensparameter ist falsch zugeordnet.** `DICE_D2 = 0,00267`
  entspricht DICE-2013R, zitiert wird aber „Nordhaus 2023“. DICE-2023
  (Barrage/Nordhaus 2024, PNAS) verwendet 0,003467.
- **Die Ausgangserwärmung ist veraltet.** `T_BASELINE = 1,2 °C` gilt nicht
  mehr: Die vom Menschen verursachte Erwärmung lag 2024 bei rund 1,36 °C
  (IGCC 2025).
- **Das CO₂-Budget ist überholt.** `CO2_BUDGET_DE = 6.600 Mt` gilt nicht mehr
  als 1,5-°C-Budget. Das globale Restbudget betrug Anfang 2025 rund 130 Gt,
  gut drei Jahre heutiger Emissionen (Forster et al., IGCC 2025). Die
  6.600 Mt entsprechen eher dem 1,75-°C-Budget des SRU aus 2022.
- **Es gibt keinen Emissions-Basispfad.** Ohne Politik bleiben die
  Emissionen 20 Jahre konstant bei 327 Mt. Die Ziele des
  Klimaschutzgesetzes (−65 % bis 2030, −88 % bis 2040, Neutralität 2045) und
  die sinkende ETS-Obergrenze fehlen.
- **Die Formel ist keine Elastizität.** `1 + ε · (p − 55) / 100` ist eine
  Semi-Elastizität je 100 €. Bei einer Preisverdopplung ergibt sie −16,5 %
  statt der mit ε = −0,30 behaupteten −30 %. Kurz- und langfristige Reaktion
  werden nicht unterschieden.

---

## B · Aus `PRUEFUNG.md` weiterhin offen, nachgerechnet

| Befund | Stand heute |
|---|---|
| **B1/B2** Tarifzonen gekoppelt | Spitzensteuersatz 55 % hebt den 42-%-Satz auf **51 %**. D5 zahlt 318 € mehr, der Saldo verbessert sich um 28 Mrd. Eine reine Reichensteuererhöhung brächte real etwa 5–8 Mrd. |
| **B3** Gini ohne Äquivalenzgewicht | Status quo **0,377**. `feedback.js:29–31` und die Challenges verlangen weniger als 0,285. Das Feld `gewicht` wird weiter nirgends gelesen. |
| **B5** Klimageld im Status quo | unverändert. Auch `berechneNettoSQ()` rechnet es ein. |
| **C3** Ausgleichsposten | −144 Mrd. Zusätzlich ersetzt `berechne.js:304` die gesamten Verwaltungsausgaben (140 Mrd.) durch errechnete Erhebungskosten von 58,8 Mrd. Davon entfallen 21,8 Mrd. auf „kleine Verbrauchsteuern“, weil `ADMIN_QUOTE.klein = 0,20` gilt. Für die Energiesteuer ist das etwa zehnfach zu hoch und begünstigt den Kirchhof-Pfad. |
| **C4** Konsumquote statt MPC | unverändert, siehe A3 |
| **C5** dekorative Elastizitäten | `capital_supply` und `evasion` weiter unbenutzt |
| Doku | `docs/ENGINE.md` und der Kopf von `transition.js` nennen noch 1,5 % nominales Wachstum |

---

## C · Rechtsstand: veraltet (Stand September 2026)

| Thema | Im Projekt | Tatsächlich |
|---|---|---|
| Generationenkapital | „Rentenpaket II 2024: 12 Mrd./Jahr **beschlossen**“ (Tooltips `rv`, `kapitalquote`, `startjahr`; `rente.js`) | **Nie beschlossen**, mit dem Ende der Ampel gescheitert. Stattdessen **Rentenpaket 2025** (Bundestag 05.12.2025): Haltelinie 48 % bis 2031, Mütterrente, Grundlage der Aktivrente. |
| Bürgergeld | Regler „Bürgergeld“, Tooltip mit 563 € | Seit **01.07.2026 Grundsicherungsgeld** (Bundestag 05.03.2026, Bundesrat 27.03.2026) mit verschärften Mitwirkungspflichten |
| Schuldenbremse | Challenge `schuldenbremse`: Gesamtstaats-Ist-Saldo ≥ −0,35 %, „Art. 109 GG“ | Grundgesetzänderung März 2025: Verteidigung über 1 % des BIP ausgenommen, **Sondervermögen Infrastruktur 500 Mrd.**, Länder 0,35 %. Die Regel gilt strukturell, also mit Konjunkturkomponente. Die EU-Fiskalregeln (Nettoausgabenpfad seit 2024) fehlen. |
| Verteidigung | fest 90 Mrd. | Das NATO-Ziel von 3,5 % des BIP ist die größte Haushaltsdynamik des Jahrzehnts und fehlt im Modell. |
| Beitragsbemessungsgrenze RV | Preset 90.000 €, Tooltip „90.600 € West 2025“ | 2025: 96.600 € (bundeseinheitlich), **2026: 101.400 €** |
| KV-Beitrag / BBG | 16,3 %, Zusatzbeitrag „~1,7 %“ / 66.150 € | **2026: 17,5 %** (14,6 + 2,9) / **69.750 €** |
| Kindergeld | Tooltip „ab 2025: 259 €“ | 2025: 255 €, 2026: 259 € |
| CO₂-Preis | 55 €/t | 2026 und 2027 Preiskorridor 55–65 €/t, **ETS 2 startet erst 2028** |
| Demografie | „Destatis 14. Bev.-Vorausberechnung 2021“ | Die 14. erschien 2019, aktuell ist die 15. (Dezember 2022). Nur die Rente altert im Modell; GKV, Pflege und das schrumpfende Erwerbspersonenpotenzial fehlen. |
| Grundsteuer | „Einige Bundesländer prüfen eigene Modelle“ | Seit 01.01.2025 in Kraft: Baden-Württemberg (Bodenwert), Bayern (Fläche), Hamburg (Wohnlage), Hessen, Niedersachsen |
| Gewerbesteuer | Regler „Gewerbesteuer-**Messzahl**“ mit 14 % | Die Messzahl beträgt 3,5 %; 14 % sind die effektive Belastung (3,5 % × Hebesatz ~400 %). |
| Erbschaftsteuer-Ist | `BASIS_AUFKOMMEN.erbschaft = 8` | 2024 rund 13 Mrd. Der Kommentar bei `erb_stpfl_quote` nennt selbst ~12. |

**Empfehlung:** ein Blatt „Rechtsstand 01.2026“ mit einem Stichtag und einer
Quelle je Zahl. Dieselbe Empfehlung stand schon als B6 in `PRUEFUNG.md`.

---

## D · Quellenarbeit: Die Belege stimmen nicht immer mit der Behauptung überein

Die Regel „Jede ökonomische Annahme braucht eine Quelle“ aus `CLAUDE.md` wird
formal eingehalten. Ein Verweis ist aber noch kein Beleg.

| Stelle | Zitiert für | Was die Quelle tatsächlich behandelt |
|---|---|---|
| Tooltips `synthetisch`, `kv_kapital`, `kv_bbg_frei` | DIW Wochenbericht 4/2026 | Bach/Sinclair zur **Erbschaftsteuer**-Reform |
| `ELAST_QUELLEN.d10c_wegzug` | Brülhart et al. (2019) JPubEc: Wegzug bei Grenzsteuersatz über 60 % | Brülhart/Gruber/Krapf/Schmidheiny, **AEJ: Economic Policy 2022**, Schweizer **Vermögen**steuer. Kernbefund: 1 Prozentpunkt weniger Steuer bringt **+43 % deklariertes Vermögen**. |
| Vermögensteuer (`verm_auf`) | — | Rechnet **linear ohne jede Ausweichreaktion**, obwohl der Brülhart-Befund genau dafür einschlägig wäre. |
| `d10c_labor` | Piketty/Saez/Stantcheva (2014) **AER**: hohe extensive Marge | Erschienen in **AEJ: Economic Policy** 6(1). PSS finden eine *kleine* reale Angebotsreaktion der Spitzeneinkommen; der große Effekt ist Verhandlungsmacht. |
| Zucman (`zucman_auf`) | G20-Bericht 2024 | Vorgeschlagen ist eine **Mindeststeuer auf Milliardäre mit Anrechnung der Einkommensteuer**. Gerechnet wird eine Pauschalsteuer auf alle Top-1-%-Haushalte (2.870 Mrd.), ohne Anrechnung und zusätzlich zur Vermögensteuer. |
| `s2` in `abgeleitet.js` | „Blanchard S2-Lücke“, IMF | Das S2 der EU-Kommission schließt die Alterungskosten über einen unendlichen Horizont ein. Hier wird die Primärsaldo-Lücke (Blanchard 1990) berechnet. |
| Armutsrisiko | Bourguignon (2003): Elastizität −1,5 | geschätzt für *absolute* Armut in Entwicklungsländern, übertragen auf eine *relative* Quote |
| `DICE_D2` | Nordhaus 2023 | Wert aus DICE-2013R, siehe A5 |

Weitere Einzelbefunde:

- **Vermögen nicht monoton.** D9 hält im Schnitt 620.000 € Vermögen, D10a
  (P90–95) nur 450.000 €.
- **Doppelt gezählt.** Abgeltungsteuer und Soli stecken sowohl in der
  Einkommensteuer (`est_kap`) als auch in den „kleinen Verbrauchsteuern“
  (`solz_abgelt`).
- **Schuldenstand widersprüchlich.** `STAATSAUSGABEN.zinsen` nennt einen
  Schuldenstand von 2.688 Mrd., `BASIS_MAKRO` und `KPI_BENCH` nennen 2.838.
- **Unerreichbare Challenges.** „Armut unter 8 %“ und „unter 5 %“ (IDs
  `armut_16` und `armut_14`) liegen unter jedem Wert, den ein reales Land
  erreicht.
- **Keine Wirkung auf das Arbeitsangebot.** Die Transferentzugsrate des
  Bürgergelds geht in die METR ein, aber nicht in das Arbeitsangebot. Die im
  Tooltip genannte ifo-Reform (Anrechnung 80 → 60 %) hat keinen Regler.

**Empfehlung:** jedes Zitat einmal gegen die Originalquelle lesen. Einige
Belege wirken, als seien sie nach Plausibilität gesetzt und nicht aus der
Quelle übernommen.

---

## E · Was trägt

- Der Einkommensteuertarif ist praktisch exakt (PRUEFUNG E).
- Die Belegkultur ist außergewöhnlich. Nur ihretwegen ist dieses Gutachten
  überhaupt möglich.
- Die Zinsdoppelzählung und die Primärsaldo-Einheit sind sauber behoben, die
  Dimensionstests sind die richtige Idee.
- Status-quo-Saldo (−118,6 Mrd.), Schuldenquote 2025 (63,5 %, Bundesbank) und
  Defizitquote (−2,7 %) treffen die amtlichen Werte.
- Die Zielkonflikte zwischen Haushalt, Verteilung und Armut sind in der
  Richtung korrekt, mit Ausnahme der Sozialversicherung (A1).

---

## F · Reihenfolge der Reparatur

| # | Was | Behebt | Aufwand |
|---|---|---|---|
| 1 | SV-Ausgaben über das Leistungsniveau steuern, nicht über den Beitragssatz; Renten als Haushaltseinkommen | A1 | mittel, Modellarbeit |
| 2 | Einnahmen, Ausgaben und Dezil-Einkommen mit dem nominalen BIP fortschreiben | A2 | mittel |
| 3 | Multiplikator symmetrisch und als Stromgröße; öffentlicher Kapitalstock mit Abschreibung | A3 | mittel |
| 4 | Abgleichstest „Σ Haushalte = Staatsbuchung“, dann `kg_quote`, `co2_share` und `bg_quote` korrigieren | A4 | klein |
| 5 | Nationalen Klimaschaden entfernen, Emissions-Basispfad nach KSG, Budget und T auf IGCC 2025 | A5, PRUEFUNG A2 | mittel |
| 6 | Rechtsstand-Blatt 01.2026; Tooltips, Presets und Challenges nachziehen | C | Fleißarbeit |
| 7 | Zitate gegen die Originale prüfen; Vermögensteuer mit Ausweichreaktion | D | Fleißarbeit |

**Der wichtigste fehlende Test:**

> Keine Politik darf zugleich den Saldo, das Nettoeinkommen *aller* Dezile und
> den Gini verbessern.

Heute schlägt er bei „RV 18,6 → 10 %“ sofort an. Er gehört zu den
Invarianten in `tests/`, in der Form, die `CLAUDE.md` für Engine-Tests
verlangt.

---

## G · Nachrechnen

Die Zahlen in Abschnitt A entstehen so (Node, von der Projektwurzel aus):

```js
const { berechne }      = await import('./js/rechner/berechne.js');
const { simulierePfad } = await import('./js/rechner/transition.js');
const D  = await import('./js/data.js');
const SQ = D.PRESETS.status_quo;

berechne({ ...SQ, rv: 10 }).saldo;                       // A1: −69,9
simulierePfad(Array.from({ length: 5 }, () => ({ ...SQ })))
  .map(e => e.result.rev.est);                           // A2: fünfmal 370,6
simulierePfad(D.ZUKUNFTS_SZENARIEN
  .find(s => s.id === 'investitionsschub').perioden_params)
  .at(-1).zustand.bip;                                   // A3: 7.333
simulierePfad(Array.from({ length: 5 }, () => ({ ...SQ, co2: 250 })))
  .at(-1).zustand.bip;                                   // A5: 6.564
```

---

## Quellen

- Deutsche Bundesbank (2026): [Deutsche Staatsschulden wachsen 2025 um 144 Mrd. €, Schuldenquote 63,5 %](https://www.bundesbank.de/de/presse/pressemitteilungen/deutsche-staatsschulden-992718)
- Deutscher Bundestag (2025): [Bundestag beschließt das Rentenpaket](https://www.bundestag.de/dokumente/textarchiv/2025/kw49-de-rentenpaket-1128720)
- BMAS (2025): [Rentenpaket 2025 beschlossen](https://www.bmas.de/DE/Service/Presse/Meldungen/2025/rentenpaket-2025-beschlossen.html)
- Deutscher Bundestag (2026): [Umgestaltung des Bürgergelds zur Grundsicherung beschlossen](https://www.bundestag.de/dokumente/textarchiv/2026/kw10-de-grundsicherung-1150460)
- Bundesregierung (2026): [Bürgergeld wird zur neuen Grundsicherung](https://www.bundesregierung.de/breg-de/aktuelles/neue-grundsicherung-2399562)
- Bundesregierung (2025): [Beitragsbemessungsgrenzen 2026](https://www.bundesregierung.de/breg-de/aktuelles/beitragsgemessungsgrenzen-2386514)
- [Durchschnittlicher Zusatzbeitrag 2026: 2,9 %](https://www.lohnsteuer-kompakt.de/steuerwissen/durchschnittlicher-zusatzbeitrag-steigt-2026-auf-29/)
- IHK Schwaben: [Emissionshandel 2 verschoben — Start 2028](https://www.ihk.de/schwaben/produktmarken/energie/aktuelles-zum-thema-energie/verschiebung-des-ets-2-handels-6830228)
- Stiftung Umweltenergierecht (2025): [Update CO₂-Bepreisung](https://stiftung-umweltenergierecht.de/wp-content/uploads/2025/12/Stiftung_Umweltenergierecht_Ehrmann_Update_CO2-Bepreisung_2025-12-05.pdf)
- Forster et al. (2025), Indicators of Global Climate Change: [Three years left of remaining carbon budget for 1.5 °C](https://www.eurekalert.org/news-releases/1087578)
- Barrage/Nordhaus (2024): [Policies, projections, and the social cost of carbon: Results from the DICE-2023 model, PNAS](https://www.pnas.org/doi/abs/10.1073/pnas.2312030121)
- Brülhart/Gruber/Krapf/Schmidheiny (2022): [Behavioral Responses to Wealth Taxes: Evidence from Switzerland, AEJ: Economic Policy 14(4)](https://www.aeaweb.org/articles?id=10.1257%2Fpol.20200258)
- DIW Berlin: [Wochenbericht 4/2026](https://www.diw.de/de/diw_01.c.995993.de/publikationen/wochenberichte/2026_04/heft.html)
- Weitere Literatur, im Text genannt: Blanchard/Leigh (2013) AER P&P · Bom/Ligthart (2014) J. Econ. Surveys · Blanchard (1990) OECD WP 79 · Kaplan/Moll/Violante (2018) AER · Piketty/Saez/Stantcheva (2014) AEJ: Policy
