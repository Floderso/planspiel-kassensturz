// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// SPEICHER — der einzige Ort, der localStorage anfasst
//
// Dieselbe Regel wie bei server.js: EINE Datei fasst die Aussenwelt an, und
// sie spricht Fachsprache statt Technik. `tests/architektur.test.js` haelt
// das nach — ein `localStorage` ausserhalb dieses Ordners faellt durch.
//
// Warum es die Datei bis jetzt nicht gab: sie wurde nie gebraucht. Mit dem
// Verhandlungstisch aendert sich das — Sitznamen sollen ein Neuladen
// ueberleben, und spaeter kommt der Sitzungstoken dazu.
//
// ── Was hier NICHT hineingehoert ───────────────────────────────────────────
// Keine Matrikelnummern, keine Namen Dritter, kein Kennwort. Der Browser
// eines Studierenden ist kein sicherer Ort: ein geteiltes Geraet im
// Rechnerpool gibt alles weiter, was hier liegt. Gespeichert wird nur, was
// die Person selbst eingetippt hat und was ohne Schaden verloren gehen darf.
// ═══════════════════════════════════════════════════════════════════════════

const RAUM = 'kassensturz';

/**
 * Jeder Zugriff ist gekapselt.
 *
 * localStorage wirft: im privaten Fenster, bei gesperrten Website-Daten,
 * bei vollem Kontingent. Eine Oberflaeche darf daran nicht sterben — sie
 * soll dann eben nichts merken.
 */
function sicher(tuWas, rueckfall = null) {
  try { return tuWas(); } catch { return rueckfall; }
}

const schluessel = (bereich, id) => `${RAUM}:${bereich}:${id}`;

/** Etwas merken. Gibt zurueck, ob es geklappt hat. */
export function merke(bereich, id, wert) {
  return sicher(() => {
    localStorage.setItem(schluessel(bereich, id), JSON.stringify(wert));
    return true;
  }, false);
}

/** Etwas zurueckholen — oder die Vorgabe, wenn nichts da ist. */
export function hole(bereich, id, vorgabe = null) {
  return sicher(() => {
    const roh = localStorage.getItem(schluessel(bereich, id));
    return roh === null ? vorgabe : JSON.parse(roh);
  }, vorgabe);
}

/** Etwas vergessen. */
export function vergiss(bereich, id) {
  return sicher(() => { localStorage.removeItem(schluessel(bereich, id)); return true; }, false);
}

/** Einen ganzen Bereich vergessen — etwa beim Verlassen eines Kurses. */
export function vergissBereich(bereich) {
  return sicher(() => {
    const praefix = `${RAUM}:${bereich}:`;
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(praefix)) localStorage.removeItem(k);
    }
    return true;
  }, false);
}

/** Laeuft hier ueberhaupt ein brauchbarer Speicher? */
export function verfuegbar() {
  return sicher(() => {
    const probe = `${RAUM}:probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  }, false);
}

// ── Fachliche Zugriffe ───────────────────────────────────────────────────────
//
// Die Oberflaechen benutzen diese und nicht merke/hole direkt — so steht die
// Form der Daten an einer Stelle und nicht in fuenf Dateien verstreut.

/** Die Namen an den vier Plaetzen eines Tisches. */
export const merkeSitznamen = (kursId, namen) => merke('sitz', kursId ?? 'lokal', namen);
export const holeSitznamen  = (kursId)        => hole('sitz', kursId ?? 'lokal', {});

/** Welches Ressort diese Person zuletzt bearbeitet hat. */
export const merkeRessort = (kursId, ressort) => merke('ressort', kursId ?? 'lokal', ressort);
export const holeRessort  = (kursId)          => hole('ressort', kursId ?? 'lokal', null);
