// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Fiscal block (budget identity + debt dynamics)
//
//   revenue_ratio  = base + ΣΔTax + buoyancy × gap            [automatic
//                                                              stabilizers]
//   spending_ratio = base + Σ(ΔG + ΔTransfers + Green)
//                          − stabilizer × min(0, gap)
//   primary_balance = revenue_ratio − spending_ratio          [% of GDP]
//   interest_burden = debt × (r_base + risk_premium)
//   deficit_ratio   = interest_burden − primary_balance
//   debt_t = debt_{t−1} × (1 + r_eff − g_nominal) + deficit   [Domar 1944;
//                                                              Blanchard 2019]
//
// Teaching point: the debt ratio falls by itself when g > r (the "snowball
// effect" works for you) — austerity can even RAISE the ratio if it kills
// growth (the denominator effect).
// ═══════════════════════════════════════════════════════════════════════════

import { FISCAL, TARGETS } from '../config/constants.js';

const DEBT_MIN = 0;
const DEBT_MAX = 300;  // numerical safety

/**
 * Market risk premium on government debt (percentage points, as decimal-ready
 * pp value): rises beyond the debt risk threshold, and when central-bank
 * credibility crumbles (inflation risk gets priced into nominal bonds).
 */
export function computeRiskPremium(debt_ratio, credibility, shock_eff = {}) {
  const debt_premium =
    Math.max(0, debt_ratio - TARGETS.debt_risk_threshold) * FISCAL.risk_premium_per_debt_point;
  const credibility_premium =
    Math.max(0, 0.8 - credibility) * FISCAL.risk_premium_credibility;
  return debt_premium + credibility_premium + (shock_eff.risk_premium ?? 0);
}

/**
 * Budget ratios for the current round. Fiscal impulses ACCUMULATE into the
 * ratios (a spending raise stays in the budget until reversed); the cycle
 * moves them through the automatic stabilizers.
 */
export function computeBudget(prev, policies, output_gap) {
  const stance = {
    spending: prev.fiscal_stance.spending + (policies.gov_spending_change ?? 0)
            + (policies.transfer_change ?? 0) + (policies.green_investment ?? 0),
    tax:      prev.fiscal_stance.tax + (policies.tax_change ?? 0),
    transfer: prev.fiscal_stance.transfer + (policies.transfer_change ?? 0),
  };

  const clampRatio = r => Math.min(FISCAL.ratio_max, Math.max(FISCAL.ratio_min, r));

  // Automatic stabilizers: revenue falls in recessions (tax buoyancy),
  // spending rises (unemployment benefits) — the budget cushions the cycle
  // before any discretionary decision. [IMF Fiscal Monitor]
  const revenue_ratio = clampRatio(
    FISCAL.base_revenue_ratio + stance.tax + FISCAL.tax_buoyancy * output_gap
  );
  const spending_ratio = clampRatio(
    FISCAL.base_spending_ratio + stance.spending - FISCAL.spending_stabilizer * Math.min(0, output_gap)
  );

  const primary_balance = revenue_ratio - spending_ratio;
  return { fiscal_stance: stance, revenue_ratio, spending_ratio, primary_balance };
}

/**
 * Debt-dynamics update (Domar equation, linearized):
 *   debt_t = debt_{t−1} × (1 + r_eff − g_nominal) + deficit_ratio
 * with g_nominal ≈ real growth + inflation (both in decimals here).
 *
 * @param {number} debt_ratio      previous debt ratio (% GDP)
 * @param {number} deficit_ratio   total deficit this round (% GDP)
 * @param {number} interest_eff    effective interest on the stock (decimal)
 * @param {number} nominal_growth  nominal GDP growth (decimal)
 */
export function updateDebt(debt_ratio, deficit_ratio, interest_eff, nominal_growth) {
  const debt = debt_ratio * (1 + interest_eff - nominal_growth) + deficit_ratio;
  return Math.min(DEBT_MAX, Math.max(DEBT_MIN, debt));
}

/** Full fiscal update for one round; returns all budget fields for the state. */
export function computeFiscal(prev, policies, output_gap, credibility, nominal_growth, shock_eff = {}) {
  const budget = computeBudget(prev, policies, output_gap);
  const risk_premium = computeRiskPremium(prev.debt_ratio, credibility, shock_eff);
  const interest_effective = FISCAL.interest_baseline + risk_premium / 100;
  const interest_burden = prev.debt_ratio * interest_effective; // % of GDP
  const deficit_ratio = interest_burden - budget.primary_balance;
  const debt_ratio = updateDebt(prev.debt_ratio, deficit_ratio, interest_effective, nominal_growth);

  return {
    ...budget,
    risk_premium,
    interest_effective,
    deficit_ratio,
    debt_ratio,
  };
}