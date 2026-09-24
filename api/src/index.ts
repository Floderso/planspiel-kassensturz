// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Planspiel API
// Backend für Session-Management und Multi-Team-Voting
// Stack: Hono.js auf Cloudflare Workers + Cloudflare KV
// Dokumentation: ../docs/API.md · ../docs/DEPLOYMENT.md
// ═══════════════════════════════════════════════════════

import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';

// ── Typen ─────────────────────────────────────────────────────────────────────

type Env = {
  SESSIONS: KVNamespace;
  ALLOWED_ORIGINS: string;
};

import type {
  PeriodParams, TeamPeriod, Member, Lernziel, SchockEvent, SessionData, Aenderung,
  Vorlage, Stimme, Schaustueck,
} from './typen.js';
import { kvSpeicher } from './speicher/kv.js';
import { KURS_LEBENSDAUER_SEKUNDEN } from './speicher/schnittstelle.js';
import { pruefeAnzeigename } from './namenspruefung.js';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function generateId(len: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, len)
    .toUpperCase();
}

/**
 * Der Speicher dieser Umgebung.
 *
 * Ab hier kennt kein Endpunkt mehr KV. Wer auf einen Uni-Server umzieht,
 * tauscht `kvSpeicher` gegen `sqliteSpeicher` — siehe ADR 006 und
 * src/speicher/schnittstelle.ts.
 * dieselbe Form wie bisher, damit die Endpunkte gleich bleiben. */
async function getSession(kv: KVNamespace, id: string): Promise<SessionData | null> {
  return kvSpeicher(kv).liesKurs(id);
}

async function putSession(kv: KVNamespace, session: SessionData): Promise<void> {
  return kvSpeicher(kv).schreibKurs(session);
}

/**
 * Prueft den Admin-Zugang.
 *
 * Der Token kommt bevorzugt aus dem Authorization-Header. Query-Parameter
 * landen in Serverprotokollen, im Browserverlauf und beim Weiterleiten in
 * fremden Haenden — deshalb ist ?token= nur noch Rueckfallebene fuer Links,
 * die vor dieser Umstellung erzeugt wurden. Siehe entwurf/BETRIEB.md 1.5.
 */
function requireToken(c: Context<{ Bindings: Env }>, session: SessionData) {
  const kopf = c.req.header('Authorization');
  const ausKopf = kopf?.startsWith('Bearer ') ? kopf.slice(7).trim() : undefined;
  const token = ausKopf || c.req.query('token');
  return Boolean(token) && token === session.admin_token;
}

// ── App ───────────────────────────────────────────────────────────────────────

/**
 * Version dieses Dienstes. Muss zu api/package.json passen — beim Anheben
 * bitte beide Stellen ziehen. Erscheint in der Antwort von /health, damit im
 * Betrieb erkennbar ist, welcher Stand tatsaechlich laeuft.
 */
const VERSION = '1.0.0';

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', async (c, next) => {
  const origins = c.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  return cors({
    origin:       origins,
    // DELETE fehlte bis zum 23.09.2026. Es fiel nicht auf, solange keine
    // Oberflaeche eine DELETE-Route aufrief; seit den Notfallwerkzeugen tut
    // sie es. Der Browser scheitert dann am Preflight, und der Aufruf sieht
    // aus wie ein Netzwerkfehler — die irrefuehrendste Fehlermeldung von allen.
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    // Ohne Authorization hier scheitert jeder Admin-Aufruf am Preflight.
    allowHeaders: ['Content-Type', 'Authorization'],
  })(c, next);
});

// ── Betriebsendpunkt ──────────────────────────────────────────────────────────

/**
 * GET /health
 * Sagt, ob der Dienst laeuft — fuer Monitoring und nach jedem Ausrollen.
 * Bewusst ausserhalb von /api/* (kein CORS) und ohne jede Sitzungsinformation:
 * die Antwort ist oeffentlich sichtbar und darf nichts verraten.
 *
 * Mit ?speicher=1 wird zusaetzlich geprueft, ob die Speicherbindung antwortet.
 * Der Lesezugriff geht auf einen Schluessel, den es nie gibt — er prueft die
 * Bindung, ohne Daten zu beruehren.
 */
