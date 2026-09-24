// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Evaluation view (Auswertungsphase)
//
// The reveal (doc §3): only AFTER all teams locked their decrees does the
// country map show the consequences. Per team, tabs switch between the
// cabinets: map, ministry delta tables (prev → new, neutral formatting),
// the day's press (tag-matched articles), and the objective chips.
// ═══════════════════════════════════════════════════════════════════════════

import { MINISTRIES, metricsForMinistry, fmtMetric } from '../metrics.js';
import { advanceStage, greenCumulative, setCurrentTeam } from '../store.js';
import { rasterize } from '../map/landform.js';
import { allocateTiles, featuresFromState } from '../map/allocation.js';
import { renderMap, exportMapPng, MAP_LEGEND } from '../map/render.js';
import { ARTICLES } from '../data/articles.js';
import { el, phaseBanner, teamChips, fmtDelta, sparkline } from './shared.js';

const ARTICLE_MAP = Object.fromEntries(ARTICLES.map(a => [a.id, a]));

export function renderEvaluation(ctx) {
  const { session } = ctx;
  const teamIdx = Math.min(session.currentTeam, session.teams.length - 1);
  const team = session.teams[teamIdx];
  const ev = session.evaluation[session.round]?.[teamIdx];

  if (!ev) {
    return el('div', {}, el('p', {}, 'Auswertung nicht verfügbar.'));
  }

  const root = el('div');
  root.append(phaseBanner('evaluation', session.round, session.rounds, team.name));

  // Team switcher (cabinets may compare AFTER the reveal)
  root.append(teamChips({
    session, activeIdx: teamIdx,
    onPick: i => { ctx.update(setCurrentTeam(session, i)); ctx.show('evaluation'); },
  }));

  // ── The country map (consequences made visible) ──
  const grid = el('div', { style: 'display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start' });
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';

  const { mask, size } = rasterize(team.seed);
  const features = featuresFromState(ev.state, { green_cum: greenCumulative(session, teamIdx) });
  const tiles = allocateTiles({ mask, size, seed: team.seed, features });
  const canvas = el('canvas.map-reveal', { role: 'img', 'aria-label': `Landkarte von ${team.name} nach Runde ${session.round}` });
  renderMap(canvas, { mask, size, tiles, seed: team.seed, cellPx: 20 });

  const legend = el('div.map-legend', {},
    MAP_LEGEND.map(l => el('span.legend-chip', {},
      el('span.legend-swatch', { style: `background:${l.color}` }), l.label)));

  root.append(el('div.rule-label', {}, el('h3', {}, `Die Lage im Land — ${team.name}`)));
  const mapCol = el('div', {},
    el('div.map-frame', {}, canvas),
    legend,
    el('div.map-caption', {},
      `Karte: ${team.name} · feste Landesform seit Spielstart · Färbung folgt den Entwicklungen im Land.`,
      el('br'),
      el('button.btn.btn-ghost.btn-small', {
        style: 'margin-top:6px',
        onclick: () => exportMapPng(canvas, `econland_${team.name.replace(/\W+/g, '_')}_runde_${session.round}.png`),
      }, 'Karte als PNG speichern'),
    ),
  );

  // ── Objectives (neutral chips — status without lecture) ──
  const chips = el('div.objective-chips', {},
    ev.objectives.results.map(r => el(`span.objective-chip.${r.achieved ? 'met' : 'missed'}`, {},
      el('span.obj-mark', {}, r.achieved ? '✓' : '✗'),
      `${r.label} (Ziel: ${r.target_text})`,
    )));
  mapCol.append(
    el('div', { style: 'margin-top:14px' },
      el('h4', { style: 'margin-bottom:6px' }, `Zielvorgaben — ${ev.objectives.achieved}/${ev.objectives.total} erreicht`),
      chips,
    ),
  );
  grid.append(mapCol);

  // ── Ministries: delta tables (prev → new) ──
  const deltaCol = el('div');
  for (const ministry of MINISTRIES) {
    const metrics = metricsForMinistry(ministry.id);
    const rows = metrics.map(m => el('tr', {},
      el('td', {}, m.label),
      el('td.metric-value', { style: 'color:var(--ink-3)' }, fmtMetric(m.key, ev.prevState)),
      el('td.metric-value', {}, fmtMetric(m.key, ev.state)),
      el('td.metric-delta', {}, fmtDelta(m.key, ev.prevState, ev.state)),
    ));
    deltaCol.append(el('div.plate', { style: 'margin-bottom:14px' },
      el('div.plate-head', {},
        el('div', {}, el('h3', {}, ministry.name), el('span.plate-kicker', {}, ministry.kicker)),
        el('span.stamp', { style: 'margin-left:auto' }, `Runde ${session.round}`),
      ),
      el('div.plate-body', { style: 'padding:0' },
        el('table.metric-table', {},
          el('thead', {}, el('tr', {},
            el('th', {}, 'Kennzahl'),
            el('th', { style: 'text-align:right' }, 'Vorher'),
            el('th', { style: 'text-align:right' }, 'Jetzt'),
            el('th', { style: 'text-align:right' }, 'Δ'))),
          el('tbody', {}, rows)),
      ),
    ));
  }
  grid.append(deltaCol);
  root.append(grid);

  // ── Shock banner ──
  if (ev.shock) {
    root.append(el('div.phase-banner.evaluation', { style: 'margin-top:18px;border-left-color:var(--mauve)' },
      el('h3', {}, `Externes Ereignis: ${ev.shock.name}`),
      el('small', {}, ev.shock.description ?? ''),
    ));
  }

  // ── The press of the day ──
  root.append(el('div.rule-label', {}, el('h3', {}, 'Die Presse des Tages'), el('small', {}, 'Was passiert hier — und warum?')));
  root.append(el('div.news-grid', {},
    ev.articleIds.map(id => {
      const a = ARTICLE_MAP[id];
      if (!a) return null;
      return el('article.news-article', {},
        el('div.news-outlet', {},
          el('span.news-outlet-name', {}, a.outlet),
          el('span.news-date', {}, `Runde ${session.round}`)),
        el('h3', {}, a.headline),
        el('p', {}, a.body),
        a.quote ? el('div.news-quote', {}, a.quote) : null,
      );
    }),
  ));

  // ── Justification of the cabinet (read aloud material) ──
  const decision = team.decisions.find(d => d.round === session.round);
  if (decision?.justification) {
    root.append(el('div.plate-inset', { style: 'border:var(--line);padding:14px;margin-top:18px' },
      el('h4', { style: 'margin-bottom:6px' }, `Begründung des Kabinetts ${team.name} (Runde ${session.round})`),
      el('p', { style: 'font-family:var(--font-prose);font-style:italic' }, `„${decision.justification}“`),
    ));
  }

  // ── Advance ──
  const isLast = session.round >= session.rounds;
  root.append(el('div', { style: 'margin-top:24px;display:flex;gap:12px;align-items:center' },
    el('button.btn.btn-sky', {
      onclick: () => {
        ctx.update(advanceStage(session));
        ctx.show(isLast ? 'comparison' : 'handover');
      },
    }, isLast ? 'Zum Abschlussvergleich aller Länder' : `Weiter zu Runde ${session.round + 1}`),
    el('small', {}, isLast ? 'Alle Runden gespielt.' : 'Gerät an das nächste Team weitergeben.'),
  ));

  return root;
}