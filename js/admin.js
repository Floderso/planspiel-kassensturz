// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Admin-Dashboard
// Lehrperson: Session einrichten + Teams live beobachten
// ═══════════════════════════════════════════════════════

import { simulierePfad } from './rechner/transition.js';
import { KURS_KONFIG_DEFAULT } from './data.js';

const API_BASE = 'https://planspiel-api.aramisda2.workers.dev/api';

// ── URL-Parameter ─────────────────────────────────────────────────────────────

const urlParams    = new URLSearchParams(location.search);
const SESSION_ID   = urlParams.get('session');
const ADMIN_TOKEN  = urlParams.get('token');

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function randomToken(len = 12) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, len);
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Kopiert';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

// ── Setup-Formular ────────────────────────────────────────────────────────────

let sandboxOn    = true;
let teamCount    = 0;
let pendingMatrikeln = [];   // vor Session-Erstellung zwischengespeichert

function addTeam(name = '') {
  teamCount++;
  const row = document.createElement('div');
  row.className = 'team-row';
  row.dataset.idx = teamCount;
  row.innerHTML = `
    <input type="text" placeholder="Team ${teamCount}" value="${name}" maxlength="40">
    <button class="btn-remove-team" title="Entfernen">×</button>`;
  row.querySelector('.btn-remove-team').addEventListener('click', () => row.remove());
  document.getElementById('team-list').appendChild(row);
}

function getTeamNames() {
  return [...document.querySelectorAll('#team-list .team-row input')]
    .map(i => i.value.trim())
    .filter(Boolean);
}

function initSetup() {
  // Standard-Teams
  addTeam('Team A'); addTeam('Team B'); addTeam('Team C');

  // Admin-Token generieren
  document.getElementById('f-admin-token').value = randomToken();

  // Toggle Sandbox
  const toggleBtn   = document.getElementById('toggle-sandbox');
  const toggleLabel = document.getElementById('toggle-sandbox-label');
  toggleBtn.classList.add('on');
  toggleBtn.addEventListener('click', () => {
    sandboxOn = !sandboxOn;
    toggleBtn.classList.toggle('on', sandboxOn);
    toggleLabel.textContent = sandboxOn
      ? 'Sandbox-Modus (kein Quorum nötig)'
      : 'Abstimmungsmodus (Quorum: 50 % je Team)';
  });

  document.getElementById('btn-add-team').addEventListener('click', () => addTeam());

  document.getElementById('btn-copy-token').addEventListener('click', () => {
    copyToClipboard(
      document.getElementById('f-admin-token').value,
      document.getElementById('btn-copy-token')
    );
  });

  // CSV-Upload im Setup-Formular (wird nach Session-Erstellung hochgeladen)
  setupCsvUpload('csv-drop-zone', 'csv-file-input', 'csv-status', matrikeln => {
    pendingMatrikeln = matrikeln;
  });

  document.getElementById('btn-create').addEventListener('click', createSession);
}