app.get('/health', async (c) => {
  const antwort: Record<string, unknown> = {
    status:  'ok',
    version: VERSION,
    zeit:    new Date().toISOString(),
  };

  if (c.req.query('speicher') === '1') {
    try {
      await c.env.SESSIONS.get('health:probe');
      antwort.speicher = 'ok';
    } catch (_) {
      antwort.status   = 'fehler';
      antwort.speicher = 'nicht erreichbar';
      return c.json(antwort, 503);
    }
  }

  return c.json(antwort);
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

  // Grenzen wie in der Einrichtung (einrichtung.html). Wer die API direkt
  // anspricht, soll keinen Kurs anlegen koennen, den keine Flaeche spielt.
  const ganz = (v: unknown, von: number, bis: number, sonst: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= von && n <= bis ? n : sonst;
  };
  const QUOREN = ['einfach', 'absolut', 'einstimmig'] as const;
  const ressorts = Array.isArray(body.ressorts)
    ? [...new Set(body.ressorts.map(String))].slice(0, 12) : [];
  if (Array.isArray(body.ressorts) && ressorts.length < 2) {
    return c.json({ error: 'Ein Tisch braucht mindestens zwei Ressorts' }, 400);
  }

  const session: SessionData = {
    id,
    admin_token,
    name:                String(body.name ?? 'Planspiel').slice(0, 120) || 'Planspiel',
    perioden_anzahl:     ganz(body.perioden_anzahl, 1, 12, 5),
    team_groesse:        ganz(body.team_groesse, 1, 12, 4),
    min_teilnahme_quote: body.min_teilnahme_quote ?? 0.5,
    sandbox:             body.sandbox             ?? false,
    perioden_laenge_jahre,
    team_names,
    ressorts:            ressorts.length > 0 ? ressorts : ['fin', 'wir', 'soz', 'umw'],
    zuordnung_offen:     true,
    quorum:              QUOREN.includes(body.quorum as typeof QUOREN[number])
      ? body.quorum : 'einfach',
    matrikelnummern:     [],
    members:             [],
    schocks:             [],
    lernziele:            Array.isArray(body.lernziele) ? (body.lernziele as Lernziel[]) : [],
    perioden_freigegeben: 1,
    perioden_werkzeuge:   body.perioden_werkzeuge && typeof body.perioden_werkzeuge === 'object' ? body.perioden_werkzeuge : undefined,
    created_at:           now,
    expires_at:           new Date(Date.now() + KURS_LEBENSDAUER_SEKUNDEN * 1000).toISOString(),
    teams:                {},
  };

  await putSession(c.env.SESSIONS, session);

  // Origin gegen Whitelist prüfen bevor er in URLs verwendet wird
  const rawOrigin   = c.req.header('origin') ?? '';
  const allowedList = c.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  const origin      = allowedList.includes(rawOrigin) ? rawOrigin : allowedList[0] ?? '';
  const laengenParam = Array.isArray(perioden_laenge_jahre)
    ? perioden_laenge_jahre.join(',')
    : String(perioden_laenge_jahre);
  const werkzeugeParam = session.perioden_werkzeuge ? `&werkzeuge=${encodeURIComponent(JSON.stringify(session.perioden_werkzeuge))}` : '';
  const baseParams  = `session=${id}&perioden=${session.perioden_anzahl}&teams=${session.team_groesse}&sandbox=${session.sandbox}&name=${encodeURIComponent(session.name)}&laengen=${laengenParam}${werkzeugeParam}`;
  const join_url    = `${origin}/planspiel-kassensturz/index.html?${baseParams}`;
  // Token als Fragment (#), nicht als Query (?): Fragmente werden vom Browser
  // nicht an den Server geschickt und tauchen daher in keinem Protokoll auf.
  const admin_url   = `${origin}/planspiel-kassensturz/admin.html?session=${id}#token=${admin_token}`;

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
  if (!requireToken(c, session)) {
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
  if (!requireToken(c, session)) {
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

  // Die Oberflaeche schickt ihre Entscheidungen, nicht den Verhandlungsstand.
  // Zeichnungen und Einsprueche gehoeren dem Server — wuerde dieser PUT sie
  // mitersetzen, loeschte jedes Speichern eines Geraets die Unterschriften
  // der drei anderen.
  const vorher     = session.teams[teamName]?.perioden ?? [];
  const bestand    = session.teams[teamName];
  session.teams[teamName] = {
    // Was dem TEAM gehoert und nicht der Oberflaeche: Anzeigename und
    // Schaukaesten ueberleben jedes Speichern.
    anzeigename:    bestand?.anzeigename,
    namensversuche: bestand?.namensversuche,
    schaukaesten:   bestand?.schaukaesten,
    perioden: body.perioden.map(neu => {
      const alt = vorher.find(p => p.idx === neu.idx);
      return {
        ...neu,
        votes:         alt?.votes ?? neu.votes ?? 0,
        zeichnungen:   alt?.zeichnungen ?? {},
        einsprueche:   alt?.einsprueche ?? {},
        // Vorlagen und Begruendungen gehoeren dem Server, genau wie die
        // Unterschriften. Wuerde dieser PUT sie mitersetzen, loeschte jedes
        // Speichern eines Geraets die Vorlagen der drei anderen — und in der
        // Auswertung stuende hinterher nichts.
        vorlagen:      alt?.vorlagen ?? {},
        begruendungen: alt?.begruendungen ?? {},
        locked:        alt?.locked || neu.locked,
      };
    }),
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

// ── Aufstellung: Team, Ressort, Anzeigename ────────────────────────────────
//
// Drei Vorgaenge, die vor dem ersten Spielzug liegen. Alle drei aendern den
// Kurs, nicht nur ein Team — darum laufen sie ueber `aendereKurs`, das
// Kollisionen wenigstens erkennt (siehe src/speicher/kv.ts).

/** Wie viele Personen in einem Team sitzen. */
const belegungVon = (session: SessionData, team: string) =>
  session.members.filter(m => m.team === team && m.zustand !== 'ausgeschieden').length;

/**
 * GET /api/sessions/:id/aufstellung
 * Wer sitzt wo, welche Ressorts sind frei — ohne fremde Matrikelnummern.
 */
app.get('/api/sessions/:id/aufstellung', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  return c.json({
    zuordnung_offen: session.zuordnung_offen !== false,
    team_groesse:    session.team_groesse,
    ressorts:        session.ressorts,
    teams: session.team_names.map(name => ({
      name,
      anzeigename: session.teams[name]?.anzeigename ?? null,
      belegung:    belegungVon(session, name),
      // Nur Vorname und Ressort — der volle Name und die Matrikelnummer
      // gehen niemanden ausserhalb des Teams etwas an.
      plaetze: session.members
        .filter(m => m.team === name && m.zustand !== 'ausgeschieden')
        .map(m => ({ vorname: m.name.split(' ')[0], rolle: m.rolle ?? null })),
    })),
  });
});

/**
 * PUT /api/sessions/:id/members/:matrikel/team
 * Das Team wechseln. Nur solange die Zuordnung offen ist.
 */
app.put('/api/sessions/:id/members/:matrikel/team', async (c) => {
  const kursId   = c.req.param('id');
  const matrikel = c.req.param('matrikel').replace(/\D/g, '');
  const { team } = await c.req.json<{ team: string }>();

  type Erg = Aenderung<{ team: string }>;
  const antwort = await kvSpeicher(c.env.SESSIONS).aendereKurs<Erg>(kursId, (session) => {
    const nein = (fehler: string, status: 400 | 404 | 409): { kurs: SessionData; ergebnis: Erg } =>
      ({ kurs: session, ergebnis: { ok: false, fehler, status } });

    if (session.zuordnung_offen === false) return nein('Die Teamzuordnung ist geschlossen.', 409);
    if (!session.team_names.includes(team)) return nein('Unbekanntes Team', 400);
    const person = session.members.find(m => m.matrikelnummer === matrikel);
    if (!person) return nein('Nicht in dieser Sitzung angemeldet', 404);
    if (person.team === team) return { kurs: session, ergebnis: { ok: true, team } };
    if (belegungVon(session, team) >= session.team_groesse) return nein(`${team} ist voll.`, 409);
    // Der Wechsel gibt das bisherige Ressort frei — es gehoert zum Team,
    // nicht zur Person.
    person.team  = team;
    person.rolle = undefined;
    return { kurs: session, ergebnis: { ok: true, team } };
  });

  if ('fehler' in antwort) return c.json({ error: 'Sitzung nicht erreichbar' }, 503);
  const e = antwort.ergebnis;
  if (!e.ok) return c.json({ error: e.fehler }, e.status);
  return c.json({ ok: true, team: e.team });
});

/**
 * PUT /api/sessions/:id/members/:matrikel/rolle
 * Ein Ressort im eigenen Team belegen oder freigeben (`rolle: null`).
 */
app.put('/api/sessions/:id/members/:matrikel/rolle', async (c) => {
  const kursId   = c.req.param('id');
  const matrikel = c.req.param('matrikel').replace(/\D/g, '');
  const { rolle } = await c.req.json<{ rolle: string | null }>();

  type Erg = Aenderung<{ rolle: string | null }>;
  const antwort = await kvSpeicher(c.env.SESSIONS).aendereKurs<Erg>(kursId, (session) => {
    const nein = (fehler: string, status: 400 | 404 | 409): { kurs: SessionData; ergebnis: Erg } =>
      ({ kurs: session, ergebnis: { ok: false, fehler, status } });

    const person = session.members.find(m => m.matrikelnummer === matrikel);
    if (!person) return nein('Nicht in dieser Sitzung angemeldet', 404);
    if (rolle === null) {
      person.rolle = undefined;
      return { kurs: session, ergebnis: { ok: true, rolle: null } };
    }
    if (!session.ressorts.includes(rolle)) return nein(`Unbekanntes Ressort: ${rolle}`, 400);
    // Jedes Ressort genau einmal je Team.
    const besetzt = session.members.find(
      m => m.team === person.team && m.rolle === rolle && m.matrikelnummer !== matrikel
        && m.zustand !== 'ausgeschieden');
    if (besetzt) return nein(`${besetzt.name.split(' ')[0]} hat dieses Ressort schon.`, 409);
    person.rolle = rolle;
    return { kurs: session, ergebnis: { ok: true, rolle } };
  });

  if ('fehler' in antwort) return c.json({ error: 'Sitzung nicht erreichbar' }, 503);
  const e = antwort.ergebnis;
  if (!e.ok) return c.json({ error: e.fehler }, e.status);
  return c.json({ ok: true, rolle: e.rolle });
});

/**
 * PUT /api/sessions/:id/teams/:team/anzeigename
 * Den frei gewaehlten Namen setzen. Erst wenn die Zuordnung geschlossen ist —
 * vorher wuesste niemand, wer eigentlich mitbenennt.
 */
app.put('/api/sessions/:id/teams/:team/anzeigename', async (c) => {
  const kursId   = c.req.param('id');
  const teamName = decodeURIComponent(c.req.param('team'));
  const { name } = await c.req.json<{ name: string }>();

  const befund = pruefeAnzeigename(name);

  type Erg = Aenderung<{ anzeigename: string }>;
  const antwort = await kvSpeicher(c.env.SESSIONS).aendereKurs<Erg>(kursId, (session) => {
    const nein = (fehler: string, status: 400 | 409 | 422): { kurs: SessionData; ergebnis: Erg } =>
      ({ kurs: session, ergebnis: { ok: false, fehler, status } });

    if (!session.team_names.includes(teamName)) return nein('Unbekanntes Team', 400);
    if (session.zuordnung_offen !== false) {
      return nein('Der Name lässt sich erst vergeben, wenn die Zuordnung geschlossen ist.', 409);
    }
    session.teams[teamName] ??= { perioden: [], last_updated: new Date().toISOString() };
    const team = session.teams[teamName];

    if (!befund.ok) {
      team.namensversuche = (team.namensversuche ?? 0) + 1;
      return nein(befund.grund, 422);
    }
    team.anzeigename  = befund.name;
    team.last_updated = new Date().toISOString();
    return { kurs: session, ergebnis: { ok: true, anzeigename: befund.name } };
  });

  if ('fehler' in antwort) return c.json({ error: 'Sitzung nicht erreichbar' }, 503);
  const e = antwort.ergebnis;
  if (!e.ok) return c.json({ error: e.fehler }, e.status);
  return c.json({ ok: true, anzeigename: e.anzeigename });
});

/**
 * PUT /api/sessions/:id/zuordnung?token=...
 * Die Lehrperson schliesst (oder oeffnet) die Teamzuordnung.
 */
app.put('/api/sessions/:id/zuordnung', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(c, session)) return c.json({ error: 'Nicht autorisiert' }, 403);

  const { offen } = await c.req.json<{ offen: boolean }>();
  session.zuordnung_offen = Boolean(offen);
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, zuordnung_offen: session.zuordnung_offen });
});

