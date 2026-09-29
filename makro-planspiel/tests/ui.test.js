// SPDX-License-Identifier: CC-BY-4.0
// UI logic tests: seeded RNG, landform, tile allocation, news selection,
// and the runtime shock API used by news-event articles.
// All imports are DOM-free by design.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hashString, mulberry32 } from '../ui/js/seed.js';
import { rasterize, outlinePoints, landRatio, isBorderCell, GRID_SIZE } from '../ui/js/map/landform.js';
import { featuresFromState, allocateTiles, CATEGORY_ID, CATEGORIES } from '../ui/js/map/allocation.js';
import { eventsFromTransition, selectArticles } from '../ui/js/news.js';
import { ARTICLES } from '../ui/js/data/articles.js';
import { createGame } from '../src/index.js';

// ── Seeded RNG ───────────────────────────────────────────────────────────────

test('hashString + mulberry32: deterministic and distinct per seed', () => {
  const a1 = mulberry32(hashString('Team A'));
  const a2 = mulberry32(hashString('Team A'));
  const b = mulberry32(hashString('Team B'));
  const seqA1 = [a1(), a1(), a1()];
  const seqA2 = [a2(), a2(), a2()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA1, seqA2, 'same seed → same stream');
  assert.notDeepEqual(seqA1, seqB, 'different seed → different stream');
  for (const v of seqA1) assert.ok(v >= 0 && v < 1);
});

// ── Landform ─────────────────────────────────────────────────────────────────

test('landform: same seed → identical outline; different seeds → different countries', () => {
  const s = hashString('Alpha/sess:1');
  assert.deepEqual(outlinePoints(s), outlinePoints(s));
  assert.notDeepEqual(outlinePoints(s), outlinePoints(hashString('Beta/sess:1')));
});

test('landform: outline stays in frame and produces a sane land ratio', () => {
  for (const name of ['Alpha', 'Beta', 'Gamma', 'Delta']) {
    const seed = hashString(`${name}/sess:1`);
    for (const p of outlinePoints(seed)) {
      assert.ok(p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98, 'outline in frame');
    }
    const { mask } = rasterize(seed);
    const ratio = landRatio(mask);
    assert.ok(ratio > 0.2 && ratio < 0.7, `${name}: land ratio ${ratio.toFixed(2)} plausible`);
  }
});

test('landform: land is contiguous (no orphan islands in the mask)', () => {
  const { mask, size } = rasterize(hashString('Alpha/sess:1'));
  // Flood-fill from the first land cell; all land cells must be reachable
  const first = mask.indexOf(1);
  const seen = new Uint8Array(mask.length);
  const queue = [first];
  seen[first] = 1;
  while (queue.length) {
    const cell = queue.pop();
    const x = cell % size, y = (cell / size) | 0;
    for (const n of [cell - 1, cell + 1, cell - size, cell + size]) {
      const nx = n % size, ny = (n / size) | 0;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || n < 0 || n >= mask.length) continue;
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      if (mask[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
    }
  }
  const landCells = mask.reduce((a, v) => a + v, 0);
  const seenCells = seen.reduce((a, v) => a + v, 0);
  assert.equal(seenCells, landCells, 'every land cell reachable — one connected country');
});

// ── Tile allocation ──────────────────────────────────────────────────────────

const mkMask = rasterize(hashString('Alpha/sess:1'));

test('featuresFromState: recession raises social/decline, green investment raises green', () => {
  const base = { gdp_index: 100, unemployment: 6, gini: 0.374, output_gap: 0, debt_ratio: 60 };
  const crisis = { gdp_index: 98, unemployment: 9, gini: 0.42, output_gap: -3, debt_ratio: 95 };
  const fBase = featuresFromState(base);
  const fCrisis = featuresFromState(crisis);
  assert.ok(fCrisis.social > fBase.social);
  assert.ok(fCrisis.decline > fBase.decline);
  assert.ok(fCrisis.industry < fBase.industry);

  const fGreen = featuresFromState(base, { green_cum: 6 });
  assert.ok(fGreen.green > fBase.green);
});

test('allocateTiles: deterministic, quotas respected, all land assigned', () => {
  const { mask, size } = mkMask;
  const features = { industry: 0.3, green: 0.1, social: 0.08, decline: 0.02 };
  const a = allocateTiles({ mask, size, seed: 42, features });
  const b = allocateTiles({ mask, size, seed: 42, features });
  assert.deepEqual([...a], [...b], 'same seed + features → identical map');

  const counts = new Map();
  let landTotal = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    landTotal++;
    counts.set(a[i], (counts.get(a[i]) ?? 0) + 1);
  }
  assert.equal([...counts.values()].reduce((x, y) => x + y, 0), landTotal, 'every land cell categorized');

  const industryShare = (counts.get(CATEGORY_ID.industry) ?? 0) / landTotal;
  assert.ok(Math.abs(industryShare - 0.3) < 0.08, `industry share ≈ target, got ${industryShare}`);
});

