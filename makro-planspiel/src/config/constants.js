// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Model constants ("Econland" calibration)
//
// All values are textbook-typical for an advanced economy — deliberately NOT
// calibrated to a specific country. Every constant documents its teaching
// rationale and a literature source. Values are annual (1 round = 1 year).
// ═══════════════════════════════════════════════════════════════════════════

// ── Policy targets & reference values ────────────────────────────────────────
export const TARGETS = {
  inflation: 2.0,          // % — central-bank point target (ECB/Fed convention)
  inflation_band: 1.0,     // ±pp around target counted as "on target"
  natural_unemployment: 6.0, // % — NAIRU baseline (OECD-typical 5–7 %)
  debt_reference: 60,      // % of GDP — Maastricht-style reference value
  debt_risk_threshold: 90, // % of GDP — beyond this, markets charge a risk premium
};

// ── Long-run growth ──────────────────────────────────────────────────────────
export const GROWTH = {
  trend_real: 0.02,              // potential output growth p.a. (productivity + labor force)
  efficiency_improvement: 0.015, // autonomous decline of emissions per unit GDP p.a. (decoupling trend)
};

// ── Aggregate demand (IS block) ──────────────────────────────────────────────
// Sources: Gechert & Ramey (2018) multiplier meta-analysis; Blanchard (2021)
// macro textbook; Auerbach & Gorodnichenko (2012) state-dependent multipliers.
export const DEMAND = {
  persistence: 0.4,                  // output-gap momentum (habit formation, adjustment costs)
  multiplier_spending_slack: 1.2,    // fiscal multiplier with economic slack (downturns: ~1–1.5)
  multiplier_spending_capacity: 0.7, // fiscal multiplier near capacity (crowding out, price absorption)
  multiplier_tax: 0.5,               // tax multiplier < spending multiplier (Haavelmo theorem)
  multiplier_transfer_mpc: 0.8,      // transfer impulse × MPC of recipient households (HANK)
  interest_sensitivity: 0.6,         // pp output gap per pp real-rate gap (IS-curve slope)
  gap_min: -8,                       // numerical safety clamps (% potential GDP)
  gap_max: 8,
};

// ── Inflation (expectations-augmented Phillips curve) ────────────────────────
// Sources: Phillips (1958); Friedman (1968); Blanchard (2016) on anchored
// expectations; Ball & Mazumder on slope estimates.
export const INFLATION = {
  phillips_slope: 0.5,          // pp inflation per pp output gap (textbook 0.3–0.7)
  expectation_adaptation: 0.4,  // adaptive-expectations speed at zero credibility
  credibility_max: 1.0,
  credibility_min: 0.2,
  credibility_gain: 0.05,       // per round with inflation inside the target band
  credibility_loss_rate: 0.1,   // × min(1, |π − target| / 4) per round outside the band
  taylor_deviation_cost: 0.05,  // manual rate deviating > 2 pp from the Taylor rule
  qe_credibility_cost: 0.05,    // QE while inflation is above the target band
};

// ── Labor market (Okun's law + NAIRU) ────────────────────────────────────────
// Sources: Okun (1962); Ball/Leigh/Loungani (2017) Okun re-estimates (0.3–0.5).
export const LABOR = {
  okun_coefficient: 0.4,        // 1 pp output gap → 0.4 pp less unemployment
  nairu_drift: 0.25,            // annual convergence speed of NAIRU to its structural target
  reform_nairu_effect: 0.5,     // pp NAIRU per labor-reform level point (−2…+2)
  reform_potential_bonus: 0.001,// +0.1 pp potential growth per reform level point (p.a. while active)
};

// ── Public finances (budget identity + debt dynamics) ────────────────────────
// Sources: Domar (1944); Blanchard (2019) AEA address (r < g); IMF Fiscal
// Monitor (automatic stabilizers ≈ 0.3–0.5 of GDP per unit gap in advanced economies).
export const FISCAL = {
  base_revenue_ratio: 40,       // % GDP — total government revenue (advanced-economy norm 35–45)
  base_spending_ratio: 40,      // % GDP — primary spending (excl. interest)
  tax_buoyancy: 0.3,            // automatic stabilizers: revenue-ratio response per pp gap
  spending_stabilizer: 0.15,    // automatic stabilizers: spending-ratio response per pp negative gap
  interest_baseline: 0.02,      // effective interest on the debt STOCK (old debt rolled over slowly)
  risk_premium_per_debt_point: 0.03, // pp premium per debt point above the risk threshold
  risk_premium_credibility: 2.0,     // max pp premium when credibility is at its minimum
  ratio_min: 25,                // political-feasibility bounds for revenue/spending ratios
  ratio_max: 55,
};

// ── Monetary policy ──────────────────────────────────────────────────────────
// Sources: Taylor (1993) rule; Laubach & Williams (r*); Krishnamurthy &
// Vissing-Jorgensen (QE portfolio-balance channel).
export const MONETARY = {
  neutral_real_rate: 1.0,       // r* in % (teaching value; estimates 0–1.5)
  taylor_inflation_weight: 0.5, // response to (inflation − target)
  taylor_gap_weight: 0.5,       // response to the output gap
  rate_min: 0.0,                // zero lower bound
  rate_max: 10.0,               // sanity cap
  qe_rate_effect: 0.15,         // pp effective-rate reduction per % GDP of QE purchases
  qe_max_effect: 1.5,           // cap on the QE rate effect (pp)
};

// ── Households / distribution (three income groups) ─────────────────────────
// Sources: Kaplan/Moll/Violante (2018) HANK (MPC heterogeneity); SOEP/EU-SILC
// for group shapes; cyclical sensitivity: low incomes react first and strongest.
export const HOUSEHOLDS = {
  groups: ['bottom40', 'middle40', 'top20'],
  population_share: { bottom40: 0.40, middle40: 0.40, top20: 0.20 },
  market_share:     { bottom40: 0.12, middle40: 0.43, top20: 0.45 }, // pre-tax/transfer GDP shares
  cycle_sensitivity:{ bottom40: 0.80, middle40: 0.40, top20: 0.15 }, // income response per pp output gap
  tax_incidence:    { bottom40: 0.15, middle40: 0.45, top20: 0.40 }, // who pays a general tax change
  transfer_share:   { bottom40: 0.60, middle40: 0.30, top20: 0.10 }, // who receives transfers
};

// ── Environment ──────────────────────────────────────────────────────────────
// Sources: IPCC AR6 (decoupling requirement); Nordhaus DICE (growth–emissions link).
export const ENVIRONMENT = {
  green_abatement: 0.01,        // emissions-growth reduction per % GDP green investment (p.a.)
  emissions_min_growth: -0.06,  // physical decarbonization speed limit p.a.
};