// ── Perioden steuern (E4) ──────────────────────────────────────────────────

/**
 * PUT /api/sessions/:id/perioden/:idx?token=...
 * Laenge und Frist EINER Periode setzen.
 *
 * Body: { laenge_jahre?: number, frist?: string | null }
 */
app.put('/api/sessions/:id/perioden/:idx', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(c, session)) return c.json({ error: 'Nicht autorisiert' }, 403);

  const idx = Number(c.req.param('idx'));
  if (!Number.isInteger(idx) || idx < 0 || idx >= session.perioden_anzahl) {
    return c.json({ error: `Periode muss zwischen 0 und ${session.perioden_anzahl - 1} liegen` }, 400);
  }
  const { laenge_jahre, frist } = await c.req.json<{ laenge_jahre?: number; frist?: string | null }>();

  if (laenge_jahre !== undefined) {
    if (!Number.isInteger(laenge_jahre) || laenge_jahre < 1 || laenge_jahre > 20) {
      return c.json({ error: 'Die Länge muss zwischen 1 und 20 Jahren liegen' }, 400);
    }
    // Eine einzelne Zahl wird zum Array, sobald eine Periode abweicht.
    const alle = Array.isArray(session.perioden_laenge_jahre)
      ? [...session.perioden_laenge_jahre]
      : Array.from({ length: session.perioden_anzahl }, () => session.perioden_laenge_jahre as number);
    while (alle.length < session.perioden_anzahl) alle.push(alle[alle.length - 1] ?? 4);
    alle[idx] = laenge_jahre;
    session.perioden_laenge_jahre = alle;
    vermerke(session, `Periode ${idx + 1}: Länge auf ${laenge_jahre} Jahre gesetzt`);
  }

  if (frist !== undefined) {
    session.fristen ??= {};
    if (frist === null || frist === '') {
      delete session.fristen[idx];
      vermerke(session, `Periode ${idx + 1}: Frist entfernt`);
    } else if (Number.isNaN(Date.parse(frist))) {
      return c.json({ error: 'Die Frist ist kein gültiger Zeitpunkt' }, 400);
    } else {
      session.fristen[idx] = new Date(frist).toISOString();
      vermerke(session, `Periode ${idx + 1}: Frist auf ${new Date(frist).toLocaleString('de-DE')} gesetzt`);
    }
  }

  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, perioden_laenge_jahre: session.perioden_laenge_jahre,
                  fristen: session.fristen ?? {} });
});

