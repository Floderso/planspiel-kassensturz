// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Planspiel API
// Backend für Session-Management und Multi-Team-Voting
// Stack: Hono.js auf Cloudflare Workers + Cloudflare KV
// Dokumentation: ../docs/API.md · ../docs/DEPLOYMENT.md
// ═══════════════════════════════════════════════════════

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ── Typen ─────────────────────────────────────────────────────────────────────

type Env = {
  SESSIONS: KVNamespace;
  ALLOWED_ORIGINS: string;
};

/** Politikparameter einer Periode — spiegelt SLIDER_SECTIONS in planspiel.js */
type PeriodParams = {
  freibetrag: number;
  eingang: number;
  spitze: number;
  mwst: number;
  mwst_erm: number;
  co2: number;
  kst: number;
  gewst: number;
  rv: number;
  kv: number;
  bbg: number;
  invest_impuls: number;
};

type TeamPeriod = {
  idx: number;
  locked: boolean;
  params: PeriodParams;
  votes: number;
};

type TeamState = {
  perioden: TeamPeriod[];
  last_updated: string;
};

type SessionData = {
  id: string;
  name: string;
  perioden_anzahl: number;
  team_groesse: number;
  min_teilnahme_quote: number;
  sandbox: boolean;
  created_at: string;
  expires_at: string;
  teams: Record<string, TeamState>;
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/** Erzeugt eine zufällige 6-stellige alphanumerische Session-ID */
function generateSessionId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function getSession(kv: KVNamespace, id: string): Promise<SessionData | null> {
  const raw = await kv.get(`session:${id}`);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

async function putSession(kv: KVNamespace, session: SessionData): Promise<void> {
  // TTL: 24 Stunden (86400 Sekunden) — Sessions laufen automatisch ab
  await kv.put(`session:${session.id}`, JSON.stringify(session), {
    expirationTtl: 86400,
  });
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

// CORS: erlaubt nur konfigurierte Ursprünge (wrangler.toml → ALLOWED_ORIGINS)
app.use('/api/*', async (c, next) => {
  const origins = c.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  return cors({ origin: origins, allowMethods: ['GET', 'POST', 'PUT'] })(c, next);
});

// ── Endpunkte ─────────────────────────────────────────────────────────────────

/**
 * POST /api/sessions
 * Erstellt eine neue Spielsession für eine Lehrveranstaltung.
 *
 * Body: { name, perioden_anzahl, team_groesse, min_teilnahme_quote, sandbox }
 * Response: { session_id, join_url }
 */
app.post('/api/sessions', async (c) => {
  const body = await c.req.json<Partial<SessionData>>();
  const id = generateSessionId();
  const now = new Date().toISOString();

  const session: SessionData = {
    id,
    name:                 body.name               ?? 'Planspiel',
    perioden_anzahl:      body.perioden_anzahl     ?? 5,
    team_groesse:         body.team_groesse        ?? 4,
    min_teilnahme_quote:  body.min_teilnahme_quote ?? 0.5,
    sandbox:              body.sandbox             ?? false,
    created_at:           now,
    expires_at:           new Date(Date.now() + 86400_000).toISOString(),
    teams:                {},
  };

  await putSession(c.env.SESSIONS, session);

  const origin = c.req.header('origin') ?? '';
  const join_url = `${origin}?session=${id}&perioden=${session.perioden_anzahl}&teams=${session.team_groesse}&sandbox=${session.sandbox}&name=${encodeURIComponent(session.name)}`;

  return c.json({ session_id: id, join_url }, 201);
});

/**
 * GET /api/sessions/:id
 * Gibt den vollständigen Session-State zurück (alle Teams).
 * Wird vom Frontend alle 5 Sekunden gepolt (→ ADR 004).
 */
app.get('/api/sessions/:id', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  return c.json(session);
});

/**
 * PUT /api/sessions/:id/teams/:team
 * Speichert den State eines Teams (Parameter + locked-Status je Periode).
 * Wird nach jeder Parameteränderung und beim Abschließen einer Periode aufgerufen.
 *
 * Body: { perioden: TeamPeriod[] }
 */
app.put('/api/sessions/:id/teams/:team', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const body = await c.req.json<{ perioden: TeamPeriod[] }>();

  session.teams[teamName] = {
    perioden:     body.perioden,
    last_updated: new Date().toISOString(),
  };

  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true });
});

/**
 * POST /api/sessions/:id/teams/:team/vote
 * Registriert eine Stimme für den Perioden-Abschluss.
 * Wenn Quorum erreicht: Periode wird automatisch gesperrt.
 *
 * Body: { periode_idx: number }
 */
app.post('/api/sessions/:id/teams/:team/vote', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const { periode_idx } = await c.req.json<{ periode_idx: number }>();

  if (!session.teams[teamName]) {
    return c.json({ error: 'Team nicht in Session registriert' }, 400);
  }

  const periode = session.teams[teamName].perioden[periode_idx];
  if (!periode) return c.json({ error: 'Ungültiger Perioden-Index' }, 400);
  if (periode.locked) return c.json({ ok: true, locked: true, message: 'Periode bereits gesperrt' });

  periode.votes = Math.min(session.team_groesse, periode.votes + 1);

  const minVotes = Math.ceil(session.team_groesse * session.min_teilnahme_quote);
  if (session.sandbox || periode.votes >= minVotes) {
    periode.locked = true;
  }

  session.teams[teamName].last_updated = new Date().toISOString();
  await putSession(c.env.SESSIONS, session);

  return c.json({ ok: true, locked: periode.locked, votes: periode.votes });
});

/**
 * GET /api/sessions/:id/results
 * Gibt die abgeschlossenen Parameter aller Teams zurück — für den Ergebnis-Vergleich.
 * Das Frontend berechnet die Simulation aus diesen Parametern neu.
 */
app.get('/api/sessions/:id/results', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const results: Record<string, TeamPeriod[]> = {};
  for (const [team, state] of Object.entries(session.teams)) {
    results[team] = state.perioden;
  }

  return c.json({
    session_id:      session.id,
    name:            session.name,
    perioden_anzahl: session.perioden_anzahl,
    teams:           results,
  });
});

export default app;
