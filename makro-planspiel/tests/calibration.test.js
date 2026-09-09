// SPDX-License-Identifier: CC-BY-4.0
// Calibration tests: long-horizon plausibility of every scenario.
// These are the "does the model teach the right thing?" guardrails — they
// assert DIRECTIONS and RANGES a macro course would accept, not exact values.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { simulatePath } from '../src/engine/path.js';
import { SCENARIOS } from '../src/config/scenarios.js';

const neutralSeq = n => Array.from({ length: n }, () => ({}));

// ── Stable: the calibration anchor ───────────────────────────────────────────

test('stable scenario hovers at the steady state for 10 neutral rounds', () => {
  const { rounds } = simulatePath({ scenario: 'stable', policy_sequence: neutralSeq(10) });

  for (const { state } of rounds) {
    assert.ok(Math.abs(state.inflation - 2) < 0.3, `inflation ${state.inflation} in round ${state.round}`);
    assert.ok(Math.abs(state.unemployment - 6) < 0.3, `unemployment ${state.unemployment}`);
    assert.ok(Math.abs(state.output_gap) < 0.5, `gap ${state.output_gap}`);
    assert.ok(state.debt_ratio > 58 && state.debt_ratio < 62, `debt ${state.debt_ratio}`);
    assert.ok(state.credibility >= 0.9, 'staying on target keeps credibility high');
  }

  const last = rounds.at(-1).state;
  assert.ok(last.gdp_index > 120 && last.gdp_index < 123, `2 % trend growth compounds, got ${last.gdp_index}`);
  assert.ok(last.emissions_index > 104 && last.emissions_index < 106, `+0.5 %/yr emissions drift, got ${last.emissions_index}`);
});

// ── Recession: recovery paths ────────────────────────────────────────────────

test('recession: passive recovery is slow; stimulus accelerates it', () => {
  const passive = simulatePath({ scenario: 'recession', policy_sequence: neutralSeq(6) });
  const active  = simulatePath({
    scenario: 'recession',
    policy_sequence: Array.from({ length: 6 }, () => ({ gov_spending_change: 1.5 })),
  });

  // Passive: the Taylor central bank alone does close the gap eventually (ZLB)
  const passiveLast = passive.rounds.at(-1).state;
  assert.ok(passiveLast.unemployment < 7.2, 'some recovery even without action');

  // Active: strictly better labor market throughout the middle game
  for (let i = 0; i < 4; i++) {
    assert.ok(
      active.rounds[i].state.unemployment <= passive.rounds[i].state.unemployment + 1e-9,
      `round ${i + 1}: stimulus should not hurt employment`
    );
  }
  assert.ok(active.rounds[2].state.unemployment < passive.rounds[2].state.unemployment - 0.2);
});

// ── Overheating: the Taylor bank stabilizes ──────────────────────────────────

test('overheating: neutral play disinflates but costs output (sacrifice ratio)', () => {
  const { rounds } = simulatePath({ scenario: 'overheating', policy_sequence: neutralSeq(6) });
  const last = rounds.at(-1).state;

  assert.ok(last.inflation < rounds[0].state.inflation, 'disinflation happens');
  assert.ok(
    rounds.some(r => r.state.output_gap < 0),
    'disinflation requires a negative gap (Phillips trade-off is real)'
  );
  assert.ok(last.inflation < 4, 'but does not magically return to 2 % in six rounds');
});

// ── Stagflation: the trade-off from hell ─────────────────────────────────────

test('stagflation: demand stimulus worsens inflation; no free lunch', () => {
  const stimulus = simulatePath({
    scenario: 'stagflation',
    policy_sequence: Array.from({ length: 3 }, () => ({ gov_spending_change: 2 })),
  });
  const passive = simulatePath({ scenario: 'stagflation', policy_sequence: neutralSeq(3) });

  // Shock rounds: both paths suffer high inflation
  assert.ok(passive.rounds[0].state.inflation > 3);
  assert.ok(passive.rounds[0].state.output_gap < -1, 'AND slack — the defining dilemma');

  // Stimulus helps the gap but strictly worsens inflation in the shock rounds
  assert.ok(stimulus.rounds[1].state.output_gap > passive.rounds[1].state.output_gap);
  assert.ok(stimulus.rounds[1].state.inflation > passive.rounds[1].state.inflation);
});

// ── Debt crisis: consolidation trade-offs ────────────────────────────────────

test('debt crisis: doing nothing drifts upward; austerity trades growth for solvency', () => {
  const passive = simulatePath({ scenario: 'debt_crisis', policy_sequence: neutralSeq(5) });
  assert.ok(
    passive.rounds.at(-1).state.debt_ratio > passive.rounds[0].state.debt_ratio,
    'with a risk premium and a deficit, delay is punished'
  );
  assert.ok(passive.rounds[0].state.risk_premium > 0.5, 'markets are worried from the start');

  const austerity = simulatePath({
    scenario: 'debt_crisis',
    policy_sequence: Array.from({ length: 5 }, () => ({ tax_change: 1.5, gov_spending_change: -1.5 })),
  });
  assert.ok(
    austerity.rounds[0].state.primary_balance > passive.rounds[0].state.primary_balance,
    'austerity repairs the budget'
  );
  assert.ok(
    austerity.rounds[0].state.real_growth < passive.rounds[0].state.real_growth,
    '…but at a short-run growth cost (the denominator effect)'
  );
});

// ── Green transition ─────────────────────────────────────────────────────────

test('sustained green investment bends the emissions curve downward', () => {
  const green = simulatePath({
    scenario: 'stable',
    policy_sequence: Array.from({ length: 6 }, () => ({ green_investment: 1.5 })),
  });
  const emissionsPath = green.rounds.map(r => r.state.emissions_index);
  assert.ok(emissionsPath.at(-1) < emissionsPath[0], 'emissions fall with sustained investment');
  assert.ok(green.rounds.at(-1).state.debt_ratio > 60, 'financed by deficits — no free lunch');
});

// ── All scenarios: generic playability ───────────────────────────────────────

test('every scenario survives 6 neutral rounds with sane indicators', () => {
  for (const scenario of SCENARIOS) {
    const { rounds } = simulatePath({ scenario: scenario.id, policy_sequence: neutralSeq(6) });
    for (const { state } of rounds) {
      assert.ok(Number.isFinite(state.inflation), `${scenario.id}: inflation finite`);
      assert.ok(state.inflation > -3 && state.inflation < 25, `${scenario.id}: inflation ${state.inflation} in range`);
      assert.ok(state.unemployment >= 2 && state.unemployment <= 25, `${scenario.id}: unemployment in range`);
      assert.ok(state.debt_ratio >= 0 && state.debt_ratio <= 300, `${scenario.id}: debt in range`);
      assert.ok(state.gini >= 0 && state.gini <= 1, `${scenario.id}: gini in range`);
    }
  }
});