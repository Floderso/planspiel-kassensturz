// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════════
// KASSENSTURZ · Planspiel — Debriefing-Cockpit für Dozierende
// ═══════════════════════════════════════════════════════════════════════════════

import { simulierePfad }  from './rechner/transition.js';
import { KURS_KONFIG_DEFAULT, PRESETS } from './data.js';
import { generiereTeamFeedback, bewerteLernziele, erzeugeKausalketten } from './feedback.js';

const API_BASE   = 'https://planspiel-api.aramisda2.workers.dev/api';
const SESSION_ID = new URLSearchParams(location.search).get('session');

const CHART_COLORS = ['#1B4FD8', '#166534', '#D97706', '#DC2626', '#7C3AED', '#0284C7'];

// ── Archetypische Kursdaten für Demo- & Offline-Modus ──────────────────────────
const DEMO_SESSION = {
  id: 'demo-kurs',
  name: 'WiPo Planspiel · Sommersemester 2026 (Demo-Kurs)',
  perioden_anzahl: 5,
  perioden_laenge_jahre: 4,
  team_names: [
    'Team A (Konsolidierung)',
    'Team B (Green New Deal)',
    'Team C (Sozialstaat)',
    'Team D (Steuersenkung)',
  ],
  schocks: [
    { periode: 2, id: 'energiekrise', name: 'Energiepreisschock', typ: 'energie', effekte: { bip_malus: 0.03 } }
  ],
  lernziele: [
    { kpi: 'schuldenquote', operator: '<=', wert: 65, label: 'Schuldenquote ≤ 65 %' },
    { kpi: 'saldo_bip_pct', operator: '>=', wert: -0.35, label: 'Schuldenbremse eingehalten' },
    { kpi: 'gini', operator: '<=', wert: 0.285, label: 'Gini ≤ 0,285' }
  ],
  teams: {
    'Team A (Konsolidierung)': {
      perioden: Array.from({ length: 5 }, (_, i) => ({
        idx: i,
        locked: true,
        params: { ...PRESETS.status_quo, mwst: 20, spitze: 46, kst: 16, invest_impuls: 5, bg: 563 }
      }))
    },
    'Team B (Green New Deal)': {
      perioden: Array.from({ length: 5 }, (_, i) => ({
        idx: i,
        locked: true,
        params: { ...PRESETS.status_quo, co2: 100 + i * 15, klimageld: true, invest_impuls: 25, kst: 15 }
      }))
    },
    'Team C (Sozialstaat)': {
      perioden: Array.from({ length: 5 }, (_, i) => ({
        idx: i,
        locked: true,
        params: { ...PRESETS.status_quo, spitze: 50, freibetrag: 14000, bg: 680, kg: 300, invest_impuls: 10 }
      }))
    },
    'Team D (Steuersenkung)': {
      perioden: Array.from({ length: 5 }, (_, i) => ({
        idx: i,
        locked: true,
        params: { ...PRESETS.status_quo, kst: 11, spitze: 40, mwst: 19, invest_impuls: 0 }
      }))
    }
  }
};

/**
 * Ermittelt eine Session aus dem lokalen Spielstand (localStorage)
 * oder fällt auf die archetypische Demo-Session zurück.
 */
function getLocalOrDemoSession() {
  try {
    const raw = localStorage.getItem('kassensturz_planspiel_v1');
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved?.perioden && saved.perioden.length > 0) {
        const teamName = saved.team ? `Mein Team (${saved.team})` : 'Mein Kabinett (Lokal)';
        const myPerioden = saved.perioden.map(p => ({
          idx: p.idx,
          locked: !!p.locked,
          params: p.params || PRESETS.status_quo,
        }));

        return {
          id: 'lokal-session',
          isLocal: true,
          name: saved.kurs_konfig?.name || 'Planspiel Kassensturz (Lokaler Spielstand)',
          perioden_anzahl: saved.kurs_konfig?.perioden_anzahl ?? 5,
          perioden_laenge_jahre: saved.kurs_konfig?.perioden_laenge_jahre ?? 4,
          schocks: saved.kurs_konfig?.schocks ?? DEMO_SESSION.schocks,
          lernziele: saved.kurs_konfig?.lernziele ?? DEMO_SESSION.lernziele,
          team_names: [
            teamName,
            'Team A (Konsolidierung)',
            'Team B (Green New Deal)',
            'Team C (Sozialstaat)',
          ],
          teams: {
            [teamName]: { perioden: myPerioden },
            'Team A (Konsolidierung)': DEMO_SESSION.teams['Team A (Konsolidierung)'],
            'Team B (Green New Deal)': DEMO_SESSION.teams['Team B (Green New Deal)'],
            'Team C (Sozialstaat)': DEMO_SESSION.teams['Team C (Sozialstaat)'],
          }
        };
      }
    }
  } catch (_) {}

  return DEMO_SESSION;
}

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

