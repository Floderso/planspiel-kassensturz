// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Shared view helpers
// DOM builder, lever unlock schedule, ministry plates, pins strip, sparklines.
// ═══════════════════════════════════════════════════════════════════════════

import { METRICS, MINISTRIES, metricsForMinistry, fmtMetric } from '../metrics.js';
import { setPins } from '../store.js';

/** Unlock schedule: levers become available over the periods (doc §6). */
export const UNLOCK_ROUNDS = {
  gov_spending_change: 1,
  tax_change: 1,
  interest_rate: 2,
  qe_volume: 2,
  transfer_change: 2,
  green_investment: 3,
  labor_market_reform: 4,
};

export function leverUnlocked(leverKey, round) {
  return round >= (UNLOCK_ROUNDS[leverKey] ?? 1);
}

/** Tiny DOM builder: el('div.plate', {onclick}, children…) */
export function el(spec, attrs = {}, ...children) {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const child of children.flat(9)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Phase banner used at the top of decision/evaluation views. */
export function phaseBanner(stage, round, rounds, teamName) {
  const isDecision = stage === 'decision';
  return el(`div.phase-banner.${isDecision ? 'decision' : 'evaluation'}`, {},
    el('h2', {}, isDecision
      ? `Entscheidungsphase — Runde ${round} von ${rounds}`
      : `Auswertungsphase — Runde ${round} von ${rounds}`),
    el('small', {}, isDecision
      ? `${teamName} beschließt jetzt. Ergebnisse werden erst nach dem Beschluss aller Teams offengelegt.`
      : `Die Ergebnisse von Runde ${round} liegen vor — Landkarte, Ressorts und Presse.`)
  );
}

/** Ministry plate: collapsible "document" with metrics + (optionally) levers. */
export function ministryPlate({ ministry, state, open = false, bodyNodes = [] }) {
  const plate = el(`div.plate.ministry-plate${open ? '.open' : ''}`);
  const head = el('div.plate-head', {
    role: 'button', tabindex: '0', 'aria-expanded': String(open),
    onclick: () => plate.classList.toggle('open'),
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); plate.classList.toggle('open'); } },
  },
    el('span.ministry-mark'),
    el('div', {},
      el('h3', {}, ministry.name),
      el('span.plate-kicker', {}, ministry.kicker),
    ),
    el('span.stamp', { style: 'margin-left:auto' }, 'Akte'),
  );
  const metrics = metricsForMinistry(ministry.id);
  const table = el('table.metric-table', {},
    el('thead', {}, el('tr', {},
      el('th', {}, 'Kennzahl'), el('th', { style: 'text-align:right' }, 'Wert'),
      el('th', { style: 'text-align:right' }, 'Einheit'))),
    el('tbody', {}, metrics.map(m => el('tr', {},
      el('td', {}, m.label),
      el('td.metric-value', {}, fmtMetric(m.key, state)),
      el('td.metric-delta.metric-note', {}, m.unit)))),
  );
  const body = el('div.ministry-body.plate-body', {},
    table,
    ministry.blurb ? el('p', { style: 'font-size:.78rem;color:var(--ink-3);margin-top:8px' }, ministry.blurb) : null,
    ...bodyNodes,
  );
  plate.append(head, body);
  return plate;
}

/** Pins strip — the personal dashboard (metrics chosen by the team itself). */
export function pinsStrip({ session, teamIdx, state, onChange, editable = false }) {
  const pins = session.teams[teamIdx].pins ?? [];
  const strip = el('div.pins-strip');
  if (!pins.length) {
    strip.append(el('div.pin-empty', {}, 'Noch keine Kennzahlen angeheftet — mit „Anheften“ eigene Auswahl treffen.'));
  }
  for (const key of pins) {
    const def = METRICS.find(m => m.key === key);
    if (!def) continue;
    strip.append(el('div.pin-cell', {},
      el('div.pin-label', {}, def.label),
      el('div.pin-value', {}, fmtMetric(key, state)),
    ));
  }

  const wrap = el('div', {}, strip);
  if (editable) {
    const editor = el('div.pin-editor', { style: 'display:none' });
    editor.append(el('h4', { style: 'margin-bottom:6px' }, 'Kennzahlen anheften (max. 6)'));
    for (const m of METRICS) {
      const checked = pins.includes(m.key);
      editor.append(el('label', {},
        el('input', {
          type: 'checkbox', ...(checked ? { checked: '' } : {}),
          onchange: e => {
            const current = new Set(session.teams[teamIdx].pins);
            if (e.target.checked) current.add(m.key); else current.delete(m.key);
            session = setPins(session, teamIdx, [...current]);
            onChange(session);
          },
        }),
        m.label,
      ));
    }
    const toggle = el('button.btn.btn-ghost.btn-small', {
      style: 'margin-top:8px',
      onclick: () => {
        const open = editor.style.display !== 'none';
        editor.style.display = open ? 'none' : '';
        toggle.textContent = open ? 'Anheften' : 'Fertig';
      },
    }, 'Anheften');
    wrap.append(toggle, editor);
  }
  return wrap;
}

/** Neutral inline sparkline of a history series (no color judgment). */
export function sparkline(values, { width = 120, height = 26 } = {}) {
  if (!values?.length) return el('span', {}, '—');
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) =>
    `${(i / Math.max(1, values.length - 1) * width).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`
  ).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'traj');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', pts);
  svg.append(line);
  return svg;
}

/** Delta between two states, formatted neutrally ("+1.2" / "−0.4"). */
export function fmtDelta(key, prev, next, digits = 1) {
  if (prev?.[key] === undefined || next?.[key] === undefined) return '—';
  const d = next[key] - prev[key];
  if (Math.abs(d) < 0.5 * 10 ** -digits) return '±0';
  return `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(digits)}`;
}

/** Team switcher chips with lock state (for evaluation/done views). */
export function teamChips({ session, activeIdx, onPick, decided }) {
  return el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px' },
    session.teams.map((t, i) => {
      const isActive = i === activeIdx;
      const locked = decided ? decided(t, i) : false;
      return el(`button.btn.btn-small${isActive ? '' : '.btn-ghost'}`, {
        onclick: () => onPick(i),
        'aria-pressed': String(isActive),
      }, `${t.name}${locked ? ' ✓' : ''}`);
    })
  );
}