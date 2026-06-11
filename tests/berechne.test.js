// SPDX-License-Identifier: CC-BY-4.0
// Tests: Hauptsimulation berechne() — Invarianten und komparative Statik
//
// Invarianten: Für jede zulässige Parameterkombination (Slider-Spannweiten der
// UI plus Extremkombinationen) müssen alle Kennzahlen endlich und in ihren
// Definitionsbereichen liegen.
// Komparative Statik: Vorzeichen der Reaktionen müssen der ökonomischen
// Theorie entsprechen (Quellen siehe FORMEL_QUELLEN_* in den Modulen).

import test from 'node:test';
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { PRESETS, PERIOD_STATE_0 } from '../js/data.js';

const SQ = PRESETS.status_quo;

function alleZahlenEndlich(obj, pfad = '') {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') {
      assert.ok(Number.isFinite(v), `${pfad}${k} ist nicht endlich: ${v}`);
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => { if (typeof x === 'number') assert.ok(Number.isFinite(x), `${pfad}${k}[${i}]: ${x}`); });
    } else if (v && typeof v === 'object') {
      alleZahlenEndlich(v, `${pfad}${k}.`);
    }
  }
}

function pruefeInvarianten(r, label) {
  alleZahlenEndlich(r, `${label}: `);
  assert.ok(r.gini >= 0 && r.gini <= 1, `${label}: Gini ${r.gini}`);
  assert.ok(r.armutsrisiko >= 0 && r.armutsrisiko <= 100, `${label}: Armutsrisiko ${r.armutsrisiko}`);
  assert.ok(r.einnahmen_total > 0, `${label}: Einnahmen ${r.einnahmen_total}`);
  assert.ok(r.ausgaben_total > 0, `${label}: Ausgaben ${r.ausgaben_total}`);
  assert.ok(r.emissionen > 0, `${label}: Emissionen ${r.emissionen}`);
  for (const m of r.metr) assert.ok(m >= 0 && m <= 0.99, `${label}: METR ${m}`);
  assert.ok(r.dwl >= 0, `${label}: DWL ${r.dwl}`);
  assert.ok(r.avg_labor > 0.4 && r.avg_labor < 1.6, `${label}: avg_labor ${r.avg_labor}`);
}

test('Invarianten: alle Presets', () => {
  for (const [name, params] of Object.entries(PRESETS)) {
    pruefeInvarianten(berechne(params), `Preset ${name}`);
  }
});

test('Invarianten: Extremkombinationen der Slider-Spannweiten', () => {
  const minimal = { ...SQ, freibetrag: 8000, eingang: 10, spitze: 35, grenze: 100000, mwst: 15, mwst_erm: 0, co2: 25, kst: 5, gewst: 0, gewst_aus: true, rv: 14, kv: 12, alpf: 3, bbg: 63000, erb: 0, boden: 0, verm: 0, zucman: 0, bg: 400, kg: 100, kleine_st: false, invest_impuls: -30 };
  const maximal = { ...SQ, freibetrag: 20000, eingang: 30, spitze: 65, grenze: 400000, mwst: 30, mwst_erm: 15, co2: 350, kst: 30, gewst: 20, rv: 26, kv: 22, alpf: 9, bbg: 180000, erb: 50, betriebs: false, boden: 2, verm: 2, zucman: 3, bg: 900, kg: 400, invest_impuls: 120 };
  const bge_max = { ...SQ, bge: 1500, bg: 563, neg_est: true };
  const toggles = { ...SQ, synthetisch: true, klimageld: false, buergerv: true, kv_kapital: true, kv_bbg_frei: true, gewst_aus: true };

  for (const [label, params] of Object.entries({ minimal, maximal, bge_max, toggles })) {
    pruefeInvarianten(berechne(params), label);
  }
});

test('Invarianten: mit Multi-Perioden-Zustand (auch degradiert)', () => {
  const zustaende = [
    PERIOD_STATE_0,
    { bip: 3000, schuldenquote: 180, co2_kumulat: 8000, lohnbasis_faktor: 0.70, renten_faktor: 1.25 },
    { bip: 6000, schuldenquote: 0, co2_kumulat: 0, lohnbasis_faktor: 1.30, renten_faktor: 1.0 },
  ];
  for (const z of zustaende) {
    pruefeInvarianten(berechne(SQ, z), `Zustand BIP ${z.bip}`);
  }
});

