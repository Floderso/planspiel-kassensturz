// SPDX-License-Identifier: CC-BY-4.0
// Feedback tests: objectives scoring + the causal explainer.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateObjectives, DEFAULT_OBJECTIVES } from '../src/feedback/objectives.js';
import { explainRound } from '../src/feedback/explainer.js';
import { stepEconomy } from '../src/engine/economy.js';
import { initialStateFor } from '../src/config/scenarios.js';
import { getShock } from '../src/config/shocks.js';

// ── Objectives ───────────────────────────────────────────────────────────────

test('default objectives on the steady state: 4/5 met (emissions drift up)', () => {
  const prev = initialStateFor('stable');
  const { state } = stepEconomy(prev, {}, null, {});
  const status = evaluateObjectives(state, prev, DEFAULT_OBJECTIVES);

  assert.equal(status.total, 5);
  assert.equal(status.achieved, 4);
  assert.equal(status.score, 86); // weights 6 of 7
  const green = status.results.find(r => r.id === 'green_transition');
  assert.equal(green.achieved, false, 'baseline emissions rise — the lesson');
});

test('operators: between, falling/rising, <=/>= evaluate correctly', () => {
  const a = { inflation: 2, debt_ratio: 60 };
  const b = { inflation: 2.5, debt_ratio: 59 };
  const objectives = [
    { id: 'x', label: 'band', metric: 'inflation', op: 'between', value: [1, 3] },
    { id: 'y', label: 'falling', metric: 'debt_ratio', op: 'falling', value: 0 },
    { id: 'z', label: 'floor', metric: 'inflation', op: '>=', value: 2 },
  ];
  const status = evaluateObjectives(b, a, objectives);
  assert.deepEqual(status.results.map(r => r.achieved), [true, true, true]);
  assert.throws(
    () => evaluateObjectives(b, a, [{ id: 'w', label: 'w', metric: 'inflation', op: '~=', value: 2 }]),
    /Unknown objective operator/
  );
});

test('score respects weights', () => {
  const state = { m: 10 };
  const objectives = [
    { id: 'a', label: 'a', metric: 'm', op: '>=', value: 5, weight: 3 },  // achieved
    { id: 'b', label: 'b', metric: 'm', op: '<=', value: 5, weight: 1 },  // missed
  ];
  const status = evaluateObjectives(state, null, objectives);
  assert.equal(status.score, 75);
});

// ── Explainer: message shape and teaching content ────────────────────────────

test('explainer messages have the documented shape and ordering', () => {
  const prev = initialStateFor('recession');
  const { state, detail } = stepEconomy(prev, { gov_spending_change: 2 }, getShock('trade_war'), {});
  const status = evaluateObjectives(state, prev, DEFAULT_OBJECTIVES);
  const messages = explainRound(prev, state, detail, getShock('trade_war'), status);

  for (const m of messages) {
    assert.ok(['info', 'good', 'warn', 'bad'].includes(m.tone), `tone ${m.tone}`);
    assert.ok(m.topic && m.title && m.text, 'topic/title/text present');
  }
  assert.equal(messages[0].topic, 'shock', 'shock first');
  assert.ok(messages.some(m => m.topic === 'fiscal'), 'fiscal impulse explained');
  assert.ok(messages.some(m => m.topic === 'capacity'));
  assert.ok(messages.some(m => m.topic === 'debt'));
  assert.ok(messages.some(m => m.topic === 'distribution'));
  assert.equal(messages.at(-1).topic, 'objectives', 'objectives last');
});

test('explainer names the mechanism: multiplier, Phillips, Domar', () => {
  const prev = initialStateFor('overheating');
  const { state, detail } = stepEconomy(prev, { gov_spending_change: 2 }, null, { central_bank: 'player', });
  const messages = explainRound(prev, state, detail, null, null);

  const capacity = messages.find(m => m.topic === 'capacity');
  assert.ok(/Phillips/i.test(capacity.text));

  const fiscal = messages.find(m => m.topic === 'fiscal');
  assert.ok(/multiplier/i.test(fiscal.text));

  const debt = messages.find(m => m.topic === 'debt');
  assert.ok(/(Domar|snowball)/i.test(debt.text));
});

test('steady round: calm feedback (stable debt, near potential, unchanged distribution)', () => {
  const prev = initialStateFor('stable');
  const { state, detail } = stepEconomy(prev, {}, null, {});
  const messages = explainRound(prev, state, detail, null, null);

  assert.equal(messages.find(m => m.topic === 'capacity').tone, 'good');
  assert.equal(messages.find(m => m.topic === 'debt').tone, 'good');
  assert.ok(!messages.some(m => m.tone === 'bad'), 'no alarm in a calm round');
});

test('risk premium earns its own warning message', () => {
  const prev = initialStateFor('debt_crisis');
  const { state, detail } = stepEconomy(prev, {}, null, {});
  const messages = explainRound(prev, state, detail, null, null);
  const risk = messages.find(m => m.topic === 'risk');
  assert.ok(risk, 'risk message present');
  assert.equal(risk.tone, 'bad');
});