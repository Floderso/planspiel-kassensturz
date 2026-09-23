# Fachprüfung: Formeln, Zahlen, didaktische Tragfähigkeit

**Stand 12.09.2026.** Geprüft wurde die Rechenengine (`js/rechner/`,
`js/data.js`, `js/feedback.js`), nicht die Oberfläche.

> **Nachtrag vom selben Tag: sechs Befunde sind repariert.**
> Erledigt sind **A1, A3, A4, A5, B4** und **F1** — siehe die Statusspalte
> in Abschnitt G. Die Befunde bleiben hier unverändert stehen, damit
> nachvollziehbar ist, was geändert wurde und warum.
>
> Sichtbarste Wirkung: Die Schuldenquote steigt im Status quo über fünf
> Perioden auf **84,9 % statt 130,4 %**, der Palma-Index liegt bei **1,72
> statt 6,87**, und die S2-Lücke wird in der Oberfläche nicht mehr als
> „−258,27 %" angezeigt. Acht neue Dimensionstests
> (`tests/dimensionen.test.js`) sichern die Korrekturen ab.
>
> **Offen bleiben** die didaktisch wichtigen Punkte B1, B2 (Regler mit
> falschem Etikett), B3 (Gini-Skala gegen Feedback-Schwellen), A2
> (Klimasensitivität) sowie C1 bis C5.

---

## Wie ich geprüft habe

Vier Zugänge, alle nachvollziehbar:

1. **Tariffunktion gegen das Gesetz gerechnet** — § 32a EStG unabhängig
   nachgebaut und über den ganzen Einkommensbereich verglichen.
2. **Kalibrierung gegen die eigenen Ist-Werte** — jede Steuerart im
   Status quo gegen `BASIS_AUFKOMMEN`.
3. **Kennzahlen gegen ihre Definition** — Gini, Palma, Domar, S2, DICE
   gegen die Formel, die in der Quellenangabe steht.
4. **Verhaltensprobe** — vier gegensätzliche Politiken durchgespielt und
   angesehen, was das Spiel dazu sagt.

**Was ich nicht geprüft habe:** die zitierte Literatur selbst (ob
Piketty/Saez/Stantcheva 2014 tatsächlich ε = 0,4 stützt, konnte ich nicht
nachschlagen), `rente.js` nur überschlägig, `medienspiegel.js` und
`explainer.js` gar nicht.

---

## Gesamturteil in drei Sätzen

**Die Substanz ist da, die Zahlen sind es teilweise nicht.** Der
Einkommensteuertarif ist exakt, der Gesamthaushalt trifft die amtliche
Größenordnung, und die Wirkungsrichtungen stimmen fast durchgehend — ein
harter Sparkurs erhöht im Modell Ungleichheit *und* Armut, was
ökonomisch korrekt und didaktisch wertvoll ist.

Daneben stehen **fünf handfeste Rechenfehler**, darunter zwei
Skalierungsfehler um die Faktoren 100 und 1.100, und eine Reihe von
Stellen, an denen ein Regler etwas anderes tut, als sein Etikett sagt.

Für den Lehreinsatz heißt das: **Als Richtungsindikator taugt das Modell
schon heute. Die absoluten Zahlen und sämtliche darauf aufbauenden
Urteile sind derzeit nicht belastbar.**

---

## A · Handfeste Rechenfehler

### A1 · Die Fiskalindikatoren sind um Faktor 100 verrutscht

`abgeleitet.js` teilt die Zinslast einmal zu oft durch 100. Betroffen
sind Primärsaldo, Domar-Ziel und S2-Lücke — also genau die drei
Kennzahlen, für die das Modul existiert.

| Periode | Schuldenquote | Primärsaldo Modell | korrekt | S2 Modell | korrekt |
|---|---|---|---|---|---|
| 1 | 63,5 % | −2,576 | **−1,005** | −2,583 | **−1,640** |
| 3 | 90,4 % | −3,464 | **−1,227** | −3,473 | **−2,131** |
| 5 | 130,4 % | −4,259 | **−1,032** | −4,272 | **−2,335** |

