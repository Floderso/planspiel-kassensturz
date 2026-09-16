// SPDX-License-Identifier: CC-BY-4.0
// Multi-round path tests: determinism, shock timing, policy reuse, extremes.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { simulatePath } from '../src/engine/path.js';

const neutralSeq = n => Array.from({ length: n }, () => ({}));

// ── Determinism ──────────────────────────────────────────────────────────────

test('simulatePath is deterministic (identical inputs → identical series)', () => {
  const options = {
    scenario: 'recession',
    policy_sequence: [
      { gov_spending_change: 2 },
      { gov_spending_change: 1, transfer_change: 0.5 },
      {},
      { tax_change: 1 },
      {},
    ],
    shocks: [{ round: 3, shock_id: 'trade_war' }],
  };
  const a = simulatePath(options);
  const b = simulatePath(options);
  assert.deepEqual(a, b);
});

// ── Shock timing ─────────────────────────────────────────────────────────────

test('a scheduled shock hits only its own round', () => {
  const withShock = simulatePath({
    scenario: 'stable',
    policy_sequence: neutralSeq(4),
    shocks: [{ round: 2, shock_id: 'financial_crisis' }],
  });
  const without = simulatePath({ scenario: 'stable', policy_sequence: neutralSeq(4) });

  assert.equal(withShock.rounds[0].state.shock, null);
  assert.equal(withShock.rounds[1].state.shock.id, 'financial_crisis');
  assert.equal(withShock.rounds[2].state.shock, null);

  assert.ok(
    withShock.rounds[1].state.output_gap < without.rounds[1].state.output_gap,
    'demand collapse visible in the shock round'
  );
  assert.ok(withShock.rounds[1].state.risk_premium > 0, 'risk premium from the crisis');
});

// ── Embedded scenario shocks ─────────────────────────────────────────────────

test('stagflation scenario carries its embedded energy shock in rounds 1–2', () => {
  const { rounds } = simulatePath({ scenario: 'stagflation', policy_sequence: neutralSeq(3) });
  assert.equal(rounds[0].state.shock?.id, 'energy_crisis');
  assert.equal(rounds[1].state.shock?.id, 'energy_crisis');
  assert.equal(rounds[2].state.shock, null);
});

// ── Policy reuse ─────────────────────────────────────────────────────────────

test('omitted rounds reuse the previous (sanitized) policy package', () => {
  const { rounds } = simulatePath({
    scenario: 'stable',
    policy_sequence: [{ gov_spending_change: 1.5 }, null, undefined],
  });
  assert.equal(rounds[1].policies.gov_spending_change, 1.5);
  assert.equal(rounds[2].policies.gov_spending_change, 1.5);
});

// ── Validation ───────────────────────────────────────────────────────────────

test('invalid levers and unavailable monetary levers are rejected', () => {
  assert.throws(
    () => simulatePath({ scenario: 'stable', policy_sequence: [{ vat_rate: 20 }] }),
    /Unknown policy lever/
  );
  assert.throws(
    () => simulatePath({ scenario: 'stable', policy_sequence: [{ interest_rate: 5 }] }),
    /not available/, // taylor mode: no manual rate
  );
});

// ── Robustness over long horizons and extreme play ───────────────────────────

test('12 rounds of extreme, flip-flopping policies stay finite and bounded', () => {
  const wild = i => (i % 2 === 0
    ? { gov_spending_change: 3, tax_change: -3, transfer_change: 2, interest_rate: 0, qe_volume: 5, green_investment: 2 }
    : { gov_spending_change: -3, tax_change: 3, interest_rate: 10 });
  const { rounds } = simulatePath({
    scenario: 'overheating',
    policy_sequence: Array.from({ length: 12 }, (_, i) => wild(i)),
    config: { central_bank: 'player' },
  });

  for (const { state } of rounds) {
    for (const [key, value] of Object.entries(state)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${key} = ${value}`);
    }
    assert.ok(state.output_gap >= -8 && state.output_gap <= 8);
    assert.ok(state.inflation >= -3 && state.inflation <= 25);
    assert.ok(state.debt_ratio >= 0 && state.debt_ratio <= 300);
    assert.ok(state.unemployment >= 2 && state.unemployment <= 25);
    assert.ok(state.credibility >= 0.2 && state.credibility <= 1);
    assert.ok(state.gini >= 0 && state.gini <= 1);
  }
});

// ── Long-run teaching trajectories ───────────────────────────────────────────

test('recession: sustained stimulus recovers faster than doing nothing', () => {
  const seq = n => Array.from({ length: n }, () => ({ gov_spending_change: 1.5 }));
  const stimulated = simulatePath({ scenario: 'recession', policy_sequence: seq(4) });
  const passive    = simulatePath({ scenario: 'recession', policy_sequence: neutralSeq(4) });

  assert.ok(
    stimulated.rounds[2].state.unemployment < passive.rounds[2].state.unemployment,
    'Okun: jobs return faster with stimulus'
  );
  assert.ok(
    stimulated.rounds[2].state.debt_ratio > passive.rounds[2].state.debt_ratio - 1,
    'sanity: stimulus is not a free lunch in the long run'
  );
});