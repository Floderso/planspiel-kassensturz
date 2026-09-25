# Rechenmodule — Technische Dokumentation

Die Simulations-Engine besteht aus sechs reinen JavaScript-Modulen unter `js/rechner/`
und einer Datendatei `js/data.js`. Sie läuft vollständig im Browser (→ [ADR 001](adrs/001-engine-client-side.md)).

---

## Übersicht: Abhängigkeiten

```
js/data.js
  ↓ DEZILE, BASIS_AUFKOMMEN, ELAST, STAATSAUSGABEN, PRESETS, ...
  ├─ js/rechner/einkommensteuer.js  (estTarif, grenzsteuersatz)
  │    ↓
  ├─ js/rechner/verteilung.js       (Gini, Palma, Dezil-Delta)
  │    ↓ (beide)
  ├─ js/rechner/berechne.js         (Hauptsimulation: eine Periode)
  │    ↓
  ├─ js/rechner/transition.js       (Multi-Perioden-Übergänge)
  │    ↓
  ├─ js/rechner/abgeleitet.js       (Fiskal- + Klimaindikatoren)
  │    ↓
  └─ js/planspiel.js                (UI-Controller)
```

---

## Daten: `js/data.js`

Enthält alle statischen Konstanten. Keine Berechnung, nur Daten.

| Export | Typ | Beschreibung |
|--------|-----|---|
| `DEZILE` | Array[12] | Haushaltsdaten je Einkommensdezil (D1–D10c): Bruttoeinkommen, Kapitalanteil, Konsumquote, Vermögen, Anzahl Haushalte. Basis: SOEP v40, Destatis Mikrozensus 2024. |
| `BASIS_AUFKOMMEN` | Objekt | Steuereinnahmen 2025 in Mrd. € (Lohnsteuer, MwSt, KSt, SV-Beiträge, …). Quelle: BMF, Destatis. |
| `STAATSAUSGABEN` | Objekt | Ausgaben 2025 in Mrd. € nach Kategorie (Sozial, Gesundheit, Bildung, Zinsen, …). |
| `ELAST` | Objekt | Elastizitäten (Arbeitsangebot, MwSt-Konsum, CO₂). |
| `PRESETS` | Objekt | Vordefinierte Parametersätze: `status_quo` (2025-Werte), weitere Szenarien. |
| `KURS_KONFIG_DEFAULT` | Objekt | Standard-Kurskonfiguration: Periodenzahl, Team-Größe, Sandbox-Modus. |
| `SCHOCK_BIBLIOTHEK` | Array | 10 vordefinierte Schockereignisse (Energie, Nachfrage, Finanz, Geopolitisch). |
| `PERIOD_STATE_0` | Objekt | Anfangszustand 2025: Schuldenquote, BIP, CO₂-Kumulat, Zinsen. |
| `DEMOGRAFIE_KURVE` | Array | Jahreswerte 2025–2045: Renten-Faktor, Altersquotient. Quelle: Destatis 14. Bev.-Vorausberechnung. |

---

## `js/rechner/einkommensteuer.js`

**Zweck:** Berechnet die Einkommensteuer nach dem deutschen Formeltarif (§ 32a EStG).

### Exportierte Funktionen

#### `estTarif(einkommen, freibetrag, eingang, spitze, grenze) → Steuer`

Berechnet die Einkommensteuer als Integral der stückweise linearen Grenzsteuerrate
über 5 Zonen. Die Zonengrenzen werden proportional zur `grenze`-Parameter skaliert,
sodass verschiedene Reformszenarien abgebildet werden können.

**Parameter:**
- `einkommen` — Bruttoeinkommen in €
- `freibetrag` — Steuerfreies Existenzminimum (z. B. 12.348 €)
- `eingang` — Eingangssteuersatz in % (z. B. 14)
- `spitze` — Spitzensteuersatz in % (z. B. 45)
- `grenze` — Einkommensgrenze für den Spitzensteuersatz in € (z. B. 277.826)

Bei den gesetzlichen Status-quo-Parametern reproduziert der Tarif die amtliche
Formel des § 32a EStG 2025 mit < 1 % Abweichung (siehe `tests/einkommensteuer.test.js`).

#### `grenzsteuersatz(einkommen, ...) → Rate`

Gibt den marginalen Steuersatz an einem Einkommenspunkt zurück. Wird für
Arbeitsangebots-Elastizitäten in `berechne.js` verwendet.

