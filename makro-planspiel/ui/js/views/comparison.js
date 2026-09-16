// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Comparison view (Abschlussvergleich)
//
// The final reckoning: all countries side by side — "so sieht's bei euch
// aus, so bei uns" (doc §2). Every map exports as PNG. Below: the trajectory
// table, and the MECHANICS APPENDIX — the engine's causal feedback per team
// and round, deliberately locked until AFTER the game (during play, students
// reason from news and numbers, not from revealed mechanics).
// ═══════════════════════════════════════════════════════════════════════════

import { fmtMetric } from '../metrics.js';
import { teamHistory, greenCumulative, clearSession } from '../store.js';
import { rasterize } from '../map/landform.js';
import { allocateTiles, featuresFromState } from '../map/allocation.js';
import { renderMap, exportMapPng } from '../map/render.js';
import { el } from './shared.js';

const SUMMARY_METRICS = ['inflation', 'unemployment', 'debt_ratio', 'gini', 'emissions_index', 'gdp_index'];

export function renderComparison(ctx) {
  const { session } = ctx;
  const root = el('div');

  root.append(el('div.view-head', {},
    el('span.view-kicker', {}, 'Abschlussvergleich'),
    el('h1', { style: 'font-size:1.4rem' }, `Die Länder nach ${session.rounds} Runden`),
    el('span.view-head-note', {}, session.name),
  ));

  // ── All countries side by side ──
  const grid = el('div.compare-grid');
  session.teams.forEach((team, teamIdx) => {
    const history = teamHistory(session, teamIdx);
    const finalState = history.at(-1)?.state;
    if (!finalState) return;

    const { mask, size } = rasterize(team.seed);
    const features = featuresFromState(finalState, { green_cum: greenCumulative(session, teamIdx) });
    const tiles = allocateTiles({ mask, size, seed: team.seed, features });
    const canvas = el('canvas', { role: 'img', 'aria-label': `Endstand der Landkarte von ${team.name}` });
    renderMap(canvas, { mask, size, tiles, seed: team.seed, cellPx: 14 });

    const metricsTable = el('table.metric-table', {},
      el('tbody', {},
        SUMMARY_METRICS.map(key => el('tr', {},
          el('td', { style: 'font-size:.78rem' }, label(key)),
          el('td.metric-value', { style: 'font-size:.82rem' }, fmtMetric(key, finalState)),
        ))),
    );

    const scores = history.map(h => h.objectives.score);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    grid.append(el('div.compare-card', {},
      el('div.compare-team', {},
        el('strong', {}, team.name),
        el('span.lock-chip.locked', {}, `Ø Score ${avgScore}`),
      ),
      el('div.compare-body', {},
        canvas,
        el('div', { style: 'margin:8px 0' }, metricsTable),
        el('button.btn.btn-ghost.btn-small', {
          onclick: () => exportMapPng(canvas, `econland_${team.name.replace(/\W+/g, '_')}_endstand.png`),
        }, 'PNG speichern'),
      ),
    ));
  });
  root.append(grid);

  // ── Round-by-round trajectory table ──
  root.append(el('div.rule-label', {}, el('h3', {}, 'Verlauf im Überblick')));
  const maxRounds = session.rounds;
  const table = el('table.metric-table', {},
    el('thead', {}, el('tr', {},
      el('th', {}, 'Team'),
      ...Array.from({ length: maxRounds }, (_, i) => el('th', { style: 'text-align:right' }, `R${i + 1}`)),
    )),
    el('tbody', {},
      session.teams.flatMap((team, teamIdx) => {
        const history = teamHistory(session, teamIdx);
        return [
          el('tr', {},
            el('td', { style: 'font-weight:600' }, `${team.name} — Inflation`),
            ...history.map(h => el('td.metric-value', {}, h.state.inflation.toFixed(1)))),
          el('tr', {},
            el('td', {}, `${team.name} — Arbeitslosigkeit`),
            ...history.map(h => el('td.metric-value', {}, h.state.unemployment.toFixed(1)))),
          el('tr', {},
            el('td', {}, `${team.name} — Schuldenquote`),
            ...history.map(h => el('td.metric-value', {}, h.state.debt_ratio.toFixed(0)))),
        ];
      }),
    ),
  );
  root.append(table);

  // ── Mechanics appendix (unlocked only now, after the last round) ──
  root.append(el('div.rule-label', {}, el('h3', {}, 'Mechanik-Anhang — was war eigentlich los?'),
    el('small', {}, 'Erst nach Spielende: die Kausalketten des Modells, Team für Team, Runde für Runde')));

  session.teams.forEach((team, teamIdx) => {
    const history = teamHistory(session, teamIdx);
    const details = el('details.appendix-item', {},
      el('summary', {}, el('span', {}, `Akte ${team.name}`), el('span', {}, `${history.length} Runden`)),
      el('div.appendix-body', {},
        history.map(h => el('div', { style: 'margin-bottom:14px' },
          el('h4', { style: 'margin-bottom:4px' }, `Runde ${h.round}${h.shock ? ` — Ereignis: ${h.shock.name}` : ''}`),
          h.state.policies && Object.keys(h.policies).length
            ? el('small', { style: 'display:block;margin-bottom:6px' },
                `Beschluss: ${Object.entries(h.policies).filter(([, v]) => v !== 0).map(([k, v]) => `${k} ${v}`).join(' · ') || 'Status quo'}`)
            : null,
          ...h.feedback.map(f => el('div.feedback-line', {},
            el('span.fb-tone', {}, { info: 'ℹ', good: '✓', warn: '⚠', bad: '✗' }[f.tone] ?? '·'),
            el('strong', {}, `${f.title}. `),
            el('span', {}, f.text))),
        )),
      ),
    );
    root.append(details);
  });

  // ── Restart ──
  root.append(el('div', { style: 'margin-top:26px;display:flex;gap:12px;align-items:center' },
    el('button.btn', { onclick: () => { clearSession(); ctx.update(null); ctx.show('setup'); } }, 'Neue Sitzung anlegen'),
    el('small', {}, 'Die bisherige Sitzung wird dabei verworfen.'),
  ));

  return root;
}

function label(key) {
  return {
    inflation: 'Inflation', unemployment: 'Arbeitslosigkeit', debt_ratio: 'Schuldenquote',
    gini: 'Gini', emissions_index: 'Emissionen (Index)', gdp_index: 'BIP (Index)',
  }[key] ?? key;
}