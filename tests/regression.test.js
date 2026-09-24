// SPDX-License-Identifier: CC-BY-4.0
// Regressionstest: Status-quo-Pfad über 5 Perioden
//
// Zweck: Künftige Änderungen an Engine oder Datenbasis dürfen die Ergebnisse
// nicht unbemerkt verschieben. Wer Modellparameter bewusst ändert, muss die
// Referenzwerte hier aktualisieren und die Änderung im Commit begründen.
//
// Referenzwerte erneuert am 2026-09-12 nach der Fachprüfung
// (entwurf/PRUEFUNG.md). Bewusst geänderte Modellparameter:
//   • Effektivzins einheitlich 2,0 % in Haushalt UND Schuldenfortschreibung
//     (vorher 1,06 % gegen 2,50 % — PRUEFUNG.md A4)
//   • Zinsausgaben gesamtstaatlich 54 statt 30 Mrd. (nur Bund)
//   • nominales BIP-Wachstum 2,5 % statt 1,5 % (PRUEFUNG.md F1)
//   • Schuldenfortschreibung mit Primärsaldo statt Gesamtsaldo,
//     jahresweise — keine Zinsdoppelzählung mehr (PRUEFUNG.md A5)
//   • Gegenposten sonstige_einnahmen −144 statt −120 Mrd.
//
// Sichtbarste Folge: Die Schuldenquote steigt über fünf Perioden auf 84,9 %
// statt auf 130,4 %. Vorher war r > g fest verdrahtet und jede Partie endete
// in der Schuldenexplosion, unabhängig von den Entscheidungen der Teams.
//
// Erneuert am 2026-09-24: Gini und Palma rechnen auf Äquivalenzeinkommen
// (Netto / Bedarfsgewicht, wie EU-SILC). Gini 0,3766 → 0,3034, amtlich ~0,295
// (PRUEFUNG.md B3). Alle übrigen Werte unverändert.
//
// Erneuert am 2026-09-24, nominale Fortschreibung (PRUEFUNG-2.md I.2):
// Einnahmen wachsen mit dem BIP der Periode, Ausgaben mit dem nominalen Trend.
// Vorher blieben ESt, MwSt, Beiträge und Ausgaben 20 Jahre auf dem Stand von
// 2025. Schuldenquote 2041: 84,9 % → 98,5 %. Treiber: Demografie (+2,3 Pp.
// Primärdefizit, bisher im schrumpfenden Nenner versteckt) und der Klimaschaden
// (BIP 3,9 % unter Trend, Befund A2 — mit dessen Korrektur ändert sich das wieder).

import test from 'node:test';
import assert from 'node:assert/strict';
import { simulierePfad } from '../js/rechner/transition.js';
import { PRESETS } from '../js/data.js';

const REFERENZ = [
  { label: '2025–2028', saldo: -118.6396, schuldenquote: 63.5,    gini: 0.3034, emissionen: 327, bip: 4470 },
  { label: '2029–2032', saldo: -160.1891, schuldenquote: 67.3979, gini: 0.3034, emissionen: 327, bip: 4937.004 },
  { label: '2033–2036', saldo: -231.3174, schuldenquote: 73.5244, gini: 0.3034, emissionen: 327, bip: 5423.6073 },
  { label: '2037–2040', saldo: -325.5687, schuldenquote: 83.5718, gini: 0.3034, emissionen: 327, bip: 5912.3686 },
  { label: '2041–2044', saldo: -459.1436, schuldenquote: 98.4744, gini: 0.3034, emissionen: 327, bip: 6380.2732 },
];

test('Status-quo-Pfad (5 Perioden) reproduziert die Referenzwerte', () => {
  const pfad = simulierePfad(Array.from({ length: 5 }, () => ({ ...PRESETS.status_quo })));
  assert.equal(pfad.length, REFERENZ.length);

  for (let i = 0; i < REFERENZ.length; i++) {
    const ref = REFERENZ[i];
    const e = pfad[i];
    assert.equal(e.label, ref.label);
    const nah = (ist, soll, name) =>
      assert.ok(Math.abs(ist - soll) < 5e-4 * Math.max(1, Math.abs(soll)),
        `${ref.label} ${name}: ist ${ist}, Referenz ${soll}`);
    nah(e.result.saldo, ref.saldo, 'Saldo');
    nah(e.zustand.schuldenquote, ref.schuldenquote, 'Schuldenquote');
    nah(e.result.gini, ref.gini, 'Gini');
    nah(e.result.emissionen, ref.emissionen, 'Emissionen');
    nah(e.zustand.bip, ref.bip, 'BIP');
  }
});

test('Status-quo-Pfad ist deterministisch (zwei Läufe identisch)', () => {
  const a = simulierePfad(Array.from({ length: 5 }, () => ({ ...PRESETS.status_quo })));
  const b = simulierePfad(Array.from({ length: 5 }, () => ({ ...PRESETS.status_quo })));
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].result.saldo, b[i].result.saldo);
    assert.equal(a[i].zustand.bip, b[i].zustand.bip);
  }
});
