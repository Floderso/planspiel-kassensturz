// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// Kassensturz · Planspiel — Regelbasiertes Feedback je Team

import { CO2_BUDGET_DE } from './rechner/abgeleitet.js';
import { erzeugeKausalketten } from './rechner/explainer.js';

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
  else if (r.saldo_bip_pct >= -0.35)  parts.push('Haushalt knapp im Rahmen');
  else if (r.saldo_bip_pct >= -2)     parts.push('strukturelles Defizit');
  else                                 parts.push('kritisches Haushaltsdefizit');

  if (z.schuldenquote < 55)           parts.push('Schulden niedrig');
  else if (z.schuldenquote < 65)      parts.push('Schuldenquote stabil');
  else if (z.schuldenquote < 80)      parts.push('Schuldenquote erhöht');
  else                                 parts.push('kritische Schuldendynamik');

  // Schwellen an Realwerten verankert (KPI_BENCH.gini: DE 0,295 · DK 0,281 ·
  // SE 0,273). Die Texte beschreiben ein Niveau, keine Veränderung — der
  // unveränderte Status quo (Modell 0,303) ist „etwa wie heute", nicht
  // „steigende Ungleichheit" (PRUEFUNG.md B3).
  if (r.gini < 0.265)                 parts.push('sehr geringe Ungleichheit');
  else if (r.gini < 0.285)            parts.push('weniger Ungleichheit als heute');
  else if (r.gini < 0.31)             parts.push('Ungleichheit etwa wie heute');
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
