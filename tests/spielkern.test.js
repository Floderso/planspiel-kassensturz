// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// TESTS · Spielkern — Kurs, Ereignisse, Werkzeuge
//
// Drei Wege fuehren zu den Zahlen einer gespielten Periode: der Tisch
// (erzeugeSpiel), das Nachspielen fuer Leitstand und Auswertung
// (spieleNach) und die Pfadrechnung der Engine (simulierePfad). Sie muessen
// DIESELBE Rechnung sein. Weichen sie ab, zeigt die Leitung andere Zahlen
// als der Tisch — und keiner merkt es, weil jede Flaeche fuer sich plausibel
// aussieht.
// ═══════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  erzeugeSpiel, spieleNach, vorausschau, kursAus, jahreDerRunde, laengeDerRunde,
  schockDerRunde, schockWirkung, STANDARDKURS, KENNZAHLEN,
  WERKZEUGE, ALLE, offeneWerkzeuge, istOffen, abRunde, werkzeugeAusAb, ressortsIm,
} from '../js/spielkern.js';
import { simulierePfad } from '../js/rechner/transition.js';
import { PRESETS, SCHOCK_BIBLIOTHEK } from '../js/data.js';

const SQ = PRESETS.status_quo;
const schock = (id, periode) => ({ ...SCHOCK_BIBLIOTHEK.find(s => s.id === id), periode });

/** Ein Kurs mit ungleichen Laengen und zwei Ereignissen — der unbequeme Fall. */
const KURS = kursAus({
  perioden_anzahl: 4,
  perioden_laenge_jahre: [4, 2, 3, 4],
  schocks: [schock('nachfrage_2', 1), schock('finanz_2', 2)],
});

/** Beschluesse je Runde. Bewusst verschieden, damit Fehler nicht wegmitteln. */
const BESCHLUESSE = [
  { spitze: 48, co2: 80 },
  { spitze: 52, co2: 120, bg: 600 },
  { kst: 18, mwst: 20 },
  { rv: 19.5 },
];

/** Am Tisch spielen: Werte setzen, Runde schliessen. */
function spieleAmTisch(kurs) {
  const spiel = erzeugeSpiel(kurs);
  const ergebnisse = [];
  BESCHLUESSE.slice(0, kurs.runden).forEach((b, i) => {
    for (const [k, v] of Object.entries(b)) spiel.setze(k, v);
    ergebnisse.push(spiel.ergebnis);
    if (i < kurs.runden - 1) spiel.schliesseRunde();
  });
  return ergebnisse;
}

/** Die Beschluesse kumuliert — so stehen sie am Ende jeder Runde in der Sitzung. */
function kumuliert() {
  let p = { ...SQ };
  return BESCHLUESSE.map(b => (p = { ...p, ...b }));
}

// ── Dieselbe Rechnung ─────────────────────────────────────────────────────

test('Tisch, Nachspielen und Engine rechnen dieselben Zahlen — mit Ereignissen', () => {
  const tisch = spieleAmTisch(KURS);
  const nach  = spieleNach(kumuliert().map((params, idx) => ({ idx, params })), KURS);
  const engine = simulierePfad(kumuliert(), {
    perioden_laenge_jahre: KURS.laengen, schocks: KURS.schocks });

  for (let i = 0; i < KURS.runden; i++) {
    for (const k of KENNZAHLEN) {
      assert.equal(k.lies(nach[i].ergebnis), k.lies(tisch[i]),
        `Runde ${i + 1}, ${k.name}: Nachspielen ≠ Tisch`);
      assert.equal(k.lies(engine[i].result), k.lies(tisch[i]),
        `Runde ${i + 1}, ${k.name}: Engine ≠ Tisch`);
    }
  }
});

test('Vorausschau ohne Beschluss = Nachspielen des Status quo', () => {
  const bahn = vorausschau(spieleNach([{ idx: 0, params: {} }], KURS)[0].zustand, {}, 1, KURS);
  const nach = spieleNach(Array.from({ length: KURS.runden }, (_, idx) => ({ idx, params: {} })), KURS);
  bahn.forEach((b, i) => assert.equal(b.ergebnis.saldo, nach[i].ergebnis.saldo, `Runde ${i + 1}`));
});

