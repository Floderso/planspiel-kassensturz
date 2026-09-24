// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Labor market block
//
//   u_t       = NAIRU_t − okun × gap_t              [Okun's law, 1962]
//   NAIRU_t   = NAIRU_{t−1} + drift × (NAIRU* − NAIRU_{t−1}) + shock
//   NAIRU*    = base − reform_effect × reform_level [structural policy]
//
// Teaching point: cyclical unemployment responds to demand within a year;
// STRUCTURAL unemployment moves only slowly and only via supply-side reform —
// you cannot stimulate your way below the NAIRU without inflation.
// ═══════════════════════════════════════════════════════════════════════════

import { LABOR, TARGETS } from '../config/constants.js';

const UNEMPLOYMENT_MIN = 2;   // frictional floor
const UNEMPLOYMENT_MAX = 25;  // numerical safety
const NAIRU_MIN = 3;
const NAIRU_MAX = 12;

/** Structural target for the NAIRU given the reform stance (−2…+2). */
export function nairuTarget(labor_market_reform = 0) {
  const target = TARGETS.natural_unemployment - LABOR.reform_nairu_effect * labor_market_reform;
  return Math.min(NAIRU_MAX, Math.max(NAIRU_MIN, target));
}

/** NAIRU drifts toward its structural target; shocks can shift it directly. */
export function updateNairu(prev_nairu, labor_market_reform, shock_eff = {}) {
  const target = nairuTarget(labor_market_reform);
  const drifted = prev_nairu + LABOR.nairu_drift * (target - prev_nairu);
  const shifted = drifted + (shock_eff.nairu_shift ?? 0);
  return Math.min(NAIRU_MAX, Math.max(NAIRU_MIN, shifted));
}

/** Unemployment from Okun's law, using the current NAIRU and output gap. */
export function computeUnemployment(nairu, output_gap) {
  const unemployment = nairu - LABOR.okun_coefficient * output_gap;
  return Math.min(UNEMPLOYMENT_MAX, Math.max(UNEMPLOYMENT_MIN, unemployment));
}