```js
// abgeleitet.js — D_t steht bereits in Prozent
const zinslast_bip = ZINS_SCHULDEN * D_t / 100;   // 0,025 × 63,5/100 = 0,016
// richtig wäre
const zinslast_bip = ZINS_SCHULDEN * D_t;         // 0,025 × 63,5   = 1,59 Prozentpunkte
```

Die didaktische Folge ist größer als der Zahlendreher: Primärsaldo und
Gesamtsaldo unterscheiden sich im Modell um 0,016 Prozentpunkte. **Der
Unterschied zwischen beiden — der ganze Grund, warum man den
Primärsaldo betrachtet — verschwindet.** Studierende sehen zwei
praktisch identische Zahlen und können nicht lernen, warum die
Unterscheidung zählt.

### A2 · Die Klimasensitivität ist um Faktor 1.100 zu hoch

`transition.js` rechnet mit `KLIMA_SENS_PER_MT = 5e-4` °C je Megatonne.
Der wissenschaftliche Wert (TCRE, IPCC AR6) liegt bei rund
0,45 °C je 1.000 Gt, also 4,5e-7 °C je Mt.

| nach | kumuliert | ΔT im Modell | ΔT realistisch |
|---|---|---|---|
| 4 Jahren | 1.308 Mt | 0,65 °C | 0,0006 °C |
| 20 Jahren | 6.540 Mt | **3,27 °C** | 0,0029 °C |

Im Modell erwärmt Deutschland allein die Erde binnen 20 Jahren um
3,3 °C und landet bei 4,5 °C über vorindustriell.

Das Tückische: **Der BIP-Effekt sieht trotzdem plausibel aus** (−4,9 %
nach 20 Jahren). Das liegt daran, dass die DICE-Schadensfunktion
notorisch flach ist — ein stark überhöhter Temperaturwert trifft auf
eine stark gedämpfte Schadensfunktion, und das Ergebnis wirkt
vernünftig. Zwei Fehler, die sich gegenseitig kaschieren, sind
schlimmer als einer: Man findet sie nicht, indem man aufs Ergebnis
schaut.

### A3 · Der Palma-Index ist nicht der Palma-Index

```js
// verteilung.js
return (top_sum/top_n) / (bot_sum/bot_n);   // Verhältnis der DURCHSCHNITTE
```

Palma (2011) und UNDP definieren: **Einkommensanteil der obersten 10 %
geteilt durch Anteil der untersten 40 %.** Das Verhältnis der
Durchschnitte ist davon das Vierfache.

Das Modell zeigt **6,87**. Der Lehrbuchwert für Deutschland liegt bei
etwa 1,2; 6,87 wäre ungleicher als Südafrika. Wer die Zahl
nachschlägt, findet nichts, was dazu passt.

`tests/verteilung.test.js` zementiert den Fehler: Der Test verlangt,
dass Gleichverteilung den Wert 1 ergibt. Beim echten Palma-Index wäre
das 0,25.

### A4 · Zwei verschiedene Zinssätze — 41 Mrd. € pro Jahr verschwinden

| Ort | Zinssatz | wofür |
|---|---|---|
| `berechne.js` | **1,06 %** | Zinsausgabe im Haushalt |
| `transition.js` | **2,50 %** | Aufzinsung des Schuldenstands |

Die Schulden wachsen also mit 2,5 %, aber nur 1,06 % davon belasten den
Haushalt. Bei 2.688 Mrd. € Schuldenstand sind das **41 Mrd. € jährlich,
die die Schuldenquote erhöhen, ohne im Saldo aufzutauchen**.

Ursache ist `STAATSAUSGABEN.zinsen = 30`, im Kommentar korrekt als
*Bundes*-Zinsausgabe ausgewiesen — aber das Modell ist ein
Gesamtstaatsmodell. Länder, Kommunen und Sozialversicherung fehlen.

### A5 · Zinsen werden in der Schuldenfortschreibung doppelt gezählt

```js
// transition.js
schuld_next = schuld_curr * Math.pow(1 + zins, n) - prevResult.saldo * n;
```