test('Ein nachtraeglich gesetzter Kurs rechnet die laufende Runde neu, aendert aber nicht den Beschluss', () => {
  const kurs = kursAus({ perioden_anzahl: 5, schocks: [schock('nachfrage_3', 0)] });
  const spiel = erzeugeSpiel();
  spiel.setze('spitze', 55);
  const vorher = spiel.ergebnis.bip_aktuell;
  spiel.setzeKurs(kurs);
  assert.equal(spiel.params.spitze, 55, 'der Beschluss bleibt');
  assert.ok(spiel.ergebnis.bip_aktuell < vorher, 'die Rezession drueckt das BIP');
  assert.ok(spiel.basis.bip_aktuell < vorher, 'auch die Fortschreibung traegt sie');
  assert.equal(spiel.schock?.id, 'nachfrage_3');
});

// ── Komparative Statik ────────────────────────────────────────────────────

test('Ein Nachfrageschock senkt das BIP der getroffenen Runde und hebt die Schuldenquote danach', () => {
  const ohne = kursAus({ perioden_anzahl: 3 });
  const mit  = kursAus({ perioden_anzahl: 3, schocks: [schock('nachfrage_2', 1)] });
  const p = [0, 1, 2].map(idx => ({ idx, params: {} }));
  const a = spieleNach(p, ohne), b = spieleNach(p, mit);
  assert.equal(b[0].ergebnis.bip_aktuell, a[0].ergebnis.bip_aktuell, 'Runde 1 bleibt unberuehrt');
  assert.ok(b[1].ergebnis.bip_aktuell < a[1].ergebnis.bip_aktuell, 'Runde 2: BIP sinkt');
  assert.ok(b[2].zustand.schuldenquote > a[2].zustand.schuldenquote, 'Runde 3 erbt hoehere Schulden');
  assert.ok(b[2].zustand.bip < a[2].zustand.bip, 'der Niveauverlust bleibt');
});

test('Die Richtung eines Beschlusses haengt nicht davon ab, ob ein Ereignis eintritt', () => {
  for (const s of SCHOCK_BIBLIOTHEK) {
    const kurs = kursAus({ perioden_anzahl: 2, schocks: [{ ...s, periode: 0 }] });
    const spiel = erzeugeSpiel(kurs);
    spiel.setze('spitze', 60);
    assert.ok(spiel.ergebnis.saldo > spiel.basis.saldo,
      `${s.id}: hoeherer Spitzensatz muss den Saldo gegenueber der Fortschreibung verbessern`);
  }
});

// ── Invarianten ───────────────────────────────────────────────────────────

test('Jedes Ereignis in jeder Runde liefert endliche Kennzahlen im Definitionsbereich', () => {
  for (const s of SCHOCK_BIBLIOTHEK) {
    for (let periode = 0; periode < 5; periode++) {
      const bahn = spieleNach([0, 1, 2, 3, 4].map(idx => ({ idx, params: {} })),
                              kursAus({ perioden_anzahl: 5, schocks: [{ ...s, periode }] }));
      for (const b of bahn) {
        for (const k of KENNZAHLEN) {
          assert.ok(Number.isFinite(k.lies(b.ergebnis)), `${s.id} P${periode}: ${k.name} endlich`);
        }
        assert.ok(b.ergebnis.gini > 0 && b.ergebnis.gini < 1, `${s.id}: Gini in (0,1)`);
        assert.ok(b.ergebnis.bip_aktuell > 0, `${s.id}: BIP positiv`);
      }
    }
  }
});

test('Gerechnet wird mit der Bibliothek, nicht mit der Kopie in der Sitzung', () => {
  const gefaelscht = { ...schock('energie_1', 0), effekte: { bip_malus: 0.9 } };
  const kurs = kursAus({ schocks: [gefaelscht] });
  assert.deepEqual(schockDerRunde(1, kurs).effekte, SCHOCK_BIBLIOTHEK[0].effekte);
  assert.equal(schockDerRunde(1, kursAus({ schocks: [{ id: 'gibt_es_nicht', periode: 0 }] })), null);
});

