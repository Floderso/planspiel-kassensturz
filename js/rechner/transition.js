// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Multi-Perioden-Simulation — Übergangsfunktionen
// ═══════════════════════════════════════════════════════
//
// berechneTransition(prevState, prevResult, nextStartJahr, n) → PeriodState
//   Leitet den Anfangszustand der nächsten Periode (n Jahre) ab: Trend,
//   private Investitionen, Arbeitsangebot und öffentlicher Kapitalstock.
//   Die Nachfrage wirkt nur innerhalb einer Periode (berechne.js, 10a).
//   Einen Klimaschaden aus deutschen Emissionen gibt es bewusst nicht (s. u.).
//
// simulierePfad(perioden_params, kursKonfig?) → ErgebnisPfad[]
//   Iteriert alle Perioden, gibt Zeitreihe zurück.
//   kursKonfig optional — Default: KURS_KONFIG_DEFAULT (n=4, 5 Perioden).
//   Backward-kompatibel: simulierePfad(perioden_params) funktioniert unverändert.
//
// Quellen:
//   BIP-Wachstum:       BIP_WACHSTUM_NOMINAL_JAHR in data.js (2,5 % nominal, PRUEFUNG.md F1)
//   Multiplikatoren:    Gechert (2015) Oxford Economic Papers · Jappelli/Pistaferri (2014) AEJ: Macro
//   Öffentl. Kapital:   Bom/Ligthart (2014) J. of Economic Surveys · Wirtschaftsdienst 1/2019
//   Emissionspfad:      UBA Projektionsbericht 2025 · emissionsBasis() in data.js
//   Zinssatz:           Bundesbank DP 28/2018 · BMF Finanzplan 2025–2029
//   Demografie:         Destatis 14. Bev.-Vorausberechnung 2021 · DEMOGRAFIE_KURVE in data.js

import { DEZILE, DEMOGRAFIE_KURVE, PERIOD_STATE_0, KURS_KONFIG_DEFAULT, PRESETS,
         ZINS_EFFEKTIV, BIP_WACHSTUM_NOMINAL_JAHR, emissionsBasis,
         MPC_DEZIL, MPC_MITTEL, MULTIPLIKATOR_STEUER_TRANSFER,
         OEFF_KAPITAL_ELASTIZITAET, OEFF_KAPITALSTOCK, OEFF_ABSCHREIBUNG } from '../data.js';
import { berechne } from './berechne.js';

// Zins und Wachstum kommen aus data.js — EINE Quelle für alle Module.
// Vorher standen hier eigene Werte, die denen in berechne.js widersprachen.
const BIP_WACHSTUM_NOMINAL = BIP_WACHSTUM_NOMINAL_JAHR;
const ZINS_SCHULDEN        = ZINS_EFFEKTIV;

// Lookup DEMOGRAFIE_KURVE nach Startjahr — clamped an Randbereichen
function getDemoForYear(jahr) {
  const idx = Math.min(Math.max(0, jahr - 2025), DEMOGRAFIE_KURVE.length - 1);
  return DEMOGRAFIE_KURVE[idx];
}

// Konsummultiplikator einer Einkommensänderung: MPC-gewichtet über die Dezile, die gewinnen,
// skaliert auf den Steuer-/Transfermultiplikator bei mittlerer MPC. Nur für die Anzeige
// (abgeleitet.js); gerechnet wird die Nachfrage in berechne.js, Abschnitt 10a.
function konsumMultiplikator(hh_delta) {
  if (!hh_delta?.delta) return MULTIPLIKATOR_STEUER_TRANSFER;
  const gewichte = hh_delta.delta.map((d, i) => Math.max(0, d * DEZILE[i].anzahl));
  const summe = gewichte.reduce((a, g) => a + g, 0);
  if (summe < 1e-6) return MULTIPLIKATOR_STEUER_TRANSFER;
  const mpc = gewichte.reduce((a, g, i) => a + g / summe * MPC_DEZIL[i], 0);
  return MULTIPLIKATOR_STEUER_TRANSFER * mpc / MPC_MITTEL;
}

