// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// TESTS · Keine dominante Strategie
//
// Die zweite Fachprüfung (entwurf/PRUEFUNG-2.md I.1) fand: Wer die
// Rentenbeiträge von 18,6 auf 10 % senkt, verbessert den Saldo um 46 Mrd.,
// und alle zwölf Dezile gewinnen. Das Sozialressort hatte damit eine
// Strategie, die nichts kostet — ein Planspiel über Zielkonflikte ohne
// Zielkonflikt.
//
// Dominant heißt: Die Politik verbessert den Saldo UND das Nettoeinkommen
// jedes Dezils, ohne dass Gini, Emissionen oder BIP schlechter werden.
// Gerechnet über den ganzen Pfad (fünf Perioden), denn manche Kosten zeigen
// sich erst dort — eine höhere Körperschaftsteuer trifft keinen Haushalt,
// kostet aber über die Investitionen Wachstum (BIP 2041: 6.154 statt 6.380
// bei KSt 30 %). Wer eine Politik ohne jeden Preis findet, hat einen Kanal
// gefunden, der im Modell fehlt.
//
// Enger als die Formulierung der Prüfung („Saldo, alle Dezile und Gini
// verbessern"): Der Gini darf auch gleich bleiben. Weiter, weil Emissionen
// und BIP mitzählen — ein CO₂-Preis von null entlastet alle und kostet den
// Staat wenig, aber er kostet das Klima. Das ist ein Zielkonflikt, keine
// dominante Strategie (dass er zu billig aussieht, ist Befund I.4).
// ═══════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { simulierePfad } from '../js/rechner/transition.js';
import { PRESETS } from '../js/data.js';
import { ALLE } from '../js/spielkern.js';

const SQ = PRESETS.status_quo;
const PERIODEN = 5;
const pfadEnde = params => simulierePfad(Array.from({ length: PERIODEN }, () => ({ ...params })))[PERIODEN - 1];
const BASIS = pfadEnde(SQ);

// Stellgrößen, die nicht am Tisch stehen, aber in der klassischen Fläche
const WEITERE = [
  { key: 'eingang',   min: 0,     max: 40 },
  { key: 'grenze',    min: 60000, max: 500000 },
  { key: 'mwst_erm',  min: 0,     max: 19 },
  { key: 'abgeltung', min: 0,     max: 45 },
  { key: 'alpf',      min: 3,     max: 10 },
  { key: 'bbg',       min: 60000, max: 200000 },
  { key: 'boden',     min: 0,     max: 2 },
  { key: 'verm',      min: 0,     max: 3 },
  { key: 'zucman',    min: 0,     max: 3 },
];

const STELLGROESSEN = [...ALLE, ...WEITERE.filter(w => !ALLE.some(s => s.key === w.key))];

function werteVon(s) {
  if (s.klappe) return [true, false];
  return Array.from({ length: 11 }, (_, i) => s.min + (s.max - s.min) * i / 10);
}

/** Gewinnt diese Politik überall, ohne irgendwo etwas zu kosten? */
function dominant(params) {
  const e = pfadEnde(params), r = e.result, b = BASIS.result;
  return r.saldo > b.saldo + 0.1
      && r.hh_delta.delta.every(d => d > 1)
      && r.gini <= b.gini + 1e-6
      && r.emissionen <= b.emissionen + 1e-6
      && e.zustand.bip >= BASIS.zustand.bip - 1e-6;
}

test('Keine einzelne Stellgröße ist eine dominante Strategie', () => {
  const treffer = [];
  for (const s of STELLGROESSEN) {
    for (const v of werteVon(s)) {
      if (dominant({ ...SQ, [s.key]: v })) treffer.push(`${s.key} = ${v}`);
    }
  }
  assert.deepEqual(treffer, [], `dominante Strategien: ${treffer.join(', ')}`);
});

test('Auch zwei Stellgrößen am Tisch zusammen sind keine dominante Strategie', () => {
  const treffer = [];
  const tisch = ALLE.filter(s => !s.klappe);
  for (let i = 0; i < tisch.length; i++) {
    for (let j = i + 1; j < tisch.length; j++) {
      const a = tisch[i], b = tisch[j];
      for (const va of [a.min, a.max]) for (const vb of [b.min, b.max]) {
        if (dominant({ ...SQ, [a.key]: va, [b.key]: vb })) treffer.push(`${a.key} = ${va} & ${b.key} = ${vb}`);
      }
    }
  }
  assert.deepEqual(treffer, [], `dominante Kombinationen: ${treffer.join(', ')}`);
});