`saldo` enthält bereits die Zinsausgabe. Korrekt wäre entweder
Aufzinsung **plus Primärsaldo** oder kein Aufzinsen **plus
Gesamtsaldo** — nicht beides. In der jetzigen Form fließen Zinsen
zweimal in den Schuldenstand, mit zwei verschiedenen Sätzen.

---

## B · Regler, die etwas anderes tun als ihr Etikett

### B1 · „Reichensteuer-Grenze senken" ist eine Mittelschichtsteuererhöhung

Der Tarif skaliert **alle** Zonenbreiten proportional zur Zone-5-Grenze.
Wer nur diesen einen Regler bewegt, verschiebt den gesamten Tarifverlauf.

Grenze von 277.826 € auf 150.000 €, sonst nichts geändert:

| zvE | Grenzsteuersatz vorher | nachher | Mehrbelastung |
|---|---|---|---|
| 20.000 € | 24,9 % | 27,5 % | +206 € |
| 40.000 € | 31,9 % | **41,1 %** | +1.379 € |
| 60.000 € | 39,0 % | 42,0 % | +2.678 € |

Bei einer Grenze von 80.000 € zahlt ein Haushalt mit 40.000 € zvE den
Spitzensteuersatz von 42 %. **Studierende ziehen an einem Regler, der
„die Reichen" verspricht, und belasten die Mitte.** Wenn das Spiel
Verteilungswirkung lehren soll, lehrt es hier das Gegenteil.

### B2 · „Spitzensteuersatz" hebt auch den 42-%-Satz an

```js
const satz4 = Math.min(spitze, eingang * (3/31) + spitze * (28/31)) / 100;
```

Die Konstruktion trifft im Status quo exakt 42 % — elegant. Aber sie
koppelt Zone 4 fest an den Spitzensatz. Spitzensatz 45 % → 53 %:

| zvE | Grenzsatz vorher | nachher | Mehrbelastung |
|---|---|---|---|
| 60.000 € | 39,0 % | **45,5 %** | +1.989 € |
| 80.000 € | 42,0 % | **49,2 %** | +3.402 € |

Ein Haushalt mit 60.000 € liegt weit unterhalb der Reichensteuergrenze
und dürfte von ihrer Erhöhung gar nicht berührt sein.

### B3 · Die Ungleichheits-Skala passt nicht zu ihren eigenen Schwellen

Das Modell liefert im Status quo **Gini 0,377**. Die amtliche Zahl für
Deutschland liegt bei 0,29 (EU-SILC, äquivalenzgewichtete verfügbare
Einkommen).

Die Ursache steht in `data.js`: Jedes Dezil trägt ein Feld `gewicht`
(1,3 bis 2,0) — das Äquivalenzgewicht. **Es wird nirgends verwendet.**
Der Gini rechnet mit Haushaltseinkommen ohne Bedarfsgewichtung, und
weil große Haushalte oben und kleine unten stehen, fällt er zu hoch aus.

Die Folge trifft das Feedback. `feedback.js` urteilt nach Schwellen
0,265 / 0,285 / 0,310 — alle unterhalb dessen, was das Modell überhaupt
erzeugen kann:

| Politik | Gini | Urteil des Spiels |
|---|---|---|
| Status quo | 0,377 | stark zunehmende Ungleichheit |
| Stark umverteilend | 0,359 | stark zunehmende Ungleichheit |
| Stark entlastend | 0,384 | stark zunehmende Ungleichheit |
| Harter Sparkurs | 0,397 | stark zunehmende Ungleichheit |

**Vier gegensätzliche Politiken, ein Urteil.** Ein Team bekommt gesagt,
es habe die Ungleichheit stark erhöht, bevor es irgendetwas getan hat.

### B4 · Der Generationengerechtigkeits-Index steht von Anfang an am Anschlag

```js
const ggi_schuld = Math.min(1, Math.max(0, D_t / GGI_SCHULD_REF)) * 0.5;  // Ref: 60 %
```

Die Schuldenquote startet bei 63,5 %. Der Teilindex ist damit ab
Periode 1 auf seinem Maximum 0,5 und bleibt dort, während die Quote auf
130 % steigt. **Im gesamten Spielbereich misst er nichts.**

