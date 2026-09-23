// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// SPIELKERN — was alle ausgearbeiteten Entwuerfe gemeinsam haben
//
// Fuenf Entwuerfe stehen zur Wahl. Wenn jeder von ihnen seine eigene
// Uebersetzung zur Engine mitbraechte, unterschieden sie sich am Ende nicht
// nur im Aussehen, sondern in den Zahlen — und der Vergleich waere wertlos.
// Darum steht die Uebersetzung genau einmal hier, und die Entwuerfe sind
// reine Ansichten darauf.
//
// Die Engine (js/rechner/, js/data.js) wird ausschliesslich GELESEN. Kein
// Wert, keine Elastizitaet und keine Formel entsteht in dieser Datei; was
// hier steht, sind Bezeichnungen, Grenzen und Rundungen fuer die Anzeige.
//
// Kein fetch(), kein localStorage: diese Flaechen laufen vollstaendig lokal.
// Sie sind Entwuerfe und sprechen mit keinem Server.
// ═══════════════════════════════════════════════════════════════════════════

import { berechne, FORMEL_QUELLEN_BERECHNE } from './rechner/berechne.js';
import { FORMEL_QUELLEN_VERT }               from './rechner/verteilung.js';
import { berechneTransition }                from './rechner/transition.js';
import { PRESETS, PERIOD_STATE_0, KURS_KONFIG_DEFAULT } from './data.js';

// ── Der Kurs ───────────────────────────────────────────────────────────────

export const RUNDEN       = KURS_KONFIG_DEFAULT.perioden_anzahl;
export const JAHRE_JE_RUNDE = KURS_KONFIG_DEFAULT.perioden_laenge_jahre;
const STARTJAHR = 2025;

/** Die Jahre, fuer die eine Runde entscheidet — "2025–2028". */
export function jahreDerRunde(runde) {
  const von = STARTJAHR + (runde - 1) * JAHRE_JE_RUNDE;
  return { von, bis: von + JAHRE_JE_RUNDE - 1, text: `${von}–${von + JAHRE_JE_RUNDE - 1}` };
}

// ── Die Stellgroessen ──────────────────────────────────────────────────────
//
// Reihenfolge, Bezeichnung und Ressortzuschnitt sind Gestaltung; Schluessel,
// Grenzen und Quellenverweis sind an die Engine gebunden. `ab` sagt, ab
// welcher Runde ein Ressort mitspielt — die Flaeche soll in Runde 1 nicht
// zwoelf Regler auf einmal zumuten.

export const RESSORTS = [
  { id: 'fin', name: 'Finanzen und Steuern',      kurz: 'Finanzen',  ab: 1, kennzahl: 'saldo', stell: [
    { key: 'freibetrag', bez: 'Grundfreibetrag',         einheit: '€',   min: 0,  max: 30000, nk: 0, quelle: 'arbeitsangebot' },
    { key: 'eingang',    bez: 'Eingangssteuersatz',      einheit: '%',   min: 0,  max: 40,    nk: 1, quelle: 'arbeitsangebot' },
    { key: 'spitze',     bez: 'Spitzensteuersatz',       einheit: '%',   min: 20, max: 75,    nk: 1, quelle: 'arbeitsangebot' },
    { key: 'mwst',       bez: 'Umsatzsteuer, Regelsatz', einheit: '%',   min: 0,  max: 30,    nk: 1, quelle: 'mwst_konsumanteil' },
    { key: 'erb',        bez: 'Erbschaftsteuer',         einheit: '%',   min: 0,  max: 60,    nk: 0, quelle: 'erbschaft' },
  ]},
  { id: 'wir', name: 'Wirtschaft und Unternehmen', kurz: 'Wirtschaft', ab: 1, kennzahl: 'bip', stell: [
    { key: 'kst',   bez: 'Körperschaftsteuer',     einheit: '%', min: 0, max: 40, nk: 1, quelle: 'dynamisches_scoring' },
    { key: 'gewst', bez: 'Gewerbesteuer-Messzahl', einheit: '%', min: 0, max: 30, nk: 1, quelle: 'dynamisches_scoring' },
  ]},
  { id: 'soz', name: 'Arbeit und Soziales',        kurz: 'Soziales',  ab: 1, kennzahl: 'gini', stell: [
    { key: 'rv', bez: 'Rentenversicherung',  einheit: '%',       min: 10, max: 30,   nk: 1, quelle: 'sv_beitraege' },
    { key: 'kv', bez: 'Krankenversicherung', einheit: '%',       min: 10, max: 25,   nk: 1, quelle: 'sv_beitraege' },
    { key: 'bg', bez: 'Bürgergeld',          einheit: '€/Monat', min: 0,  max: 1500, nk: 0, quelle: 'armutsrisiko' },
    { key: 'kg', bez: 'Kindergeld',          einheit: '€/Monat', min: 0,  max: 1000, nk: 0, quelle: 'armutsrisiko' },
  ]},
  { id: 'umw', name: 'Umwelt und Klima',           kurz: 'Umwelt',    ab: 1, kennzahl: 'emissionen', stell: [
    { key: 'co2',       bez: 'CO₂-Preis',           einheit: '€/t',     min: 0, max: 300, nk: 0, quelle: 'co2_emissionen' },
    { key: 'klimageld', bez: 'Klimageld auszahlen', einheit: 'ja/nein', klappe: true,           quelle: 'co2_emissionen' },
  ]},
];

