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
import { PRESETS, DEZILE } from '../js/data.js';

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

test('KSt und GewSt jeweils für sich in amtlicher Größenordnung', () => {
  // Früher nur als Summe geprüft (±35 %): KSt +34 % und GewSt −25 % hoben sich auf
  // (PRUEFUNG.md C1, D). Jetzt getrennte Bemessungsgrundlagen.
  imBand(r.rev.kst,   45, 0.10, 'KSt (BMF 2024)');
  imBand(r.rev.gewst, 75, 0.10, 'GewSt (Destatis 2024)');
});

test('Die Abschaffung kleiner Verbrauchsteuern spart kaum Erhebungskosten', () => {
  // Vorher 20 % Erhebungskosten: 22 Mrd. Ersparnis, ein Geschenk an den Kirchhof-Pfad (PRUEFUNG-2.md II)
  const ohne = berechne({ ...PRESETS.status_quo, kleine_st: false });
  const ersparnis = r.admin_kosten - ohne.admin_kosten;
  assert.ok(ersparnis > 0 && ersparnis < 5, `Ersparnis ${ersparnis.toFixed(1)} Mrd. €`);
});

test('Das Vermögen steigt über die Einkommensdezile', () => {
  for (let i = 1; i < DEZILE.length; i++) {
    assert.ok(DEZILE[i].vermoegen > DEZILE[i - 1].vermoegen, `${DEZILE[i].label} unter ${DEZILE[i - 1].label}`);
  }
});

test('CO₂-Bepreisung brutto in amtlicher Größenordnung (~18 Mrd., BEHG+ETS)', () => {
  imBand(r.rev.co2 + r.klimageld_auszahlung, 18, 0.35, 'CO₂ brutto');
});

// Ungleichheit gegen EU-SILC. Die Fachprüfung (PRUEFUNG.md B3) fand 0,377, weil
// der Gini auf Haushaltsnetto ohne Bedarfsgewichtung rechnete — höher als jede
// Feedback-Schwelle, sodass jede Politik „stark zunehmende Ungleichheit" hieß.
// Ein Test gegen die Wirklichkeit hätte das sofort gezeigt.

test('Gini Status quo in der Größenordnung von EU-SILC (DE ~0,295)', () => {
  assert.ok(r.gini > 0.27 && r.gini < 0.32,
    `Gini ${r.gini.toFixed(3)} außerhalb 0,27–0,32 (EU-SILC DE: 0,295)`);
});

test('Palma Status quo in der Größenordnung des Lehrbuchwerts (DE ~1,2)', () => {
  assert.ok(r.palma > 1.0 && r.palma < 1.5,
    `Palma ${r.palma.toFixed(2)} außerhalb 1,0–1,5 (DE: ~1,2)`);
});

test('Spitzensatz 45 → 55 % bringt einstellige Milliarden, nicht 37 Mrd. (PRUEFUNG-2.md II)', () => {
  // Die Prüfung schätzt real 5–8 Mrd. statisch; das Modell rechnet mit Verhaltensreaktion.
  // Vorher 36,7 Mrd., weil der Regler die 42-%-Zone mit anhob.
  const mehr = berechne({ ...PRESETS.status_quo, spitze: 55 }).rev.est - r.rev.est;
  assert.ok(mehr > 2 && mehr < 8, `Mehraufkommen ${mehr.toFixed(1)} Mrd. €`);
});

// ── Quellenarbeit (PRUEFUNG-2.md IV) ────────────────────────────────────────

test('Zucman: Mindeststeuer auf Milliardäre mit Anrechnung, nicht Pauschalsteuer auf das oberste Prozent', () => {
  const z = berechne({ ...PRESETS.status_quo, zucman: 2 });
  assert.ok(z.rev.zucman > 3 && z.rev.zucman < 20, `Zucman 2 %: ${z.rev.zucman.toFixed(1)} Mrd. € (vorher 48,8)`);
  const mitVerm = berechne({ ...PRESETS.status_quo, zucman: 2, verm: 1 });
  assert.ok(mitVerm.rev.zucman < z.rev.zucman, 'eine Vermögensteuer wird angerechnet');
});

test('Vermögensteuer: Ausweichreaktion — doppelter Satz bringt weniger als doppeltes Aufkommen', () => {
  const eins = berechne({ ...PRESETS.status_quo, verm: 1 }).rev.vermoegen;
  const zwei = berechne({ ...PRESETS.status_quo, verm: 2 }).rev.vermoegen;
  assert.ok(zwei > eins && zwei < 2 * eins * 0.9, `1 %: ${eins.toFixed(1)}, 2 %: ${zwei.toFixed(1)} Mrd. €`);
});

test('Armutsziele liegen in einer Größenordnung, die reale Länder erreichen (≥ 10 %)', async () => {
  const { CHALLENGES } = await import('../js/data.js');
  for (const c of CHALLENGES) for (const s of c.subs) {
    if (/Armut/.test(s.label)) assert.ok(s.tgt >= 10, `${c.id}: Ziel ${s.tgt} %`);
  }
});