// ── Initialisierung (Sofortige Visualisierung ohne Lade-Hänger) ─────────────────

function init() {
  // 1. Sofortiges Ausblenden des Ladehinweises und Anzeigen des Cockpits
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';

  // Demo-Button im Header verdrahten
  document.getElementById('btn-demo-header')?.addEventListener('click', () => {
    safeRender(DEMO_SESSION);
  });

  // Umschalt-Button im Banner verdrahten
  document.getElementById('btn-toggle-demo')?.addEventListener('click', () => {
    safeRender(DEMO_SESSION);
  });

  // 2. Sofort lokal oder Demo rendern (kein Warten auf Netzwerk!)
  const initialSession = getLocalOrDemoSession();
  safeRender(initialSession);

  // 3. Falls eine Session-ID in der URL vorliegt: Asynchron im Hintergrund abrufen mit 3,5s Timeout
  if (SESSION_ID) {
    showNotice(`Synchronisiere mit Cloud-Session "${esc(SESSION_ID)}" …`);
    syncBackendSession(SESSION_ID);
  }
}

async function syncBackendSession(sessionId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${API_BASE}/sessions/${sessionId}`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remoteSession = await res.json();
    safeRender(remoteSession);
    showNotice(`Cloud-Session "${esc(sessionId)}" erfolgreich geladen.`);
  } catch (e) {
    console.warn('Cloud-Sync nicht erfolgreich (Timeout oder Offline), nutze lokalen Stand:', e);
    showNotice(`Cloud-Session "${esc(sessionId)}" nicht erreichbar (${e.name === 'AbortError' ? 'Timeout' : e.message}). Lokale/Demo-Daten aktiv.`);
  }
}

function showNotice(msg) {
  const banner = document.getElementById('session-banner');
  const bannerText = document.getElementById('session-banner-text');
  if (banner && bannerText) {
    banner.style.display = 'flex';
    bannerText.textContent = msg;
  }
}

// ── Fehlerresistente Render-Pipeline ──────────────────────────────────────────

function safeRender(session) {
  try {
    render(session);
  } catch (err) {
    console.error('Fehler beim Rendern des Debriefing-Cockpits:', err);
    const errEl = document.getElementById('error-msg');
    if (errEl) {
      errEl.style.display = 'block';
      errEl.innerHTML = `
        <div style="background:var(--bad-bg); border:1px solid #FECACA; color:var(--bad); padding:16px; border-radius:8px; margin-bottom:20px; text-align:left;">
          <strong>Fehler bei der Auswertung:</strong> ${esc(err.message)}
          <div style="margin-top:10px;">
            <button class="btn-export btn-demo" onclick="location.reload()">Seite neu laden</button>
          </div>
        </div>
      `;
    }
  }
}

function render(session) {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';

  const contentEl = document.getElementById('content');
  if (contentEl) contentEl.style.display = 'block';

  const nameEl = document.getElementById('session-name-header');
  if (nameEl) nameEl.textContent = session.name ?? session.id;
  document.title = `Debriefing-Cockpit — ${esc(session.name ?? session.id)}`;

  // Banner konfigurieren
  const banner = document.getElementById('session-banner');
  const bannerText = document.getElementById('session-banner-text');
  if (banner && bannerText) {
    if (session.isLocal) {
      banner.style.display = 'flex';
      bannerText.textContent = 'ℹ Lokale Auswertung: Zeigt deine Entscheidungen im Vergleich zu 3 Referenz-Kabinette. (Dozenten-Modus mit Cloud-Sync: ?session=...)';
    } else if (session.id === 'demo-kurs') {
      banner.style.display = 'flex';
      bannerText.textContent = 'ℹ Demo-Modus: Zeigt 4 vorkonfigurierte Denkschulen (Konsolidierung, Green New Deal, Sozialstaat, Steuersenkung).';
    }
  }

  const lernziele = session.lernziele ?? [];
  const konfig = {
    ...KURS_KONFIG_DEFAULT,
    perioden_anzahl:       session.perioden_anzahl ?? 5,
    perioden_laenge_jahre: session.perioden_laenge_jahre ?? 4,
    schocks:               session.schocks ?? [],
  };

  // KPIs und vollständige Pfade für alle Teams berechnen
  const teamData = (session.team_names ?? []).map((teamName, idx) => {
    const ts = (session.teams ?? {})[teamName];
    if (!ts?.perioden?.length) return { teamName, idx, lastEntry: null, lockedN: 0, lastParams: null, pfad: [] };
    try {
      const pfad       = simulierePfad(ts.perioden.map(p => p.params), konfig);
      const lastEntry  = pfad[pfad.length - 1];
      const lockedN    = ts.perioden.filter(p => p.locked).length;
      const lastParams = ts.perioden[ts.perioden.length - 1]?.params ?? null;
      return { teamName, idx, lastEntry, lockedN, lastParams, pfad };
    } catch (err) {
      console.error('Pfadsimulation fehlgeschlagen für Team:', teamName, err);
      return { teamName, idx, lastEntry: null, lockedN: 0, lastParams: null, pfad: [] };
    }
  });

  // 1. Didaktischen Moderationsleitfaden rendern
  renderDebriefingGuide();

  // 2. Multi-Team Verlaufs-Chart rendern
  renderMultiTeamChart(teamData, session);

  // 3. Head-to-Head Vergleich rendern
  renderHeadToHead(teamData);

  // 4. Beste Werte je KPI ermitteln
  const withData = teamData.filter(t => t.lastEntry);
  const best = withData.length ? {
    saldo: Math.max(...withData.map(t => t.lastEntry.result.saldo)),
    schuld: Math.min(...withData.map(t => t.lastEntry.zustand.schuldenquote)),
    gini:   Math.min(...withData.map(t => t.lastEntry.result.gini)),
    co2:    Math.min(...withData.map(t => t.lastEntry.zustand.co2_kumulat)),
    bip:    Math.max(...withData.map(t => t.lastEntry.zustand.bip)),
  } : {};

  const isBest = (v, b) => v !== null && b !== null && Math.abs(v - b) < 0.01;

  const thLz = document.getElementById('th-lernziele');
  if (thLz) thLz.style.display = lernziele.length ? '' : 'none';

  // 5. Vergleichstabelle
  const tbody = document.getElementById('cmp-tbody');
  if (tbody) {
    tbody.innerHTML = '';
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
  }

  // 6. Feedback-Karten mit Kausalketten
  const grid = document.getElementById('feedback-grid');
  if (grid) {
    grid.innerHTML = '';
    for (const { teamName, lastEntry, lastParams } of teamData) {
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

      const kausalketten = (lastEntry && lastParams) ? erzeugeKausalketten(lastParams, r, z) : [];
      const kausalHtml = kausalketten.length ? `
        <div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:10px; font-weight:600; text-transform:uppercase; color:var(--muted); letter-spacing:.4px;">Dominante Kausalketten</div>
          ${kausalketten.slice(0, 3).map(k => `
            <div style="font-size:11px; line-height:1.4;">
              <strong style="color:var(--ink);">${esc(k.title)}</strong>
              <span style="font-family:'JetBrains Mono',monospace; font-size:9px; color:var(--muted); background:var(--surface); padding:1px 5px; border-radius:3px; border:1px solid var(--border); margin-left:4px;">${esc(k.mechanism)}</span>
              <div style="color:var(--ink-2); font-size:11px; margin-top:2px;">${esc(k.text)}</div>
            </div>
          `).join('')}
        </div>
      ` : '';

      const card = document.createElement('div');
      card.className = 'feedback-card';
      card.innerHTML = `
        <div class="feedback-card-team">${esc(teamName)}</div>
        <div class="feedback-card-text">${esc(lastEntry ? generiereTeamFeedback(lastEntry) : 'Noch keine Daten.')}</div>
        ${zielHtml}
        ${kausalHtml}`;
      grid.appendChild(card);
    }
  }

  // 7. CSV-Export
  const btnCsv = document.getElementById('btn-csv');
  if (btnCsv) {
    btnCsv.onclick = () => exportCsv(session, teamData, lernziele);
  }
}

// ── 1. Moderationsleitfaden (3D / 4-Phasen-Modell) ────────────────────────────

function renderDebriefingGuide() {
  const container = document.getElementById('guide-container');
  if (!container) return;

  const PHASEN = [
    {
      nr: 1,
      badge: 'Defuse · Emotionen',
      badgeCls: 'badge-phase-1',
      title: 'Phase 1: Rollenentlastung & Gruppendynamik (3–5 Min.)',
      goal: 'Didaktisches Ziel: Distanz zur gespielten Rolle aufbauen, Frust über Zielkonflikte abbauen.',
      questions: [
        'Wer fühlte sich in seinem Kabinett von Koalitionspartnern überstimmt oder blockiert?',
        'An welchen Entscheidungen (z. B. Schuldenbremse vs. Bürgergeld) entzündete sich im Team der größte Streit?',
        'Wie habt ihr Kompromisse geschlossen: Sachargumente, fauler Kuhhandel oder Kampfabstimmung?'
      ]
    },
    {
      nr: 2,
      badge: 'Discover · Muster',
      badgeCls: 'badge-phase-2',
      title: 'Phase 2: Makroökonomischer Strategievergleich (5–7 Min.)',
      goal: 'Didaktisches Ziel: Die unterschiedlichen finanzpolitischen Denkschulen im Kurs sichtbar machen.',
      questions: [
        'Betrachtet den Verlaufs-Chart: Welche Teams verfolgten Austérité (Konsolidierung) und welche expansive Investitionspfade?',
        'Welches Team hat den stärksten Rückgang der Ungleichheit (Gini/Palma) erzielt — und was war der fiskalische Preis dafür?',
        'Wo traten unvorhergesehene Nebeneffekte auf (z. B. Einbruch der privaten Investitionen nach KSt-Erhöhung)?'
      ]
    },
    {
      nr: 3,
      badge: 'Deepen · Kausalität',
      badgeCls: 'badge-phase-3',
      title: 'Phase 3: Kausalanalyse & ökonomische Mechanismen (5–7 Min.)',
      goal: 'Didaktisches Ziel: Simulationsdaten mit volkswirtschaftlichen Theorien verknüpfen.',
      questions: [
        'Warum steigt das Steueraufkommen bei höherem Spitzensteuersatz nicht linear an? (Saez/Chetty Arbeitsangebotselastizität ε = 0,20)',
        'Welche Rolle spielte der HANK-Multiplikator: Warum belebten Transfers an untere Dezile den Konsum stärker als Steuersenkungen für Vermögende?',
        'War der CO₂-Preis sozial verträglich? Warum ist die Rückvergütung als pauschales Klimageld progressiv?'
      ]
    },
    {
      nr: 4,
      badge: 'Transfer · Realität',
      badgeCls: 'badge-phase-4',
      title: 'Phase 4: Realitätstransfer & Reflexion der Modellgrenzen (5 Min.)',
      goal: 'Didaktisches Ziel: Abstraktion auf reale Koalitionsverhandlungen im Deutschen Bundestag.',
      questions: [
        'Warum sind verfassungsrechtliche Regeln wie die Schuldenbremse (Art. 109 GG) in der Praxis so umstritten?',
        'Welche Aspekte der Realität hat unser Modell vereinfacht (z. B. bürokratische Umsetzungsdauer, Wahlen, Lobbyismus)?',
        'Was nehmt ihr für euer Verständnis aktueller Haushaltsdebatten mit?'
      ]
    }
  ];

  container.innerHTML = PHASEN.map((p, idx) => `
    <div class="guide-phase">
      <div class="guide-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
        <span>${esc(p.title)}</span>
        <span class="guide-badge ${p.badgeCls}">${esc(p.badge)}</span>
      </div>
      <div class="guide-body ${idx > 0 ? 'hidden' : ''}">
        <div class="guide-goal">${esc(p.goal)}</div>
        <div style="font-weight:600; color:var(--muted); font-size:11px; margin-top:6px; text-transform:uppercase;">Leitfragen für das Plenum:</div>
        <ul class="guide-questions">
          ${p.questions.map(q => `<li>${esc(q)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `).join('');
}

// ── 2. Multi-Team Verlaufs-Chart (SVG) ─────────────────────────────────────────

let currentChartMetric = 'schuldenquote';

function renderMultiTeamChart(teamData, session) {
  const container = document.getElementById('multi-chart-container');
  const legend = document.getElementById('multi-chart-legend');
  if (!container || !legend) return;

  const validTeams = teamData.filter(t => t.pfad && t.pfad.length > 0);
  if (!validTeams.length) {
    container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--muted);">Keine Zeitreihendaten vorhanden.</div>';
    legend.innerHTML = '';
    return;
  }

  // Toolbar Metric-Umschalter verdrahten
  document.querySelectorAll('.metric-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChartMetric = btn.dataset.metric;
      drawSvgChart(validTeams, currentChartMetric, container, legend, session);
    };
  });

  drawSvgChart(validTeams, currentChartMetric, container, legend, session);
}

