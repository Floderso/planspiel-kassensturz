// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// Kassensturz · Planspiel — Regelbasiertes Feedback je Team

import { CO2_BUDGET_DE } from './rechner/abgeleitet.js';
import { berechne } from './rechner/berechne.js';
import { PRESETS } from './data.js';
import { erzeugeKausalketten } from './rechner/explainer.js';

// Gini des Status quo im Modell — Bezugspunkt für das Urteil zur Ungleichheit
const GINI_SQ = berechne(PRESETS.status_quo).gini;

export { erzeugeKausalketten };

/**
 * Erzeugt eine kurze Texteinschätzung anhand des letzten simulierePfad()-Eintrags.
 */
export function generiereTeamFeedback(lastEntry) {
  if (!lastEntry?.result || !lastEntry?.zustand) return '—';
  const r = lastEntry.result;
  const z = lastEntry.zustand;
  const parts = [];

  if (r.saldo_bip_pct >= 0)           parts.push('ausgeglichener Haushalt');
  else if (r.schuldenbremse_ok)        parts.push('Schuldenbremse eingehalten');
  else if (r.saldo_bip_pct >= -2)     parts.push('strukturelles Defizit');
  else                                 parts.push('kritisches Haushaltsdefizit');

  if (z.schuldenquote < 55)           parts.push('Schulden niedrig');
  else if (z.schuldenquote < 65)      parts.push('Schuldenquote stabil');
  else if (z.schuldenquote < 80)      parts.push('Schuldenquote erhöht');
  else                                 parts.push('kritische Schuldendynamik');

  // Gemessen am Status quo des Modells, nicht an festen Zahlen: „heute" ist der
  // Status quo (0,310; amtlich 0,295). Feste Schwellen kippten bei jeder
  // Kalibrierung — zuletzt als der Abgleich von Haushalts- und Staatsseite den
  // Gini von 0,303 auf 0,310 hob (PRUEFUNG.md B3, PRUEFUNG-2.md I.4). Die
  // Abstände entsprechen denen der früheren Schwellen um DE 0,295.
  const dg = r.gini - GINI_SQ;
  if (dg < -0.035)                    parts.push('sehr geringe Ungleichheit');
  else if (dg < -0.015)               parts.push('weniger Ungleichheit als heute');
  else if (dg <= 0.01)                parts.push('Ungleichheit etwa wie heute');
  else                                 parts.push('deutlich mehr Ungleichheit als heute');

  const restPct = (CO2_BUDGET_DE - z.co2_kumulat) / CO2_BUDGET_DE;
  if (restPct > 0.6)                  parts.push('Klimaziele eingehalten');
  else if (restPct > 0.25)            parts.push('CO₂-Budget noch im Rahmen');
  else if (restPct > 0)               parts.push('CO₂-Budget fast aufgebraucht');
  else                                 parts.push('Klimaziel deutlich verfehlt');

  return parts.join(' · ');
}

/**
 * Prüft welche Lernziele ein Team mit dem gegebenen KPI-Stand erreicht hat.
 */
export function bewerteLernziele(result, zustand, lernziele = []) {
  if (!lernziele?.length) return { erreicht: 0, total: 0, details: [] };
  const kpiMap = {
    saldo_bip_pct: result?.saldo_bip_pct,
    struktureller_saldo_pct: result?.struktureller_saldo_pct,
    schuldenquote: zustand?.schuldenquote,
    gini:          result?.gini,
    co2_kumulat:   zustand?.co2_kumulat,
    bip:           zustand?.bip,
  };
  let erreicht = 0;
  const details = lernziele.map(z => {
    const ist = kpiMap[z.kpi] ?? null;
    let ok = false;
    if (ist !== null) {
      if (z.operator === '<')  ok = ist <  z.wert;
      if (z.operator === '>')  ok = ist >  z.wert;
      if (z.operator === '<=') ok = ist <= z.wert;
      if (z.operator === '>=') ok = ist >= z.wert;
    }
    if (ok) erreicht++;
    return { ...z, erreicht: ok, ist };
  });
  return { erreicht, total: lernziele.length, details };
}
