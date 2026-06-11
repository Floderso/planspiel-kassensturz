// SPDX-License-Identifier: CC-BY-4.0
// Tests: Verteilungsmetriken (Gini, Palma, gewichteter Median)
//
// Referenzen: Sen (1973), Cowell (2011), Palma (2011), EU-SILC-Konvention
// (Armutsgrenze = 60 % des gewichteten Medians).

import test from 'node:test';
import assert from 'node:assert/strict';
import { berechneGini, berechnePalma, berechneMedianGewichtet } from '../js/rechner/verteilung.js';
import { DEZILE } from '../js/data.js';

const N = DEZILE.length;

test('Gini: vollkommene Gleichverteilung ergibt 0', () => {
  const gleich = Array(N).fill(30000);
  assert.ok(berechneGini(gleich, DEZILE) < 1e-9);
});

test('Gini liegt immer in [0, 1]', () => {
  const faelle = [
    Array(N).fill(1),
    Array.from({ length: N }, (_, i) => (i + 1) * 10000),
    Array.from({ length: N }, (_, i) => (i === N - 1 ? 1e7 : 100)),
    Array(N).fill(0),
  ];
  for (const werte of faelle) {
    const g = berechneGini(werte, DEZILE);
    assert.ok(g >= 0 && g <= 1, `Gini ${g} außerhalb [0,1]`);
  }
});

test('Gini steigt, wenn das oberste Einkommen wächst (Pigou-Dalton-Richtung)', () => {
  const basis = Array.from({ length: N }, (_, i) => 10000 + i * 5000);
  const gespreizt = [...basis];
  gespreizt[N - 1] *= 3;
  assert.ok(berechneGini(gespreizt, DEZILE) > berechneGini(basis, DEZILE));
});

test('Gini ist skaleninvariant (Verdopplung aller Einkommen ändert nichts)', () => {
  const basis = Array.from({ length: N }, (_, i) => 12000 + i * 7000);
  const doppelt = basis.map(v => v * 2);
  assert.ok(Math.abs(berechneGini(basis, DEZILE) - berechneGini(doppelt, DEZILE)) < 1e-12);
});

test('Palma: Gleichverteilung ergibt 1, Spreizung erhöht die Ratio', () => {
  const gleich = Array(N).fill(30000);
  const p_gleich = berechnePalma(gleich);
  assert.ok(Math.abs(p_gleich - 1) < 0.2, `Palma bei Gleichverteilung: ${p_gleich}`);

  const gespreizt = Array.from({ length: N }, (_, i) => 10000 + i * 20000);
  assert.ok(berechnePalma(gespreizt) > p_gleich);
});

test('gewichteter Median: liegt zwischen Minimum und Maximum, reagiert auf Gewichte', () => {
  const werte = Array.from({ length: N }, (_, i) => 10000 + i * 5000);
  const med = berechneMedianGewichtet(werte, DEZILE);
  assert.ok(med >= Math.min(...werte) && med <= Math.max(...werte));
  // Bei 12 Dezil-Zellen mit ~gleicher Besetzung muss der Median in der Mitte liegen
  assert.ok(med >= werte[3] && med <= werte[7], `Median ${med} unplausibel`);
});

test('Datenbasis: 12 Dezil-Zellen, ~41 Mio. Haushalte (Destatis Mikrozensus)', () => {
  assert.equal(N, 12);
  const summe = DEZILE.reduce((a, d) => a + d.anzahl, 0);
  assert.ok(Math.abs(summe - 41) < 1.5, `Haushaltssumme ${summe} Mio. weicht von ~41 Mio. ab`);
  // D10a+b+c müssen zusammen das oberste Dezil (~4,1 Mio. HH) ergeben
  const top = DEZILE.filter(d => d.label.startsWith('D10')).reduce((a, d) => a + d.anzahl, 0);
  assert.ok(Math.abs(top - 4.1) < 0.2, `Top-Dezil ${top} Mio. HH`);
  // Bruttoeinkommen müssen streng aufsteigend sortiert sein
  for (let i = 1; i < N; i++) assert.ok(DEZILE[i].brutto > DEZILE[i - 1].brutto);
});