// Wirkung des zusätzlichen öffentlichen Kapitals auf das Potenzial
const kapitalFaktor = k => 1 + OEFF_KAPITAL_ELASTIZITAET * k / OEFF_KAPITALSTOCK;

// Kein Klimaschaden aus deutschen Emissionen. Bis 24.09.2026 erwärmten deutsche
// Emissionen im Modell die Erde (Klimasensitivität 1.100-fach zu hoch, PRUEFUNG.md A2),
// und Deutschland trug den Schaden allein: ein CO₂-Preis von 250 €/t brachte +2,9 % BIP.
// Deutschland verursacht rund 1,5 % der Weltemissionen; der Rückkanal auf das eigene BIP
// ist vernachlässigbar (PRUEFUNG-2.md I.5). Das Klimaziel steht über Emissionen und
// CO₂-Budget im Spiel, nicht über das BIP.

// Wendet einen Schock auf eine Kopie von zustand an (nicht-destruktiv).
// Gerechnet werden bip_malus, schuld_bonus und zins_bonus. invest_malus und
// co2_reduktion stehen in SCHOCK_BIBLIOTHEK, wirken hier aber NICHT — wer sie
// anzeigt, muss das dazusagen (schockWirkung() in js/spielkern.js tut es).
function applySchock(zustand, schock) {
  if (!schock) return zustand;
  const s = { ...zustand };
  const eff = schock.effekte || {};
  if (eff.bip_malus)    s.bip             = s.bip * (1 - eff.bip_malus);
  if (eff.schuld_bonus) s.schuldenquote   = s.schuldenquote + eff.schuld_bonus;
  if (eff.zins_bonus)   s._zins_bonus     = (s._zins_bonus || 0) + eff.zins_bonus;
  return s;
}