// ── Der Schaukasten (B1b / C3) ─────────────────────────────────────────────

const SCHAU_ARTEN = ['zeitreihe', 'vergleich', 'dezile', 'haushalt', 'beschluesse',
                     'nichtstun', 'zahl'];
const SCHAU_HOECHSTENS = 5;

/**
 * PUT /api/sessions/:id/teams/:team/schaukasten/:ressort
 * Die selbst zusammengestellte Auswertung eines Ressorts.
 *
 * Body: { stuecke: Schaustueck[] }
 *
 * Die Obergrenze von fuenf ist kein technisches Limit — sie ist der
 * eigentliche Dienst an der Sache. Wer alles zeigen darf, waehlt nicht aus.
 */
app.put('/api/sessions/:id/teams/:team/schaukasten/:ressort', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const ressort  = decodeURIComponent(c.req.param('ressort'));
  if (!session.team_names.includes(teamName)) return c.json({ error: 'Unbekanntes Team' }, 400);
  if (!session.ressorts.includes(ressort)) {
    return c.json({ error: `Unbekanntes Ressort: ${ressort}` }, 400);
  }

  const { stuecke } = await c.req.json<{ stuecke: Schaustueck[] }>();
  if (!Array.isArray(stuecke)) return c.json({ error: 'stuecke muss ein Array sein' }, 400);
  if (stuecke.length > SCHAU_HOECHSTENS) {
    return c.json({ error: `Höchstens ${SCHAU_HOECHSTENS} Stücke.` }, 422);
  }
  for (const s of stuecke) {
    if (!SCHAU_ARTEN.includes(s?.art)) {
      return c.json({ error: `Unbekannte Art: ${s?.art}` }, 400);
    }
  }

  session.teams[teamName] ??= { perioden: [], last_updated: new Date().toISOString() };
  const team = session.teams[teamName];
  team.schaukaesten = { ...(team.schaukaesten ?? {}) };
  team.schaukaesten[ressort] = stuecke.map(s => ({
    art:      s.art,
    kennzahl: s.kennzahl ? String(s.kennzahl).slice(0, 24) : undefined,
    periode:  typeof s.periode === 'number' ? s.periode : undefined,
    text:     String(s.text ?? '').trim().slice(0, 240),
  }));
  team.last_updated = new Date().toISOString();

  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, stuecke: team.schaukaesten[ressort] });
});

// ── Notfallwerkzeuge der Lehrperson ────────────────────────────────────────
//
// Der erste Kurs, in dem jemand nicht weiterkommt und niemand helfen kann,
// ist ein verlorener Seminartermin. Darum stehen diese Endpunkte frueh —
// sie sind kein Komfort, sie sind die Feuerwehr.
//
// Jeder Eingriff braucht den Admin-Token und hinterlaesst eine Spur.

/** Ein Vermerk ueber einen Eingriff. Auch zum Schutz der Lehrperson. */
function vermerke(session: SessionData, was: string) {
  session.eingriffe ??= [];
  session.eingriffe.push({ was, at: new Date().toISOString() });
  if (session.eingriffe.length > 200) session.eingriffe.shift();
}

/**
 * PUT /api/sessions/:id/zulassung/:matrikel?token=...
 * Nachzuegler einzeln zulassen — „das ist meine Matrikelnummer, ich stand
 * nicht auf der Liste". Ohne die ganze Liste neu zu laden.
 */
app.put('/api/sessions/:id/zulassung/:matrikel', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(c, session)) return c.json({ error: 'Nicht autorisiert' }, 403);

  const matrikel = c.req.param('matrikel').replace(/\D/g, '');
  if (matrikel.length < 4) return c.json({ error: 'Ungültige Matrikelnummer' }, 400);
  if (session.matrikelnummern.includes(matrikel)) {
    return c.json({ ok: true, schon_da: true });
  }
  session.matrikelnummern.push(matrikel);
  vermerke(session, `Nachzügler zugelassen: ${matrikel}`);
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, anzahl: session.matrikelnummern.length });
});

/**
 * DELETE /api/sessions/:id/personen/:matrikel?token=...
 * Aus dem Kurs entfernen.
 *
 * Die Person wird NICHT geloescht, sondern auf 'ausgeschieden' gesetzt:
 * Stimmen und Vorlagen aus abgeschlossenen Perioden muessen stehen bleiben,
 * sonst waere das Protokoll nachtraeglich umgeschrieben. Die Matrikelnummer
 * bleibt zugelassen — sonst sperrt ein Versehen die Person dauerhaft aus.
 */
app.delete('/api/sessions/:id/personen/:matrikel', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(c, session)) return c.json({ error: 'Nicht autorisiert' }, 403);

  const matrikel = c.req.param('matrikel').replace(/\D/g, '');
  const person = session.members.find(m => m.matrikelnummer === matrikel);
  if (!person) return c.json({ error: 'Nicht in dieser Sitzung' }, 404);

  const warTeam = person.team, warRolle = person.rolle;
  person.zustand = 'ausgeschieden';
  person.rolle   = undefined;      // das Ressort gehoert dem Team, nicht der Person

  // Stimmen der LAUFENDEN Periode verfallen — eine Stimme ohne Person ist
  // keine. Abgeschlossene Perioden bleiben unberuehrt.
  // `findLast` gibt es erst ab ES2023; das tsconfig steht auf ES2022.
  // Rueckwaerts suchen tut dasselbe und braucht keine Umstellung.
  const team = session.teams[warTeam];
  const offene = [...(team?.perioden ?? [])].reverse().find(pp => !pp.locked);
  if (offene && warRolle) {
    for (const v of Object.values(offene.vorlagen ?? {})) delete v.stimmen[warRolle];
    const eigene = offene.vorlagen?.[warRolle];
    if (eigene?.stand === 'eingebracht') eigene.stand = 'zurueckgezogen';
  }

  vermerke(session, `Entfernt: ${person.name} (${matrikel}) aus ${warTeam}`);
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, team: warTeam, rolle: warRolle ?? null });
});

/**
 * PUT /api/sessions/:id/personen/:matrikel/umsetzen?token=...
 * In ein anderes Team setzen — auch wenn die Zuordnung geschlossen ist.
 * Body: { team }
 */
