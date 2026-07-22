// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Planspiel — UI-Controller
// ═══════════════════════════════════════════════════════

import { simulierePfad } from './rechner/transition.js';
import { berechneAbgeleitet, CO2_BUDGET_DE } from './rechner/abgeleitet.js';
import { berechneRente } from './rechner/rente.js';
import { PRESETS, KURS_KONFIG_DEFAULT, SCHOCK_BIBLIOTHEK, TOOLTIPS } from './data.js';
import { bewerteLernziele } from './feedback.js';

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
  return konfig;
}

// session_id aus URL — wird für Backend-Sync verwendet (Phase 2b)
const URL_SESSION_ID = new URLSearchParams(location.search).get('session') ?? null;

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

// ── Hauptrenderer ─────────────────────────────────────────────────────────────

let state, pfad;

function renderAll() {
  pfad = simulate(state);
  renderPeriodNav();
  renderSessionBar();
  renderShockBanner();
  renderControls();
  renderResults();
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

function renderControls() {
  const container = document.getElementById('controls-sections');
  const p         = state.perioden[state.current_periode];
  const locked    = p.locked;
  const levelCode = getLevelCode();
  container.innerHTML = '';

  for (const section of SLIDER_SECTIONS) {
    if (LEVEL_ORDER[section.level] > LEVEL_ORDER[levelCode]) continue;

    const div = document.createElement('div');
    div.className = 'ctrl-section';
    div.innerHTML = `
      <div class="ctrl-section-header" data-section="${section.id}">
        <span class="ctrl-dot" style="background:${section.color}"></span>
        <span class="ctrl-section-label">${section.label}</span>
        <span class="tier-badge ${section.level}">${LEVEL_LABEL[section.level]}</span>
        <span class="ctrl-chevron">›</span>
      </div>
      <div class="ctrl-section-body" id="sect-${section.id}">
        ${section.sliders.map(sl => buildSlider(sl, p.params, locked)).join('')}
      </div>`;
    container.appendChild(div);

    // Toggle
    div.querySelector('.ctrl-section-header').addEventListener('click', () => {
      const body = div.querySelector('.ctrl-section-body');
      body.classList.toggle('collapsed');
      div.querySelector('.ctrl-chevron').textContent =
        body.classList.contains('collapsed') ? '›' : '‹';
    });

    // Slider/Toggle-Events
    for (const sl of section.sliders) {
      const input = div.querySelector(`input[data-key="${sl.key}"]`);
      if (!input) continue;

      if (sl.type === 'toggle') {
        input.addEventListener('change', () => {
          p.params[sl.key] = input.checked;
          saveState(state);
          pfad = simulate(state);
          renderResults();
          renderPeriodNav();
        });
        continue;
      }

      const valEl = div.querySelector(`[data-val="${sl.key}"]`);
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        p.params[sl.key] = v;
        valEl.textContent = formatSliderVal(sl, v);
        saveState(state);
        pfad = simulate(state);
        renderResults();
        renderPeriodNav();
      });
    }
  }

  // Commit button
  const commitArea   = document.createElement('div');
  commitArea.className = 'commit-area';
  const totalVotes   = state.kurs_konfig.team_groesse;
  const currentVotes = p.votes;
  const notReleased  = state.current_periode >= getTeacherFreigabe();
  const btnDisabled  = locked || notReleased;
  const btnLabel     = locked      ? 'Periode gesperrt'
                     : notReleased ? 'Noch nicht freigegeben'
                     :               'Periode abschließen';
  commitArea.innerHTML = `
    <button id="btn-commit" class="btn-commit ${locked ? 'locked' : ''}" ${btnDisabled ? 'disabled' : ''}>
      ${btnLabel}
      ${!btnDisabled ? `<small>${currentVotes} / ${totalVotes} Stimmen</small>` : ''}
    </button>
    ${state.sandbox ? '<div class="sandbox-note">Sandbox — kein Scoring</div>' : ''}`;
  container.appendChild(commitArea);

  if (!locked) {
    document.getElementById('btn-commit').addEventListener('click', lockPeriode);
  }
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

  renderKpiStrip(r, z, abl, sqR);
  renderLernzieleBar(r, z);
  renderHistoryChart();
  renderHistoryTable();
  renderFiskalPanel(r, z, abl);
  renderVerteilungChart(r);
  renderHankPanel(r, abl);
  renderDomarPanel(z, abl);
  renderCo2Panel(z, abl);
  renderRenteGkvPanels(r, state.perioden[state.current_periode].params);
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
      formula: 'PS_t = S_t + Zinslast / BIP', ref: 'Blanchard (2019) AEA' },
    { label: 'Zinsaufwand',             val: fmt.mrdAbs(r.zinsen_dyn || 0),    cls: 'neutral',
      formula: 'Z_t = i × D_t × BIP_t', ref: 'Bundesbank Effektivzins' },
    { label: 'Gesamtsaldo S_t',         val: fmt.pct2(r.saldo_bip_pct), cls: r.saldo_bip_pct >= -0.35 ? 'good' : 'bad',
      formula: 'S_t = Einnahmen − Ausgaben', ref: 'Art. 109 GG (−0,35 % Grenze)' },
    { label: 'r − g',                   val: fmt.pct2(abl.r_minus_g * 100), cls: abl.r_minus_g < 0 ? 'good' : 'warn',
      formula: 'r − g = Zins − BIP-Wachstum', ref: 'Domar (1944) · Blanchard (2019)' },
    { label: 'PS-Ziel PS* (Domar)',     val: fmt.pct2(abl.ps_star * 100), cls: 'neutral',
      formula: 'PS* = (r−g) × D_t / 100', ref: 'Domar-Bedingung' },
    { label: 'S2-Tragfähigkeitslücke',  val: fmt.pct2(abl.s2 * 100), cls: abl.s2 >= 0 ? 'good' : 'bad',
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
      const res  = await fetch(`${API_BASE}/sessions/${URL_SESSION_ID}/members`);
      if (!res.ok) {
        errorEl.textContent = `Fehler beim Laden der Session (HTTP ${res.status}).`;
        return;
      }
      const data = await res.json();
      errorEl.textContent = '';
      sessionMeta = data;
      renderTeams(data);
    } catch (err) {
      console.error('loadMembers:', err);
      errorEl.textContent = 'Netzwerkfehler — Verbindung prüfen.';
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
      const res = await fetch(`${API_BASE}/sessions/${URL_SESSION_ID}/members`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, matrikelnummer, team }),
      });
      const data = await res.json();
      if (!res.ok) {
        loadEl.textContent = '';
        errorEl.textContent = data.error ?? 'Fehler beim Beitreten.';
        return;
      }
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
      saveState(state);
      renderAll();
      startPolling();
    } catch (_) {
      loadEl.textContent  = '';
      errorEl.textContent = 'Netzwerkfehler — bitte erneut versuchen.';
    }
  }

  await loadMembers();
  pollTimer = setInterval(loadMembers, 3000);
}

