// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// Kassensturz · Planspiel — Auswertungsseite

import { simulierePfad }  from './rechner/transition.js';
import { KURS_KONFIG_DEFAULT } from './data.js';
import { generiereTeamFeedback, bewerteLernziele } from './feedback.js';

const API_BASE   = 'https://planspiel-api.aramisda2.workers.dev/api';
const SESSION_ID = new URLSearchParams(location.search).get('session');

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtOp(op) { return op === '<=' ? '≤' : op === '>=' ? '≥' : op; }

function fmtKpiVal(kpi, v) {
  if (v === null || v === undefined) return '—';
  switch (kpi) {
    case 'saldo_bip_pct': return v.toFixed(2) + ' %';
    case 'schuldenquote': return v.toFixed(1) + ' %';
    case 'gini':          return v.toFixed(3);
    case 'co2_kumulat':   return Math.round(v) + ' Mt';
    case 'bip':           return v.toFixed(0) + ' Mrd.';
    default:              return String(v);
  }
}

async function init() {
  if (!SESSION_ID) {
    showError('Keine Session-ID in der URL. Bitte über den Admin-Dashboard-Link öffnen.');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/sessions/${SESSION_ID}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    render(await res.json());
  } catch (e) {
    showError('Fehler beim Laden: ' + e.message);
  }
}

function showError(msg) {
  document.getElementById('loading').style.display = 'none';
  const el = document.getElementById('error-msg');
  el.style.display = '';
  el.textContent = msg;
}

