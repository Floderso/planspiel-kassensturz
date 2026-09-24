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
import { berechneTransition, applySchock }   from './rechner/transition.js';
import { PRESETS, PERIOD_STATE_0, KURS_KONFIG_DEFAULT, MOD_DEFS,
         SCHOCK_BIBLIOTHEK } from './data.js';

// ── Der Kurs ───────────────────────────────────────────────────────────────
//
// Wie viele Runden, wie lang, welche Ereignisse, welche Werkzeuge. Das legt
// die Lehrperson fest (einrichtung.html, leitung.html) — NICHT diese Datei.
// Bis 24.09.2026 stand hier fest "5 Runden zu 4 Jahren", und die Spielflaeche
// rechnete damit auch dann, wenn der Kurs anders angelegt war.
//
// Ohne Sitzung gilt der Standardkurs. RUNDEN und JAHRE_JE_RUNDE bleiben als
// seine Werte stehen, weil die Entwuerfe in js/entwurf/ sie lesen.

const STARTJAHR = 2025;

export const STANDARDKURS = Object.freeze({
  runden:    KURS_KONFIG_DEFAULT.perioden_anzahl,
  laengen:   Object.freeze(Array(KURS_KONFIG_DEFAULT.perioden_anzahl)
               .fill(KURS_KONFIG_DEFAULT.perioden_laenge_jahre)),
  schocks:   Object.freeze([]),
  werkzeuge: null,
  ressorts:  null,
});
export const RUNDEN         = STANDARDKURS.runden;
export const JAHRE_JE_RUNDE = KURS_KONFIG_DEFAULT.perioden_laenge_jahre;

/**
 * Der Kurs, wie ihn die Sitzungsverwaltung beschreibt.
 *
 * Nimmt die oeffentliche Sicht ebenso wie die Adminsicht — beide tragen
 * dieselben Felder. Was fehlt, kommt aus dem Standardkurs.
 */
export function kursAus(sitzung) {
  if (!sitzung) return STANDARDKURS;
  const runden = Math.max(1, Math.min(12, Math.round(Number(sitzung.perioden_anzahl) || RUNDEN)));
  const roh = sitzung.perioden_laenge_jahre ?? JAHRE_JE_RUNDE;
  const laengen = Array.from({ length: runden }, (_, i) => {
    const n = Array.isArray(roh) ? (roh[i] ?? roh.at(-1)) : roh;
    return Math.max(1, Math.min(20, Math.round(Number(n) || JAHRE_JE_RUNDE)));
  });
  return {
    runden, laengen,
    schocks:   Array.isArray(sitzung.schocks) ? sitzung.schocks : [],
    werkzeuge: sitzung.perioden_werkzeuge ?? null,
    ressorts:  Array.isArray(sitzung.ressorts) && sitzung.ressorts.length ? sitzung.ressorts : null,
  };
}

/** Wie viele Jahre eine Runde dauert. Hinter der letzten gilt die letzte Laenge. */
export function laengeDerRunde(runde, kurs = STANDARDKURS) {
  return kurs.laengen[runde - 1] ?? kurs.laengen.at(-1) ?? JAHRE_JE_RUNDE;
}

/** Die Jahre, fuer die eine Runde entscheidet — "2025–2028". */
export function jahreDerRunde(runde, kurs = STANDARDKURS) {
  let von = STARTJAHR;
  for (let r = 1; r < runde; r++) von += laengeDerRunde(r, kurs);
  const bis = von + laengeDerRunde(runde, kurs) - 1;
  return { von, bis, text: bis > von ? `${von}–${bis}` : `${von}` };
}

// ── Ereignisse ─────────────────────────────────────────────────────────────
//
// Was ein Ereignis bewirkt, steht EINMAL: in SCHOCK_BIBLIOTHEK (js/data.js).
// Die Sitzung speichert zwar eine Kopie, gerechnet wird aber mit dem Eintrag
// der Bibliothek, gefunden ueber die Kennung. Sonst koennte eine alte Kopie
// in der Sitzung andere Zahlen tragen als die Bibliothek — zwei Wahrheiten.
//
// Angewandt wird wie in simulierePfad() (js/rechner/transition.js): auf den
// Zustand zu Beginn der Runde, und der Uebergang in die naechste Runde geht
// vom getroffenen Zustand aus. Ein BIP-Einbruch bleibt also im Niveau.

