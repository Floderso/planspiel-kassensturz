// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Inflation block (expectations-augmented Phillips curve)
//
//   π_t   = π^e_{t−1} + slope × gap_t + supply_shock_t      [Phillips 1958,
//                                                          Friedman 1968]
//   π^e_t = π^e_{t−1} + λ(cred) × (π_t − π^e_{t−1})         [adaptive
//                                                          expectations]
//   λ(cred) = adaptation × (1.25 − credibility)             [anchoring: high
//                                                          credibility →
//                                                          slow drift]
//
// Teaching point: demand stimulus shows up as REAL growth only while there is
// slack; at full capacity the Phillips curve converts it into inflation. And
// once expectations de-anchor (low credibility), disinflation becomes costly.
// ═══════════════════════════════════════════════════════════════════════════

import { INFLATION } from '../config/constants.js';

const INFLATION_MIN = -3;   // deflation floor (numerical safety)
const INFLATION_MAX = 25;   // hyperinflation ceiling (numerical safety)

/**
 * Inflation of the current round.
 *
 * @param {number} expected_inflation  expectations formed last round (π^e_{t−1})
 * @param {number} output_gap          current output gap (pp of potential)
 * @param {object} shock_eff           shock effects ({ supply_inflation })
 */
export function computeInflation(expected_inflation, output_gap, shock_eff = {}) {
  const supply = shock_eff.supply_inflation ?? 0;
  const inflation = expected_inflation + INFLATION.phillips_slope * output_gap + supply;
  return Math.min(INFLATION_MAX, Math.max(INFLATION_MIN, inflation));
}

/**
 * Expectations for the NEXT round, formed after observing this round's
 * inflation. Adaptation speed falls with central-bank credibility — a credible
 * bank keeps expectations anchored near target even when inflation deviates.
 */
export function updateExpectations(expected_inflation, inflation, credibility) {
  const adaptation = INFLATION.expectation_adaptation * (1.25 - credibility);
  return expected_inflation + adaptation * (inflation - expected_inflation);
}