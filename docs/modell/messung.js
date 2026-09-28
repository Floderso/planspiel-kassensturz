// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// MODELLDOKUMENTATION · Messung der Wirkungen
//
// Die Zahlen im Wirkungsgraphen (modell.tex, Teil III) sind nicht
// abgeschrieben, sondern gemessen: Jede Stellgröße wird, ausgehend vom Status
// quo, um einen festen Schritt verschoben, und die Engine rechnet neu. Die
// Differenz gegenüber dem Status quo ist die Wirkung. Weil die Engine an
// vielen Stellen begrenzt (Klammern, Schwellen, Pareto-Rand), ist das eine
// endliche Differenz für genau diesen Schritt, keine Ableitung.
//
// Aufruf:   node docs/modell/messung.js
// Schreibt: docs/modell/generiert/*.tex  und  docs/modell/generiert/messung.json
// Geprüft:  tests/modelldoku.test.js — meldet, wenn das Dokument veraltet ist
// ═══════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulierePfad } from '../../js/rechner/transition.js';
import { PRESETS, DEZILE, KAPITALANTEIL, PRIVAT_ANPASSUNG, KURS_KONFIG_DEFAULT, PERIOD_STATE_0, ZINS_EFFEKTIV, BIP_WACHSTUM_NOMINAL_JAHR,
         ELAST, ELAST_QUELLEN, BASIS_MAKRO, MPC_DEZIL, KINDER_JE_HH, BUERGERGELD_QUOTE, CO2_GEWICHT } from '../../js/data.js';
import { berechne, FORMEL_QUELLEN_BERECHNE } from '../../js/rechner/berechne.js';
import { FORMEL_QUELLEN_EST } from '../../js/rechner/einkommensteuer.js';
import { FORMEL_QUELLEN_VERT } from '../../js/rechner/verteilung.js';

const SQ = PRESETS.status_quo;
const PERIODEN = 5;

// ── Stellgrößen und Schritte ────────────────────────────────────────────────
// Sätze um 1 Prozentpunkt, Beträge je Monat um 10 €, der Grundfreibetrag um
// 1.000 €, der CO₂-Preis um 10 €/t. Die Steuern auf Vermögen haben Sätze
// unter 3 % und werden um 0,1 Pp. verschoben (die Zucman-Steuer um 1 Pp., s. u.).
export const STELLGROESSEN = [
  { key: 'freibetrag',   bez: 'Grundfreibetrag',     schritt: 1000, einheit: '1.000 €',   ressort: 'Finanzen' },
  { key: 'eingang',      bez: 'Eingangssteuersatz',  schritt: 1,    einheit: '1 Pp.',     ressort: 'Finanzen' },
  { key: 'spitze',       bez: 'Spitzensteuersatz',   schritt: 1,    einheit: '1 Pp.',     ressort: 'Finanzen' },
  { key: 'mwst',         bez: 'Umsatzsteuer',        schritt: 1,    einheit: '1 Pp.',     ressort: 'Finanzen' },
  { key: 'erb',          bez: 'Erbschaftsteuer',     schritt: 1,    einheit: '1 Pp.',     ressort: 'Finanzen' },
  { key: 'kst',          bez: 'Körperschaftsteuer',  schritt: 1,    einheit: '1 Pp.',     ressort: 'Wirtschaft' },
  { key: 'gewst',        bez: 'Gewerbesteuer',       schritt: 1,    einheit: '1 Pp.',     ressort: 'Wirtschaft' },
  { key: 'rv',           bez: 'RV-Beitrag',          schritt: 1,    einheit: '1 Pp.',     ressort: 'Soziales' },
  { key: 'kv',           bez: 'KV-Beitrag',          schritt: 1,    einheit: '1 Pp.',     ressort: 'Soziales' },
  { key: 'rentenniveau', bez: 'Rentenniveau',        schritt: 1,    einheit: '1 Pp.',     ressort: 'Soziales' },
  { key: 'bg',           bez: 'Bürgergeld',          schritt: 10,   einheit: '10 €/Monat', ressort: 'Soziales' },
  { key: 'kg',           bez: 'Kindergeld',          schritt: 10,   einheit: '10 €/Monat', ressort: 'Soziales' },
  { key: 'co2',          bez: 'CO₂-Preis',           schritt: 10,   einheit: '10 €/t',    ressort: 'Umwelt' },
  { key: 'klimageld',    bez: 'Klimageld',           klappe: true,  einheit: 'ein',       ressort: 'Umwelt' },
];

