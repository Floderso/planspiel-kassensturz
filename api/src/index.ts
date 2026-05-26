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

type Member = {
  name: string;
  matrikelnummer: string;
  team: string;
  joined_at: string;
};

type SchockEvent = {
  periode:     number;
  id:          string;
  typ:         string;
  staerke:     number;
  name:        string;
  beschreibung:string;
  quelle?:     string;
  effekte:     Record<string, number>;
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
  admin_token: string;
  team_names: string[];
  matrikelnummern: string[];   // erlaubte Matrikelnummern (leer = keine Verifikation)
  members: Member[];
  teams: Record<string, TeamState>;
  schocks: SchockEvent[];      // externe Schockereignisse je Periode (Admin-gesetzt)
  perioden_laenge_jahre: number | number[];  // Länge je Periode in Jahren (Zahl oder Array)
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function generateId(len: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, len)
    .toUpperCase();
}

async function getSession(kv: KVNamespace, id: string): Promise<SessionData | null> {
  const raw = await kv.get(`session:${id}`);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

async function putSession(kv: KVNamespace, session: SessionData): Promise<void> {
  await kv.put(`session:${session.id}`, JSON.stringify(session), {
    expirationTtl: 86400,
  });
}

function requireToken(session: SessionData, token: string | undefined) {
  return token && token === session.admin_token;
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', async (c, next) => {
  const origins = c.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  return cors({ origin: origins, allowMethods: ['GET', 'POST', 'PUT'] })(c, next);
});

// ── Session-Endpunkte ─────────────────────────────────────────────────────────

/**
 * POST /api/sessions
 * Erstellt eine neue Spielsession.
 *
 * Body: { name, perioden_anzahl, team_groesse, team_names, min_teilnahme_quote, sandbox }
 * Response: { session_id, admin_token, join_url, admin_url }
 */
app.post('/api/sessions', async (c) => {
  const body = await c.req.json<Partial<SessionData> & { team_names?: string[] }>();
  const id          = generateId(6);
  const admin_token = generateId(32);
  const now         = new Date().toISOString();

  const defaultTeamNames = ['Team A', 'Team B', 'Team C'];
  const team_names = (body.team_names && body.team_names.length > 0)
    ? body.team_names
    : defaultTeamNames;

  // perioden_laenge_jahre: Zahl oder Array; Array-Elemente auf 1–20 begrenzen
  const rawLaengen = body.perioden_laenge_jahre ?? 4;
  const perioden_laenge_jahre: number | number[] = Array.isArray(rawLaengen)
    ? (rawLaengen as number[]).map(n => Math.max(1, Math.min(20, Number(n) || 4)))
    : Math.max(1, Math.min(20, Number(rawLaengen) || 4));

  const session: SessionData = {
    id,
    admin_token,
    name:                body.name               ?? 'Planspiel',
    perioden_anzahl:     body.perioden_anzahl     ?? 5,
    team_groesse:        body.team_groesse        ?? 4,
    min_teilnahme_quote: body.min_teilnahme_quote ?? 0.5,
    sandbox:             body.sandbox             ?? false,
    perioden_laenge_jahre,
    team_names,
    matrikelnummern:     [],
    members:             [],
    schocks:             [],
    created_at:          now,
    expires_at:          new Date(Date.now() + 86400_000).toISOString(),
    teams:               {},
  };

  await putSession(c.env.SESSIONS, session);

  // Origin gegen Whitelist prüfen bevor er in URLs verwendet wird
  const rawOrigin   = c.req.header('origin') ?? '';
  const allowedList = c.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  const origin      = allowedList.includes(rawOrigin) ? rawOrigin : allowedList[0] ?? '';
  const laengenParam = Array.isArray(perioden_laenge_jahre)
    ? perioden_laenge_jahre.join(',')
    : String(perioden_laenge_jahre);
  const baseParams  = `session=${id}&perioden=${session.perioden_anzahl}&teams=${session.team_groesse}&sandbox=${session.sandbox}&name=${encodeURIComponent(session.name)}&laengen=${laengenParam}`;
  const join_url    = `${origin}/planspiel-kassensturz/index.html?${baseParams}`;
  const admin_url   = `${origin}/planspiel-kassensturz/admin.html?session=${id}&token=${admin_token}`;

  return c.json({ session_id: id, admin_token, join_url, admin_url }, 201);
});

/**
 * GET /api/sessions/:id
 * Öffentlicher State — alle Teams, ohne admin_token und ohne members.
 */
