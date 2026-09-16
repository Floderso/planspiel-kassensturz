// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Learning objectives & scoring
//
// Objectives turn macro targets into checkable game goals. An instructor
// picks a set per session; after each round every team sees which goals it
// is meeting. Objectives are deliberately TRADE-OFF-AWARE: meeting all of
// them at once is hard by design — that difficulty IS the lesson.
//
// Objective shape:
//   { id, label, metric, op: '<'|'>'|'<='|'>=', value, weight? , hint? }
// metric is any numeric field of the economy state (e.g. 'inflation',
// 'unemployment', 'debt_ratio', 'gini', 'emissions_index', 'real_growth').
// ═══════════════════════════════════════════════════════════════════════════

/** Default objective set — the classic "magic polygon" of economic policy. */
export const DEFAULT_OBJECTIVES = [
  {
    id: 'price_stability',
    label: 'Price stability',
    metric: 'inflation', op: 'between', value: [1, 3],
    weight: 2,
    hint: 'Keep inflation within 1–3 % — the credibility window.',
  },
  {
    id: 'full_employment',
    label: 'Full employment',
    metric: 'unemployment', op: '<=', value: 7,
    weight: 2,
    hint: 'Cyclical unemployment falls with demand; structural only with reform.',
  },
  {
    id: 'debt_sustainability',
    label: 'Debt sustainability',
    metric: 'debt_ratio', op: '<=', value: 75,
    weight: 1,
    hint: 'Stabilize the ratio: primary balance plus the snowball effect (g vs. r).',
  },
  {
    id: 'social_cohesion',
    label: 'Social cohesion',
    metric: 'gini', op: '<=', value: 0.38,
    weight: 1,
    hint: 'Inequality responds to unemployment first, transfers second.',
  },
  {
    id: 'green_transition',
    label: 'Green transition',
    metric: 'emissions_index', op: 'falling', value: 0,
    weight: 1,
    hint: 'Emissions must fall year over year — growth alone will not do it.',
  },
];

/**
 * Evaluates all objectives against the current state.
 * Special operators: 'between' (inclusive range) and 'falling'/'rising'
 * (compare against the previous state).
 *
 * @returns {{ results: Array<{id,label,achieved,value,target_text,hint}>,
 *             achieved: number, total: number, score: number }}
 * score is the weight-averaged achievement share in percent (0–100).
 */
export function evaluateObjectives(state, prevState, objectives = DEFAULT_OBJECTIVES) {
  const results = objectives.map(obj => {
    const value = state[obj.metric];
    let achieved = false;
    let target_text = '';

    switch (obj.op) {
      case '<':  achieved = value <  obj.value; target_text = `< ${obj.value}`; break;
      case '<=': achieved = value <= obj.value; target_text = `≤ ${obj.value}`; break;
      case '>':  achieved = value >  obj.value; target_text = `> ${obj.value}`; break;
      case '>=': achieved = value >= obj.value; target_text = `≥ ${obj.value}`; break;
      case 'between':
        achieved = value >= obj.value[0] && value <= obj.value[1];
        target_text = `${obj.value[0]}–${obj.value[1]}`;
        break;
      case 'falling':
        achieved = prevState ? value < prevState[obj.metric] : false;
        target_text = 'falling vs. previous round';
        break;
      case 'rising':
        achieved = prevState ? value > prevState[obj.metric] : false;
        target_text = 'rising vs. previous round';
        break;
      default:
        throw new Error(`Unknown objective operator: "${obj.op}"`);
    }

    return {
      id: obj.id,
      label: obj.label,
      weight: obj.weight ?? 1,
      achieved,
      value,
      target_text,
      hint: obj.hint ?? '',
    };
  });

  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  const achievedWeight = results.filter(r => r.achieved).reduce((sum, r) => sum + r.weight, 0);

  return {
    results,
    achieved: results.filter(r => r.achieved).length,
    total: results.length,
    score: totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0,
  };
}