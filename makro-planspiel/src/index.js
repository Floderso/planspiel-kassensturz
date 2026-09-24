// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Public API (headless game facade)
//
// This is the ONLY entry point a UI (or a backend, or a test) needs:
//
//   import { createGame } from './src/index.js';
//   const game = createGame({ scenario: 'recession', rounds: 6 });
//   game.setPolicies({ gov_spending_change: 2 });
//   const { state, feedback, objectives } = game.advanceRound();
//
// The facade owns game flow (rounds, pending decisions, history); all
// economics live in engine/, all teaching logic in feedback/. Everything a
// future UI renders — lever definitions, state, feedback, objectives,
// history — is exposed as plain serializable data.
// ═══════════════════════════════════════════════════════════════════════════

import { initialStateFor, getScenario, SCENARIOS } from './config/scenarios.js';
import {
  POLICY_LEVERS, POLICY_DOMAINS, availableLevers, validatePolicies, defaultPolicies,
} from './config/policies.js';
import { SHOCKS, getShock } from './config/shocks.js';
import { stepEconomy } from './engine/economy.js';
import { simulatePath } from './engine/path.js';
import { explainRound } from './feedback/explainer.js';
import { evaluateObjectives, DEFAULT_OBJECTIVES } from './feedback/objectives.js';

/**
 * Creates a headless game.
 *
 * @param {object}   options
 * @param {string}   options.scenario      scenario id (default 'stable')
 * @param {number}   options.rounds        number of game rounds (default 6)
 * @param {string}   options.central_bank  'taylor' (independent AI central bank)
 *                                         | 'player' (students set the rate)
 * @param {Array}    options.shocks        instructor-scheduled shocks
 *                                         [{ round, shock_id }], 1-based
 * @param {Array}    options.objectives    objective set (default: magic polygon)
 */
