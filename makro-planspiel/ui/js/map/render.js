// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Map renderer (canvas → country, PNG export)
//
// Draws the allocated tile grid as a flat, printed-map-style country:
// water background, jittered flat tile fills (organic texture, NO gradients
// or shadows — the look stays printed, anti-AI), and a crisp ink coastline
// on every edge facing water. PNG export for the end-of-game comparison.
// ═══════════════════════════════════════════════════════════════════════════

import { mulberry32, hashString } from '../seed.js';
import { isBorderCell } from './landform.js';
import { CATEGORY_ID } from './allocation.js';

// Mirror of css/tokens.css tile colors (canvas needs concrete values)
export const TILE_COLORS = {
  land:     '#efe9dc',
  industry: '#8b9094',
  green:    '#6baa75',
  social:   '#b0413e',
  decline:  '#5a4a42',
  water:    '#cdeaf7',
  coast:    '#17242b',
};

const COLOR_BY_ID = {
  [CATEGORY_ID.land]: TILE_COLORS.land,
  [CATEGORY_ID.industry]: TILE_COLORS.industry,
  [CATEGORY_ID.green]: TILE_COLORS.green,
  [CATEGORY_ID.social]: TILE_COLORS.social,
  [CATEGORY_ID.decline]: TILE_COLORS.decline,
};

/** Slightly jitters a hex color's brightness (organic print texture). */
function jittered(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = 1 + amount; // ±amount
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (n & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/**
 * Renders the country onto a canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 * @param {Uint8Array} options.mask  land mask from rasterize()
 * @param {number}     options.size  grid side length
 * @param {Uint8Array} options.tiles category ids from allocateTiles()
 * @param {number}     options.seed  team seed (stable texture)
 * @param {number}     options.cellPx cell size in pixels (default 22)
 */
export function renderMap(canvas, { mask, size, tiles, seed, cellPx = 22 }) {
  const px = size * cellPx;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');

  // Water
  ctx.fillStyle = TILE_COLORS.water;
  ctx.fillRect(0, 0, px, px);

  // Tiles with deterministic brightness jitter
  const rng = mulberry32(seed ^ hashString('texture'));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = y * size + x;
      const jitter = (rng() - 0.5) * 0.12;
      if (!mask[cell]) {
        ctx.fillStyle = jittered(TILE_COLORS.water, jitter * 0.5);
      } else {
        ctx.fillStyle = jittered(COLOR_BY_ID[tiles[cell]] ?? TILE_COLORS.land, jitter);
      }
      ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
    }
  }

  // Coastline: ink edges on land cells facing water
  ctx.strokeStyle = TILE_COLORS.coast;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isBorderCell(mask, size, x, y)) continue;
      const X = x * cellPx, Y = y * cellPx, C = cellPx;
      const cell = y * size + x;
      if (x === 0 || !mask[cell - 1])          { ctx.moveTo(X, Y);     ctx.lineTo(X, Y + C); }
      if (x === size - 1 || !mask[cell + 1])   { ctx.moveTo(X + C, Y); ctx.lineTo(X + C, Y + C); }
      if (y === 0 || !mask[cell - size])       { ctx.moveTo(X, Y);     ctx.lineTo(X + C, Y); }
      if (y === size - 1 || !mask[cell + size]){ ctx.moveTo(X, Y + C); ctx.lineTo(X + C, Y + C); }
    }
  }
  ctx.stroke();

  // Category district outlines (subtle, same ink at lower alpha) — edges
  // between two different non-land categories
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = y * size + x;
      if (!mask[cell]) continue;
      const X = x * cellPx, Y = y * cellPx, C = cellPx;
      if (x < size - 1 && mask[cell + 1] && tiles[cell + 1] !== tiles[cell] && (tiles[cell] || tiles[cell + 1])) {
        ctx.moveTo(X + C, Y); ctx.lineTo(X + C, Y + C);
      }
      if (y < size - 1 && mask[cell + size] && tiles[cell + size] !== tiles[cell] && (tiles[cell] || tiles[cell + size])) {
        ctx.moveTo(X, Y + C); ctx.lineTo(X + C, Y + C);
      }
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Downloads the canvas as a PNG file. */
export function exportMapPng(canvas, filename = 'econland.png') {
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

/** Legend entries for the map (matching TILE_COLORS). */
export const MAP_LEGEND = [
  { label: 'Siedlung',        color: TILE_COLORS.land },
  { label: 'Industrie',       color: TILE_COLORS.industry },
  { label: 'Erneuerbare',     color: TILE_COLORS.green },
  { label: 'Soziale Brennpunkte', color: TILE_COLORS.social },
  { label: 'Brachen',         color: TILE_COLORS.decline },
];