// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Landform (procedural country outline)
//
// Generates the PERSISTENT shape of a team's country: an organic outline
// (polar harmonics with seeded phases — coast-line feeling, not a rectangle),
// rasterized onto a cell grid. The shape depends ONLY on the team's seed:
// it is identical for the whole game — recognition value per group.
//
//   outlinePoints(seed, n)         → [{x, y}, …] closed polygon, unit space
//   rasterize(seed, size)          → { size, mask: Uint8Array (1 = land) }
//   isBorderCell(mask, size, x, y) → land cell touching non-land
//
// DOM-free — unit-tested in tests/ui.test.js.
// ═══════════════════════════════════════════════════════════════════════════

import { mulberry32, range } from '../seed.js';

export const GRID_SIZE = 20;        // cells per side (architecture doc: 20×20)
const HARMONICS = [2, 3, 5, 7, 9];  // low-frequency wobbles = continent feel
const BASE_RADIUS = 0.36;           // of unit square half-width
const AMP_MAX = 0.16;               // total wobble amplitude cap

/**
 * Closed polygon of the country outline in unit space [0,1]², centered.
 * Sum of seeded sine harmonics on the polar radius: smooth organic blob with
 * bays and peninsulas, always closed (period 2π by construction).
 */
export function outlinePoints(seed, n = 96) {
  const rng = mulberry32(seed);
  // Per-harmonic amplitude + phase from the seeded stream
  const harmonics = HARMONICS.map(k => ({
    k,
    amp: range(rng, 0.02, AMP_MAX / HARMONICS.length * 1.6),
    phase: range(rng, 0, Math.PI * 2),
  }));
  // Slight eccentricity so countries are not circular blobs
  const eccX = range(rng, 0.85, 1.15);
  const eccY = range(rng, 0.85, 1.15);

  const points = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let r = BASE_RADIUS;
    for (const h of harmonics) r += h.amp * Math.sin(h.k * t + h.phase);
    r = Math.max(0.16, Math.min(0.46, r)); // keep clear of the frame
    points.push({
      x: 0.5 + r * eccX * Math.cos(t),
      y: 0.5 + r * eccY * Math.sin(t),
    });
  }
  return points;
}

/**
 * Rasterizes the outline into a size×size land mask (1 = land, 0 = water).
 * Point-in-polygon test per cell center (ray casting).
 */
export function rasterize(seed, size = GRID_SIZE) {
  const polygon = outlinePoints(seed, Math.max(96, size * 6));
  const mask = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size;
      const py = (y + 0.5) / size;
      mask[y * size + x] = pointInPolygon(px, py, polygon) ? 1 : 0;
    }
  }
  return { size, mask };
}

/** Ray-casting point-in-polygon. */
function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Land cell adjacent (4-neighborhood) to water/outside — the coastline. */
export function isBorderCell(mask, size, x, y) {
  if (!mask[y * size + x]) return false;
  return (
    x === 0 || y === 0 || x === size - 1 || y === size - 1 ||
    !mask[y * size + x - 1] || !mask[y * size + x + 1] ||
    !mask[(y - 1) * size + x] || !mask[(y + 1) * size + x]
  );
}

/** Count of land cells — used to convert target shares into cell counts. */
export function landCellCount(mask) {
  let count = 0;
  for (let i = 0; i < mask.length; i++) count += mask[i];
  return count;
}

/** Land ratio sanity guard (tests): countries fill 25–60 % of the frame. */
export function landRatio(mask) {
  return landCellCount(mask) / mask.length;
}