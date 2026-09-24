// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════════
// KASSENSTURZ · Medienspiegel & Wählerbarometer
//
// Berechnet die hypothetische Wählerzustimmung (Sonntagsfrage) und wählt
// deterministisch die passenden Leitmedien-Artikel aus dem Presse-Pool aus.
// ═══════════════════════════════════════════════════════════════════════════════

import { PRESSE_POOL } from '../data/presse_pool.js';
import { PRESETS } from '../data.js';

// Einfacher deterministischer Pseudo-Zufallsgenerator für reproduzierbare Auswahl
function hashParams(params, schock) {
  const str = JSON.stringify(params) + (schock ? schock.id : '');
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

/**
 * Berechnet die hypothetische Wählerzustimmung der Bevölkerung (0–100 %).
 */
export function berechneWaehlerstimmung(params, result, zustand = null, refParams = null, refZustand = null) {
  const ref = refParams || PRESETS.status_quo;

  // 1. Arbeitnehmer & Familien (Kaufkraft, Nettoeinkommen, Freibetrag, Konsumsteuern)
  let an = 48.0;
  const dFreibetrag = (params.freibetrag ?? 12348) - (ref.freibetrag ?? 12348);
  an += (dFreibetrag / 1000) * 2.5;

  const dMwst = (params.mwst ?? 19) - (ref.mwst ?? 19);
  an -= dMwst * 2.2; // Höhere MwSt belastet Konsum spürbar

  const dKindergeld = (params.kg ?? 255) - (ref.kg ?? 255);
  an += (dKindergeld / 20) * 1.5;

  const dBuergergeld = (params.bg ?? 563) - (ref.bg ?? 563);
  an += (dBuergergeld / 50) * 1.2;

  if (params.bge > 0) an += 5.0; // Grundeinkommen entlastet untere Einkommen
  if (params.klimageld && (params.co2 ?? 55) > 60) an += 3.0; // Klimageld-Entlastung

  // 2. Mittelstand & Wirtschaft (Investitionsklima, KSt, GewSt, Bürokratie)
  let wi = 48.0;
  const dKst = (params.kst ?? 15) - (ref.kst ?? 15);
  wi -= dKst * 1.8; // KSt-Erhöhung dämpft Stimmung

  const dGewst = (params.gewst ?? 14) - (ref.gewst ?? 14);
  wi -= dGewst * 1.2;

  const dSpitze = (params.spitze ?? 45) - (ref.spitze ?? 45);
  wi -= dSpitze * 0.8;

  const invImpuls = params.invest_impuls ?? 0;
  wi += (invImpuls / 10) * 1.5; // Öffentliche Investitionen beleben Auftragsbücher

  if (result?.investment_factor) {
    wi += (result.investment_factor - 1.0) * 25.0;
  }

  // 3. Klima & Generationen (CO₂-Zielpfad, Generationenkapital, Zukunft)
  let kl = 45.0;
  const co2 = params.co2 ?? 55;
  kl += Math.min(25, (co2 - 55) * 0.25);

  if (params.klimageld) kl += 4.0;
  else if (co2 > 80) kl -= 6.0; // Hoher CO2-Preis ohne Ausgleich erzeugt Unmut

  // Gemessen am Basispfad, nicht an einer festen Zahl: der Pfad sinkt ohnehin, und
  // früher lagen 300 Mt auf der alten 327-Mt-Skala (8,3 % darunter).
  const unter_pfad = result?.emissionen_basis ? 1 - result.emissionen / result.emissionen_basis : 0;
  if (unter_pfad > 0.083) {
    kl += (unter_pfad - 0.083) * 65.4;
  }

  // Begrenzungen der Sub-Indizes auf [10, 90]
  an = Math.max(10, Math.min(90, Math.round(an)));
  wi = Math.max(10, Math.min(90, Math.round(wi)));
  kl = Math.max(10, Math.min(90, Math.round(kl)));

  // 4. Gesamtzustimmung (gewichtetes Mittel + fiskalische Verlässlichkeit)
  let gesamt = an * 0.40 + wi * 0.25 + kl * 0.15 + 48.0 * 0.20;

  // Abzug bei Verletzung der Schuldenbremse
  const saldoPct = result?.saldo_bip_pct ?? ((result?.saldo ?? -118.8) / 4470 * 100);
  if (saldoPct < -0.35) {
    const malus = Math.min(12, Math.abs(saldoPct - (-0.35)) * 3.5);
    gesamt -= malus;
  } else if (saldoPct >= 0) {
    gesamt += 3.5; // Überschuss-Bonus
  }

  gesamt = Math.max(15, Math.min(85, Math.round(gesamt)));
  const base = 48;
  const delta = gesamt - base;

  let status = 'solide';
  if (gesamt >= 55) status = 'sehr_hoch';
  else if (gesamt < 35) status = 'kritisch';
  else if (gesamt < 44) status = 'angeschlagen';

  return {
    gesamt,
    delta,
    status,
    gruppen: {
      arbeitnehmer: an,
      wirtschaft: wi,
      klima: kl,
    },
  };
}

/**
 * Filtert und gewichtet newsworthy Ereignisse aus dem aktuellen Simulationsergebnis.
 */
export function ermittleEreignisse(params, result, zustand = null, refParams = null, refZustand = null, schock = null) {
  const ref = refParams || PRESETS.status_quo;
  const events = [];
  const push = (topic, direction, weight) => events.push({ topic, direction, weight });

  // 1. Schock hat höchste Priorität
  if (schock) {
    push(`schock:${schock.typ || 'allgemein'}`, 'neutral', 100);
  }

  // 2. Haushaltslage (Schuldenbremse)
  const saldoPct = result?.saldo_bip_pct ?? ((result?.saldo ?? 0) / 4470 * 100);
  if (saldoPct < -0.35) {
    push('fiskus', 'bad', 50 + Math.min(30, Math.abs(saldoPct) * 10));
  } else if (saldoPct >= 0) {
    push('fiskus', 'good', 40 + (result?.saldo ?? 0));
  }

  // 3. Mehrwertsteuer
  const dMwst = (params.mwst ?? 19) - (ref.mwst ?? 19);
  if (dMwst >= 1) push('konsum', 'mwst_up', 45 + dMwst * 5);
  else if (dMwst <= -1) push('konsum', 'mwst_down', 35);

  // 4. Einkommensteuer
  const dSpitze = (params.spitze ?? 45) - (ref.spitze ?? 45);
  if (dSpitze >= 1) push('steuer', 'spitze_up', 38 + dSpitze * 3);

  const dFreibetrag = (params.freibetrag ?? 12348) - (ref.freibetrag ?? 12348);
  if (dFreibetrag >= 400) push('steuer', 'freibetrag_up', 36);

  // 5. Unternehmen & Investitionen
  const dKst = (params.kst ?? 15) - (ref.kst ?? 15);
  if (dKst >= 1) push('standort', 'kst_up', 40 + dKst * 4);
  else if (dKst <= -1) push('standort', 'kst_down', 35);

  const investImpuls = params.invest_impuls ?? 0;
  if (investImpuls >= 10) push('standort', 'invest_up', 37 + investImpuls);

  // 6. Klima
  const co2 = params.co2 ?? 55;
  if (co2 >= 80 && params.klimageld) push('klima', 'klimageld', 42);
  else if (co2 >= 80 && !params.klimageld) push('klima', 'co2_high_noklima', 46);
  else if (result?.emissionen_basis && result.emissionen < result.emissionen_basis * 0.887) push('klima', 'ziel_gut', 34);

  // 7. Soziales
  if (params.bge > 0) push('soziales', 'bge', 48);
  const dBuergergeld = (params.bg ?? 563) - (ref.bg ?? 563);
  if (dBuergergeld >= 40) push('soziales', 'buergergeld_up', 32);

  if (result?.gini && result.gini < 0.27) push('soziales', 'gini_down', 30);

  return events.sort((a, b) => b.weight - a.weight);
}

/**
 * Wählt die passenden Artikel aus dem Presse-Pool aus.
 *
 * @param {object} params
 * @param {object} result
 * @param {object|null} zustand
 * @param {object|null} refParams
 * @param {object|null} refZustand
 * @param {object|null} schock
 * @param {number} count Anzahl Artikel (Standard: 2)
 * @param {Array} pool Presse-Pool
 * @returns {{ stimmung: object, artikel: Array, events: Array }}
 */
export function waehleMedienspiegel(params, result, zustand = null, refParams = null, refZustand = null, schock = null, count = 2, pool = PRESSE_POOL) {
  const stimmung = berechneWaehlerstimmung(params, result, zustand, refParams, refZustand);
  const events = ermittleEreignisse(params, result, zustand, refParams, refZustand, schock);

  const picked = [];
  const usedIds = new Set();
  const seed = hashParams(params, schock);

  for (const ev of events) {
    if (picked.length >= count) break;

    // Suche Artikel mit passendem topic & direction
    let candidates = pool.filter(a =>
      a.tags.topic === ev.topic && a.tags.direction === ev.direction && !usedIds.has(a.id)
    );

    // Fallback: Suche nur nach passendem topic
    if (!candidates.length) {
      candidates = pool.filter(a =>
        a.tags.topic === ev.topic && !usedIds.has(a.id)
      );
    }

    if (candidates.length) {
      const idx = (seed + picked.length) % candidates.length;
      const chosen = candidates[idx];
      picked.push(chosen);
      usedIds.add(chosen.id);
    }
  }

  // Auffüllen mit Hintergrundartikeln falls zu wenige Treffer
  let neutralIdx = 0;
  while (picked.length < count) {
    const neutrals = pool.filter(a => a.tags.topic === 'neutral' && !usedIds.has(a.id));
    if (!neutrals.length) break;
    const chosen = neutrals[(seed + neutralIdx) % neutrals.length];
    picked.push(chosen);
    usedIds.add(chosen.id);
    neutralIdx++;
  }

  return { stimmung, artikel: picked, events };
}
