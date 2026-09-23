// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// TESTS · Dimensionen und Konsistenz der Fiskalindikatoren
//
// Die Fachpruefung vom 12.09.2026 (entwurf/PRUEFUNG.md) fand zwei Fehler,
// die keiner der 70 bestehenden Tests fangen konnte, weil alle nur auf
// Groessenordnungen mit weiten Toleranzen pruefen:
//
//   A1  Zinslast einmal zu oft durch 100 geteilt — Primaersaldo, Domar-Ziel
//       und S2-Luecke waren um Faktor 100 verrutscht
//   A4  zwei verschiedene Zinssaetze in zwei Modulen
//
// Diese Datei prueft nicht, ob eine Zahl ungefaehr stimmt, sondern ob sie
// die richtige EINHEIT und das richtige VORZEICHEN hat. Solche Tests haetten
// beide Fehler sofort gefunden.
// ═══════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { berechneAbgeleitet, GGI_SCHULD_REF, GGI_SCHULD_KRIT } from '../js/rechner/abgeleitet.js';
import { simulierePfad, ZINS_SCHULDEN, BIP_WACHSTUM_NOMINAL } from '../js/rechner/transition.js';
import { PRESETS, ZINS_EFFEKTIV, BIP_WACHSTUM_NOMINAL_JAHR, PERIOD_STATE_0, STAATSAUSGABEN } from '../js/data.js';

const pfad = simulierePfad(Array.from({ length: 5 }, () => ({ ...PRESETS.status_quo })));
const erste = pfad[0];

// ── Einheiten ────────────────────────────────────────────────────────────────

test('Zinslast liegt in Prozentpunkten des BIP, nicht in Anteilen', () => {
  const a = berechneAbgeleitet(erste.result, erste.zustand);
  const zinslast = a.ps_t - erste.result.saldo_bip_pct;
  const erwartet = ZINS_EFFEKTIV * erste.zustand.schuldenquote;   // z. B. 0,02 × 63,5 = 1,27
  assert.ok(Math.abs(zinslast - erwartet) < 1e-9,
    `Zinslast ${zinslast.toFixed(4)} statt ${erwartet.toFixed(4)} Prozentpunkte — ` +
    'vermutlich eine Division durch 100 zu viel oder zu wenig.');
  assert.ok(zinslast > 0.5 && zinslast < 5,
    `Zinslast ${zinslast.toFixed(4)} % BIP ist keine plausible Groesse fuer einen Staat.`);
});

test('Primaersaldo unterscheidet sich sichtbar vom Gesamtsaldo', () => {
  // Genau darin liegt der Sinn der Kennzahl. Sind beide praktisch gleich,
  // stimmt die Skalierung der Zinslast nicht.
  const a = berechneAbgeleitet(erste.result, erste.zustand);
  const abstand = Math.abs(a.ps_t - erste.result.saldo_bip_pct);
  assert.ok(abstand > 0.5,
    `Primaersaldo (${a.ps_t.toFixed(3)}) und Gesamtsaldo ` +
    `(${erste.result.saldo_bip_pct.toFixed(3)}) liegen nur ${abstand.toFixed(3)} ` +
    'Prozentpunkte auseinander — die Zinslast kommt nicht an.');
});

test('Domar-Ziel hat dieselbe Groessenordnung wie der Primaersaldo', () => {
  for (const e of pfad) {
    const a = berechneAbgeleitet(e.result, e.zustand);
    const erwartet = (ZINS_EFFEKTIV - BIP_WACHSTUM_NOMINAL_JAHR) * e.zustand.schuldenquote;
    assert.ok(Math.abs(a.ps_star - erwartet) < 1e-9,
      `${e.label}: ps* ${a.ps_star} statt ${erwartet}`);
    // S2 = Primaersaldo minus Ziel — muss sich aus beiden ergeben
    assert.ok(Math.abs(a.s2 - (a.ps_t - a.ps_star)) < 1e-9, `${e.label}: S2 inkonsistent`);
  }
});

// ── Konsistenz zwischen den Modulen ─────────────────────────────────────────

