// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Seeded randomness
//
// Everything visual that should be STABLE per team (the country outline) or
// reproducible per round (tile textures, article picks) derives from these
// two functions. DOM-free — unit-tested in tests/ui.test.js.
//
//   hashString('Team A/sess:abc') → uint32 seed
//   mulberry32(seed)              → () => float [0,1), deterministic stream
// ═══════════════════════════════════════════════════════════════════════════

/** FNV-1a 32-bit string hash — fast, good avalanche for short keys. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — tiny, fast, deterministic; ~2^32 period. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience: deterministic float in [min, max) from a stream. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Convenience: deterministic int in [min, max] inclusive. */
export function rangeInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

/** Deterministic pick from an array. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}