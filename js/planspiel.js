// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Planspiel — UI-Controller
// ═══════════════════════════════════════════════════════

import { simulierePfad } from './rechner/transition.js';
import { berechneAbgeleitet, CO2_BUDGET_DE } from './rechner/abgeleitet.js';
import { PRESETS, KURS_KONFIG_DEFAULT, SCHOCK_BIBLIOTHEK } from './data.js';
import { bewerteLernziele } from './feedback.js';

// ── URL-Konfiguration ─────────────────────────────────────────────────────────
// Lehrpersonen können die Kurskonfiguration per URL-Parameter setzen:
//   ?perioden=5&teams=4&sandbox=false&name=WiPo+SS26&session=abc123
// Fehlende Parameter fallen auf KURS_KONFIG_DEFAULT zurück.

function parseUrlKonfig() {
  const p = new URLSearchParams(location.search);
  const konfig = {};
  if (p.has('perioden'))  konfig.perioden_anzahl      = Math.max(1, Math.min(12, +p.get('perioden')));
  if (p.has('teams'))     konfig.team_groesse          = Math.max(1, Math.min(50, +p.get('teams')));
  if (p.has('sandbox'))   konfig.sandbox               = p.get('sandbox') !== 'false';
  if (p.has('name'))      konfig.kurs_name             = p.get('name').slice(0, 80);
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
    if (raw) return JSON.parse(raw);
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
  mrd:   v => (v >= 0 ? '+' : '') + v.toFixed(0) + ' Mrd.',
  mrdAbs:v => v.toFixed(0) + ' Mrd.',
  pct:   v => v.toFixed(1) + ' %',
  pct2:  v => v.toFixed(2) + ' %',
  delta: v => (v >= 0 ? '+' : '') + v.toFixed(1),
  comma3:v => v.toFixed(3).replace('.', ','),
  idx:   v => v.toFixed(1),
};

function deltaClass(v, dir = 'up') {
  if (Math.abs(v) < 0.001) return 'neutral';
  return (dir === 'up') === (v > 0) ? 'good' : 'bad';
}

// ── Slider-Definitionen ───────────────────────────────────────────────────────