#### `estHaushalt(brutto, ...)` / `grenzsteuersatzHaushalt(brutto, ...)`

Die DEZILE-Daten sind **Haushalts**-Bruttoeinkommen, der Tarif gilt aber je
Steuerpflichtigem auf das zu versteuernde Einkommen. Die Haushaltsfunktionen
rechnen um: `T_HH = s × T(brutto × q / s)` mit zvE-Quote `q = 0,79`
(Werbungskosten, Vorsorgeaufwendungen, Sonderausgaben; Destatis ESt-Statistik)
und Splitting-Faktor `s = 1,6` Tarifeinheiten je Haushalt (§§ 26, 32a Abs. 5 EStG;
Mikrozensus 2024). Damit liegt das ESt-Aufkommen bei Status-quo-Parametern in der
amtlichen Größenordnung (~350 Mrd. € inkl. Kapitalerträge). Alle Engine-Module
(Aufkommen, Arbeitsangebot, METR, DWL, SQ-Referenz) verwenden durchgängig die
Haushaltsfunktionen.

---

## `js/rechner/verteilung.js`

**Zweck:** Berechnet Ungleichheits- und Verteilungsmaße aus den Dezil-Nettoeinkommen.

### Exportierte Funktionen

| Funktion | Ausgabe | Formel |
|----------|---------|--------|
| `aequivalenzEinkommen(netto, dezile)` | Äquivalenzeinkommen je Dezil in € | Netto / Bedarfsgewicht (`DEZILE[i].gewicht`, neue OECD-Skala) |
| `berechneGini(nettoDezile)` | Gini-Koeffizient [0, 1] | Trapezregel über Lorenz-Kurve, gewichtet nach Haushaltszahl |
| `berechnePalma(nettoDezile)` | Palma-Ratio | Einkommensanteil Top-10 % / Anteil Bottom-40 % |

`berechne()` übergibt Gini und Palma das **Äquivalenzeinkommen**, nicht das
Haushaltsnetto — wie EU-SILC. Ohne Bedarfsgewichtung stehen große Haushalte
oben und kleine unten, und der Gini fiel mit 0,377 zu hoch aus. Mit ihr liegt
der Status quo bei 0,310 (amtlich 0,295), der Palma bei 1,30 (Lehrbuchwert
~1,2). Median und Armutsquote rechnen weiter auf dem Haushaltsnetto.
| `berechneMedianGewichtet(nettoDezile)` | Medianeinkommen in € | Kumulierte Haushaltsgewichte bis 50 % |
| `berechneDezilDelta(params, periodeZustand)` | `{delta[], netto[]}` | Δ je Dezil vs. Status quo |
| `berechneNettoSQ(dezil)` | Nettoeinkommen SQ in € | Brutto − ESt(SQ) − SV(SQ) − MwSt(SQ) + Transfers(SQ) |

---

## `js/rechner/berechne.js`

**Zweck:** Kernberechnung für eine einzelne Periode. Nimmt Politikparameter und
Ausgangszustand entgegen; gibt vollständiges Ergebnisobjekt zurück.

### Signatur

```js
berechne(params, periodeZustand) → ErgebnisObjekt
```

**`params`** (Politikparameter — vom Benutzer einstellbar):

| Schlüssel | Einheit | Beschreibung |
|-----------|---------|---|
| `freibetrag` | € | Einkommensteuer-Grundfreibetrag |
| `eingang` | % | Eingangssteuersatz |
| `spitze` | % | Spitzensteuersatz |
| `mwst` | % | MwSt-Regelsatz |
| `mwst_erm` | % | MwSt-ermäßigter Satz |
| `co2` | €/t | CO₂-Preis |
| `kst` | % | Körperschaftsteuersatz |
| `gewst` | % | Gewerbesteuer-Äquivalent |
| `rv` | % | Rentenbeitragssatz (AN+AG gesamt) |
| `kv` | % | GKV-Beitragssatz |
| `bbg` | € | SV-Beitragsbemessungsgrenze |
| `rentenniveau` | % | Sicherungsniveau vor Steuern, Standard 48 (Haltelinie Rentenpaket 2025). Regler am Tisch im Sozialressort, 40–53 % |
| `invest_impuls` | Mrd. €/a | Öffentlicher Investitionsimpuls |

**`periodeZustand`** (Makro-Zustand — aus vorheriger Periode):

