// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Setup view (course creation)
// Instructor defines course name, mode, rounds and the teams (name + scenario
// per team → varying starting conditions, doc §6). Creates the session record.
// ═══════════════════════════════════════════════════════════════════════════

import { SCENARIOS } from '../../../src/index.js';
import { newSession, clearSession } from '../store.js';
import { el } from './shared.js';

export function renderSetup(ctx) {
  const root = el('div');

  root.append(el('div.view-head', {},
    el('span.view-kicker', {}, 'Kurs einrichten'),
    el('h1', { style: 'font-size:1.5rem' }, 'Makro-Planspiel'),
    el('span.view-head-note', {}, 'Econland · Sitzung lokal auf diesem Gerät'),
  ));

  // Resume hint if a session exists
  if (ctx.session) {
    root.append(el('div.plate', { style: 'margin-bottom:20px' },
      el('div.plate-head', {}, el('h3', {}, 'Laufende Sitzung gefunden')),
      el('div.plate-body', {},
        el('p', { style: 'margin-bottom:12px' },
          `„${ctx.session.name}“ — Runde ${ctx.session.round}/${ctx.session.rounds}, ${ctx.session.teams.length} Teams. ` +
          'Fortsetzen über den Button im Cockpit, oder hier eine neue Sitzung anlegen (überschreibt die alte).'),
        el('button.btn.btn-ghost.btn-small', { onclick: () => { clearSession(); ctx.update(null); ctx.show('setup'); } }, 'Sitzung verwerfen'),
      ),
    ));
  }

  // ── Form ──
  const nameInput = el('input', { type: 'text', value: 'WiPo Planspiel', maxlength: '60' });
  const roundsInput = el('input', { type: 'number', value: '5', min: '2', max: '10' });
  const cbSelect = el('select', {},
    el('option', { value: 'taylor', selected: '' }, 'Unabhängige Zentralbank (KI) — Teams steuern nur Fiskal- & Strukturpolitik'),
    el('option', { value: 'player' }, 'Teams steuern auch die Zentralbank (Leitzins & QE)'),
  );

  const teamList = el('div.team-rows');
  const addTeamRow = (name = '', scenario = 'stable') => {
    const nameEl = el('input', { type: 'text', value: name, placeholder: `Team ${teamList.children.length + 1}`, maxlength: '30' });
    const scenEl = el('select', {},
      SCENARIOS.map(s => el('option', { value: s.id, ...(s.id === scenario ? { selected: '' } : {}) }, `${s.name} — ${s.learning_focus.split(';')[0]}`)),
    );
    const removeBtn = el('button.btn.btn-ghost.btn-small', { onclick: () => row.remove(), title: 'Entfernen' }, '×');
    const row = el('div.team-row', {}, nameEl, scenEl, removeBtn);
    teamList.append(row);
  };
  addTeamRow('Team A', 'stable');
  addTeamRow('Team B', 'stable');

  const errorEl = el('p', { style: 'color:var(--mauve-deep);min-height:1.2em' }, '');

  const startBtn = el('button.btn.btn-sky', { onclick: () => {
    const teams = [...teamList.querySelectorAll('.team-row')]
      .map(row => ({
        name: row.querySelector('input').value.trim() || `Team ${[...teamList.children].indexOf(row) + 1}`,
        scenario: row.querySelector('select').value,
      }))
      .filter(t => t.name);
    if (!teams.length) { errorEl.textContent = 'Mindestens ein Team anlegen.'; return; }
    const names = teams.map(t => t.name.toLowerCase());
    if (new Set(names).size !== names.length) { errorEl.textContent = 'Teamnamen müssen eindeutig sein.'; return; }
    try {
      const session = newSession({
        name: nameInput.value,
        central_bank: cbSelect.value,
        rounds: +roundsInput.value,
        teams,
      });
      ctx.update(session);
      ctx.show('handover');
    } catch (err) {
      errorEl.textContent = err.message;
    }
  } }, 'Sitzung starten');

  root.append(el('div.setup-grid', {},
    // Left: session parameters
    el('div.plate', {},
      el('div.plate-head', {}, el('h3', {}, 'Sitzung')),
      el('div.plate-body', {},
        el('div.form-row', {}, el('label', {}, 'Kursname'), nameInput),
        el('div.form-row', {}, el('label', {}, 'Runden (Jahre)'), roundsInput),
        el('div.form-row', {}, el('label', {}, 'Zentralbank-Modus'), cbSelect),
        errorEl,
        startBtn,
      ),
    ),
    // Right: teams
    el('div.plate', {},
      el('div.plate-head', {},
        el('h3', {}, 'Teams & Ausgangslagen'),
        el('span.plate-kicker', {}, 'Jedes Team erhält ein eigenes, persistentes Land'),
      ),
      el('div.plate-body', {},
        teamList,
        el('button.btn.btn-ghost.btn-small', { onclick: () => addTeamRow('', 'stable') }, '+ Team hinzufügen'),
        el('p', { style: 'font-size:.78rem;color:var(--ink-3);margin-top:14px' },
          'Die Ausgangslage (Szenario) kann je Team variieren — so spielen Gruppen ' +
          'mit unterschiedlichen Herausforderungen gegeneinander. Landform und Karte ' +
          'werden beim Start pro Team einmalig generiert und bleiben das ganze Spiel erhalten.'),
      ),
    ),
  ));

  return root;
}