### B5 · Das Status-quo-Preset enthält ein Klimageld, das es nicht gibt

`PRESETS.status_quo` setzt `klimageld: true`. In Deutschland wurde kein
Klimageld eingeführt. Dadurch erscheinen die CO₂-Einnahmen mit 5,4 statt
18 Mrd. €, und der „Ausgangszustand", gegen den alle Teams ihre Politik
vergleichen, ist eine Politik, die nie beschlossen wurde.

### B6 · Kein einheitliches Referenzjahr

| Größe | Wert im Modell | gehört zu |
|---|---|---|
| Tarifzonen (`einkommensteuer.js`) | 12.096 / 17.443 / 68.480 / 277.825 | **2025** |
| Grundfreibetrag (`PRESETS`) | 12.348 € | **2026** |
| Kindergeld | 259 € | **2026** |
| RV-Beitragsbemessungsgrenze | 90.000 € | **2024** (2025: 96.600 €) |
| KV-Beitragsbemessungsgrenze | 66.150 € | **2025** ✔ |
| GKV-Beitragssatz | 16,3 % | **2024** (2025 eher 17,1 %) |
| Kommentar in `verteilung.js` | „freibetrag 12.084" | **2024** |

Für ein Planspiel ist jedes dieser Jahre vertretbar — aber nicht alle
gleichzeitig. Ein Blatt „Referenzjahr 2026, Stand X" mit einer
einzigen Quelle je Zahl würde das lösen.

---

## C · Struktur und Kalibrierung

### C1 · Der Gesamtsaldo stimmt, die Einzelposten nicht

| Steuerart | Modell | hinterlegtes Ist | Abweichung |
|---|---|---|---|
| ESt | 370,6 | 345 | +7,4 % |
| MwSt | 290,3 | 303 | −4,2 % |
| **KSt** | 60,2 | 45 | **+33,9 %** |
| **GewSt** | 56,2 | 75 | **−25,0 %** |
| **Erbschaft** | 11,9 | 8 | **+48,5 %** |
| **Grundsteuer** | 20,0 | 16 | **+25,0 %** |
| RV / KV / AL | 325 / 285 / 108 | 310 / 290 / 105 | +5 / −2 / +3 % |
| **Summe** | **1.534** | **1.515** | **+1,2 %** |

Saldo: **−115,9 Mrd. €** gegen das Kalibrierungsziel −118,8 Mrd. —
sehr gut getroffen.

Aber: KSt und GewSt kommen aus **einer** Gewinngröße (400 Mrd. €) mit
zwei Sätzen. Real haben sie verschiedene Bemessungsgrundlagen, und
Personengesellschaften zahlen Gewerbe-, aber keine Körperschaftsteuer.
Die Fehler (+15 / −19 Mrd.) heben sich in der Summe auf — **jede
einzelne Reglerreaktion ist trotzdem verzerrt.**

Bei der Erbschaftsteuer widerspricht sich `data.js` selbst:
`BASIS_AUFKOMMEN.erbschaft = 8`, während der Kommentar bei
`erb_stpfl_quote` von „kalibriert auf ErbSt-Ist ~12 Mrd." spricht. Das
Modell trifft die 12 — der hinterlegte Ist-Wert ist der veraltete.

### C2 · Eine Emissionszahl, zwei unvereinbare Zwecke

`emissions: 327` ist ausdrücklich so gewählt, dass
327 × 55 € ≈ 18 Mrd. € CO₂-Aufkommen herauskommt — also auf das
*Aufkommen* kalibriert. Dieselbe Zahl speist aber den Verbrauch des
CO₂-Budgets, das sich auf Deutschlands *Gesamtemissionen* (~650 Mt
CO₂e) bezieht. **Das Budget wird im Spiel etwa halb so schnell
verbraucht wie in der Wirklichkeit.**

Zusätzlich nennt die Quellenangabe in `berechne.js` „Basis 500 Mio. t im
Bepreisungsbereich" — der Code rechnet mit 327. Dokumentation und Code
widersprechen sich.