// Nicht am Tisch, aber in der klassischen Fläche
export const WEITERE = [
  { key: 'grenze',    bez: 'Grenze Spitzensatz',   schritt: -10000, einheit: '−10.000 €' },
  { key: 'mwst_erm',  bez: 'USt ermäßigt',         schritt: 1,      einheit: '1 Pp.' },
  { key: 'abgeltung', bez: 'Abgeltungsteuer',      schritt: 1,      einheit: '1 Pp.' },
  { key: 'bbg',       bez: 'Beitragsbemessungsgr.', schritt: 10000,  einheit: '10.000 €' },
  { key: 'verm',      bez: 'Vermögensteuer',       schritt: 0.1,    einheit: '0,1 Pp.', min: 0 },
  { key: 'boden',     bez: 'Bodenwertsteuer',      schritt: 0.1,    einheit: '0,1 Pp.' },
  // 1 Pp.: unter 0,3 % greift die Anrechnung der Einkommensteuer, 0,1 Pp. wirkte gar nicht
  { key: 'zucman',    bez: 'Zucman-Mindeststeuer', schritt: 1,      einheit: '1 Pp.', min: 0 },
];

// ── Was gemessen wird ───────────────────────────────────────────────────────
// Kanäle: Zwischengrößen der ersten Periode (2025–2028, Jahresgrößen)
// Kennzahlen: was die Spielfläche zeigt, erste Periode und Ende des Pfads
const summe = (o, ks) => ks.reduce((a, k) => a + (o[k] ?? 0), 0);

export const KANAELE = [
  { id: 'est',     bez: 'Einkommensteuer',        einheit: 'Mrd. €', f: r => r.rev.est },
  { id: 'mwst',    bez: 'Umsatzsteuer',           einheit: 'Mrd. €', f: r => r.rev.mwst },
  { id: 'unt',     bez: 'KSt + GewSt',            einheit: 'Mrd. €', f: r => r.rev.kst + r.rev.gewst },
  { id: 'verm',    bez: 'Erb-, Boden-, Verm.-St.', einheit: 'Mrd. €', f: r => summe(r.rev, ['erbschaft', 'boden', 'vermoegen', 'zucman']) },
  { id: 'sv',      bez: 'SV-Beiträge',            einheit: 'Mrd. €', f: r => r.rev.rv + r.rev.kv + r.rev.al },
  { id: 'co2',     bez: 'CO₂-Einnahmen netto',    einheit: 'Mrd. €', f: r => r.rev.co2 },
  { id: 'transfer', bez: 'Transfers',             einheit: 'Mrd. €', f: r => r.bg_auszahlung + r.kg_auszahlung + r.klimageld_auszahlung },
  { id: 'rente',   bez: 'Rentenzahlungen',        einheit: 'Mrd. €', f: r => r.sv_ausgaben_delta },
  { id: 'arbeit',  bez: 'Arbeitsangebot',         einheit: '%',      f: r => (r.avg_labor - 1) * 100 },
  { id: 'invest',  bez: 'Investitionsfaktor',     einheit: '%',      f: r => (r.investment_factor - 1) * 100 },
  { id: 'nachfr',  bez: 'Nachfrageimpuls',        einheit: 'Mrd. €', f: r => r.nachfrage_luecke * 4470 },
];

export const KENNZAHLEN = [
  { id: 'saldo',   bez: 'Saldo',              einheit: 'Mrd. €/a', f: (e) => e.result.saldo },
  { id: 'gini',    bez: 'Gini',               einheit: 'Gini-Pkt.', f: (e) => e.result.gini * 100 },
  { id: 'armut',   bez: 'Armutsrisiko',       einheit: '%',        f: (e) => e.result.armutsrisiko },
  { id: 'emiss',   bez: 'Emissionen',         einheit: 'Mt/a',     f: (e) => e.result.emissionen },
  { id: 'bip',     bez: 'BIP',                einheit: 'Mrd. €',   f: (e) => e.result.bip_aktuell },
  { id: 'd1',      bez: 'Netto D1',           einheit: '€/a',      f: (e) => e.result.hh_delta.netto[0] },
  { id: 'd5',      bez: 'Netto D5',           einheit: '€/a',      f: (e) => e.result.hh_delta.netto[4] },
  { id: 'd10c',    bez: 'Netto D10c',         einheit: '€/a',      f: (e) => e.result.hh_delta.netto[11] },
];

export const PFAD = [
  { id: 'schuld',  bez: 'Schuldenquote 2041',   einheit: 'Pp.',     f: (p) => p.at(-1).zustand.schuldenquote },
  // Niveau zu Beginn der letzten Periode, ohne deren Nachfrage: das, was dauerhaft bleibt,
  // und der Nenner der Schuldenquote 2041
  { id: 'bip',     bez: 'BIP-Niveau 2041',      einheit: 'Mrd. €',  f: (p) => p.at(-1).zustand.bip },
  { id: 'co2kum',  bez: 'CO₂ 2025–2040',        einheit: 'Mt',      f: (p) => p.at(-1).zustand.co2_kumulat },
  { id: 'saldo',   bez: 'Saldo 2041–44',        einheit: 'Mrd. €/a', f: (p) => p.at(-1).result.saldo },
  { id: 'gini',    bez: 'Gini 2041–44',         einheit: 'Gini-Pkt.', f: (p) => p.at(-1).result.gini * 100 },
];

