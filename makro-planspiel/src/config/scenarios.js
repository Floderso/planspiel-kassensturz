// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Scenarios (starting economies)
//
// A scenario is a starting state plus an optional sequence of embedded shocks.
// Each one stages a different macroeconomic TRADE-OFF for students to discover.
// All states use the shared shape defined in DEFAULT_STATE — scenario entries
// only override what differs.
// ═══════════════════════════════════════════════════════════════════════════

import { TARGETS, GROWTH, FISCAL, MONETARY, HOUSEHOLDS } from './constants.js';

/**
 * Canonical state of the economy. `DEFAULT_STATE` is the steady state the
 * model is calibrated around: output gap 0, inflation on target, debt stable
 * (because the effective interest rate 2 % < nominal growth 4 %, Domar r−g).
 */
export const DEFAULT_STATE = {
  round: 0,                    // completed rounds; the NEXT decision is round 1
  output_gap: 0,               // % of potential GDP (+ overheating / − slack)
  gdp_index: 100,              // real GDP, index (base = start)
  potential_gdp_index: 100,    // potential output, index
  real_growth: GROWTH.trend_real * 100, // % real growth in the LAST completed round
  inflation: TARGETS.inflation,
  expected_inflation: TARGETS.inflation,
  policy_rate: 3,              // % nominal policy rate
  real_rate: MONETARY.neutral_real_rate,
  unemployment: TARGETS.natural_unemployment,
  natural_unemployment: TARGETS.natural_unemployment,
  revenue_ratio: FISCAL.base_revenue_ratio,     // % of GDP
  spending_ratio: FISCAL.base_spending_ratio,   // % of GDP (primary spending)
  primary_balance: 0,          // % of GDP (+ = surplus)
  deficit_ratio: 1.2,          // % of GDP (primary balance − interest burden)
  debt_ratio: TARGETS.debt_reference,
  interest_effective: FISCAL.interest_baseline, // decimal, on the debt stock
  risk_premium: 0,             // percentage points, markets vs. baseline rate
  credibility: 0.9,            // 0…1 — anchors inflation expectations
  qe_volume: 0,                // % of GDP purchased THIS round
  labor_market_reform: 0,      // structural stance level −2…+2
  green_investment: 0,         // % of GDP invested THIS round
  gini: 0.374,                 // market-income Gini (3-group Lorenz)
  income_shares: { ...HOUSEHOLDS.market_share },
  top_to_bottom_ratio: 7.5,    // avg income top 20 % / bottom 40 %
  emissions_index: 100,        // GHG emissions, index (base = start)
  fiscal_stance: { spending: 0, tax: 0, transfer: 0 }, // accumulated impulses (% GDP)
  policies: {},                // lever values applied in the LAST completed round
  shock: null,                 // shock active in the LAST completed round
};

export const SCENARIOS = [
  {
    id: 'stable',
    name: 'Steady waters',
    description:
      'The economy is at its potential, inflation is on target and debt is ' +
      'stable. The lesson: even "doing nothing" has consequences — every ' +
      'policy trade-off is yours to explore from a neutral start.',
    learning_focus: 'Baseline reading of indicators; discovering trade-offs from a neutral point.',
    initial_state: {},
  },
  {
    id: 'recession',
    name: 'The downturn',
    description:
      'A demand collapse has pushed the economy 3 % below potential. ' +
      'Unemployment is rising, inflation is drifting below target. ' +
      'Textbook case for expansionary policy — but how much, and which instrument?',
    learning_focus: 'Fiscal multiplier in slack economies; automatic stabilizers; zero-lower-bound risk.',
    initial_state: {
      output_gap: -3,
      real_growth: -1,
      inflation: 0.8,
      expected_inflation: 1.3,
      unemployment: 7.2,
      revenue_ratio: 39.1,      // automatic stabilizers already biting
      spending_ratio: 40.45,
      primary_balance: -1.35,
      deficit_ratio: 2.8,
      debt_ratio: 70,
      credibility: 0.75,
    },
  },
  {
    id: 'overheating',
    name: 'Boom and pressure',
    description:
      'The economy runs 2.5 % above potential. Inflation has climbed to 4.5 % ' +
      'and expectations are drifting. Stimulating further would feel good now ' +
      'and hurt later — the Phillips curve is watching.',
    learning_focus: 'Phillips curve trade-off; inflation expectations; the cost of disinflation.',
    initial_state: {
      output_gap: 2.5,
      real_growth: 4,
      inflation: 4.5,
      expected_inflation: 3.8,
      unemployment: 5,
      revenue_ratio: 40.75,
      spending_ratio: 40,
      primary_balance: 0.75,
      deficit_ratio: -0.35,
      debt_ratio: 55,
      credibility: 0.7,
    },
  },
  {
    id: 'stagflation',
    name: 'Stagflation trap',
    description:
      'An energy shock has broken the usual trade-off: inflation is at 5.5 % ' +
      'WHILE the economy sits 2 % below potential. Every instrument that fixes ' +
      'one problem worsens the other. The hardest exam in macro.',
    learning_focus: 'Supply shocks vs. demand management; credibility as an asset; instrument assignment.',
    initial_state: {
      output_gap: -2,
      real_growth: 0,
      inflation: 5.5,
      expected_inflation: 5,
      unemployment: 6.8,
      primary_balance: -1,
      deficit_ratio: 2.4,
      debt_ratio: 68,
      credibility: 0.4,
    },
    embedded_shocks: [
      { round: 1, shock_id: 'energy_crisis' },
      { round: 2, shock_id: 'energy_crisis' },
    ],
  },
  {
    id: 'debt_crisis',
    name: 'The debt overhang',
    description:
      'Debt stands at 110 % of GDP and bond markets demand a visible risk ' +
      'premium. Austerity depresses growth — and can raise the debt ratio ' +
      'through the denominator. Consolidate too fast or too slow: both lose.',
    learning_focus: 'Debt dynamics (r − g); self-defeating austerity; risk premium feedback loop.',
    initial_state: {
      output_gap: -0.5,
      real_growth: 1.5,
      inflation: 2.5,
      expected_inflation: 2.8,
      unemployment: 6.2,
      primary_balance: -0.5,
      deficit_ratio: 3.3,
      debt_ratio: 110,
      credibility: 0.55,
    },
  },
];

const SCENARIO_MAP = Object.fromEntries(SCENARIOS.map(s => [s.id, s]));

export function getScenario(id) {
  const scenario = SCENARIO_MAP[id];
  if (!scenario) {
    throw new Error(`Unknown scenario "${id}". Available: ${SCENARIOS.map(s => s.id).join(', ')}`);
  }
  return scenario;
}

/** Builds the full initial state for a scenario id (deep-copied). */
export function initialStateFor(id) {
  const scenario = getScenario(id);
  return {
    ...structuredClone(DEFAULT_STATE),
    ...structuredClone(scenario.initial_state),
  };
}