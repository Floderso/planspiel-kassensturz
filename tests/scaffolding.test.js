// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// TESTS · Didaktisches Scaffolding & Werkzeug-Steuerung
// ═══════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';

const SCAFFOLD_PRESETS = {
  scaffolding: (n) => {
    const m = {};
    for (let i = 0; i < n; i++) {
      if (i === 0) m[i] = ['finanzen'];
      else if (i === 1) m[i] = ['finanzen', 'soziales'];
      else if (i === 2) m[i] = ['finanzen', 'soziales', 'klima'];
      else m[i] = ['finanzen', 'soziales', 'klima', 'wirtschaft'];
    }
    return m;
  },
  klima: (n) => {
    const m = {};
    for (let i = 0; i < n; i++) {
      if (i <= 1) m[i] = ['finanzen', 'klima'];
      else m[i] = ['finanzen', 'soziales', 'klima', 'wirtschaft'];
    }
    return m;
  },
  soziales: (n) => {
    const m = {};
    for (let i = 0; i < n; i++) {
      if (i <= 1) m[i] = ['finanzen', 'soziales'];
      else m[i] = ['finanzen', 'soziales', 'klima', 'wirtschaft'];
    }
    return m;
  },
  all: (n) => {
    const m = {};
    for (let i = 0; i < n; i++) {
      m[i] = ['finanzen', 'soziales', 'klima', 'wirtschaft'];
    }
    return m;
  }
};

function istRessortAktiv(config, ressortKey, periodeIdx) {
  const pw = config?.perioden_werkzeuge;
  if (!pw) return true;
  const allowed = pw[periodeIdx] || pw[String(periodeIdx)];
  if (!allowed || !Array.isArray(allowed)) return true;
  return allowed.includes(ressortKey);
}

test('Scaffolding-Preset: Schrittweise Freischaltung (Entlastung)', () => {
  const map = SCAFFOLD_PRESETS.scaffolding(5);

  // Periode 1 (Index 0): Nur Finanzen
  assert.deepEqual(map[0], ['finanzen']);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'finanzen', 0), true);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'soziales', 0), false);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'klima', 0), false);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'wirtschaft', 0), false);

  // Periode 2 (Index 1): Finanzen + Soziales
  assert.deepEqual(map[1], ['finanzen', 'soziales']);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'finanzen', 1), true);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'soziales', 1), true);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'klima', 1), false);

  // Periode 3 (Index 2): + Klima
  assert.deepEqual(map[2], ['finanzen', 'soziales', 'klima']);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'klima', 2), true);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'wirtschaft', 2), false);

  // Periode 4 & 5: Volles Kabinett
  assert.deepEqual(map[3], ['finanzen', 'soziales', 'klima', 'wirtschaft']);
  assert.deepEqual(map[4], ['finanzen', 'soziales', 'klima', 'wirtschaft']);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'wirtschaft', 3), true);
});

test('Klimafokus-Preset: Frühe Klimawerkzeuge', () => {
  const map = SCAFFOLD_PRESETS.klima(4);
  assert.deepEqual(map[0], ['finanzen', 'klima']);
  assert.deepEqual(map[1], ['finanzen', 'klima']);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'klima', 0), true);
  assert.equal(istRessortAktiv({ perioden_werkzeuge: map }, 'soziales', 0), false);
});

test('Fallback: Wenn keine Konfiguration gesetzt ist, sind alle Ressorts aktiv', () => {
  assert.equal(istRessortAktiv({}, 'finanzen', 0), true);
  assert.equal(istRessortAktiv({}, 'klima', 0), true);
  assert.equal(istRessortAktiv(null, 'wirtschaft', 0), true);
});
