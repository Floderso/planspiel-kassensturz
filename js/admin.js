// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Admin-Dashboard
// Lehrperson: Session einrichten + Teams live beobachten
// ═══════════════════════════════════════════════════════

import { simulierePfad } from './rechner/transition.js';
import { KURS_KONFIG_DEFAULT, SCHOCK_BIBLIOTHEK } from './data.js';

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
let currentSessionId   = null;
let currentToken       = null;
let schockPanelReady   = false;

function startDashboard(sessionId, token, joinUrl, meta) {
  currentSessionId = sessionId;
  currentToken     = token;

  document.getElementById('setup').style.display    = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('header-session-info').style.display = '';
  document.getElementById('header-session-id').textContent     = sessionId;

  // Modal-Close-Handler einmalig verdrahten
  document.getElementById('team-detail-close').addEventListener('click', () => {
    document.getElementById('team-detail-modal').style.display = 'none';
  });
  document.getElementById('team-detail-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

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

  const teamNames  = session.team_names || Object.keys(session.teams || {});
  const allMembers = session.members || [];

  const sessionKonfig = {
    ...KURS_KONFIG_DEFAULT,
    perioden_anzahl: session.perioden_anzahl,
    schocks: session.schocks ?? [],
  };

  // KPIs für alle Teams berechnen (client-seitig, inkl. aktiver Schocks)
  const teamKpis = {};
  for (const teamName of teamNames) {
    const teamState = (session.teams || {})[teamName];
    if (!teamState) continue;
    try {
      const params = teamState.perioden.map(p => p.params);
      const pfad   = simulierePfad(params, sessionKonfig);
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

  if (teamNames.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" style="text-align:center;color:var(--muted);padding:24px">
      Keine Teams – Session-Daten werden geladen …</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const teamName of teamNames) {
    const members    = allMembers.filter(m => m.team === teamName);
    const memberStr  = members.length
      ? members.map(m => `${m.name} <span style="color:var(--muted);font-size:10px">(${m.matrikelnummer})</span>`).join(', ')
        + ` <span style="color:var(--muted)">${members.length}/${session.team_groesse}</span>`
      : `<span style="color:var(--muted)">0/${session.team_groesse}</span>`;
    const kpi        = teamKpis[teamName];
    const lockedN    = kpi?.periode ?? 0;
    const allDone    = lockedN >= session.perioden_anzahl;

    const cls = (val, best) => isBest(val, best) ? 'kpi-best' : '';

    const tr = document.createElement('tr');
    tr.title = 'Klicken für Team-Details';
    tr.innerHTML = `
      <td><strong>${teamName}</strong> <span style="font-size:10px;color:var(--accent)">↗</span></td>
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
    tr.addEventListener('click', () => openTeamDetail(teamName, session, sessionKonfig));
    tbody.appendChild(tr);
  }

  // Schock-Panel einmalig initialisieren (User-Auswahl nicht überschreiben)
  if (!schockPanelReady) {
    renderSchockPanel(session);
    schockPanelReady = true;
  }

  const expires = new Date(session.expires_at);
  document.getElementById('header-expires').textContent =
    'Läuft ab: ' + expires.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('last-updated').textContent =
    'Zuletzt aktualisiert: ' + new Date().toLocaleTimeString('de-DE');
}

// ── Team-Detail-Modal ─────────────────────────────────────────────────────────

function openTeamDetail(teamName, session, konfig) {
  const modal   = document.getElementById('team-detail-modal');
  const members = (session.members || []).filter(m => m.team === teamName);

  document.getElementById('team-detail-name').textContent = teamName;
  document.getElementById('team-detail-members').innerHTML = members.length
    ? members.map(m => `<strong>${m.name}</strong> <span style="color:var(--muted)">(${m.matrikelnummer})</span>`).join(' · ')
    : '<em style="color:var(--muted)">Noch keine Mitglieder beigetreten</em>';

  const teamState = (session.teams || {})[teamName];
  const content   = document.getElementById('team-detail-content');

  if (!teamState?.perioden?.length) {
    content.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:16px 0">Dieses Team hat noch keine Parameter eingestellt.</p>';
    modal.style.display = 'flex';
    return;
  }

  let pfad = [];
  try {
    pfad = simulierePfad(teamState.perioden.map(p => p.params), konfig);
  } catch (_) {}

  const lockedCount = teamState.perioden.filter(p => p.locked).length;
  const n           = session.perioden_anzahl;

  let rows = '';
  for (let i = 0; i < n; i++) {
    const pd = teamState.perioden[i];
    const pf = pfad[i];
    const isLocked  = pd?.locked;
    const isActive  = (i === lockedCount) && !isLocked;
    const hasParams = isLocked || isActive;

    const statusHtml = isLocked
      ? '<span class="period-badge done">✓ Gesperrt</span>'
      : isActive
        ? '<span class="period-badge">Aktiv</span>'
        : `<span style="color:var(--muted);font-size:11px">—</span>`;

    const schock = (session.schocks ?? []).find(s => s.periode === i);
    const schockHtml = schock
      ? `<span title="${schock.beschreibung}" style="color:#92400E;font-size:11px">⚡ ${schock.name}</span>`
      : '<span style="color:var(--muted)">—</span>';

    if (!hasParams) {
      rows += `<tr>
        <td>${pf?.label ?? `P${i + 1}`}</td>
        <td>${statusHtml}</td>
        <td>${schockHtml}</td>
        <td colspan="9" style="color:var(--muted)">Noch nicht gespielt</td>
      </tr>`;
      continue;
    }

    const p = pd.params;
    const r = pf?.result;
    const z = pf?.zustand;
    rows += `<tr class="${isActive ? 'active-period' : ''}">
      <td>${pf?.label ?? `P${i + 1}`}</td>
      <td>${statusHtml}</td>
      <td>${schockHtml}</td>
      <td>${p?.spitze?.toFixed(0) ?? '—'} %</td>
      <td>${p?.mwst?.toFixed(0) ?? '—'} %</td>
      <td>${p?.co2?.toFixed(0) ?? '—'} €/t</td>
      <td>${p?.kst?.toFixed(0) ?? '—'} %</td>
      <td>${p?.invest_impuls?.toFixed(0) ?? '—'} Mrd.</td>
      <td style="color:${r?.saldo < 0 ? 'var(--bad)' : 'var(--good)'}">
        ${r ? (r.saldo >= 0 ? '+' : '') + r.saldo.toFixed(0) : '—'} Mrd.
      </td>
      <td>${r ? r.gini.toFixed(3) : '—'}</td>
      <td>${z ? Math.round(z.co2_kumulat) : '—'} Mt</td>
      <td>${z ? z.bip.toFixed(0) : '—'} Mrd.</td>
    </tr>`;
  }

  content.innerHTML = `
    <div style="overflow-x:auto">
      <table class="detail-table">
        <thead><tr>
          <th>Periode</th><th>Status</th><th>Schock</th>
          <th>Spitze</th><th>MwSt</th><th>CO₂-Preis</th><th>KSt</th><th>Invest-Impuls</th>
          <th>Saldo</th><th>Gini</th><th>CO₂ kum.</th><th>BIP</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:10px">
      Aktive Periode ist blau markiert. Schock-Effekte sind in der Simulation eingerechnet.
    </p>`;
  modal.style.display = 'flex';
}

// ── Schock-Verwaltung ─────────────────────────────────────────────────────────

function renderSchockPanel(session) {
  const panel  = document.getElementById('schock-panel');
  const grid   = document.getElementById('schock-grid');
  if (!panel || !grid) return;
  panel.style.display = '';

  const n       = session.perioden_anzahl ?? 5;
  const nJahre  = KURS_KONFIG_DEFAULT.perioden_laenge_jahre ?? 4;
  const active  = {};
  for (const s of (session.schocks ?? [])) active[s.periode] = s.id;

  const byTyp = (typ) => SCHOCK_BIBLIOTHEK.filter(s => s.typ === typ);
  const opts  = (typ, sel) => byTyp(typ).map(s =>
    `<option value="${s.id}"${s.id === sel ? ' selected' : ''}>${'⚡'.repeat(s.staerke)} ${s.name}</option>`
  ).join('');

  let html = '';
  for (let i = 0; i < n; i++) {
    const start = 2025 + i * nJahre;
    const label = nJahre === 1 ? `${start}` : `${start}–${start + nJahre - 1}`;
    const sel   = active[i] ?? '';
    html += `
      <div class="schock-row">
        <div class="schock-period-label">Periode ${i + 1}<span class="schock-period-sub">${label}</span></div>
        <select class="schock-select" id="schock-sel-${i}">
          <option value="">Kein Schock</option>
          <optgroup label="Energie">${opts('energie', sel)}</optgroup>
          <optgroup label="Nachfrage / Konjunktur">${opts('nachfrage', sel)}</optgroup>
          <optgroup label="Finanz / Zinsen">${opts('finanz', sel)}</optgroup>
          <optgroup label="Geopolitisch">${opts('geopolitisch', sel)}</optgroup>
        </select>
        <div></div>
        <div class="schock-preview" id="schock-prev-${i}"></div>
      </div>`;
  }
  grid.innerHTML = html;

  // Effekt-Vorschau verdrahten
  for (let i = 0; i < n; i++) {
    const selEl  = document.getElementById(`schock-sel-${i}`);
    const prevEl = document.getElementById(`schock-prev-${i}`);
    const update = () => {
      const s = SCHOCK_BIBLIOTHEK.find(x => x.id === selEl.value);
      if (!s) { prevEl.textContent = ''; return; }
      const e = s.effekte;
      const parts = [];
      if (e.bip_malus)     parts.push(`BIP −${(e.bip_malus * 100).toFixed(1)} %`);
      if (e.schuld_bonus)  parts.push(`Schuldenquote +${e.schuld_bonus.toFixed(1)} PP`);
      if (e.invest_malus)  parts.push(`Investitionen −${(e.invest_malus * 100).toFixed(1)} %`);
      if (e.zins_bonus)    parts.push(`Zinsen +${(e.zins_bonus * 100).toFixed(2)} PP`);
      if (e.co2_reduktion) parts.push(`CO₂ −${(e.co2_reduktion * 100).toFixed(0)} %`);
      prevEl.textContent = s.beschreibung + (parts.length ? ` · Effekte: ${parts.join(', ')}` : '');
    };
    update();
    selEl.addEventListener('change', update);
  }

  // Speichern-Button verdrahten (alten Handler entfernen)
  const oldBtn = document.getElementById('btn-save-schocks');
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  const statusEl = document.getElementById('schock-status');

  newBtn.addEventListener('click', async () => {
    const schocks = [];
    for (let i = 0; i < n; i++) {
      const id = document.getElementById(`schock-sel-${i}`)?.value;
      if (id) {
        const def = SCHOCK_BIBLIOTHEK.find(s => s.id === id);
        if (def) schocks.push({ ...def, periode: i });
      }
    }
    newBtn.disabled = true;
    newBtn.textContent = 'Speichere …';
    statusEl.textContent = '';
    try {
      const res = await fetch(`${API_BASE}/sessions/${currentSessionId}/schocks?token=${currentToken}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schocks }),
      });
      const data = await res.json();
      if (res.ok) {
        statusEl.style.color = 'var(--good)';
        statusEl.textContent = `✓ ${data.count} Schock(s) gespeichert — Teams erhalten Update in ~5 Sek.`;
      } else {
        statusEl.style.color = 'var(--bad)';
        statusEl.textContent = 'Fehler: ' + (data.error ?? res.statusText);
      }
    } catch (_) {
      statusEl.style.color = 'var(--bad)';
      statusEl.textContent = 'Netzwerkfehler';
    } finally {
      newBtn.disabled = false;
      newBtn.textContent = 'Schocks speichern';
    }
  });
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
  currentSessionId = SESSION_ID;
  currentToken     = ADMIN_TOKEN;

  document.getElementById('setup').style.display    = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('header-session-info').style.display = '';
  document.getElementById('header-session-id').textContent     = SESSION_ID;

  // Modal-Close-Handler einmalig setzen
  document.getElementById('team-detail-close').addEventListener('click', () => {
    document.getElementById('team-detail-modal').style.display = 'none';
  });
  document.getElementById('team-detail-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

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