const pfad = params => simulierePfad(Array.from({ length: PERIODEN }, () => ({ ...params })));

// ── Zerlegung (Teil II) ─────────────────────────────────────────────────────
// Die Saldowirkung der ersten Periode in drei Teile, die sich genau addieren:
//   mechanisch  — ohne Verhaltensreaktion (alle ELAST null) und ohne Nachfrage
//   Verhalten   — mit ELAST, ohne Nachfrage, minus mechanisch
//   Nachfrage   — volles Modell minus Verhalten ohne Nachfrage
// ELAST wird dafür vorübergehend auf null gesetzt und danach zurückgesetzt.
// Nicht über ELAST laufen und darum im mechanischen Teil enthalten: die feste
// Ausweichquote der Zucman-Steuer (15 % bei 2 %) und die Klammern der Engine.
const ZUSTAND_P1 = { ...PERIOD_STATE_0, renten_faktor: 1, jahr: 2025, laenge: KURS_KONFIG_DEFAULT.perioden_laenge_jahre };

function ohneVerhalten(f) {
  const gesichert = { ...ELAST };
  for (const k of Object.keys(ELAST)) ELAST[k] = 0;
  try { return f(); } finally { Object.assign(ELAST, gesichert); }
}

function zerlege(params) {
  const saldo = (p, opt) => berechne(p, ZUSTAND_P1, opt).saldo;
  const d = opt => saldo(params, opt) - saldo(SQ, opt);
  const mech = ohneVerhalten(() => d({ ohneNachfrage: true }));
  const mitVerhalten = d({ ohneNachfrage: true });
  const gesamt = d({});
  return { mechanisch: mech, verhalten: mitVerhalten - mech, nachfrage: gesamt - mitVerhalten, gesamt };
}

function verschoben(s) {
  return s.klappe ? { ...SQ, [s.key]: !SQ[s.key] } : { ...SQ, [s.key]: SQ[s.key] + s.schritt };
}

/** Misst alle Wirkungen. Rein, ohne Dateizugriff — der Test ruft es auch. */
export function messe() {
  const basis = pfad(SQ);
  const b1 = basis[0];
  const zeile = s => {
    const p = pfad(verschoben(s));
    const e1 = p[0];
    return {
      key: s.key,
      kanal:     Object.fromEntries(KANAELE.map(k => [k.id, k.f(e1.result) - k.f(b1.result)])),
      kennzahl:  Object.fromEntries(KENNZAHLEN.map(k => [k.id, k.f(e1) - k.f(b1)])),
      pfad:      Object.fromEntries(PFAD.map(k => [k.id, k.f(p) - k.f(basis)])),
      dezile:    e1.result.hh_delta.netto.map((v, i) => v - b1.result.hh_delta.netto[i]),
    };
  };
  // Nichtlinearität: Wirkung von +Δ gegen −Δ (nur Stellgrößen mit Schritt)
  const symmetrie = s => {
    if (s.klappe) return null;
    const auf = pfad({ ...SQ, [s.key]: SQ[s.key] + s.schritt })[0].result.saldo - b1.result.saldo;
    // Unter dem kleinsten zulässigen Wert (Steuersatz 0) gibt es keine Senkung
    const ab  = SQ[s.key] - s.schritt < (s.min ?? -Infinity) ? null
              : b1.result.saldo - pfad({ ...SQ, [s.key]: SQ[s.key] - s.schritt })[0].result.saldo;
    return { auf, ab };
  };
  // Strukturelle Gewichte: wie ein Kanal auf eine Kennzahl weiterwirkt. Nicht
  // gemessen, sondern aus den Gleichungen der Engine bei Status-quo-Werten
  const r1 = b1.result, n = KURS_KONFIG_DEFAULT.perioden_laenge_jahre;
  const Y1 = r1.bip_aktuell * Math.pow(1 + BIP_WACHSTUM_NOMINAL_JAHR, n);
  const struktur = {
    // ∂Saldo/∂Nachfrage: alle Einnahmen außer CO₂ skalieren mit dem Nachfragefaktor
    stabilisator: (r1.einnahmen_total - r1.rev.co2) / r1.bip_aktuell,
    // Gewichte auf das BIP der Folgeperiode Y_{t+1} = Y_t (1+g)^n (transition.js)
    // BIP-Niveau je 1 % Arbeitsangebot, Mrd. €
    arbeit_bip:   (1 - KAPITALANTEIL) * Y1 / 100,
    // BIP-Niveau je 1 % Investitionsfaktor: langfristig und nach einer Periode, Mrd. €
    invest_bip_lang: KAPITALANTEIL * Y1 / 100,
    invest_bip_n:    KAPITALANTEIL * Y1 / 100 * (1 - Math.pow(1 - PRIVAT_ANPASSUNG, n)),
    anpassung_n:  1 - Math.pow(1 - PRIVAT_ANPASSUNG, n),
    // Schuldenquote der Folgeperiode je 1 Mrd. € Primärsaldo über n Jahre, mit Zinseszins, Pp.
    saldo_schuld: -((Math.pow(1 + ZINS_EFFEKTIV, n) - 1) / ZINS_EFFEKTIV) / Y1 * 100,
    jahre: n,
  };
  const statusQuo = {
    periode1: Object.fromEntries(KENNZAHLEN.map(k => [k.id, k.f(b1)])),
    kanal:    Object.fromEntries(KANAELE.map(k => [k.id, k.f(b1.result)])),
    pfad:     Object.fromEntries(PFAD.map(k => [k.id, k.f(basis)])),
    verlauf:  basis.map(e => ({
      label: e.label, bip: e.zustand.bip, schuldenquote: e.zustand.schuldenquote,
      co2_kumulat: e.zustand.co2_kumulat, saldo: e.result.saldo, saldo_pct: e.result.saldo_bip_pct,
      struktur: e.result.struktureller_saldo_pct, gini: e.result.gini, emissionen: e.result.emissionen,
      einnahmen: e.result.einnahmen_total, ausgaben: e.result.ausgaben_total,
    })),
  };
  // Verlauf über den ganzen Regelbereich für ausgewählte Stellgrößen (Abbildungen)
  const BEREICHE = { spitze: [20, 75], co2: [0, 300], rentenniveau: [40, 53], mwst: [0, 30], kst: [0, 40] };
  const verlaeufe = Object.fromEntries(Object.entries(BEREICHE).map(([key, [lo, hi]]) => {
    const punkte = Array.from({ length: 21 }, (_, i) => lo + (hi - lo) * i / 20).map(v => {
      const e = pfad({ ...SQ, [key]: v })[0];
      return { x: v, saldo: e.result.saldo, gini: e.result.gini * 100, emiss: e.result.emissionen, bip: e.result.bip_aktuell };
    });
    return [key, punkte];
  }));
  return {
    struktur,
    statusQuo,
    tisch:    STELLGROESSEN.map(zeile),
    weitere:  WEITERE.map(zeile),
    zerlegung: Object.fromEntries([...STELLGROESSEN, ...WEITERE].map(s => [s.key, zerlege(verschoben(s))])),
    symmetrie: Object.fromEntries([...STELLGROESSEN, ...WEITERE].map(s => [s.key, symmetrie(s)])),
    verlaeufe,
  };
}

