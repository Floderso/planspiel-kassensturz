// SPDX-License-Identifier: CC-BY-4.0
// Integration tests: stepEconomy composes all blocks into one consistent round.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stepEconomy } from '../src/engine/economy.js';
import { initialStateFor } from '../src/config/scenarios.js';
import { getShock } from '../src/config/shocks.js';

const NEUTRAL = {}; // all levers at defaults

// ── Steady state ─────────────────────────────────────────────────────────────

test('stable scenario + neutral policies = steady state (the calibration anchor)', () => {
  const prev = initialStateFor('stable');
  const { state } = stepEconomy(prev, NEUTRAL, null, {});

  assert.equal(state.round, 1);
  assert.ok(Math.abs(state.output_gap - 0) < 0.1, `gap ${state.output_gap}`);
  assert.ok(Math.abs(state.inflation - 2) < 0.05, `inflation ${state.inflation}`);
  assert.ok(Math.abs(state.unemployment - 6) < 0.05, `unemployment ${state.unemployment}`);
  assert.ok(Math.abs(state.real_growth - 2) < 0.05, `growth ${state.real_growth}`);
  assert.ok(Math.abs(state.debt_ratio - 60) < 0.1, `debt ${state.debt_ratio}`);
  assert.ok(Math.abs(state.primary_balance - 0) < 0.05);
  assert.ok(Math.abs(state.gini - 0.374) < 0.01, `gini ${state.gini}`);
  assert.ok(state.credibility > prev.credibility, 'on-target inflation builds credibility');
  assert.ok(state.emissions_index > 100, 'baseline emissions drift upward');
});

// ── Recession: stimulus works, ZLB binds ─────────────────────────────────────

test('recession: Taylor rule hits the zero lower bound; stimulus closes the gap', () => {
  const prev = initialStateFor('recession');

  const neutral = stepEconomy(prev, NEUTRAL, null, {});
  assert.equal(neutral.state.policy_rate, 0, 'ZLB must bind in a deep recession');

  const stimulus = stepEconomy(prev, { gov_spending_change: 2 }, null, {});
  assert.ok(stimulus.state.output_gap > neutral.state.output_gap, 'multiplier at work');
  assert.ok(stimulus.state.unemployment < neutral.state.unemployment, 'Okun at work');
  assert.ok(stimulus.state.deficit_ratio > neutral.state.deficit_ratio, 'stimulus costs money');
});

// ── Overheating: Phillips curve bites ────────────────────────────────────────

test('overheating: same stimulus buys less growth and more inflation pressure', () => {
  // Hold the rate constant (player-run central bank) so only the multiplier
  // and Phillips effects differentiate the two scenarios.
  const player = { central_bank: 'player' };
  const hold = { interest_rate: 3, gov_spending_change: 2 };
  const cold = stepEconomy(initialStateFor('recession'), hold, null, player);
  const hot  = stepEconomy(initialStateFor('overheating'), hold, null, player);

  const coldGain = cold.state.output_gap - initialStateFor('recession').output_gap;
  const hotGain  = hot.state.output_gap - initialStateFor('overheating').output_gap;
  assert.ok(coldGain > hotGain, 'state-dependent multiplier: less bang at capacity');

  // Phillips: with a positive gap, inflation lands ABOVE expectations
  assert.ok(hot.state.inflation > initialStateFor('overheating').expected_inflation);
  assert.ok(hot.state.inflation > cold.state.inflation, 'stimulus prices in at capacity');
});

// ── Monetary channels (player-run central bank) ──────────────────────────────

test('player central bank: a rate hike cools demand; QE stimulates at the ZLB', () => {
  const player = { central_bank: 'player' };

  const hike = stepEconomy(initialStateFor('stable'), { interest_rate: 8 }, null, player);
  assert.ok(hike.state.output_gap < -2, `rate hike should contract, got ${hike.state.output_gap}`);

  const recession = initialStateFor('recession');
  const noQe = stepEconomy(recession, { interest_rate: 0 }, null, player);
  const qe   = stepEconomy(recession, { interest_rate: 0, qe_volume: 5 }, null, player);
  assert.ok(qe.state.output_gap > noQe.state.output_gap, 'QE works through the effective rate');
  assert.equal(qe.state.qe_volume, 5);
});

// ── Shocks ───────────────────────────────────────────────────────────────────

test('a supply shock is stagflationary: inflation up AND output down', () => {
  const prev = initialStateFor('stable');
  const { state, detail } = stepEconomy(prev, NEUTRAL, getShock('energy_crisis'), {});

  assert.ok(state.inflation > 2, `inflation ${state.inflation}`);
  assert.ok(state.output_gap < 0, `gap ${state.output_gap}`);
  assert.equal(state.shock.id, 'energy_crisis');
  assert.equal(detail.shock_effects.supply_inflation, 2);
});

// ── Internal consistency of the composed state ───────────────────────────────

test('state invariants hold for extreme policies', () => {
  const extreme = {
    gov_spending_change: 3, transfer_change: 2, tax_change: -3,
    green_investment: 2, labor_market_reform: 2, interest_rate: 10, qe_volume: 5,
  };
  const { state } = stepEconomy(initialStateFor('stable'), extreme, null, { central_bank: 'player' });

  for (const [key, value] of Object.entries(state)) {
    if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), `${key} must be finite, got ${value}`);
    }
  }
  assert.ok(state.output_gap <= 8 && state.output_gap >= -8);
  assert.ok(state.inflation <= 25 && state.inflation >= -3);
  assert.ok(state.debt_ratio >= 0 && state.debt_ratio <= 300);
  assert.ok(state.gini >= 0 && state.gini <= 1);
  assert.ok(state.unemployment >= 2 && state.unemployment <= 25);
});