app.put('/api/sessions/:id/personen/:matrikel/umsetzen', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(c, session)) return c.json({ error: 'Nicht autorisiert' }, 403);

  const matrikel = c.req.param('matrikel').replace(/\D/g, '');
  const { team } = await c.req.json<{ team: string }>();
  const person = session.members.find(m => m.matrikelnummer === matrikel);
  if (!person) return c.json({ error: 'Nicht in dieser Sitzung' }, 404);
  if (!session.team_names.includes(team)) return c.json({ error: 'Unbekanntes Team' }, 400);

  const belegt = session.members.filter(
    m => m.team === team && m.zustand !== 'ausgeschieden').length;
  if (belegt >= session.team_groesse) return c.json({ error: `${team} ist voll.` }, 409);

  const vorher = person.team;
  person.team    = team;
  person.rolle   = undefined;
  person.zustand = 'aktiv';
  vermerke(session, `Umgesetzt: ${person.name} von ${vorher} nach ${team}`);
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, team });
});

/**
 * DELETE /api/sessions/:id/teams/:team/ressort/:rolle?token=...
 * Ein Ressort freigeben, wenn jemand das falsche genommen hat und weg ist.
 */
app.delete('/api/sessions/:id/teams/:team/ressort/:rolle', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(c, session)) return c.json({ error: 'Nicht autorisiert' }, 403);

  const teamName = decodeURIComponent(c.req.param('team'));
  const rolle    = decodeURIComponent(c.req.param('rolle'));
  const person = session.members.find(m => m.team === teamName && m.rolle === rolle);
  if (!person) return c.json({ error: 'Dieses Ressort ist nicht belegt' }, 404);

  person.rolle = undefined;
  vermerke(session, `Ressort ${rolle} in ${teamName} freigegeben (war ${person.name})`);
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true });
});

/**
 * DELETE /api/sessions/:id/teams/:team/anzeigename?token=...
 * Einen unpassenden Teamnamen zuruecksetzen. Der Systemname bleibt.
 */
app.delete('/api/sessions/:id/teams/:team/anzeigename', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(c, session)) return c.json({ error: 'Nicht autorisiert' }, 403);

  const teamName = decodeURIComponent(c.req.param('team'));
  const team = session.teams[teamName];
  if (!team?.anzeigename) return c.json({ ok: true, schon_leer: true });

  vermerke(session, `Anzeigename von ${teamName} zurückgesetzt („${team.anzeigename}")`);
  team.anzeigename = undefined;
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true });
});

// ── Vorlagen und Abstimmung ────────────────────────────────────────────────
//
// Der Kern des Ausbaus. Ein Ressort bringt eine Vorlage ein; ALLE Ressorts
// stimmen darueber ab. Das ist der Lerninhalt: man muss die eigene Politik
// den anderen erklaeren und eine Mehrheit dafuer finden.
//
// Ausgewertet wird erst, wenn alle gestimmt haben. Frueher auszuwerten waere
// schneller, aber im Seminar verwirrend — eine Vorlage waere entschieden,
// bevor alle geredet haben.

/** Zaehlt die Stimmen und sagt, ob und wie entschieden ist. */
function werteAus(session: SessionData, vorlage: Vorlage) {
  const abgegeben = Object.values(vorlage.stimmen);
  const fehlen    = session.ressorts.filter(r => !vorlage.stimmen[r]);
  const ja  = abgegeben.filter(s => s.stimme === 'ja').length;
  const nein = abgegeben.filter(s => s.stimme === 'nein').length;
  const enthaltung = abgegeben.filter(s => s.stimme === 'enthaltung').length;

  if (fehlen.length > 0) {
    return { ja, nein, enthaltung, fehlen, entschieden: false as const };
  }
  const regel = session.quorum ?? 'einfach';
  const angenommen = regel === 'einstimmig' ? nein === 0
                   : regel === 'absolut'    ? ja > session.ressorts.length / 2
                   : ja > nein;
  return { ja, nein, enthaltung, fehlen, entschieden: true as const, angenommen, regel };
}

/**
 * POST /api/sessions/:id/teams/:team/vorlagen
 * Eine Vorlage einbringen. Ersetzt eine abgelehnte durch die naechste Fassung.
 *
 * Body: { periode_idx, ressort, aenderungen, begruendung, person }
 */
app.post('/api/sessions/:id/teams/:team/vorlagen', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const { periode_idx, ressort, aenderungen, begruendung, person } =
    await c.req.json<{ periode_idx: number; ressort: string;
                       aenderungen: Vorlage['aenderungen']; begruendung: string;
                       person: string }>();

  const gefunden = holePeriode(session, teamName, periode_idx);
  if ('fehler' in gefunden) return c.json({ error: gefunden.fehler }, gefunden.status);
  const { periode } = gefunden;

  if (!session.ressorts.includes(ressort)) {
    return c.json({ error: `Unbekanntes Ressort: ${ressort}` }, 400);
  }
  if (periode.locked) return c.json({ error: 'Die Periode ist geschlossen' }, 409);
  if (!String(begruendung ?? '').trim()) {
    return c.json({ error: 'Eine Vorlage braucht eine Begründung.' }, 422);
  }

  periode.vorlagen ??= {};
  const alt = periode.vorlagen[ressort];
  if (alt?.stand === 'angenommen') {
    return c.json({ error: 'Diese Vorlage ist schon angenommen.' }, 409);
  }

  // Die einbringende Person stimmt automatisch zu — wer etwas vorschlaegt,
  // ist dafuer. Zuruecknehmen kann sie das nur, indem sie zurueckzieht.
  const jetzt = new Date().toISOString();
  periode.vorlagen[ressort] = {
    ressort,
    fassung: (alt?.fassung ?? 0) + 1,
    stand: 'eingebracht',
    aenderungen: aenderungen ?? {},
    begruendung: String(begruendung).trim().slice(0, 600),
    eingebracht_von: String(person ?? '').trim().slice(0, 60),
    eingebracht_am: jetzt,
    stimmen: { [ressort]: { stimme: 'ja', person: String(person ?? '').slice(0, 60), at: jetzt } },
  };

  session.teams[teamName].last_updated = jetzt;
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, vorlage: periode.vorlagen[ressort],
                  stand: werteAus(session, periode.vorlagen[ressort]) });
});

/**
 * DELETE /api/sessions/:id/teams/:team/vorlagen/:ressort
 * Zurueckziehen. Body: { periode_idx }
 */