export const ALLE = RESSORTS.flatMap(r => r.stell);
export const ZU_RESSORT = Object.fromEntries(
  RESSORTS.flatMap(r => r.stell.map(s => [s.key, r])));

// ── Die Kennzahlen ─────────────────────────────────────────────────────────
//
// `absolut: true` heisst: die Veraenderung wird als Differenz gezeigt, nicht
// als Prozentsatz. Beim Saldo ist das keine Feinheit, sondern notwendig —
// von −119 auf −69 ist keine Steigerung um 42 %, und ein Vorzeichenwechsel
// macht jede Prozentangabe vollends sinnlos.

export const KENNZAHLEN = [
  { id: 'saldo',      name: 'Haushaltssaldo', kurz: 'Saldo',    einheit: 'Mrd. €', n: 0,
    lies: r => r.saldo,       gut: 'hoch',    absolut: true },
  { id: 'gini',       name: 'Ungleichheit',   kurz: 'Gini',     einheit: '',       n: 3,
    lies: r => r.gini,        gut: 'niedrig', absolut: true },
  { id: 'emissionen', name: 'Emissionen',     kurz: 'CO₂',      einheit: 'Mio. t', n: 0,
    lies: r => r.emissionen,  gut: 'niedrig', absolut: true },
  { id: 'bip',        name: 'Wirtschaftsleistung', kurz: 'BIP', einheit: 'Mrd. €', n: 0,
    lies: r => r.bip_aktuell, gut: 'hoch',    absolut: true },
];

/** Was die vier Hauptkennzahlen nicht zeigen, aber jede Bewertung braucht. */
export const NEBENWERTE = [
  { id: 'zusatzlast',  name: 'Zusatzlast',  einheit: 'Mrd. €', n: 1,
    lies: r => r.dwl,           gut: 'niedrig',
    hilfe: 'Wohlfahrtsverlust der Besteuerung — was die Volkswirtschaft über das '
         + 'Aufkommen hinaus kostet.' },
  { id: 'armut',       name: 'Armutsrisiko', einheit: '%',     n: 1,
    lies: r => r.armutsrisiko,  gut: 'niedrig',
    hilfe: 'Anteil unter 60 % des Medianeinkommens, nach Steuern und Transfers.' },
  { id: 'einnahmen',   name: 'Einnahmen',    einheit: 'Mrd. €', n: 1,
    lies: r => r.einnahmen_total, gut: 'hoch', hilfe: 'Alle Einnahmen des Staates in dieser Periode.' },
  { id: 'ausgaben',    name: 'Ausgaben',     einheit: 'Mrd. €', n: 1,
    lies: r => r.ausgaben_total,  gut: 'niedrig', hilfe: 'Alle Ausgaben des Staates in dieser Periode.' },
];

export const QUELLEN = { ...FORMEL_QUELLEN_BERECHNE, ...FORMEL_QUELLEN_VERT };

/** Die Quellen, die in DIESER Flaeche wirklich referenziert werden. */
export function benutzteQuellen() {
  const gesehen = new Set();
  return ALLE.map(s => s.quelle)
    .filter(q => QUELLEN[q] && !gesehen.has(q) && gesehen.add(q))
    .map(q => ({ id: q, ...QUELLEN[q],
                 stell: ALLE.filter(s => s.quelle === q).map(s => s.bez) }));
}

// ── Zahlen schreiben ───────────────────────────────────────────────────────

export const rund = (v, n) => Number(v.toFixed(n));

/**
 * Eine Zahl in deutscher Schreibung. Das Minus ist das typografische U+2212,
 * nicht der Bindestrich, den toLocaleString liefert: nebeneinander gesetzt
 * sind beide sofort als zwei verschiedene Striche zu erkennen, und eine
 * Flaeche, die beide mischt, sieht schlampig gesetzt aus.
 */
export const zahl = (v, n = 0) => v
  .toLocaleString('de-DE', { minimumFractionDigits: n, maximumFractionDigits: n })
  .replace('-', '\u2212');

export const mitVz = (v, n = 0) => (v > 0 ? '+' : v < 0 ? '\u2212' : '±') + zahl(Math.abs(v), n);

