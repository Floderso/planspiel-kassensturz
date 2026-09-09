// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Tile allocation (game state → map categories)
//
// Translates the economy state into a tile assignment for the country grid:
//
//   categories:  'land' (neutral settlement) · 'industry' (gray)
//                'green' (renewables) · 'social' (hotspots) · 'decline' (scars)
//
// Clustering: seeded anchor cells per category + multi-source organic growth
// with per-category quotas, then one majority-rule smoothing pass. The result
// is contiguous districts ("industrial belt", "wind coast") — not confetti.
// Anchor positions derive from the team seed alone → districts keep their
// LOCATION across rounds; only their SIZE follows the economy.
//
//   featuresFromState(state, context)        → { industry, green, social, decline }
//   allocateTiles({ mask, size, seed, round, features }) → Uint8Array (category id)
//
// DOM-free — unit-tested in tests/ui.test.js.
// ═══════════════════════════════════════════════════════════════════════════

import { mulberry32, hashString, rangeInt } from '../seed.js';

export const CATEGORIES = ['land', 'industry', 'green', 'social', 'decline'];
export const CATEGORY_ID = Object.fromEntries(CATEGORIES.map((c, i) => [c, i]));

const AVG_DISTRICT_SIZE = 9;  // land cells per district anchor (organic scale)
const MAX_ANCHORS_PER_CATEGORY = 64;

// ── State → target shares ────────────────────────────────────────────────────

const clamp01 = v => Math.min(1, Math.max(0, v));

/**
 * Target shares of LAND cells per category, from the economy state.
 * Legible rules, all clamped to sane bounds:
 *   industry ∝ GDP level vs. start, reduced by mass unemployment
 *   green    ∝ cumulative green public investment
 *   social   ∝ unemployment above NAIRU + inequality above baseline
 *   decline  ∝ deep negative output gaps + debt beyond the risk threshold
 *
 * @param {object} state    economy state (round ≥ 0)
 * @param {object} context  { green_cum } — cumulative green investment (% GDP)
 */
export function featuresFromState(state, context = {}) {
  const gdp_bonus = (state.gdp_index - 100) / 100;               // 0.2 = +20 %
  const industry = clamp01(
    0.22 + 0.5 * gdp_bonus - 0.5 * Math.max(0, state.unemployment - 6) / 100
  );
  const green = clamp01(0.03 + 0.05 * (context.green_cum ?? 0));
  const social = clamp01(
    Math.max(0, state.unemployment - 6) * 0.04 +
    Math.max(0, state.gini - 0.37) * 1.5
  );
  const decline = clamp01(
    Math.max(0, -state.output_gap) * 0.02 +
    Math.max(0, state.debt_ratio - 90) * 0.003
  );

  // Categories compete for land: normalize if the sum exceeds 60 %
  const sum = industry + green + social + decline;
  const cap = 0.6;
  const scale = sum > cap ? cap / sum : 1;
  return {
    industry: industry * scale,
    green: green * scale,
    social: social * scale,
    decline: decline * scale,
  };
}

// ── Allocation (seeded anchors + organic growth) ─────────────────────────────

/**
 * Assigns every land cell a category id.
 *
 * @param {Uint8Array} mask  land mask from landform.rasterize()
 * @param {number} size      grid side length
 * @param {number} seed      team seed (stable → stable district anchors)
 * @param {number} round     current round (unused for anchors; kept for API)
 * @param {object} features  target shares from featuresFromState()
 * @returns {Uint8Array} category id per cell (0 = 'land', see CATEGORY_ID)
 */