// ── Ausgabe als LaTeX ───────────────────────────────────────────────────────

/** Deutsche Zahl mit fester Stellenzahl; −0 wird 0, Minus als echtes Minus. */
export function zahl(v, nk = 1) {
  const r = Number(v.toFixed(nk));
  const s = Math.abs(r).toLocaleString('de-DE', { minimumFractionDigits: nk, maximumFractionDigits: nk });
  if (r === 0) return s;
  return (r < 0 ? '$-$' : '$+$') + s;
}
const ohneVz = (v, nk = 1) => (Number(v.toFixed(nk)) || 0).toLocaleString('de-DE', { minimumFractionDigits: nk, maximumFractionDigits: nk });
const tex = s => s.replace(/%/g, '\\%').replace(/€/g, '\\euro{}').replace(/CO₂/g, 'CO\\textsubscript{2}').replace(/−/g, '$-$');

// Stellen je Einheit, damit kleine und große Wirkungen lesbar bleiben
const NK = { 'Mrd. €': 1, 'Mrd. €/a': 1, '%': 2, 'Gini-Pkt.': 3, 'Mt/a': 1, '€/a': 0, 'Pp.': 2, 'Mt': 0 };

function tabelle(zeilen, spalten, feld, defs) {
  const kopf = spalten.map(k => `\\rotatebox{75}{${tex(k.bez)} [${tex(k.einheit)}]}`).join(' & ');
  const rumpf = zeilen.map(z => {
    const s = defs.find(d => d.key === z.key);
    return `${tex(s.bez)} (${tex(s.einheit)}) & ` + spalten.map(k => zahl(z[feld][k.id], NK[k.einheit] ?? 1)).join(' & ') + ' \\\\';
  }).join('\n');
  return `\\begin{tabular}{l${'r'.repeat(spalten.length)}}\n\\toprule\nStellgröße (Schritt) & ${kopf} \\\\\n\\midrule\n${rumpf}\n\\bottomrule\n\\end{tabular}\n`;
}

function dezilTabelle(zeilen, defs) {
  const kopf = DEZILE.map(d => d.label).join(' & ');
  const rumpf = zeilen.map(z => {
    const s = defs.find(d => d.key === z.key);
    return `${tex(s.bez)} & ` + z.dezile.map(v => zahl(v, 0)).join(' & ') + ' \\\\';
  }).join('\n');
  return `\\begin{tabular}{l${'r'.repeat(DEZILE.length)}}\n\\toprule\n & ${kopf} \\\\\n\\midrule\n${rumpf}\n\\bottomrule\n\\end{tabular}\n`;
}

