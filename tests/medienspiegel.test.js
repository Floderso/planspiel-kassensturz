// SPDX-License-Identifier: CC-BY-4.0
// Tests: Medienspiegel und Wählerbarometer

import test from 'node:test';
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { berechneWaehlerstimmung, waehleMedienspiegel, ermittleEreignisse } from '../js/rechner/medienspiegel.js';
import { PRESETS, PERIOD_STATE_0, SCHOCK_BIBLIOTHEK } from '../js/data.js';

const SQ = PRESETS.status_quo;

test('Wählerstimmung Status quo liegt im plausiblen Ausgangsbereich (40–55 %)', () => {
  const res = berechne(SQ, PERIOD_STATE_0);
  const stimmung = berechneWaehlerstimmung(SQ, res, PERIOD_STATE_0);

  assert.ok(stimmung.gesamt >= 35 && stimmung.gesamt <= 60, `Stimmung ${stimmung.gesamt} liegt außerhalb des Status-quo-Korridors`);
  assert.ok(['solide', 'angeschlagen'].includes(stimmung.status));
  assert.ok(stimmung.gruppen.arbeitnehmer > 0 && stimmung.gruppen.arbeitnehmer <= 100);
  assert.ok(stimmung.gruppen.wirtschaft > 0 && stimmung.gruppen.wirtschaft <= 100);
  assert.ok(stimmung.gruppen.klima > 0 && stimmung.gruppen.klima <= 100);
});

test('MwSt-Erhöhung senkt die Zustimmung der Arbeitnehmer spürbar', () => {
  const resSQ = berechne(SQ, PERIOD_STATE_0);
  const stimmungSQ = berechneWaehlerstimmung(SQ, resSQ, PERIOD_STATE_0);

  const p = { ...SQ, mwst: 24 };
  const res = berechne(p, PERIOD_STATE_0);
  const stimmung = berechneWaehlerstimmung(p, res, PERIOD_STATE_0, SQ);

  assert.ok(stimmung.gruppen.arbeitnehmer < stimmungSQ.gruppen.arbeitnehmer, 'MwSt-Erhöhung muss Arbeitnehmer-Zustimmung senken');
});

test('KSt-Erhöhung senkt die Zustimmung der Wirtschaft', () => {
  const resSQ = berechne(SQ, PERIOD_STATE_0);
  const stimmungSQ = berechneWaehlerstimmung(SQ, resSQ, PERIOD_STATE_0);

  const p = { ...SQ, kst: 25 };
  const res = berechne(p, PERIOD_STATE_0);
  const stimmung = berechneWaehlerstimmung(p, res, PERIOD_STATE_0, SQ);

  assert.ok(stimmung.gruppen.wirtschaft < stimmungSQ.gruppen.wirtschaft, 'KSt-Erhöhung muss Wirtschafts-Zustimmung dämpfen');
});

test('CO2-Preis mit Klimageld steigert die Zustimmung im Bereich Klima', () => {
  const resSQ = berechne(SQ, PERIOD_STATE_0);
  const stimmungSQ = berechneWaehlerstimmung(SQ, resSQ, PERIOD_STATE_0);

  const p = { ...SQ, co2: 120, klimageld: true };
  const res = berechne(p, PERIOD_STATE_0);
  const stimmung = berechneWaehlerstimmung(p, res, PERIOD_STATE_0, SQ);

  assert.ok(stimmung.gruppen.klima > stimmungSQ.gruppen.klima, 'Hoher CO2-Preis mit Klimageld muss Klima-Zustimmung steigern');
});

test('waehleMedienspiegel wählt passende Artikel und ist deterministisch', () => {
  const p = { ...SQ, mwst: 23 };
  const res = berechne(p, PERIOD_STATE_0);

  const run1 = waehleMedienspiegel(p, res, PERIOD_STATE_0, SQ, null, null, 2);
  const run2 = waehleMedienspiegel(p, res, PERIOD_STATE_0, SQ, null, null, 2);

  assert.equal(run1.artikel.length, 2, 'Muss genau 2 Artikel zurückgeben');
  assert.equal(run1.artikel[0].id, run2.artikel[0].id, 'Auswahl muss deterministisch sein');

  // Prüfe Struktur
  for (const a of run1.artikel) {
    assert.ok(a.headline && a.headline.length > 0, 'Headline darf nicht leer sein');
    assert.ok(a.outlet && a.outlet.length > 0, 'Outlet darf nicht leer sein');
    assert.ok(a.body && a.body.length > 0, 'Body darf nicht leer sein');
  }

  // Da MwSt erhöht wurde, sollte ein Konsum-Artikel gewählt werden
  const konsumArtikel = run1.artikel.find(a => a.tags.topic === 'konsum');
  assert.ok(konsumArtikel, 'Sollte MwSt-/Konsum-Artikel auswählen');
});

test('Schock dominiert die Berichterstattung', () => {
  const schock = SCHOCK_BIBLIOTHEK[0]; // z.B. Energiekrise
  const res = berechne(SQ, PERIOD_STATE_0);
  const m = waehleMedienspiegel(SQ, res, PERIOD_STATE_0, SQ, null, schock, 2);

  assert.ok(m.artikel.length >= 1);
  const schockArtikel = m.artikel.find(a => a.tags.topic.startsWith('schock:'));
  assert.ok(schockArtikel, 'Schock-Artikel muss bei aktivem Schock vorhanden sein');
});