function render(session) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = '';

  const nameEl = document.getElementById('session-name-header');
  nameEl.textContent = session.name ?? session.id;
  document.title = `Auswertung — ${esc(session.name ?? session.id)}`;

  const lernziele = session.lernziele ?? [];
  const konfig = {
    ...KURS_KONFIG_DEFAULT,
    perioden_anzahl:       session.perioden_anzahl,
    perioden_laenge_jahre: session.perioden_laenge_jahre ?? 4,
    schocks:               session.schocks ?? [],
  };

  // KPIs für alle Teams berechnen
  const teamData = (session.team_names ?? []).map(teamName => {
    const ts = (session.teams ?? {})[teamName];
    if (!ts?.perioden?.length) return { teamName, lastEntry: null, lockedN: 0 };
    try {
      const pfad      = simulierePfad(ts.perioden.map(p => p.params), konfig);
      const lastEntry = pfad[pfad.length - 1];
      const lockedN   = ts.perioden.filter(p => p.locked).length;
      return { teamName, lastEntry, lockedN };
    } catch (_) {
      return { teamName, lastEntry: null, lockedN: 0 };
    }
  });

  // Beste Werte je KPI (nur Teams mit Daten)
  const withData = teamData.filter(t => t.lastEntry);
  const best = withData.length ? {
    saldo: Math.max(...withData.map(t => t.lastEntry.result.saldo)),
    schuld: Math.min(...withData.map(t => t.lastEntry.zustand.schuldenquote)),
    gini:   Math.min(...withData.map(t => t.lastEntry.result.gini)),
    co2:    Math.min(...withData.map(t => t.lastEntry.zustand.co2_kumulat)),
    bip:    Math.max(...withData.map(t => t.lastEntry.zustand.bip)),
  } : {};

  const isBest = (v, b) => v !== null && b !== null && Math.abs(v - b) < 0.01;

  if (lernziele.length) document.getElementById('th-lernziele').style.display = '';

  // Vergleichstabelle
  const tbody = document.getElementById('cmp-tbody');
  if (teamData.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="9" class="no-data-row">Noch keine Teams haben gespielt.</td>`;
    tbody.appendChild(tr);
  } else {
    for (const { teamName, lastEntry, lockedN } of teamData) {
      const r = lastEntry?.result;
      const z = lastEntry?.zustand;
      const allDone = lockedN >= session.perioden_anzahl;

      const cls = (v, b) => isBest(v, b) ? 'kpi-best' : '';

      let zielCell = '';
      if (lernziele.length) {
        if (r && z) {
          const bwg = bewerteLernziele(r, z, lernziele);
          const all = bwg.erreicht === bwg.total;
          zielCell = `<td style="color:${all ? 'var(--good)' : 'var(--warn)'}">
            ${bwg.erreicht}/${bwg.total}
          </td>`;
        } else {
          zielCell = '<td style="color:var(--muted)">—</td>';
        }
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(teamName)}</strong></td>
        <td><span class="period-badge ${allDone ? 'done' : ''}">${lockedN}/${session.perioden_anzahl}</span></td>
        <td class="${cls(r?.saldo, best.saldo)}">${r ? (r.saldo >= 0 ? '+' : '') + r.saldo.toFixed(0) + ' Mrd.' : '—'}</td>
        <td class="${cls(z?.schuldenquote, best.schuld)}">${z ? z.schuldenquote.toFixed(1) + ' %' : '—'}</td>
        <td class="${cls(r?.gini, best.gini)}">${r ? r.gini.toFixed(3) : '—'}</td>
        <td class="${cls(z?.co2_kumulat, best.co2)}">${z ? Math.round(z.co2_kumulat) + ' Mt' : '—'}</td>
        <td class="${cls(z?.bip, best.bip)}">${z ? z.bip.toFixed(0) + ' Mrd.' : '—'}</td>
        ${zielCell}
        <td class="feedback-cell">${esc(lastEntry ? generiereTeamFeedback(lastEntry) : '—')}</td>`;
      tbody.appendChild(tr);
    }
  }

  // Feedback-Karten
  const grid = document.getElementById('feedback-grid');
  for (const { teamName, lastEntry } of teamData) {
    const r = lastEntry?.result;
    const z = lastEntry?.zustand;
    const bwg = (r && z) ? bewerteLernziele(r, z, lernziele) : null;

    let zielHtml = '';
    if (bwg && bwg.total > 0) {
      zielHtml = bwg.details.map(d => `
        <div class="lernziel-item ${d.erreicht ? 'lernziel-ok' : 'lernziel-nok'}">
          <span class="lz-icon">${d.erreicht ? '✓' : '✗'}</span>
          <span class="lz-label">${esc(d.label)} ${fmtOp(d.operator)} ${fmtKpiVal(d.kpi, d.wert)}</span>
          <span class="lz-ist">(${fmtKpiVal(d.kpi, d.ist)})</span>
        </div>`).join('');
    } else if (!lernziele.length) {
      zielHtml = '<div class="no-lernziele">Keine Lernziele definiert.</div>';
    } else {
      zielHtml = '<div class="no-lernziele">Noch keine Daten.</div>';
    }

    const card = document.createElement('div');
    card.className = 'feedback-card';
    card.innerHTML = `
      <div class="feedback-card-team">${esc(teamName)}</div>
      <div class="feedback-card-text">${esc(lastEntry ? generiereTeamFeedback(lastEntry) : 'Noch keine Daten.')}</div>
      ${zielHtml}`;
    grid.appendChild(card);
  }

  // CSV-Export
  document.getElementById('btn-csv').addEventListener('click', () => exportCsv(session, teamData, lernziele));
}

function exportCsv(session, teamData, lernziele) {
  const headers = ['Team', 'Perioden', 'Saldo (Mrd.)', 'Schuldenquote (%)', 'Gini', 'CO2 (Mt)', 'BIP (Mrd.)'];
  if (lernziele.length) headers.push('Lernziele erreicht');
  headers.push('Einschätzung');

  const rows = teamData.map(({ teamName, lastEntry, lockedN }) => {
    const r = lastEntry?.result;
    const z = lastEntry?.zustand;
    const cols = [
      teamName,
      `${lockedN}/${session.perioden_anzahl}`,
      r ? (r.saldo >= 0 ? '+' : '') + r.saldo.toFixed(0) : '',
      z ? z.schuldenquote.toFixed(1) : '',
      r ? r.gini.toFixed(3) : '',
      z ? Math.round(z.co2_kumulat) : '',
      z ? z.bip.toFixed(0) : '',
    ];
    if (lernziele.length) {
      if (r && z) {
        const bwg = bewerteLernziele(r, z, lernziele);
        cols.push(`${bwg.erreicht}/${bwg.total}`);
      } else cols.push('');
    }
    cols.push(lastEntry ? generiereTeamFeedback(lastEntry) : '');
    return cols;
  });

  const csv = [headers, ...rows]
    .map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `Auswertung_${session.id}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

init();