test('allocateTiles: categories form clusters, not confetti', () => {
  const { mask, size } = mkMask;
  const features = { industry: 0.35, green: 0.15, social: 0.1, decline: 0.05 };
  const tiles = allocateTiles({ mask, size, seed: 7, features });

  // Same-category neighbor fraction among non-land categories (4-neighborhood)
  let same = 0, total = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = y * size + x;
      if (!mask[cell] || tiles[cell] === CATEGORY_ID.land) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= size || ny >= size) continue;
        const n = ny * size + nx;
        if (!mask[n] || tiles[n] === CATEGORY_ID.land) continue;
        total++;
        if (tiles[n] === tiles[cell]) same++;
      }
    }
  }
  const clusterRatio = same / total;
  assert.ok(clusterRatio > 0.5, `clustered map (same-neighbor ratio ${clusterRatio.toFixed(2)})`);
});

// ── News selection ───────────────────────────────────────────────────────────

test('eventsFromTransition: shock dominates; thresholds map to topics', () => {
  const prev = { inflation: 2, unemployment: 6, debt_ratio: 60, policy_rate: 3, real_growth: 2, gini: 0.37, credibility: 0.9, emissions_index: 100, shock: null };
  const crisis = { ...prev, inflation: 5, unemployment: 8.5, policy_rate: 5.5, gini: 0.39, shock: { id: 'energy_crisis', name: 'x' } };
  const events = eventsFromTransition(prev, crisis);
  assert.equal(events[0].topic, 'shock:energy_crisis', 'shock is the front page');
  assert.ok(events.some(e => e.topic === 'inflation' && e.direction === 'high'));
  assert.ok(events.some(e => e.topic === 'unemployment' && e.direction === 'high'));
  assert.ok(events.some(e => e.topic === 'rate' && e.direction === 'up'));
  assert.ok(events.some(e => e.topic === 'gini' && e.direction === 'up'));
});

test('selectArticles: matches topics, deterministic, no duplicates, pool integrity', () => {
  const prev = { inflation: 2, unemployment: 6, debt_ratio: 60, policy_rate: 3, real_growth: 2, gini: 0.37, credibility: 0.9, emissions_index: 100, shock: null };
  const hot = { ...prev, inflation: 5, policy_rate: 5 };
  const a = selectArticles({ prev, next: hot, seed: 1, round: 1, count: 2 });
  const b = selectArticles({ prev, next: hot, seed: 1, round: 1, count: 2 });
  assert.deepEqual(a.map(x => x.id), b.map(x => x.id), 'same round → same newspaper');
  assert.equal(new Set(a.map(x => x.id)).size, a.length, 'no duplicate articles');
  assert.ok(a.some(x => x.tags.topic === 'inflation'), 'inflation story selected');

  // Every pool article has the required shape
  for (const art of ARTICLES) {
    assert.ok(art.id && art.outlet && art.headline && art.body && art.tags?.topic, `article ${art.id} complete`);
    if (art.effects) {
      assert.equal(typeof art.effects, 'object', `${art.id}: effects is an object`);
    }
  }
});

// ── Runtime shock API (news events become reality) ──────────────────────────

test('addShock: inline shock applies to a future round; library id works; past rejected', () => {
  const game = createGame({ scenario: 'stable', rounds: 3 });
  game.addShock(2, { id: 'news_tech', name: 'Tech-Hype', effects: { demand: 1.0 } });
  game.advanceRound(); // round 1 — no shock
  const r2 = game.advanceRound(); // round 2 — shock applies
  assert.equal(r2.state.shock.id, 'news_tech');
  assert.ok(r2.state.output_gap > 0.5, 'inline demand effect visible');

  const game2 = createGame({ scenario: 'stable', rounds: 3 });
  game2.addShock(2, 'export_boom');
  game2.advanceRound();
  assert.equal(game2.advanceRound().state.shock.id, 'export_boom');

  assert.throws(() => game.addShock(2, 'export_boom'), /future/);
  assert.throws(() => createGame({ shocks: [{ round: 1, shock: { broken: true } }] }), /Inline shocks/);
});