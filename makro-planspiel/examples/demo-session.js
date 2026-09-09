// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Demo session (terminal)
//
// A scripted 4-round game in the "recession" scenario, demonstrating the
// headless API end to end: scenario setup → policy decisions → engine →
// learning feedback → history. Run with:  node examples/demo-session.js
// ═══════════════════════════════════════════════════════════════════════════

import { createGame } from '../src/index.js';

// ── Formatting helpers ───────────────────────────────────────────────────────

const pct = (v, digits = 1) => `${v.toFixed(digits)} %`;
const signed = (v, digits = 1) => (v >= 0 ? '+' : '') + v.toFixed(digits);
const line = (char = '─', n = 74) => char.repeat(n);

const TONE_ICON = { info: 'ℹ', good: '✓', warn: '⚠', bad: '✗' };

function printState(state) {
  const rows = [
    ['Output gap',      signed(state.output_gap) + ' pp'],
    ['Real growth',     signed(state.real_growth) + ' %'],
    ['Inflation',       pct(state.inflation)],
    ['Unemployment',    pct(state.unemployment)],
    ['Policy rate',     pct(state.policy_rate)],
    ['Deficit',         pct(state.deficit_ratio) + ' of GDP'],
    ['Debt ratio',      pct(state.debt_ratio, 0) + ' of GDP'],
    ['Gini',            state.gini.toFixed(3)],
    ['Emissions (idx)', state.emissions_index.toFixed(1)],
    ['Credibility',     state.credibility.toFixed(2)],
  ];
  for (const [label, value] of rows) {
    console.log(`   ${label.padEnd(18)} ${value.padStart(14)}`);
  }
}

function printFeedback(feedback, objectives) {
  for (const m of feedback) {
    console.log(`   ${TONE_ICON[m.tone]} ${m.title}`);
    console.log(`     ${m.text}`);
  }
  const missed = objectives.results.filter(r => !r.achieved);
  console.log(
    `   Objectives: ${objectives.achieved}/${objectives.total} (score ${objectives.score})` +
    (missed.length ? ` — missed: ${missed.map(m => m.label).join(', ')}` : '')
  );
}

// ── The scripted game ────────────────────────────────────────────────────────

const game = createGame({
  scenario: 'recession',
  rounds: 4,
  central_bank: 'taylor',          // independent AI central bank
  shocks: [{ round: 3, shock_id: 'trade_war' }], // mid-game adversity
});

console.log(line('═'));
console.log('  MAKRO-PLANSPIEL · Demo session — "The downturn" (recession scenario)');
console.log(line('═'));
console.log('\nSTARTING POSITION (year 0):');
printState(game.getState());

const script = [
  {
    round: 1,
    title: 'Keynesian response: a decisive spending stimulus',
    policies: { gov_spending_change: 2, transfer_change: 0.5 },
  },
  {
    round: 2,
    title: 'Keep the course, start the green transition',
    policies: { green_investment: 1 },
  },
  {
    round: 3,
    title: 'A trade war hits: cushion with transfers, accept the deficit',
    policies: { transfer_change: 1 },
  },
  {
    round: 4,
    title: 'Recovery established: begin consolidation and structural reform',
    policies: { tax_change: 1, labor_market_reform: 1 },
  },
];

for (const step of script) {
  console.log(`\n${line()}`);
  console.log(`ROUND ${step.round} — ${step.title}`);
  console.log(`Decisions: ${JSON.stringify(step.policies)}`);
  console.log(line());

  game.setPolicies(step.policies);
  const { state, feedback, objectives, shock } = game.advanceRound();

  if (shock) console.log(`   ⚠ SHOCK: ${shock.name} — ${shock.description}\n`);
  printState(state);
  console.log('\n   What happened and why (explainer):');
  printFeedback(feedback, objectives);
}

console.log(`\n${line('═')}`);
console.log('  FINAL REPORT (from game.getHistory())');
console.log(line('═'));
console.log('  Round │ Gap     Infl.  Unempl.  Debt    Gini   Score');
for (const h of game.getHistory()) {
  const s = h.state;
  console.log(
    `     ${h.round}  │ ${signed(s.output_gap).padStart(5)}  ${pct(s.inflation).padStart(5)}  ${pct(s.unemployment).padStart(6)}  ${pct(s.debt_ratio, 0).padStart(5)}  ${s.gini.toFixed(3)}   ${String(h.objectives.score).padStart(3)}`
  );
}
console.log(line('═'));
console.log('Replay, fork, or UI-ify this session — everything above is plain data.');