### C3 · Mögliche Doppelzählung bei den Ausgaben

`STAATSAUSGABEN` führt `sozial: 850` und `gesundheit: 320` getrennt.
Der Kommentar in `berechne.js` erklärt aber, die 850 enthielten bereits
„GKV ~290". Dann stünde die GKV zweimal im Haushalt.

Auffallen kann das nicht, weil `sonstige_einnahmen: −120` als
Ausgleichsposten so gesetzt ist, dass der Gesamtsaldo passt. **Ein
Strukturfehler wird von der Saldo-Kalibrierung verdeckt.** Das ist die
gefährlichste Konstruktion im ganzen Datensatz: Sie macht jede
Einzelposition unüberprüfbar.

### C4 · MPC und Konsumquote sind nicht dasselbe

Der HANK-Multiplikator gewichtet mit `DEZILE[i].konsum` — das ist die
*durchschnittliche* Konsumquote (1,00 bis 0,40), verglichen wird sie
mit einem *marginalen* Benchmark (0,45). Dadurch kann der Multiplikator
auf 1,2 × (1,00/0,45) = **2,67** steigen. Die zitierte Quelle
(Gechert/Heimberger) nennt für Deutschland 0,8 bis 1,5.

### C5 · Zwei Elastizitäten sind dekorativ

`ELAST.capital_supply` (0,50, Kleven/Schultz) und `ELAST.evasion`
(0,25, Schneider) werden **nirgends verwendet**. Sie stehen mit
Quellenangabe da und suggerieren eine Modelltiefe, die es nicht gibt.

Gegenprobe für die übrigen: `labor_supply` 0,20 liegt im
Saez/Slemrod/Giertz-Konsens (0,1–0,4) ✔, `co2` −0,30 an der oberen
Kante der kurzfristigen Schätzungen ✔, `investment` −0,40 plausibel ✔,
`consumption` −0,35 wirkt bei +3 MwSt-Punkten als −1 % Konsum — moderat
und vertretbar ✔.

---

## D · Warum die 70 Tests das nicht gefunden haben

Die Testsuite ist gut gebaut, prüft aber systematisch am Problem vorbei:

- **Die Toleranzen sind zu weit.** ±15 % bis ±35 %. Der Saldo-Test
  akzeptiert −1,5 bis −3,5 % BIP — eine Spanne von 90 Mrd. €.
- **Es wird aggregiert getestet.** `KSt + GewSt` gegen 120 Mrd. mit
  ±35 %: +34 % und −25 % heben sich auf, der Test ist grün.
- **Kennzahlen werden gegen sich selbst getestet, nicht gegen die
  Wirklichkeit.** Kein Test vergleicht Gini mit 0,29 oder Palma mit 1,2.
- **Die Skalierungsfehler sind unsichtbar**, weil kein Test die
  Einheiten von Domar/S2 oder die Klimasensitivität prüft.
- **Ein Test zementiert einen Fehler** (Palma bei Gleichverteilung = 1).

Was fehlt, sind **Dimensionstests**: Eine Zinslast in Prozentpunkten
des BIP muss bei 63,5 % Quote und 2,5 % Zins zwischen 1 und 2 liegen.
Solche Tests hätten A1 sofort gefunden.

---

## E · Was ausdrücklich gut ist

Das gehört genauso ins Protokoll:

**Der Einkommensteuertarif ist exakt.** Gegen § 32a EStG über den
gesamten Bereich nachgerechnet: maximale Abweichung 0,12 € auf
200.000 € Einkommen. Die Zonenbreiten (5.347 / 51.037 / 209.345)
stimmen aufs Jahr genau, der Knick bei 23,97 % ist korrekt getroffen,
und die Konstruktion `14 × 3/31 + 45 × 28/31 = 42` ist elegant. Das ist
sauberere Arbeit als in manchem Lehrbuch-Tool.

**Der Gesamthaushalt trifft** — −115,9 gegen −118,8 Mrd. € Ist.

**Das Armutsrisiko trifft** — 15,7 % gegen 14,4–15,5 % Ist.