/**
 * Die Differenz zweier Kennzahlwerte — GERUNDET, dann subtrahiert.
 *
 * Andersherum stimmt die Zeile nicht: −118,64 und −69,08 werden als −119 und
 * −69 angezeigt, ihre ungerundete Differenz ist 49,56 und erscheint als +50.
 * 119 − 69 ist aber 50, nicht 49. Wer drei Zahlen nebeneinander sieht, rechnet
 * nach; wenn es dann nicht aufgeht, ist die ganze Flaeche verdaechtig.
 */
export function zeigDiff(kennzahl, a, b) {
  return rund(kennzahl.lies(a), kennzahl.n) - rund(kennzahl.lies(b), kennzahl.n);
}

/** Die Veraenderung als fertiger Text, mit der richtigen Einheit. */
export function diffText(kennzahl, a, b) {
  const d = zeigDiff(kennzahl, a, b);
  if (d === 0) return { d, text: 'unverändert', richtung: 'gleich' };
  const besser = kennzahl.gut === 'hoch' ? d > 0 : d < 0;
  // Eine Quote in Prozent aendert sich um PROZENTPUNKTE. "Armutsrisiko 14,0 %,
  // −1,7 %" laesst offen, ob 1,7 Punkte oder 1,7 Prozent des Wertes gemeint
  // sind — in einem Lehrplanspiel ist genau das der Unterschied, den die
  // Veranstaltung beibringen soll.
  const einheit = kennzahl.einheit === '%' ? ' %-Punkte'
                : kennzahl.einheit ? ` ${kennzahl.einheit}` : '';
  return { d, text: `${mitVz(d, kennzahl.n)}${einheit}`,
           richtung: besser ? 'besser' : 'schlechter' };
}

/**
 * Prozent oder Prozentpunkte — das ist keine Wortklauberei.
 * Ein Satz von 45 auf 62 steigt um 17 PROZENTPUNKTE (und um 38 Prozent).
 */
export const punkteText = (von, nach, n = 1) =>
  `${mitVz(rund(nach, n) - rund(von, n), n)} Prozentpunkte`;

/**
 * Der Saldo, wie er unter den GEDRUCKTEN Summen stehen muss.
 *
 * Die Engine liefert 1694,5911 und 1763,6754; ihr Saldo ist −69,0842. Gerundet
 * erscheinen sie als 1.694,59 und 1.763,68 — und deren Differenz ist −69,09,
 * nicht −69,08. Eine Aufstellung, in der die gedruckten Zahlen nicht aufgehen,
 * ist in einem Lehrplanspiel wertlos: wer drei Zahlen untereinander sieht,
 * rechnet nach. Darum wird der ausgewiesene Saldo aus den AUSGEWIESENEN
 * Summanden gebildet, nicht danebengestellt.
 */
export function gedruckterSaldo(ergebnis, n = 2) {
  return rund(rund(ergebnis.einnahmen_total, n) - rund(ergebnis.ausgaben_total, n), n);
}

export const wertText = (s, v) => s.klappe ? (v ? 'ja' : 'nein') : zahl(v, s.nk ?? 0);

/** Eine Eingabe lesen. Gibt niemals NaN weiter. */
export function liesEingabe(text, s) {
  const roh = String(text).trim().replace(/\./g, '').replace(',', '.');
  if (roh === '') return { fehler: 'Bitte einen Wert eintragen.' };
  const v = Number(roh);
  if (!Number.isFinite(v)) return { fehler: 'Das ist keine Zahl.' };
  if (v < s.min) return { fehler: `Nicht unter ${zahl(s.min, s.nk)} ${s.einheit}.`, wert: v };
  if (v > s.max) return { fehler: `Nicht über ${zahl(s.max, s.nk)} ${s.einheit}.`,  wert: v };
  return { wert: v };
}

/**
 * Wohin der Kurs laeuft, wenn ab jetzt nichts mehr entschieden wird.
 *
 * Kein Trend und keine Faustformel: die restlichen Runden werden mit
 * denselben Funktionen vorgerollt, mit denen auch gespielt wird
 * (berechne + berechneTransition). Was hier steht, koennte das Kabinett
 * durch blosses Nichtstun erreichen — und genau das ist die Aussage.
 */
export function vorausschau(zustand, params, abRunde) {
  const bahn = [];
  let z = { ...zustand };
  for (let r = abRunde; r <= RUNDEN; r++) {
    // Ueber den Status quo legen, nicht ersetzen: wer nur einzelne Groessen
    // uebergibt (etwa {} fuer "gar kein Beschluss"), bekaeme sonst eine
    // Engine ohne Steuersaetze — und als Ergebnis NaN.
    const e = berechne({ ...PRESETS.status_quo, ...params }, z);
    bahn.push({ runde: r, jahre: jahreDerRunde(r), ergebnis: e, zustand: z });
    if (r < RUNDEN) z = berechneTransition(z, e, jahreDerRunde(r + 1).von, JAHRE_JE_RUNDE);
  }
  return bahn;
}

