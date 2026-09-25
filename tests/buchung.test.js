// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// TESTS · Σ Haushalte = Staatsbuchung
//
// Die zweite Fachprüfung (entwurf/PRUEFUNG-2.md I.4) fand Haushalts- und
// Staatsseite in verschiedenen Welten: 36,5 Mio. Kinder gegen 17 Mio., eine
// CO₂-Last von 60,8 Mrd. gegen 18 Mrd. Aufkommen, 26,3 gegen 37,2 Mrd.
// Bürgergeld. Dazu trafen Unternehmens- und Vermögensteuern keinen Haushalt
// (N1). Hier gilt: Was der Staat für eine Stellgröße mehr ausgibt oder
// einnimmt, kommt in genau dieser Höhe bei den Haushalten an.
// ═══════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { berechne } from '../js/rechner/berechne.js';
import { PRESETS, DEZILE } from '../js/data.js';

const SQ = PRESETS.status_quo;
const BASIS = berechne(SQ);

/** Änderung des Nettoeinkommens aller Haushalte zusammen, Mrd. € */
const haushalte = r => DEZILE.reduce((a, d, i) => a + d.anzahl * r.hh_delta.delta[i], 0) / 1000;

const FAELLE = [
  { name: 'Kindergeld',     p: { kg: 359 },   staat: r => r.kg_auszahlung - BASIS.kg_auszahlung },
  { name: 'Bürgergeld',     p: { bg: 700 },   staat: r => r.bg_auszahlung - BASIS.bg_auszahlung },
  { name: 'CO₂-Preis',      p: { co2: 150 },  staat: r => -(r.rev.co2 - BASIS.rev.co2) },
  { name: 'ohne Klimageld', p: { klimageld: false }, staat: r => -(r.rev.co2 - BASIS.rev.co2) },
  { name: 'KSt',            p: { kst: 25 },   staat: r => -(r.rev.kst + r.rev.gewst - BASIS.rev.kst - BASIS.rev.gewst) },
  { name: 'GewSt',          p: { gewst: 8 },  staat: r => -(r.rev.kst + r.rev.gewst - BASIS.rev.kst - BASIS.rev.gewst) },
  { name: 'ErbSt',          p: { erb: 40 },   staat: r => -(r.rev.erbschaft - BASIS.rev.erbschaft) },
  { name: 'Vermögensteuer', p: { verm: 1 },   staat: r => -(r.rev.vermoegen - BASIS.rev.vermoegen) },
  { name: 'Zucman',         p: { zucman: 2 }, staat: r => -(r.rev.zucman - BASIS.rev.zucman) },
];

for (const f of FAELLE) {
  test(`${f.name}: Haushalte spüren genau, was der Staat bucht`, () => {
    const r = berechne({ ...SQ, ...f.p });
    const hh = haushalte(r), st = f.staat(r);
    assert.ok(Math.abs(st) > 0.1, `${f.name} bewegt nichts`);
    assert.ok(Math.abs(hh - st) < 1e-6, `Haushalte ${hh.toFixed(2)} gegen Staat ${st.toFixed(2)} Mrd. €`);
  });
}

test('Die CO₂-Last der Haushalte ist das Aufkommen, nicht das Dreifache', () => {
  // Ohne Klimageld auf beiden Seiten: Der Wegfall des CO₂-Preises entlastet die
  // Haushalte um genau das Bruttoaufkommen (18 Mrd. € bei 55 €/t), nicht um 60,8 Mrd.
  const mit = berechne({ ...SQ, klimageld: false });
  const ohne = berechne({ ...SQ, co2: 0, klimageld: false });
  const entlastung = haushalte(ohne) - haushalte(mit);
  assert.ok(Math.abs(entlastung - mit.rev.co2) < 1e-6, `Entlastung ${entlastung.toFixed(2)} Mrd. €`);
  assert.ok(Math.abs(mit.rev.co2 - 18) < 0.1);
});

test('Eine höhere Körperschaftsteuer trifft Beschäftigte und Kapitaleigner', () => {
  const r = berechne({ ...SQ, kst: 25 });
  r.hh_delta.delta.forEach((d, i) => assert.ok(d < 0, `${DEZILE[i].label} zahlt nichts`));
  assert.ok(r.hh_delta.delta[11] < r.hh_delta.delta[0], 'D10c trägt absolut mehr als D1');
});
