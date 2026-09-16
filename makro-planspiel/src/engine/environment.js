// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Environment block (emissions trajectory)
//
//   emissions_t = emissions_{t−1} × (1 + g_real − efficiency − abatement × GreenInv)
//
// Growth pushes emissions up; autonomous efficiency gains push them down
// (decoupling trend); green public investment accelerates decarbonization.
//
// Teaching point: "green growth" is possible but not automatic — with the
// baseline numbers (2 % growth vs. 1.5 % efficiency), doing nothing means
// slowly RISING emissions. Decarbonization requires dedicated investment,
// and that investment is also a fiscal impulse with real budget costs.
// ═══════════════════════════════════════════════════════════════════════════

import { GROWTH, ENVIRONMENT } from '../config/constants.js';

/**
 * Emissions index for the current round.
 *
 * @param {number} emissions_index   previous emissions index (base = 100)
 * @param {number} real_growth       real GDP growth this round (decimal)
 * @param {number} green_investment  green public investment this round (% GDP)
 */
export function computeEmissions(emissions_index, real_growth, green_investment = 0) {
  const growth_factor =
    1 + real_growth
      - GROWTH.efficiency_improvement
      - ENVIRONMENT.green_abatement * green_investment;
  const clamped = Math.max(1 + ENVIRONMENT.emissions_min_growth, growth_factor);
  return emissions_index * clamped;
}