/** Das Ereignis einer Runde, aufgeloest gegen die Bibliothek — oder null. */
export function schockDerRunde(runde, kurs = STANDARDKURS) {
  const eintrag = (kurs.schocks ?? []).find(s => s.periode === runde - 1);
  return eintrag ? (SCHOCK_BIBLIOTHEK.find(b => b.id === eintrag.id) ?? null) : null;
}

/** Der Zustand, mit dem eine Runde gerechnet wird: der Anfangszustand samt Ereignis. */
const wirksam = (zustand, runde, kurs) => applySchock(zustand, schockDerRunde(runde, kurs));

/**
 * Was ein Ereignis bewirkt, als Klartext — und ob das Modell es rechnet.
 *
 * Die Bibliothek kennt fuenf Effekte, applySchock() rechnet drei davon. Die
 * anderen zwei zu zeigen, als wirkten sie, waere eine Behauptung, die die
 * Zahlen nicht decken. Also werden sie gezeigt UND als ungerechnet markiert.
 */
export function schockWirkung(schock) {
  if (!schock) return [];
  const e = schock.effekte ?? {};
  const pct = (v) => zahl(v * 100, 1).replace(/,0$/, '');
  const teile = [];
  if (e.bip_malus)     teile.push({ text: `BIP ${'−'}${pct(e.bip_malus)} %`, wirkt: true });
  if (e.schuld_bonus)  teile.push({ text: `Schuldenquote +${zahl(e.schuld_bonus, 1).replace(/,0$/, '')} Prozentpunkte`, wirkt: true });
  if (e.zins_bonus)    teile.push({ text: `Zins +${pct(e.zins_bonus)} Prozentpunkte beim Übergang`, wirkt: true });
  if (e.invest_malus)  teile.push({ text: `Investitionen ${'−'}${pct(e.invest_malus)} %`, wirkt: false });
  if (e.co2_reduktion) teile.push({ text: `Emissionen ${'−'}${pct(e.co2_reduktion)} %`, wirkt: false });
  return teile;
}

export const SCHOCKS = SCHOCK_BIBLIOTHEK;

// ── Die Stellgroessen ──────────────────────────────────────────────────────
//
// Reihenfolge, Bezeichnung und Ressortzuschnitt sind Gestaltung; Schluessel,
// Grenzen und Quellenverweis sind an die Engine gebunden. `modul` ist das
// Werkzeug aus MOD_DEFS, zu dem die Stellgroesse gehoert — daran haengt die
// schrittweise Freischaltung: die Flaeche soll in Runde 1 nicht zwoelf Regler
// auf einmal zumuten, wenn die Lehrperson das nicht will.

export const RESSORTS = [
  { id: 'fin', name: 'Finanzen und Steuern',      kurz: 'Finanzen',  kennzahl: 'saldo', stell: [
    { key: 'freibetrag', bez: 'Grundfreibetrag',         einheit: '€',   min: 0,  max: 30000, nk: 0, quelle: 'arbeitsangebot',    modul: 'est' },
    { key: 'eingang',    bez: 'Eingangssteuersatz',      einheit: '%',   min: 0,  max: 40,    nk: 1, quelle: 'arbeitsangebot',    modul: 'est' },
    { key: 'spitze',     bez: 'Spitzensteuersatz',       einheit: '%',   min: 20, max: 75,    nk: 1, quelle: 'arbeitsangebot',    modul: 'est' },
    { key: 'mwst',       bez: 'Umsatzsteuer, Regelsatz', einheit: '%',   min: 0,  max: 30,    nk: 1, quelle: 'mwst_konsumanteil', modul: 'mwst' },
    { key: 'erb',        bez: 'Erbschaftsteuer',         einheit: '%',   min: 0,  max: 60,    nk: 0, quelle: 'erbschaft',         modul: 'verm' },
  ]},
  { id: 'wir', name: 'Wirtschaft und Unternehmen', kurz: 'Wirtschaft', kennzahl: 'bip', stell: [
    { key: 'kst',   bez: 'Körperschaftsteuer',     einheit: '%', min: 0, max: 40, nk: 1, quelle: 'dynamisches_scoring', modul: 'kst' },
    { key: 'gewst', bez: 'Gewerbesteuer-Messzahl', einheit: '%', min: 0, max: 30, nk: 1, quelle: 'dynamisches_scoring', modul: 'kst' },
  ]},
  { id: 'soz', name: 'Arbeit und Soziales',        kurz: 'Soziales',  kennzahl: 'gini', stell: [
    { key: 'rv', bez: 'Rentenversicherung',  einheit: '%',       min: 10, max: 30,   nk: 1, quelle: 'sv_beitraege', modul: 'sv' },
    { key: 'kv', bez: 'Krankenversicherung', einheit: '%',       min: 10, max: 25,   nk: 1, quelle: 'sv_beitraege', modul: 'sv' },
    { key: 'bg', bez: 'Bürgergeld',          einheit: '€/Monat', min: 0,  max: 1500, nk: 0, quelle: 'armutsrisiko', modul: 'transfers' },
    { key: 'kg', bez: 'Kindergeld',          einheit: '€/Monat', min: 0,  max: 1000, nk: 0, quelle: 'armutsrisiko', modul: 'transfers' },
  ]},
  { id: 'umw', name: 'Umwelt und Klima',           kurz: 'Umwelt',    kennzahl: 'emissionen', stell: [
    { key: 'co2',       bez: 'CO₂-Preis',           einheit: '€/t',     min: 0, max: 300, nk: 0, quelle: 'co2_emissionen', modul: 'co2' },
    { key: 'klimageld', bez: 'Klimageld auszahlen', einheit: 'ja/nein', klappe: true,           quelle: 'co2_emissionen', modul: 'co2' },
  ]},
];