app.get('/api/sessions/:id', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const { admin_token: _, members: __, ...pub } = session;
  return c.json(pub);
});

/**
 * GET /api/sessions/:id/admin?token=...
 * Vollständiger State inkl. members — nur für Lehrpersonen.
 */
app.get('/api/sessions/:id/admin', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(session, c.req.query('token'))) {
    return c.json({ error: 'Nicht autorisiert' }, 403);
  }
  const { admin_token: _, ...adminView } = session;
  return c.json(adminView);
});

// ── Matrikelnummer-Endpunkt ───────────────────────────────────────────────────

/**
 * PUT /api/sessions/:id/matrikelnummern?token=...
 * Ersetzt die erlaubte Matrikelnummern-Liste der Session (Admin only).
 * Wird nach CSV-Upload durch die Lehrperson aufgerufen.
 *
 * Body: { matrikelnummern: string[] }
 */
app.put('/api/sessions/:id/matrikelnummern', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(session, c.req.query('token'))) {
    return c.json({ error: 'Nicht autorisiert' }, 403);
  }

  const { matrikelnummern } = await c.req.json<{ matrikelnummern: string[] }>();
  if (!Array.isArray(matrikelnummern)) {
    return c.json({ error: 'matrikelnummern muss ein Array sein' }, 400);
  }

  // Normalisieren: nur Ziffern, Duplikate entfernen
  session.matrikelnummern = [...new Set(
    matrikelnummern.map(m => String(m).replace(/\D/g, '')).filter(m => m.length >= 4)
  )];

  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, count: session.matrikelnummern.length });
});

// ── Member-Endpunkte ──────────────────────────────────────────────────────────

/**
 * GET /api/sessions/:id/members
 * Öffentliche Mitgliederliste — für die Belegungsanzeige im Team-Picker.
 */
app.get('/api/sessions/:id/members', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const belegung: Record<string, number> = {};
  for (const name of session.team_names) belegung[name] = 0;
  for (const m of session.members) {
    belegung[m.team] = (belegung[m.team] ?? 0) + 1;
  }

  return c.json({
    team_names:   session.team_names,
    team_groesse: session.team_groesse,
    belegung,
    anzahl:       session.members.length,
  });
});

/**
 * POST /api/sessions/:id/members
 * Studierenden in Session registrieren und einem Team zuweisen.
 *
 * Body: { name, team }
 * Response: { ok, member }
 */
app.post('/api/sessions/:id/members', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const { name, matrikelnummer: rawMatrikel, team } =
    await c.req.json<{ name: string; matrikelnummer: string; team: string }>();

  const matrikelnummer = String(rawMatrikel ?? '').replace(/\D/g, '');

  if (!name?.trim())          return c.json({ error: 'Name darf nicht leer sein' }, 400);
  if (matrikelnummer.length < 4) return c.json({ error: 'Ungültige Matrikelnummer' }, 400);
  if (!session.team_names.includes(team)) {
    return c.json({ error: 'Ungültiges Team' }, 400);
  }

  // Matrikelnummer gegen Zulassungsliste prüfen (nur wenn Liste nicht leer)
  if (session.matrikelnummern.length > 0 && !session.matrikelnummern.includes(matrikelnummer)) {
    return c.json({ error: 'Diese Matrikelnummer ist nicht für diesen Kurs zugelassen.' }, 403);
  }

  // Idempotent: gleiche Matrikelnummer kann nur einmal beitreten
  const existing = session.members.find(m => m.matrikelnummer === matrikelnummer);
  if (existing) {
    if (existing.team !== team) {
      return c.json({ error: `Du bist bereits in ${existing.team} eingetragen.` }, 409);
    }
    return c.json({ ok: true, member: existing });
  }

  // Team-Kapazität prüfen
  const belegung = session.members.filter(m => m.team === team).length;
  if (belegung >= session.team_groesse) {
    return c.json({ error: 'Team ist voll' }, 409);
  }

  const member: Member = {
    name: name.trim(),
    matrikelnummer,
    team,
    joined_at: new Date().toISOString(),
  };
  session.members.push(member);
  await putSession(c.env.SESSIONS, session);

  return c.json({ ok: true, member }, 201);
});

// ── Team-Endpunkte ────────────────────────────────────────────────────────────

/**
 * PUT /api/sessions/:id/teams/:team
 * Speichert den State eines Teams (Parameter + locked-Status je Periode).
 */
