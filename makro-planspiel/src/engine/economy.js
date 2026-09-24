// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Economy composer — advances the economy by ONE round
//
// Wiring order (each arrow is a documented causal channel):
//
//   1. monetary   rate/Taylor rule → real effective rate        [monetary.js]
//   2. demand     fiscal impulse + monetary stance + momentum   [demand.js]
//                   → output gap
//   3. inflation  gap + expectations + supply shock             [inflation.js]
//   4. labor      gap → unemployment; reform → NAIRU            [labor.js]
//   5. growth     potential + Δgap → real growth; indices
//   6. fiscal     ratios + stabilizers → deficit → debt         [fiscal.js]
//   7. households stance + gap → group incomes → Gini           [households.js]
//   8. emissions  growth + green investment                     [environment.js]
//   9. credibility inflation + rate conduct                     [monetary.js]
//
// The function is PURE: same (state, policies, shock, config) → same result.
// ═══════════════════════════════════════════════════════════════════════════

import { GROWTH, LABOR } from '../config/constants.js';
import { resolveMonetaryStance, updateCredibility } from './monetary.js';
import { computeOutputGap } from './demand.js';
import { computeInflation, updateExpectations } from './inflation.js';
import { updateNairu, computeUnemployment } from './labor.js';
import { computeFiscal } from './fiscal.js';
import { computeHouseholds } from './households.js';
import { computeEmissions } from './environment.js';

/**
 * Advances the economy by one round (one year).
 *
 * @param {object} prev       economy state (see config/scenarios.js DEFAULT_STATE)
 * @param {object} policies   validated policy package for this round
 * @param {object|null} shock shock definition from config/shocks.js (or null)
 * @param {object} config     { central_bank: 'taylor' | 'player' }
 * @returns {{ state, detail }} next state + per-block internals (for feedback/UI)
 */
export function stepEconomy(prev, policies, shock = null, config = {}) {
  const shock_eff = shock?.effects ?? {};

  // ── 1. Monetary stance ────────────────────────────────────────────────────
  const stance = resolveMonetaryStance(prev, policies, config);

  // ── 2. Aggregate demand → output gap ──────────────────────────────────────
  const demand = computeOutputGap(prev, policies, stance, shock_eff);
  const output_gap = demand.output_gap;

  // ── 3. Inflation (Phillips curve with supply shifts) ──────────────────────
  const inflation = computeInflation(prev.expected_inflation, output_gap, shock_eff);

  // ── 4. Labor market ───────────────────────────────────────────────────────
  const labor_market_reform = policies.labor_market_reform ?? prev.labor_market_reform;
  const natural_unemployment = updateNairu(prev.natural_unemployment, labor_market_reform, shock_eff);
  const unemployment = computeUnemployment(natural_unemployment, output_gap);

  // ── 5. Growth: potential path + cyclical deviation ────────────────────────
  // Real growth = potential growth + the CHANGE in the output gap
  // (closing a −3 % gap by 2 pp adds 2 pp of cyclical growth on top of trend).
  const potential_growth =
    GROWTH.trend_real +
    LABOR.reform_potential_bonus * labor_market_reform +
    (shock_eff.potential_bonus ?? 0) / 100;
  const real_growth_dec = potential_growth + (output_gap - prev.output_gap) / 100;
  const gdp_index = prev.gdp_index * (1 + real_growth_dec);
  const potential_gdp_index = prev.potential_gdp_index * (1 + potential_growth);

  // ── 6. Public finances (uses new gap for stabilizers; nominal growth for debt)
  const nominal_growth = real_growth_dec + inflation / 100;
  const fiscal = computeFiscal(prev, policies, output_gap, prev.credibility, nominal_growth, shock_eff);

  // ── 7. Households / distribution ──────────────────────────────────────────
  const households = computeHouseholds(fiscal.fiscal_stance, output_gap);

  // ── 8. Emissions ──────────────────────────────────────────────────────────
  const emissions_index = computeEmissions(
    prev.emissions_index, real_growth_dec, policies.green_investment ?? 0
  );

  // ── 9. Credibility & expectations (after outcomes are known) ──────────────
  const credibility = updateCredibility(prev.credibility, { inflation, stance });
  const expected_inflation = updateExpectations(prev.expected_inflation, inflation, credibility);

  const state = {
    round: prev.round + 1,
    output_gap,
    gdp_index,
    potential_gdp_index,
    real_growth: real_growth_dec * 100,
    inflation,
    expected_inflation,
    policy_rate: stance.policy_rate,
    real_rate: stance.real_rate,
    unemployment,
    natural_unemployment,
    revenue_ratio: fiscal.revenue_ratio,
    spending_ratio: fiscal.spending_ratio,
    primary_balance: fiscal.primary_balance,
    deficit_ratio: fiscal.deficit_ratio,
    debt_ratio: fiscal.debt_ratio,
    interest_effective: fiscal.interest_effective,
    risk_premium: fiscal.risk_premium,
    credibility,
    qe_volume: stance.qe_volume,
    labor_market_reform,
    green_investment: policies.green_investment ?? 0,
    gini: households.gini,
    income_shares: households.income_shares,
    top_to_bottom_ratio: households.top_to_bottom_ratio,
    emissions_index,
    fiscal_stance: fiscal.fiscal_stance,
    policies: { ...policies },
    shock: shock ? { id: shock.id, name: shock.name, description: shock.description } : null,
  };

  // Internals for the feedback engine and a future UI's "why?" views.
  const detail = {
    stance,
    demand_drivers: demand.drivers,
    potential_growth: potential_growth * 100,
    nominal_growth: nominal_growth * 100,
    shock_effects: shock_eff,
  };

  return { state, detail };
}