export function allocateTiles({ mask, size, seed, features }) {
  const cells = mask.length;
  const landCells = [];
  for (let i = 0; i < cells; i++) if (mask[i]) landCells.push(i);
  const totalLand = landCells.length;
  if (totalLand === 0) return new Uint8Array(cells);

  // Target quotas in cells (priority order: visible changes get placed first)
  const order = ['decline', 'social', 'green', 'industry'];
  const quota = {};
  let assigned = 0;
  for (const cat of order) {
    quota[cat] = Math.round((features[cat] ?? 0) * totalLand);
    assigned += quota[cat];
  }
  // Overflow guard: trim the largest quotas until we fit
  while (assigned > totalLand) {
    const biggest = order.reduce((a, b) => (quota[a] >= quota[b] ? a : b));
    quota[biggest]--; assigned--;
  }

  // ── Anchors: stable positions from the team seed ──
  const anchorRng = mulberry32(seed ^ hashString('anchors'));
  const anchorPool = [...landCells];
  // Deterministic shuffle (Fisher–Yates) — anchor candidates in stable order
  for (let i = anchorPool.length - 1; i > 0; i--) {
    const j = Math.floor(anchorRng() * (i + 1));
    [anchorPool[i], anchorPool[j]] = [anchorPool[j], anchorPool[i]];
  }

  const tiles = new Uint8Array(cells); // 0 = 'land' (default)
  const claimed = new Uint8Array(cells);
  const frontier = []; // { cell, cat }

  let poolCursor = 0;
  for (const cat of order) {
    const nAnchors = Math.min(
      MAX_ANCHORS_PER_CATEGORY,
      Math.max(quota[cat] > 0 ? 1 : 0, Math.round(quota[cat] / AVG_DISTRICT_SIZE))
    );
    for (let a = 0; a < nAnchors && poolCursor < anchorPool.length; a++) {
      const cell = anchorPool[poolCursor++];
      if (claimed[cell]) continue;
      claimed[cell] = 1;
      tiles[cell] = CATEGORY_ID[cat];
      frontier.push({ cell, cat });
    }
  }

  // ── Organic growth: claim random unclaimed land neighbors until quotas fill ──
  const growthRng = mulberry32(seed ^ hashString('growth'));
  const remaining = { ...quota };
  for (const cat of order) {
    remaining[cat] -= frontier.filter(f => f.cat === cat).length;
  }

  let guard = totalLand * 40;
  while (frontier.length > 0 && guard-- > 0) {
    // Pick a random frontier entry whose category still needs cells
    const idx = rangeInt(growthRng, 0, frontier.length - 1);
    const { cell, cat } = frontier[idx];
    if (remaining[cat] <= 0) {
      frontier.splice(idx, 1);
      continue;
    }
    const x = cell % size, y = (cell / size) | 0;
    const neighbors = [];
    if (x > 0) neighbors.push(cell - 1);
    if (x < size - 1) neighbors.push(cell + 1);
    if (y > 0) neighbors.push(cell - size);
    if (y < size - 1) neighbors.push(cell + size);
    const free = neighbors.filter(n => mask[n] && !claimed[n]);
    if (free.length === 0) {
      frontier.splice(idx, 1);
      continue;
    }
    const next = free[rangeInt(growthRng, 0, free.length - 1)];
    claimed[next] = 1;
    tiles[next] = CATEGORY_ID[cat];
    remaining[cat]--;
    frontier.push({ cell: next, cat });
  }

  smooth(tiles, mask, size);
  return tiles;
}

/** One majority-rule pass: isolated specks adopt the neighborhood majority. */
function smooth(tiles, mask, size) {
  const before = Uint8Array.from(tiles);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = y * size + x;
      if (!mask[cell]) continue;
      const counts = new Map();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const n = ny * size + nx;
          if (!mask[n]) continue;
          counts.set(before[n], (counts.get(before[n]) ?? 0) + 1);
        }
      }
      let bestCat = before[cell], bestN = 0;
      for (const [cat, n] of counts) {
        if (n > bestN) { bestN = n; bestCat = cat; }
      }
      // Flip only when clearly outnumbered (keeps borders organic)
      if (bestCat !== before[cell] && bestN >= 5) tiles[cell] = bestCat;
    }
  }
}