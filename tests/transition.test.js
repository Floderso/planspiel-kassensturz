// SPDX-License-Identifier: CC-BY-4.0
// Tests: Multi-Perioden-Übergänge, Emissionspfad, HANK-Multiplikator,
// abgeleitete Fiskalindikatoren (Domar, S2, GGI)
//
// Referenzen: UBA Projektionsbericht 2025, Kaplan/Moll/Violante (2018) AER,
// Domar (1944), Blanchard (2019) AEA Presidential Address.

import test from 'node:test';
import assert from 'node:assert/strict';
import { simulierePfad, hankMultiplikator, berechneTransition, getDemoForYear } from '../js/rechner/transition.js';
import { berechneAbgeleitet, CO2_BUDGET_DE } from '../js/rechner/abgeleitet.js';
import { berechne } from '../js/rechner/berechne.js';
import { PRESETS, PERIOD_STATE_0, DEZILE, emissionsBasis, EMISSIONEN_1990 } from '../js/data.js';

const SQ = PRESETS.status_quo;
const sqParams = (n = 5) => Array.from({ length: n }, () => ({ ...SQ }));

test('Emissionsbasispfad: 649 Mt 2025, −63 % 2030 und −80 % 2040 gegenüber 1990', () => {
  assert.equal(emissionsBasis(2025), 649);
  assert.ok(Math.abs(emissionsBasis(2030) / EMISSIONEN_1990 - 0.37) < 1e-9);
  assert.ok(Math.abs(emissionsBasis(2040) / EMISSIONEN_1990 - 0.20) < 1e-9);
  for (let j = 2025; j < 2045; j++) assert.ok(emissionsBasis(j + 1) < emissionsBasis(j), `Pfad fällt ${j}`);
});

test('Im Status quo folgen die Emissionen dem Pfad, ein höherer CO₂-Preis senkt sie darunter', () => {
  const pfad = simulierePfad(sqParams(5));
  pfad.forEach(e => assert.ok(Math.abs(e.result.emissionen - emissionsBasis(e.jahr)) < 1e-6, e.label));
  const teuer = simulierePfad(Array.from({ length: 5 }, () => ({ ...SQ, co2: 150 })));
  teuer.forEach((e, i) => assert.ok(e.result.emissionen < pfad[i].result.emissionen, e.label));
});

test('Das CO₂-Budget (1,7 °C) ist im Status quo in den 2030ern aufgebraucht', () => {
  const pfad = simulierePfad(sqParams(5));
  assert.ok(pfad[2].zustand.co2_kumulat < CO2_BUDGET_DE, 'bis 2033 noch Budget übrig');
  assert.ok(pfad[4].zustand.co2_kumulat > CO2_BUDGET_DE, 'bis 2041 aufgebraucht');
});

test('HANK-Multiplikator: Transfers an untere Dezile multiplizieren stärker', () => {
  const basis = 1.2; // INVEST_MULTIPLIKATOR (Gechert/Heimberger)
  assert.equal(hankMultiplikator(null), basis);
  assert.equal(hankMultiplikator({ delta: Array(DEZILE.length).fill(0) }), basis);

  const anUnten = { delta: DEZILE.map((_, i) => (i === 0 ? 1000 : 0)) };
  const anOben = { delta: DEZILE.map((_, i) => (i === DEZILE.length - 1 ? 1000 : 0)) };
  assert.ok(hankMultiplikator(anUnten) > hankMultiplikator(anOben),
    'MPC-Gewichtung: unteres Dezil (MPC~1) > oberstes (MPC~0,4)');
});

test('berechneTransition: deutsche Emissionen verändern das deutsche BIP nicht', () => {
  // Früher erwärmten deutsche Emissionen im Modell die Erde (Klimasensitivität
  // 1.100-fach zu hoch), und ein CO₂-Preis von 250 €/t brachte +2,9 % BIP
  // (PRUEFUNG.md A2, PRUEFUNG-2.md I.5).
  const r = berechne(SQ, PERIOD_STATE_0);
  const sauber = berechneTransition({ ...PERIOD_STATE_0, co2_kumulat: 0 }, r, 2029, 4);
  const belastet = berechneTransition({ ...PERIOD_STATE_0, co2_kumulat: 6000 }, r, 2029, 4);
  assert.equal(belastet.bip, sauber.bip);
});