/**
 * Wirkungsgraph je Ressort: Stellgröße → Kanal → Kennzahl.
 * Kanten tragen die gemessene Wirkung; Strichstärke nach Betrag (relativ zum
 * größten Wert der Spalte), Farbe nach Vorzeichen für den Saldo. Kanten unter
 * der Schwelle entfallen, damit der Graph lesbar bleibt.
 */
const SCHWELLE = { 'Mrd. €': 0.3, '%': 0.02 };

// Ressortgraph: Stellgrößen links, alle Kanäle rechts in fester Reihenfolge (damit die vier
// Graphen gleich aussehen), Kanten mit gemessenem Wert. Jede Stellgröße trägt ihre
// Saldowirkung der ersten Periode im Knoten.
const KANAL_ABSTAND = 0.95;   // cm
const STUMMEL_ABSTAND = 0.38; // cm zwischen den Kantenansätzen an einer Stellgröße
function ressortGraph(zeilen, zeilenMax) {
  const hoehe = KANAL_ABSTAND * (KANAELE.length - 1);
  const aus = [];
  KANAELE.forEach((k, j) => aus.push(
    `\\node[kanal] (K-${k.id}) at (8.4,${(-j * KANAL_ABSTAND).toFixed(2)}) {${tex(k.bez)} {\\scriptsize[${tex(k.einheit)}]}};`));
  // Kanten je Stellgröße, in der Reihenfolge der Kanäle: dann kreuzen sich die Ansätze nicht
  const kanten = zeilen.map(z => KANAELE.map((k, j) => ({ k, j, v: z.kanal[k.id] }))
    .filter(e => Math.abs(e.v) >= (SCHWELLE[e.k.einheit] ?? 0.3)));
  // Stellgrößen untereinander, jede so hoch wie ihre Ansätze, gleichmäßig verteilt
  const hoehen = kanten.map(ks => Math.max(1.3, ks.length * STUMMEL_ABSTAND + 0.3));
  const luecke = Math.max(0.3, (hoehe + 0.6 - hoehen.reduce((a, h) => a + h, 0)) / Math.max(1, zeilen.length));
  let y = 0.3 - luecke / 2;
  zeilen.forEach((z, i) => {
    const s = STELLGROESSEN.find(d => d.key === z.key);
    const mitte = y - hoehen[i] / 2;
    y -= hoehen[i] + luecke;
    aus.push(`\\node[stell, minimum height=${hoehen[i].toFixed(2)}cm] (L-${z.key}) at (0,${mitte.toFixed(2)}) {\\textbf{${tex(s.bez)}}\\\\{\\scriptsize +${tex(s.einheit)}}\\\\{\\scriptsize Saldo ${zahl(z.kennzahl.saldo, 1)}}};`);
    kanten[i].forEach((e, n) => {
      const versatz = ((kanten[i].length - 1) / 2 - n) * STUMMEL_ABSTAND;
      const staerke = (0.4 + 2.2 * Math.abs(e.v) / zeilenMax[e.k.id]).toFixed(2);
      aus.push(`\\wkante{${z.key}}{${e.k.id}}{${e.v >= 0 ? 'pos' : 'neg'}}{${staerke}}{${zahl(e.v, NK[e.k.einheit] ?? 1)}}{${versatz.toFixed(2)}}`);
    });
  });
  return aus.join('\n') + '\n';
}

// Gesamtmatrix: Zelle gefärbt nach Erwünschtheit (blau erwünscht, orange unerwünscht),
// Sättigung nach Betrag relativ zum größten Wert der Spalte.
const ERWUENSCHT = { saldo: 1, gini: -1, armut: -1, emiss: -1, bip: 1, d1: 1, d5: 1, d10c: 1,
                     schuld: -1, co2kum: -1 };
function gesamtMatrix(m) {
  const spalten = [
    ...KENNZAHLEN.map(k => ({ ...k, quelle: 'kennzahl' })),
    ...PFAD.filter(k => ['schuld', 'bip', 'co2kum'].includes(k.id)).map(k => ({ ...k, quelle: 'pfad' })),
  ];
  const max = spalten.map(k => Math.max(1e-9, ...m.tisch.map(z => Math.abs(z[k.quelle][k.id]))));
  const kopf = spalten.map(k => `\\rotatebox{70}{${tex(k.bez)}}`).join(' & ');
  const rumpf = m.tisch.map(z => {
    const s = STELLGROESSEN.find(d => d.key === z.key);
    const zellen = spalten.map((k, j) => {
      const v = z[k.quelle][k.id];
      const nk = NK[k.einheit] ?? 1;
      if (Number(v.toFixed(nk)) === 0) return `\\textcolor{grau}{0}`;
      const gut = Math.sign(v) * (ERWUENSCHT[k.id] ?? 1) > 0;
      const staerke = Math.round(12 + 58 * Math.min(1, Math.abs(v) / max[j]));
      return `\\cellcolor{${gut ? 'pos' : 'neg'}!${staerke}}${ohneVz(v, Math.min(nk, 2)).replace('-', '$-$')}`;
    }).join(' & ');
    return `${tex(s.bez)} & ${zellen} \\\\`;
  }).join('\n');
  const einheiten = spalten.map(k => `{\\tiny ${tex(k.einheit)}}`).join(' & ');
  return `\\begin{tabular}{l${'r'.repeat(spalten.length)}}\n\\toprule\nStellgröße & ${kopf} \\\\\n & ${einheiten} \\\\\n\\midrule\n${rumpf}\n\\bottomrule\n\\end{tabular}\n`;
}

