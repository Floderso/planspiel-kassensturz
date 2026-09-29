// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Decision view (Entscheidungsphase)
//
// The current team's cabinet meeting: ministries as collapsible "Akten",
// each presenting its metrics (state of the LAST completed round — the only
// information available) plus the levers of its domain that are unlocked in
// this round. NO live simulation feedback anywhere (doc §3): the outcome is
// revealed only in the evaluation phase. The team submits its decree with a
// written justification.
// ═══════════════════════════════════════════════════════════════════════════

import { MINISTRIES, fmtMetric } from '../metrics.js';
import { teamState, leversForTeam, submitDecision, evaluateAll, allDecided } from '../store.js';
import { el, phaseBanner, ministryPlate, pinsStrip, leverUnlocked, UNLOCK_ROUNDS } from './shared.js';

export function renderDecision(ctx) {
  const { session } = ctx;
  const teamIdx = session.currentTeam;
  const team = session.teams[teamIdx];
  const state = teamState(session, teamIdx);
  const levers = leversForTeam(session, teamIdx);
  const pending = {}; // lever key → current value (starts at defaults)

  const root = el('div');

  root.append(phaseBanner('decision', session.round, session.rounds, team.name));

  // ── Personal dashboard (metrics chosen by the team itself) ──
  root.append(el('div.rule-label', {}, el('h3', {}, 'Eigene Übersicht')));
  root.append(pinsStrip({
    session, teamIdx, state, editable: true,
    onChange: s => { ctx.update(s); ctx.show('decision'); },
  }));

  // ── Ministries with their levers ──
  root.append(el('div.rule-label', {}, el('h3', {}, 'Die Ressorts'), el('small', {}, 'Akten öffnen, entscheiden, aktenkundig machen')));

  const ministryGrid = el('div.ministry-grid');
  const leverInputs = new Map(); // key → { input, valueEl, lever }

  for (const ministry of MINISTRIES) {
    const ministryLevers = levers.filter(l => ministry.domains.includes(l.domain));
    const leverNodes = ministryLevers.map(lever => buildLever(lever, session.round, pending, leverInputs, refreshDecree));

    const lockedNotes = ministryLevers.length === 0
      ? el('p', { style: 'font-size:.78rem;color:var(--ink-3);margin-top:10px' }, 'Dieses Ressort hat keine eigenen Hebel — es beobachtet und dokumentiert.')
      : null;

    ministryGrid.append(ministryPlate({
      ministry, state,
      open: ministryLevers.length > 0,
      bodyNodes: [...leverNodes, lockedNotes].filter(Boolean),
    }));
  }
  root.append(ministryGrid);

  // ── The decree ("Ihr Beschluss") ──
  root.append(el('div.rule-label', {}, el('h3', {}, 'Der Beschluss')));

  const decreeList = el('ul.decree-list');
  const justificationInput = el('textarea', {
    placeholder: 'Begründung des Kabinetts (Pflicht): Warum diese Entscheidungen? Was erwartet ihr euch davon?',
    'aria-label': 'Begründung des Kabinetts',
  });
  const errorEl = el('p', { style: 'color:var(--mauve-deep);min-height:1.2em;margin-top:8px' }, '');

  function refreshDecree() {
    decreeList.innerHTML = '';
    const entries = Object.entries(pending).filter(([, v]) => v && v.value !== undefined);
    const changed = entries.filter(([, v]) => v.value !== v.lever.default);
    if (!changed.length) {
      decreeList.append(el('li', {}, el('span', { style: 'color:var(--ink-3)' }, 'Noch keine Veränderungen eingestellt — Status quo ist auch ein Beschluss.'), el('span', {}, '±0')));
    }
    for (const [key, v] of changed) {
      const lever = v.lever;
      decreeList.append(el('li', {},
        el('span', {}, lever.label),
        el('span', {}, `${formatLeverValue(lever, v.value)} ${lever.unit.replace('index ', '')}`),
      ));
    }
  }

  const submitBtn = el('button.btn', { onclick: () => {
    if (!justificationInput.value.trim()) {
      errorEl.textContent = 'Bitte eine Begründung eintragen — entscheiden heißt auch begründen.';
      justificationInput.focus();
      return;
    }
    const policies = Object.fromEntries(
      Object.entries(pending).filter(([, v]) => v.value !== v.lever.default).map(([k, v]) => [k, v.value])
    );
    try {
      let s = submitDecision(session, teamIdx, policies, justificationInput.value);
      ctx.update(s);
      if (allDecided(s)) {
        s = evaluateAll(s);
        ctx.update(s);
        ctx.show('evaluation');
      } else {
        ctx.show('handover');
      }
    } catch (err) {
      errorEl.textContent = err.message;
    }
  } }, 'Beschluss einreichen');

  const decree = el('div.decree', {},
    el('h3', {}, `Beschluss des Kabinetts ${team.name}, Runde ${session.round}`),
    decreeList,
    justificationInput,
    errorEl,
    el('div', { style: 'display:flex;gap:10px;align-items:center;margin-top:10px' },
      submitBtn,
      el('small', {}, 'Einreichung ist endgültig für diese Runde.'),
    ),
  );
  root.append(decree);

  refreshDecree();
  return root;
}

// ── Lever control (interactive — formally distinct from info displays) ──────

function buildLever(lever, round, pending, leverInputs, onChange) {
  const unlocked = leverUnlocked(lever.key, round);
  const value = lever.default;
  pending[lever.key] = { value, lever };

  const valueEl = el('span.lever-value', {}, formatLeverValue(lever, value));

  if (!unlocked) {
    return el('div.lever.locked', {},
      el('div.lever-head', {},
        el('span.lever-name', {}, lever.label),
        el('span.lever-lock-note', {}, `Ab Runde ${UNLOCK_ROUNDS[lever.key]} verfügbar`),
      ),
      el('p.lever-blurb', {}, lever.blurb),
    );
  }

  const input = el('input', {
    type: 'range',
    min: lever.min, max: lever.max, step: lever.step, value,
    'aria-label': lever.label,
    oninput: e => {
      const v = parseFloat(e.target.value);
      pending[lever.key].value = v;
      valueEl.textContent = formatLeverValue(lever, v);
      onChange();
    },
  });
  leverInputs.set(lever.key, { input, valueEl, lever });

  return el('div.lever', {},
    el('div.lever-head', {},
      el('span.lever-name', {}, lever.label),
      valueEl,
    ),
    input,
    el('div.lever-scale', {},
      el('span', {}, `${lever.min}`),
      el('span', {}, lever.unit),
      el('span', {}, `${lever.max}`),
    ),
    el('details.lever-blurb', {},
      el('summary', {}, 'Sachverhalt'),
      el('p', { style: 'margin-top:6px' }, lever.blurb),
    ),
  );
}

function formatLeverValue(lever, v) {
  if (lever.unit === '% of GDP') return `${v >= 0 ? '+' : ''}${v}`;
  if (lever.unit === '%') return `${v}`;
  return `${v >= 0 && lever.min < 0 ? '+' : ''}${v}`;
}