// SPDX-License-Identifier: CC-BY-4.0
// Tests: Einkommensteuer-Tariffunktionen gegen § 32a Abs. 1 EStG 2026
//
// Referenz: § 32a Abs. 1 EStG i. d. F. Steuerfortentwicklungsgesetz
// (BGBl. 2024 I Nr. 449) — Veranlagungszeitraum 2026 (Referenzjahr des Modells).
// Das Modell ist ein parametrisierbarer Formeltarif (Integral einer stückweise
// linearen Grenzsteuerrate). Bei den gesetzlichen Status-quo-Parametern
// (Freibetrag 12.348, Eingang 14 %, Spitze 45 %, Grenze 277.826) muss er die
// amtliche Formel bis auf eine kleine dokumentierte Toleranz reproduzieren.

import test from 'node:test';
import assert from 'node:assert/strict';
import { estTarif, grenzsteuersatz, effSteuersatz, estHaushalt, grenzsteuersatzHaushalt, ZVE_QUOTE, SPLITTING_FAKTOR } from '../js/rechner/einkommensteuer.js';

// Amtliche Tarifformel 2026 (ohne Abrundung des zvE, zur stetigen Vergleichbarkeit)
function est2026Amtlich(zvE) {
  if (zvE <= 12348) return 0;
  if (zvE <= 17799) { const y = (zvE - 12348) / 10000; return (914.51 * y + 1400) * y; }
  if (zvE <= 69878) { const z = (zvE - 17799) / 10000; return (173.10 * z + 2397) * z + 1034.87; }
  if (zvE <= 277825) return 0.42 * zvE - 11135.63;
  return 0.45 * zvE - 19470.38;
}

const SQ = { freibetrag: 12348, eingang: 14, spitze: 45, grenze: 277826 };
const modell = (zvE) => estTarif(zvE, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze);

test('§ 32a 2026: Stützstellen an den Zonengrenzen (Abweichung < 0,1 %)', () => {
  for (const zvE of [17799, 30000, 69878, 100000, 277825, 500000]) {
    const amtlich = est2026Amtlich(zvE);
    const m = modell(zvE);
    assert.ok(Math.abs(m - amtlich) / amtlich < 0.001,
      `zvE ${zvE}: Modell ${m.toFixed(2)} vs. amtlich ${amtlich.toFixed(2)}`);
  }
});

test('§ 32a 2026: maximale relative Abweichung < 1 % über den gesamten Tarifverlauf', () => {
  for (let zvE = 12500; zvE <= 2_000_000; zvE += 137) {
    const amtlich = est2026Amtlich(zvE);
    if (amtlich < 50) continue; // Kleinstbeträge: relative Abweichung nicht aussagekräftig
    const rel = Math.abs(modell(zvE) - amtlich) / amtlich;
    assert.ok(rel < 0.01, `zvE ${zvE}: relative Abweichung ${(rel * 100).toFixed(2)} %`);
  }
});

test('Tarif ist 0 bis zum Grundfreibetrag', () => {
  assert.equal(modell(0), 0);
  assert.equal(modell(12348), 0);
  assert.equal(estTarif(8000, 8000, 14, 45, 277826), 0);
});

test('Tarif ist streng monoton steigend oberhalb des Freibetrags', () => {
  let prev = modell(12097);
  for (let zvE = 12597; zvE <= 1_000_000; zvE += 500) {
    const cur = modell(zvE);
    assert.ok(cur > prev, `Tarif fällt bei zvE ${zvE}`);
    prev = cur;
  }
});

test('Tarif ist stetig (keine Sprünge an Zonengrenzen)', () => {
  // Zonengrenzen des Modells bei SQ-Parametern
  for (const grenzwert of [12348, 17799, 69878, 277825]) {
    const links = modell(grenzwert - 0.01);
    const rechts = modell(grenzwert + 0.01);
    assert.ok(Math.abs(rechts - links) < 0.05, `Sprung bei ${grenzwert}: ${links} → ${rechts}`);
  }
});

test('grenzsteuersatz ist die Ableitung von estTarif (numerisch, Toleranz 0,1 PP)', () => {
  const h = 1;
  for (const zvE of [13000, 15000, 25000, 50000, 80000, 150000, 300000, 800000]) {
    const numerisch = (modell(zvE + h) - modell(zvE - h)) / (2 * h);
    const analytisch = grenzsteuersatz(zvE, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze);
    assert.ok(Math.abs(numerisch - analytisch) < 0.001,
      `zvE ${zvE}: numerisch ${numerisch.toFixed(4)} vs. grenzsteuersatz ${analytisch.toFixed(4)}`);
  }
});

test('Grenzsteuersatz: Eckwerte des § 32a 2026 (14 % Eingang, 42 % Zone 4, 45 % Spitze)', () => {
  const gs = (zvE) => grenzsteuersatz(zvE, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze);
  assert.ok(Math.abs(gs(12349) - 0.14) < 0.002, `Eingangssatz: ${gs(12349)}`);
  assert.ok(Math.abs(gs(17799) - 0.2397) < 0.002, `Zone-2-Ende (soll 23,97 %): ${gs(17799)}`);
  assert.ok(Math.abs(gs(100000) - 0.42) < 0.002, `Zone 4 (soll 42 %): ${gs(100000)}`);
  assert.ok(Math.abs(gs(300000) - 0.45) < 1e-9, `Spitzensatz: ${gs(300000)}`);
});