function zerlegungTabelle(m) {
  const alle = [...STELLGROESSEN, ...WEITERE];
  const zeile = s => {
    const z = m.zerlegung[s.key];
    const anteil = v => Math.abs(z.gesamt) < 0.05 ? '--' : ohneVz(100 * v / z.gesamt, 0).replace('-', '$-$');
    return `${tex(s.bez)} (${tex(s.einheit)}) & ${zahl(z.mechanisch, 2)} & ${zahl(z.verhalten, 2)} & ${zahl(z.nachfrage, 2)} & ${zahl(z.gesamt, 2)} & ${anteil(z.mechanisch)} & ${anteil(z.verhalten)} & ${anteil(z.nachfrage)} \\\\`;
  };
  const block = defs => defs.map(zeile).join('\n');
  return `\\begin{tabular}{lrrrrrrr}\n\\toprule\n` +
    ` & \\multicolumn{4}{c}{Saldowirkung, Mrd.\\,\\euro{}/a} & \\multicolumn{3}{c}{Anteil in \\%} \\\\\n` +
    `\\cmidrule(lr){2-5}\\cmidrule(lr){6-8}\n` +
    `Stellgröße (Schritt) & mechan. & Verhalten & Nachfrage & gesamt & mech. & Verh. & Nachfr. \\\\\n\\midrule\n` +
    `${block(STELLGROESSEN)}\n\\midrule\n${block(WEITERE)}\n\\bottomrule\n\\end{tabular}\n`;
}

function symmetrieTabelle(m) {
  const alle = [...STELLGROESSEN, ...WEITERE].filter(s => !s.klappe);
  const rumpf = alle.map(s => {
    const v = m.symmetrie[s.key];
    if (v.ab === null) return `${tex(s.bez)} (${tex(s.einheit)}) & ${zahl(v.auf, 2)} & -- & Status quo am Rand \\\\`;
    const abw = Math.abs(v.auf - v.ab) / Math.max(0.05, Math.abs(v.auf));
    return `${tex(s.bez)} (${tex(s.einheit)}) & ${zahl(v.auf, 2)} & ${zahl(v.ab, 2)} & ${abw < 0.02 ? 'linear' : ohneVz(100 * abw, 0) + '\\,\\%'} \\\\`;
  }).join('\n');
  return `\\begin{tabular}{lrrr}\n\\toprule\nStellgröße (Schritt) & $+\\Delta$ & $-\\Delta$ & Abweichung \\\\\n\\midrule\n${rumpf}\n\\bottomrule\n\\end{tabular}\n`;
}

function makros(m) {
  const sq = m.statusQuo;
  const zeilen = [
    ['SQsaldo', ohneVz(sq.periode1.saldo, 1)],
    ['SQgini', ohneVz(sq.periode1.gini / 100, 3)],
    ['SQarmut', ohneVz(sq.periode1.armut, 1)],
    ['SQemiss', ohneVz(sq.periode1.emiss, 0)],
    ['SQbip', ohneVz(sq.periode1.bip, 0)],
    ['SQschuldEnde', ohneVz(sq.pfad.schuld, 1)],
    ['SQbipEnde', ohneVz(sq.pfad.bip, 0)],
    ['SQcoEnde', ohneVz(sq.pfad.co2kum, 0)],
    ['SQeinnahmen', ohneVz(sq.verlauf[0].einnahmen, 0)],
    ['SQausgaben', ohneVz(sq.verlauf[0].ausgaben, 0)],
    ['SQsaldoPct', ohneVz(sq.verlauf[0].saldo_pct, 2)],
    ['SQstruktur', ohneVz(sq.verlauf[0].struktur, 2)],
    ['Wstabil', ohneVz(m.struktur.stabilisator, 3)],
    ['Warbeit', ohneVz(m.struktur.arbeit_bip, 1)],
    ['Winvestlang', ohneVz(m.struktur.invest_bip_lang, 1)],
    ['Winvestn', ohneVz(m.struktur.invest_bip_n, 1)],
    ['Wanpassung', ohneVz(m.struktur.anpassung_n, 3)],
    ['Wschuld', ohneVz(m.struktur.saldo_schuld, 3)],
  ];
  // Einzelwerte für den Fließtext: \\wert{bereich}{stellgröße}{feld}, z. B. \\wert{zerl}{rv}{mechanisch}
  const einzel = [];
  const def = (b, k, f, v, nk) => einzel.push(`\\wertdef{${b}}{${k}}{${f}}{${ohneVz(v, nk).replace('-', '$-$')}}`);
  for (const [k, z] of Object.entries(m.zerlegung)) {
    for (const [f, v] of Object.entries(z)) def('zerl', k, f, v, 2);
    for (const f of ['mechanisch', 'verhalten', 'nachfrage']) {
      if (Math.abs(z.gesamt) >= 0.05) def('anteil', k, f, 100 * z[f] / z.gesamt, 0);
    }
  }
  for (const z of [...m.tisch, ...m.weitere]) {
    for (const [f, v] of Object.entries(z.kennzahl)) def('p1', z.key, f, v, NK[KENNZAHLEN.find(k => k.id === f).einheit] ?? 1);
    for (const [f, v] of Object.entries(z.pfad)) def('pfad', z.key, f, v, NK[PFAD.find(k => k.id === f).einheit] ?? 1);
    for (const [f, v] of Object.entries(z.kanal)) def('kanal', z.key, f, v, NK[KANAELE.find(k => k.id === f).einheit] ?? 1);
  }
  for (const key of Object.keys(m.verlaeufe)) einzel.push(`\\wertdef{sq}{${key}}{x}{${SQ[key]}}`);
  return zeilen.map(([n, v]) => `\\newcommand{\\${n}}{${v.replace('-', '$-$')}}`).join('\n') + '\n' + einzel.join('\n') + '\n';
}