const SLIDER_SECTIONS = [
  {
    id: 'est', label: 'Einkommensteuer', color: '#3b82f6',
    sliders: [
      { key: 'freibetrag', label: 'Grundfreibetrag', unit: '€', min: 8000, max: 20000, step: 100,
        varname: 'G', tooltip: 'Steuerfreies Existenzminimum (§ 32a EStG). 2026: 12.348 €.' },
      { key: 'eingang',    label: 'Eingangssteuersatz', unit: '%', min: 10, max: 30, step: 0.5,
        varname: 'τ₀', tooltip: 'Grenzsteuersatz ab erstem Euro über Freibetrag.' },
      { key: 'spitze',     label: 'Spitzensteuersatz', unit: '%', min: 35, max: 65, step: 0.5,
        varname: 'τₘ', tooltip: 'Maximaler Grenzsteuersatz (ab ca. 278 T€ Einkommen).' },
    ],
  },
  {
    id: 'mwst', label: 'Mehrwertsteuer', color: '#8b5cf6',
    sliders: [
      { key: 'mwst',     label: 'Regelsatz', unit: '%', min: 15, max: 30, step: 0.5,
        varname: 'τᵥ', tooltip: 'MwSt-Regelsatz auf ~70 % des Konsums.' },
      { key: 'mwst_erm', label: 'Ermäßigter Satz', unit: '%', min: 0, max: 15, step: 0.5,
        varname: 'τᵥₑ', tooltip: 'Ermäßigter MwSt-Satz (Lebensmittel, Bücher etc.).' },
    ],
  },
  {
    id: 'co2', label: 'CO₂-Bepreisung', color: '#16a34a',
    sliders: [
      { key: 'co2',      label: 'CO₂-Preis', unit: '€/t', min: 25, max: 350, step: 5,
        varname: 'p_CO₂', tooltip: 'BEHG/ETS-Preis je Tonne CO₂-Äquivalent.' },
    ],
  },
  {
    id: 'kst', label: 'Unternehmensteuern', color: '#ea580c',
    sliders: [
      { key: 'kst',  label: 'Körperschaftsteuer', unit: '%', min: 5, max: 30, step: 0.5,
        varname: 'τ_K', tooltip: 'KSt-Satz auf Unternehmensgewinne (§ 23 KStG).' },
      { key: 'gewst', label: 'Gewerbesteuer', unit: '%', min: 0, max: 20, step: 0.5,
        varname: 'τ_G', tooltip: 'Effektiver Hebesatz-Äquivalent der GewSt.' },
    ],
  },
  {
    id: 'sv', label: 'Sozialversicherung', color: '#0891b2',
    sliders: [
      { key: 'rv',  label: 'Rentenbeitrag', unit: '%', min: 14, max: 26, step: 0.1,
        varname: 'τ_RV', tooltip: 'Gesamtbeitragssatz zur gesetzlichen RV (AN+AG).' },
      { key: 'kv',  label: 'KV-Beitrag',    unit: '%', min: 12, max: 22, step: 0.1,
        varname: 'τ_KV', tooltip: 'GKV-Beitragssatz (AN+AG; ohne Zusatzbeitrag).' },
      { key: 'bbg', label: 'BBG',            unit: '€', min: 63000, max: 180000, step: 1000,
        varname: 'BBG', tooltip: 'SV-Beitragsbemessungsgrenze RV/AL (jährlich).' },
    ],
  },
  {
    id: 'invest', label: 'Investitionen', color: '#b45309',
    sliders: [
      { key: 'invest_impuls', label: 'Öffentl. Investitionsimpuls', unit: 'Mrd. €/a',
        min: -30, max: 120, step: 5, varname: 'I_pub',
        tooltip: 'Zusätzliche öffentliche Investitionen p.a. (BIP-Multiplikator-Effekt).' },
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
  const teacherFreigabe = state.kurs_konfig.perioden_freigegeben ?? state.kurs_konfig.perioden_anzahl;
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
      ${p.locked  ? '<span class="lock-icon">🔒</span>' : ''}
      ${isFuture  ? '<span class="lock-icon" style="opacity:.5">⏳</span>' : ''}`;
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
  container.innerHTML = '';

  for (const section of SLIDER_SECTIONS) {
    const div = document.createElement('div');
    div.className = 'ctrl-section';
    div.innerHTML = `
      <div class="ctrl-section-header" data-section="${section.id}">
        <span class="ctrl-dot" style="background:${section.color}"></span>
        <span class="ctrl-section-label">${section.label}</span>
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

    // Slider events
    for (const sl of section.sliders) {
      const input = div.querySelector(`input[data-key="${sl.key}"]`);
      const valEl = div.querySelector(`[data-val="${sl.key}"]`);
      if (!input) continue;
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
  const commitArea = document.createElement('div');
  commitArea.className = 'commit-area';
  const totalVotes = state.kurs_konfig.team_groesse;
  const currentVotes = p.votes;
  commitArea.innerHTML = `
    <button id="btn-commit" class="btn-commit ${locked ? 'locked' : ''}" ${locked ? 'disabled' : ''}>
      ${locked ? '🔒 Periode gesperrt' : 'Periode abschließen'}
      ${!locked ? `<small>${currentVotes} / ${totalVotes} Stimmen</small>` : ''}
    </button>
    ${state.sandbox ? '<div class="sandbox-note">Sandbox — kein Scoring</div>' : ''}`;
  container.appendChild(commitArea);

  if (!locked) {
    document.getElementById('btn-commit').addEventListener('click', lockPeriode);
  }
}

function buildSlider(sl, params, locked) {
  const val = params[sl.key] ?? 0;
  const sq  = PRESETS.status_quo[sl.key] ?? val;
  return `
    <div class="slider-row">
      <div class="slider-label-row">
        <span class="slider-varname" title="${sl.tooltip}">${sl.varname}</span>
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
  if (sl.unit === '%')    return v.toFixed(1) + ' %';
  if (sl.unit === '€')    return v.toLocaleString('de-DE') + ' €';
  if (sl.unit === '€/t')  return v.toFixed(0) + ' €/t';
  if (sl.unit === 'Mrd. €/a') return (v >= 0 ? '+' : '') + v + ' Mrd.';
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
  renderHistoryTable();
  renderFiskalPanel(r, z, abl);
  renderVerteilungChart(r);
  renderHankPanel(r, abl);
  renderDomarPanel(z, abl);
  renderCo2Panel(z, abl);
}

function renderLernzieleBar(r, z) {
  const bar = document.getElementById('lernziele-bar');
  if (!bar) return;
  const lernziele = state.kurs_konfig.lernziele ?? [];
  if (!lernziele.length || !URL_SESSION_ID) { bar.style.display = 'none'; return; }

  const bwg = bewerteLernziele(r, z, lernziele);
  bar.style.display = '';
  bar.innerHTML = `
    <span class="lz-bar-title">🎯 Lernziele ${bwg.erreicht}/${bwg.total}</span>
    ${bwg.details.map(d => `
      <span class="lz-chip ${d.erreicht ? 'ok' : 'nok'}" title="${d.erreicht ? 'Erreicht' : 'Noch nicht erreicht'}">
        ${d.erreicht ? '✓' : '✗'} ${d.label}
      </span>`).join('')}`;
}

function renderKpiStrip(r, z, abl, sqR) {
  const strip = document.getElementById('kpi-strip');
  const kpis = [
    {
      label: 'Haushaltssaldo',
      value: fmt.mrd(r.saldo),
      delta: r.saldo - sqR.saldo,
      dir:   'up',
      sub:   fmt.pct2(r.saldo_bip_pct) + ' BIP',
    },
    {
      label: 'Schuldenquote',
      value: fmt.pct(z.schuldenquote),
      delta: z.schuldenquote - 63.5,
      dir:   'down',
      sub:   'Δ ' + fmt.pct2(z.schuldenquote - 63.5),
    },
    {
      label: 'Gini-Koeffizient',
      value: fmt.comma3(r.gini),
      delta: r.gini - sqR.gini,
      dir:   'down',
      sub:   'Palma ' + r.palma.toFixed(2),
    },
    {
      label: 'CO₂-Kumulat',
      value: fmt.mrdAbs(z.co2_kumulat) + ' Mt',
      delta: abl.co2_budget_rest / CO2_BUDGET_DE * 100 - 100,
      dir:   'down',
      sub:   'Budget-Rest: ' + Math.round(abl.co2_budget_rest) + ' Mt',
    },
    {
      label: 'BIP-Index',
      value: fmt.idx(z.bip / 4470 * 100),
      delta: z.bip / 4470 * 100 - 100,
      dir:   'up',
      sub:   fmt.mrdAbs(z.bip) + ' Mrd. €',
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
    </div>`).join('');
}

function renderHistoryTable() {
  const container = document.getElementById('history-table');
  if (!container) return;
  const cols = ['label', 'saldo', 'schuld', 'gini', 'emissionen', 'bip'];
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
      <td>${entry.label}${entry.schock ? ' ⚡' : ''}</td>
      <td class="${r.saldo >= 0 ? 'good' : 'bad'}">${fmt.mrd(r.saldo)}</td>
      <td>${fmt.pct(z.schuldenquote)}</td>
      <td>${fmt.comma3(r.gini)}</td>
      <td>${r.emissionen.toFixed(0)} Mt</td>
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
  const delta = r.hh_delta.delta || [];
  const labels = ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10a','D10b','D10c'];
  const maxAbs = Math.max(...delta.map(Math.abs), 1);

  el.innerHTML = delta.map((d, i) => {
    const pct  = (d / maxAbs * 100).toFixed(1);
    const absPct = Math.abs(pct);
    const positive = d >= 0;
    return `
      <div class="dist-row">
        <span class="dist-label">${labels[i]}</span>
        <div class="dist-bar-wrap">
          <div class="dist-bar ${positive ? 'good-bar' : 'bad-bar'}"
               style="width:${absPct}%"></div>
        </div>
        <span class="dist-val ${positive ? 'good' : 'bad'}">
          ${d >= 0 ? '+' : ''}${d.toFixed(0)} €
        </span>
      </div>`;
  }).join('');
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
    <div class="domar-row">
      <span>r (Effektivzins)</span>
      <span class="mono">${(2.5).toFixed(1)} %</span>
    </div>
    <div class="domar-row">
      <span>g (BIP-Wachstum)</span>
      <span class="mono">${(1.5).toFixed(1)} %</span>
    </div>
    <div class="domar-row domar-rg">
      <span>r − g</span>
      <span class="mono ${stable ? 'good' : 'bad'}">${(abl.r_minus_g * 100).toFixed(2)} %</span>
    </div>
    <div class="domar-verdict ${stable ? 'good' : 'bad'}">
      ${stable
        ? '✓ Schulden automatisch stabil (r − g < 0)'
        : '⚠ Primärüberschuss erforderlich (r − g > 0)'}
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
      <span>${Math.round(z.co2_kumulat).toLocaleString('de-DE')} Mt verbraucht</span>
      <span>${Math.round(abl.co2_budget_rest).toLocaleString('de-DE')} Mt verbleibend</span>
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

// ── Navigation & Locking ──────────────────────────────────────────────────────

function navigatePeriode(idx) {
  const lockedCount     = state.perioden.filter(p => p.locked).length;
  const teacherFreigabe = state.kurs_konfig.perioden_freigegeben ?? state.kurs_konfig.perioden_anzahl;
  if (idx > lockedCount || idx >= teacherFreigabe) return;
  state.current_periode = idx;
  saveState(state);
  renderAll();
}

function lockPeriode() {
  const p = state.perioden[state.current_periode];
  if (p.locked) return;

  const minVotes = Math.ceil(
    state.kurs_konfig.team_groesse * state.kurs_konfig.min_teilnahme_quote
  );
  p.votes = state.kurs_konfig.team_groesse; // Im Offline-Modus: sofort voll
  if (state.sandbox || p.votes >= minVotes) {
    p.locked = true;
    const next = state.current_periode + 1;
    if (next < state.kurs_konfig.perioden_anzahl) {
      state.current_periode = next;
    }
    saveState(state);
    renderAll();
  }
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

    // Eigenes Team: locked-Status vom Server übernehmen (Admin-Override-Support)
    const ownState = session.teams[state.team_id];
    if (ownState) {
      for (const remotePeriod of ownState.perioden) {
        const local = state.perioden[remotePeriod.idx];
        if (local && remotePeriod.locked !== local.locked) {
          local.locked = remotePeriod.locked;
          changed = true;
        }
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
  const teacherOnLoad   = state.kurs_konfig.perioden_freigegeben ?? state.kurs_konfig.perioden_anzahl;
  const maxAllowed      = Math.min(lockedOnLoad, teacherOnLoad - 1, state.kurs_konfig.perioden_anzahl - 1);
  if (state.current_periode > maxAllowed) state.current_periode = maxAllowed;
  saveState(state);
  renderAll();
  startPolling();
}
