// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// TESTS · Rentenniveau: Staat und Haushalte buchen dasselbe
//
// Die zweite Fachprüfung (entwurf/PRUEFUNG-2.md I.1) fand: Rund 180 Mrd.
// weniger Rentenausgaben trafen keinen einzigen Haushalt — die Haushaltsseite
// kannte keine Rentner. Seit Stufe 2 trägt jedes Dezil einen Rentenanteil,
// und eine Niveauänderung kommt dort an, wo der Staat sie bucht.
// ═══════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { simulierePfad } from '../js/rechner/transition.js';
import { PRESETS, DEZILE } from '../js/data.js';

const SQ = PRESETS.status_quo;

/** Summe der Rentenänderung über alle Haushalte in Mrd. € */
const summeHaushalte = r => DEZILE.reduce((a, d, i) => a + d.anzahl * r.hh_delta.delta[i], 0) / 1000;

test('Im Status quo ändert das Rentenniveau nichts', () => {
  const r = berechne(SQ);
  assert.equal(r.sv_ausgaben_delta, 0);
  r.hh_delta.delta.forEach(d => assert.ok(Math.abs(d) < 1e-6));
});

test('Eine Niveauänderung kommt bei den Haushalten in der Höhe an, die der Staat bucht', () => {
  for (const niveau of [40, 43, 50, 53]) {
    const r = berechne({ ...SQ, rentenniveau: niveau });
    assert.ok(Math.abs(summeHaushalte(r) - r.sv_ausgaben_delta) < 1e-6,
      `Niveau ${niveau}: Haushalte ${summeHaushalte(r).toFixed(2)} gegen Staat ${r.sv_ausgaben_delta.toFixed(2)} Mrd.`);
  }
});

test('Auch in späteren Perioden (mehr Rentner) bleiben beide Seiten gleich', () => {
  const pfad = simulierePfad(Array.from({ length: 5 }, () => ({ ...SQ, rentenniveau: 44 })));
  for (const e of pfad) {
    assert.ok(Math.abs(summeHaushalte(e.result) - e.result.sv_ausgaben_delta) < 1e-6, e.label);
  }
  assert.ok(pfad[4].result.sv_ausgaben_delta < pfad[0].result.sv_ausgaben_delta,
    'mit steigendem Rentnerbestand spart dieselbe Kürzung mehr');
});

test('Eine Rentenkürzung verbessert den Saldo und trifft jedes Dezil', () => {
  const sq = berechne(SQ), r = berechne({ ...SQ, rentenniveau: 43 });
  assert.ok(r.saldo > sq.saldo);
  r.hh_delta.delta.forEach((d, i) => assert.ok(d < 0, `${DEZILE[i].label} verliert nichts`));
});

test('Eine Rentenkürzung trifft untere Dezile relativ stärker und erhöht die Ungleichheit', () => {
  const sq = berechne(SQ), r = berechne({ ...SQ, rentenniveau: 43 });
  const relativ = i => r.hh_delta.delta[i] / sq.hh_delta.netto[i];
  assert.ok(relativ(1) < relativ(11), 'D2 verliert relativ mehr als D10c');
  assert.ok(r.gini > sq.gini);
});

test('Die Rentenzahlungen der Haushalte treffen die GRV-Größenordnung (~362 Mrd. €)', () => {
  // BMAS Rentenversicherungsbericht 2025: 402,8 Mrd. € Ausgaben, rund 90 % Rentenzahlungen
  const summe = DEZILE.reduce((a, d) => a + d.anzahl * d.brutto * d.rente_anteil, 0) / 1000;
  assert.ok(summe > 340 && summe < 385, `Rentenzahlungen ${summe.toFixed(1)} Mrd. €`);
});
