// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Households block (income distribution, three groups)
//
// The population consists of three groups — bottom 40 %, middle 40 %, top
// 20 %. Each group's DISPOSABLE income share of GDP is computed as:
//
//   disposable_i = market_share_i × (1 + sens_i × gap/100)   [cyclicality]
//                − ΔTax_cum   × incidence_i / 100            [tax burden]
//                + ΔTransf_cum × transfer_share_i / 100      [transfers]
//
// All in % of GDP — legible rule: 1 % GDP of transfers with a 60 % bottom
// share raises the bottom group's income by 0.6/12 = 5 % of its market base.
//
// Inequality metrics:
//   • Gini from the exact 3-point Lorenz curve (trapezoid rule)
//   • top/bottom income ratio (avg income top 20 % ÷ bottom 40 %)
//
// Teaching point: recessions are regressive (low incomes have the highest
// cyclical sensitivity); transfers redistribute fast, tax changes slowly —
// and every instrument has a distributional side effect, intended or not.
// ═══════════════════════════════════════════════════════════════════════════

import { HOUSEHOLDS } from '../config/constants.js';

/** Gini coefficient from a 3-group Lorenz curve (trapezoid rule), shares need not be normalized. */
export function giniFromShares(shares, population = HOUSEHOLDS.population_share) {
  const groups = HOUSEHOLDS.groups;
  const total = groups.reduce((sum, g) => sum + shares[g], 0);
  if (total <= 0) return 0;
  let cumulative = 0;
  let area = 0;
  for (const g of groups) {  // groups are ordered low → high income
    const income_share = shares[g] / total;
    area += population[g] * (cumulative + (cumulative + income_share)) / 2;
    cumulative += income_share;
  }
  return Math.min(1, Math.max(0, 1 - 2 * area));
}

/**
 * Disposable income distribution for the current round.
 *
 * @param {object} fiscal_stance  accumulated fiscal impulses AFTER this round
 *                                ({ spending, tax, transfer } in % of GDP)
 * @param {number} output_gap     current output gap (pp)
 * @returns {{ income_shares, gini, top_to_bottom_ratio }}
 */
export function computeHouseholds(fiscal_stance, output_gap) {
  const { market_share, cycle_sensitivity, tax_incidence, transfer_share, population_share } = HOUSEHOLDS;
  const { tax: tax_cum, transfer: transfer_cum } = fiscal_stance;

  const raw = {};
  for (const g of HOUSEHOLDS.groups) {
    const cyclical = market_share[g] * (1 + (cycle_sensitivity[g] * output_gap) / 100);
    const burden   = (tax_cum * tax_incidence[g]) / 100;
    const benefit  = (transfer_cum * transfer_share[g]) / 100;
    // Numerical floor (1 % of GDP): keeps shares positive for the Lorenz curve
    // even under extreme tax/transfer experiments — economically irrelevant,
    // because the bottom group's baseline alone is 12 % of GDP.
    raw[g] = Math.max(0.01, cyclical - burden + benefit);
  }

  const total = raw.bottom40 + raw.middle40 + raw.top20;
  const income_shares = Object.fromEntries(
    HOUSEHOLDS.groups.map(g => [g, raw[g] / total])
  );

  const avg = g => income_shares[g] / population_share[g];
  return {
    income_shares,
    gini: giniFromShares(income_shares),
    top_to_bottom_ratio: avg('top20') / avg('bottom40'),
  };
}