function verlaufTabelle(m) {
  const z = (v, nk) => ohneVz(v, nk).replace('-', '$-$');
  const rumpf = m.statusQuo.verlauf.map(e =>
    `${e.label.replace('–', '--')} & ${z(e.bip, 0)} & ${z(e.schuldenquote, 1)} & ${z(e.saldo, 1)} & ${z(e.saldo_pct, 2)} & ${z(e.struktur, 2)} & ${z(e.emissionen, 0)} & ${z(e.co2_kumulat, 0)} & ${z(e.gini, 3)} \\\\`
  ).join('\n');
  return `\\begin{tabular}{lrrrrrrrr}\n\\toprule\nPeriode & BIP & Schulden & Saldo & Saldo & strukt. & Emiss. & CO\\textsubscript{2} kum. & Gini \\\\\n & Mrd.\\,\\euro{} & \\% BIP & Mrd.\\,\\euro{} & \\% BIP & \\% BIP & Mt/a & Mt & \\\\\n\\midrule\n${rumpf}\n\\bottomrule\n\\end{tabular}\n`;
}

function verlaufDaten(m) {
  // pgfplots-Tabellen: x und Kennzahlen je Stellgröße
  return Object.fromEntries(Object.entries(m.verlaeufe).map(([key, pkt]) => [key,
    'x saldo gini emiss bip\n' + pkt.map(p => [p.x, p.saldo, p.gini, p.emiss, p.bip].map(v => v.toFixed(4)).join(' ')).join('\n') + '\n']));
}

// ── Daten und Quellen (Anhang) ───────────────────────────────────────────────
// Kein Messergebnis, aber ebenfalls aus der Engine gelesen statt abgetippt

