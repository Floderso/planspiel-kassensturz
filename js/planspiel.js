// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Planspiel — UI-Controller
// ═══════════════════════════════════════════════════════

import { simulierePfad } from './rechner/transition.js';
import { berechneAbgeleitet, CO2_BUDGET_DE } from './rechner/abgeleitet.js';
import { berechneRente } from './rechner/rente.js';
import { PRESETS, KURS_KONFIG_DEFAULT, SCHOCK_BIBLIOTHEK, TOOLTIPS } from './data.js';
import { bewerteLernziele, erzeugeKausalketten } from './feedback.js';
import { waehleMedienspiegel, berechneWaehlerstimmung } from './rechner/medienspiegel.js';
import { hatBackend } from './konfig.js';
import {
  holeSitzung, holeMitglieder, trittBei, sendeTeamZustand, stimmeAb,
} from './dienste/server.js';

// ── URL-Konfiguration ─────────────────────────────────────────────────────────
// Lehrpersonen können die Kurskonfiguration per URL-Parameter setzen:
//   ?perioden=5&teams=4&sandbox=false&name=WiPo+SS26&session=abc123&level=fortgeschritten
// Fehlende Parameter fallen auf KURS_KONFIG_DEFAULT zurück.

function parseUrlKonfig() {
  const p = new URLSearchParams(location.search);
  const konfig = {};
  if (p.has('perioden'))  konfig.perioden_anzahl      = Math.max(1, Math.min(12, +p.get('perioden')));
  if (p.has('teams'))     konfig.team_groesse          = Math.max(1, Math.min(50, +p.get('teams')));
  if (p.has('sandbox'))   konfig.sandbox               = p.get('sandbox') !== 'false';
  if (p.has('name'))      konfig.kurs_name             = p.get('name').slice(0, 80);
  if (p.has('level')) {
    const lv = p.get('level');
    if (['einsteiger', 'fortgeschritten', 'experte'].includes(lv)) konfig.komplexitaet = lv;
  }
  if (p.has('laengen')) {
    const parts = p.get('laengen').split(',').map(s => Math.max(1, Math.min(20, parseInt(s) || 4)));
    konfig.perioden_laenge_jahre = parts.length === 1 ? parts[0] : parts;
  }
  if (p.has('werkzeuge')) {
    try {
      konfig.perioden_werkzeuge = JSON.parse(p.get('werkzeuge'));
    } catch (_) {}
  }
  return konfig;
}

// session_id aus URL — wird für Backend-Sync verwendet (Phase 2b)
// Ohne konfiguriertes Backend (konfig.js: api_basis leer) gilt jede Sitzung als
// nicht vorhanden — damit greifen alle bestehenden Offline-Pfade automatisch.
const URL_SESSION_ID = hatBackend()
  ? (new URLSearchParams(location.search).get('session') ?? null)
  : null;

// ── LocalStorage-Schema ──────────────────────────────────────────────────────

const LS_KEY = 'kassensturz_planspiel_v1';

function defaultState(konfig = KURS_KONFIG_DEFAULT) {
  const urlKonfig   = parseUrlKonfig();
  const mergedKonfig = { ...konfig, ...urlKonfig };
  return {
    version:         1,
    team_id:         'Team A',
    sandbox:         mergedKonfig.sandbox ?? true,
    session_id:      URL_SESSION_ID,
    kurs_konfig:     mergedKonfig,
    current_periode: 0,
    watchlist:       ['saldo', 'waehler', 'gini', 'schuldenquote'],
    active_widgets:      [], // Standardmäßig leer für eine ruhige, aufgeräumte Startseite
    show_ressort_cards:  false, // Ministerien-Karten standardmäßig eingeklappt
    watchlist_collapsed: false,
    perioden:        Array.from({ length: mergedKonfig.perioden_anzahl }, (_, i) => ({
      idx:    i,
      locked: false,
      params: { ...PRESETS.status_quo, invest_impuls: 0 },
      votes:  0,
    })),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Gespeicherten State verwerfen wenn Session-ID nicht übereinstimmt
      if (URL_SESSION_ID && saved.session_id !== URL_SESSION_ID) return defaultState();
      if (!saved.watchlist || !Array.isArray(saved.watchlist)) {
        saved.watchlist = ['saldo', 'waehler', 'gini', 'schuldenquote'];
      }
      if (!saved.active_widgets || !Array.isArray(saved.active_widgets)) {
        saved.active_widgets = [];
      }
      if (typeof saved.show_ressort_cards !== 'boolean') saved.show_ressort_cards = false;
      if (typeof saved.watchlist_collapsed !== 'boolean') saved.watchlist_collapsed = false;
      saved._fromLocalStorage = true;
      return saved;
    }
  } catch (_) {}
  return defaultState();
}

function saveState(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (_) {}
  // Bei aktiver Session asynchron ans Backend pushen (Fehler werden ignoriert)
  if (URL_SESSION_ID) apiPushState();
}

// ── Simulation ────────────────────────────────────────────────────────────────

function simulate(state) {
  const params = state.perioden.map(p => p.params);
  return simulierePfad(params, state.kurs_konfig);
}

// ── Formatierung ──────────────────────────────────────────────────────────────

const fmt = {
  mrd:   v => (v >= 0 ? '+' : '') + v.toFixed(0) + ' Mrd.',
  mrdAbs:v => v.toFixed(0) + ' Mrd.',
  pct:   v => v.toFixed(1) + ' %',
  pct2:  v => v.toFixed(2) + ' %',
  delta: v => (v >= 0 ? '+' : '') + v.toFixed(1),
  comma3:v => v.toFixed(3).replace('.', ','),
  idx:   v => v.toFixed(1),
};

function deltaClass(v, dir = 'up') {
  if (Math.abs(v) < 0.001) return 'neutral';
  return (dir === 'up') === (v > 0) ? 'good' : 'bad';
}

// ── Komplexitätsstufen (MOD_DEFS-kompatibel: 'ein' | 'fort' | 'exp') ─────────

const KOMPLEXITAET_TO_LEVEL = { einsteiger: 'ein', fortgeschritten: 'fort', experte: 'exp' };
const LEVEL_ORDER = { ein: 0, fort: 1, exp: 2 };
const LEVEL_LABEL = { ein: 'Einsteiger', fort: 'Fortgeschritten', exp: 'Experte' };

function getLevelCode() {
  return KOMPLEXITAET_TO_LEVEL[state.kurs_konfig.komplexitaet] ?? 'fort';
}

// ── Tooltip-Inhalte ───────────────────────────────────────────────────────────
// TOOLTIPS (data.js) deckt die meisten Parameter ab; ein paar neuere Regler
// (BGE, Renten-Zielwerte, Investitionsimpuls) haben dort noch keinen Eintrag.

const TOOLTIP_FALLBACK = {
  invest_impuls: {
    title: 'Öffentlicher Investitionsimpuls',
    text: 'Zusätzliche öffentliche Investitionen pro Jahr, wirken über den Fiskalmultiplikator auf das BIP-Wachstum der Folgeperiode.',
    quelle: 'Gechert/Heimberger (2022) NIER · ECB WP 1267',
  },
  bge: {
    title: 'Bedingungsloses Grundeinkommen (BGE)',
    text: 'Monatliche Pro-Kopf-Zahlung an alle Erwachsenen ohne Bedürftigkeitsprüfung, ersetzt das Bürgergeld sobald es dessen Niveau erreicht. RWI (2024)/ZEW: dämpft das Arbeitsangebot in unteren Dezilen (Substitutionseffekt). ifo-Mikrosimulation (2021): hohe Finanzierungskosten (~1.000 Mrd. €/Jahr bei 1.200 €).',
    quelle: 'RWI (2024) · DIW-Pilotprojekt 2024 (n=107) · ZEW Heim et al. · ifo Mikrosimulation 2021 (Blömer/Peichl)',
  },
  rente_grenze: {
    title: 'Renten-Einkommensgrenze (BGE-Aufstockung)',
    text: 'Trennlinie zwischen "Geringverdiener"- und "Gutverdiener"-Rentner:innen bei der BGE-Rentenaufstockung — bestimmt, wie viele Rentner:innen welchem Zielniveau zugeordnet werden.',
    quelle: 'Modellannahme, angelehnt an DRV Rentenversicherungsbericht 2024',
  },
  rente_niveau_gering: {
    title: 'Ziel-Rentenniveau Geringverdiener',
    text: 'Ziel-Nettorentenniveau (% des Referenzeinkommens) für Geringverdiener:innen, auf das das BGE ggf. aufgestockt wird.',
    quelle: 'Modellannahme, angelehnt an DRV Rentenversicherungsbericht 2024',
  },
  rente_niveau_hoch: {
    title: 'Ziel-Rentenniveau Gutverdiener',
    text: 'Ziel-Nettorentenniveau (% des Referenzeinkommens) für Gutverdiener:innen, auf das das BGE ggf. aufgestockt wird.',
    quelle: 'Modellannahme, angelehnt an DRV Rentenversicherungsbericht 2024',
  },
};

function getTooltip(key) {
  return TOOLTIPS[key] ?? TOOLTIP_FALLBACK[key] ?? null;
}

// ── Info-Popover (ersetzt Browser-title=; eine globale Instanz, per JS positioniert) ──

function ensureInfoPopover() {
  let el = document.getElementById('info-popover');
  if (!el) {
    el = document.createElement('div');
    el.id = 'info-popover';
    el.className = 'info-popover hidden';
    document.body.appendChild(el);
  }
  return el;
}

function showInfoPopover(trigger, key) {
  const info = getTooltip(key);
  if (!info) return;
  const el = ensureInfoPopover();
  el.innerHTML = `
    <div class="info-popover-title">${info.title}</div>
    <div class="info-popover-text">${info.text}</div>
    <div class="info-popover-quelle">${info.quelle}</div>`;
  el.classList.remove('hidden');
  const rect  = trigger.getBoundingClientRect();
  const width = 280;
  let left = rect.left;
  if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top  = `${rect.bottom + 6}px`;
  el.dataset.openFor = key;
}

function hideInfoPopover() {
  const el = document.getElementById('info-popover');
  if (el) { el.classList.add('hidden'); delete el.dataset.openFor; }
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-info-key]');
  const popover = document.getElementById('info-popover');
  if (trigger) {
    e.stopPropagation();
    if (popover && !popover.classList.contains('hidden') && popover.dataset.openFor === trigger.dataset.infoKey) {
      hideInfoPopover();
    } else {
      showInfoPopover(trigger, trigger.dataset.infoKey);
    }
    return;
  }
  if (popover && !popover.classList.contains('hidden') && !popover.contains(e.target)) hideInfoPopover();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideInfoPopover(); });

// ── SVG-Chart-Helper (kein Build-Schritt, keine Abhängigkeit) ────────────────
// Farb-Rollen: var(--chart-1..4) für kategoriale Mehrfachserien (gegen die
// data-viz-Skill validiert — CVD ΔE 9.1, normal-vision ΔE 22.9 bei 4 Slots),
// var(--good)/var(--bad) für divergierende Gewinner/Verlierer-Encodings.

function svgLineChart(series, opts = {}) {
  const width  = opts.width  ?? 240;
  const height = opts.height ?? 100;
  const padL = 30, padR = opts.padR ?? 40, padT = 8, padB = 16;
  const w = Math.max(10, width - padL - padR);
  const h = Math.max(10, height - padT - padB);

  const allPoints = series.flatMap(s => s.points);
  if (allPoints.length < 2) return '<div class="chart-empty">Zu wenig Daten für einen Verlauf.</div>';

  const xs = [...new Set(allPoints.map(p => p.x))].sort((a, b) => a - b);
  let yMin = Math.min(...allPoints.map(p => p.y));
  let yMax = Math.max(...allPoints.map(p => p.y));
  if (yMin === yMax) {
    // Flache Serie (z. B. konstanter Gini über alle Perioden): Spanne proportional
    // zum Wert selbst öffnen, nicht um einen fixen absoluten Betrag (sonst reißt
    // eine kleine Kennzahl wie Gini ≈ 0,38 die Achse auf einen Bereich bis > 1).
    const pad = Math.abs(yMin) * 0.1 || 1;
    yMin -= pad; yMax += pad;
  }
  const yPad = (yMax - yMin) * 0.12;
  yMin -= yPad; yMax += yPad;

  const xScale = x => padL + (xs.length > 1 ? (xs.indexOf(x) / (xs.length - 1)) * w : w / 2);
  const yScale = y => padT + h - ((y - yMin) / (yMax - yMin)) * h;
  const yFmt = opts.yFmt ?? (v => v.toFixed(0));

  const gridLines = [0, 0.5, 1].map(t => {
    const y   = padT + h * (1 - t);
    const val = yMin + (yMax - yMin) * t;
    return `<line class="chart-grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${(padL + w).toFixed(1)}" y2="${y.toFixed(1)}"/>
            <text class="chart-axis-label" x="${padL - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end">${yFmt(val)}</text>`;
  }).join('');

  // Endlabel-Positionen kollisionsfrei staffeln (min. 11px Abstand)
  const withLast = series
    .map(s => ({ s, pts: s.points.slice().sort((a, b) => a.x - b.x) }))
    .filter(x => x.pts.length);
  withLast.sort((a, b) => yScale(a.pts[a.pts.length - 1].y) - yScale(b.pts[b.pts.length - 1].y));
  let prevLabelY = -Infinity;
  for (const item of withLast) {
    const last = item.pts[item.pts.length - 1];
    let ly = yScale(last.y);
    if (ly - prevLabelY < 11) ly = prevLabelY + 11;
    item.labelY = ly;
    prevLabelY = ly;
  }

  // Einzelserie: Titel steht bereits außerhalb des Charts (kein Legend-Bedarf) —
  // das Endlabel zeigt stattdessen den aktuellen Wert (Marks-Anatomie: "Lines →
  // value at the end"). Mehrfachserien: Serienname, da Legende + Name gemeinsam
  // die Identität sichern.
  const paths = withLast.map(({ s, pts, labelY }) => {
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`).join(' ');
    // Bei dichten Reihen (z. B. 21 Jahrespunkte einer Projektion) nur Start/Ende
    // markieren — ein Punkt pro Datenpunkt wäre bei so vielen Werten reines Ink
    // ohne Informationsgewinn (siehe marks-and-anatomy: sparsame Marker).
    const dotPts = pts.length <= 8 ? pts : [pts[0], pts[pts.length - 1]];
    const dots = dotPts.map(p => `<circle cx="${xScale(p.x).toFixed(1)}" cy="${yScale(p.y).toFixed(1)}" r="3" fill="${s.color}" stroke="var(--surface)" stroke-width="1.5"/>`).join('');
    const last = pts[pts.length - 1];
    const labelText = series.length > 1 ? s.label : yFmt(last.y);
    const label = `<text x="${(xScale(last.x) + 5).toFixed(1)}" y="${labelY.toFixed(1)}" font-size="9" fill="${s.color}" dominant-baseline="middle">${labelText}</text>`;
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${label}`;
  }).join('');

  const xFmt = opts.xFmt ?? (x => x);
  // Achsenbeschriftung ausdünnen — max. 6 Labels, immer inkl. erstem/letztem Punkt,
  // sonst überlappt sich Text bei vielen x-Werten (z. B. 21 Jahre) unlesbar.
  const xTickStep = Math.max(1, Math.ceil(xs.length / 6));
  const xTicks = xs.filter((_, i) => i % xTickStep === 0 || i === xs.length - 1);
  const xLabels = xTicks.map(x => `<text class="chart-axis-label" x="${xScale(x).toFixed(1)}" y="${height - 4}" text-anchor="middle">${xFmt(x)}</text>`).join('');

  const legend = series.length > 1
    ? `<div class="chart-legend">${series.map(s => `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${s.color}"></span>${s.label}</span>`).join('')}</div>`
    : '';

  return `${legend}<svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    ${gridLines}
    ${paths}
    ${xLabels}
  </svg>`;
}

