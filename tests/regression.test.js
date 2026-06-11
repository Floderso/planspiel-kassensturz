// SPDX-License-Identifier: CC-BY-4.0
// Regressionstest: Status-quo-Pfad über 5 Perioden
//
// Zweck: Künftige Änderungen an Engine oder Datenbasis dürfen die Ergebnisse
// nicht unbemerkt verschieben. Wer Modellparameter bewusst ändert, muss die
// Referenzwerte hier aktualisieren und die Änderung im Commit begründen.
//
// Referenzwerte erzeugt am 2026-06-11 nach (a) Tarif-Kalibrierung auf
// § 32a EStG 2025, (b) Aufkommenskalibrierung: ESt auf Haushaltsebene
// (zvE-Quote 0,79, Splitting 1,6), MwSt-Basisfaktor 1,68, ErbSt-Freibetrags-
// quote 0,45, Gegenposten sonstige_einnahmen −120 Mrd.

import test from 'node:test';
import assert from 'node:assert/strict';
import { simulierePfad } from '../js/rechner/transition.js';
import { PRESETS } from '../js/data.js';

const REFERENZ = [
  { label: '2025–2028', saldo: -115.8706, schuldenquote: 63.5,     gini: 0.37659, emissionen: 327, bip: 4470 },
  { label: '2029–2032', saldo: -140.3865, schuldenquote: 75.7635,  gini: 0.37659, emissionen: 327, bip: 4747.1416 },
  { label: '2033–2036', saldo: -174.8147, schuldenquote: 90.3687,  gini: 0.37659, emissionen: 327, bip: 5014.4771 },
  { label: '2037–2040', saldo: -204.563,  schuldenquote: 108.4674, gini: 0.37659, emissionen: 327, bip: 5256.1485 },
  { label: '2041–2044', saldo: -234.0431, schuldenquote: 130.3875, gini: 0.37659, emissionen: 327, bip: 5453.9871 },
];

test('Status-quo-Pfad (5 Perioden) reproduziert die Referenzwerte', () => {
  const pfad = simulierePfad(Array.from({ length: 5 }, () => ({ ...PRESETS.status_quo })));
  assert.equal(pfad.length, REFERENZ.length);

  for (let i = 0; i < REFERENZ.length; i++) {
    const ref = REFERENZ[i];
    const e = pfad[i];
    assert.equal(e.label, ref.label);
    const nah = (ist, soll, name) =>
      assert.ok(Math.abs(ist - soll) < 5e-4 * Math.max(1, Math.abs(soll)),
        `${ref.label} ${name}: ist ${ist}, Referenz ${soll}`);
    nah(e.result.saldo, ref.saldo, 'Saldo');
    nah(e.zustand.schuldenquote, ref.schuldenquote, 'Schuldenquote');
    nah(e.result.gini, ref.gini, 'Gini');
    nah(e.result.emissionen, ref.emissionen, 'Emissionen');
    nah(e.zustand.bip, ref.bip, 'BIP');
  }
});

test('Status-quo-Pfad ist deterministisch (zwei Läufe identisch)', () => {
  const a = simulierePfad(Array.from({ length: 5 }, () => ({ ...PRESETS.status_quo })));
  const b = simulierePfad(Array.from({ length: 5 }, () => ({ ...PRESETS.status_quo })));
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].result.saldo, b[i].result.saldo);
    assert.equal(a[i].zustand.bip, b[i].zustand.bip);
  }
});