export const ALLE = RESSORTS.flatMap(r => r.stell);
export const ZU_RESSORT = Object.fromEntries(
  RESSORTS.flatMap(r => r.stell.map(s => [s.key, r])));

/** Die Ressorts, die in diesem Kurs am Tisch sitzen — in fester Reihenfolge. */
export function ressortsIm(kurs = STANDARDKURS) {
  if (!kurs.ressorts) return RESSORTS;
  const drin = RESSORTS.filter(r => kurs.ressorts.includes(r.id));
  return drin.length ? drin : RESSORTS;
}

// ── Werkzeuge und ihre Freischaltung ───────────────────────────────────────
//
// Ein Werkzeug ist eine Gruppe von Stellgroessen (ein Eintrag aus MOD_DEFS).
// Die Sitzung speichert je Periode die offenen Werkzeuge:
//     perioden_werkzeuge = { "0": ["est", "kst", "co2"], "1": [...], … }
// Fehlt der Eintrag fuer eine Periode, ist dort alles offen.
//
// Die klassische Flaeche (admin.html) schreibt in dasselbe Feld Ressortnamen
// ("finanzen", "klima"). Die werden verstanden: ein freigegebenes Ressort
// oeffnet alle seine Werkzeuge. So bricht keine alte Sitzung.

export const WERKZEUGE = (() => {
  const gesehen = new Map();
  for (const r of RESSORTS) for (const s of r.stell) {
    if (!gesehen.has(s.modul)) {
      gesehen.set(s.modul, { id: s.modul, name: MOD_DEFS[s.modul]?.name ?? s.modul,
                             ressort: r.id, stell: [] });
    }
    gesehen.get(s.modul).stell.push(s);
  }
  return [...gesehen.values()];
})();

const KLASSISCH = { finanzen: 'fin', wirtschaft: 'wir', soziales: 'soz', klima: 'umw' };

/** Die offenen Werkzeuge einer Runde als Menge — oder null, wenn alles offen ist. */
export function offeneWerkzeuge(runde, kurs = STANDARDKURS) {
  const liste = kurs.werkzeuge?.[runde - 1] ?? kurs.werkzeuge?.[String(runde - 1)];
  if (!Array.isArray(liste)) return null;
  const offen = new Set();
  for (const eintrag of liste) {
    if (WERKZEUGE.some(w => w.id === eintrag)) offen.add(eintrag);
    else if (KLASSISCH[eintrag]) {
      for (const w of WERKZEUGE) if (w.ressort === KLASSISCH[eintrag]) offen.add(w.id);
    }
  }
  return offen;
}

/** Ist dieses Werkzeug (oder das Werkzeug dieser Stellgroesse) in der Runde offen? */
export function istOffen(modulOderStell, runde, kurs = STANDARDKURS) {
  const id = typeof modulOderStell === 'string' ? modulOderStell : modulOderStell.modul;
  const offen = offeneWerkzeuge(runde, kurs);
  return offen === null || offen.has(id);
}

