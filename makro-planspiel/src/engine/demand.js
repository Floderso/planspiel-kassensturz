// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Aggregate demand block (IS curve)
//
// Computes the output gap of the current round from three impulses plus
// momentum:
//
//   gap_t = persistence × gap_{t−1}
//         + μ_G(slack) × (ΔG + ΔTransfers×MPC + GreenInv)   [fiscal impulse]
//         − μ_T × ΔT                                        [tax drag]
//         − β × (r_eff − r*)                                [monetary stance]
//         + shock_demand                                    [exogenous]
//
// The spending multiplier is STATE-DEPENDENT: larger with economic slack,
// smaller at full capacity (Auerbach & Gorodnichenko 2012; Gechert & Ramey
// 2018). The tax multiplier is smaller than the spending multiplier
// (Haavelmo's balanced-budget theorem: households fund taxes partly from
// savings). Transfer impulses are weighted by recipients' MPC (HANK).
// ═══════════════════════════════════════════════════════════════════════════

import { DEMAND, MONETARY } from '../config/constants.js';

/** State-dependent government-spending multiplier. */
export function spendingMultiplier(output_gap) {
  return output_gap < 0
    ? DEMAND.multiplier_spending_slack
    : DEMAND.multiplier_spending_capacity;
}

/**
 * The fiscal impulse of THIS round's policy package, in multiplier-weighted
 * % of GDP. Only FRESH impulses move demand — a permanently higher spending
 * level is already reflected in the previous gap (Keynesian impulse logic).
 */
export function fiscalImpulse(policies, output_gap) {
  const mu_g = spendingMultiplier(output_gap);
  const spending_push = mu_g * ((policies.gov_spending_change ?? 0) + (policies.green_investment ?? 0));
  const transfer_push = mu_g * DEMAND.multiplier_transfer_mpc * (policies.transfer_change ?? 0);
  const tax_drag      = DEMAND.multiplier_tax * (policies.tax_change ?? 0);
  return {
    multiplier: mu_g,
    spending_push,
    transfer_push,
    tax_drag,
    total: spending_push + transfer_push - tax_drag,
  };
}

/** The monetary contribution to demand: deviation of the real effective rate from r*. */
export function monetaryImpulse(real_rate_effective) {
  return -DEMAND.interest_sensitivity * (real_rate_effective - MONETARY.neutral_real_rate);
}

/**
 * Output gap of the current round (% of potential GDP), clamped for stability.
 *
 * @param {object} prev       previous economy state
 * @param {object} policies   validated policy package
 * @param {object} stance     monetary stance from resolveMonetaryStance()
 * @param {object} shock_eff  shock effects for this round ({ demand, … })
 */
export function computeOutputGap(prev, policies, stance, shock_eff = {}) {
  const fiscal   = fiscalImpulse(policies, prev.output_gap);
  const monetary = monetaryImpulse(stance.real_rate_effective);
  const momentum = DEMAND.persistence * prev.output_gap;
  const external = shock_eff.demand ?? 0;

  const output_gap = momentum + fiscal.total + monetary + external;
  return {
    output_gap: Math.min(DEMAND.gap_max, Math.max(DEMAND.gap_min, output_gap)),
    drivers: {
      momentum,
      fiscal_total: fiscal.total,
      fiscal_detail: fiscal,
      monetary,
      external,
    },
  };
}