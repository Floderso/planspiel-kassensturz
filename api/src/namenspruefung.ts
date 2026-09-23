// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// NAMENSPRUEFUNG — Anzeigenamen von Teams
//
// Diese Datei liegt im Worker und NICHT im Frontend. Eine Wortliste im
// ausgelieferten JavaScript ist eine Anleitung zum Umgehen: man liest sie,
// und weiss genau, was durchgeht. Im Browser laeuft nur eine Formpruefung
// fuer die schnelle Rueckmeldung; verbindlich ist allein diese hier.
//
// ── Die Reihenfolge ist der Punkt ──────────────────────────────────────────
// ERST normalisieren, DANN pruefen. Ohne den Schritt ist jede Wortliste in
// dreissig Sekunden umgangen — `Sch3iss` steht nicht in der Liste, `scheiss`
// schon.
//
// Keine Filterliste faengt alles. Deshalb ist die menschliche Nachkontrolle
// im Leitstand Teil des Entwurfs, nicht die Notloesung dahinter.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ziffern- und Zeichenersatz aufloesen, Zierrat entfernen.
 * Danach bleibt nur, worauf es ankommt: Buchstaben.
 */
export function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')        // Akzente
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[4@]/g, 'a').replace(/[3€]/g, 'e').replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o').replace(/[5$]/g, 's').replace(/7/g, 't')
    .replace(/[^a-z]/g, '')                  // alles Uebrige raus
    .replace(/(.)\1{2,}/g, '$1$1');          // "aaaaa" → "aa"
}

/**
 * Die Wortliste.
 *
 * Bewusst kurz gehalten und ausdruecklich UNVOLLSTAENDIG. Sie ist als
 * Anfang gedacht und gehoert von jemandem gepflegt, der die Sprache der
 * Studierenden kennt — nicht von mir geraten. Siehe
 * entwurf/PLANUNG-AUSBAU.md, Abschnitt 15.
 */
const WORTLISTE = [
  // Beleidigungen und Fäkalsprache (normalisiert)
  'arsch', 'fick', 'fuck', 'scheiss', 'shit', 'wichser', 'bastard', 'schlampe',
  'hure', 'nutte', 'bitch', 'penis', 'vagina', 'porno', 'sex',
  // Verfassungsfeindliches und Diskriminierendes
  'hitler', 'nazi', 'heilhitler', 'sieghail', 'hakenkreuz', 'judensau',
  'neger', 'nigger', 'schwuchtel', 'kanake', 'zigeuner',
  // Drogen und Gewalt
  'kokain', 'heroin', 'crystalmeth', 'amoklauf',
];

export type Namensbefund =
  | { ok: true; name: string }
  | { ok: false; grund: string };

/**
 * Prueft einen gewuenschten Anzeigenamen.
 *
 * Die Ablehnung ist sachlich formuliert. Wer einen Namen ausprobiert, der
 * nicht durchgeht, bekommt keine Belehrung — nur die Auskunft, dass es so
 * nicht geht.
 */
export function pruefeAnzeigename(roh: unknown): Namensbefund {
  const name = String(roh ?? '').trim().replace(/\s+/g, ' ');

  if (name.length < 3)  return { ok: false, grund: 'Der Name braucht mindestens 3 Zeichen.' };
  if (name.length > 40) return { ok: false, grund: 'Der Name darf höchstens 40 Zeichen haben.' };

  if (/https?:\/\/|www\.|\.(de|com|org|net)\b/i.test(name)) {
    return { ok: false, grund: 'Adressen gehören nicht in einen Teamnamen.' };
  }
  if (/\d{5,}/.test(name)) {
    return { ok: false, grund: 'Längere Ziffernfolgen gehen nicht — das sieht aus wie eine Matrikelnummer.' };
  }

  const rein = normalisiere(name);
  if (rein.length < 3) {
    return { ok: false, grund: 'Der Name braucht mindestens 3 Buchstaben.' };
  }
  if (WORTLISTE.some(wort => rein.includes(wort))) {
    return { ok: false, grund: 'Dieser Name geht nicht durch. Sucht euch einen anderen.' };
  }

  return { ok: true, name };
}
