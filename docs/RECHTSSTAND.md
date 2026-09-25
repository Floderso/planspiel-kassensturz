# Rechtsstand des Modells — Stand 01.2026

**Referenzjahr 2026.** Dieses Blatt sagt, welcher Rechtsstand im Status quo
(`PRESETS.status_quo` in `js/data.js`) steckt, woher jede Zahl kommt und was
das Modell bewusst nicht abbildet. Angelegt am 25.09.2026 nach der zweiten
Fachprüfung (`entwurf/PRUEFUNG-2.md`, III und VI.6).

Die **Aufkommens- und Ausgabendaten** der Kalibrierung sind Ist-Werte
2024/2025 (BMF, Destatis VGR). Rechtsstand 2026 und Datenstand 2024/25 sind
also nicht dasselbe Jahr; die Lücke ist dokumentiert, nicht geschlossen.

## Im Modell, Stand 2026

| Größe | Wert | Rechtsgrundlage / Quelle |
|---|---|---|
| Einkommensteuertarif | Grundfreibetrag 12.348 €; Zonen bis 17.799 / 69.878 / 277.825 €; 14 / 42 / 45 %. Spitzensatz 45 % erreicht im Modell nur der Pareto-Rand von D10c | § 32a Abs. 1 EStG 2026 (Steuerfortentwicklungsgesetz, BGBl. 2024 I Nr. 449) |
| Kindergeld | 259 € je Kind und Monat, rund 17 Mio. Kinder | § 66 EStG, Stand 2026 |
| Bürgergeld / Grundsicherungsgeld | Regelbedarf 563 € (Nullrunde 2026); seit 01.07.2026 Grundsicherungsgeld | § 20 SGB II; Gesetz zur neuen Grundsicherung. Sanktionen nicht abgebildet |
| Rentenversicherung | 18,6 %, BBG 101.400 € (bundeseinheitlich) | § 158 SGB VI; SV-Rechengrößenverordnung 2026 |
| Rentenniveau | 48 % (Haltelinie bis 2031) | § 154 Abs. 3 SGB VI; Rentenpaket 2025 (Bundestag 05.12.2025) |
| Krankenversicherung | 17,5 % (14,6 % + 2,9 % durchschn. Zusatzbeitrag), BBG 69.750 € | § 241, § 242a SGB V; SV-Rechengrößenverordnung 2026 |
| Arbeitslosen- und Pflegeversicherung | 2,6 % + 3,6 % | § 341 SGB III, § 55 SGB XI |
| CO₂-Preis (BEHG) | 55 €/t — Untergrenze des Preiskorridors 55–65 €/t 2026 | § 10 BEHG. ETS 2 startet erst 2028 (nicht eigens abgebildet) |
| Klimageld | nicht eingeführt; CO₂-Einnahmen fließen in den Klima- und Transformationsfonds | KTFG; bis 25.09.2026 fälschlich im Status quo (PRUEFUNG.md B5) |
| Körperschaftsteuer | 15 % (Senkung ab 2028 beschlossen, nicht abgebildet) | § 23 KStG |
| Gewerbesteuer | effektiv 14 % (Messzahl 3,5 % × Hebesatz ~400 %) | § 11 GewStG. Der Regler zeigt die effektive Belastung |
| Mehrwertsteuer | 19 % / 7 % | § 12 UStG |
| Erbschaftsteuer | effektiv nach Modell, Betriebsvermögen begünstigt | ErbStG |
| Emissionspfad | 649 Mt 2025 → −63 % 2030 / −80 % 2040 ggü. 1990 | UBA Projektionsbericht 2025 (Mit-Maßnahmen-Szenario) |
| CO₂-Budget | 5.380 Mt (DE-Anteil am 1,7-°C-Budget) | Forster et al. (2026), IGCC 2025, ESSD |

## Bekannt, aber (noch) nicht im Modell

| Thema | Stand | Warum wichtig |
|---|---|---|
| Schuldenbremse 2025 | Verteidigung über 1 % BIP ausgenommen, Sondervermögen Infrastruktur 500 Mrd., Länder 0,35 % | Die Challenge „≥ −0,35 % BIP (Art. 109 GG)" prüft den Gesamtstaats-Ist-Saldo ohne Konjunkturkomponente und ohne diese Ausnahmen |
| EU-Fiskalregeln | Nettoausgabenpfad | fehlt ganz |
| Verteidigung | NATO-Ziel 3,5 % BIP bis 2035; Modell: fest 90 Mrd. € | größte Haushaltsdynamik des Jahrzehnts |
| Grundsteuerreform | seit 2025 in Kraft, Ländermodelle (BW Bodenwert, BY Fläche, HH Wohnlage) | Regler „Boden" ist eine Bodenwertsteuer, kein Abbild des Ländermix |
| Demografie | Modell: 14. Bevölkerungsvorausberechnung; aktuell ist die 15. (2022); nur die Rente altert | KV, Pflege und Arbeitskräftepotenzial altern nicht mit |
| KSt-Senkung ab 2028 | beschlossen (1 Pp. pro Jahr bis 10 % 2032) | Status quo hält 15 % |
| ETS 2 | Start 2028, dann europäischer Preis | BEHG-Preis gilt im Modell weiter |
| Sanktionen Grundsicherung | seit 01.07.2026 verschärft | kein Verhaltenskanal |

## Wie hier gepflegt wird

Ändert sich ein Wert im Status quo, gehört die Zeile hier mitgeändert — mit
Rechtsgrundlage. Wer eine Zeile aus der zweiten Tabelle ins Modell holt,
verschiebt sie in die erste.