| Schlüssel | Beschreibung |
|-----------|---|
| `schuldenquote` | Schulden / BIP in % |
| `bip` | Nominales BIP in Mrd. € |
| `co2_kumulat` | Kumulierte CO₂-Emissionen ab 2025 in Mt |
| `renten_faktor` | Demografischer Rentenlast-Faktor (aus DEMOGRAFIE_KURVE) |

**Ergebnis-Objekt (Auswahl):**

| Schlüssel | Beschreibung |
|-----------|---|
| `saldo` | Haushaltssaldo in Mrd. € |
| `saldo_bip_pct` | Haushaltssaldo in % BIP |
| `gini` | Gini-Koeffizient |
| `palma` | Palma-Ratio |
| `emissionen` | CO₂-Emissionen in Mt/a |
| `hh_delta` | `{delta[], netto[]}` — Nettoeinkommensänderung je Dezil in € |
| `aufkommen` | Steueraufkommen je Steuerart in Mrd. € |

---

## `js/rechner/transition.js`

**Zweck:** Verbindet mehrere Perioden zu einem Zeitpfad. Berechnet den Makro-Zustand
am Anfang jeder Periode aus dem Ergebnis der vorherigen.

### Exportierte Funktionen

#### `simulierePfad(periodenParams, kursKonfig?) → ErgebnisPfad[]`

Iteriert alle Perioden der Simulation. Gibt ein Array zurück (ein Eintrag je Periode):

```js
{
  periode,      // Index 0…n-1
  label,        // Anzeigetext (z. B. "2025–2029")
  params,       // Politikparameter dieser Periode
  result,       // Ergebnis-Objekt von berechne()
  zustand,      // Makro-Zustand am Ende der Periode
  schock,       // Optional: Schockereignis dieser Periode
}
```

**Übergangsmechanismen zwischen Perioden:**
- **BIP-Wachstum:** 2,5 % nominal p.a. (`BIP_WACHSTUM_NOMINAL_JAHR` in `data.js`)
- **Nominale Fortschreibung:** `berechne()` rechnet in Größen von 2025 und schreibt dann fort:
  Einnahmen mit dem tatsächlichen BIP der Periode (Aufkommenselastizität 1, Tarif als indexiert
  angenommen; eine Rezession senkt die Einnahmen), Ausgaben außer Zinsen mit dem nominalen
  Trend `trend_faktor` (Preise und Löhne; eine Rezession senkt sie nicht). Werte je Haushalt
  bleiben in Preisen von 2025. Bis 24.09.2026 blieben ESt, MwSt, Beiträge und Ausgaben 20 Jahre
  nominal eingefroren (`entwurf/PRUEFUNG-2.md` I.2)
- **Schuldenentwicklung:** `D_{t+1} = D_t − Saldo/BIP` (Domar-Mechanismus)
- **Tarif:** § 32a EStG 2026, Zonenbreiten fest. Jeder Regler wirkt nur auf seine Zone:
  Freibetrag verschiebt den Tarif, Eingangssatz die Progressionszone, Spitzensatz nur ab der
  Grenze, Grenze nur den Beginn der obersten Zone (Zone 4 fest 42 %, gedeckelt auf die Spitze).
  D10c rechnet mit Pareto-Rand (α = 1,5), weil das Durchschnittseinkommen des obersten Prozents
  unter der Grenze liegt (`estHaushalt(…, pareto_alpha)`)
- **Haushalte = Staat:** Kindergeld (17 Mio. Kinder, `KINDER_JE_HH`), Bürgergeld-Regelbedarf
  (`BUERGERGELD_QUOTE`) und CO₂-Last (`CO2_GEWICHT`, Summe = Bruttoaufkommen) kommen aus einer Quelle
  in `data.js`; der Staat bucht die Summe über die Haushalte. Unterkunft und Mehrbedarfe
  (`grundsicherung_fix`, 10,8 Mrd.) fest, ebenfalls bei den Haushalten. KSt/GewSt treffen
  Haushalte je zur Hälfte nach Arbeits- und Kapitaleinkommen, ErbSt/VermSt nach Vermögen,
  Zucman D10c (`kapitalUndVermoegensteuern()`, Quelle `inzidenz`). `tests/buchung.test.js`
- **Emissionen:** Basispfad `emissionsBasis(jahr)` in `data.js` (alle Treibhausgase, 649 Mt 2025,
  −63 % 2030 / −80 % 2040 ggü. 1990 nach UBA-Projektionsbericht 2025). Der nationale CO₂-Preis wirkt
  auf den bepreisten Anteil (327 von 649 Mt). `co2_kumulat` summiert Jahr für Jahr entlang des Pfads;
  Budget `CO2_BUDGET_DE` = 5.380 Mt (deutscher Bevölkerungsanteil am 1,7-°C-Budget, IGCC 2025)