/** Ab welcher Runde ein Werkzeug offen ist — null, wenn es im Kurs nie aufgeht. */
export function abRunde(modul, kurs = STANDARDKURS) {
  for (let r = 1; r <= kurs.runden; r++) if (istOffen(modul, r, kurs)) return r;
  return null;
}

/**
 * Aus "Werkzeug → ab Runde" die Form, die die Sitzung speichert.
 * Werkzeuge ohne Eintrag sind von Runde 1 an offen.
 */
export function werkzeugeAusAb(ab, runden) {
  return Object.fromEntries(Array.from({ length: runden }, (_, i) => [String(i),
    WERKZEUGE.filter(w => (ab[w.id] ?? 1) <= i + 1).map(w => w.id)]));
}

// ── Die Kennzahlen ─────────────────────────────────────────────────────────
//
// `absolut: true` heisst: die Veraenderung wird als Differenz gezeigt, nicht
// als Prozentsatz. Beim Saldo ist das keine Feinheit, sondern notwendig —
// von −119 auf −69 ist keine Steigerung um 42 %, und ein Vorzeichenwechsel
// macht jede Prozentangabe vollends sinnlos.
//
// `spanne` ist die kleinste Hoehe, die eine Verlaufskurve dieser Kennzahl
// abbildet (js/diagramme.js). Ohne sie zoegen die Kurven jede Aenderung auf
// volle Hoehe: ein BIP-Unterschied von 0,1 % saehe aus wie ein Einbruch.
// Eine Darstellungsgroesse, keine Modellannahme.