function berechneTransition(prevState, prevResult, nextStartJahr, n) {
  const demo = getDemoForYear(nextStartJahr);

  // ── BIP ──────────────────────────────────────────────────────────────
  const wachstum_basis      = Math.pow(1 + BIP_WACHSTUM_NOMINAL, n);
  const invest_privat_bonus = 1 + (prevResult.investment_factor - 1) * 0.15;
  const labor_bonus         = 1 + (prevResult.avg_labor - 1) * 0.10;
  // Öffentliches Kapital: Zusatzinvestitionen gegenüber dem Status quo bauen einen Stock auf,
  // der abschreibt; er wirkt über die Produktionselastizität dauerhaft auf das Potenzial.
  // Vorher: 1 + I·n·μ/BIP als bleibender, kumulierender Niveaueffekt ohne Abschreibung —
  // 600 Mrd. über 12 Jahre ergaben +15 % BIP (PRUEFUNG-2.md I.3).
  // Sondervermögen Infrastruktur zählt mit: es ist öffentliche Investition (Rechtsstand 2026)
  const zusatz = (prevResult.invest_impuls ?? 0) - (PRESETS.status_quo.invest_impuls || 0)
               + (prevResult.sondervermoegen_real ?? 0);
  let kapital_next = prevState.oeff_kapital ?? 0;
  for (let j = 0; j < n; j++) kapital_next = kapital_next * (1 - OEFF_ABSCHREIBUNG) + zusatz;
  const kapital_bonus = kapitalFaktor(kapital_next) / kapitalFaktor(prevState.oeff_kapital ?? 0);
  const bip_next = prevState.bip * wachstum_basis * invest_privat_bonus
                   * labor_bonus * kapital_bonus;

  // ── SCHULDENQUOTE ─────────────────────────────────────────────────────
  // Lehrbuchform der Schuldendynamik, jahresweise:
  //     D(t+1) = D(t) × (1 + r) − PB
  // mit PB = PRIMÄRsaldo. Entscheidend ist, dass hier der Primärsaldo steht
  // und nicht der Gesamtsaldo: Der Gesamtsaldo enthält die Zinsausgabe bereits,
  // sie würde über (1 + r) ein zweites Mal anfallen (PRUEFUNG.md A5).
  const zins = ZINS_SCHULDEN + (prevState._zins_bonus || 0);
  const schuld_curr = prevState.schuldenquote / 100 * prevState.bip;
  const primaersaldo = prevResult.saldo + (prevResult.zinsen_dyn ?? 0);
  let schuld_next = schuld_curr;
  for (let jahr = 0; jahr < n; jahr++) {
    schuld_next = schuld_next * (1 + zins) - primaersaldo;
  }
  const schuldenquote_next = Math.max(0, schuld_next / bip_next * 100);

  // ── CO₂-KUMULAT ──────────────────────────────────────────────────────
  // Jahr für Jahr entlang des Basispfads, mit dem Politikeffekt der Periode
  const politik = prevResult.emissionen / prevResult.emissionen_basis;
  let co2_periode = 0;
  for (let j = 0; j < n; j++) co2_periode += emissionsBasis(nextStartJahr - n + j) * politik;
  const co2_kumulat_next = prevState.co2_kumulat + co2_periode;

  // ── ARBEITSMARKT-ZUSTANDSINDEX ────────────────────────────────────────
  // Mean-Reversion-Speed α skaliert mit Periodenlänge: länger → stärker
  const alpha_n = Math.min(0.30, 0.15 * n / 4);
  const lohnbasis_next = prevState.lohnbasis_faktor * (1 - alpha_n + alpha_n * prevResult.avg_labor);

  return {
    bip:              bip_next,
    schuldenquote:    schuldenquote_next,
    co2_kumulat:      co2_kumulat_next,
    lohnbasis_faktor: Math.max(0.70, Math.min(1.30, lohnbasis_next)),
    renten_faktor:    demo.renten_faktor,
    jahr:             nextStartJahr,
    oeff_kapital:     kapital_next,
    // Trend ohne Politik- und Klimaeffekte: daran wachsen die Ausgaben. Die
    // Einnahmen folgen dem tatsächlichen BIP (berechne.js, Abschnitt 10b).
    trend_faktor:     (prevState.trend_faktor ?? 1) * wachstum_basis,
  };
}

function simulierePfad(perioden_params, kursKonfig = KURS_KONFIG_DEFAULT) {
  const rawLaengen = kursKonfig.perioden_laenge_jahre ?? 4;
  const laengen    = Array.isArray(rawLaengen)
    ? rawLaengen
    : Array(perioden_params.length).fill(rawLaengen);
  const schocks = kursKonfig.schocks ?? [];

  let zustand   = { ...PERIOD_STATE_0, renten_faktor: getDemoForYear(2025).renten_faktor };
  const ergebnisse = [];
  let startJahr = 2025;

  for (let i = 0; i < perioden_params.length; i++) {
    const n = laengen[i] ?? 4;
    zustand.renten_faktor = getDemoForYear(startJahr).renten_faktor;
    zustand.jahr = startJahr;
    zustand.laenge = n;

    // Schock für diese Periode anwenden (falls vorhanden)
    const schock_i    = schocks.find(s => s.periode === i) ?? null;
    const zustand_eff = applySchock(zustand, schock_i);

    const result = berechne(perioden_params[i], zustand_eff);
    ergebnisse.push({
      periode:  i,
      jahr:     startJahr,
      label:    n === 1 ? `${startJahr}` : `${startJahr}–${startJahr + n - 1}`,
      schock:   schock_i,
      zustand:  { ...zustand },
      result,
    });

    if (i < perioden_params.length - 1) {
      zustand = berechneTransition(zustand_eff, result, startJahr + n, n);
    }
    startJahr += n;
  }

  return ergebnisse;
}

export { berechneTransition, simulierePfad, applySchock, getDemoForYear, konsumMultiplikator, ZINS_SCHULDEN, BIP_WACHSTUM_NOMINAL };