app.delete('/api/sessions/:id/teams/:team/vorlagen/:ressort', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const ressort  = decodeURIComponent(c.req.param('ressort'));
  const { periode_idx } = await c.req.json<{ periode_idx: number }>();

  const gefunden = holePeriode(session, teamName, periode_idx);
  if ('fehler' in gefunden) return c.json({ error: gefunden.fehler }, gefunden.status);
  const { periode } = gefunden;

  const vorlage = periode.vorlagen?.[ressort];
  if (!vorlage) return c.json({ error: 'Keine Vorlage vorhanden' }, 404);
  if (vorlage.stand === 'angenommen') {
    return c.json({ error: 'Eine angenommene Vorlage lässt sich nicht zurückziehen.' }, 409);
  }
  vorlage.stand = 'zurueckgezogen';
  session.teams[teamName].last_updated = new Date().toISOString();
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true });
});

/**
 * POST /api/sessions/:id/teams/:team/vorlagen/:ressort/stimme
 * Abstimmen. Body: { periode_idx, rolle, stimme, person, grund? }
 *
 * `rolle` ist das Ressort der STIMMENDEN Person, `:ressort` das der Vorlage.
 */
app.post('/api/sessions/:id/teams/:team/vorlagen/:ressort/stimme', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const ressort  = decodeURIComponent(c.req.param('ressort'));
  const { periode_idx, rolle, stimme, person, grund } =
    await c.req.json<{ periode_idx: number; rolle: string; stimme: Stimme;
                       person: string; grund?: string }>();

  const gefunden = holePeriode(session, teamName, periode_idx);
  if ('fehler' in gefunden) return c.json({ error: gefunden.fehler }, gefunden.status);
  const { periode } = gefunden;

  const vorlage = periode.vorlagen?.[ressort];
  if (!vorlage) return c.json({ error: 'Keine Vorlage vorhanden' }, 404);
  if (vorlage.stand !== 'eingebracht') {
    return c.json({ error: `Über diese Vorlage wird nicht mehr abgestimmt (${vorlage.stand}).` }, 409);
  }
  if (!session.ressorts.includes(rolle)) {
    return c.json({ error: `Unbekanntes Ressort: ${rolle}` }, 400);
  }
  if (!['ja', 'nein', 'enthaltung'].includes(stimme)) {
    return c.json({ error: 'Ungültige Stimme' }, 400);
  }

  vorlage.stimmen[rolle] = {
    stimme,
    person: String(person ?? '').trim().slice(0, 60),
    grund:  grund ? String(grund).trim().slice(0, 280) : undefined,
    at: new Date().toISOString(),
  };

  const stand = werteAus(session, vorlage);
  if (stand.entschieden) vorlage.stand = stand.angenommen ? 'angenommen' : 'abgelehnt';

  session.teams[teamName].last_updated = new Date().toISOString();
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, stand, vorlage });
});

/**
 * GET /api/sessions/:id/teams/:team/vorlagen?periode_idx=0
 * Alle Vorlagen einer Periode mit ihrem Auszaehlstand.
 */
app.get('/api/sessions/:id/teams/:team/vorlagen', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const idx = Number(c.req.query('periode_idx') ?? 0);
  const periode = session.teams[teamName]?.perioden?.[idx];
  if (!periode) return c.json({ vorlagen: {}, quorum: session.quorum ?? 'einfach' });

  const mitStand = Object.fromEntries(
    Object.entries(periode.vorlagen ?? {})
      .map(([r, v]) => [r, { ...v, auszaehlung: werteAus(session, v) }]));
  // `locked` sagt den anderen Geraeten, dass ein Geraet die Runde geschlossen
  // hat. Ohne das blieben sie in der alten Runde stehen, bis jemand neu laedt.
  return c.json({ vorlagen: mitStand, quorum: session.quorum ?? 'einfach',
                  ressorts: session.ressorts, locked: periode.locked });
});

// ── Der Verhandlungstisch: namentliche Unterschriften ───────────────────────
//
// Anders als der Stimmzaehler in /vote halten diese Endpunkte fest, WER
// gezeichnet hat. Erst wenn jedes Ressort der Sitzung gezeichnet hat und kein
// Einspruch mehr steht, wird die Periode gesperrt.
//
// /vote bleibt unangetastet: die klassische Flaeche zaehlt weiter Stimmen.

/**
 * Die Periode eines Teams holen — oder sagen, warum nicht.
 *
 * Ein Team, das in `team_names` steht, ist gueltig, auch wenn es noch nichts
 * gespeichert hat: am Verhandlungstisch kann die erste Unterschrift fallen,
 * bevor jemand eine Zahl angefasst hat. Der Teamstand wird darum bei Bedarf
 * angelegt. Ein Team, das NICHT in `team_names` steht, bleibt abgelehnt —
 * sonst koennte ein Tippfehler stillschweigend ein Geisterteam erzeugen.
 */
function holePeriode(session: SessionData, teamName: string, idx: unknown) {
  if (!session.team_names.includes(teamName)) {
    return { fehler: 'Team nicht in Session registriert', status: 400 as const };
  }
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) {
    return { fehler: 'periode_idx muss eine nicht-negative Ganzzahl sein', status: 400 as const };
  }
  if (idx >= session.perioden_anzahl) {
    return { fehler: 'Periode liegt hinter dem Ende des Kurses', status: 400 as const };
  }

  session.teams[teamName] ??= { perioden: [], last_updated: new Date().toISOString() };
  const team = session.teams[teamName];
  team.perioden[idx] ??= {
    idx, locked: false, params: {} as PeriodParams, votes: 0,
    zeichnungen: {}, einsprueche: {},
  };
  return { periode: team.perioden[idx] };
}

/**
 * Sperrt die Periode, sobald alle Ressorts gezeichnet haben und kein
 * Einspruch mehr steht. Ein zurueckgezogenes Ressort oeffnet sie NICHT
 * wieder: was einmal beschlossen wurde, ist beschlossen.
 */
function pruefeVollzaehligkeit(session: SessionData, periode: TeamPeriod) {
  const gezeichnet = Object.keys(periode.zeichnungen ?? {});
  const offen      = session.ressorts.filter(r => !gezeichnet.includes(r));
  // Heisst "welche Ressorts widersprechen", nicht "die Einsprueche selbst" —
  // die stehen unter `einsprueche` und sind Objekte. Zwei Bedeutungen unter
  // einem Namen waeren eine Falle fuer jeden, der den Client schreibt.
  const widerspruch = Object.keys(periode.einsprueche ?? {});
  if (offen.length === 0 && widerspruch.length === 0) periode.locked = true;
  return { offen, widerspruch, locked: periode.locked };
}

