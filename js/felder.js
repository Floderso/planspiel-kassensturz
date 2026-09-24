// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// FELDER — Eingabe und Fehlerverhalten, gemeinsam fuer alle fuenf Entwuerfe
//
// Getrennt vom Spielkern, weil hier das DOM vorkommt und dort nicht.
//
// Warum gemeinsam: die fuenf Entwuerfe werden VERGLICHEN. Wenn einer von
// ihnen eine ungueltige Eingabe anders behandelt als die anderen, vergleicht
// man am Ende Fehlerbehandlungen statt Gestaltungsideen.
// ═══════════════════════════════════════════════════════════════════════════

import { liesEingabe, wertText, rund } from './spielkern.js';

/**
 * Haengt ein Textfeld oder eine ja/nein-Klappe an eine Stellgroesse.
 *
 * `felder` liefert zu einer Stellgroesse ihre drei Knoten. Fehlt einer, wird
 * die Stellgroesse uebersprungen — ein Entwurf darf eine Groesse weglassen,
 * aber nicht halb anbinden.
 */
export function bindeAlle(spiel, stellgroessen, felder) {
  for (const s of stellgroessen) {
    const { eingabe, fehler, zeile } = felder(s) ?? {};
    if (!eingabe) continue;

    if (s.klappe) {
      eingabe.addEventListener('click', () => {
        spiel.setze(s.key, eingabe.getAttribute('aria-pressed') !== 'true');
      });
      continue;
    }
    eingabe.addEventListener('input',  () => pruefe(spiel, s, eingabe, fehler, zeile, false));
    eingabe.addEventListener('change', () => pruefe(spiel, s, eingabe, fehler, zeile, true));
    // Enter soll dasselbe tun wie das Verlassen des Feldes: bestaetigen.
    eingabe.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); eingabe.blur(); }
    });
  }
}

/**
 * `endgueltig` trennt das Tippen vom Bestaetigen.
 *
 * Waehrend des Tippens wird nichts angemeckert und nichts umgeschrieben:
 * sonst kann man die "1" nicht eintippen, um zur "14" zu kommen, weil sie
 * sofort als "unter dem Mindestwert" beanstandet und ersetzt wuerde.
 */
export function pruefe(spiel, s, eingabe, fehler, zeile, endgueltig) {
  const gelesen = liesEingabe(eingabe.value, s);
  const setzeFehler = (text) => {
    if (!fehler) return;
    fehler.textContent = text ?? '';
    fehler.hidden = !text;
    if (zeile) zeile.dataset.fehler = text ? 'true' : 'false';
  };

  if (gelesen.fehler) {
    if (!endgueltig) return;
    // Der Wert wird in den zulaessigen Bereich zurueckgeholt. Danach ist das
    // Feld GUELTIG — aria-invalid waere jetzt falsch und meldete einer
    // Vorlesesoftware einen Fehler, den es nicht mehr gibt. Die Meldung sagt
    // stattdessen, was mit der Eingabe geschehen ist.
    const lesbar  = gelesen.wert !== undefined;
    const zurueck = lesbar ? Math.min(s.max, Math.max(s.min, gelesen.wert))
                           : spiel.params[s.key];
    setzeFehler(lesbar
      ? `Auf ${wertText(s, zurueck)} ${s.einheit} begrenzt — mehr lässt das Modell nicht zu.`
      : `${gelesen.fehler} Zurück auf ${wertText(s, zurueck)} ${s.einheit}.`);
    eingabe.removeAttribute('aria-invalid');
    eingabe.value = wertText(s, zurueck);
    spiel.setze(s.key, zurueck);
    return;
  }

  setzeFehler(null);
  eingabe.removeAttribute('aria-invalid');
  spiel.setze(s.key, rund(gelesen.wert, s.nk ?? 0));
  if (endgueltig) eingabe.value = wertText(s, spiel.params[s.key]);
}

/** Die Klappen nachziehen, ohne die Felder neu zu setzen. */
export function zieheKlappenNach(spiel, stellgroessen, felder) {
  for (const s of stellgroessen.filter(x => x.klappe)) {
    const { eingabe } = felder(s) ?? {};
    if (!eingabe) continue;
    const an = Boolean(spiel.params[s.key]);
    eingabe.setAttribute('aria-pressed', an ? 'true' : 'false');
    eingabe.textContent = an ? 'ja' : 'nein';
  }
}