// Divergierender Balken-Chart (Nullachse mittig) — für Dezil-Deltas
function svgDivergingBars(items, opts = {}) {
  const width  = opts.width  ?? 400;
  const rowH   = opts.rowH   ?? 20;
  const labelW = opts.labelW ?? 34;
  const valueW = opts.valueW ?? 60;
  const height = items.length * rowH + 6;
  const plotW  = width - labelW - valueW;
  const cx     = labelW + plotW / 2;
  const halfW  = plotW / 2 - 6;
  const maxAbs = Math.max(...items.map(d => Math.abs(d.value)), 1);
  const fmt    = opts.fmt ?? (v => v.toFixed(0));

  const bars = items.map((d, i) => {
    const y        = 3 + i * rowH;
    const barH     = rowH - 8;
    const barW     = Math.max(0, Math.abs(d.value) / maxAbs * halfW);
    const positive = d.value >= 0;
    const x        = positive ? cx + 2 : cx - 2 - barW;
    const color    = positive ? 'var(--good)' : 'var(--bad)';
    const text     = fmt(d.value);
    // Bei langen Balken (z. B. große Deltas im obersten Dezil) reicht der Platz
    // außerhalb des Balkens nicht — Label dann in den Balken setzen (weiß) statt
    // es abzuschneiden oder in die Zeilenbeschriftung laufen zu lassen.
    const estTextW  = text.length * 5.6 + 6;
    const fitsInside = barW >= estTextW + 8;
    const textX     = fitsInside
      ? (positive ? x + barW - 6 : x + 6)
      : (positive ? x + barW + 6 : x - 6);
    const textAnchor = fitsInside ? (positive ? 'end' : 'start') : (positive ? 'start' : 'end');
    const textFill   = fitsInside ? '#fff' : color;
    return `
      <text class="chart-axis-label" x="${labelW - 6}" y="${(y + barH / 2 + 3).toFixed(1)}" text-anchor="end">${d.label}</text>
      <rect x="${x.toFixed(1)}" y="${y}" width="${barW.toFixed(1)}" height="${barH}" rx="3" fill="${color}"/>
      <text x="${textX.toFixed(1)}" y="${(y + barH / 2 + 3).toFixed(1)}" text-anchor="${textAnchor}" font-size="10" fill="${textFill}">${text}</text>`;
  }).join('');

  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    <line class="chart-baseline" x1="${cx}" y1="0" x2="${cx}" y2="${height}"/>
    ${bars}
  </svg>`;
}

// Gauge: aktueller Wert vs. Referenzmarke (HANK-Multiplikator)
function svgHankGauge(value, benchmark) {
  const width = 280, height = 40, padX = 8;
  const max   = Math.max(value, benchmark) * 1.3;
  const scale = v => padX + (v / max) * (width - padX * 2);
  const color = value > benchmark ? 'var(--good)' : value < benchmark ? 'var(--bad)' : 'var(--muted)';
  const vx = scale(value), rx = scale(benchmark);
  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}">
    <line class="chart-baseline" x1="${padX}" y1="28" x2="${width - padX}" y2="28"/>
    <rect x="${padX}" y="18" width="${Math.max(0, vx - padX).toFixed(1)}" height="14" rx="4" fill="${color}"/>
    <line x1="${rx.toFixed(1)}" y1="10" x2="${rx.toFixed(1)}" y2="36" stroke="var(--ink-2)" stroke-width="2"/>
    <text x="${rx.toFixed(1)}" y="8" text-anchor="middle" font-size="9" fill="var(--muted)">Ref ${benchmark.toFixed(1)}</text>
  </svg>`;
}

// Einfacher Vergleichsbalken (z. B. r vs. g) — positive Größen, gleiche Skala
function svgCompareBars(items) {
  const width = 280, labelW = 74, rowH = 22;
  const height = items.length * rowH + 4;
  const plotW  = width - labelW - 46;
  const maxAbs = Math.max(...items.map(d => Math.abs(d.value)), 0.1);
  const bars = items.map((d, i) => {
    const y    = 2 + i * rowH;
    const barH = rowH - 8;
    const barW = Math.max(0, Math.abs(d.value) / maxAbs * plotW);
    return `
      <text class="chart-axis-label" x="${labelW - 6}" y="${(y + barH / 2 + 3).toFixed(1)}" text-anchor="end">${d.label}</text>
      <rect x="${labelW}" y="${y}" width="${barW.toFixed(1)}" height="${barH}" rx="3" fill="${d.color}"/>
      <text x="${(labelW + barW + 6).toFixed(1)}" y="${(y + barH / 2 + 3).toFixed(1)}" font-size="10" fill="var(--ink-2)">${d.value.toFixed(2)} %</text>`;
  }).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}">${bars}</svg>`;
}

