// SPDX-License-Identifier: CC-BY-4.0
// Unit tests: one test per engine block and its teaching-relevant signs.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { spendingMultiplier, fiscalImpulse, monetaryImpulse } from '../src/engine/demand.js';
import { taylorRate, updateCredibility } from '../src/engine/monetary.js';
import { computeInflation, updateExpectations } from '../src/engine/inflation.js';
import { nairuTarget, updateNairu, computeUnemployment } from '../src/engine/labor.js';
import { computeBudget, updateDebt, computeRiskPremium } from '../src/engine/fiscal.js';
import { giniFromShares, computeHouseholds } from '../src/engine/households.js';
import { computeEmissions } from '../src/engine/environment.js';
import { DEMAND, FISCAL, HOUSEHOLDS } from '../src/config/constants.js';

// ── Demand ───────────────────────────────────────────────────────────────────

test('multiplier is state-dependent: larger in slack than at capacity', () => {
  assert.ok(spendingMultiplier(-3) > spendingMultiplier(3));
  assert.equal(spendingMultiplier(-3), DEMAND.multiplier_spending_slack);
  assert.equal(spendingMultiplier(3), DEMAND.multiplier_spending_capacity);
});

test('Haavelmo: spending impulse beats an equal tax impulse', () => {
  const gap = -2;
  const spend = fiscalImpulse({ gov_spending_change: 1 }, gap).total;
  const tax   = fiscalImpulse({ tax_change: -1 }, gap).total; // tax CUT of 1
  assert.ok(spend > tax, `spending effect ${spend} should exceed tax effect ${tax}`);
});

test('fiscal impulse: stimulus positive, consolidation negative, transfers MPC-weighted', () => {
  assert.ok(fiscalImpulse({ gov_spending_change: 2 }, 0).total > 0);
  assert.ok(fiscalImpulse({ gov_spending_change: -2 }, 0).total < 0);
  const transfer = fiscalImpulse({ transfer_change: 1 }, 0);
  assert.equal(transfer.transfer_push, DEMAND.multiplier_spending_capacity * DEMAND.multiplier_transfer_mpc);
});

test('monetary impulse: restrictive above neutral, stimulative below', () => {
  assert.ok(monetaryImpulse(3) < 0);   // real rate 3 > r* 1
  assert.ok(monetaryImpulse(-1) > 0);  // real rate −1 < r*
  assert.ok(Math.abs(monetaryImpulse(1)) < 1e-12); // at r*: neutral
});

// ── Monetary ─────────────────────────────────────────────────────────────────

test('Taylor rule: baseline 3 %, tighter in overheating, ZLB in deep recession', () => {
  assert.equal(taylorRate({ inflation: 2, output_gap: 0 }), 3);
  assert.ok(taylorRate({ inflation: 4.5, output_gap: 2.5 }) > 6);
  assert.equal(taylorRate({ inflation: 0.8, output_gap: -3 }), 0); // clamped at ZLB
});

test('credibility: gained inside the band, lost outside, bounded', () => {
  const stance = { mode: 'taylor', policy_rate: 3, taylor_benchmark: 3, qe_volume: 0 };
  assert.ok(updateCredibility(0.9, { inflation: 2, stance }) > 0.9);
  assert.ok(updateCredibility(0.9, { inflation: 6, stance }) < 0.9);
  assert.equal(updateCredibility(1, { inflation: 2, stance }), 1);   // cap
  assert.equal(updateCredibility(0.2, { inflation: 20, stance }), 0.2); // floor
});

test('credibility: player central bank punished for big Taylor deviations', () => {
  const base = updateCredibility(0.9, { inflation: 2.5, stance: { mode: 'player', policy_rate: 3, taylor_benchmark: 3, qe_volume: 0 } });
  const deviant = updateCredibility(0.9, { inflation: 2.5, stance: { mode: 'player', policy_rate: 9, taylor_benchmark: 3, qe_volume: 0 } });
  assert.ok(deviant < base);
});

// ── Inflation ────────────────────────────────────────────────────────────────

