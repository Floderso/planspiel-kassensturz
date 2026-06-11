// SPDX-License-Identifier: CC-BY-4.0
// Plausibilitätstests: Aufkommen je Steuerart bei Status-quo-Parametern
// gegen amtliche Ist-Werte (BMF Steuereinnahmen-Statistik / Destatis VGR,
// Kassenjahr 2024, gerundet).
//
// Kalibrierungsstand 2026-06-11:
//   - ESt auf Haushaltsebene: zvE-Quote 0,79 und Splitting-Faktor 1,6
//     (einkommensteuer.js, estHaushalt) — Ziel ~350 Mrd. € inkl. Abgeltung
//     (Lohnsteuer 236 + veranlagte ESt 73 + nv. Ertragsteuern + Abgeltung).
//   - MwSt: Basis-Korrekturfaktor 1,68 (BASIS_MAKRO.mwst_basis_faktor),
//     da die Dezil-Konsumbasis nur ~60 % der MwSt-Basis erfasst.
//   - ErbSt: Freibetragsquote 0,45 (BASIS_MAKRO.erb_stpfl_quote, § 16 ErbStG).
//   - Saldo: STAATSAUSGABEN.sonstige_einnahmen als Gegenposten nicht
//     modellierter Einnahmen; Ziel VGR-Finanzierungssaldo −2,7 % BIP.

import test from 'node:test';
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { PRESETS } from '../js/data.js';

const r = berechne(PRESETS.status_quo);

function imBand(ist, soll, toleranz, name) {
  assert.ok(ist > soll * (1 - toleranz) && ist < soll * (1 + toleranz),
    `${name}: Modell ${ist.toFixed(0)} Mrd. vs. amtlich ~${soll} Mrd. (±${toleranz * 100} %)`);
}

test('Gesamtsaldo Status quo entspricht dem VGR-Korridor (−1,5 bis −3,5 % BIP)', () => {
  assert.ok(r.saldo_bip_pct > -3.5 && r.saldo_bip_pct < -1.5,
    `Saldo ${r.saldo_bip_pct.toFixed(2)} % BIP (Destatis 2024: −2,7 %)`);
});

test('ESt-Aufkommen in amtlicher Größenordnung (~350 Mrd. inkl. Kapitalerträge)', () => {
  imBand(r.rev.est, 350, 0.15, 'ESt');
});

test('MwSt-Aufkommen in amtlicher Größenordnung (~290 Mrd., USt+EUSt)', () => {
  imBand(r.rev.mwst, 290, 0.15, 'MwSt');
});

test('Erbschaftsteuer in amtlicher Größenordnung (~12 Mrd.)', () => {
  imBand(r.rev.erbschaft, 12, 0.25, 'ErbSt');
});

test('Sozialversicherung: RV-/KV-Beiträge in amtlicher Größenordnung', () => {
  imBand(r.rev.rv, 290, 0.35, 'RV-Beiträge (DRV 2024)');
  imBand(r.rev.kv, 270, 0.35, 'GKV-Beiträge (BAS 2024)');
});

test('KSt + GewSt in amtlicher Größenordnung', () => {
  imBand(r.rev.kst + r.rev.gewst, 120, 0.35, 'KSt+GewSt (BMF 2024: ~44+75 Mrd.)');
});

test('CO₂-Bepreisung brutto in amtlicher Größenordnung (~18 Mrd., BEHG+ETS)', () => {
  imBand(r.rev.co2 + r.klimageld_auszahlung, 18, 0.35, 'CO₂ brutto');
});