async function createSession() {
  const btn      = document.getElementById('btn-create');
  const errorEl  = document.getElementById('setup-error');
  const name     = document.getElementById('f-name').value.trim() || 'Planspiel';
  const perioden = Math.max(1, Math.min(12, +document.getElementById('f-perioden').value || 5));
  const groesse  = Math.max(1, Math.min(50, +document.getElementById('f-groesse').value || 4));
  const teams    = getTeamNames();

  if (teams.length === 0) {
    errorEl.textContent = 'Mindestens ein Team hinzufügen.'; return;
  }

  btn.textContent  = 'Erstelle …';
  btn.disabled     = true;
  errorEl.textContent = '';

  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        perioden_anzahl:    perioden,
        team_groesse:       groesse,
        team_names:         teams,
        sandbox:            sandboxOn,
        min_teilnahme_quote: 0.5,
      }),
    });

    if (!res.ok) { throw new Error(await res.text()); }
    const data = await res.json();

    // Admin-URL mit Token in URL schreiben und Dashboard laden
    const newUrl = new URL(location.href);
    newUrl.searchParams.set('session', data.session_id);
    newUrl.searchParams.set('token',   data.admin_token);
    history.pushState({}, '', newUrl.toString());

    // Matrikelnummern hochladen wenn vorhanden
    if (pendingMatrikeln.length > 0) {
      await uploadMatrikeln(
        data.session_id, data.admin_token, pendingMatrikeln,
        document.getElementById('csv-status')
      );
    }

    // Join-URL enthält nur session-id, kein token
    const origin   = location.origin + location.pathname.replace('admin.html', '');
    const join_url = `${origin}index.html?session=${data.session_id}&perioden=${perioden}&teams=${groesse}&sandbox=${sandboxOn}&name=${encodeURIComponent(name)}`;

    startDashboard(data.session_id, data.admin_token, join_url, { name, perioden, groesse, teams });
  } catch (e) {
    errorEl.textContent = 'Fehler: ' + e.message;
    btn.textContent  = 'Session starten';
    btn.disabled     = false;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

let pollInterval = null;
let joinUrlGlobal = '';

function startDashboard(sessionId, token, joinUrl, meta) {
  document.getElementById('setup').style.display    = 'none';
  document.getElementById('dashboard').style.display = '';
  document.getElementById('header-session-info').style.display = '';
  document.getElementById('header-session-id').textContent     = sessionId;

  joinUrlGlobal = joinUrl;
  document.getElementById('join-url-display').textContent = joinUrl;
  document.getElementById('btn-copy-join').addEventListener('click', () =>
    copyToClipboard(joinUrl, document.getElementById('btn-copy-join'))
  );

  document.getElementById('btn-refresh').addEventListener('click', () => pollDashboard(sessionId, token));

  // CSV-Upload im laufenden Dashboard
  setupCsvUpload('csv-drop-zone-dash', 'csv-file-input-dash', 'csv-status-dash', async matrikeln => {
    await uploadMatrikeln(sessionId, token, matrikeln, document.getElementById('csv-status-dash'));
  });

  pollDashboard(sessionId, token);
  pollInterval = setInterval(() => pollDashboard(sessionId, token), 5000);
}

async function pollDashboard(sessionId, token) {
  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/admin?token=${token}`);
    if (!res.ok) return;
    const session = await res.json();
    renderDashboard(session);
  } catch (_) {}
}

function renderDashboard(session) {
  const tbody = document.getElementById('teams-tbody');
  tbody.innerHTML = '';

  // KPIs für alle Teams berechnen (client-seitig)
  const teamKpis = {};
  for (const teamName of session.team_names) {
    const teamState = session.teams[teamName];
    if (!teamState) continue;
    try {
      const params = teamState.perioden.map(p => p.params);
      const konfig = { ...KURS_KONFIG_DEFAULT, perioden_anzahl: session.perioden_anzahl };
      const pfad   = simulierePfad(params, konfig);
      const last   = pfad[pfad.length - 1];
      teamKpis[teamName] = {
        saldo:    last.result.saldo,
        gini:     last.result.gini,
        co2:      last.zustand.co2_kumulat,
        bip:      last.zustand.bip,
        periode:  teamState.perioden.filter(p => p.locked).length,
      };
    } catch (_) {}
  }

  // Beste Werte je KPI ermitteln (für grüne Hervorhebung)
  const kpiValues = Object.values(teamKpis);
  const bestSaldo = kpiValues.length ? Math.max(...kpiValues.map(k => k.saldo)) : null;
  const bestGini  = kpiValues.length ? Math.min(...kpiValues.map(k => k.gini))  : null;
  const bestCo2   = kpiValues.length ? Math.min(...kpiValues.map(k => k.co2))   : null;
  const bestBip   = kpiValues.length ? Math.max(...kpiValues.map(k => k.bip))   : null;

  const isBest = (val, best) => val !== null && best !== null && Math.abs(val - best) < 0.001;

  for (const teamName of session.team_names) {
    const members    = session.members.filter(m => m.team === teamName);
    const memberStr  = members.length
      ? members.map(m => `${m.name} <span style="color:var(--muted);font-size:10px">(${m.matrikelnummer})</span>`).join(', ')
        + ` <span style="color:var(--muted)">${members.length}/${session.team_groesse}</span>`
      : `<span style="color:var(--muted)">0/${session.team_groesse}</span>`;
    const kpi        = teamKpis[teamName];
    const lockedN    = kpi?.periode ?? 0;
    const allDone    = lockedN >= session.perioden_anzahl;

    const cls = (val, best) => isBest(val, best) ? 'kpi-best' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${teamName}</strong></td>
      <td class="member-list" style="line-height:1.8">${memberStr}</td>
      <td>
        <span class="period-badge ${allDone ? 'done' : ''}">
          ${lockedN}/${session.perioden_anzahl}
        </span>
        ${allDone ? ' <span class="status-chip done">✓ Fertig</span>' : ''}
      </td>
      <td class="${cls(kpi?.saldo, bestSaldo)}">
        ${kpi ? (kpi.saldo >= 0 ? '+' : '') + kpi.saldo.toFixed(0) + ' Mrd.' : '—'}
      </td>
      <td class="${cls(kpi?.gini, bestGini)}">
        ${kpi ? kpi.gini.toFixed(3) : '—'}
      </td>
      <td class="${cls(kpi?.co2, bestCo2)}">
        ${kpi ? Math.round(kpi.co2) : '—'}
      </td>
      <td class="${cls(kpi?.bip, bestBip)}">
        ${kpi ? kpi.bip.toFixed(0) : '—'}
      </td>`;
    tbody.appendChild(tr);
  }

  const expires = new Date(session.expires_at);
  document.getElementById('header-expires').textContent =
    'Läuft ab: ' + expires.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('last-updated').textContent =
    'Zuletzt aktualisiert: ' + new Date().toLocaleTimeString('de-DE');
}