test('Status quo ist der Referenzpunkt: labor_factor und Delta exakt neutral', () => {
  const r = berechne(SQ);
  assert.ok(Math.abs(r.avg_labor - 1) < 1e-9, `avg_labor ${r.avg_labor}`);
  // Haushalts-Deltas gegenüber SQ müssen ~0 sein (identische Berechnungspfade)
  for (const d of r.hh_delta.delta) {
    assert.ok(Math.abs(d) < 1, `SQ-Delta ${d} € sollte ~0 sein`);
  }
});

// ── Komparative Statik ────────────────────────────────────────────────────────

test('höherer MwSt-Regelsatz erhöht das MwSt-Aufkommen', () => {
  const a = berechne(SQ).rev.mwst;
  const b = berechne({ ...SQ, mwst: 22 }).rev.mwst;
  assert.ok(b > a);
});

test('höherer CO₂-Preis senkt Emissionen und erhöht Brutto-CO₂-Aufkommen', () => {
  const a = berechne(SQ);
  const b = berechne({ ...SQ, co2: 150 });
  assert.ok(b.emissionen < a.emissionen, 'Emissionen müssen sinken (ε_CO₂ < 0)');
  const brutto_a = a.rev.co2 + a.klimageld_auszahlung;
  const brutto_b = b.rev.co2 + b.klimageld_auszahlung;
  assert.ok(brutto_b > brutto_a, 'Aufkommen muss im inelastischen Bereich steigen');
});

test('höherer Spitzensteuersatz senkt Gini (Umverteilung)', () => {
  const a = berechne(SQ).gini;
  const b = berechne({ ...SQ, spitze: 55 }).gini;
  assert.ok(b < a, `Gini ${b} sollte unter ${a} liegen`);
});

test('höheres Bürgergeld senkt das Armutsrisiko', () => {
  const a = berechne(SQ).armutsrisiko;
  const b = berechne({ ...SQ, bg: 750 }).armutsrisiko;
  assert.ok(b < a);
});

test('höhere KSt dämpft Investitionen (SVR/Gechert-Heimberger-Elastizität)', () => {
  const a = berechne(SQ).investment_factor;
  const b = berechne({ ...SQ, kst: 25 }).investment_factor;
  assert.ok(b < a);
});

test('höherer Eingangssatz dämpft das Arbeitsangebot (Saez/Chetty ε = 0,20)', () => {
  const a = berechne(SQ).avg_labor;
  const b = berechne({ ...SQ, eingang: 20 }).avg_labor;
  assert.ok(b < a);
});

test('BGE 1.200 € reduziert Arbeitsangebot und ersetzt Bürgergeld (RWI 2024)', () => {
  const r = berechne({ ...SQ, bge: 1200 });
  assert.ok(r.avg_labor < 1, `avg_labor ${r.avg_labor}`);
  assert.equal(r.bg_auszahlung, 0, 'Bürgergeld muss bei BGE ≥ Regelsatz entfallen');
  assert.ok(r.bge_brutto > 900 && r.bge_brutto < 1100, `BGE-Bruttokosten ${r.bge_brutto} Mrd. (soll ~1.008)`);
});

test('Schuldenbremse-Indikator konsistent zum Saldo (Art. 109 GG, −0,35 % BIP)', () => {
  const r = berechne(SQ);
  assert.equal(r.schuldenbremse_ok, r.saldo_bip_pct >= -0.35);
});

test('Klimageld: Auszahlung ist 70 % des CO₂-Aufkommens, Abschalten erhöht Netto-Aufkommen', () => {
  const mit = berechne(SQ);
  const ohne = berechne({ ...SQ, klimageld: false });
  assert.ok(Math.abs(mit.klimageld_auszahlung - (mit.rev.co2 + mit.klimageld_auszahlung) * 0.7) < 1e-9);
  assert.equal(ohne.klimageld_auszahlung, 0);
  assert.ok(ohne.rev.co2 > mit.rev.co2);
});