export const KENNZAHLEN = [
  { id: 'saldo',      name: 'Haushaltssaldo', kurz: 'Saldo',    einheit: 'Mrd. €', n: 0,
    lies: r => r.saldo,       gut: 'hoch',    absolut: true, spanne: 40 },
  { id: 'gini',       name: 'Ungleichheit',   kurz: 'Gini',     einheit: '',       n: 3,
    lies: r => r.gini,        gut: 'niedrig', absolut: true, spanne: 0.02 },
  { id: 'emissionen', name: 'Emissionen',     kurz: 'CO₂',      einheit: 'Mio. t', n: 0,
    lies: r => r.emissionen,  gut: 'niedrig', absolut: true, spanne: 40 },
  { id: 'bip',        name: 'Wirtschaftsleistung', kurz: 'BIP', einheit: 'Mrd. €', n: 0,
    lies: r => r.bip_aktuell, gut: 'hoch',    absolut: true, spanne: 150 },
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
export function vorausschau(zustand, params, abRunde, kurs = STANDARDKURS) {
  const bahn = [];
  let z = { ...zustand };
  for (let r = abRunde; r <= kurs.runden; r++) {
    // Ueber den Status quo legen, nicht ersetzen: wer nur einzelne Groessen
    // uebergibt (etwa {} fuer "gar kein Beschluss"), bekaeme sonst eine
    // Engine ohne Steuersaetze — und als Ergebnis NaN.
    //
    // Die Ereignisse des Kurses gelten auch hier. Sonst misst jeder Vergleich
    // "mit gegen ohne Beschluss" den Beschluss UND das Ereignis zugleich.
    const w = wirksam(z, r, kurs);
    const e = berechne({ ...PRESETS.status_quo, ...params }, w);
    bahn.push({ runde: r, jahre: jahreDerRunde(r, kurs), ergebnis: e, zustand: z });
    if (r < kurs.runden) {
      z = berechneTransition(w, e, jahreDerRunde(r + 1, kurs).von, laengeDerRunde(r, kurs));
    }
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
export function spieleNach(perioden, kurs = STANDARDKURS) {
  const sortiert = [...(perioden ?? [])].sort((a, b) => a.idx - b.idx);
  let zustand = { ...PERIOD_STATE_0 };
  const bahn = [];
  for (const p of sortiert) {
    const runde = p.idx + 1;
    const params = { ...PRESETS.status_quo, ...(p.params ?? {}) };
    const w = wirksam(zustand, runde, kurs);
    const ergebnis = berechne(params, w);
    bahn.push({ idx: p.idx, jahre: jahreDerRunde(runde, kurs), params, ergebnis, zustand,
                schock: schockDerRunde(runde, kurs) });
    zustand = berechneTransition(w, ergebnis,
                                 jahreDerRunde(runde + 1, kurs).von, laengeDerRunde(runde, kurs));
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
export function erzeugeSpiel(anfangskurs = STANDARDKURS) {
  let kurs     = anfangskurs;
  let runde    = 1;
  let zustand  = { ...PERIOD_STATE_0 };
  let params   = { ...PRESETS.status_quo };
  let basis    = berechne({ ...params }, wirksam(zustand, runde, kurs));
  let ergebnis = basis;
  const verlauf = [];
  const horcher = [];

  const melde = (was) => horcher.forEach(f => f(was));
  const neuRechnen = () => { ergebnis = berechne({ ...params }, wirksam(zustand, runde, kurs)); };
  const startwerte = () => verlauf.length ? verlauf[verlauf.length - 1].params : PRESETS.status_quo;

  return {
    get runde()    { return runde; },
    get params()   { return params; },
    get basis()    { return basis; },
    get ergebnis() { return ergebnis; },
    /** Der Zustand zu Beginn der Runde, OHNE das Ereignis der Runde. */
    get zustand()  { return zustand; },
    get verlauf()  { return verlauf; },
    get kurs()     { return kurs; },
    get runden()   { return kurs.runden; },
    get jahre()    { return jahreDerRunde(runde, kurs); },
    get letzteRunde() { return runde >= kurs.runden; },
    /** Das Ereignis, das diese Runde trifft — oder null. */
    get schock()   { return schockDerRunde(runde, kurs); },

    /**
     * Den Kurs uebernehmen, wie ihn die Sitzung beschreibt.
     *
     * Die Flaeche startet sofort mit dem Standardkurs und erfaehrt den echten
     * erst, wenn die Sitzung geantwortet hat. Basis und Ergebnis der
     * laufenden Runde werden dann neu gerechnet — ein Ereignis in DIESER
     * Runde veraendert beide gleich, die Differenz bleibt der Beschluss.
     */
    setzeKurs(neu) {
      kurs = neu ?? STANDARDKURS;
      basis = berechne({ ...startwerte() }, wirksam(zustand, runde, kurs));
      neuRechnen();
      melde({ art: 'kurs' });
    },

    /**
     * Die Werte, mit denen DIESE Runde begonnen hat — der Beschluss der
     * vorigen Runde, in Runde 1 der Status quo. Alles, was die Flaeche als
     * "bewegt" zeigt, misst gegen diesen einen Bezug; zwei verschiedene
     * Bezugspunkte in einer Flaeche waeren eine Falle.
     */
    get startwerte() { return startwerte(); },

    /** Steht diese Stellgroesse anders als zum Rundenstart? */
    bewegt(key) { return params[key] !== this.startwerte[key]; },

    /** Alle Stellgroessen, die in dieser Runde bewegt wurden. */
    get bewegte() {
      const start = this.startwerte;
      return ALLE.filter(s => params[s.key] !== start[s.key]);
    },

    /**
     * Was eine einzelne Vorlage FUER SICH ergaebe: ihre Aenderungen auf den
     * Rundenstart gelegt, alles andere wie zu Beginn der Runde.
     *
     * Das ist kein Anteil am Gesamtergebnis — zusammen wirken Vorlagen anders
     * als ihre Summe. Wer das anzeigt, muss es dazuschreiben.
     */
    probe(aenderungen) {
      const nach = Object.fromEntries(Object.entries(aenderungen ?? {}).map(([k, w]) => [k, w.nach]));
      return berechne({ ...startwerte(), ...nach }, wirksam(zustand, runde, kurs));
    },

    setze(key, wert) {
      if (params[key] === wert) return;
      params = { ...params, [key]: wert };
      neuRechnen();
      melde({ art: 'wert', key });
    },

    /** Runde schliessen und die Folgen in die naechste Periode tragen. */
    schliesseRunde() {
      if (runde >= kurs.runden) return false;
      verlauf.push({ runde, jahre: jahreDerRunde(runde, kurs), params: { ...params },
                     ergebnis, basis, schock: schockDerRunde(runde, kurs) });
      zustand = berechneTransition(wirksam(zustand, runde, kurs), ergebnis,
                                   jahreDerRunde(runde + 1, kurs).von,
                                   laengeDerRunde(runde, kurs));
      runde  += 1;
      basis   = berechne({ ...params }, wirksam(zustand, runde, kurs));
      ergebnis = basis;
      melde({ art: 'runde' });
      return true;
    },

    aufAenderung(f) { horcher.push(f); return () => horcher.splice(horcher.indexOf(f), 1); },
  };
}
