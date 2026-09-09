// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Policy lever definitions
//
// The game is deliberately ABSTRACT: players do not tweak individual tax laws
// but the big macro knobs — government spending, the overall tax burden,
// transfers, the policy interest rate, QE, and two structural reforms.
//
// Each lever definition is UI-AGNOSTIC (key, domain, bounds, unit, teaching
// blurb, formula reference). A future UI can render itself entirely from this
// file; the engine validates every policy package against it.
//
// Semantics:
//   kind 'impulse' → a CHANGE applied in the current round (flow). Fiscal
//                    impulses accumulate into the spending/revenue RATIOS,
//                    but only the fresh impulse drives aggregate demand.
//   kind 'level'   → a STANCE that persists until changed (interest rate,
//                    structural reform level).
// ═══════════════════════════════════════════════════════════════════════════

export const POLICY_DOMAINS = {
  fiscal:    { label: 'Fiscal policy (government budget)',  role: 'Ministry of Finance' },
  monetary:  { label: 'Monetary policy (central bank)',     role: 'Central Bank' },
  structural:{ label: 'Structural policy (supply side)',    role: 'Ministry of Economic Affairs' },
};

export const POLICY_LEVERS = [
  {
    key: 'gov_spending_change',
    domain: 'fiscal',
    kind: 'impulse',
    label: 'Government spending',
    unit: '% of GDP',
    min: -3, max: 3, step: 0.25, default: 0,
    blurb:
      'Raise or cut primary government spending (infrastructure, public services, ' +
      'defense). Works through the fiscal multiplier: powerful in a recession, ' +
      'mostly inflationary at full capacity. Permanently shifts the spending ratio ' +
      'until reversed.',
    formula_ref: 'demand.js → fiscal impulse; fiscal.js → spending ratio',
  },
  {
    key: 'tax_change',
    domain: 'fiscal',
    kind: 'impulse',
    label: 'Overall tax burden',
    unit: '% of GDP',
    min: -3, max: 3, step: 0.25, default: 0,
    blurb:
      'Raise or cut the average tax take of the economy. A tax INCREASE (positive ' +
      'value) improves the budget but dampens demand — with a smaller multiplier ' +
      'than spending, because households partly fund taxes from savings ' +
      '(Haavelmo/balanced-budget theorem).',
    formula_ref: 'demand.js → tax drag; fiscal.js → revenue ratio',
  },
  {
    key: 'transfer_change',
    domain: 'fiscal',
    kind: 'impulse',
    label: 'Welfare transfers',
    unit: '% of GDP',
    min: -2, max: 2, step: 0.25, default: 0,
    blurb:
      'Cash transfers to households (pensions, unemployment and family benefits). ' +
      'Redistributes toward low-income groups with high marginal propensity to ' +
      'consume — a strong, fast demand stimulus per euro, but no supply-side gain.',
    formula_ref: 'demand.js → MPC-weighted impulse; households.js → distribution',
  },
  {
    key: 'interest_rate',
    domain: 'monetary',
    kind: 'level',
    label: 'Policy interest rate',
    unit: '%',
    min: 0, max: 10, step: 0.25, default: 3,
    requires: { central_bank: 'player' },
    blurb:
      'The central bank\'s key rate. Works through the REAL rate (rate minus ' +
      'expected inflation): above the neutral rate r* it cools demand and ' +
      'inflation, below it stimulates. Zero lower bound applies. Deviating far ' +
      'from the Taylor rule costs credibility.',
    formula_ref: 'monetary.js → real rate; demand.js → interest channel',
  },
  {
    key: 'qe_volume',
    domain: 'monetary',
    kind: 'impulse',
    label: 'Quantitative easing (bond purchases)',
    unit: '% of GDP',
    min: 0, max: 5, step: 0.25, default: 0,
    requires: { central_bank: 'player' },
    blurb:
      'Central-bank bond purchases lower the effective long-term rate even at the ' +
      'zero lower bound. Useful in deep recessions; used while inflation runs hot ' +
      'it damages credibility and unanchors expectations.',
    formula_ref: 'monetary.js → QE rate effect',
  },
  {
    key: 'labor_market_reform',
    domain: 'structural',
    kind: 'level',
    label: 'Labor market reform',
    unit: 'index (−2…+2)',
    min: -2, max: 2, step: 1, default: 0,
    blurb:
      'Structural reform of the labor market (matching, activation, flexibility). ' +
      'Positive values gradually lower structural unemployment (NAIRU) and lift ' +
      'potential growth — slow, but the only lever that creates room to grow ' +
      'WITHOUT inflation. Negative values model protective regulation.',
    formula_ref: 'labor.js → NAIRU drift; economy.js → potential growth',
  },
  {
    key: 'green_investment',
    domain: 'structural',
    kind: 'impulse',
    label: 'Green public investment',
    unit: '% of GDP',
    min: 0, max: 2, step: 0.25, default: 0,
    blurb:
      'Public investment in the energy transition. Triple dividend: stimulates ' +
      'demand like any spending, accelerates decarbonization, and nudges ' +
      'potential output up. Financed like other spending — it widens the deficit first.',
    formula_ref: 'demand.js → fiscal impulse; environment.js → abatement',
  },
];

// ── Lookup helpers ───────────────────────────────────────────────────────────

const LEVER_MAP = Object.fromEntries(POLICY_LEVERS.map(l => [l.key, l]));

export function getLever(key) {
  return LEVER_MAP[key] ?? null;
}

/**
 * Returns the levers available under a given game config.
 * `central_bank: 'player'` unlocks the monetary levers; 'taylor' hides them
 * (the central bank then acts as an independent AI following a Taylor rule).
 */
export function availableLevers({ central_bank = 'taylor' } = {}) {
  return POLICY_LEVERS.filter(l => !l.requires || l.requires.central_bank === central_bank);
}

/**
 * Validates a policy package against the lever definitions.
 * Returns { ok, errors, sanitized } — `sanitized` has all known levers clamped
 * to their bounds; unknown keys and unavailable levers are reported as errors.
 */
export function validatePolicies(policies, { central_bank = 'taylor' } = {}) {
  const available = new Set(availableLevers({ central_bank }).map(l => l.key));
  const errors = [];
  const sanitized = {};
  for (const [key, value] of Object.entries(policies ?? {})) {
    const lever = LEVER_MAP[key];
    if (!lever) { errors.push(`Unknown policy lever: "${key}"`); continue; }
    if (!available.has(key)) {
      errors.push(`Lever "${key}" is not available (requires central_bank: '${lever.requires.central_bank}')`);
      continue;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`Lever "${key}" must be a finite number, got: ${JSON.stringify(value)}`);
      continue;
    }
    sanitized[key] = Math.min(lever.max, Math.max(lever.min, value));
  }
  return { ok: errors.length === 0, errors, sanitized };
}

/** Default policy package (all levers at their default) for a config. */
export function defaultPolicies({ central_bank = 'taylor' } = {}) {
  return Object.fromEntries(availableLevers({ central_bank }).map(l => [l.key, l.default]));
}