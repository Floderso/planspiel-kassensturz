// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Monetary policy block
//
// Responsibilities:
//   • resolve the policy rate — set by players OR by an independent central
//     bank following a Taylor rule
//   • convert nominal → real → effective rate (incl. QE)
//   • update central-bank credibility (anchors expectations in inflation.js)
//
// Formulas (see docs/MODEL.md):
//   Taylor:        i = r* + π + w_π·(π − π*) + w_y·gap        [Taylor 1993]
//   Real rate:     r = i − π^e                                 [Fisher]
//   QE effect:     qe_eff = min(cap, qe_rate_effect × volume)  [portfolio balance]
//   Effective:     r_eff = r − qe_eff
// ═══════════════════════════════════════════════════════════════════════════

import { MONETARY, TARGETS, INFLATION } from '../config/constants.js';

/**
 * Taylor rule: the interest rate an independent, inflation-targeting central
 * bank would choose given OBSERVED (previous round) inflation and output gap.
 */
export function taylorRate({ inflation, output_gap }) {
  const rate =
    MONETARY.neutral_real_rate +
    inflation +
    MONETARY.taylor_inflation_weight * (inflation - TARGETS.inflation) +
    MONETARY.taylor_gap_weight * output_gap;
  return clampRate(rate);
}

export function clampRate(rate) {
  return Math.min(MONETARY.rate_max, Math.max(MONETARY.rate_min, rate));
}

/**
 * Resolves the monetary stance for the current round.
 *
 * @param {object} prev      previous economy state
 * @param {object} policies  validated policy package for this round
 * @param {object} config    { central_bank: 'taylor' | 'player' }
 * @returns stance incl. rate source and Taylor benchmark (for credibility & UI)
 */
export function resolveMonetaryStance(prev, policies, config = {}) {
  const mode = config.central_bank ?? 'taylor';
  const taylor_benchmark = taylorRate({
    inflation: prev.inflation,
    output_gap: prev.output_gap,
  });

  const policy_rate = mode === 'player'
    ? clampRate(policies.interest_rate ?? prev.policy_rate)
    : taylor_benchmark;

  // Fisher equation: what matters for demand is the REAL rate
  const real_rate = policy_rate - prev.expected_inflation;

  // QE lowers the EFFECTIVE rate even when the policy rate is stuck at the ZLB
  const qe_volume = mode === 'player' ? Math.max(0, policies.qe_volume ?? 0) : 0;
  const qe_effect = Math.min(MONETARY.qe_max_effect, MONETARY.qe_rate_effect * qe_volume);
  const real_rate_effective = real_rate - qe_effect;

  return {
    mode,
    policy_rate,
    real_rate,
    real_rate_effective,
    qe_volume,
    qe_effect,
    taylor_benchmark,
  };
}

/**
 * Updates central-bank credibility (0…1) after the round's outcomes are known.
 * Credibility is the stock of trust that keeps inflation expectations anchored:
 *  • gained slowly when inflation lands inside the target band
 *  • lost faster the further inflation strays from target
 *  • lost when a player-run central bank deviates strongly from its own rule
 *  • lost when QE is used while inflation is already above the band
 */
export function updateCredibility(prev_credibility, { inflation, stance }) {
  let credibility = prev_credibility;
  const deviation = Math.abs(inflation - TARGETS.inflation);

  if (deviation <= TARGETS.inflation_band) {
    credibility += INFLATION.credibility_gain;
  } else {
    credibility -= INFLATION.credibility_loss_rate * Math.min(1, deviation / 4);
  }

  if (stance.mode === 'player') {
    if (Math.abs(stance.policy_rate - stance.taylor_benchmark) > 2) {
      credibility -= INFLATION.taylor_deviation_cost;
    }
    if (stance.qe_volume > 0 && inflation > TARGETS.inflation + TARGETS.inflation_band) {
      credibility -= INFLATION.qe_credibility_cost;
    }
  }

  return Math.min(INFLATION.credibility_max, Math.max(INFLATION.credibility_min, credibility));
}