test('Phillips curve: positive gap raises inflation, supply shock adds directly', () => {
  assert.ok(computeInflation(2, 2) > computeInflation(2, -2));
  assert.equal(computeInflation(2, 0, { supply_inflation: 2 }), 4);
});

test('expectations: high credibility anchors, low credibility de-anchors', () => {
  const anchored = updateExpectations(2, 5, 1.0);
  const drifting = updateExpectations(2, 5, 0.2);
  assert.ok(drifting > anchored, 'low credibility must move expectations more');
  assert.ok(anchored < 3);
});

// ── Labor ────────────────────────────────────────────────────────────────────

test('Okun: positive gap lowers unemployment', () => {
  assert.ok(computeUnemployment(6, 2) < 6);
  assert.ok(computeUnemployment(6, -2) > 6);
});

test('structural reform shifts the NAIRU target; NAIRU drifts gradually', () => {
  assert.equal(nairuTarget(2), 5);
  assert.equal(nairuTarget(-2), 7);
  const next = updateNairu(6, 2);
  assert.ok(next < 6 && next > 5, `expected gradual move, got ${next}`);
});

// ── Fiscal ───────────────────────────────────────────────────────────────────

test('budget: impulses accumulate into ratios; stabilizers cushion a recession', () => {
  const prev = { fiscal_stance: { spending: 0, tax: 0, transfer: 0 } };
  const boom = computeBudget(prev, { gov_spending_change: 1, tax_change: 1 }, 2);
  assert.equal(boom.revenue_ratio, 40 + 1 + 0.3 * 2);
  assert.equal(boom.spending_ratio, 40 + 1);

  const recession = computeBudget(prev, {}, -2);
  assert.ok(recession.revenue_ratio < 40, 'tax buoyancy');
  assert.ok(recession.spending_ratio > 40, 'automatic spending stabilizer');
});

test('Domar: debt stable at the calibrated fixed point, rises with deficits', () => {
  const stable = updateDebt(60, FISCAL.interest_baseline * 60, FISCAL.interest_baseline, 0.04);
  assert.ok(Math.abs(stable - 60) < 1e-9, `fixed point, got ${stable}`);
  assert.ok(updateDebt(60, 5, 0.02, 0.04) > 60);
  assert.ok(updateDebt(60, 0, 0.02, 0.06) < 60, 'g > r shrinks the ratio');
});

test('risk premium: zero at safe debt, rises beyond threshold and with low credibility', () => {
  assert.equal(computeRiskPremium(60, 0.9), 0);
  assert.ok(computeRiskPremium(120, 0.9) > 0);
  assert.ok(computeRiskPremium(60, 0.3) > 0);
});

// ── Households ───────────────────────────────────────────────────────────────

test('gini: perfect equality → 0; baseline shares ≈ 0.374; more spread → higher', () => {
  assert.ok(Math.abs(giniFromShares({ bottom40: 0.4, middle40: 0.4, top20: 0.2 }) - 0) < 1e-9);
  const base = giniFromShares(HOUSEHOLDS.market_share);
  assert.ok(Math.abs(base - 0.374) < 0.005, `baseline gini, got ${base}`);
  const spread = giniFromShares({ bottom40: 0.06, middle40: 0.40, top20: 0.54 });
  assert.ok(spread > base);
});

test('transfers reduce inequality; a recession raises it (cyclical sensitivity)', () => {
  const neutral = computeHouseholds({ spending: 0, tax: 0, transfer: 0 }, 0);
  const transfers = computeHouseholds({ spending: 1, tax: 0, transfer: 1 }, 0);
  assert.ok(transfers.gini < neutral.gini);

  const recession = computeHouseholds({ spending: 0, tax: 0, transfer: 0 }, -3);
  assert.ok(recession.gini > neutral.gini, 'low incomes hurt first in a downturn');
});

// ── Environment ──────────────────────────────────────────────────────────────

test('emissions: baseline drifts up with growth; enough green investment turns the sign', () => {
  assert.ok(computeEmissions(100, 0.02, 0) > 100, 'doing nothing is not neutral');
  assert.ok(computeEmissions(100, 0.02, 2) < 100, 'green investment decarbonizes');
});