function drawSvgChart(teams, metric, container, legend, session) {
  const METRIK_DEF = {
    schuldenquote: { label: 'Schuldenquote', unit: '%', getVal: e => e.zustand.schuldenquote, digits: 1 },
    saldo:         { label: 'Haushaltssaldo', unit: 'Mrd. €', getVal: e => e.result.saldo, digits: 0 },
    gini:          { label: 'Gini-Ungleichheit', unit: '', getVal: e => e.result.gini, digits: 3 },
    bip:           { label: 'Bruttoinlandsprodukt', unit: 'Mrd. €', getVal: e => e.zustand.bip, digits: 0 },
  };
  const def = METRIK_DEF[metric] ?? METRIK_DEF.schuldenquote;

  // Min / Max ermitteln
  let minV = Infinity;
  let maxV = -Infinity;
  for (const t of teams) {
    for (const e of t.pfad) {
      const v = def.getVal(e);
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }

  if (!isFinite(minV) || !isFinite(maxV)) { minV = 0; maxV = 100; }
  const span = maxV - minV || 1;
  const pad = span * 0.12;
  const yMin = minV - pad;
  const yMax = maxV + pad;

  const w = 740;
  const h = 220;
  const padL = 60;
  const padR = 40;
  const padT = 20;
  const padB = 30;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const maxPeriods = Math.max(...teams.map(t => t.pfad.length));
  const xStep = maxPeriods > 1 ? plotW / (maxPeriods - 1) : plotW;

  const getY = val => padT + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
  const getX = idx => padL + idx * xStep;

  // Gitterlinien & Y-Achsen-Ticks (4 Ticks)
  let gridLinesHtml = '';
  for (let i = 0; i <= 4; i++) {
    const yVal = yMin + (i / 4) * (yMax - yMin);
    const yPos = getY(yVal);
    gridLinesHtml += `
      <line x1="${padL}" y1="${yPos}" x2="${w - padR}" y2="${yPos}" stroke="var(--border)" stroke-dasharray="3,3" />
      <text x="${padL - 8}" y="${yPos + 4}" font-size="10" fill="var(--muted)" text-anchor="end" font-family="'JetBrains Mono',monospace">
        ${yVal.toFixed(def.digits)} ${def.unit}
      </text>
    `;
  }

  // X-Achsen-Labels
  let xLabelsHtml = '';
  const firstTeamPfad = teams[0].pfad;
  for (let i = 0; i < maxPeriods; i++) {
    const xPos = getX(i);
    const label = firstTeamPfad[i]?.label ?? `P ${i+1}`;
    xLabelsHtml += `
      <text x="${xPos}" y="${h - 8}" font-size="10" fill="var(--ink-2)" text-anchor="middle" font-family="'Inter',sans-serif">
        ${esc(label)}
      </text>
    `;
  }

  // Team-Linien zeichnen
  let linesHtml = '';
  teams.forEach((t, tIdx) => {
    const color = CHART_COLORS[tIdx % CHART_COLORS.length];
    const points = t.pfad.map((e, pIdx) => ({ x: getX(pIdx), y: getY(def.getVal(e)), val: def.getVal(e) }));
    if (!points.length) return;

    const pathData = points.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');

    const circles = points.map(pt => `
      <circle cx="${pt.x}" cy="${pt.y}" r="4" fill="${color}" stroke="#FFFFFF" stroke-width="1.5">
        <title>${esc(t.teamName)}: ${pt.val.toFixed(def.digits)} ${def.unit}</title>
      </circle>
    `).join('');

    linesHtml += `
      <path d="${pathData}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
      ${circles}
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; display:block;">
      ${gridLinesHtml}
      ${xLabelsHtml}
      ${linesHtml}
    </svg>
  `;

  // Legende rendern
  legend.innerHTML = teams.map((t, tIdx) => {
    const color = CHART_COLORS[tIdx % CHART_COLORS.length];
    const lastVal = t.lastEntry ? def.getVal(t.lastEntry).toFixed(def.digits) + ' ' + def.unit : '—';
    return `
      <div class="chart-legend-item">
        <span class="chart-legend-dot" style="background:${color};"></span>
        <span style="font-weight:600; color:var(--ink);">${esc(t.teamName)}:</span>
        <span style="font-family:'JetBrains Mono',monospace; color:var(--ink-2);">${esc(lastVal)}</span>
      </div>
    `;
  }).join('');
}

// ── 3. Head-to-Head Team-Vergleich ────────────────────────────────────────────

function renderHeadToHead(teamData) {
  const sel1 = document.getElementById('h2h-select-1');
  const sel2 = document.getElementById('h2h-select-2');
  const container = document.getElementById('h2h-grid-container');
  if (!sel1 || !sel2 || !container) return;

  const validTeams = teamData.filter(t => t.lastEntry);
  if (validTeams.length < 2) {
    container.innerHTML = '<div style="grid-column: 1 / -1; padding:20px; text-align:center; color:var(--muted);">Mindestens zwei aktive Teams erforderlich.</div>';
    return;
  }

  // Optionen befüllen falls noch leer
  if (!sel1.options.length) {
    validTeams.forEach((t, i) => {
      sel1.add(new Option(t.teamName, i));
      sel2.add(new Option(t.teamName, i));
    });
    sel1.selectedIndex = 0;
    sel2.selectedIndex = Math.min(1, validTeams.length - 1);
  }

  const updateH2H = () => {
    const idx1 = parseInt(sel1.value) || 0;
    const idx2 = parseInt(sel2.value) || 0;
    const tA = validTeams[idx1];
    const tB = validTeams[idx2];
    if (!tA || !tB) return;

    container.innerHTML = `
      ${renderH2HCard(tA, tB, 0)}
      ${renderH2HCard(tB, tA, 1)}
    `;
  };

  sel1.onchange = updateH2H;
  sel2.onchange = updateH2H;
  updateH2H();
}

function renderH2HCard(team, otherTeam, slotIdx) {
  const r = team.lastEntry.result;
  const z = team.lastEntry.zustand;
  const p = team.lastParams || PRESETS.status_quo;
  const otherR = otherTeam.lastEntry.result;
  const otherZ = otherTeam.lastEntry.zustand;
  const color = CHART_COLORS[slotIdx % CHART_COLORS.length];

  const diffBadge = (v1, v2, suffix = '', reverseGood = false) => {
    const d = v1 - v2;
    if (Math.abs(d) < 0.001) return '<span style="color:var(--muted); font-size:10px;">gleich</span>';
    const isGood = reverseGood ? d < 0 : d > 0;
    const cls = isGood ? 'var(--good)' : 'var(--bad)';
    return `<span style="color:${cls}; font-size:10px; font-weight:600;">${d > 0 ? '+' : ''}${d.toFixed(1)}${suffix}</span>`;
  };

  const kausalketten = erzeugeKausalketten(p, r, z).slice(0, 2);

  return `
    <div class="h2h-card" style="border-top: 3px solid ${color};">
      <div class="h2h-card-title">
        <span>${esc(team.teamName)}</span>
        <span style="font-size:11px; font-weight:400; color:var(--muted); font-family:'JetBrains Mono',monospace;">${team.lockedN} Perioden</span>
      </div>

      <table class="h2h-stat-table">
        <tr>
          <td>Haushaltssaldo</td>
          <td>${r.saldo >= 0 ? '+' : ''}${r.saldo.toFixed(0)} Mrd. € (${r.saldo_bip_pct.toFixed(2)} % BIP)</td>
        </tr>
        <tr>
          <td>Schuldenquote</td>
          <td>${z.schuldenquote.toFixed(1)} % ${diffBadge(z.schuldenquote, otherZ.schuldenquote, ' PP', true)}</td>
        </tr>
        <tr>
          <td>Gini-Ungleichheit</td>
          <td>${r.gini.toFixed(3)} ${diffBadge(r.gini, otherR.gini, '', true)}</td>
        </tr>
        <tr>
          <td>Kumulierte CO₂-Emissionen</td>
          <td>${Math.round(z.co2_kumulat)} Mt ${diffBadge(z.co2_kumulat, otherZ.co2_kumulat, ' Mt', true)}</td>
        </tr>
        <tr>
          <td>BIP</td>
          <td>${z.bip.toFixed(0)} Mrd. € ${diffBadge(z.bip, otherZ.bip, ' Mrd.')}</td>
        </tr>
      </table>

      <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--muted); letter-spacing:.4px; margin-bottom:6px;">
        Zentrale Steuerungsparameter
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
        <span style="font-family:'JetBrains Mono',monospace; font-size:10px; background:var(--surface); padding:2px 6px; border:1px solid var(--border); border-radius:3px;">Spitzensteuer: ${p.spitze}%</span>
        <span style="font-family:'JetBrains Mono',monospace; font-size:10px; background:var(--surface); padding:2px 6px; border:1px solid var(--border); border-radius:3px;">KSt: ${p.kst}%</span>
        <span style="font-family:'JetBrains Mono',monospace; font-size:10px; background:var(--surface); padding:2px 6px; border:1px solid var(--border); border-radius:3px;">MwSt: ${p.mwst}%</span>
        <span style="font-family:'JetBrains Mono',monospace; font-size:10px; background:var(--surface); padding:2px 6px; border:1px solid var(--border); border-radius:3px;">CO₂: ${p.co2} €/t ${p.klimageld ? '(+Klimageld)' : ''}</span>
        <span style="font-family:'JetBrains Mono',monospace; font-size:10px; background:var(--surface); padding:2px 6px; border:1px solid var(--border); border-radius:3px;">Invest-Impuls: +${p.invest_impuls || 0} Mrd.</span>
      </div>

      <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--muted); letter-spacing:.4px; margin-bottom:4px;">
        Dominante Kausalketten
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        ${kausalketten.map(k => `
          <div style="font-size:11px; line-height:1.35; background:var(--surface); padding:6px 8px; border-radius:4px; border:1px solid var(--border);">
            <strong style="color:var(--ink);">${esc(k.title)}</strong>
            <div style="color:var(--muted); font-size:10px; font-family:'JetBrains Mono',monospace;">${esc(k.mechanism)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── CSV-Export ────────────────────────────────────────────────────────────────

function exportCsv(session, teamData, lernziele) {
  const headers = ['Team', 'Perioden', 'Saldo (Mrd.)', 'Schuldenquote (%)', 'Gini', 'CO2 (Mt)', 'BIP (Mrd.)'];
  if (lernziele.length) headers.push('Lernziele erreicht');
  headers.push('Einschätzung');

  const rows = teamData.map(({ teamName, lastEntry, lockedN }) => {
    const r = lastEntry?.result;
    const z = lastEntry?.zustand;
    const cols = [
      `"${esc(teamName)}"`,
      `"${lockedN}/${session.perioden_anzahl}"`,
      r ? r.saldo.toFixed(1) : '',
      z ? z.schuldenquote.toFixed(1) : '',
      r ? r.gini.toFixed(3) : '',
      z ? Math.round(z.co2_kumulat) : '',
      z ? z.bip.toFixed(0) : '',
    ];
    if (lernziele.length) {
      if (r && z) {
        const bwg = bewerteLernziele(r, z, lernziele);
        cols.push(`"${bwg.erreicht}/${bwg.total}"`);
      } else {
        cols.push('""');
      }
    }
    cols.push(lastEntry ? `"${esc(generiereTeamFeedback(lastEntry))}"` : '""');
    return cols.join(';');
  });

  const csv = [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kassensturz-auswertung-${session.id ?? 'export'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Start beim Laden der Seite: sofort initialisieren
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