// ── API-Sync (Phase 2b) ───────────────────────────────────────────────────────
// Aktiv nur wenn ?session=... in der URL gesetzt ist (URL_SESSION_ID != null).
// Ohne Session-Parameter läuft alles ausschließlich über localStorage — kein
// Netzwerk-Zugriff, volle Offline-Funktionalität.

const API_BASE = 'https://planspiel-api.aramisda2.workers.dev/api';

async function apiPushState() {
  if (!URL_SESSION_ID || !state.team_id) return;
  try {
    await fetch(`${API_BASE}/sessions/${URL_SESSION_ID}/teams/${encodeURIComponent(state.team_id)}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ perioden: state.perioden }),
    });
  } catch (_) {
    // Netzwerkfehler ignorieren — localStorage-State bleibt gültig
  }
}

async function apiVote(periode_idx) {
  if (!URL_SESSION_ID || !state.team_id) return null;
  try {
    const res = await fetch(
      `${API_BASE}/sessions/${URL_SESSION_ID}/teams/${encodeURIComponent(state.team_id)}/vote`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ periode_idx }),
      }
    );
    return res.ok ? await res.json() : null;
  } catch (_) {
    return null;
  }
}

async function apiPollSession() {
  if (!URL_SESSION_ID) return;
  try {
    const res = await fetch(`${API_BASE}/sessions/${URL_SESSION_ID}`);
    if (!res.ok) return;
    const session = await res.json();
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
          copyParamsToNext(remotePeriod.idx); // Params in nächste Periode übertragen
          changed = true;
        } else if (!remotePeriod.locked && local.locked) {
          local.locked = false;
          changed = true;
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

// ── Init ──────────────────────────────────────────────────────────────────────

if (URL_SESSION_ID && !URL_TEAM) {
  // Session aktiv, aber noch kein Team gewählt → Team-Picker anzeigen
  showTeamPicker();
} else {
  state = loadState();
  if (URL_SESSION_ID) {
    state.session_id = URL_SESSION_ID;
    if (URL_TEAM)   state.team_id = URL_TEAM;
  }
  // current_periode auf erste offene Periode setzen (Fortschritte + Lehrer-Freigabe)
  const lockedOnLoad    = state.perioden.filter(p => p.locked).length;
  const teacherOnLoad   = getTeacherFreigabe();
  const maxAllowed      = Math.min(lockedOnLoad, teacherOnLoad - 1, state.kurs_konfig.perioden_anzahl - 1);
  if (state.current_periode > maxAllowed) state.current_periode = maxAllowed;
  saveState(state);
  renderAll();
  startPolling();
}
