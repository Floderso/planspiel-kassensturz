// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// Tests: verbales Teamfeedback generiereTeamFeedback()
//
// Die Fachprüfung (PRUEFUNG.md B3) fand vier gegensätzliche Politiken mit
// demselben Urteil „stark zunehmende Ungleichheit" — die Rückmeldung reagierte
// nicht auf Entscheidungen. Diese Datei hält fest, dass sie es jetzt tut.

import test from 'node:test';
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { generiereTeamFeedback } from '../js/feedback.js';
import { PRESETS } from '../js/data.js';

const SQ = PRESETS.status_quo;
const ZUSTAND = { schuldenquote: 63.5, co2_kumulat: 0 };

function urteilUngleichheit(params) {
  const text = generiereTeamFeedback({ result: berechne(params), zustand: ZUSTAND });
  return text.split(' · ').find(t => /Ungleichheit/.test(t));
}

test('Der unveränderte Status quo gilt nicht als steigende Ungleichheit', () => {
  assert.equal(urteilUngleichheit(SQ), 'Ungleichheit etwa wie heute');
});

test('Gegensätzliche Politiken bekommen verschiedene Urteile zur Ungleichheit', () => {
  const umverteilend = urteilUngleichheit({ ...SQ, bg: 800, kg: 400, spitze: 55, freibetrag: 16000, erb: 35 });
  const entlastend   = urteilUngleichheit({ ...SQ, spitze: 35, erb: 0, bg: 450, kg: 220 });
  const urteile = new Set([umverteilend, urteilUngleichheit(SQ), entlastend]);
  assert.equal(urteile.size, 3, `Urteile: ${[...urteile].join(' | ')}`);
  assert.notEqual(umverteilend, 'deutlich mehr Ungleichheit als heute');
  assert.equal(entlastend, 'deutlich mehr Ungleichheit als heute');
});
