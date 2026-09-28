// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// TESTS · Modelldokumentation aktuell
//
// docs/modell/modell.tex druckt Wirkungen, die docs/modell/messung.js aus der
// Engine misst und in docs/modell/generiert/ ablegt. Ändert sich die Engine,
// stimmen die Zahlen im Dokument nicht mehr — ohne dass es jemand merkt.
// Dieser Test misst neu und vergleicht mit dem abgelegten Stand.
//
// Rot? Dann: node docs/modell/messung.js, PDF neu übersetzen
// (cd docs/modell && latexmk -pdf modell.tex), beides committen.
// ═══════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { messe } from '../docs/modell/messung.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ABGELEGT = path.join(wurzel, 'docs', 'modell', 'generiert', 'messung.json');

/** Alle Zahlen eines Objekts mit Pfad, für eine lesbare Fehlermeldung */
function zahlen(o, pfad = '', aus = []) {
  if (typeof o === 'number') aus.push([pfad, o]);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) zahlen(v, `${pfad}.${k}`, aus);
  return aus;
}

test('Die Zahlen der Modelldokumentation entsprechen der Engine', () => {
  const alt = JSON.parse(fs.readFileSync(ABGELEGT, 'utf8'));
  const neu = JSON.parse(JSON.stringify(messe()));   // gleiche Serialisierung wie die Datei
  const a = new Map(zahlen(alt)), n = zahlen(neu);
  assert.equal(a.size, n.length, 'Aufbau der Messung hat sich geändert — messung.js neu laufen lassen');
  const abweichend = n.filter(([p, v]) => !(Math.abs(v - a.get(p)) <= 1e-6 * Math.max(1, Math.abs(v))))
                      .map(([p, v]) => `${p}: abgelegt ${a.get(p)}, jetzt ${v}`);
  assert.deepEqual(abweichend.slice(0, 10), [],
    `docs/modell/generiert ist veraltet (${abweichend.length} Werte) — node docs/modell/messung.js`);
});

test('Jede Stellgröße am Tisch ist gemessen', async () => {
  const { ALLE } = await import('../js/spielkern.js');
  const { STELLGROESSEN } = await import('../docs/modell/messung.js');
  const fehlt = ALLE.map(s => s.key).filter(k => !STELLGROESSEN.some(s => s.key === k));
  assert.deepEqual(fehlt, [], 'neue Stellgröße am Tisch — in docs/modell/messung.js aufnehmen');
});
