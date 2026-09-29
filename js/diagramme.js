// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAMME DER SPIELFLAECHE — Verlaufskurve und Wirkungsbalken
//
// Zwei Formen, nicht mehr. Beide stehen NEBEN der Zahl, nie statt ihrer:
// die Zahl traegt die Aussage, das Bild zeigt die Richtung. Wer vorliest oder
// in der letzten Reihe vor dem Beamer sitzt, verliert nichts.
//
// ── Die Verlaufskurve ──────────────────────────────────────────────────────
// Eine Kennzahl ueber die gespielten Runden, die laufende Runde als letzter
// Punkt. An ihr haengt ein Hantelpaar: ○ was ohne Beschluss gaelte, ● was
// jetzt gilt. Das ist das Vorher/Nachher — aber im Zusammenhang des Verlaufs.
// Balken von null waeren ehrlich und nutzlos: 4.470 gegen 4.475 Mrd. € sind
// zwei gleich hohe Balken. Eine frei skalierte Achse waere das Gegenteil und
// machte aus 0,1 % einen Absturz. Darum hat jede Kennzahl eine Mindestspanne
// (KENNZAHLEN[].spanne in js/spielkern.js).
//
// ── Der Wirkungsbalken ─────────────────────────────────────────────────────
// Eine Veraenderung, von einer Mittellinie aus, nach links oder rechts. Die
// Skala geben die Aufrufer vor — sinnvoll ist sie nur, wenn sie ueber alle
// Balken derselben Kennzahl geteilt wird. Verschiedene Kennzahlen teilen nie
// eine Skala; Milliarden und Gini-Punkte liegen auf keiner gemeinsamen Achse.
//
// Farben kommen aus CSS (Klassen vb-*, wb-*), nicht von hier. Die Richtung
// steht immer zusaetzlich als Vorzeichen im Text daneben — nie Farbe allein.
// ═══════════════════════════════════════════════════════════════════════════

import { zahl } from './spielkern.js';

const B = 132, H = 38, RAND = 6;

/**
 * Die Verlaufskurve einer Kennzahl.
 *
 * @param {object}   k        Eintrag aus KENNZAHLEN
 * @param {object[]} punkte   [{ name: 'Runde 1', wert }] — der letzte ist die laufende Runde
 * @param {number}  [ohne]    was in der laufenden Runde ohne Beschluss gaelte
 * @returns {string} SVG — leer, wenn es nichts zu zeigen gibt
 */
export function verlaufskurve(k, punkte, ohne = null) {
  if (!punkte.length || (punkte.length === 1 && ohne === null)) return '';
  const werte = punkte.map(p => p.wert).concat(ohne === null ? [] : [ohne]);
  let lo = Math.min(...werte), hi = Math.max(...werte);
  const fehlt = (k.spanne ?? 0) - (hi - lo);
  if (fehlt > 0) { lo -= fehlt / 2; hi += fehlt / 2; }
  const y = (v) => RAND + (H - 2 * RAND) * (1 - (v - lo) / ((hi - lo) || 1));
  // Eine einzelne Runde steht in der Mitte, nicht am linken Rand.
  const x = (i) => punkte.length === 1 ? B / 2
            : RAND + (B - 2 * RAND) * i / (punkte.length - 1);
  const letzt = punkte.length - 1;
  const text = (v) => `${zahl(v, k.n)}${k.einheit ? ` ${k.einheit}` : ''}`;

  const beschreibung = punkte.map((p, i) =>
    `${p.name}${i === letzt ? ' (laufend)' : ''}: ${text(p.wert)}`).join('; ')
    + (ohne === null ? '' : `; ohne Beschluss: ${text(ohne)}`);

  return `<svg class="verlauf" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}"
      role="img" aria-label="${k.name} im Verlauf — ${beschreibung}">
    <title>${beschreibung}</title>
    ${punkte.length > 1 ? `<polyline class="vb-linie" fill="none" points="${
      punkte.map((p, i) => `${x(i).toFixed(1)},${y(p.wert).toFixed(1)}`).join(' ')}"/>` : ''}
    ${punkte.slice(0, letzt).map((p, i) =>
      `<circle class="vb-alt" cx="${x(i).toFixed(1)}" cy="${y(p.wert).toFixed(1)}" r="2.5"/>`).join('')}
    ${ohne === null ? '' : `
      <line class="vb-steg" x1="${x(letzt).toFixed(1)}" x2="${x(letzt).toFixed(1)}"
            y1="${y(ohne).toFixed(1)}" y2="${y(punkte[letzt].wert).toFixed(1)}"/>
      <circle class="vb-ohne" cx="${x(letzt).toFixed(1)}" cy="${y(ohne).toFixed(1)}" r="4"/>`}
    <circle class="vb-jetzt" cx="${x(letzt).toFixed(1)}" cy="${y(punkte[letzt].wert).toFixed(1)}" r="4"/>
  </svg>`;
}

/** Die Legende zur Verlaufskurve — einmal je Flaeche, nicht an jeder Kurve. */
export const VERLAUF_LEGENDE =
  '<span class="vb-legende" aria-hidden="true"><svg viewBox="0 0 10 10" width="10" height="10">'
  + '<circle class="vb-ohne" cx="5" cy="5" r="4"/></svg> ohne Beschluss '
  + '<svg viewBox="0 0 10 10" width="10" height="10"><circle class="vb-jetzt" cx="5" cy="5" r="4"/>'
  + '</svg> mit den Beschlüssen dieser Runde</span>';

/**
 * Ein Wirkungsbalken: `wert` gegen die Mittellinie, `max` ist der Rand.
 * `richtung` ('besser' | 'schlechter' | 'gleich') faerbt ihn.
 */
export function wirkungsbalken(wert, max, richtung) {
  const halb = 60, mitte = halb;
  const laenge = max > 0 ? Math.min(1, Math.abs(wert) / max) * (halb - 2) : 0;
  const von = wert < 0 ? mitte - laenge : mitte;
  return `<svg class="wirkungsbalken" viewBox="0 0 ${2 * halb} 12" width="${2 * halb}" height="12"
      aria-hidden="true">
    <line class="wb-mitte" x1="${mitte}" x2="${mitte}" y1="0" y2="12"/>
    ${laenge > 0.5 ? `<rect class="wb-balken" data-richtung="${richtung}" x="${von.toFixed(1)}" y="2"
      width="${laenge.toFixed(1)}" height="8" rx="2"/>` : ''}
  </svg>`;
}