test('Jeder Effekt der Bibliothek wird angezeigt — und ob das Modell ihn rechnet', () => {
  const bekannt = { bip_malus: true, schuld_bonus: true, zins_bonus: true,
                    invest_malus: false, co2_reduktion: false };
  for (const s of SCHOCK_BIBLIOTHEK) {
    const schluessel = Object.keys(s.effekte);
    for (const k of schluessel) {
      assert.ok(k in bekannt, `${s.id}: Effekt "${k}" ist neu — schockWirkung() muss ihn kennen`);
    }
    const w = schockWirkung(s);
    assert.equal(w.length, schluessel.length, `${s.id}: kein Effekt faellt still weg`);
    assert.equal(w.filter(x => !x.wirkt).length,
                 schluessel.filter(k => !bekannt[k]).length, `${s.id}: ungerechnete sind markiert`);
  }
});

// ── Der Kurs ──────────────────────────────────────────────────────────────

test('Der Standardkurs: fuenf Runden zu vier Jahren ab 2025', () => {
  assert.equal(STANDARDKURS.runden, 5);
  assert.equal(jahreDerRunde(1).text, '2025–2028');
  assert.equal(jahreDerRunde(2).text, '2029–2032');
});

test('Periodenlaengen: je Periode, aufgefuellt und begrenzt', () => {
  assert.deepEqual(KURS.laengen, [4, 2, 3, 4]);
  assert.equal(jahreDerRunde(3, KURS).text, '2031–2033');
  const k = kursAus({ perioden_anzahl: 3, perioden_laenge_jahre: [1] });
  assert.deepEqual(k.laengen, [1, 1, 1]);
  assert.equal(jahreDerRunde(2, k).text, '2026');
  assert.equal(laengeDerRunde(9, k), 1, 'hinter der letzten gilt die letzte');
  assert.deepEqual(kursAus({ perioden_anzahl: 99, perioden_laenge_jahre: 0 }).laengen.length, 12);
});

test('Ressorts am Tisch: in fester Reihenfolge, nie leer', () => {
  assert.deepEqual(ressortsIm(kursAus({ ressorts: ['umw', 'fin'] })).map(r => r.id), ['fin', 'umw']);
  assert.equal(ressortsIm(kursAus({ ressorts: ['quatsch'] })).length, 4);
  assert.equal(ressortsIm().length, 4);
});

// ── Werkzeuge ─────────────────────────────────────────────────────────────

test('Jede Stellgroesse gehoert zu genau einem Werkzeug', () => {
  const zugeordnet = WERKZEUGE.flatMap(w => w.stell.map(s => s.key));
  assert.deepEqual([...zugeordnet].sort(), ALLE.map(s => s.key).sort());
});

test('Freischaltung: "ab Runde" hin und zurueck', () => {
  const ab = { mwst: 2, verm: 3, sv: 3 };
  const kurs = kursAus({ perioden_anzahl: 4, perioden_werkzeuge: werkzeugeAusAb(ab, 4) });
  for (const w of WERKZEUGE) assert.equal(abRunde(w.id, kurs), ab[w.id] ?? 1, w.id);
  assert.equal(istOffen('mwst', 1, kurs), false);
  assert.equal(istOffen(ALLE.find(s => s.key === 'mwst'), 2, kurs), true);
});

test('Ohne Angabe ist alles offen; alte Ressortnamen oeffnen ganze Ressorts', () => {
  assert.equal(offeneWerkzeuge(1), null);
  assert.equal(istOffen('verm', 1), true);
  const alt = kursAus({ perioden_werkzeuge: { 0: ['finanzen'], 1: ['finanzen', 'klima'] } });
  assert.deepEqual([...offeneWerkzeuge(1, alt)].sort(), ['est', 'mwst', 'verm']);
  assert.equal(istOffen('co2', 1, alt), false);
  assert.equal(istOffen('co2', 2, alt), true);
  assert.equal(istOffen('sv', 3, alt), true, 'Periode ohne Eintrag: alles offen');
});
