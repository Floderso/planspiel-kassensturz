// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Exogenous shock library
//
// Shocks are events OUTSIDE the players' control, injected by the instructor
// (or embedded in a scenario) for a single round. Each effect field maps 1:1
// onto an engine channel:
//
//   demand            → pp added to the output gap THIS round (IS shift)
//   supply_inflation  → pp added to inflation THIS round (Phillips shift)
//   risk_premium      → pp added to the effective interest rate on debt
//   nairu_shift       → pp added to structural unemployment (level effect)
//   potential_bonus   → pp added to potential growth THIS round
// ═══════════════════════════════════════════════════════════════════════════

export const SHOCKS = [
  {
    id: 'energy_crisis',
    name: 'Energy price shock',
    description:
      'Imported energy becomes drastically more expensive. A classic adverse ' +
      'SUPPLY shock: prices rise while output falls — demand management alone ' +
      'cannot fix both.',
    effects: { demand: -1.0, supply_inflation: 2.0 },
  },
  {
    id: 'financial_crisis',
    name: 'Financial crisis',
    description:
      'A banking scare freezes credit and confidence. Demand collapses and ' +
      'markets charge the government a risk premium at the same time.',
    effects: { demand: -3.0, risk_premium: 0.8 },
  },
  {
    id: 'export_boom',
    name: 'Global demand boom',
    description:
      'Trading partners grow strongly and order more. A positive DEMAND shock: ' +
      'pleasant, but it can push an already hot economy into overheating.',
    effects: { demand: 1.5 },
  },
  {
    id: 'commodity_relief',
    name: 'Falling commodity prices',
    description:
      'Oil and raw-material prices tumble. A benign SUPPLY shock: inflation ' +
      'eases without any sacrifice in output.',
    effects: { supply_inflation: -1.5, demand: 0.5 },
  },
  {
    id: 'migration_wave',
    name: 'Labor supply expansion',
    description:
      'Immigration enlarges the workforce. Potential output rises and ' +
      'structural unemployment frictions ease — a rare free lunch, politically ' +
      'outside your control.',
    effects: { potential_bonus: 0.5, nairu_shift: -0.3 },
  },
  {
    id: 'productivity_boom',
    name: 'Technology wave',
    description:
      'A general-purpose technology (think: electrification, IT, AI) lifts ' +
      'productivity. Supply expands and disinflation comes for free.',
    effects: { potential_bonus: 0.8, supply_inflation: -0.5 },
  },
  {
    id: 'trade_war',
    name: 'Trade war',
    description:
      'Tariffs and retaliation disrupt supply chains and exports at once: ' +
      'demand falls AND import prices rise. Stagflationary.',
    effects: { demand: -2.0, supply_inflation: 1.0 },
  },
];

const SHOCK_MAP = Object.fromEntries(SHOCKS.map(s => [s.id, s]));

export function getShock(id) {
  const shock = SHOCK_MAP[id];
  if (!shock) {
    throw new Error(`Unknown shock "${id}". Available: ${SHOCKS.map(s => s.id).join(', ')}`);
  }
  return shock;
}