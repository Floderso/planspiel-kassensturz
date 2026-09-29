// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Session store
//
// Owns the whole course session: setup, round flow (decision queue →
// collective evaluation → next round), per-team decisions/justifications,
// dashboard pins, news-event effects — persisted in localStorage.
//
// Key property: the SESSION RECORD stores only inputs (config + decisions +
// injected shocks). Live engine state is always reconstructed by replaying
// through the deterministic engine (buildGame) — the record and the
// simulation can never diverge.
//
// Session shape:
//   { id, name, central_bank, rounds, stage, round, queue, currentTeam,
//     teams: [{ name, seed, scenario, decisions: [{round, policies,
//     justification}], addedShocks: [{round, shock}], pins: [metricKey] }],
//     evaluation: { [round]: { [teamIdx]: { prevState, state, objectives,
//     feedback, shock, articleIds } } } }
// ═══════════════════════════════════════════════════════════════════════════

import { createGame } from '../../src/index.js';
import { hashString } from './seed.js';
import { selectArticles } from './news.js';

const LS_KEY = 'makro_planspiel_session_v1';

// ── Session lifecycle ────────────────────────────────────────────────────────

export function newSession({ name, central_bank = 'taylor', rounds = 5, teams }) {
  if (!teams?.length) throw new Error('Mindestens ein Team erforderlich.');
  const id = `sess_${Date.now().toString(36)}`;
  const session = {
    id,
    name: name?.trim() || 'Makro-Planspiel',
    central_bank,
    rounds: Math.max(2, Math.min(10, rounds | 0 || 5)),
    stage: 'decision',          // 'decision' | 'evaluation' | 'done'
    round: 1,
    queue: teams.map((_, i) => i), // decision order for the current round
    currentTeam: 0,
    teams: teams.map(t => ({
      name: t.name.trim(),
      scenario: t.scenario,
      seed: hashString(`${t.name.trim()}/${id}`),
      decisions: [],
      addedShocks: [],
      pins: ['inflation', 'unemployment', 'debt_ratio'],
    })),
    evaluation: {},
    created_at: new Date().toISOString(),
  };
  saveSession(session);
  return session;
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function saveSession(session) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(session)); } catch (_) { /* quota — play on */ }
}

export function clearSession() {
  try { localStorage.removeItem(LS_KEY); } catch (_) { /* noop */ }
}

// ── Engine reconstruction (deterministic replay) ─────────────────────────────

/**
 * Rebuilds a team's game facade from the record: creates the game with the
 * team's injected shocks and replays the recorded decisions up to and
 * including `throughRound`. Deterministic — the result equals live play.
 *
 * `throughRound` defaults to the stage-appropriate horizon: the current
 * round's decision is only replayed once it has been EVALUATED — during the
 * decision stage a team's live state is the end of the PREVIOUS round.
 */
export function buildGame(session, teamIdx, throughRound = null) {
  const horizon = throughRound ?? (
    session.stage === 'decision' ? session.round - 1 : session.round
  );
  const team = session.teams[teamIdx];
  const game = createGame({
    scenario: team.scenario,
    rounds: session.rounds,
    central_bank: session.central_bank,
    shocks: team.addedShocks.map(s => ({ round: s.round, shock: s.shock })),
  });
  for (const d of team.decisions) {
    if (d.round > horizon) break;
    game.setPolicies(d.policies);
    game.advanceRound();
  }
  return game;
}

/** Current live state of a team (after its last completed round). */
export function teamState(session, teamIdx) {
  return buildGame(session, teamIdx).getState();
}

/** Full history of a team (for trajectories + the mechanics appendix). */
export function teamHistory(session, teamIdx, throughRound = null) {
  return buildGame(session, teamIdx, throughRound).getHistory();
}

/** Cumulative green investment of a team (feeds the map's green share). */
export function greenCumulative(session, teamIdx) {
  return session.teams[teamIdx].decisions
    .reduce((sum, d) => sum + (d.policies.green_investment ?? 0), 0);
}

// ── Round flow ───────────────────────────────────────────────────────────────

export function leversForTeam(session, teamIdx) {
  return buildGame(session, teamIdx).getLevers();
}

/**
 * Records a team's decision for the current round and advances the queue.
 * Returns the updated session. Throws if the team is not at the queue head.
 */
export function submitDecision(session, teamIdx, policies, justification = '') {
  if (session.stage !== 'decision') throw new Error('Keine Entscheidungsphase.');
  if (session.queue[0] !== teamIdx) throw new Error('Dieses Team ist nicht an der Reihe.');

  const game = buildGame(session, teamIdx);
  game.setPolicies(policies); // validation lives in the engine
  const applied = game.getPendingPolicies();

  session.teams[teamIdx].decisions.push({
    round: session.round,
    policies: applied,
    justification: justification.trim(),
  });
  session.queue.shift();
  saveSession(session);
  return session;
}

/**
 * Resolves the round for ALL teams (called once the queue is empty):
 * every game advances exactly one round; evaluation data (states, objectives,
 * feedback, news articles) is materialized into the record.
 * News-event articles with effects schedule their shock for the next round.
 */
export function evaluateAll(session) {
  if (session.stage !== 'decision' || session.queue.length > 0) {
    throw new Error('Auswertung erst möglich, wenn alle Teams abgestimmt haben.');
  }
  const round = session.round;
  session.evaluation[round] = {};

  session.teams.forEach((team, teamIdx) => {
    // Replay up to the previous round, then apply THIS round's decision
    const game = buildGame(session, teamIdx, round - 1);
    const prevState = game.getState();
    const decision = team.decisions.find(d => d.round === round);
    game.setPolicies(decision?.policies ?? {});
    const result = game.advanceRound();

    const articles = selectArticles({
      prev: prevState, next: result.state, seed: team.seed, round, count: 2,
    });

    session.evaluation[round][teamIdx] = {
      prevState,
      state: result.state,
      objectives: result.objectives,
      feedback: result.feedback,
      shock: result.shock,
      articleIds: articles.map(a => a.id),
    };

    // News becomes reality: event articles inject their effects next round
    if (round + 1 <= session.rounds) {
      for (const article of articles) {
        if (article.effects) {
          team.addedShocks.push({
            round: round + 1,
            shock: {
              id: `news_${article.id}`,
              name: article.headline,
              description: 'Nachrichtenlage',
              effects: article.effects,
            },
          });
        }
      }
    }
  });

  session.stage = 'evaluation';
  saveSession(session);
  return session;
}

/** Advances to the next round (or closes the game after the last evaluation). */
export function advanceStage(session) {
  if (session.stage !== 'evaluation') throw new Error('Keine Auswertungsphase.');
  if (session.round >= session.rounds) {
    session.stage = 'done';
  } else {
    session.round += 1;
    session.stage = 'decision';
    session.queue = session.teams.map((_, i) => i);
    session.currentTeam = session.queue[0];
  }
  saveSession(session);
  return session;
}

/** All teams have submitted their decision for the current round. */
export function allDecided(session) {
  return session.stage === 'decision' && session.queue.length === 0;
}

// ── Pins (personal dashboard) ────────────────────────────────────────────────

export function setPins(session, teamIdx, pins) {
  session.teams[teamIdx].pins = pins.slice(0, 6);
  saveSession(session);
  return session;
}

export function setCurrentTeam(session, teamIdx) {
  session.currentTeam = teamIdx;
  saveSession(session);
  return session;
}