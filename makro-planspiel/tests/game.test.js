// SPDX-License-Identifier: CC-BY-4.0
// Facade tests: createGame owns flow, validation, history — economics stays in engine/.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/index.js';

// ── Setup & configuration ────────────────────────────────────────────────────

test('createGame exposes setup, levers and the initial scenario state', () => {
  const game = createGame({ scenario: 'recession', rounds: 6 });
  const config = game.getConfig();
  assert.equal(config.scenario, 'recession');
  assert.equal(config.rounds, 6);
  assert.equal(config.central_bank, 'taylor');
  assert.ok(config.scenario_info.learning_focus.length > 0);

  const state = game.getState();
  assert.equal(state.round, 0);
  assert.equal(state.output_gap, -3);
  assert.equal(game.getCurrentRound(), 1);
  assert.equal(game.isFinished(), false);
});

test('lever availability follows the central-bank mode', () => {
  const taylor = createGame({ central_bank: 'taylor' });
  const keys = taylor.getLevers().map(l => l.key);
  assert.ok(!keys.includes('interest_rate'), 'no manual rate under an AI central bank');
  assert.ok(!keys.includes('qe_volume'));
  assert.ok(keys.includes('gov_spending_change'));

  const player = createGame({ central_bank: 'player' });
  const playerKeys = player.getLevers().map(l => l.key);
  assert.ok(playerKeys.includes('interest_rate'));
  assert.ok(playerKeys.includes('qe_volume'));
});

test('invalid game options are rejected', () => {
  assert.throws(() => createGame({ scenario: 'narnia' }), /Unknown scenario/);
  assert.throws(() => createGame({ rounds: 0 }), /rounds/);
  assert.throws(() => createGame({ central_bank: 'chaos' }), /central_bank/);
  assert.throws(() => createGame({ shocks: [{ round: 2, shock_id: 'meteor' }] }), /Unknown shock/);
});

// ── Policy staging & validation ──────────────────────────────────────────────

test('setPolicies validates, clamps and merges partial updates', () => {
  const game = createGame({});
  assert.throws(() => game.setPolicies({ vat_rate: 20 }), /Unknown policy lever/);
  assert.throws(() => game.setPolicies({ gov_spending_change: 'much' }), /finite number/);
  assert.throws(() => game.setPolicies({ interest_rate: 5 }), /not available/);

  game.setPolicies({ gov_spending_change: 99 }); // clamps to max 3
  game.setPolicies({ transfer_change: 1 });
  const pending = game.getPendingPolicies();
  assert.equal(pending.gov_spending_change, 3);
  assert.equal(pending.transfer_change, 1, 'partial updates merge');
});

// ── Round flow ───────────────────────────────────────────────────────────────

test('advanceRound applies decisions, returns feedback, resets impulse levers', () => {
  const game = createGame({ scenario: 'recession', rounds: 4 });
  game.setPolicies({ gov_spending_change: 2, labor_market_reform: 1 });
  const { state, feedback, objectives, shock } = game.advanceRound();

  assert.equal(state.round, 1);
  assert.equal(state.policies.gov_spending_change, 2);
  assert.ok(Array.isArray(feedback) && feedback.length >= 3);
  assert.ok(objectives.total > 0);
  assert.equal(shock, null);

  const pending = game.getPendingPolicies();
  assert.equal(pending.gov_spending_change, 0, 'impulse lever resets (a stimulus is a decision)');
  assert.equal(pending.labor_market_reform, 1, 'level lever persists as a stance');
});

test('player-run central bank: the set rate is applied (clamped to bounds)', () => {
  const game = createGame({ scenario: 'stable', central_bank: 'player' });
  game.setPolicies({ interest_rate: 6 });
  const { state } = game.advanceRound();
  assert.equal(state.policy_rate, 6);
  assert.ok(state.output_gap < 0, 'tight money cools demand');
});

test('history accumulates; the game ends after the configured rounds', () => {
  const game = createGame({ rounds: 2 });
  game.advanceRound();
  game.advanceRound();
  assert.equal(game.isFinished(), true);
  assert.throws(() => game.advanceRound(), /finished/);

  const history = game.getHistory();
  assert.equal(history.length, 2);
  assert.equal(history[0].round, 1);
  assert.ok(history[0].feedback.length > 0);
  assert.ok(history[1].objectives.score >= 0);
});

// ── Shocks through the facade ────────────────────────────────────────────────

test('scheduled shocks surface in state, feedback and peekShock', () => {
  const game = createGame({ rounds: 3, shocks: [{ round: 2, shock_id: 'energy_crisis' }] });
  assert.equal(game.peekShock(1), null);
  assert.equal(game.peekShock(2).id, 'energy_crisis');

  game.advanceRound();
  const { state, feedback, shock } = game.advanceRound();
  assert.equal(shock.id, 'energy_crisis');
  assert.equal(state.shock.id, 'energy_crisis');
  assert.ok(feedback.some(m => m.topic === 'shock'), 'explainer reports the shock');
});