/**
 * Den Weg eines Teams nachspielen.
 *
 * Die Sitzungsverwaltung speichert nur die Parameter je Periode — sie rechnet
 * nichts. Wer als Lehrperson wissen will, wo ein Team steht, muss den Weg
 * also nachspielen: Periode fuer Periode berechnen und dazwischen den
 * Periodenuebergang laufen lassen, genau wie am Tisch.
 *
 * Das ist keine Schaetzung und keine zweite Rechnung — es ist DIESELBE
 * Rechnung mit denselben Funktionen. Zwei Wege zur selben Zahl waeren der
 * Anfang vom Ende der Glaubwuerdigkeit.
 */
export function spieleNach(perioden) {
  const sortiert = [...(perioden ?? [])].sort((a, b) => a.idx - b.idx);
  let zustand = { ...PERIOD_STATE_0 };
  const bahn = [];
  for (const p of sortiert) {
    const params = { ...PRESETS.status_quo, ...(p.params ?? {}) };
    const ergebnis = berechne(params, zustand);
    bahn.push({ idx: p.idx, jahre: jahreDerRunde(p.idx + 1), params, ergebnis, zustand });
    zustand = berechneTransition(zustand, ergebnis,
                                 jahreDerRunde(p.idx + 2).von, JAHRE_JE_RUNDE);
  }
  return bahn;
}

// ── Der Spielstand ─────────────────────────────────────────────────────────

/**
 * Ein Spiel ueber mehrere Runden.
 *
 * `basis` ist die Fortschreibung: was herauskaeme, wenn diese Runde nichts
 * entscheidet. Jede Anzeige misst gegen sie, nicht gegen eine Realweltzahl —
 * sonst kann eine Politik im Modell nicht gelingen.
 *
 * Beim Rundenschluss laeuft der Periodenuebergang der Engine
 * (berechneTransition): Schuldenstand, BIP, kumuliertes CO2 und die
 * Lohnbasis werden fortgeschrieben. Die naechste Runde startet damit auf
 * dem Boden, den die vorige hinterlassen hat.
 */
export function erzeugeSpiel() {
  let runde    = 1;
  let zustand  = { ...PERIOD_STATE_0 };
  let params   = { ...PRESETS.status_quo };
  let basis    = berechne({ ...params }, zustand);
  let ergebnis = basis;
  const verlauf = [];
  const horcher = [];

  const melde = (was) => horcher.forEach(f => f(was));
  const neuRechnen = () => { ergebnis = berechne({ ...params }, zustand); };

  return {
    get runde()    { return runde; },
    get params()   { return params; },
    get basis()    { return basis; },
    get ergebnis() { return ergebnis; },
    get zustand()  { return zustand; },
    get verlauf()  { return verlauf; },
    get jahre()    { return jahreDerRunde(runde); },
    get letzteRunde() { return runde >= RUNDEN; },

    /**
     * Die Werte, mit denen DIESE Runde begonnen hat — der Beschluss der
     * vorigen Runde, in Runde 1 der Status quo. Alles, was die Flaeche als
     * "bewegt" zeigt, misst gegen diesen einen Bezug; zwei verschiedene
     * Bezugspunkte in einer Flaeche waeren eine Falle.
     */
    get startwerte() {
      return verlauf.length ? verlauf[verlauf.length - 1].params : PRESETS.status_quo;
    },

    /** Steht diese Stellgroesse anders als zum Rundenstart? */
    bewegt(key) { return params[key] !== this.startwerte[key]; },

    /** Alle Stellgroessen, die in dieser Runde bewegt wurden. */
    get bewegte() {
      const start = this.startwerte;
      return ALLE.filter(s => params[s.key] !== start[s.key]);
    },

    setze(key, wert) {
      if (params[key] === wert) return;
      params = { ...params, [key]: wert };
      neuRechnen();
      melde({ art: 'wert', key });
    },

    /** Runde schliessen und die Folgen in die naechste Periode tragen. */
    schliesseRunde() {
      if (runde >= RUNDEN) return false;
      verlauf.push({ runde, jahre: jahreDerRunde(runde), params: { ...params },
                     ergebnis, basis });
      zustand = berechneTransition(zustand, ergebnis,
                                   jahreDerRunde(runde + 1).von, JAHRE_JE_RUNDE);
      runde  += 1;
      basis   = berechne({ ...params }, zustand);
      ergebnis = basis;
      melde({ art: 'runde' });
      return true;
    },

    aufAenderung(f) { horcher.push(f); return () => horcher.splice(horcher.indexOf(f), 1); },
  };
}
