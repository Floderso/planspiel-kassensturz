// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Handover curtain
// Privacy screen between teams on a shared device (doc §3: decisions without
// watching each other). Names the team that is up; nothing else is visible.
// ═══════════════════════════════════════════════════════════════════════════

import { el } from './shared.js';
import { setCurrentTeam } from '../store.js';

export function renderHandover(ctx) {
  const { session } = ctx;
  const teamIdx = session.queue[0] ?? session.currentTeam;
  const team = session.teams[teamIdx];

  return el('div.handover', {},
    el('div.handover-card', {},
      el('span.stamp', {}, `Runde ${session.round} / ${session.rounds}`),
      el('div.handover-team', {}, team.name),
      el('p', { style: 'color:var(--ink-2);margin-bottom:18px' },
        'Bitte das Gerät an dieses Team weitergeben. ' +
        'Erst nach Klick auf „Bereit“ öffnet sich die Entscheidungsakte.'),
      el('button.btn.btn-sky', {
        onclick: () => {
          ctx.update(setCurrentTeam(session, teamIdx));
          ctx.show('decision');
        },
      }, `Bereit — Akte öffnen`),
      el('div', { style: 'margin-top:14px' },
        el('small', {}, 'Andere Teams bitte nicht mitlesen.'),
      ),
    ),
  );
}