app.put('/api/sessions/:id/teams/:team', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  if (!session.team_names.includes(teamName)) {
    return c.json({ error: 'Ungültiges Team' }, 400);
  }

  const body = await c.req.json<{ perioden: TeamPeriod[] }>();
  if (!Array.isArray(body.perioden) || body.perioden.length === 0) {
    return c.json({ error: 'perioden muss ein nicht-leeres Array sein' }, 400);
  }
  // Perioden-Struktur validieren
  for (const p of body.perioden) {
    if (typeof p.idx !== 'number' || typeof p.locked !== 'boolean' || typeof p.params !== 'object') {
      return c.json({ error: 'Ungültige Perioden-Struktur' }, 400);
    }
  }

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
 */
app.post('/api/sessions/:id/teams/:team/vote', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const { periode_idx } = await c.req.json<{ periode_idx: number }>();
  if (typeof periode_idx !== 'number' || !Number.isInteger(periode_idx) || periode_idx < 0) {
    return c.json({ error: 'periode_idx muss eine nicht-negative Ganzzahl sein' }, 400);
  }

  if (!session.teams[teamName]) {
    return c.json({ error: 'Team nicht in Session registriert' }, 400);
  }

  const periode = session.teams[teamName].perioden[periode_idx];
  if (!periode) return c.json({ error: 'Ungültiger Perioden-Index' }, 400);
  if (periode.locked) return c.json({ ok: true, locked: true, message: 'Periode bereits gesperrt' });

  const teamMembers = session.members.filter(m => m.team === teamName).length;
  const quorum      = Math.max(1, teamMembers);
  periode.votes     = Math.min(quorum, periode.votes + 1);

  if (session.sandbox || periode.votes >= Math.ceil(quorum * session.min_teilnahme_quote)) {
    periode.locked = true;
  }

  session.teams[teamName].last_updated = new Date().toISOString();
  await putSession(c.env.SESSIONS, session);

  return c.json({ ok: true, locked: periode.locked, votes: periode.votes });
});

/**
 * PUT /api/sessions/:id/teams/:team/lock?token=...
 * Admin setzt den locked-Status einer einzelnen Periode direkt.
 *
 * Body: { periode_idx: number, locked: boolean }
 */
app.put('/api/sessions/:id/teams/:team/lock', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(session, c.req.query('token'))) {
    return c.json({ error: 'Nicht autorisiert' }, 403);
  }

  const teamName = decodeURIComponent(c.req.param('team'));
  if (!session.team_names.includes(teamName)) {
    return c.json({ error: 'Ungültiges Team' }, 400);
  }
  if (!session.teams[teamName]) {
    return c.json({ error: 'Team hat noch keine Daten' }, 400);
  }

  const { periode_idx, locked } = await c.req.json<{ periode_idx: number; locked: boolean }>();
  if (typeof periode_idx !== 'number' || !Number.isInteger(periode_idx) || periode_idx < 0) {
    return c.json({ error: 'periode_idx muss eine nicht-negative Ganzzahl sein' }, 400);
  }

  const periode = session.teams[teamName].perioden[periode_idx];
  if (!periode) return c.json({ error: 'Ungültiger Perioden-Index' }, 400);

  periode.locked = locked === true;
  session.teams[teamName].last_updated = new Date().toISOString();
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, locked: periode.locked });
});

/**
 * PUT /api/sessions/:id/schocks?token=...
 * Setzt die Schockereignisse der Session (Admin only).
 * Teams erhalten die Schocks beim nächsten Polling-Zyklus (GET /sessions/:id).
 *
 * Body: { schocks: SchockEvent[] }
 */
app.put('/api/sessions/:id/schocks', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(session, c.req.query('token'))) {
    return c.json({ error: 'Nicht autorisiert' }, 403);
  }

  const { schocks } = await c.req.json<{ schocks: SchockEvent[] }>();
  if (!Array.isArray(schocks)) {
    return c.json({ error: 'schocks muss ein Array sein' }, 400);
  }

  session.schocks = schocks.filter(s =>
    typeof s.periode === 'number' && typeof s.id === 'string' && s.effekte
  );
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, count: session.schocks.length });
});

/**
 * GET /api/sessions/:id/results
 * Parameter aller Teams — Frontend berechnet KPIs client-seitig.
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
    team_names:      session.team_names,
    teams:           results,
  });
});

export default app;
