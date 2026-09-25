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
import { PRESETS, DEZILE, KAPITALANTEIL, PRIVAT_ANPASSUNG, KURS_KONFIG_DEFAULT } from '../../js/data.js';

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
  { key: 'verm',      bez: 'Vermögensteuer',       schritt: 0.1,    einheit: '0,1 Pp.' },
  { key: 'boden',     bez: 'Bodenwertsteuer',      schritt: 0.1,    einheit: '0,1 Pp.' },
  // 1 Pp.: unter 0,3 % greift die Anrechnung der Einkommensteuer, 0,1 Pp. wirkte gar nicht
  { key: 'zucman',    bez: 'Zucman-Mindeststeuer', schritt: 1,      einheit: '1 Pp.' },
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
  { id: 'bip',     bez: 'BIP 2041',             einheit: 'Mrd. €',  f: (p) => p.at(-1).result.bip_aktuell },
  { id: 'co2kum',  bez: 'CO₂ 2025–2040',        einheit: 'Mt',      f: (p) => p.at(-1).zustand.co2_kumulat },
  { id: 'saldo',   bez: 'Saldo 2041–44',        einheit: 'Mrd. €/a', f: (p) => p.at(-1).result.saldo },
  { id: 'gini',    bez: 'Gini 2041–44',         einheit: 'Gini-Pkt.', f: (p) => p.at(-1).result.gini * 100 },
];

const pfad = params => simulierePfad(Array.from({ length: PERIODEN }, () => ({ ...params })));

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
    const ab  = b1.result.saldo - pfad({ ...SQ, [s.key]: SQ[s.key] - s.schritt })[0].result.saldo;
    return { auf, ab };
  };
  // Strukturelle Gewichte: wie ein Kanal auf eine Kennzahl weiterwirkt. Nicht
  // gemessen, sondern aus den Gleichungen der Engine bei Status-quo-Werten
  const r1 = b1.result, n = KURS_KONFIG_DEFAULT.perioden_laenge_jahre;
  const struktur = {
    // ∂Saldo/∂Nachfrage: alle Einnahmen außer CO₂ skalieren mit dem Nachfragefaktor
    stabilisator: (r1.einnahmen_total - r1.rev.co2) / r1.bip_aktuell,
    // BIP-Niveau je 1 % Arbeitsangebot (ab der Folgeperiode), Mrd. €
    arbeit_bip:   (1 - KAPITALANTEIL) * r1.bip_aktuell / 100,
    // BIP-Niveau je 1 % Investitionsfaktor: langfristig und nach einer Periode, Mrd. €
    invest_bip_lang: KAPITALANTEIL * r1.bip_aktuell / 100,
    invest_bip_n:    KAPITALANTEIL * r1.bip_aktuell / 100 * (1 - Math.pow(1 - PRIVAT_ANPASSUNG, n)),
    anpassung_n:  1 - Math.pow(1 - PRIVAT_ANPASSUNG, n),
    // Schuldenquote je 1 Mrd. € Saldo über eine Periode, Pp. (ohne Zinseszins)
    saldo_schuld: -n / r1.bip_aktuell * 100,
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
const ohneVz = (v, nk = 1) => Number(v.toFixed(nk)).toLocaleString('de-DE', { minimumFractionDigits: nk, maximumFractionDigits: nk });
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

function graphKanten(zeilen, zeilenMax) {
  const aus = [];
  for (const z of zeilen) {
    for (const k of KANAELE) {
      const v = z.kanal[k.id];
      if (Math.abs(v) < (SCHWELLE[k.einheit] ?? 0.3)) continue;
      const staerke = (0.4 + 2.2 * Math.abs(v) / zeilenMax[k.id]).toFixed(2);
      aus.push(`\\wkante{${z.key}}{${k.id}}{${v >= 0 ? 'pos' : 'neg'}}{${staerke}}{${ohneVz(v, NK[k.einheit] ?? 1).replace('-', '$-$')}}`);
    }
  }
  return aus.join('\n') + '\n';
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
  return zeilen.map(([n, v]) => `\\newcommand{\\${n}}{${v.replace('-', '$-$')}}`).join('\n') + '\n';
}

function verlaufTabelle(m) {
  const rumpf = m.statusQuo.verlauf.map(e =>
    `${e.label.replace('–', '--')} & ${ohneVz(e.bip, 0)} & ${ohneVz(e.schuldenquote, 1)} & ${ohneVz(e.saldo, 1)} & ${ohneVz(e.saldo_pct, 2)} & ${ohneVz(e.struktur, 2)} & ${ohneVz(e.emissionen, 0)} & ${ohneVz(e.co2_kumulat, 0)} & ${ohneVz(e.gini, 3)} \\\\`
  ).join('\n').replace(/-(\d)/g, '$-$$1');
  return `\\begin{tabular}{lrrrrrrrr}\n\\toprule\nPeriode & BIP & Schulden & Saldo & Saldo & strukt. & Emiss. & CO\\textsubscript{2} kum. & Gini \\\\\n & Mrd.\\,\\euro{} & \\% BIP & Mrd.\\,\\euro{} & \\% BIP & \\% BIP & Mt/a & Mt & \\\\\n\\midrule\n${rumpf}\n\\bottomrule\n\\end{tabular}\n`;
}

function verlaufDaten(m) {
  // pgfplots-Tabellen: x und Kennzahlen je Stellgröße
  return Object.fromEntries(Object.entries(m.verlaeufe).map(([key, pkt]) => [key,
    'x saldo gini emiss bip\n' + pkt.map(p => [p.x, p.saldo, p.gini, p.emiss, p.bip].map(v => v.toFixed(4)).join(' ')).join('\n') + '\n']));
}

function schreibe() {
  const hier = path.dirname(fileURLToPath(import.meta.url));
  const ziel = path.join(hier, 'generiert');
  fs.mkdirSync(ziel, { recursive: true });
  const m = messe();
  const w = (name, inhalt) => fs.writeFileSync(path.join(ziel, name),
    `% Erzeugt von docs/modell/messung.js — nicht von Hand bearbeiten\n${inhalt}`);
  w('makros.tex', makros(m));
  w('verlauf.tex', verlaufTabelle(m));
  w('kanaele.tex', tabelle(m.tisch, KANAELE, 'kanal', STELLGROESSEN));
  w('kennzahlen.tex', tabelle(m.tisch, KENNZAHLEN, 'kennzahl', STELLGROESSEN));
  w('pfad.tex', tabelle(m.tisch, PFAD, 'pfad', STELLGROESSEN));
  w('dezile.tex', dezilTabelle(m.tisch, STELLGROESSEN));
  w('weitere_kennzahlen.tex', tabelle(m.weitere, KENNZAHLEN, 'kennzahl', WEITERE));
  w('weitere_pfad.tex', tabelle(m.weitere, PFAD, 'pfad', WEITERE));
  // Strichstärke relativ zum größten Wert des Kanals über ALLE Stellgrößen am Tisch,
  // damit die vier Ressortgraphen untereinander vergleichbar sind
  const zeilenMax = Object.fromEntries(KANAELE.map(k =>
    [k.id, Math.max(1e-9, ...m.tisch.map(z => Math.abs(z.kanal[k.id])))]));
  for (const r of ['Finanzen', 'Wirtschaft', 'Soziales', 'Umwelt']) {
    const keys = STELLGROESSEN.filter(s => s.ressort === r).map(s => s.key);
    w(`graph_${r}.tex`, graphKanten(m.tisch.filter(z => keys.includes(z.key)), zeilenMax));
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