// ── CSV-Parsing + Upload ──────────────────────────────────────────────────────

/** Extrahiert Matrikelnummern aus CSV-Text (ein/zeile oder semikolon/kommagetrennt) */
function parseMatrikeln(text) {
  return [...new Set(
    text.split(/[\r\n;,\t]+/)
      .map(s => s.replace(/\D/g, '').trim())
      .filter(s => s.length >= 4)
  )];
}

function setupCsvUpload(dropZoneId, fileInputId, statusId, onParsed) {
  const zone   = document.getElementById(dropZoneId);
  const input  = document.getElementById(fileInputId);
  const status = document.getElementById(statusId);
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });
  input.addEventListener('change', () => { if (input.files[0]) readFile(input.files[0]); });

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const matrikeln = parseMatrikeln(e.target.result);
      if (matrikeln.length === 0) {
        status.className = 'error';
        status.textContent = 'Keine gültigen Matrikelnummern gefunden.';
        return;
      }
      status.className = '';
      status.textContent = `✓ ${matrikeln.length} Matrikelnummern geladen.`;
      onParsed(matrikeln);
    };
    reader.readAsText(file, 'UTF-8');
  }
}

async function uploadMatrikeln(sessionId, token, matrikeln, statusEl) {
  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/matrikelnummern?token=${token}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ matrikelnummern: matrikeln }),
    });
    const data = await res.json();
    if (res.ok) {
      statusEl.textContent = `✓ ${data.count} Matrikelnummern gespeichert.`;
    } else {
      statusEl.className   = 'error';
      statusEl.textContent = 'Fehler: ' + (data.error ?? res.statusText);
    }
  } catch (_) {
    statusEl.className   = 'error';
    statusEl.textContent = 'Netzwerkfehler beim Speichern.';
  }
}

// ── Initialisierung ───────────────────────────────────────────────────────────

if (SESSION_ID && ADMIN_TOKEN) {
  // Bereits eine Session aktiv → Dashboard direkt laden
  document.getElementById('setup').style.display    = 'none';
  document.getElementById('dashboard').style.display = '';
  document.getElementById('header-session-info').style.display = '';
  document.getElementById('header-session-id').textContent     = SESSION_ID;

  const origin   = location.origin + location.pathname.replace('admin.html', '');
  const joinUrl  = `${origin}index.html?session=${SESSION_ID}`;
  document.getElementById('join-url-display').textContent = joinUrl;
  document.getElementById('btn-copy-join').addEventListener('click', () =>
    copyToClipboard(joinUrl, document.getElementById('btn-copy-join'))
  );
  document.getElementById('btn-refresh').addEventListener('click', () =>
    pollDashboard(SESSION_ID, ADMIN_TOKEN)
  );

  pollDashboard(SESSION_ID, ADMIN_TOKEN);
  pollInterval = setInterval(() => pollDashboard(SESSION_ID, ADMIN_TOKEN), 5000);
} else {
  initSetup();
}