**Die Kalibrierung des Arbeitsangebots ist sauber**: Bei
Status-quo-Parametern ergibt sich exakt `labor_factor = 1,0000`. Solche
Fixpunkte sind leicht zu verfehlen.

**Die Wirkungsrichtungen stimmen.** Der harte Sparkurs erhöht im Modell
Ungleichheit (0,377 → 0,397) *und* Armut (15,7 % → 17,2 %) *und*
verbessert den Saldo. Genau dieser Zielkonflikt ist das, was
Studierende erleben sollen — und das Modell zeigt ihn richtig.

**Die Belegkultur ist außergewöhnlich.** 25 Quellenangaben mit Formel,
Fundstelle und Anmerkung. Genau deshalb konnte ich überhaupt prüfen:
Die Fehler in A1 bis A3 sind nur deshalb *nachweisbar*, weil daneben
steht, welche Formel gemeint war. Ein Modell ohne diese Disziplin wäre
nicht widerlegbar — nur unklar.

**Die Deadweight-Loss-Berechnung** summiert korrekt über Dezile statt
über den Durchschnittssatz und begründet das mit der Jensen-Ungleichung.
Das ist sorgfältiger, als es sein müsste.

---

## F · Didaktisches Urteil

Die entscheidende Frage ist nicht, ob das Modell exakt ist — kein
Lehrmodell ist das. Sie lautet: **Lernen Studierende hier etwas
Richtiges?**

**Was trägt:** Der Zielkonflikt zwischen Haushalt, Verteilung und Klima
wird echt abgebildet. Man kann den Haushalt nicht sanieren, ohne dass
Armut steigt. Man kann nicht umverteilen, ohne dass der Saldo reagiert.
Das ist die Kernlehre, und sie funktioniert.

**Was nicht trägt — drei Punkte:**

**1. Das Spiel ist vorentschieden.** Im Status quo steigt die
Schuldenquote ohne jedes Zutun von 63,5 % auf 130,4 % in 20 Jahren.
Selbst ein harter Sparkurs landet noch bei 100,6 %. Ursache ist die
Parameterwahl r = 2,5 % gegen g = 1,5 % nominales Wachstum. Real liegt
das nominale BIP-Wachstum eher bei 2,5–3 % und der Effektivzins
darunter — also **r < g**, das Gegenteil.

Das ist keine Kleinigkeit, sondern die zentrale Streitfrage der
Fiskalpolitik seit Blanchards Präsidentenrede 2019. **Das Modell
entscheidet sie per Parameterwahl, ohne es auszuweisen** — und die
Lehre, die dabei herauskommt, lautet unvermeidlich „sparen ist
alternativlos".

**2. Das Urteil steht vor dem Spielzug fest.** Jede Politik bekommt
„stark zunehmende Ungleichheit", der Generationenindex klebt am
Anschlag, ab Periode 3 lautet die Rückmeldung immer „kritische
Schuldendynamik". Wenn die Rückmeldung nicht auf Entscheidungen
reagiert, lernt niemand etwas aus ihr — außer, dass sie egal ist.

**3. Zwei Regler lehren das Gegenteil.** Wer die Reichensteuergrenze
senkt, belastet die Mitte (B1). Wer den Spitzensatz erhöht, trifft
Facharbeitereinkommen (B2). Das sind nicht Ungenauigkeiten, sondern
falsche Lektionen über Steuerprogression — in einem Spiel, das
Steuerprogression lehren soll.

---

## G · Reihenfolge der Reparatur