test('Grenzsteuersatz übersteigt nie den Spitzensatz', () => {
  for (const spitze of [35, 45, 55, 65]) {
    for (let zvE = 13000; zvE <= 1_000_000; zvE += 9_973) {
      const gs = grenzsteuersatz(zvE, 12348, 14, spitze, 277826);
      assert.ok(gs <= spitze / 100 + 1e-9, `spitze ${spitze}, zvE ${zvE}: GS ${gs}`);
    }
  }
});

test('Durchschnittssteuersatz liegt stets unter dem Grenzsteuersatz (Progression)', () => {
  for (let zvE = 13000; zvE <= 1_000_000; zvE += 9_973) {
    const eff = effSteuersatz(zvE, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze);
    const gs = grenzsteuersatz(zvE, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze);
    assert.ok(eff < gs, `zvE ${zvE}: eff ${eff} >= GS ${gs}`);
    assert.ok(eff >= 0 && eff < 0.45, `zvE ${zvE}: eff ${eff} außerhalb [0; 0,45)`);
  }
});

test('Haushaltsebene: konsistent zur Tarifformel, Grenzsatz = Ableitung', () => {
  // T_HH = s × T(brutto × q / s)
  for (const brutto of [14000, 30000, 60000, 120000, 400000]) {
    const erwartet = SPLITTING_FAKTOR
      * estTarif(brutto * ZVE_QUOTE / SPLITTING_FAKTOR, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze);
    assert.equal(estHaushalt(brutto, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze), erwartet);

    const h = 1;
    const numerisch = (estHaushalt(brutto + h, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze)
                     - estHaushalt(brutto - h, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze)) / (2 * h);
    const analytisch = grenzsteuersatzHaushalt(brutto, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze);
    assert.ok(Math.abs(numerisch - analytisch) < 0.001,
      `brutto ${brutto}: numerisch ${numerisch.toFixed(4)} vs. ${analytisch.toFixed(4)}`);
  }
  // Haushalt unterhalb des splitting-adjustierten Existenzminimums zahlt nichts
  const hh_freigrenze = SQ.freibetrag * SPLITTING_FAKTOR / ZVE_QUOTE; // ≈ 24.500 €
  assert.equal(estHaushalt(hh_freigrenze - 1, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze), 0);
  assert.ok(estHaushalt(hh_freigrenze + 1000, SQ.freibetrag, SQ.eingang, SQ.spitze, SQ.grenze) > 0);
});

test('Parameteränderungen wirken in die richtige Richtung', () => {
  const basis = modell(60000);
  assert.ok(estTarif(60000, 14000, 14, 45, 277826) < basis, 'höherer Freibetrag muss entlasten');
  assert.ok(estTarif(60000, 12348, 16, 45, 277826) > basis, 'höherer Eingangssatz muss belasten');
  assert.ok(estTarif(400000, 12348, 14, 50, 277826) > modell(400000), 'höherer Spitzensatz muss Topeinkommen belasten');
  assert.ok(estTarif(400000, 12348, 14, 45, 200000) > modell(400000), 'niedrigere Spitzensatz-Grenze muss Topeinkommen belasten');
});

test('Spitzensatz und Grenze treffen nur Einkommen oberhalb der Grenze (PRUEFUNG.md B1/B2)', () => {
  // Früher hob der Spitzensatz die 42-%-Zone mit an, und die Grenze skalierte alle Zonen:
  // Spitze 55 % kostete 60.000 € zvE 2.439 €, Grenze 150.000 € machte 40.000 € zvE zum 41-%-Fall.
  for (const zvE of [20000, 40000, 60000, 100000, 140000]) {
    assert.equal(estTarif(zvE, 12348, 14, 55, 277826), modell(zvE), `Spitze 55 %, zvE ${zvE}`);
    assert.equal(estTarif(zvE, 12348, 14, 45, 150000), modell(zvE), `Grenze 150.000, zvE ${zvE}`);
    assert.equal(grenzsteuersatz(zvE, 12348, 14, 55, 150000), grenzsteuersatz(zvE, 12348, 14, 45, 277826));
  }
  // Oberhalb der Grenze: genau der Spitzensatz
  assert.ok(Math.abs(grenzsteuersatz(200000, 12348, 14, 55, 150000) - 0.55) < 1e-12);
});

test('Spitzenzone im obersten Prozent: Pareto-Rand statt Durchschnitt', () => {
  // Das zvE-Mittel von D10c (~190.000 € je Veranlagung) liegt unter der Grenze; ohne
  // Verteilung zahlte im Modell niemand den Spitzensatz.
  const brutto = 385000; // Arbeitseinkommen D10c
  const ohne = estHaushalt(brutto, 12348, 14, 55, 277826) - estHaushalt(brutto, 12348, 14, 45, 277826);
  const mit  = estHaushalt(brutto, 12348, 14, 55, 277826, 1.5) - estHaushalt(brutto, 12348, 14, 45, 277826, 1.5);
  assert.equal(ohne, 0);
  assert.ok(mit > 0, 'mit Pareto-Rand zahlt ein Teil der Veranlagungen mehr');
  assert.ok(Math.abs(estHaushalt(brutto, 12348, 14, 45, 277826, 1.5) - estHaushalt(brutto, 12348, 14, 45, 277826)) < 0.05 * estHaushalt(brutto, 12348, 14, 45, 277826),
    'der Rand ändert die Steuerlast im Status quo nur wenig');
});
