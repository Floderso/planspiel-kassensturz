// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Multi-round simulation path
//
// simulatePath() runs a sequence of policy packages through stepEconomy and
// returns the full time series — the engine room for the game facade
// (src/index.js), for tests, and for future teacher-side analysis tools.
// Pure and deterministic: no clocks, no randomness, no globals.
// ═══════════════════════════════════════════════════════════════════════════

import { stepEconomy } from './economy.js';
import { initialStateFor, SCENARIOS } from '../config/scenarios.js';
import { getShock } from '../config/shocks.js';
import { validatePolicies } from '../config/policies.js';

/**
 * Simulates a full game path.
 *
 * @param {object}   options
 * @param {string}   options.scenario       scenario id (config/scenarios.js)
 * @param {object[]} options.policy_sequence policy package per round; missing
 *                                          rounds reuse the previous package
 * @param {Array}    options.shocks         [{ round, shock_id }] — 1-based rounds
 * @param {object}   options.config         { central_bank: 'taylor' | 'player' }
 * @returns {{ initial, rounds }} initial state + one entry per round:
 *          { state, detail, policies, shock }
 */
export function simulatePath({ scenario = 'stable', policy_sequence = [], shocks = [], config = {} } = {}) {
  const scenarioDef = initialStateFor(scenario);
  const embedded = SCENARIOS.find(s => s.id === scenario)?.embedded_shocks ?? [];
  const allShocks = [...embedded, ...shocks];

  let state = scenarioDef;
  let lastPolicies = {};
  const rounds = [];

  for (let roundIdx = 0; roundIdx < policy_sequence.length; roundIdx++) {
    const round = roundIdx + 1;
    const rawPolicies = policy_sequence[roundIdx] ?? lastPolicies;

    const check = validatePolicies(rawPolicies, config);
    if (!check.ok) {
      throw new Error(`Invalid policies for round ${round}: ${check.errors.join('; ')}`);
    }
    lastPolicies = check.sanitized;

    const shockEntry = allShocks.find(s => s.round === round);
    const shock = shockEntry ? getShock(shockEntry.shock_id) : null;

    const step = stepEconomy(state, check.sanitized, shock, config);
    rounds.push({ state: step.state, detail: step.detail, policies: check.sanitized, shock });
    state = step.state;
  }

  return { initial: scenarioDef, rounds };
}