/** Text aus den Quellenobjekten für LaTeX: Sonderzeichen maskieren. */
const esc = t => String(t)
  .replace(/\\/g, '\\textbackslash{}')
  .replace(/([&%$#_{}])/g, '\\$1')
  .replace(/~/g, '\\textasciitilde{}')
  .replace(/\^/g, '\\textasciicircum{}')
  .replace(/€/g, '\\euro{}');

// CO₂-Last des Status quo, Mrd. € (bepreiste Emissionen × Preis), für die Last je Haushalt
const CO2_LAST_SQ = BASIS_MAKRO.emissions * PRESETS.status_quo.co2 / 1000;

function dezilDaten() {
  const tsd = v => ohneVz(v / 1000, 0);
  const rumpf = DEZILE.map((d, i) => [
    d.label, tsd(d.brutto), ohneVz(d.kapital * 100, 0), ohneVz(d.konsum * 100, 0), ohneVz(d.gewicht, 1),
    tsd(d.vermoegen), ohneVz(d.anzahl, 2), ohneVz(d.rente_anteil * 100, 1), ohneVz(MPC_DEZIL[i], 2),
    ohneVz(KINDER_JE_HH[i], 2), ohneVz(BUERGERGELD_QUOTE[i], 2), ohneVz(CO2_LAST_SQ * 1000 * CO2_GEWICHT[i], 0),
  ].join(' & ') + ' \\\\').join('\n');
  return `\\begin{tabular}{lrrrrrrrrrrr}\n\\toprule\n` +
    `Dezil & $B_i$ & $\\kappa_i$ & $c_i$ & $w_i$ & $V_i$ & $N_i$ & $\\rho_i$ & $m_i$ & $k_i$ & $q_i$ & $\\ell_i$ \\\\\n` +
    ` & Tsd.\\,\\euro{} & \\% & \\% & & Tsd.\\,\\euro{} & Mio. & \\% & & & & \\euro{} \\\\\n\\midrule\n${rumpf}\n\\bottomrule\n\\end{tabular}\n`;
}

function elastTabelle() {
  const rumpf = Object.entries(ELAST).map(([k, v]) => {
    const q = ELAST_QUELLEN[k] ?? {};
    return `\\texttt{${esc(k)}} & ${ohneVz(v, 3).replace('-', '$-$')} & ${esc(q.range ?? '')} & ${esc(q.ref ?? '')} \\\\`;
  }).join('\n');
  return `\\begin{longtable}{p{2.6cm}rp{2.2cm}p{8.2cm}}\n\\toprule\nSchlüssel & Wert & Spanne & Fundstelle \\\\\n\\midrule\n\\endhead\n${rumpf}\n\\bottomrule\n\\end{longtable}\n`;
}

function quellenTabelle() {
  const gruppen = [['berechne.js', FORMEL_QUELLEN_BERECHNE], ['einkommensteuer.js', FORMEL_QUELLEN_EST], ['verteilung.js', FORMEL_QUELLEN_VERT]];
  const rumpf = gruppen.map(([datei, q]) =>
    `\\multicolumn{2}{l}{\\textbf{\\texttt{${esc(datei)}}}} \\\\\n` +
    Object.entries(q).map(([k, e]) =>
      `\\texttt{${esc(k)}} & {\\formelschrift ${esc(e.formel)}}\\newline ${esc(e.ref)} \\\\`).join('\n')
  ).join('\n\\midrule\n');
  return `\\begin{longtable}{p{3.2cm}p{11.6cm}}\n\\toprule\nQuelle & Formel und Fundstelle \\\\\n\\midrule\n\\endhead\n${rumpf}\n\\bottomrule\n\\end{longtable}\n`;
}

function schreibe() {
  const hier = path.dirname(fileURLToPath(import.meta.url));
  const ziel = path.join(hier, 'generiert');
  fs.mkdirSync(ziel, { recursive: true });
  const m = messe();
  const w = (name, inhalt) => fs.writeFileSync(path.join(ziel, name),
    `% Erzeugt von docs/modell/messung.js — nicht von Hand bearbeiten\n${inhalt}`);
  w('makros.tex', makros(m));
  w('zerlegung.tex', zerlegungTabelle(m));
  w('symmetrie.tex', symmetrieTabelle(m));
  w('gesamtmatrix.tex', gesamtMatrix(m));
  w('daten_dezile.tex', dezilDaten());
  w('elastizitaeten.tex', elastTabelle());
  w('quellen.tex', quellenTabelle());
  w('verlauf.tex', verlaufTabelle(m));
  w('kanaele.tex', tabelle(m.tisch, KANAELE, 'kanal', STELLGROESSEN));
  w('kennzahlen.tex', tabelle(m.tisch, KENNZAHLEN, 'kennzahl', STELLGROESSEN));
  w('pfad.tex', tabelle(m.tisch, PFAD, 'pfad', STELLGROESSEN));
  w('dezile.tex', dezilTabelle(m.tisch, STELLGROESSEN));
  w('weitere_kennzahlen.tex', tabelle(m.weitere, KENNZAHLEN, 'kennzahl', WEITERE));
  w('weitere_pfad.tex', tabelle(m.weitere, PFAD, 'pfad', WEITERE));
  // Strichstärke relativ zum größten Wert über ALLE Stellgrößen am Tisch,
  // damit die vier Ressortgraphen untereinander vergleichbar sind
  // — je Einheit, nicht je Kanal: 0,3 Mrd. Erbschaftsteuer sollen dünner sein als 15,7 Mrd. Beiträge
  const maxJeEinheit = e => Math.max(1e-9, ...KANAELE.filter(k => k.einheit === e)
    .flatMap(k => m.tisch.map(z => Math.abs(z.kanal[k.id]))));
  const zeilenMax = Object.fromEntries(KANAELE.map(k => [k.id, maxJeEinheit(k.einheit)]));
  for (const r of ['Finanzen', 'Wirtschaft', 'Soziales', 'Umwelt']) {
    const keys = STELLGROESSEN.filter(s => s.ressort === r).map(s => s.key);
    w(`graph_${r}.tex`, ressortGraph(m.tisch.filter(z => keys.includes(z.key)), zeilenMax));
  }
  for (const [key, daten] of Object.entries(verlaufDaten(m))) {
    fs.writeFileSync(path.join(ziel, `verlauf_${key}.dat`), daten);
  }
  fs.writeFileSync(path.join(ziel, 'messung.json'), JSON.stringify(m, null, 1) + '\n');
  return m;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const m = schreibe();
  console.log(`${m.tisch.length + m.weitere.length} Stellgrößen gemessen, Dateien in docs/modell/generiert/`);
}
