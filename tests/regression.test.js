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
//
// Erneuert am 2026-09-24, Klima (PRUEFUNG-2.md I.5): kein Klimaschaden aus deutschen
// Emissionen mehr (BIP 2041 6.380 → 6.652 = Trend), Emissionen alle Treibhausgase
// entlang des UBA-Pfads (649 → 238 Mt) statt konstant 327 Mt. Schuldenquote 2041:
// 98,5 % → 91,7 %. Der Gini steigt leicht (0,3034 → 0,3054), weil das Klimageld mit den
// bepreisten Emissionen sinkt.
//
// Erneuert am 2026-09-25, Haushalt = Staat (PRUEFUNG-2.md I.4, N1): Kindergeld auf
// 17 Mio. Kinder, CO₂-Last = Aufkommen, Bürgergeld-Regelbedarf über die Haushalte
// gebucht, Unterkunft/Mehrbedarfe (10,8 Mrd.) fest und bei den Haushalten. Gini
// 0,3034 → 0,3101: das überzeichnete Kindergeld hatte ihn gedrückt. Saldo 2025
// −118,6 → −118,1 (keine Erhebungskosten auf den festen Grundsicherungsposten).
//
// Erneuert am 2026-09-25, Rechtsstand 2026 (docs/RECHTSSTAND.md): Tarif § 32a 2026,
// KV 17,5 % mit entsprechend höheren GKV-Ausgaben, BBG 101.400 / 69.750 €, kein
// Klimageld im Status quo (die CO₂-Einnahmen fließen in den Klimafonds). Saldo 2025
// −118,1 → −122,4: weniger MwSt (höhere Beiträge senken den Konsum, −2,8 Mrd.) und
// ESt (Tarif 2026, −1,3 Mrd.). Gini 0,3101 → 0,3119 (kein Klimageld mehr).
//
// Erneuert am 2026-09-25, Tarif entkoppelt (PRUEFUNG.md B1/B2): Spitzensatz und Grenze
// wirken nur auf die oberste Zone; D10c mit Pareto-Rand (α = 1,5), sodass die
// Reichensteuer überhaupt jemanden trifft (+1,2 Mrd. ESt im Status quo). Saldo 2025
// −122,4 → −121,2.
//
// Erneuert am 2026-09-25, Struktur (PRUEFUNG.md C1/C3, PRUEFUNG-2.md II/IV): allgemeine
// Verwaltung bleibt, nur Änderungen der Erhebungskosten zählen; Verbrauchsteuern 2 % statt
// 20 % Erhebungskosten; KSt/GewSt mit getrennten Basen; Ausgleichsposten −144 → −221,4
// (hält den Status-quo-Saldo). Spätere Perioden verschieben sich leicht (Erhebungskosten
// jetzt in Größen von 2025).

import test from 'node:test';
import assert from 'node:assert/strict';
import { simulierePfad } from '../js/rechner/transition.js';
import { PRESETS } from '../js/data.js';

const REFERENZ = [
  { label: '2025–2028', saldo: -121.232,  schuldenquote: 63.5,    gini: 0.3115, emissionen: 649,     bip: 4470 },
  { label: '2029–2032', saldo: -163.9176, schuldenquote: 67.6143, gini: 0.3112, emissionen: 500.392, bip: 4937.004 },
  { label: '2033–2036', saldo: -225.2687, schuldenquote: 73.6085, gini: 0.311,  emissionen: 399.388, bip: 5452.7984 },
  { label: '2037–2040', saldo: -289.9065, schuldenquote: 82.0624, gini: 0.3108, emissionen: 314.252, bip: 6022.4805 },
  { label: '2041–2044', saldo: -361.9836, schuldenquote: 92.2635, gini: 0.3107, emissionen: 237.88,  bip: 6651.6802 },
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