test('Haushalt und Schuldenfortschreibung rechnen mit demselben Zinssatz', () => {
  assert.equal(ZINS_SCHULDEN, ZINS_EFFEKTIV,
    'transition.js und data.js muessen denselben Effektivzins verwenden.');

  // Und die verbuchte Zinsausgabe muss zu diesem Satz passen
  const schuldenstand = erste.zustand.schuldenquote / 100 * erste.zustand.bip;
  const implizit = erste.result.zinsen_dyn / schuldenstand;
  assert.ok(Math.abs(implizit - ZINS_EFFEKTIV) < 1e-6,
    `Der Haushalt verbucht ${(implizit * 100).toFixed(2)} % Zinsen, die Schulden ` +
    `wachsen mit ${(ZINS_EFFEKTIV * 100).toFixed(2)} %. Die Differenz erhoehte ` +
    'frueher die Schuldenquote, ohne im Saldo aufzutauchen.');
});

test('die Zinsausgabe im Datensatz passt zum Effektivzins', () => {
  const schuldenstand = PERIOD_STATE_0.schuldenquote / 100 * PERIOD_STATE_0.bip;
  const erwartet = ZINS_EFFEKTIV * schuldenstand;
  assert.ok(Math.abs(STAATSAUSGABEN.zinsen - erwartet) / erwartet < 0.10,
    `STAATSAUSGABEN.zinsen (${STAATSAUSGABEN.zinsen}) weicht mehr als 10 % von ` +
    `Zins × Schuldenstand (${erwartet.toFixed(0)}) ab.`);
});

test('Zinsen werden in der Schuldenfortschreibung nicht doppelt gezaehlt', () => {
  // Nachrechnen der Lehrbuchformel D(t+1) = D(t)(1+r) − PB, jahresweise.
  const n = 4;
  const d0 = erste.zustand.schuldenquote / 100 * erste.zustand.bip;
  const primaer = erste.result.saldo + erste.result.zinsen_dyn;
  let erwartet = d0;
  for (let j = 0; j < n; j++) erwartet = erwartet * (1 + ZINS_EFFEKTIV) - primaer;

  const ist = pfad[1].zustand.schuldenquote / 100 * pfad[1].zustand.bip;
  assert.ok(Math.abs(ist - erwartet) < 1,
    `Schuldenstand nach Periode 1: ${ist.toFixed(1)} Mrd., Lehrbuchformel ergibt ` +
    `${erwartet.toFixed(1)} Mrd. Differenz deutet auf doppelt gezaehlte Zinsen.`);
});

// ── Indikatoren muessen im Spielbereich etwas messen ────────────────────────

test('der GGI-Schuldenteil reagiert ueber den ganzen Spielbereich', () => {
  const werte = pfad.map(e => berechneAbgeleitet(e.result, e.zustand).ggi_schuld);
  const spanne = Math.max(...werte) - Math.min(...werte);
  assert.ok(spanne > 0.02,
    `ggi_schuld bewegt sich ueber fuenf Perioden nur um ${spanne.toFixed(4)} ` +
    `(${werte.map(v => v.toFixed(3)).join(', ')}). Ein Index, der am Anschlag ` +
    'klebt, misst nichts.');
  assert.ok(GGI_SCHULD_KRIT > GGI_SCHULD_REF, 'Der kritische Wert muss ueber der Referenz liegen.');
});

test('das Spiel ist nicht vorentschieden: der Status quo explodiert nicht', () => {
  // Bei r < g darf die Schuldenquote im Status quo zwar steigen, aber nicht
  // ausser Kontrolle geraten — sonst ist jede Politik der Teams folgenlos.
  const letzte = pfad[pfad.length - 1].zustand.schuldenquote;
  assert.ok(letzte < 110,
    `Die Schuldenquote erreicht ohne jedes Zutun ${letzte.toFixed(1)} %. ` +
    'Dann dominiert die Baseline jede Entscheidung der Teams.');
  assert.ok(ZINS_EFFEKTIV < BIP_WACHSTUM_NOMINAL,
    'r > g ist eine Annahme mit grosser Wirkung und gehoert ausdruecklich begruendet ' +
    '(siehe entwurf/PRUEFUNG.md F1), nicht stillschweigend gesetzt.');
});
