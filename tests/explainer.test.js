// SPDX-License-Identifier: CC-BY-4.0
// Tests: Kausalketten-Explainer erzeugeKausalketten()
//
// Prüft die Erzeugung didaktischer Erklärungen:
// - Nennung ökonomischer Mechanismen (Saez/Chetty, Lewbel/Pendakur, SVR, HANK, Domar)
// - Korrekte Töne (info, good, warn, bad)
// - Vorrang von Schocks und kritischen Defiziten
// - Invarianten: Vollständigkeit aller Pflichtfelder

import test from 'node:test';
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { erzeugeKausalketten } from '../js/rechner/explainer.js';
import { PRESETS, PERIOD_STATE_0, SCHOCK_BIBLIOTHEK } from '../js/data.js';

const SQ = PRESETS.status_quo;

function pruefeKartenInvarianten(karten) {
  assert.ok(Array.isArray(karten), 'Karten müssen ein Array sein');
  assert.ok(karten.length > 0, 'Es muss mindestens eine Karte generiert werden');
  assert.ok(karten.length <= 5, 'Maximal 5 Karten zur Vermeidung kognitiver Überlastung');

  for (const k of karten) {
    assert.ok(typeof k.title === 'string' && k.title.length > 0, 'Titel darf nicht leer sein');
    assert.ok(typeof k.mechanism === 'string' && k.mechanism.length > 0, 'Mechanismus darf nicht leer sein');
    assert.ok(typeof k.text === 'string' && k.text.length > 0, 'Text darf nicht leer sein');
    assert.ok(['info', 'good', 'warn', 'bad'].includes(k.tone), `Ungültiger Ton: ${k.tone}`);
    assert.ok(['fiskus', 'arbeit', 'verteilung', 'investition', 'klima', 'schock'].includes(k.topic), `Ungültiges Thema: ${k.topic}`);
  }
}

test('Status quo erzeugt Ausgangsgleichgewicht oder Defizit-Meldung', () => {
  const res = berechne(SQ, PERIOD_STATE_0);
  const karten = erzeugeKausalketten(SQ, res, PERIOD_STATE_0);
  pruefeKartenInvarianten(karten);
  // Status quo hat strukturelles Defizit (-2,7 % BIP) -> Schuldenbremse wird thematisiert
  const schuldenbremse = karten.find(k => k.mechanism.includes('Struktureller Saldo'));
  assert.ok(schuldenbremse, 'Schuldenbremse sollte im Status quo thematisiert werden');
});

test('Spitzensteuersatz-Erhöhung nennt Saez/Chetty Arbeitsangebotsreaktion', () => {
  const p = { ...SQ, spitze: 50 };
  const res = berechne(p, PERIOD_STATE_0);
  const karten = erzeugeKausalketten(p, res, PERIOD_STATE_0, SQ);
  pruefeKartenInvarianten(karten);

  const spitzenKarte = karten.find(k => k.topic === 'arbeit');
  assert.ok(spitzenKarte, 'Karte zu Arbeitsangebot muss existieren');
  assert.ok(spitzenKarte.mechanism.includes('Saez/Chetty'), 'Muss Saez/Chetty-Konsens nennen');
  assert.ok(spitzenKarte.text.includes('Arbeitsangebot'), 'Text muss Arbeitsangebot erwähnen');
});

test('MwSt-Erhöhung warnt vor regressiver Belastung einkommensschwacher Haushalte', () => {
  const p = { ...SQ, mwst: 22 };
  const res = berechne(p, PERIOD_STATE_0);
  const karten = erzeugeKausalketten(p, res, PERIOD_STATE_0, SQ);
  pruefeKartenInvarianten(karten);

  const mwstKarte = karten.find(k => k.mechanism.includes('Lewbel/Pendakur'));
  assert.ok(mwstKarte, 'Karte zu Lewbel/Pendakur muss existieren');
  assert.equal(mwstKarte.tone, 'warn');
  assert.ok(mwstKarte.text.includes('regressiv'), 'Muss Regressivität erwähnen');
});

test('CO2-Preis mit Klimageld hebt progressive Entlastung hervor', () => {
  const p = { ...SQ, co2: 120, klimageld: true };
  const res = berechne(p, PERIOD_STATE_0);
  const karten = erzeugeKausalketten(p, res, PERIOD_STATE_0, SQ);
  pruefeKartenInvarianten(karten);

  const klimaKarte = karten.find(k => k.topic === 'klima');
  assert.ok(klimaKarte, 'Klimakarte muss existieren');
  assert.equal(klimaKarte.tone, 'good');
  assert.ok(klimaKarte.text.includes('Klimageld'), 'Muss Klimageld-Rückzahlung erwähnen');
});

test('KSt-Erhöhung nennt SVR-Investitionsdämpfung', () => {
  const p = { ...SQ, kst: 25 };
  const res = berechne(p, PERIOD_STATE_0);
  const karten = erzeugeKausalketten(p, res, PERIOD_STATE_0, SQ);
  pruefeKartenInvarianten(karten);

  const invKarte = karten.find(k => k.topic === 'investition');
  assert.ok(invKarte, 'Investitionskarte muss existieren');
  assert.ok(invKarte.mechanism.includes('SVR'), 'Muss SVR nennen');
});

test('Aktiver Schock steht an oberster Priorität (Index 0)', () => {
  const schock = SCHOCK_BIBLIOTHEK[0]; // z.B. Energiepreisschock
  const p = { ...SQ };
  const res = berechne(p, PERIOD_STATE_0);
  const karten = erzeugeKausalketten(p, res, PERIOD_STATE_0, SQ, null, schock);
  pruefeKartenInvarianten(karten);

  assert.equal(karten[0].topic, 'schock');
  assert.equal(karten[0].tone, 'warn');
  assert.ok(karten[0].title.includes(schock.name));
});

test('BGE-Einführung thematisiert Sockelsicherung und Bruttokosten', () => {
  const p = { ...SQ, bge: 1000 };
  const res = berechne(p, PERIOD_STATE_0);
  const karten = erzeugeKausalketten(p, res, PERIOD_STATE_0, SQ);
  pruefeKartenInvarianten(karten);

  const bgeKarte = karten.find(k => k.title.includes('Grundeinkommen'));
  assert.ok(bgeKarte, 'BGE-Karte muss existieren');
  assert.ok(bgeKarte.mechanism.includes('RWI 2024'), 'Muss RWI 2024 zitieren');
});
