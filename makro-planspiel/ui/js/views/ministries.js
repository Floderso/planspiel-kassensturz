// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Ministries view ("Regierungsviertel")
//
// The decentralized data quarter (doc §4): every number the engine computes
// is available — but distributed across the ministries, never pre-sorted or
// pre-judged in one pile. Students collect their picture from the places.
// Each ministry shows current values plus the full trajectory (neutral
// sparklines, no color verdict).
// ═══════════════════════════════════════════════════════════════════════════

import { MINISTRIES, metricsForMinistry, fmtMetric } from '../metrics.js';
import { teamState, teamHistory, setCurrentTeam } from '../store.js';
import { el, teamChips, sparkline } from './shared.js';

export function renderMinistries(ctx) {
  const { session } = ctx;
  const teamIdx = Math.min(session.currentTeam, session.teams.length - 1);
  const team = session.teams[teamIdx];
  const state = teamState(session, teamIdx);
  const history = teamHistory(session, teamIdx);

  const root = el('div');

  root.append(el('div.view-head', {},
    el('span.view-kicker', {}, 'Regierungsviertel'),
    el('h1', { style: 'font-size:1.4rem' }, `Die Ressorts — ${team.name}`),
    el('span.view-head-note', {}, 'Alle Zahlen, dezentral wie im echten Regierungsviertel'),
  ));

  root.append(teamChips({
    session, activeIdx: teamIdx,
    onPick: i => { ctx.update(setCurrentTeam(session, i)); ctx.show('ministries'); },
  }));

  const grid = el('div.ministry-grid');
  for (const ministry of MINISTRIES) {
    const metrics = metricsForMinistry(ministry.id);
    const rows = metrics.map(m => {
      const series = history.map(h => h.state[m.key]);
      return el('tr', {},
        el('td', {}, m.label, el('div.metric-note', {}, m.unit)),
        el('td.metric-value', {}, fmtMetric(m.key, state)),
        el('td', { style: 'text-align:right' }, series.length > 1 ? sparkline(series) : el('span.metric-note', {}, '—')),
      );
    });

    grid.append(el('div.plate', {},
      el('div.plate-head', {},
        el('div', {}, el('h3', {}, ministry.name), el('span.plate-kicker', {}, ministry.kicker)),
        el('span.stamp', { style: 'margin-left:auto' }, 'Akte'),
      ),
      el('div.plate-body', { style: 'padding:0' },
        el('table.metric-table', {},
          el('thead', {}, el('tr', {},
            el('th', {}, 'Kennzahl'),
            el('th', { style: 'text-align:right' }, 'Aktuell'),
            el('th', { style: 'text-align:right' }, 'Verlauf'))),
          el('tbody', {}, rows)),
      ),
      el('div.plate-body', { style: 'border-top:var(--line-soft)' },
        el('p', { style: 'font-size:.78rem;color:var(--ink-3)' }, ministry.blurb)),
    ));
  }
  root.append(grid);

  root.append(el('div', { style: 'margin-top:18px' },
    el('button.btn.btn-ghost', { onclick: () => ctx.show(session.stage === 'decision' ? 'decision' : session.stage === 'evaluation' ? 'evaluation' : 'comparison') },
      'Zurück zur Runde'),
  ));

  return root;
}