export function createGame({
  scenario = 'stable',
  rounds = 6,
  central_bank = 'taylor',
  shocks = [],
  objectives = DEFAULT_OBJECTIVES,
} = {}) {
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
    throw new Error(`rounds must be an integer 1–20, got: ${rounds}`);
  }
  if (!['taylor', 'player'].includes(central_bank)) {
    throw new Error(`central_bank must be 'taylor' or 'player', got: "${central_bank}"`);
  }

  const config = { central_bank };
  const scenarioDef = getScenario(scenario);

  // Shocks may reference the library (shock_id) or carry an inline definition
  // (shock) — e.g. news-article effects injected by a UI (see ui/js/news.js).
  const resolveShock = s => {
    if (s.shock_id) return getShock(s.shock_id);
    const shock = s.shock;
    if (!shock || typeof shock.id !== 'string' || typeof shock.name !== 'string' || typeof shock.effects !== 'object') {
      throw new Error('Inline shocks must be { id: string, name: string, effects: object }');
    }
    return { description: '', ...shock };
  };
  const scheduledShocks = [
    ...(scenarioDef.embedded_shocks ?? []),
    ...shocks,
  ].map(s => {
    if (!Number.isInteger(s.round) || s.round < 1) {
      throw new Error(`Shock round must be a positive integer, got: ${s.round}`);
    }
    return { round: s.round, shock: resolveShock(s) };
  });

  let state = initialStateFor(scenario);
  let pending = defaultPolicies(config);
  const history = [];

  function shockForRound(round) {
    return scheduledShocks.find(s => s.round === round)?.shock ?? null;
  }

  return {
    /** Static game setup (serializable). */
    getConfig() {
      return {
        scenario, rounds, central_bank,
        scenario_info: { name: scenarioDef.name, description: scenarioDef.description, learning_focus: scenarioDef.learning_focus },
        objectives,
        scheduled_shocks: scheduledShocks.map(s => ({ round: s.round, shock_id: s.shock.id, name: s.shock.name })),
      };
    },

    /** Current economy state (deep copy, serializable). */
    getState() {
      return structuredClone(state);
    },

    /** Round the NEXT decision applies to (1-based). */
    getCurrentRound() {
      return state.round + 1;
    },

    isFinished() {
      return state.round >= rounds;
    },

    /** Lever definitions available in this game, with current pending values. */
    getLevers() {
      return availableLevers(config).map(lever => ({
        ...lever,
        domain_label: POLICY_DOMAINS[lever.domain].label,
        role: POLICY_DOMAINS[lever.domain].role,
        value: pending[lever.key] ?? lever.default,
      }));
    },

    /**
     * Stages policy decisions for the current round (partial updates allowed;
     * level levers persist, impulse levers reset each round — see advanceRound).
     * Throws on unknown/unavailable levers or non-numeric values.
     */
    setPolicies(policies) {
      const check = validatePolicies(policies, config);
      if (!check.ok) {
        throw new Error(`Invalid policies: ${check.errors.join('; ')}`);
      }
      pending = { ...pending, ...check.sanitized };
      return structuredClone(pending);
    },

    /** Pending decisions for the current round (what advanceRound would apply). */
    getPendingPolicies() {
      return structuredClone(pending);
    },

    /** Shock scheduled for a given round (or null). */
    peekShock(round) {
      const s = shockForRound(round ?? state.round + 1);
      return s ? { id: s.id, name: s.name, description: s.description } : null;
    },

    /**
     * Schedules an additional shock for a FUTURE round at runtime (e.g. an
     * event article whose effects become reality next round). Accepts a
     * library shock_id or an inline shock object.
     */
    addShock(round, shockOrId) {
      if (!Number.isInteger(round) || round <= state.round) {
        throw new Error(`addShock: round must be in the future (> ${state.round}), got: ${round}`);
      }
      const shock = typeof shockOrId === 'string'
        ? getShock(shockOrId)
        : resolveShock({ shock: shockOrId });
      scheduledShocks.push({ round, shock });
      return { round, shock: { id: shock.id, name: shock.name } };
    },

    /**
     * Applies the pending decisions and advances the economy by one round.
     * Impulse levers reset to their defaults afterwards (a stimulus is a
     * decision, not a permanent stance); level levers persist.
     *
     * @returns {{ state, feedback, objectives, shock }}
     */
    advanceRound() {
      if (this.isFinished()) {
        throw new Error(`Game is finished after ${rounds} rounds.`);
      }
      const prev = state;
      const round = prev.round + 1;
      const shock = shockForRound(round);

      const { state: next, detail } = stepEconomy(prev, pending, shock, config);
      state = next;

      const objectivesStatus = evaluateObjectives(next, prev, objectives);
      const feedback = explainRound(prev, next, detail, shock, objectivesStatus);

      history.push({
        round,
        policies: structuredClone(pending),
        state: structuredClone(next),
        feedback,
        objectives: objectivesStatus,
        shock: next.shock,
      });

      // Impulse levers are one-round decisions: reset to defaults for the next
      // round. Level levers (interest rate, labor reform) persist as a stance.
      pending = {
        ...defaultPolicies(config),
        ...Object.fromEntries(
          POLICY_LEVERS.filter(l => l.kind === 'level' && l.key in pending)
            .map(l => [l.key, pending[l.key]])
        ),
      };

      return {
        state: structuredClone(next),
        feedback,
        objectives: objectivesStatus,
        shock: next.shock,
      };
    },

    /** Full played history (array of round records). */
    getHistory() {
      return structuredClone(history);
    },
  };
}

// ── Re-exports: everything a UI or analysis tool needs ──────────────────────
export {
  // config data
  SCENARIOS, SHOCKS, POLICY_LEVERS, POLICY_DOMAINS, DEFAULT_OBJECTIVES,
  getScenario, getShock, availableLevers, validatePolicies, defaultPolicies,
  initialStateFor,
  // engine (pure functions — for tests, teacher tools, previews)
  stepEconomy, simulatePath,
  // feedback (pure functions)
  explainRound, evaluateObjectives,
};