| # | Was | Aufwand | Status |
|---|---|---|---|
| 1 | **A1** Zinslast-Einheit in `abgeleitet.js` | eine Zeile | ✔ **erledigt** |
| 2 | **A4** einen Zinssatz für beide Module | wenige Zeilen | ✔ **erledigt** |
| 3 | **B3** Äquivalenzgewicht im Gini nutzen **oder** Feedback-Schwellen anpassen | überschaubar | offen — **wichtigster verbleibender Punkt** |
| 4 | **A3** Palma auf die Anteilsdefinition umstellen (Test mit) | eine Zeile + Test | ✔ **erledigt** |
| 5 | **F1** nominales Wachstum auf 2,5–3 % | eine Konstante | ✔ **erledigt** (2,5 %) |
| 6 | **B1/B2** Tarifzonen entkoppeln | mittel | offen — echte Modellarbeit |
| 7 | **A2** Klimasensitivität korrigieren, Schadensfunktion neu justieren | mittel | offen — echte Modellarbeit |
| 8 | **A5** Zinsdoppelzählung | wenige Zeilen | ✔ **erledigt** |
| 9 | **B4** GGI-Referenz auf den Spielbereich strecken | eine Zeile | ✔ **erledigt** (60–150 %) |
| 10 | **B5/B6** Referenzjahr vereinheitlichen, Klimageld aus dem Status quo | Fleißarbeit | offen |
| 11 | **C3** Ausgabenstruktur entzerren, Ausgleichsposten abschaffen | mittel | offen — **hat sich verschärft**, siehe unten |
| 12 | **D** Dimensionstests ergänzen | klein | ✔ **erledigt** (8 Tests) |

### Was die Reparatur bewirkt hat

| Kennzahl | vorher | nachher | Referenz |
|---|---|---|---|
| Primärsaldo P1 | −2,58 | **−1,38** | unterscheidet sich jetzt sichtbar vom Gesamtsaldo |
| Domar-Ziel ps* | +0,01 | **−0,32** | negativ, weil r < g — die Blanchard-Lehre |
| S2-Lücke (Anzeige) | „−258,27 %" | **−1,07 %** | |
| r − g | +1,00 % | **−0,50 %** | entspricht der Lage seit 2010 |
| Schuldenquote nach 20 J. | 130,4 % | **84,9 %** | |
| Palma | 6,87 | **1,72** | Lehrbuchwert DE ~1,2 |
| Status-quo-Saldo | −115,9 | **−118,6** | Ziel −118,8 (näher als vorher) |
| Spreizung der Politiken | ~0 | **35 Prozentpunkte** | Schuldenquote nach 20 Jahren |

Der letzte Punkt ist der didaktisch entscheidende: Vorher landete jede
Politik zwischen 100 % und 130 % Schuldenquote, die Baseline erdrückte
jede Entscheidung. Jetzt liegen ein solider Haushaltskurs (70 %) und
eine starke Entlastung (105 %) 35 Prozentpunkte auseinander — **die
Entscheidungen der Teams sind sichtbar geworden.**

### Eine Nebenwirkung, die benannt gehört

Die Korrektur der Zinsausgaben (30 → 54 Mrd., Bund → Gesamtstaat) musste
über den Ausgleichsposten `sonstige_einnahmen` aufgefangen werden, damit
der Status-quo-Saldo weiter den VGR-Wert trifft. Der Posten ist dadurch
von −120 auf **−144 Mrd.** gewachsen.

Das ist ehrlich gebucht und kommentiert, aber es verschärft **C3**: Je
größer dieser Posten, desto mehr Strukturfehler kann er verdecken. Die
Ausgabenseite gehört als Nächstes entzerrt — insbesondere die Frage, ob
die GKV sowohl in `sozial` (850) als auch in `gesundheit` (320) steckt.

---

## H · Eine Empfehlung zum Umgang

Zwei Dinge, unabhängig von der Reparatur:

**Ein Blatt „Was dieses Modell nicht kann".** Jedes seriöse Lehrmodell
hat eines. Keine Konjunkturbereinigung, keine Offenheit der
Volkswirtschaft, keine Preis- und Lohndynamik, keine Unsicherheit —
das sind legitime Vereinfachungen, solange sie benannt sind. Für
Studierende ist die Grenze des Modells der lehrreichste Teil.

**Die Quellen sichtbar machen.** Die 25 belegten Annahmen stehen im
Code und erscheinen nirgends auf dem Bildschirm (das hat schon
`FLOWS.md` angemerkt). Genau diese Belege haben diese Prüfung erst
möglich gemacht. Wenn Studierende sie sehen, können sie das Modell
kritisieren — und das ist in einem wirtschaftspolitischen Planspiel
nicht Beiwerk, sondern der Kern.
