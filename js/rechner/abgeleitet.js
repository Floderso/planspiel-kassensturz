// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Abgeleitete Fiskal- und Klimaindikatoren
// ═══════════════════════════════════════════════════════
//
// berechneAbgeleitet(result, zustand) → AbgeleiteteIndikatoren
//
// Indikatoren:
//   ps_t          Primärsaldo (% BIP) = Saldo + Zinslast
//   ps_star       Primärsaldo-Ziel für Schuldenstabilisierung (Domar-Bedingung)
//   r_minus_g     r − g (Zinssatz minus BIP-Wachstum)
//   s2            Blanchard S2-Lücke (ps_t − ps_star); negativ = nicht tragfähig
//   ggi           Generationengerechtigkeit-Index [0,1]: 0 = optimal
//   ggi_schuld    GGI-Schulden-Teilindex
//   ggi_co2       GGI-Klima-Teilindex
//   co2_budget_rest  Verbleibendes DE 1,5°C-Budget (Mt CO₂e)
//   mu_hank       HANK-Multiplikator der letzten Periode (aus prevResult)
//
// Quellen:
//   Domar (1944) Rev.Econ.Stat. · Blanchard (2019) AEA Presidential Address
//   IPCC AR6 WG3 Ch.3 · SRU (2022) Wege zur ressourcenschonenden Treibhausgasneutralität
//   IMF Fiscal Monitor 2024 · SVR Jahresgutachten 2024/25

import { ZINS_SCHULDEN, BIP_WACHSTUM_NOMINAL, hankMultiplikator } from './transition.js';

// Verbleibendes deutsches CO₂-Budget für 1,7 °C ab Anfang 2025 (Mt)
// Globales Restbudget 525 Gt CO₂ für 1,7 °C (50 %), Forster et al. (2026) Indicators of
// Global Climate Change 2025, ESSD 18, 3889 · deutscher Bevölkerungsanteil 1,025 %
// (83,6 Mio. von 8,16 Mrd., UN WPP 2024) → 5.380 Mt. Für 1,5 °C blieben nur 130 Gt
// (DE ~1,3 Gt, in rund zwei Jahren verbraucht, in jeder Politik — unterscheidet nicht).
// Vereinfachung: Budget in CO₂, verbraucht wird mit allen Treibhausgasen (CO₂e).
// Vorher 6.600 Mt für 1,5 °C nach IPCC AR6 — überholt (PRUEFUNG-2.md I.5).
const CO2_BUDGET_DE = 5380; // Mt

// GGI-Schuldenkomponente: Skala von der Maastricht-Grenze bis zum kritischen Bereich.
// Vorher war die Referenz allein 60 % — weil die Quote schon bei 63,5 % startet,
// stand der Teilindex ab Periode 1 am Anschlag und blieb dort, während die Quote
// auf 130 % stieg. Er maß im gesamten Spielbereich nichts (PRUEFUNG.md B4).
// Jetzt: 60 % = kein Risiko, 150 % = voll ausgereizt, linear dazwischen.
const GGI_SCHULD_REF  = 60;    // Maastricht-Referenzwert (Art. 126 AEUV)
const GGI_SCHULD_KRIT = 150;   // Bereich, ab dem die Tragfähigkeit als erschöpft gilt

function berechneAbgeleitet(result, zustand) {
  const D_t = zustand.schuldenquote;

  // ── Primärsaldo (Domar-Berechnung) ───────────────────────────────────
  // ALLE Größen hier in PROZENTPUNKTEN des BIP — D_t kommt bereits in Prozent.
  // Vorher stand hier "× D_t / 100", eine Division zu viel: Die Zinslast kam mit
  // 0,016 statt 1,59 Prozentpunkten an, und Primärsaldo, Domar-Ziel und S2-Lücke
  // waren allesamt um Faktor 100 verrutscht (PRUEFUNG.md A1).
  const zinslast_bip = ZINS_SCHULDEN * D_t;
  // Primärsaldo = Gesamtsaldo + Zinslast (beide als % BIP)
  const ps_t = result.saldo_bip_pct + zinslast_bip;

  // ── Domar r-g Bedingung ───────────────────────────────────────────────
  // r − g < 0: Schulden stabilisieren sich ohne Primärüberschuss (Blanchard 2019)
  const r_minus_g = ZINS_SCHULDEN - BIP_WACHSTUM_NOMINAL;

  // Notwendiger Primärüberschuss für D_t-Stabilisierung (Prozentpunkte BIP)
  // ps* = (r − g) × D_t      — D_t steht schon in Prozent
  const ps_star = r_minus_g * D_t;

  // ── S2-Tragfähigkeitslücke (Blanchard-Lücke) ─────────────────────────
  // S2 > 0: tragfähig; S2 < 0: fiskalische Anpassung erforderlich
  const s2 = ps_t - ps_star;

  // ── Generationengerechtigkeit-Index (GGI) ────────────────────────────
  // GGI = 0,5 × Schuldenkomponente + 0,5 × CO₂-Komponente
  // Beide normiert auf [0,1]: 0 = kein Risiko, 1 = vollständige Grenze überschritten
  const ggi_schuld = Math.min(1, Math.max(0,
    (D_t - GGI_SCHULD_REF) / (GGI_SCHULD_KRIT - GGI_SCHULD_REF))) * 0.5;
  const ggi_co2    = Math.min(1, Math.max(0, zustand.co2_kumulat / CO2_BUDGET_DE)) * 0.5;
  const ggi        = ggi_schuld + ggi_co2;

  const co2_budget_rest = Math.max(0, CO2_BUDGET_DE - zustand.co2_kumulat);

  // ── HANK-Multiplikator ────────────────────────────────────────────────
  const mu_hank = hankMultiplikator(result.hh_delta);

  return {
    D_t,
    ps_t,
    ps_star,
    r_minus_g,
    s2,
    ggi,
    ggi_schuld,
    ggi_co2,
    co2_budget_rest,
    mu_hank,
  };
}

export { berechneAbgeleitet, CO2_BUDGET_DE, GGI_SCHULD_REF, GGI_SCHULD_KRIT };
