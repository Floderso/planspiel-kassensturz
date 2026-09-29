// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · News selection (state transition → article tags)
//
// The news desk: derives the round's STORY from the state transition (not
// from the policy package — students read phenomena, not mechanics), then
// picks the best-matching articles from the offline pool, deterministically
// per team and round.
//
//   eventsFromTransition(prev, next)         → [{ topic, direction, weight }]
//   selectArticles({ prev, next, seed, round, count }) → [article, …]
//
// DOM-free — unit-tested in tests/ui.test.js.
// ═══════════════════════════════════════════════════════════════════════════

import { ARTICLES } from './data/articles.js';
import { mulberry32, hashString } from './seed.js';

/**
 * Newsworthy events of a round, weighted by prominence.
 * Topic vocabulary matches the article pool tags.
 */
export function eventsFromTransition(prev, next) {
  const events = [];
  const push = (topic, direction, weight) =>
    events.push({ topic, direction, weight: Math.abs(weight) });

  // An active shock dominates the front page, always
  if (next.shock) push(`shock:${next.shock.id}`, 'neutral', 100);

  const dInfl = next.inflation - prev.inflation;
  if (next.inflation > 4) push('inflation', 'high', 6 + dInfl);
  else if (dInfl > 0.4) push('inflation', 'up', 4 + dInfl);
  else if (dInfl < -0.5) push('inflation', 'down', 3 - dInfl);
  if (next.inflation < 1) push('inflation', 'low', 4 + (1 - next.inflation));

  const dUnemp = next.unemployment - prev.unemployment;
  if (next.unemployment > 8) push('unemployment', 'high', 6 + dUnemp);
  else if (dUnemp > 0.4) push('unemployment', 'up', 4 + dUnemp);
  else if (dUnemp < -0.5) push('unemployment', 'down', 3 - dUnemp);

  const dDebt = next.debt_ratio - prev.debt_ratio;
  if (next.debt_ratio > 90) push('debt', 'high', 5 + dDebt);
  else if (dDebt < -1) push('debt', 'down', 2 - dDebt);

  const dRate = next.policy_rate - prev.policy_rate;
  if (dRate >= 1) push('rate', 'up', 3 + dRate);
  else if (dRate <= -1) push('rate', 'down', 3 - dRate);

  if (next.real_growth > 3) push('growth', 'up', 2 + next.real_growth / 3);
  else if (next.real_growth < 0) push('growth', 'down', 3 - next.real_growth);

  const dGini = next.gini - prev.gini;
  if (dGini > 0.004) push('gini', 'up', 2 + dGini * 100);
  else if (dGini < -0.004) push('gini', 'down', 2 - dGini * 100);

  if ((next.green_investment ?? 0) > 0.4 || next.emissions_index < prev.emissions_index - 0.3) {
    push('green', 'up', 2.5);
  } else if (next.emissions_index > prev.emissions_index + 1.2) {
    push('green', 'down', 2);
  }

  if (next.credibility < 0.5) push('credibility', 'low', 4 + (0.5 - next.credibility) * 10);

  return events.sort((a, b) => b.weight - a.weight);
}

/**
 * Picks `count` articles for a round: top events first, filled with
 * background pieces. Deterministic per (seed, round) — re-rendering the
 * same round shows the same newspaper.
 */
export function selectArticles({ prev, next, seed, round, count = 2, pool = ARTICLES }) {
  const events = eventsFromTransition(prev, next);
  const rng = mulberry32(seed ^ hashString(`news:${round}`));
  const picked = [];
  const usedIds = new Set();

  const candidatesFor = (topic, direction) => {
    const exact = pool.filter(a => a.tags.topic === topic && a.tags.direction === direction && !usedIds.has(a.id));
    if (exact.length) return exact;
    return pool.filter(a => a.tags.topic === topic && !usedIds.has(a.id));
  };

  for (const event of events) {
    if (picked.length >= count) break;
    const candidates = candidatesFor(event.topic, event.direction);
    if (!candidates.length) continue;
    const article = candidates[Math.floor(rng() * candidates.length)];
    picked.push(article);
    usedIds.add(article.id);
  }

  // Fill up with neutral background reporting
  while (picked.length < count) {
    const neutral = pool.filter(a => a.tags.topic === 'neutral' && !usedIds.has(a.id));
    if (!neutral.length) break;
    const article = neutral[Math.floor(rng() * neutral.length)];
    picked.push(article);
    usedIds.add(article.id);
  }

  return picked;
}