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

// Verbleibendes deutsches CO₂-Budget für 1,5°C-Pfad ab 2025 (Mt CO₂e)
// Basis: IPCC AR6 globales Budget 400 Gt CO₂ · DE-Anteil ~1,65 % (Bevölkerungsgewicht)
// Quelle: SRU (2022) Wege zur Treibhausgasneutralität · IPCC AR6 SPM C.1.2
const CO2_BUDGET_DE = 6600; // Mt CO₂e

// GGI-Schulden-Schwellwert: 60 % BIP (Maastricht-Referenzwert)
const GGI_SCHULD_REF = 60;

function berechneAbgeleitet(result, zustand) {
  const D_t = zustand.schuldenquote;

  // ── Primärsaldo (Domar-Berechnung) ───────────────────────────────────
  // Zinslast = Effektivzins × Schuldenstand / BIP (als % BIP)
  const zinslast_bip = ZINS_SCHULDEN * D_t / 100;
  // Primärsaldo = Gesamtsaldo + Zinslast (beide als % BIP)
  const ps_t = result.saldo_bip_pct + zinslast_bip;

  // ── Domar r-g Bedingung ───────────────────────────────────────────────
  // r − g < 0: Schulden stabilisieren sich ohne Primärüberschuss (Blanchard 2019)
  const r_minus_g = ZINS_SCHULDEN - BIP_WACHSTUM_NOMINAL;

  // Notwendiger Primärüberschuss für D_t-Stabilisierung (% BIP)
  // ps* = (r − g) × D_t / 100
  const ps_star = r_minus_g * D_t / 100;

  // ── S2-Tragfähigkeitslücke (Blanchard-Lücke) ─────────────────────────
  // S2 > 0: tragfähig; S2 < 0: fiskalische Anpassung erforderlich
  const s2 = ps_t - ps_star;

  // ── Generationengerechtigkeit-Index (GGI) ────────────────────────────
  // GGI = 0,5 × Schuldenkomponente + 0,5 × CO₂-Komponente
  // Beide normiert auf [0,1]: 0 = kein Risiko, 1 = vollständige Grenze überschritten
  const ggi_schuld = Math.min(1, Math.max(0, D_t / GGI_SCHULD_REF)) * 0.5;
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

export { berechneAbgeleitet, CO2_BUDGET_DE, GGI_SCHULD_REF };
