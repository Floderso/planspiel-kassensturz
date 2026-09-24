// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Boot — cockpit, view routing, context
// ═══════════════════════════════════════════════════════════════════════════

import { loadSession, clearSession } from './store.js';
import { el } from './views/shared.js';
import { renderSetup } from './views/setup.js';
import { renderHandover } from './views/handover.js';
import { renderDecision } from './views/decision.js';
import { renderEvaluation } from './views/evaluation.js';
import { renderMinistries } from './views/ministries.js';
import { renderComparison } from './views/comparison.js';

const VIEWS = {
  setup: renderSetup,
  handover: renderHandover,
  decision: renderDecision,
  evaluation: renderEvaluation,
  ministries: renderMinistries,
  comparison: renderComparison,
};

const PHASE_LABEL = {
  decision: 'Entscheidung',
  evaluation: 'Auswertung',
  done: 'Abgeschlossen',
};

function boot() {
  const app = document.getElementById('app');
  const cockpit = document.getElementById('cockpit');

  const ctx = {
    session: null,
    currentView: 'setup',
    update(session) {
      ctx.session = session;
      renderCockpit();
    },
    show(view) {
      if (!VIEWS[view]) throw new Error(`Unknown view: ${view}`);
      ctx.currentView = view;
      app.innerHTML = '';
      app.append(VIEWS[view](ctx));
      renderCockpit();
      window.scrollTo(0, 0);
    },
  };

  function renderCockpit() {
    cockpit.innerHTML = '';
    const s = ctx.session;

    cockpit.append(
      el('div.cockpit-cell', {},
        el('span.cell-value.brand', {}, 'Econland ', el('em', {}, 'Planspiel')),
      ),
    );

    if (s) {
      const phaseClass = `phase-${s.stage}`;
      cockpit.append(
        el('div.cockpit-cell.cell-hide-m', {},
          el('span.cell-label', {}, 'Kurs'),
          el('span.cell-value', {}, s.name)),
        el('div.cockpit-cell', {},
          el('span.cell-label', {}, 'Runde'),
          el('span.cell-value', {}, `${s.round} / ${s.rounds}`)),
        el('div.cockpit-cell', {},
          el('span.cell-label', {}, 'Phase'),
          el('span.cell-value', {}, el(`span.${phaseClass}`, {}, PHASE_LABEL[s.stage] ?? s.stage))),
        el('div.cockpit-cell.cell-hide-m', {},
          el('span.cell-label', {}, 'Aktuelles Team'),
          el('span.cell-value', {}, s.teams[s.currentTeam]?.name ?? '—')),
      );

      const nav = el('div.cockpit-cell', { style: 'gap:8px;flex-direction:row;align-items:center' });
      if (s.stage !== 'done' && ctx.currentView !== 'ministries') {
        nav.append(el('button.btn.btn-ghost.btn-small', {
          style: 'border-color:#31424d;color:#c8d4db',
          onclick: () => ctx.show('ministries'),
        }, 'Ressorts'));
      }
      if (ctx.currentView !== 'setup') {
        nav.append(el('button.btn.btn-ghost.btn-small', {
          style: 'border-color:#31424d;color:#c8d4db',
          onclick: () => {
            if (confirm('Sitzung wirklich beenden und verwerfen?')) {
              clearSession();
              ctx.update(null);
              ctx.show('setup');
            }
          },
        }, 'Beenden'));
      }
      cockpit.append(nav);
    }
  }

  // ── Initial route ──
  const saved = loadSession();
  if (saved) {
    ctx.session = saved;
    const route = {
      decision: 'handover',
      evaluation: 'evaluation',
      done: 'comparison',
    }[saved.stage] ?? 'setup';
    ctx.show(route);
  } else {
    ctx.show('setup');
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export { boot };