test('berechneTransition: Defizit erhöht die Schuldenquote, Überschuss senkt sie', () => {
  const r = berechne(SQ, PERIOD_STATE_0);
  const defizit = berechneTransition(PERIOD_STATE_0, { ...r, saldo: -100 }, 2029, 4);
  const ueberschuss = berechneTransition(PERIOD_STATE_0, { ...r, saldo: +100 }, 2029, 4);
  assert.ok(defizit.schuldenquote > ueberschuss.schuldenquote);
  assert.ok(ueberschuss.schuldenquote >= 0, 'Schuldenquote darf nie negativ werden');
});

test('simulierePfad: Struktur, Labels und Periodenlängen', () => {
  const pfad = simulierePfad(sqParams(5));
  assert.equal(pfad.length, 5);
  assert.equal(pfad[0].label, '2025–2028');
  assert.equal(pfad[0].jahr, 2025);
  assert.equal(pfad[4].jahr, 2041);

  // Variable Periodenlängen inkl. Länge 1 (Label ohne Spanne)
  const variabel = simulierePfad(sqParams(3), { perioden_laenge_jahre: [1, 2, 4] });
  assert.equal(variabel[0].label, '2025');
  assert.equal(variabel[1].label, '2026–2027');
  assert.equal(variabel[2].jahr, 2028);
});

test('simulierePfad: alle Kennzahlen über 12 Perioden endlich und in Wertebereichen', () => {
  const extrem = Array.from({ length: 12 }, (_, i) => (i % 2 === 0
    ? { ...SQ, spitze: 65, co2: 350, invest_impuls: 120 }
    : { ...SQ, spitze: 35, mwst: 15, invest_impuls: -30 }));
  const pfad = simulierePfad(extrem, { perioden_laenge_jahre: 4 });
  for (const e of pfad) {
    for (const v of [e.result.saldo, e.zustand.schuldenquote, e.result.gini, e.result.emissionen, e.zustand.bip]) {
      assert.ok(Number.isFinite(v), `${e.label}: nicht-endlicher Wert`);
    }
    assert.ok(e.zustand.bip > 0 && e.zustand.schuldenquote >= 0);
    assert.ok(e.result.gini >= 0 && e.result.gini <= 1);
    assert.ok(e.zustand.lohnbasis_faktor >= 0.70 && e.zustand.lohnbasis_faktor <= 1.30);
  }
});

test('simulierePfad: Schock wirkt nur in seiner Periode auf den Zustand', () => {
  const schock = { periode: 1, id: 'test', name: 'Test-Rezession', typ: 'konjunktur', effekte: { bip_malus: 0.05, schuld_bonus: 4 } };
  const mit = simulierePfad(sqParams(4), { perioden_laenge_jahre: 4, schocks: [schock] });
  const ohne = simulierePfad(sqParams(4), { perioden_laenge_jahre: 4, schocks: [] });
  assert.equal(mit[1].schock.id, 'test');
  assert.equal(mit[0].schock, null);
  // Periode 0 identisch, ab Schock-Periode abweichend
  assert.equal(mit[0].result.saldo, ohne[0].result.saldo);
  assert.notEqual(mit[1].result.saldo, ohne[1].result.saldo);
  // Schock verschlechtert die Lage (höhere Schuldenquote im Folgezustand)
  assert.ok(mit[2].zustand.schuldenquote > ohne[2].zustand.schuldenquote);
});

test('getDemoForYear: an den Rändern geklemmt, Rentenfaktor steigt mit Alterung', () => {
  assert.deepEqual(getDemoForYear(1990), getDemoForYear(2025));
  assert.deepEqual(getDemoForYear(2200), getDemoForYear(2100));
  assert.ok(getDemoForYear(2040).renten_faktor > getDemoForYear(2025).renten_faktor,
    'Baby-Boomer-Rentenwelle: renten_faktor muss bis 2040 steigen (Destatis)');
});

test('berechneAbgeleitet: Domar/S2/GGI-Konsistenz', () => {
  const pfad = simulierePfad(sqParams(5));
  for (const e of pfad) {
    const abl = berechneAbgeleitet(e.result, e.zustand);
    assert.ok(Math.abs(abl.s2 - (abl.ps_t - abl.ps_star)) < 1e-12, 'S2 = ps_t − ps_star');
    assert.ok(abl.ggi >= 0 && abl.ggi <= 1, `GGI ${abl.ggi}`);
    assert.ok(Math.abs(abl.ggi - (abl.ggi_schuld + abl.ggi_co2)) < 1e-12);
    assert.ok(abl.co2_budget_rest >= 0 && abl.co2_budget_rest <= CO2_BUDGET_DE);
    assert.ok(abl.mu_hank > 0.5 && abl.mu_hank < 3, `HANK-Multiplikator ${abl.mu_hank}`);
  }
});