/**
 * PUT /api/sessions/:id/teams/:team/begruendung
 * Warum ein Ressort will, was es will.
 *
 * Body: { periode_idx, ressort, text }
 */
app.put('/api/sessions/:id/teams/:team/begruendung', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const { periode_idx, ressort, text } =
    await c.req.json<{ periode_idx: number; ressort: string; text: string }>();

  const gefunden = holePeriode(session, teamName, periode_idx);
  if ('fehler' in gefunden) return c.json({ error: gefunden.fehler }, gefunden.status);
  const { periode } = gefunden;

  if (!session.ressorts.includes(ressort)) {
    return c.json({ error: `Unbekanntes Ressort: ${ressort}` }, 400);
  }
  if (periode.locked) return c.json({ error: 'Die Periode ist geschlossen' }, 409);

  periode.begruendungen = { ...(periode.begruendungen ?? {}) };
  periode.begruendungen[ressort] = String(text ?? '').trim().slice(0, 600);

  session.teams[teamName].last_updated = new Date().toISOString();
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, begruendungen: periode.begruendungen });
});

/**
 * POST /api/sessions/:id/teams/:team/zeichnung
 * Ein Ressort zeichnet die Mappe.
 *
 * Body: { periode_idx, ressort, person, matrikelnummer? }
 */
app.post('/api/sessions/:id/teams/:team/zeichnung', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const { periode_idx, ressort, person, matrikelnummer } =
    await c.req.json<{ periode_idx: number; ressort: string; person: string;
                       matrikelnummer?: string }>();

  const gefunden = holePeriode(session, teamName, periode_idx);
  if ('fehler' in gefunden) return c.json({ error: gefunden.fehler }, gefunden.status);
  const { periode } = gefunden;

  if (!session.ressorts.includes(ressort)) {
    return c.json({ error: `Unbekanntes Ressort: ${ressort}` }, 400);
  }
  if (!person?.trim()) {
    return c.json({ error: 'Eine Unterschrift braucht einen Namen' }, 400);
  }
  if (periode.locked) {
    return c.json({ ok: true, locked: true, message: 'Periode bereits geschlossen' });
  }

  periode.zeichnungen = { ...(periode.zeichnungen ?? {}) };
  periode.zeichnungen[ressort] = {
    person:         person.trim().slice(0, 60),
    matrikelnummer: String(matrikelnummer ?? '').replace(/\D/g, ''),
    at:             new Date().toISOString(),
  };
  // Wer zeichnet, nimmt seinen eigenen Einspruch zurueck.
  if (periode.einsprueche?.[ressort]) {
    const rest = { ...periode.einsprueche };
    delete rest[ressort];
    periode.einsprueche = rest;
  }

  const stand = pruefeVollzaehligkeit(session, periode);
  session.teams[teamName].last_updated = new Date().toISOString();
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, ...stand, zeichnungen: periode.zeichnungen,
                  einsprueche: periode.einsprueche ?? {} });
});

/**
 * DELETE /api/sessions/:id/teams/:team/zeichnung/:ressort
 * Eine Unterschrift zurueckziehen. Body: { periode_idx }
 */
app.delete('/api/sessions/:id/teams/:team/zeichnung/:ressort', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const ressort  = decodeURIComponent(c.req.param('ressort'));
  const { periode_idx } = await c.req.json<{ periode_idx: number }>();

  const gefunden = holePeriode(session, teamName, periode_idx);
  if ('fehler' in gefunden) return c.json({ error: gefunden.fehler }, gefunden.status);
  const { periode } = gefunden;

  if (periode.locked) {
    return c.json({ error: 'Die Periode ist geschlossen; eine Unterschrift lässt sich '
                         + 'nicht mehr zurückziehen' }, 409);
  }
  const rest = { ...(periode.zeichnungen ?? {}) };
  delete rest[ressort];
  periode.zeichnungen = rest;

  session.teams[teamName].last_updated = new Date().toISOString();
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, ...pruefeVollzaehligkeit(session, periode),
                  zeichnungen: periode.zeichnungen, einsprueche: periode.einsprueche ?? {} });
});

/**
 * POST /api/sessions/:id/teams/:team/einspruch
 * Ein Ressort legt Einspruch ein. Body: { periode_idx, ressort, person, grund? }
 */
app.post('/api/sessions/:id/teams/:team/einspruch', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const { periode_idx, ressort, person, grund } =
    await c.req.json<{ periode_idx: number; ressort: string; person: string; grund?: string }>();

  const gefunden = holePeriode(session, teamName, periode_idx);
  if ('fehler' in gefunden) return c.json({ error: gefunden.fehler }, gefunden.status);
  const { periode } = gefunden;

  if (!session.ressorts.includes(ressort)) {
    return c.json({ error: `Unbekanntes Ressort: ${ressort}` }, 400);
  }
  if (periode.locked) {
    return c.json({ error: 'Die Periode ist geschlossen' }, 409);
  }

  periode.einsprueche = { ...(periode.einsprueche ?? {}) };
  periode.einsprueche[ressort] = {
    person: String(person ?? '').trim().slice(0, 60),
    grund:  grund ? String(grund).trim().slice(0, 280) : undefined,
    at:     new Date().toISOString(),
  };
  // Wer Einspruch einlegt, zieht seine Unterschrift zurueck.
  if (periode.zeichnungen?.[ressort]) {
    const rest = { ...periode.zeichnungen };
    delete rest[ressort];
    periode.zeichnungen = rest;
  }

  session.teams[teamName].last_updated = new Date().toISOString();
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, ...pruefeVollzaehligkeit(session, periode),
                  zeichnungen: periode.zeichnungen ?? {}, einsprueche: periode.einsprueche });
});

/**
 * DELETE /api/sessions/:id/teams/:team/einspruch/:ressort
 * Einspruch zuruecknehmen. Body: { periode_idx }
 */