// Sparkline für KPI-Strip (Verlauf über bisher gespielte Perioden)
function svgSparkline(values) {
  if (values.length < 2) return '';
  const width = 64, height = 18;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`);
  const last = pts[pts.length - 1].split(',');
  return `<svg class="kpi-spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity=".7"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="2" fill="var(--accent)"/>
  </svg>`;
}

// ── Slider-Definitionen ───────────────────────────────────────────────────────
// `level` folgt MOD_DEFS (data.js): 'ein' Einsteiger · 'fort' Fortgeschritten · 'exp' Experte.
// Nur Sektionen mit level <= Kurs-Komplexitätsstufe werden gerendert (renderControls).

const SLIDER_SECTIONS = [
  {
    id: 'est', label: 'Einkommensteuer', color: '#3b82f6', level: 'ein',
    sliders: [
      { key: 'freibetrag', label: 'Grundfreibetrag', unit: '€', min: 8000, max: 20000, step: 100,
        varname: 'G' },
      { key: 'eingang',    label: 'Eingangssteuersatz', unit: '%', min: 10, max: 30, step: 0.5,
        varname: 'τ₀' },
      { key: 'spitze',     label: 'Spitzensteuersatz', unit: '%', min: 35, max: 65, step: 0.5,
        varname: 'τₘ' },
    ],
  },
  {
    id: 'mwst', label: 'Mehrwertsteuer', color: '#8b5cf6', level: 'ein',
    sliders: [
      { key: 'mwst',     label: 'Regelsatz', unit: '%', min: 15, max: 30, step: 0.5,
        varname: 'τᵥ' },
      { key: 'mwst_erm', label: 'Ermäßigter Satz', unit: '%', min: 0, max: 15, step: 0.5,
        varname: 'τᵥₑ' },
    ],
  },
  {
    id: 'co2', label: 'CO₂-Bepreisung', color: '#16a34a', level: 'ein',
    sliders: [
      { key: 'co2',      label: 'CO₂-Preis', unit: '€/t', min: 25, max: 350, step: 5,
        varname: 'p_CO₂' },
      { key: 'klimageld', label: 'Klimageld auszahlen', type: 'toggle', varname: 'KG_CO₂' },
    ],
  },
  {
    id: 'kst', label: 'Unternehmensteuern', color: '#ea580c', level: 'ein',
    sliders: [
      { key: 'kst',  label: 'Körperschaftsteuer', unit: '%', min: 5, max: 30, step: 0.5,
        varname: 'τ_K' },
      { key: 'gewst', label: 'Gewerbesteuer', unit: '%', min: 0, max: 20, step: 0.5,
        varname: 'τ_G' },
    ],
  },
  {
    id: 'sv', label: 'Sozialversicherung', color: '#0891b2', level: 'fort',
    sliders: [
      { key: 'rv',  label: 'Rentenbeitrag', unit: '%', min: 14, max: 26, step: 0.1,
        varname: 'τ_RV' },
      { key: 'kv',  label: 'KV-Beitrag',    unit: '%', min: 12, max: 22, step: 0.1,
        varname: 'τ_KV' },
      { key: 'bbg', label: 'BBG',            unit: '€', min: 63000, max: 180000, step: 1000,
        varname: 'BBG' },
      { key: 'buergerv', label: 'Bürgerversicherung', type: 'toggle', varname: 'BüV' },
    ],
  },
  {
    id: 'invest', label: 'Investitionen', color: '#b45309', level: 'ein',
    sliders: [
      { key: 'invest_impuls', label: 'Öffentl. Investitionsimpuls', unit: 'Mrd. €/a',
        min: -30, max: 120, step: 5, varname: 'I_pub' },
    ],
  },
  {
    id: 'verm', label: 'Vermögen & Erbschaft', color: '#be185d', level: 'fort',
    sliders: [
      { key: 'erb',      label: 'Erbschaftsteuersatz', unit: '%', min: 0, max: 50, step: 0.5, varname: 'τ_Erb' },
      { key: 'betriebs', label: 'Betriebsvermögen-Privileg', type: 'toggle', varname: 'Betr.' },
      { key: 'boden',    label: 'Bodenwertsteuer', unit: '%', min: 0, max: 2, step: 0.05, varname: 'τ_Bd' },
      { key: 'verm',     label: 'Vermögensteuer', unit: '%', min: 0, max: 2, step: 0.1, varname: 'τ_Vm' },
      { key: 'zucman',   label: 'Zucman-Mindeststeuer', unit: '%', min: 0, max: 2, step: 0.1, varname: 'τ_Zc' },
    ],
  },
  {
    id: 'transfers', label: 'Transfers & Sozialstaat', color: '#0d9488', level: 'fort',
    sliders: [
      { key: 'bg',      label: 'Bürgergeld-Regelsatz', unit: '€/Monat', min: 0, max: 1000, step: 10, varname: 'BG' },
      { key: 'kg',      label: 'Kindergeld', unit: '€/Monat', min: 0, max: 400, step: 10, varname: 'KG' },
      { key: 'neg_est', label: 'Negative Einkommensteuer', type: 'toggle', varname: 'NESt' },
    ],
  },
  {
    id: 'bge', label: 'BGE · Grundeinkommen', color: '#9333ea', level: 'fort',
    sliders: [
      { key: 'bge',                 label: 'BGE-Höhe', unit: '€/Monat', min: 0, max: 1600, step: 50, varname: 'BGE' },
      { key: 'rente_grenze',        label: 'Renten-Einkommensgrenze', unit: '€', min: 15000, max: 60000, step: 1000, varname: 'R_Gz', default: 35000 },
      { key: 'rente_niveau_gering', label: 'Ziel-Rentenniveau Geringverd.', unit: '%', min: 50, max: 100, step: 5, varname: 'RN_g', default: 80 },
      { key: 'rente_niveau_hoch',   label: 'Ziel-Rentenniveau Gutverd.', unit: '%', min: 30, max: 80, step: 5, varname: 'RN_h', default: 50 },
    ],
  },
  {
    id: 'kleine', label: 'Verbrauchsteuern', color: '#57534e', level: 'exp',
    sliders: [
      { key: 'kleine_st', label: 'Kleine Verbrauchsteuern aktiv', type: 'toggle', varname: 'VbSt' },
    ],
  },
  {
    id: 'renten_ctrl', label: 'Rentenreform', color: '#0369a1', level: 'exp',
    sliders: [
      { key: 'kapitalquote',  label: 'Fondsquote', unit: '%', min: 0, max: 20, step: 1, varname: 'q_F' },
      { key: 'rendite_fonds', label: 'Erwartete Jahresrendite', unit: '%', min: 3, max: 10, step: 0.5, varname: 'r_F' },
      { key: 'startjahr',     label: 'Startjahr der Fondsinvestition', unit: 'Jahr', min: 2000, max: 2025, step: 1, varname: 'J₀' },
    ],
  },
  {
    id: 'gkv_ctrl', label: 'GKV-Strukturreform', color: '#be123c', level: 'exp',
    sliders: [
      { key: 'pkv_abschaffen', label: 'PKV abschaffen', type: 'toggle', varname: 'PKV∅' },
      { key: 'kv_kapital',     label: 'Kapitalerträge KV-pflichtig', type: 'toggle', varname: 'KV_Kp' },
      { key: 'kv_bbg_frei',    label: 'KV-BBG abschaffen', type: 'toggle', varname: 'KV_B∅' },
      { key: 'anzahl_kv',      label: 'Anzahl Krankenkassen', unit: 'Kassen', min: 20, max: 95, step: 5, varname: 'n_KV' },
      { key: 'praevention',    label: 'Prävention-Investitionen', unit: 'Mrd. €', min: 0, max: 10, step: 0.5, varname: 'Prv' },
    ],
  },
];

// ── Digitales Leitmedium: Ressort- & Watchlist-Konfiguration ─────────────────

let state, pfad;
let activeDossier = null;
let activeAnalysisTab = 'media';

const RESSORT_DEFS = {
  finanzen: {
    id: 'finanzen',
    name: 'Finanzen & Steuern',
    icon: '',
    color: '#2563EB',
    tag: 'Bundesministerium der Finanzen (BMF)',
    title: 'Einkommensteuer, Progression & Vermögen',
    sections: ['est', 'verm'],
    context: 'Das Finanzministerium steuert das primäre Steueraufkommen des Bundes. Anpassungen des Spitzensteuersatzes und der Progression wirken auf das Arbeitsangebot (Saez/Chetty Elastizität ε = 0,20) und die Steuergerechtigkeit.',
    getHeadline: (p) => {
      if (p.spitze > 47) return 'Steuerprogression verschärft: Reichensteuer im Fokus';
      if (p.freibetrag > 13000) return 'Grundfreibetrag angehoben: Bürger spürbar entlastet';
      if (p.verm > 0) return 'Vermögensteuer reaktiviert: Umverteilungsdebatte entflammt';
      return 'Debatte um Spitzensteuer und Freibetrag (§ 32a EStG)';
    },
    getTeaser: () => 'Finanzministerium prüft das Steueraufkommen und Reaktionen der Spitzenverdiener auf Steuersatzänderungen.',
    getSummary: (p) => [
      `Spitze: ${p.spitze}%`,
      `Freibetrag: ${Number(p.freibetrag).toLocaleString('de-DE')} €`,
      p.verm > 0 ? `VermSt: ${p.verm}%` : null,
      p.erb > 0 ? `ErbSt: ${p.erb}%` : null
    ].filter(Boolean)
  },
  soziales: {
    id: 'soziales',
    name: 'Arbeit, Soziales & Renten',
    icon: '',
    color: '#0D9488',
    tag: 'Bundesministerium für Arbeit und Soziales (BMAS)',
    title: 'Bürgergeld, Grundsicherung & Rentenreform',
    sections: ['transfers', 'sv', 'bge', 'renten_ctrl'],
    context: 'Sozialtransfers an einkommensschwache Haushalte stützen den privaten Konsum unmittelbar über hohe marginale Konsumneigungen (HANK-Multiplikator). Zugleich muss der Lohnabstand gewahrt bleiben.',
    getHeadline: (p) => {
      if (p.bge > 0) return `Bedingungsloses Grundeinkommen (${p.bge} €) sorgt für Paradigmenwechsel`;
      if (p.bg > 620) return 'Bürgergeld-Erhöhung: Sozialverbände feiern, Opposition warnt';
      if (p.bg < 500) return 'Bürgergeld-Kürzung: Arbeitsanreize versus Armutsrisiko';
      return 'Bürgergeld und Kindergrundsicherung auf dem Prüfstand';
    },
    getTeaser: () => 'Sozialverbände fordern verlässliche Mindestsicherung bei anhaltendem Inflationsdruck.',
    getSummary: (p) => [
      p.bge > 0 ? `BGE: ${p.bge} €` : `Bürgergeld: ${p.bg} €`,
      `Kindergeld: ${p.kg} €`,
      `RV: ${p.rv}%`,
      `KV: ${p.kv}%`
    ].filter(Boolean)
  },
  klima: {
    id: 'klima',
    name: 'Klima & Transformation',
    icon: '',
    color: '#16A34A',
    tag: 'Ministerium für Wirtschaft & Klimaschutz (BMWK)',
    title: 'CO₂-Preispfad & soziales Klimageld',
    sections: ['co2'],
    context: 'Ein steigender CO₂-Preis setzt marktwirtschaftliche Anreize zur Dekarbonisierung. Die Rückvergütung als pauschales Klimageld entlastet untere Einkommen überproportional und sichert die Akzeptanz (SRU / MCC 2024).',
    getHeadline: (p) => {
      if (p.co2 >= 100 && p.klimageld) return `CO₂-Preis klettert auf ${p.co2} €: Klimageld federt Preisschock ab`;
      if (p.co2 >= 90 && !p.klimageld) return `Hoher CO₂-Preis (${p.co2} €) ohne Klimageld: Verbraucher protestieren`;
      if (p.klimageld) return 'Klimageld-Auszahlung beschlossen: Pauschale Bürgerentlastung';
      return `CO₂-Preis bei ${p.co2} €/t: Pfad zur Klimaneutralität`;
    },
    getTeaser: () => 'Wirtschaft und Umweltverbände streiten über Tempo der CO₂-Bepreisung und Rückvergütung.',
    getSummary: (p) => [
      `CO₂: ${p.co2} €/t`,
      p.klimageld ? 'Klimageld: Aktiv' : 'Klimageld: Inaktiv'
    ]
  },
  wirtschaft: {
    id: 'wirtschaft',
    name: 'Wirtschaft & Standort',
    icon: '',
    color: '#EA580C',
    tag: 'Bundesministerium für Wirtschaft & Standort (BMWK)',
    title: 'Unternehmenssteuern, Konsum & Investitionen',
    sections: ['kst', 'mwst', 'invest', 'kleine'],
    context: 'Die Körperschaftsteuer bestimmt die Attraktivität des Investitionsstandorts (SVR / Gechert-Heimberger). Öffentliche Investitionen wirken mit einem Multiplikator von 1,2–1,4 auf das BIP.',
    getHeadline: (p) => {
      if (p.invest_impuls > 20) return `Investitions-Boom: Bund mobilisiert +${p.invest_impuls} Mrd. € für Infrastruktur`;
      if (p.kst <= 12) return `Standort-Offensive: KSt auf ${p.kst} % gesenkt`;
      if (p.mwst > 20) return `Mehrwertsteuer auf ${p.mwst} % erhöht: Fiskus profitiert, Handel klagt`;
      return 'Standortwettbewerb und Investitionsbedarf der Industrie';
    },
    getTeaser: () => 'Industrieverbände fordern verlässliche Rahmenbedingungen und Erneuerung der Infrastruktur.',
    getSummary: (p) => [
      `KSt: ${p.kst}%`,
      `MwSt: ${p.mwst}%`,
      `Invest-Impuls: ${p.invest_impuls >= 0 ? '+' : ''}${p.invest_impuls || 0} Mrd.`
    ]
  }
};

const WATCHLIST_CATALOG = {
  saldo: {
    id: 'saldo',
    label: 'Haushaltssaldo',
    sub: 'Art. 109 GG (Bremse: -0,35 %)',
    calc: (r, z, p, prevR) => {
      const val = `${r.saldo >= 0 ? '+' : ''}${r.saldo.toFixed(0)} Mrd. €`;
      const d = prevR ? r.saldo - prevR.saldo : null;
      const deltaStr = d !== null ? `${d >= 0 ? '+' : ''}${d.toFixed(0)} Mrd.` : '—';
      const isOk = r.saldo_bip_pct >= -0.35;
      return { val, delta: deltaStr, status: isOk ? 'Konform' : 'Defizit', statusCls: isOk ? 'good' : 'bad' };
    }
  },
  waehler: {
    id: 'waehler',
    label: 'Sonntagsfrage',
    sub: 'Wählerzustimmung Bund',
    calc: (r, z, p, prevR, prevZ, stimmung, prevStimmung) => {
      const val = `${Math.round(stimmung?.gesamt ?? 48)} %`;
      const d = prevStimmung ? (stimmung?.gesamt ?? 48) - prevStimmung.gesamt : null;
      const deltaStr = d !== null ? `${d >= 0 ? '+' : ''}${d.toFixed(1)} PP` : '—';
      const isOk = (stimmung?.gesamt ?? 48) >= 50;
      return { val, delta: deltaStr, status: isOk ? 'Mehrheit' : 'Unter 50%', statusCls: isOk ? 'good' : 'warn' };
    }
  },
  gini: {
    id: 'gini',
    label: 'Gini-Ungleichheit',
    sub: 'Nettoeinkommen (0 = gleich)',
    calc: (r, z, p, prevR) => {
      const val = r.gini.toFixed(3);
      const d = prevR ? r.gini - prevR.gini : null;
      const deltaStr = d !== null ? `${d >= 0 ? '+' : ''}${d.toFixed(3)}` : '—';
      const isOk = r.gini <= 0.285;
      return { val, delta: deltaStr, status: isOk ? 'Niedrig' : 'Erhöht', statusCls: isOk ? 'good' : 'warn' };
    }
  },
  schuldenquote: {
    id: 'schuldenquote',
    label: 'Schuldenstand',
    sub: 'Maastricht-Grenze: 60 % BIP',
    calc: (r, z, p, prevR, prevZ) => {
      const val = `${z.schuldenquote.toFixed(1)} %`;
      const d = prevZ ? z.schuldenquote - prevZ.schuldenquote : null;
      const deltaStr = d !== null ? `${d >= 0 ? '+' : ''}${d.toFixed(1)} PP` : '—';
      const isOk = z.schuldenquote <= 60;
      return { val, delta: deltaStr, status: isOk ? 'Maastricht OK' : 'Über 60%', statusCls: isOk ? 'good' : 'bad' };
    }
  },
  co2_budget: {
    id: 'co2_budget',
    label: 'Restliches CO₂-Budget',
    sub: 'Pariser 1,5°C-Pfad bis 2050',
    calc: (r, z, p, prevR, prevZ) => {
      const rest = Math.max(0, Math.round(CO2_BUDGET_DE - z.co2_kumulat));
      const val = `${rest.toLocaleString('de-DE')} Mt`;
      const d = prevZ ? z.co2_kumulat - prevZ.co2_kumulat : null;
      const deltaStr = d !== null ? `-${Math.round(d)} Mt` : '—';
      const isOk = rest > 2000;
      return { val, delta: deltaStr, status: isOk ? 'Ausreichend' : 'Kritisch', statusCls: isOk ? 'good' : 'bad' };
    }
  },
  bip: {
    id: 'bip',
    label: 'Bruttoinlandsprodukt',
    sub: 'Wirtschaftskraft nominal',
    calc: (r, z, p, prevR, prevZ) => {
      const val = `${Math.round(z.bip).toLocaleString('de-DE')} Mrd. €`;
      const d = prevZ ? z.bip - prevZ.bip : null;
      const deltaStr = d !== null ? `${d >= 0 ? '+' : ''}${Math.round(d)} Mrd.` : '—';
      const isOk = !prevZ || z.bip >= prevZ.bip;
      return { val, delta: deltaStr, status: isOk ? 'Wachstum' : 'Rückgang', statusCls: isOk ? 'good' : 'bad' };
    }
  },
  armut: {
    id: 'armut',
    label: 'Armutsrisikoquote',
    sub: 'Unter 60 % Median-Netto',
    calc: (r, z, p, prevR) => {
      const val = `${(r.armutsrisiko * 100).toFixed(1)} %`;
      const d = prevR ? (r.armutsrisiko - prevR.armutsrisiko) * 100 : null;
      const deltaStr = d !== null ? `${d >= 0 ? '+' : ''}${d.toFixed(1)} PP` : '—';
      const isOk = r.armutsrisiko <= 0.15;
      return { val, delta: deltaStr, status: isOk ? 'Gering' : 'Erhöht', statusCls: isOk ? 'good' : 'warn' };
    }
  }
};

function countRessortDiffs(ressortKey, params, baseParams) {
  const def = RESSORT_DEFS[ressortKey];
  if (!def) return 0;
  const sections = SLIDER_SECTIONS.filter(s => def.sections.includes(s.id));
  const keys = sections.flatMap(s => s.sliders.map(sl => sl.key));
  let count = 0;
  for (const k of keys) {
    if (params[k] !== undefined && baseParams[k] !== undefined) {
      if (typeof params[k] === 'boolean') {
        if (params[k] !== baseParams[k]) count++;
      } else if (Math.abs(Number(params[k]) - Number(baseParams[k])) > 0.001) {
        count++;
      }
    }
  }
  return count;
}

// ── Hauptrenderer ─────────────────────────────────────────────────────────────

function renderAll() {
  pfad = simulate(state);
  renderPeriodNav();
  renderSessionBar();
  renderShockBanner();
  renderWatchlist();
  renderNewsFrontpage();
  renderResults();
  renderCommitBar();
  if (activeDossier) {
    renderDossierSliders(activeDossier);
    updateDossierImpactStrip();
  }
}

function renderSessionBar() {
  document.getElementById('bar-team').textContent    = state.team_id;
  document.getElementById('bar-periode').textContent = state.current_periode + 1;
  document.getElementById('bar-total').textContent   = state.kurs_konfig.perioden_anzahl;
  const sandboxBadge = document.getElementById('sandbox-badge');
  sandboxBadge.style.display = state.sandbox ? '' : 'none';
  const kursNameEl = document.getElementById('bar-kurs-name');
  if (kursNameEl) {
    kursNameEl.textContent = state.kurs_konfig.kurs_name ?? '';
    kursNameEl.style.display = state.kurs_konfig.kurs_name ? '' : 'none';
  }
}

function renderPeriodNav() {
  const container  = document.getElementById('period-steps');
  const n          = state.kurs_konfig.perioden_anzahl;
  const lockedCount     = state.perioden.filter(p => p.locked).length;
  const teacherFreigabe = getTeacherFreigabe();
  container.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const p        = state.perioden[i];
    const isFuture = i > lockedCount || i >= teacherFreigabe;
    const btn      = document.createElement('button');
    btn.className  = 'period-step'
      + (i === state.current_periode ? ' active' : '')
      + (p.locked   ? ' locked' : '')
      + (isFuture   ? ' future' : '');
    btn.disabled   = isFuture;
    if (isFuture) btn.title = i >= teacherFreigabe
      ? 'Noch nicht von der Lehrperson freigegeben'
      : 'Erst verfügbar nach Abschluss der aktuellen Periode';
    const entry = pfad[i];
    btn.innerHTML = `<span class="step-num">${i + 1}</span>
      <span class="step-label">${entry.label}</span>
      ${p.locked  ? '<span class="lock-icon">gesperrt</span>' : ''}`;
    if (!isFuture) btn.addEventListener('click', () => navigatePeriode(i));
    container.appendChild(btn);
  }
}

function renderShockBanner() {
  const banner  = document.getElementById('shock-banner');
  const current = pfad[state.current_periode];
  if (current?.schock) {
    const s = current.schock;
    document.getElementById('shock-type-badge').textContent = s.typ;
    document.getElementById('shock-name').textContent       = s.name;
    document.getElementById('shock-desc').textContent       = s.beschreibung;
    banner.style.display = '';
  } else {
    banner.style.display = 'none';
  }
}

// ── 1. Persönliche Watchlist ──────────────────────────────────────────────────

function renderWatchlist() {
  const container = document.getElementById('watchlist-chips');
  if (!container) return;

  const curIdx = state.current_periode;
  const entry = pfad[curIdx];
  const r = entry.result;
  const z = entry.zustand;
  const p = state.perioden[curIdx];

  const prevEntry = curIdx > 0 ? pfad[curIdx - 1] : null;
  const prevR = prevEntry?.result ?? null;
  const prevZ = prevEntry?.zustand ?? null;

  const curParams = p.params;
  const prevParams = curIdx > 0 ? state.perioden[curIdx - 1].params : PRESETS.status_quo;

  const stimmung = berechneWaehlerstimmung(curParams, r, z, prevParams, prevZ, entry.schock);
  const prevStimmung = prevEntry ? berechneWaehlerstimmung(prevParams, prevR, prevZ, PRESETS.status_quo, null, prevEntry.schock) : null;

  const bar = document.getElementById('watchlist-bar');
  const toggleBtn = document.getElementById('btn-toggle-watchlist');
  if (bar) {
    bar.classList.toggle('collapsed', !!state.watchlist_collapsed);
  }
  if (toggleBtn) {
    toggleBtn.textContent = state.watchlist_collapsed ? '▼ Ausklappen' : '▲ Einklappen';
  }

  const pinnedKeys = state.watchlist || ['saldo', 'waehler', 'gini', 'schuldenquote'];
  container.innerHTML = pinnedKeys.map(key => {
    const cat = WATCHLIST_CATALOG[key];
    if (!cat) return '';
    const res = cat.calc(r, z, curParams, prevR, prevZ, stimmung, prevStimmung);
    return `
      <div class="watchlist-card">
        <div class="w-card-label">${esc(cat.label)}</div>
        <div class="w-card-val-row">
          <span class="w-card-val">${esc(res.val)}</span>
          ${res.delta !== '—' ? `<span class="w-card-delta ${res.delta.startsWith('+') ? 'good' : 'bad'}">${esc(res.delta)}</span>` : ''}
        </div>
        <div class="w-card-sub" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${esc(cat.sub)}</span>
          <span style="font-weight:600; color:var(--${res.statusCls}); font-size:9.5px;">${esc(res.status)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function openWatchlistModal() {
  const backdrop = document.getElementById('watchlist-modal-backdrop');
  const listEl = document.getElementById('watchlist-options-list');
  if (!backdrop || !listEl) return;

  const currentPinned = new Set(state.watchlist || ['saldo', 'waehler', 'gini', 'schuldenquote']);

  listEl.innerHTML = Object.values(WATCHLIST_CATALOG).map(item => `
    <label class="watchlist-option-item">
      <div>
        <div style="font-weight:600; font-size:12px; color:var(--ink);">${esc(item.label)}</div>
        <div style="font-size:10.5px; color:var(--muted);">${esc(item.sub)}</div>
      </div>
      <input type="checkbox" data-watch-key="${item.id}" ${currentPinned.has(item.id) ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--accent);">
    </label>
  `).join('');

  listEl.querySelectorAll('input').forEach(chk => {
    chk.onchange = () => {
      const key = chk.dataset.watchKey;
      if (chk.checked) {
        if (!state.watchlist.includes(key)) state.watchlist.push(key);
      } else {
        state.watchlist = state.watchlist.filter(k => k !== key);
      }
      saveState(state);
      renderWatchlist();
    };
  });

  backdrop.style.display = 'flex';
}

function closeWatchlistModal() {
  const backdrop = document.getElementById('watchlist-modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
  saveState(state);
  renderWatchlist();
}

// ── 2. Redaktionelle Frontpage & Didaktisches Scaffolding ─────────────────────

function istRessortAktiv(ressortKey, periodeIdx = state.current_periode) {
  const pw = state.kurs_konfig?.perioden_werkzeuge;
  if (!pw) return true;
  const allowed = pw[periodeIdx] || pw[String(periodeIdx)];
  if (!allowed || !Array.isArray(allowed)) return true;
  return allowed.includes(ressortKey);
}

function showLockedRessortNotice(ressortKey) {
  const def = RESSORT_DEFS[ressortKey];
  const curP = state.current_periode + 1;
  const totalP = state.kurs_konfig?.perioden_anzahl || 5;

  const pw = state.kurs_konfig?.perioden_werkzeuge;
  let nextActive = null;
  if (pw) {
    for (let i = state.current_periode + 1; i < totalP; i++) {
      const allowed = pw[i] || pw[String(i)];
      if (Array.isArray(allowed) && allowed.includes(ressortKey)) {
        nextActive = i + 1;
        break;
      }
    }
  }

  const modal = document.getElementById('locked-ressort-modal');
  const titleEl = document.getElementById('locked-ressort-title');
  const textEl = document.getElementById('locked-ressort-text');

  if (titleEl) {
    titleEl.textContent = `${def.icon} ${def.name} vorübergehend nicht verfügbar`;
  }
  if (textEl) {
    textEl.innerHTML = `
      <p style="margin-bottom:10px;">
        Die Lehrperson hat für <strong>Periode ${curP}</strong> den Fokus auf die anderen Handlungsfelder gelegt, um eine schrittweise didaktische Erarbeitung (Scaffolding) zu ermöglichen.
      </p>
      <p style="margin-bottom:10px; color:var(--muted);">
        Dieses Ministerium steht in der aktuellen Kabinettssitzung nicht zur Disposition. Die Hebel verbleiben auf ihrem bisherigen Stand.
      </p>
      ${nextActive ? `<p style="color:var(--accent); font-weight:600; margin-top:8px;">Geplante Freischaltung: ab Periode ${nextActive}.</p>` : ''}
    `;
  }
  if (modal) modal.style.display = 'flex';
}

function ermittleHeroStory(state, entry) {
  const r = entry.result;
  const schock = entry.schock;

  let candidate = null;

  if (schock) {
    candidate = {
      badge: `Schock-Ereignis · Periode ${state.current_periode + 1}`,
      headline: `${schock.name}: Kabinett unter Krisendruck`,
      lead: `${schock.beschreibung} Gewerkschaften und Wirtschaftsverbände fordern sofortige staatliche Interventionen, um Produktion und Arbeitsplätze zu sichern.`,
      targetRessort: schock.typ === 'energie' ? 'klima' : 'wirtschaft',
      ctaText: 'Krisen-Dossier öffnen & Hebel anpassen →',
      hint: 'Dringender Handlungsbedarf durch aktiven Schock'
    };
  } else if (r.saldo_bip_pct < -0.35) {
    candidate = {
      badge: `Verfassungsstreit · Periode ${state.current_periode + 1}`,
      headline: `Haushaltsloch reißt Schuldenbremse um ${Math.abs(Math.round(r.saldo))} Mrd. Euro`,
      lead: `Der Bundesrechnungshof mahnt die verfassungsrechtliche Obergrenze nach Art. 109 GG an. Im Kabinett entbrennt ein heftiger Streit zwischen Ausgabenkürzungen und Mehreinnahmen.`,
      targetRessort: 'finanzen',
      ctaText: 'Finanz-Dossier öffnen & konsolidieren →',
      hint: 'Schuldenbremse aktuell verfehlt'
    };
  } else if (r.gini > 0.29) {
    candidate = {
      badge: `Soziale Lage · Periode ${state.current_periode + 1}`,
      headline: 'Warnung vor Verteilungskonflikt: Reallöhne unter Druck',
      lead: 'Die Ungleichheit der verfügbaren Nettoeinkommen nimmt zu. Sozialverbände mahnen eine Stärkung der Mindestsicherung an, während Ökonomen zielgerichtete Entlastungen fordern.',
      targetRessort: 'soziales',
      ctaText: 'Sozial-Dossier öffnen & justieren →',
      hint: 'Ungleichheit über Richtwert'
    };
  } else {
    candidate = {
      badge: `Koalitionsbericht · Periode ${state.current_periode + 1}`,
      headline: 'Kabinett berät über Reformagenda: Weichenstellungen für die Legislatur',
      lead: 'Zwischen ökologischer Transformation, solider Haushaltsführung und Standortwettbewerb: Die Regierungskoalition berät über die zentralen politischen Schwerpunkte der kommenden 4 Jahre.',
      targetRessort: 'wirtschaft',
      ctaText: 'Dossier öffnen & Schwerpunkte setzen →',
      hint: 'Reguläre Gesetzgebung'
    };
  }

  // Didaktische Werkzeug-Freigabe berücksichtigen:
  if (!istRessortAktiv(candidate.targetRessort)) {
    const fallbackActive = ['finanzen', 'soziales', 'klima', 'wirtschaft'].find(k => istRessortAktiv(k));
    if (fallbackActive) {
      candidate.targetRessort = fallbackActive;
      candidate.ctaText = `${RESSORT_DEFS[fallbackActive].name}-Dossier öffnen →`;
    }
  }

  return candidate;
}

function renderNewsFrontpage() {
  const entry = pfad[state.current_periode];
  const p = state.perioden[state.current_periode];
  const story = ermittleHeroStory(state, entry);

  // Hero Story
  const badgeEl = document.getElementById('hero-badge');
  const dateEl = document.getElementById('hero-date');
  const headEl = document.getElementById('hero-headline');
  const leadEl = document.getElementById('hero-lead');
  const ctaBtn = document.getElementById('btn-hero-action');
  const hintEl = document.getElementById('hero-context-hint');

  if (badgeEl) badgeEl.textContent = story.badge;
  if (dateEl) dateEl.textContent = `Legislatur ${entry.label}`;
  if (headEl) headEl.textContent = story.headline;
  if (leadEl) leadEl.textContent = story.lead;
  if (hintEl) hintEl.textContent = story.hint;
  if (ctaBtn) {
    ctaBtn.textContent = story.ctaText;
    ctaBtn.onclick = () => {
      if (istRessortAktiv(story.targetRessort)) {
        openDossier(story.targetRessort);
      } else {
        showLockedRessortNotice(story.targetRessort);
      }
    };
  }

  const ressortKeys = ['finanzen', 'soziales', 'klima', 'wirtschaft'];

  // 1. Ressort-Submenü befüllen
  const menuDropdown = document.getElementById('ressort-menu-dropdown');
  if (menuDropdown) {
    menuDropdown.innerHTML = ressortKeys.map(key => {
      const def = RESSORT_DEFS[key];
      const aktiv = istRessortAktiv(key);
      const diffs = countRessortDiffs(key, p.params, PRESETS.status_quo);
      const badgeText = !aktiv
        ? 'Gesperrt'
        : (diffs === 0 ? 'Status Quo' : `${diffs} Reformen`);
      return `
        <div class="submenu-item ${!aktiv ? 'item-locked' : ''}" data-ressort-choice="${key}">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:600; color:${def.color};">${esc(def.name)}</span>
          </div>
          <span class="ressort-badge ${!aktiv ? 'badge-locked' : (diffs > 0 ? 'reformed' : '')}" style="font-size:10px; padding:2px 6px;">
            ${esc(badgeText)}
          </span>
        </div>
      `;
    }).join('');

    menuDropdown.querySelectorAll('[data-ressort-choice]').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        menuDropdown.classList.remove('open');
        document.getElementById('wrap-ressort-menu')?.classList.remove('open');
        const rKey = item.dataset.ressortChoice;
        if (istRessortAktiv(rKey)) {
          openDossier(rKey);
        } else {
          showLockedRessortNotice(rKey);
        }
      };
    });
  }

  // 2. Ressort Grid Toggle Button & Grid Status
  const toggleGridBtn = document.getElementById('btn-toggle-ressorts-grid');
  const grid = document.getElementById('ressorts-grid');
  if (toggleGridBtn && grid) {
    grid.style.display = state.show_ressort_cards ? 'grid' : 'none';
    toggleGridBtn.textContent = state.show_ressort_cards
      ? 'Ministerien-Karten ausblenden'
      : 'Alle 4 Ministerien-Karten einblenden';
  }

  // 3. 4 Ressort Kacheln
  if (!grid) return;

  grid.innerHTML = ressortKeys.map(key => {
    const def = RESSORT_DEFS[key];
    const aktiv = istRessortAktiv(key);
    const diffs = countRessortDiffs(key, p.params, PRESETS.status_quo);
    const badgeText = !aktiv
      ? `Nicht im Kabinettsauftrag (P${state.current_periode + 1})`
      : (diffs === 0 ? 'Status Quo' : `${diffs} Reformen aktiv`);
    const headline = def.getHeadline(p.params);
    const teaser = !aktiv
      ? `Dieses Ressort ist in Periode ${state.current_periode + 1} durch die Lehrperson gesperrt (didaktischer Fokus).`
      : def.getTeaser();
    const summaryChips = def.getSummary(p.params);

    return `
      <div class="ressort-card ${!aktiv ? 'locked-ressort' : ''}" style="--ressort-color:${def.color}" data-ressort="${key}">
        <div class="ressort-head">
          <div class="ressort-name-wrap">
            <span class="ressort-title">${esc(def.name)}</span>
          </div>
          <span class="ressort-badge ${!aktiv ? 'badge-locked' : (diffs > 0 ? 'reformed' : '')}">${esc(badgeText)}</span>
        </div>
        <div class="ressort-teaser-headline font-serif-news" style="${!aktiv ? 'color:var(--muted);' : ''}">${esc(headline)}</div>
        <div class="ressort-teaser-text" style="${!aktiv ? 'font-style:italic;' : ''}">${esc(teaser)}</div>
        <div class="ressort-params-summary" style="${!aktiv ? 'opacity:0.6;' : ''}">
          ${summaryChips.map(c => `<span>${esc(c)}</span>`).join('<span style="opacity:.4">·</span>')}
        </div>
        <button class="ressort-cta-btn ${!aktiv ? 'btn-locked' : ''}" type="button">
          <span>${aktiv ? 'Dossier bearbeiten' : 'Gesperrt durch Lehrperson'}</span>
          <span>${aktiv ? '→' : 'Info'}</span>
        </button>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.ressort-card').forEach(card => {
    const key = card.dataset.ressort;
    card.onclick = () => {
      if (istRessortAktiv(key)) {
        openDossier(key);
      } else {
        showLockedRessortNotice(key);
      }
    };
  });
}

// ── 3. Fokus-Dossier (Slide-Over Drawer) ───────────────────────────────────────

function openDossier(ressortKey) {
  if (!istRessortAktiv(ressortKey)) {
    showLockedRessortNotice(ressortKey);
    return;
  }
  const def = RESSORT_DEFS[ressortKey];
  if (!def) return;
  activeDossier = ressortKey;

  const tagEl = document.getElementById('dossier-tag');
  const titleEl = document.getElementById('dossier-title');
  const ctxEl = document.getElementById('dossier-context');

  if (tagEl) tagEl.textContent = def.tag;
  if (titleEl) titleEl.textContent = def.title;
  if (ctxEl) ctxEl.textContent = def.context;

  renderDossierSliders(ressortKey);
  updateDossierImpactStrip();

  const backdrop = document.getElementById('dossier-backdrop');
  if (backdrop) {
    backdrop.style.display = 'flex';
    requestAnimationFrame(() => backdrop.classList.add('open'));
  }
}

function closeDossier() {
  const backdrop = document.getElementById('dossier-backdrop');
  if (backdrop) {
    backdrop.classList.remove('open');
    setTimeout(() => { backdrop.style.display = 'none'; }, 220);
  }
  activeDossier = null;
  renderAll();
}

function renderDossierSliders(ressortKey) {
  const container = document.getElementById('dossier-sliders-container');
  if (!container) return;
  container.innerHTML = '';

  const def = RESSORT_DEFS[ressortKey];
  const p = state.perioden[state.current_periode];
  const locked = p.locked;
  const levelCode = getLevelCode();

  for (const secId of def.sections) {
    const section = SLIDER_SECTIONS.find(s => s.id === secId);
    if (!section || LEVEL_ORDER[section.level] > LEVEL_ORDER[levelCode]) continue;

    const div = document.createElement('div');
    div.className = 'ctrl-section';
    div.innerHTML = `
      <div class="ctrl-section-header" style="background:var(--surface-2); border-radius:4px; padding:7px 10px; margin-bottom:6px;">
        <span class="ctrl-dot" style="background:${section.color}"></span>
        <span class="ctrl-section-label" style="font-weight:600; font-size:12px;">${section.label}</span>
        <span class="tier-badge ${section.level}">${LEVEL_LABEL[section.level]}</span>
      </div>
      <div class="ctrl-section-body">
        ${section.sliders.map(sl => buildSlider(sl, p.params, locked)).join('')}
      </div>
    `;
    container.appendChild(div);

    // Event-Listener
    for (const sl of section.sliders) {
      const input = div.querySelector(`input[data-key="${sl.key}"]`);
      if (!input) continue;

      if (sl.type === 'toggle') {
        input.addEventListener('change', () => {
          p.params[sl.key] = input.checked;
          saveState(state);
          pfad = simulate(state);
          renderWatchlist();
          renderNewsFrontpage();
          updateDossierImpactStrip();
          renderCommitBar();
        });
      } else {
        const valEl = div.querySelector(`[data-val="${sl.key}"]`);
        input.addEventListener('input', () => {
          const v = parseFloat(input.value);
          p.params[sl.key] = v;
          if (valEl) valEl.textContent = formatSliderVal(sl, v);
          saveState(state);
          pfad = simulate(state);
          renderWatchlist();
          renderNewsFrontpage();
          updateDossierImpactStrip();
          renderCommitBar();
        });
      }
    }
  }
}

function updateDossierImpactStrip() {
  const curIdx = state.current_periode;
  const entry = pfad[curIdx];
  const r = entry.result;
  const z = entry.zustand;
  const p = state.perioden[curIdx];
  const prevEntry = curIdx > 0 ? pfad[curIdx - 1] : null;

  const stimmung = berechneWaehlerstimmung(p.params, r, z, prevEntry?.params ?? PRESETS.status_quo, prevEntry?.zustand ?? null, entry.schock);

  const saldoEl = document.getElementById('dossier-impact-saldo');
  const waehlerEl = document.getElementById('dossier-impact-waehler');
  const giniEl = document.getElementById('dossier-impact-gini');

  if (saldoEl) {
    saldoEl.textContent = `${r.saldo >= 0 ? '+' : ''}${r.saldo.toFixed(0)} Mrd. € (${r.saldo_bip_pct.toFixed(2)} %)`;
    saldoEl.style.color = r.saldo_bip_pct >= -0.35 ? 'var(--good)' : 'var(--bad)';
  }
  if (waehlerEl) {
    waehlerEl.textContent = `${Math.round(stimmung?.gesamt ?? 48)} %`;
    waehlerEl.style.color = (stimmung?.gesamt ?? 48) >= 50 ? 'var(--good)' : 'var(--warn)';
  }
  if (giniEl) {
    giniEl.textContent = r.gini.toFixed(3);
    giniEl.style.color = r.gini <= 0.285 ? 'var(--good)' : 'var(--ink)';
  }
}

// ── 4. Modulare Auswertungen & Hamburger-Submenüs ─────────────────────────────

const RECOMMENDED_WIDGETS = ['explainer', 'barometer', 'verteilung'];

function renderActiveWidgets() {
  const active = state.active_widgets || [];

  // 1. Zähler aktualisieren
  const countEl = document.getElementById('active-widgets-count');
  if (countEl) {
    countEl.textContent = `${active.length} Grafik${active.length === 1 ? '' : 'en'} aktiv`;
  }

  // 2. Checkboxen im Hamburger-Menü abgleichen
  document.querySelectorAll('#analysis-menu-dropdown .submenu-item[data-widget]').forEach(item => {
    const wId = item.dataset.widget;
    item.classList.toggle('active', active.includes(wId));
  });

  // 3. Leerer Zustand ein-/ausblenden
  const emptyState = document.getElementById('empty-widgets-state');
  if (emptyState) {
    emptyState.style.display = active.length === 0 ? 'block' : 'none';
  }

  // 4. Einzelne Widget-Panels steuern
  document.querySelectorAll('.widget-panel[data-widget-id]').forEach(panel => {
    const wId = panel.dataset.widgetId;
    const isVisible = active.includes(wId);
    panel.style.display = isVisible ? 'block' : 'none';
  });

  // Spezifische Re-Renders für sichtbare Komponenten anstoßen
  if (active.includes('history')) {
    renderHistoryChart();
  }
}

function toggleWidget(widgetId) {
  if (!Array.isArray(state.active_widgets)) state.active_widgets = [];
  if (state.active_widgets.includes(widgetId)) {
    state.active_widgets = state.active_widgets.filter(id => id !== widgetId);
  } else {
    state.active_widgets.push(widgetId);
  }
  saveState(state);
  renderResults();
}

// ── 5. Sticky Bottom Action Bar ───────────────────────────────────────────────

function renderCommitBar() {
  const curIdx = state.current_periode;
  const p = state.perioden[curIdx];
  const r = pfad[curIdx].result;
  const locked = p.locked;

  const totalDiffs = ['finanzen', 'soziales', 'klima', 'wirtschaft'].reduce((sum, k) => sum + countRessortDiffs(k, p.params, PRESETS.status_quo), 0);

  const summaryEl = document.getElementById('commit-summary-text');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <strong>Periode ${curIdx + 1} / ${state.kurs_konfig.perioden_anzahl}</strong>
      <span style="color:var(--muted)">·</span> Saldo: <strong>${r.saldo >= 0 ? '+' : ''}${r.saldo.toFixed(0)} Mrd. €</strong>
      <span style="color:var(--muted)">·</span> ${locked ? '<span style="color:#F59E0B">Periode gesperrt</span>' : `${totalDiffs} Hebel reformiert`}
    `;
  }

  const slot = document.getElementById('commit-area-slot');
  if (slot) {
    const totalVotes   = state.kurs_konfig.team_groesse;
    const currentVotes = p.votes;
    const notReleased  = curIdx >= getTeacherFreigabe();
    const btnDisabled  = locked || notReleased;
    const btnLabel     = locked      ? 'Periode gesperrt'
                       : notReleased ? 'Noch nicht freigegeben'
                       :               'Periode abschließen';

    slot.innerHTML = `
      <button id="btn-commit" class="btn-commit ${locked ? 'locked' : ''}" ${btnDisabled ? 'disabled' : ''} style="padding:7px 16px; margin:0; font-size:12px;">
        ${btnLabel}
        ${!btnDisabled ? `<small>(${currentVotes}/${totalVotes})</small>` : ''}
      </button>
      ${state.sandbox ? '<span style="font-size:10px; color:#9CA3AF; margin-left:6px;">(Sandbox)</span>' : ''}
    `;

    if (!locked) {
      document.getElementById('btn-commit')?.addEventListener('click', lockPeriode);
    }
  }
}

function renderControls() {
  renderCommitBar();
}

function buildSlider(sl, params, locked) {
  const info     = getTooltip(sl.key);
  const infoAttr = info ? `data-info-key="${sl.key}"` : '';

  if (sl.type === 'toggle') {
    const val = !!params[sl.key];
    return `
      <div class="slider-row">
        <label class="toggle-row">
          <span class="slider-varname info-trigger" ${infoAttr}>${sl.varname}</span>
          <span class="slider-label">${sl.label}</span>
          <input type="checkbox" data-key="${sl.key}" ${val ? 'checked' : ''} ${locked ? 'disabled' : ''} class="toggle-input">
        </label>
      </div>`;
  }

  const val = params[sl.key] ?? sl.default ?? 0;
  const sq  = PRESETS.status_quo[sl.key] ?? sl.default ?? val;
  return `
    <div class="slider-row">
      <div class="slider-label-row">
        <span class="slider-varname info-trigger" ${infoAttr}>${sl.varname}</span>
        <span class="slider-label">${sl.label}</span>
        <span class="slider-val" data-val="${sl.key}">${formatSliderVal(sl, val)}</span>
      </div>
      <input type="range" data-key="${sl.key}"
        min="${sl.min}" max="${sl.max}" step="${sl.step}"
        value="${val}" ${locked ? 'disabled' : ''}
        class="slider-input ${locked ? 'disabled' : ''}">
      <div class="slider-meta">
        <span class="sq-label">SQ: ${formatSliderVal(sl, sq)}</span>
      </div>
    </div>`;
}

function formatSliderVal(sl, v) {
  if (sl.unit === '%')        return v.toFixed(1) + ' %';
  if (sl.unit === '€')        return v.toLocaleString('de-DE') + ' €';
  if (sl.unit === '€/t')      return v.toFixed(0) + ' €/t';
  if (sl.unit === '€/Monat')  return v.toLocaleString('de-DE') + ' €/Mon.';
  if (sl.unit === 'Mrd. €')   return v.toFixed(1) + ' Mrd.';
  if (sl.unit === 'Mrd. €/a') return (v >= 0 ? '+' : '') + v + ' Mrd.';
  if (sl.unit === 'Jahr')     return String(v);
  if (sl.unit === 'Kassen')   return String(v);
  return v;
}

function renderResults() {
  const entry = pfad[state.current_periode];
  const r     = entry.result;
  const z     = entry.zustand;
  const abl   = berechneAbgeleitet(r, z);
  const sqR   = pfad[0].result; // Status-quo-Vergleich = Periode 0

  renderWatchlist();
  renderNewsFrontpage();
  renderCommitBar();
  renderKpiStrip(r, z, abl, sqR);
  renderLernzieleBar(r, z);

  // Selektives Rendern nur der aktiven Widgets (spart Performance und hält Ansicht aufgeräumt)
  const active = state.active_widgets || [];
  if (active.includes('explainer'))  renderExplainer(entry, r, z);
  if (active.includes('barometer') || active.includes('presse')) renderMedienspiegel(entry, r, z);
  if (active.includes('history')) {
    renderHistoryChart();
    renderHistoryTable();
  }
  if (active.includes('fiskal'))    renderFiskalPanel(r, z, abl);
  if (active.includes('domar'))     renderDomarPanel(z, abl);
  if (active.includes('verteilung')) renderVerteilungChart(r);
  if (active.includes('hank'))      renderHankPanel(r, abl);
  if (active.includes('co2budget')) renderCo2Panel(z, abl);
  if (active.includes('rente') || active.includes('gkv')) {
    renderRenteGkvPanels(r, state.perioden[state.current_periode].params);
  }

  renderActiveWidgets();
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderExplainer(entry, r, z) {
  const panel = document.getElementById('explainer-panel');
  const listEl = document.getElementById('explainer-cards');
  const countEl = document.getElementById('explainer-count');
  if (!panel || !listEl) return;

  const curParams = state.perioden[state.current_periode].params;
  const refParams = state.current_periode > 0
    ? state.perioden[state.current_periode - 1].params
    : PRESETS.status_quo;
  const refZustand = state.current_periode > 0
    ? pfad[state.current_periode - 1].zustand
    : null;

  const cards = erzeugeKausalketten(curParams, r, z, refParams, refZustand, entry.schock);

  if (countEl) {
    countEl.textContent = `${cards.length} ${cards.length === 1 ? 'Erkenntnis' : 'Erkenntnisse'}`;
  }

  listEl.innerHTML = cards.map(c => `
    <div class="explainer-card tone-${c.tone}">
      <div class="explainer-card-head">
        <span class="explainer-card-title">${esc(c.title)}</span>
        <span class="explainer-mechanism">${esc(c.mechanism)}</span>
        ${c.kpiBadge ? `<span class="explainer-badge badge-${c.tone}">${esc(c.kpiBadge)}</span>` : ''}
      </div>
      <div class="explainer-card-text">${esc(c.text)}</div>
    </div>
  `).join('');
}

function renderMedienspiegel(entry, r, z) {
  const panel = document.getElementById('medienspiegel-panel');
  if (!panel) return;

  const curParams = state.perioden[state.current_periode].params;
  const refParams = state.current_periode > 0
    ? state.perioden[state.current_periode - 1].params
    : PRESETS.status_quo;
  const refZustand = state.current_periode > 0
    ? pfad[state.current_periode - 1].zustand
    : null;

  const { stimmung, artikel } = waehleMedienspiegel(curParams, r, z, refParams, refZustand, entry.schock, 2);

  // Wählerbarometer aktualisieren
  const gesamtEl = document.getElementById('waehler-gesamt');
  const deltaEl  = document.getElementById('waehler-delta');
  const statusEl = document.getElementById('waehler-status');
  const fillEl   = document.getElementById('waehler-fill');
  const anEl     = document.getElementById('waehler-an');
  const wiEl     = document.getElementById('waehler-wi');
  const klEl     = document.getElementById('waehler-kl');

  if (gesamtEl) gesamtEl.textContent = `${stimmung.gesamt} %`;
  if (deltaEl) {
    deltaEl.textContent = (stimmung.delta >= 0 ? '+' : '') + stimmung.delta + ' PP';
    deltaEl.className = `barometer-delta ${deltaClass(stimmung.delta, 'up')}`;
  }
  if (statusEl) {
    const statusLabels = { sehr_hoch: 'Sehr hoch', solide: 'Solide', angeschlagen: 'Angeschlagen', kritisch: 'Kritisch' };
    statusEl.textContent = statusLabels[stimmung.status] || 'Solide';
    statusEl.className = `barometer-status badge-${stimmung.status}`;
  }
  if (fillEl) fillEl.style.width = `${stimmung.gesamt}%`;
  if (anEl) anEl.textContent = `${stimmung.gruppen.arbeitnehmer} %`;
  if (wiEl) wiEl.textContent = `${stimmung.gruppen.wirtschaft} %`;
  if (klEl) klEl.textContent = `${stimmung.gruppen.klima} %`;

  // Presseartikel aktualisieren
  const listEl = document.getElementById('presse-articles');
  if (listEl) {
    listEl.innerHTML = artikel.map(a => `
      <div class="presse-card">
        <div class="presse-meta">
          <span class="presse-outlet">${esc(a.outlet)}</span>
        </div>
        <div class="presse-headline">${esc(a.headline)}</div>
        <div class="presse-body">${esc(a.body)}</div>
        ${a.quote ? `<div class="presse-quote">${esc(a.quote)}</div>` : ''}
      </div>
    `).join('');
  }
}

function renderLernzieleBar(r, z) {
  const bar = document.getElementById('lernziele-bar');
  if (!bar) return;
  const lernziele = state.kurs_konfig.lernziele ?? [];
  if (!lernziele.length || !URL_SESSION_ID) { bar.style.display = 'none'; return; }

  const bwg = bewerteLernziele(r, z, lernziele);
  bar.style.display = '';
  bar.innerHTML = `
    <span class="lz-bar-title">Lernziele ${bwg.erreicht}/${bwg.total}</span>
    ${bwg.details.map(d => `
      <span class="lz-chip ${d.erreicht ? 'ok' : 'nok'}" title="${d.erreicht ? 'Erreicht' : 'Noch nicht erreicht'}">
        ${d.erreicht ? '✓' : '✗'} ${d.label}
      </span>`).join('')}`;
}

function renderKpiStrip(r, z, abl, sqR) {
  const strip = document.getElementById('kpi-strip');
  if (!strip) return;
  const upto  = pfad.slice(0, state.current_periode + 1);
  const kpis = [
    {
      label: 'Haushaltssaldo',
      value: fmt.mrd(r.saldo),
      delta: r.saldo - sqR.saldo,
      dir:   'up',
      sub:   fmt.pct2(r.saldo_bip_pct) + ' BIP',
      spark: upto.map(e => e.result.saldo),
    },
    {
      label: 'Schuldenquote',
      value: fmt.pct(z.schuldenquote),
      delta: z.schuldenquote - 63.5,
      dir:   'down',
      sub:   'Δ ' + fmt.pct2(z.schuldenquote - 63.5),
      spark: upto.map(e => e.zustand.schuldenquote),
    },
    {
      label: 'Gini-Koeffizient',
      value: fmt.comma3(r.gini),
      delta: r.gini - sqR.gini,
      dir:   'down',
      sub:   'Palma ' + r.palma.toFixed(2),
      spark: upto.map(e => e.result.gini),
    },
    {
      label: 'CO₂-Kumulat',
      value: fmt.mrdAbs(z.co2_kumulat) + ' Mt',
      delta: abl.co2_budget_rest / CO2_BUDGET_DE * 100 - 100,
      dir:   'down',
      sub:   'Budget-Rest: ' + Math.round(abl.co2_budget_rest) + ' Mt',
      spark: upto.map(e => e.zustand.co2_kumulat),
    },
    {
      label: 'BIP-Index',
      value: fmt.idx(z.bip / 4470 * 100),
      delta: z.bip / 4470 * 100 - 100,
      dir:   'up',
      sub:   fmt.mrdAbs(z.bip) + ' Mrd. €',
      spark: upto.map(e => e.zustand.bip),
    },
  ];

  strip.innerHTML = kpis.map(k => `
    <div class="kpi-cell">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-delta ${deltaClass(k.delta, k.dir)}">
        ${k.delta >= 0 ? '▲' : '▼'} ${Math.abs(k.delta).toFixed(k.dir === 'down' ? 3 : 1)}
      </div>
      <div class="kpi-sub">${k.sub}</div>
      ${svgSparkline(k.spark)}
    </div>`).join('');
}

function renderHistoryChart() {
  const el = document.getElementById('history-chart');
  if (!el) return;
  if (pfad.length < 2) { el.innerHTML = '<div class="chart-empty">Verlaufschart ab Periode 2 verfügbar.</div>'; return; }

  const metrics = [
    { label: 'Haushaltssaldo (Mrd. €)', color: 'var(--chart-1)', get: e => e.result.saldo,          yFmt: v => v.toFixed(0) },
    { label: 'Schuldenquote (% BIP)',   color: 'var(--chart-2)', get: e => e.zustand.schuldenquote,  yFmt: v => v.toFixed(0) },
    { label: 'Gini-Koeffizient',        color: 'var(--chart-3)', get: e => e.result.gini,            yFmt: v => v.toFixed(3) },
    { label: 'BIP (Mrd. €)',            color: 'var(--chart-4)', get: e => e.zustand.bip,            yFmt: v => v.toFixed(0) },
  ];

  el.innerHTML = `<div class="hist-mini-grid">${metrics.map(m => `
    <div class="hist-mini">
      <div class="hist-mini-title">${m.label}</div>
      ${svgLineChart(
        [{ label: m.label, color: m.color, points: pfad.map((e, i) => ({ x: i, y: m.get(e) })) }],
        { height: 92, width: 240, yFmt: m.yFmt, xFmt: i => (pfad[i].label.split(/[–-]/)[0]) }
      )}
    </div>`).join('')}</div>`;
}

function renderHistoryTable() {
  const container = document.getElementById('history-table');
  if (!container) return;
  let html = `
    <table class="history-table">
      <thead><tr>
        <th>Periode</th><th>Saldo</th><th>Schuldenquote</th>
        <th>Gini</th><th>Emissionen</th><th>BIP</th>
      </tr></thead>
      <tbody>`;
  for (const entry of pfad) {
    const r = entry.result, z = entry.zustand;
    const active = entry.periode === state.current_periode;
    html += `<tr class="${active ? 'active-row' : ''}${entry.schock ? ' schock-row' : ''}">
      <td>${entry.label}</td>
      <td class="${r.saldo >= 0 ? 'good' : 'bad'}">${fmt.mrd(r.saldo)}</td>
      <td>${fmt.pct(z.schuldenquote)}</td>
      <td>${fmt.comma3(r.gini)}</td>
      <td>${r.emissionen.toFixed(0)} Mt</td>
      <td>${fmt.mrdAbs(z.bip)}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderFiskalPanel(r, z, abl) {
  const el = document.getElementById('fiskal-body');
  if (!el) return;
  const rows = [
    { label: 'Primärsaldo PS_t',       val: fmt.pct2(abl.ps_t),    cls: abl.ps_t >= 0 ? 'good' : 'bad',
      formula: 'PS_t = S_t + i × D_t   (Prozentpunkte BIP)', ref: 'Blanchard (2019) AEA' },
    { label: 'Zinsaufwand',             val: fmt.mrdAbs(r.zinsen_dyn || 0),    cls: 'neutral',
      formula: 'Z_t = i × D_t × BIP_t', ref: 'Bundesbank Effektivzins' },
    { label: 'Gesamtsaldo S_t',         val: fmt.pct2(r.saldo_bip_pct), cls: r.saldo_bip_pct >= -0.35 ? 'good' : 'bad',
      formula: 'S_t = Einnahmen − Ausgaben', ref: 'Art. 109 GG (−0,35 % Grenze)' },
    { label: 'r − g',                   val: fmt.pct2(abl.r_minus_g * 100), cls: abl.r_minus_g < 0 ? 'good' : 'warn',
      formula: 'r − g = Zins − BIP-Wachstum', ref: 'Domar (1944) · Blanchard (2019)' },
    { label: 'PS-Ziel PS* (Domar)',     val: fmt.pct2(abl.ps_star), cls: 'neutral',
      formula: 'PS* = (r − g) × D_t', ref: 'Domar-Bedingung' },
    { label: 'S2-Tragfähigkeitslücke',  val: fmt.pct2(abl.s2), cls: abl.s2 >= 0 ? 'good' : 'bad',
      formula: 'S2 = PS_t − PS*  (>0 tragfähig)', ref: 'IMF Fiscal Monitor 2024' },
  ];
  el.innerHTML = rows.map(row => `
    <div class="fiskal-row">
      <div class="fiskal-label">
        <span class="fiskal-var">${row.label}</span>
        <span class="fiskal-formula" title="${row.ref}">${row.formula}</span>
      </div>
      <div class="fiskal-val ${row.cls}">${row.val}</div>
    </div>`).join('');
}

function renderVerteilungChart(r) {
  const el = document.getElementById('verteilung-chart');
  if (!el || !r.hh_delta) return;
  const delta  = r.hh_delta.delta || [];
  const labels = ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10a','D10b','D10c'];
  const items  = delta.map((d, i) => ({ label: labels[i], value: d }));
  el.innerHTML = svgDivergingBars(items, { fmt: v => (v >= 0 ? '+' : '') + v.toFixed(0) + ' €' });
}

function renderHankPanel(r, abl) {
  const el = document.getElementById('hank-body');
  if (!el) return;
  const mu = abl.mu_hank;
  const base = 1.2;
  el.innerHTML = `
    <div class="hank-mu">
      <span class="hank-mu-label">μ<sub>G</sub></span>
      <span class="hank-mu-val ${mu > base ? 'good' : mu < base ? 'bad' : 'neutral'}">${mu.toFixed(3)}</span>
      <span class="hank-mu-ref">Ref: ${base.toFixed(1)}</span>
    </div>
    ${svgHankGauge(mu, base)}
    <div class="hank-note">
      MPC-gewichteter Fiskalmultiplikator. μ &gt; ${base}: Impuls an einkommensarme Dezile (hohe MPC).
      μ &lt; ${base}: Impuls an Kapitaleinkommen (niedrige MPC, Ersparnisbildung dominant).
    </div>
    <div class="hank-ref">Kaplan/Moll/Violante (2018) AER · McKay/Nakamura/Steinsson (2016)</div>`;
}

function renderDomarPanel(z, abl) {
  const el = document.getElementById('domar-body');
  if (!el) return;
  const stable = abl.r_minus_g < 0;
  el.innerHTML = `
    ${svgCompareBars([
      { label: 'r (Zins)',      value: 2.5, color: 'var(--chart-1)' },
      { label: 'g (Wachstum)',  value: 1.5, color: 'var(--chart-3)' },
    ])}
    <div class="domar-row domar-rg">
      <span>r − g</span>
      <span class="mono ${stable ? 'good' : 'bad'}">${(abl.r_minus_g * 100).toFixed(2)} %</span>
    </div>
    <div class="domar-verdict ${stable ? 'good' : 'bad'}">
      ${stable
        ? 'Schulden automatisch stabil (r − g < 0)'
        : 'Primärüberschuss erforderlich (r − g > 0)'}
    </div>
    <div class="domar-ref">Domar (1944) Rev.Econ.Stat. · Blanchard (2019) AEA Presidential Address</div>`;
}

function renderCo2Panel(z, abl) {
  const el = document.getElementById('co2-budget-bar');
  if (!el) return;
  const used = z.co2_kumulat / CO2_BUDGET_DE * 100;
  const cls  = used < 50 ? 'good-bar' : used < 80 ? 'warn-bar' : 'bad-bar';
  document.getElementById('co2-budget-bar').innerHTML = `
    <div class="co2-track">
      <div class="co2-fill ${cls}" style="width:${Math.min(100, used).toFixed(1)}%"></div>
    </div>
    <div class="co2-meta">
      <span>${Math.round(z.co2_kumulat).toLocaleString('de-DE')} Mt verbraucht</span>
      <span>${Math.round(abl.co2_budget_rest).toLocaleString('de-DE')} Mt verbleibend</span>
    </div>`;
  const ggiEl = document.getElementById('ggi-value');
  if (ggiEl) {
    const cls2 = abl.ggi < 0.4 ? 'good' : abl.ggi < 0.7 ? 'warn' : 'bad';
    ggiEl.innerHTML = `
      <span class="ggi-label">GGI</span>
      <span class="ggi-val ${cls2}">${abl.ggi.toFixed(3)}</span>
      <span class="ggi-sub">(Schulden ${abl.ggi_schuld.toFixed(2)} + CO₂ ${abl.ggi_co2.toFixed(2)})</span>`;
  }
}

// Rentenfonds- & GKV-Strukturreform-Panel (js/rechner/rente.js) — nur sichtbar,
// wenn die Kurskomplexität "Experte" erreicht oder die zugehörigen Parameter
// bereits vom Status quo abweichen (z. B. importierter Spielstand).
function renderRenteGkvPanels(r, params) {
  const row = document.getElementById('rente-gkv-row');
  if (!row) return;
  const sq = PRESETS.status_quo;
  const paramsWeichenAb = params.kapitalquote !== sq.kapitalquote
    || params.startjahr !== sq.startjahr
    || params.pkv_abschaffen !== sq.pkv_abschaffen
    || params.kv_kapital !== sq.kv_kapital
    || params.kv_bbg_frei !== sq.kv_bbg_frei
    || params.anzahl_kv !== sq.anzahl_kv
    || params.praevention !== sq.praevention;

  if (LEVEL_ORDER[getLevelCode()] < LEVEL_ORDER.exp && !paramsWeichenAb) {
    row.style.display = 'none';
    return;
  }
  row.style.display = '';
  const rente = berechneRente(params, r.rev.rv);
  renderRentePanel(rente, params);
  renderGkvPanel(rente, params);
}

function renderRentePanel(rente, params) {
  const el = document.getElementById('rente-body');
  if (!el) return;
  const chart = svgLineChart([
    { label: 'Ohne Reform',     color: 'var(--bad)',    points: rente.proj_ohne.map(p => ({ x: p.jahr, y: p.beitrag })) },
    { label: 'Mit Fondsreform', color: 'var(--accent)', points: rente.proj_mit.map(p => ({ x: p.jahr, y: p.beitrag })) },
  ], { height: 130, width: 320, padR: 84, yFmt: v => v.toFixed(0) + '%', xFmt: y => String(y) });

  el.innerHTML = `
    <div class="rente-stat-row"><span class="rente-stat-label">Kapitalstock (Startjahr ${params.startjahr})</span><span class="rente-stat-val">${rente.kapitalstock.toFixed(0)} Mrd. €</span></div>
    <div class="rente-stat-row"><span class="rente-stat-label">Jahresertrag</span><span class="rente-stat-val">${rente.jahresertrag.toFixed(1)} Mrd. €</span></div>
    <div class="rente-stat-row"><span class="rente-stat-label">Beitragsentlastung</span><span class="rente-stat-val good">−${rente.beitragsentlastung.toFixed(2)} PP</span></div>
    <div style="margin-top:10px">${chart}</div>
    <div class="fiskal-formula" style="margin-top:6px">Beitragssatz-Projektion 2025–2045 · Rentenpaket II BT-Drs. 20/10749 · DRV Rentenbericht 2024</div>`;
}

function renderGkvPanel(rente, params) {
  const el = document.getElementById('gkv-body');
  if (!el) return;
  const rows = [
    { label: 'PKV-Abschaffung', val: rente.pkv_netto_effekt,     active: params.pkv_abschaffen },
    { label: 'Kassenfusion',    val: rente.kassen_ersparnis,     active: params.anzahl_kv < 95 },
    { label: 'Prävention',      val: rente.praevention_ersparnis, active: params.praevention > 0 },
  ];
  el.innerHTML = rows.map(row => `
    <div class="rente-stat-row">
      <span class="rente-stat-label">${row.label}${row.active ? '' : ' <span class="sq-label">(inaktiv)</span>'}</span>
      <span class="rente-stat-val ${row.val >= 0 ? 'good' : 'bad'}">${row.val >= 0 ? '+' : ''}${row.val.toFixed(1)} Mrd.</span>
    </div>`).join('') + `
    <div class="rente-stat-row" style="border-top:2px solid var(--border); margin-top:4px; padding-top:8px;">
      <span class="rente-stat-label" style="font-weight:600">Gesamteffekt</span>
      <span class="rente-stat-val ${rente.gkv_gesamt_effekt >= 0 ? 'good' : 'bad'}" style="font-weight:600">${rente.gkv_gesamt_effekt >= 0 ? '+' : ''}${rente.gkv_gesamt_effekt.toFixed(1)} Mrd.</span>
    </div>`;
}

// ── Navigation & Locking ──────────────────────────────────────────────────────

function navigatePeriode(idx) {
  const lockedCount     = state.perioden.filter(p => p.locked).length;
  if (idx > lockedCount || idx >= getTeacherFreigabe()) return;
  state.current_periode = idx;
  saveState(state);
  renderAll();
}

function getTeacherFreigabe() {
  return state.kurs_konfig.perioden_freigegeben
    ?? (URL_SESSION_ID ? 1 : state.kurs_konfig.perioden_anzahl);
}

function copyParamsToNext(fromIdx) {
  const toIdx = fromIdx + 1;
  if (toIdx >= state.kurs_konfig.perioden_anzahl) return;
  const toP = state.perioden[toIdx];
  if (!toP.locked) toP.params = { ...state.perioden[fromIdx].params };
}

async function lockPeriode() {
  const p   = state.perioden[state.current_periode];
  const idx = state.current_periode;
  if (p.locked) return;
  if (idx >= getTeacherFreigabe()) return; // Periode noch nicht vom Lehrer freigegeben

  // Online-Modus mit Abstimmung: Stimme ans Backend senden
  if (URL_SESSION_ID && !state.sandbox) {
    const btn = document.getElementById('btn-commit');
    if (btn) { btn.disabled = true; btn.textContent = 'Stimme wird gezählt …'; }
    const result = await apiVote(idx);
    if (result) {
      p.votes  = result.votes ?? p.votes;
      p.locked = result.locked ?? false;
      if (p.locked) {
        copyParamsToNext(idx);
        const next = idx + 1;
        // Nur zur nächsten Periode wechseln wenn Lehrer sie freigegeben hat
        if (next < state.kurs_konfig.perioden_anzahl && next < getTeacherFreigabe()) {
          state.current_periode = next;
        }
      }
      saveState(state);
      renderAll();
    } else {
      if (btn) { btn.disabled = false; renderControls(); }
    }
    return;
  }

  // Offline / Sandbox-Modus: sofort sperren
  p.votes  = state.kurs_konfig.team_groesse;
  p.locked = true;
  copyParamsToNext(idx);
  const next = idx + 1;
  if (next < state.kurs_konfig.perioden_anzahl && next < getTeacherFreigabe()) {
    state.current_periode = next;
  }
  saveState(state);
  renderAll();
}

// ── Reset / Settings ──────────────────────────────────────────────────────────

document.getElementById('btn-reset')?.addEventListener('click', () => {
  if (confirm('Spielstand zurücksetzen?')) {
    state = defaultState();
    saveState(state);
    renderAll();
  }
});

document.getElementById('btn-sandbox-toggle')?.addEventListener('click', () => {
  state.sandbox = !state.sandbox;
  state.kurs_konfig.sandbox = state.sandbox;
  saveState(state);
  renderAll();
});

// ── Team-Picker ───────────────────────────────────────────────────────────────
// Erscheint wenn ?session= vorhanden aber ?team= fehlt.
// Blockiert das Spiel bis der Studierende Name + Team gewählt hat.

const URL_PARAMS   = new URLSearchParams(location.search);
const URL_TEAM     = URL_PARAMS.get('team');
const URL_MEMBER   = URL_PARAMS.get('member');

async function showTeamPicker() {
  const overlay = document.getElementById('team-picker-overlay');
  const nameEl  = document.getElementById('picker-session-name');
  const teamsEl = document.getElementById('picker-teams');
  const errorEl = document.getElementById('picker-error');
  const loadEl  = document.getElementById('picker-loading');
  overlay.classList.remove('hidden');

  let sessionMeta = null;
  let pollTimer   = null;

  async function loadMembers() {
    try {
      const data = await holeMitglieder(URL_SESSION_ID);
      errorEl.textContent = '';
      sessionMeta = data;
      renderTeams(data);
    } catch (fehler) {
      console.error('loadMembers:', fehler);
      errorEl.textContent = fehler.istNetzwerkfehler
        ? 'Netzwerkfehler — Verbindung prüfen.'
        : `Fehler beim Laden der Session (HTTP ${fehler.status}).`;
    }
  }

  function renderTeams(data) {
    if (nameEl && data) {
      nameEl.textContent = URL_PARAMS.get('name')
        ? decodeURIComponent(URL_PARAMS.get('name'))
        : 'Session ' + URL_SESSION_ID;
    }
    teamsEl.innerHTML = '';
    for (const team of (data?.team_names ?? [])) {
      const count  = data.belegung[team] ?? 0;
      const max    = data.team_groesse;
      const full   = count >= max;
      const btn    = document.createElement('button');
      btn.className = 'picker-team-btn';
      btn.disabled  = full;
      const escTeam = team.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      btn.innerHTML = `
        <span>${escTeam}</span>
        <span class="picker-team-count ${full ? 'full' : ''}">${count}/${max}${full ? ' — voll' : ''}</span>`;
      btn.addEventListener('click', () => joinTeam(team));
      teamsEl.appendChild(btn);
    }
  }

  async function joinTeam(team) {
    const matrikelnummer = document.getElementById('picker-matrikel-input')?.value.trim() ?? '';
    const name           = document.getElementById('picker-name-input').value.trim();
    if (!matrikelnummer) { errorEl.textContent = 'Bitte Matrikelnummer eingeben.'; return; }
    if (!name)           { errorEl.textContent = 'Bitte deinen Namen eingeben.';   return; }
    errorEl.textContent = '';
    loadEl.textContent  = 'Beitreten …';

    try {
      await trittBei(URL_SESSION_ID, { name, matrikelnummer, team });
      // Erfolgreich: URL anpassen und Spiel starten
      clearInterval(pollTimer);
      overlay.classList.add('hidden');
      const newUrl = new URL(location.href);
      newUrl.searchParams.set('team',   team);
      newUrl.searchParams.set('member', name);
      history.replaceState({}, '', newUrl.toString());
      // State mit Team-Info initialisieren
      state = defaultState();
      state.team_id = team;
      // Server-State wiederherstellen (falls Team bereits Entscheidungen hat,
      // z. B. bei Rejoin nach Cache-Verlust im Semesterbetrieb)
      apiRestoreState().then(restored => {
        if (restored) {
          console.info('[Kassensturz] State vom Server wiederhergestellt (Rejoin).');
        }
        saveState(state);
        renderAll();
        startPolling();
      });
    } catch (fehler) {
      loadEl.textContent  = '';
      // Eine fachliche Ablehnung des Servers ("Team ist voll") soll die Person
      // auch lesen — nicht pauschal als Netzwerkfehler verschwinden.
      errorEl.textContent = fehler.istNetzwerkfehler
        ? 'Netzwerkfehler — bitte erneut versuchen.'
        : (fehler.message || 'Fehler beim Beitreten.');
    }
  }

  await loadMembers();
  pollTimer = setInterval(loadMembers, 3000);
}

// ── API-Sync (Phase 2b) ───────────────────────────────────────────────────────
// Aktiv nur wenn ?session=... in der URL gesetzt ist (URL_SESSION_ID != null).
// Ohne Session-Parameter läuft alles ausschließlich über localStorage — kein
// Netzwerk-Zugriff, volle Offline-Funktionalität.

async function apiPushState() {
  if (!URL_SESSION_ID || !state.team_id) return;
  try {
    await sendeTeamZustand(URL_SESSION_ID, state.team_id, state.perioden);
  } catch (_) {
    // Netzwerkfehler ignorieren — localStorage-State bleibt gültig
  }
}

/**
 * State-Recovery: Beim ersten Laden ohne localStorage den Server-State
 * (Parameter, locked, votes) für das eigene Team wiederherstellen.
 * Verhindert das Überschreiben gespeicherter Entscheidungen bei
 * Gerätewechsel oder gelöschtem Browser-Cache (Semesterbetrieb).
 * @returns {boolean} true wenn Server-State erfolgreich wiederhergestellt wurde
 */
async function apiRestoreState() {
  if (!URL_SESSION_ID || !state.team_id) return false;
  try {
    const session = await holeSitzung(URL_SESSION_ID);
    const ownState = session.teams[state.team_id];
    if (!ownState || !ownState.perioden || ownState.perioden.length === 0) return false;

    let restored = false;
    for (const remotePeriod of ownState.perioden) {
      const local = state.perioden[remotePeriod.idx];
      if (!local) continue;
      // Parameter vom Server übernehmen (Kernstück der Recovery)
      if (remotePeriod.params && typeof remotePeriod.params === 'object') {
        local.params = { ...local.params, ...remotePeriod.params };
        restored = true;
      }
      // locked + votes synchronisieren
      if (remotePeriod.locked) {
        local.locked = true;
        copyParamsToNext(remotePeriod.idx);
      }
      if (remotePeriod.votes !== undefined) local.votes = remotePeriod.votes;
    }

    // Kurs-Konfiguration vom Server übernehmen
    if (session.perioden_freigegeben != null) {
      state.kurs_konfig.perioden_freigegeben = session.perioden_freigegeben;
    }
    if (session.perioden_anzahl) {
      state.kurs_konfig.perioden_anzahl = session.perioden_anzahl;
    }
    if (session.perioden_laenge_jahre != null) {
      state.kurs_konfig.perioden_laenge_jahre = session.perioden_laenge_jahre;
    }
    if (session.schocks) state.kurs_konfig.schocks = session.schocks;
    if (session.lernziele) state.kurs_konfig.lernziele = session.lernziele;
    if (session.perioden_werkzeuge) state.kurs_konfig.perioden_werkzeuge = session.perioden_werkzeuge;

    // current_periode auf erste offene Periode setzen
    if (restored) {
      const lockedCount = state.perioden.filter(p => p.locked).length;
      const teacherGate = state.kurs_konfig.perioden_freigegeben ?? state.kurs_konfig.perioden_anzahl;
      state.current_periode = Math.min(lockedCount, teacherGate - 1, state.kurs_konfig.perioden_anzahl - 1);
    }

    return restored;
  } catch (_) {
    return false;
  }
}

async function apiVote(periode_idx) {
  if (!URL_SESSION_ID || !state.team_id) return null;
  try {
    return await stimmeAb(URL_SESSION_ID, state.team_id, periode_idx);
  } catch (_) {
    return null;
  }
}

async function apiPollSession() {
  if (!URL_SESSION_ID) return;
  try {
    const session = await holeSitzung(URL_SESSION_ID);
    // Andere Teams: locked-Status übernehmen, wenn sich etwas geändert hat
    let changed = false;

    // Eigenes Team: locked + votes vom Server übernehmen (Admin-Override + Vote-Sync)
    const ownState = session.teams[state.team_id];
    if (ownState) {
      for (const remotePeriod of ownState.perioden) {
        const local = state.perioden[remotePeriod.idx];
        if (!local) continue;
        if (remotePeriod.locked && !local.locked) {
          local.locked = true;
          // Params der gerade gesperrten Periode vom Server übernehmen
          if (remotePeriod.params && typeof remotePeriod.params === 'object') {
            local.params = { ...local.params, ...remotePeriod.params };
          }
          copyParamsToNext(remotePeriod.idx); // Params in nächste Periode übertragen
          changed = true;
        } else if (!remotePeriod.locked && local.locked) {
          local.locked = false;
          changed = true;
        }
        // Params gesperrter Perioden immer vom Server synchronisieren
        // (Teammitglieder sehen die gleichen abgeschlossenen Entscheidungen)
        if (local.locked && remotePeriod.params && typeof remotePeriod.params === 'object') {
          const remoteJson = JSON.stringify(remotePeriod.params);
          const localJson  = JSON.stringify(local.params);
          if (remoteJson !== localJson) {
            local.params = { ...local.params, ...remotePeriod.params };
            changed = true;
          }
        }
        if (remotePeriod.votes !== undefined && remotePeriod.votes !== local.votes) {
          local.votes = remotePeriod.votes;
          changed = true;
        }
      }
    }

    // Kern-Konfiguration vom Server übernehmen (Server ist immer die Wahrheit)
    if (session.perioden_anzahl && session.perioden_anzahl !== state.kurs_konfig.perioden_anzahl) {
      state.kurs_konfig.perioden_anzahl = session.perioden_anzahl;
      // Perioden-Array auf korrekte Länge bringen
      while (state.perioden.length < session.perioden_anzahl) {
        state.perioden.push({
          idx:    state.perioden.length,
          locked: false,
          params: { ...PRESETS.status_quo, invest_impuls: 0 },
          votes:  0,
        });
      }
      if (state.perioden.length > session.perioden_anzahl) {
        state.perioden = state.perioden.slice(0, session.perioden_anzahl);
      }
      changed = true;
    }
    if (session.team_groesse && session.team_groesse !== state.kurs_konfig.team_groesse) {
      state.kurs_konfig.team_groesse = session.team_groesse;
      changed = true;
    }
    if (session.perioden_laenge_jahre != null) {
      const remoteL = JSON.stringify(session.perioden_laenge_jahre);
      const localL  = JSON.stringify(state.kurs_konfig.perioden_laenge_jahre ?? 4);
      if (remoteL !== localL) {
        state.kurs_konfig.perioden_laenge_jahre = session.perioden_laenge_jahre;
        changed = true;
      }
    }

    // Andere Teams: locked-Status synchronisieren (nur true→true, nicht unlock)
    for (const [teamName, teamState] of Object.entries(session.teams)) {
      if (teamName === state.team_id) continue;
      for (const remotePeriod of teamState.perioden) {
        const local = state.perioden[remotePeriod.idx];
        if (local && remotePeriod.locked && !local.locked) {
          local.locked = true;
          changed = true;
        }
      }
    }

    // Perioden-Freigabe vom Admin übernehmen
    const remoteFreigabe = session.perioden_freigegeben ?? session.perioden_anzahl;
    const localFreigabe  = state.kurs_konfig.perioden_freigegeben ?? state.kurs_konfig.perioden_anzahl;
    if (remoteFreigabe !== localFreigabe) {
      state.kurs_konfig.perioden_freigegeben = remoteFreigabe;
      changed = true;
    }

    // current_periode nach Sync validieren (eigene Fortschritte + Lehrer-Freigabe)
    const lockedAfterSync = state.perioden.filter(p => p.locked).length;
    const teacherGate     = state.kurs_konfig.perioden_freigegeben ?? state.kurs_konfig.perioden_anzahl;
    const maxPeriode      = Math.min(lockedAfterSync, teacherGate - 1, state.kurs_konfig.perioden_anzahl - 1);
    if (state.current_periode > maxPeriode) {
      state.current_periode = maxPeriode;
      changed = true;
    }

    // Schocks vom Admin übernehmen
    const remoteSchocks = JSON.stringify(session.schocks ?? []);
    const localSchocks  = JSON.stringify(state.kurs_konfig.schocks ?? []);
    if (remoteSchocks !== localSchocks) {
      state.kurs_konfig.schocks = session.schocks ?? [];
      changed = true;
    }

    // Lernziele vom Admin übernehmen
    const remoteLernziele = JSON.stringify(session.lernziele ?? []);
    const localLernziele  = JSON.stringify(state.kurs_konfig.lernziele ?? []);
    if (remoteLernziele !== localLernziele) {
      state.kurs_konfig.lernziele = session.lernziele ?? [];
      changed = true;
    }

    // Werkzeuge / Scaffolding vom Admin übernehmen
    const remoteWerkzeuge = JSON.stringify(session.perioden_werkzeuge ?? null);
    const localWerkzeuge  = JSON.stringify(state.kurs_konfig.perioden_werkzeuge ?? null);
    if (remoteWerkzeuge !== localWerkzeuge) {
      state.kurs_konfig.perioden_werkzeuge = session.perioden_werkzeuge ?? null;
      changed = true;
    }

    if (changed) {
      saveState(state);
      renderAll();
    }
  } catch (err) {
    console.error('apiPollSession:', err);
  }
}

// Polling starten (nur mit aktiver Session, nicht im Sandbox-Modus)
function startPolling() {
  if (!URL_SESSION_ID || state.sandbox) return;
  apiPollSession(); // sofort beim Start, nicht erst nach 5 Sek.
  setInterval(apiPollSession, 5000);
}

function setupNewsroomEvents() {
  // Watchlist Ein-/Ausklappen
  document.getElementById('btn-toggle-watchlist')?.addEventListener('click', () => {
    state.watchlist_collapsed = !state.watchlist_collapsed;
    saveState(state);
    renderWatchlist();
  });

  // Kabinetts-Submenü (Ministerium konsultieren)
  const btnRessort = document.getElementById('btn-ressort-menu');
  const dropRessort = document.getElementById('ressort-menu-dropdown');
  const wrapRessort = document.getElementById('wrap-ressort-menu');
  btnRessort?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropRessort?.classList.contains('open');
    document.getElementById('analysis-menu-dropdown')?.classList.remove('open');
    document.getElementById('wrap-analysis-menu')?.classList.remove('open');
    dropRessort?.classList.toggle('open', !isOpen);
    wrapRessort?.classList.toggle('open', !isOpen);
  });

  // Toggle alle 4 Ministerien-Karten
  document.getElementById('btn-toggle-ressorts-grid')?.addEventListener('click', () => {
    state.show_ressort_cards = !state.show_ressort_cards;
    saveState(state);
    renderNewsFrontpage();
  });

  // Hamburger-Menü für Grafiken & Auswertungen
  const btnAnalysis = document.getElementById('btn-analysis-menu');
  const dropAnalysis = document.getElementById('analysis-menu-dropdown');
  const wrapAnalysis = document.getElementById('wrap-analysis-menu');
  btnAnalysis?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropAnalysis?.classList.contains('open');
    dropRessort?.classList.remove('open');
    wrapRessort?.classList.remove('open');
    dropAnalysis?.classList.toggle('open', !isOpen);
    wrapAnalysis?.classList.toggle('open', !isOpen);
  });

  // Klick außerhalb schließt beide Dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#wrap-analysis-menu')) {
      dropAnalysis?.classList.remove('open');
      wrapAnalysis?.classList.remove('open');
    }
    if (!e.target.closest('#wrap-ressort-menu')) {
      dropRessort?.classList.remove('open');
      wrapRessort?.classList.remove('open');
    }
  });

  // Widget Toggles im Dropdown-Menü
  document.querySelectorAll('#analysis-menu-dropdown .submenu-item[data-widget]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWidget(item.dataset.widget);
    });
  });

  // Entfernen-Buttons auf Widget-Karten
  document.getElementById('active-widgets-container')?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-widget]');
    if (removeBtn) {
      toggleWidget(removeBtn.dataset.removeWidget);
    }
  });

  // Aktionen im Auswertungs-Menü
  document.getElementById('btn-clear-all-widgets')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.active_widgets = [];
    saveState(state);
    renderResults();
    dropAnalysis?.classList.remove('open');
    wrapAnalysis?.classList.remove('open');
  });

  const applyRecommended = (e) => {
    if (e) e.stopPropagation();
    state.active_widgets = [...RECOMMENDED_WIDGETS];
    saveState(state);
    renderResults();
    dropAnalysis?.classList.remove('open');
    wrapAnalysis?.classList.remove('open');
  };
  document.getElementById('btn-recommended-widgets')?.addEventListener('click', applyRecommended);
  document.getElementById('btn-empty-quickstart')?.addEventListener('click', applyRecommended);

  // Dossier Drawer Schließen / Bestätigen
  document.getElementById('btn-close-dossier')?.addEventListener('click', closeDossier);
  document.getElementById('btn-apply-dossier')?.addEventListener('click', closeDossier);
  document.getElementById('dossier-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'dossier-backdrop') closeDossier();
  });

  // Watchlist Modal Öffnen / Schließen
  document.getElementById('btn-edit-watchlist')?.addEventListener('click', openWatchlistModal);
  document.getElementById('btn-close-watchlist-modal')?.addEventListener('click', closeWatchlistModal);
  document.getElementById('btn-save-watchlist')?.addEventListener('click', closeWatchlistModal);
  document.getElementById('watchlist-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'watchlist-modal-backdrop') closeWatchlistModal();
  });

  // Locked Ressort Modal Schließen
  const closeLockedModal = () => {
    const m = document.getElementById('locked-ressort-modal');
    if (m) m.style.display = 'none';
  };
  document.getElementById('btn-close-locked-modal')?.addEventListener('click', closeLockedModal);
  document.getElementById('btn-confirm-locked-modal')?.addEventListener('click', closeLockedModal);
  document.getElementById('locked-ressort-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'locked-ressort-modal') closeLockedModal();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

if (URL_SESSION_ID && !URL_TEAM) {
  // Session aktiv, aber noch kein Team gewählt → Team-Picker anzeigen
  showTeamPicker();
} else {
  state = loadState();
  const hadLocalStorage = state._fromLocalStorage;
  delete state._fromLocalStorage;  // Flag nicht persistieren
  if (URL_SESSION_ID) {
    state.session_id = URL_SESSION_ID;
    if (URL_TEAM)   state.team_id = URL_TEAM;
  }

  if (URL_SESSION_ID && !hadLocalStorage) {
    // Kein localStorage vorhanden (neues Gerät, Cache gelöscht, Inkognito):
    // Zuerst Server-State abrufen, um gespeicherte Entscheidungen wiederherzustellen.
    // Erst danach speichern + pushen, damit nichts überschrieben wird.
    apiRestoreState().then(restored => {
      if (restored) {
        console.info('[Kassensturz] State vom Server wiederhergestellt.');
      }
      saveState(state);
      setupNewsroomEvents();
      renderAll();
      startPolling();
    });
  } else {
    // localStorage vorhanden oder Offline-Modus: normal starten
    // current_periode auf erste offene Periode setzen (Fortschritte + Lehrer-Freigabe)
    const lockedOnLoad    = state.perioden.filter(p => p.locked).length;
    const teacherOnLoad   = getTeacherFreigabe();
    const maxAllowed      = Math.min(lockedOnLoad, teacherOnLoad - 1, state.kurs_konfig.perioden_anzahl - 1);
    if (state.current_periode > maxAllowed) state.current_periode = maxAllowed;
    saveState(state);
    setupNewsroomEvents();
    renderAll();
    startPolling();
  }
}