- **Kein Klimaschaden aus deutschen Emissionen:** Bis 24.09.2026 senkte ein DICE-Term das BIP mit einer
  1.100-fach zu hohen Klimasensitivität; ein hoher CO₂-Preis erzeugte so einen nationalen
  Wachstumsgewinn (`entwurf/PRUEFUNG-2.md` I.5)
- **HANK-Multiplikator:** Fiskalmultiplikator gewichtet nach dezil-spezifischen MPCs (Kaplan/Moll/Violante 2018)
- **Demografie:** Renten-Faktor aus `DEMOGRAFIE_KURVE` erhöht die Rentenausgaben automatisch
- **Sozialversicherung:** Beitragssätze wirken nur auf die Einnahmen. Die Rentenzahlungen
  folgen dem Rentenniveau; jedes Dezil trägt einen Rentenanteil (`DEZILE[i].rente_anteil`,
  Näherung, Summe ~362 Mrd. €), und eine Niveauänderung kommt dort in genau der Höhe an,
  die der Staat bucht (`tests/rentenniveau.test.js`). KV, AL und PV bleiben auf Status quo.
  Ein Satz unter Bedarf wird zur Lücke im Gesamtsaldo. Bis 24.09.2026
  skalierten die Ausgaben mit dem Beitragssatz — eine Beitragssenkung verbesserte
  Saldo und alle Dezile zugleich (`entwurf/PRUEFUNG-2.md` I.1, `tests/dominanz.test.js`)

---

## `js/rechner/abgeleitet.js`

**Zweck:** Berechnet fiskalische und klimabezogene Indikatoren aus dem Ergebnis einer Periode.

### Signatur

```js
berechneAbgeleitet(result, zustand) → AbgeleiteteIndikatoren
```

| Indikator | Beschreibung | Quelle |
|-----------|---|---|
| `ps_t` | Primärsaldo (% BIP) = Gesamtsaldo + Zinslast | Blanchard (2019) AEA |
| `ps_star` | Notwendiger Primärüberschuss für Schuld-Stabilisierung | Domar (1944) |
| `r_minus_g` | Zinssatz minus BIP-Wachstum | Bundesbank |
| `s2` | Tragfähigkeitslücke: `ps_t − ps_star` (> 0 = tragfähig) | IMF Fiscal Monitor 2024 |
| `ggi` | Generationengerechtigkeit-Index [0, 1]: 50 % Schulden + 50 % CO₂ | Eigene Konstruktion |
| `co2_budget_rest` | Verbleibendes DE-CO₂-Budget für 1,5°C (Mt) | IPCC AR6, SRU (2022) |
| `mu_hank` | HANK-Fiskalmultiplikator der Periode | Kaplan/Moll/Violante (2018) AER |

---

## `js/rechner/rente.js`

Hilfsfunktionen für Rentenversicherungs-Projektionen. Wird aktuell von `transition.js`
direkt über `DEMOGRAFIE_KURVE` (data.js) abgebildet. Für spätere Erweiterung der
Rentenreform-Steuerung vorgesehen.

---

## Wissenschaftliche Quellen (Auswahl)

| Mechanismus | Primärquelle |
|---|---|
| Einkommensteuer-Tarif | § 32a EStG 2025 |
| Arbeitsangebots-Elastizität | Saez/Chetty/Gruber · ifo Schnelldienst 01/2025 |
| HANK-Multiplikator | Kaplan/Moll/Violante (2018) AER |
| Fiskalmultiplikator Investitionen | Gechert/Heimberger (2022) NIER |
| Domar-Schuldbedingung | Domar (1944) · Blanchard (2019) AEA Presidential Address |
| Emissionspfad, CO₂-Budget | UBA Projektionsbericht 2025 · Forster et al. (2026) IGCC 2025, ESSD |
| Dezil-Datenbasis | SOEP v40 · DINA-DE · DIW Vermögensbericht 2024 |
| CO₂-Emissionsreaktion | EWI/DIW BEHG-Evaluation 2023 · Edenhofer/PIK 2024 |
| Demografie | Destatis 14. Bev.-Vorausberechnung 2021 · DRV Rentenbericht 2024 |