app.delete('/api/sessions/:id/teams/:team/einspruch/:ressort', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);

  const teamName = decodeURIComponent(c.req.param('team'));
  const ressort  = decodeURIComponent(c.req.param('ressort'));
  const { periode_idx } = await c.req.json<{ periode_idx: number }>();

  const gefunden = holePeriode(session, teamName, periode_idx);
  if ('fehler' in gefunden) return c.json({ error: gefunden.fehler }, gefunden.status);
  const { periode } = gefunden;

  const rest = { ...(periode.einsprueche ?? {}) };
  delete rest[ressort];
  periode.einsprueche = rest;

  session.teams[teamName].last_updated = new Date().toISOString();
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, ...pruefeVollzaehligkeit(session, periode),
                  zeichnungen: periode.zeichnungen ?? {}, einsprueche: periode.einsprueche });
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
  if (!requireToken(c, session)) {
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
  if (!requireToken(c, session)) {
    return c.json({ error: 'Nicht autorisiert' }, 403);
  }

  const { schocks } = await c.req.json<{ schocks: SchockEvent[] }>();
  if (!Array.isArray(schocks)) {
    return c.json({ error: 'schocks muss ein Array sein' }, 400);
  }

  const neu = schocks.filter(s =>
    typeof s.periode === 'number' && Number.isInteger(s.periode) && s.periode >= 0
    && s.periode < session.perioden_anzahl && typeof s.id === 'string' && s.effekte
  );

  // Die Vergangenheit bleibt, wie sie war. Ein Ereignis in einer Periode, die
  // schon jemand gesehen hat, aendert rueckwirkend Zahlen, ueber die ein Team
  // schon beraten und abgestimmt hat — und alle Perioden danach mit. Das
  // verhindert der Server, nicht nur die Oberflaeche: eine zweite
  // Leitungsseite oder ein Skript kaeme sonst daran vorbei.
  const alt = session.schocks ?? [];
  const idIn = (liste: SchockEvent[], p: number) => liste.find(s => s.periode === p)?.id ?? null;
  for (let p = 0; p < session.perioden_anzahl; p++) {
    if (idIn(alt, p) !== idIn(neu, p) && periodeGesehen(session, p)) {
      return c.json({ error: `Periode ${p + 1} ist schon freigegeben oder wird schon gespielt. `
        + 'Ein Ereignis dort würde Ergebnisse ändern, die Teams schon gesehen haben.' }, 409);
    }
  }

  for (let p = 0; p < session.perioden_anzahl; p++) {
    const vorher = alt.find(s => s.periode === p), nachher = neu.find(s => s.periode === p);
    if (vorher?.id === nachher?.id) continue;
    vermerke(session, nachher
      ? `Periode ${p + 1}: Ereignis „${nachher.name}“ gesetzt`
      : `Periode ${p + 1}: Ereignis „${vorher?.name}“ entfernt`);
  }

  session.schocks = neu;
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, count: session.schocks.length });
});

/**
 * Hat schon jemand Periode `p` gesehen?
 *
 * Ja, wenn sie freigegeben ist — ODER wenn ein Team die Periode davor
 * abgeschlossen hat. Das zweite ist noetig, weil der Tisch die Freigabe
 * nicht erzwingt: ein Team, das vorauseilt, sitzt schon in Periode `p`,
 * waehrend die Lehrperson noch plant.
 */
function periodeGesehen(session: SessionData, p: number): boolean {
  if (p < (session.perioden_freigegeben ?? 1)) return true;
  return Object.values(session.teams ?? {}).some(t =>
    (t.perioden ?? []).some(x => x.idx >= p - 1 && x.locked));
}

/**
 * PUT /api/sessions/:id/lernziele?token=...
 * Setzt die Lernziele der Session (Admin only).
 *
 * Body: { lernziele: Lernziel[] }
 */
app.put('/api/sessions/:id/lernziele', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(c, session)) {
    return c.json({ error: 'Nicht autorisiert' }, 403);
  }

  const { lernziele } = await c.req.json<{ lernziele: Lernziel[] }>();
  if (!Array.isArray(lernziele)) {
    return c.json({ error: 'lernziele muss ein Array sein' }, 400);
  }

  const validOps = ['<', '>', '<=', '>='];
  session.lernziele = lernziele.filter(z =>
    typeof z.kpi === 'string' &&
    validOps.includes(z.operator) &&
    typeof z.wert === 'number' &&
    typeof z.label === 'string'
  );
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, count: session.lernziele.length });
});

/**
 * PUT /api/sessions/:id/freigabe?token=...
 * Setzt die Anzahl freigegebener Perioden (Admin only).
 * Studierende können keine Periode spielen, deren Index ≥ perioden_freigegeben ist.
 *
 * Body: { perioden_freigegeben: number }
 */
app.put('/api/sessions/:id/freigabe', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(c, session)) {
    return c.json({ error: 'Nicht autorisiert' }, 403);
  }

  const { perioden_freigegeben } = await c.req.json<{ perioden_freigegeben: number }>();
  if (
    typeof perioden_freigegeben !== 'number' ||
    !Number.isInteger(perioden_freigegeben) ||
    perioden_freigegeben < 1 ||
    perioden_freigegeben > session.perioden_anzahl
  ) {
    return c.json({
      error: `perioden_freigegeben muss zwischen 1 und ${session.perioden_anzahl} liegen`,
    }, 400);
  }

  session.perioden_freigegeben = perioden_freigegeben;
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, perioden_freigegeben });
});

/**
 * PUT /api/sessions/:id/werkzeuge?token=...
 * Setzt die freigegebenen Werkzeuge / Ressorts je Periode (Admin only).
 *
 * Body: { perioden_werkzeuge: Record<string, string[]> }
 */
app.put('/api/sessions/:id/werkzeuge', async (c) => {
  const session = await getSession(c.env.SESSIONS, c.req.param('id'));
  if (!session) return c.json({ error: 'Session nicht gefunden' }, 404);
  if (!requireToken(c, session)) {
    return c.json({ error: 'Nicht autorisiert' }, 403);
  }

  const { perioden_werkzeuge } = await c.req.json<{ perioden_werkzeuge: Record<string, string[]> }>();
  if (!perioden_werkzeuge || typeof perioden_werkzeuge !== 'object') {
    return c.json({ error: 'perioden_werkzeuge muss ein Objekt sein' }, 400);
  }

  session.perioden_werkzeuge = perioden_werkzeuge;
  await putSession(c.env.SESSIONS, session);
  return c.json({ ok: true, perioden_werkzeuge: session.perioden_werkzeuge });
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
    session_id:            session.id,
    name:                  session.name,
    perioden_anzahl:       session.perioden_anzahl,
    perioden_laenge_jahre: session.perioden_laenge_jahre ?? 4,
    team_names:            session.team_names,
    teams:                 results,
    schocks:               session.schocks ?? [],
    lernziele:             session.lernziele ?? [],
    perioden_werkzeuge:    session.perioden_werkzeuge ?? null,
  });
});

export default app;
