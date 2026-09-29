// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL · Round explainer (learning-focused feedback)
//
// After each round, the explainer reconstructs the DOMINANT CAUSAL CHAINS
// from the state transition and the engine's internal detail, and phrases
// them as short teaching messages. Each message names the economic
// mechanism at work (multiplier, Phillips curve, Taylor rule, Domar
// dynamics, Okun's law, …) so students connect outcome to concept.
//
// Message shape: { topic, tone: 'info'|'good'|'warn'|'bad', title, text }
// Ordered: shock → policy impulse → capacity verdict → monetary reaction →
// debt → distribution → objectives.
// ═══════════════════════════════════════════════════════════════════════════

import { TARGETS, MONETARY } from '../config/constants.js';

// Numbers below half a unit of the last displayed digit print as '0'
// (prevents "moved 0" artifacts for small-but-real changes like Δgini −0.006).
const num = (v, digits = 1) => (Math.abs(v) < 0.5 * 10 ** -digits ? '0' : v.toFixed(digits));
const signed = (v, digits = 1) => (v >= 0 ? '+' : '') + num(v, digits);

/**
 * Builds the feedback messages for one completed round.
 *
 * @param {object} prev        state before the round
 * @param {object} next        state after the round
 * @param {object} detail      engine internals from stepEconomy()
 * @param {object|null} shock  shock definition active this round
 * @param {object|null} objectivesStatus  result of evaluateObjectives()
 * @returns {Array<{topic, tone, title, text}>}
 */
export function explainRound(prev, next, detail, shock = null, objectivesStatus = null) {
  const messages = [];

  if (shock) messages.push(explainShock(shock));
  messages.push(...explainPolicyImpulse(prev, next, detail));
  messages.push(explainCapacity(prev, next));
  messages.push(...explainInflationAndCredibility(prev, next, detail));
  messages.push(explainDebt(prev, next, detail));
  messages.push(explainDistribution(prev, next));
  if (objectivesStatus) messages.push(explainObjectives(objectivesStatus));

  return messages.filter(Boolean);
}

// ── Shock ────────────────────────────────────────────────────────────────────

function explainShock(shock) {
  return {
    topic: 'shock',
    tone: 'warn',
    title: `External shock: ${shock.name}`,
    text: `${shock.description} Its effects are already inside this round's numbers — ` +
      `note which indicators moved WITHOUT any policy change from you.`,
  };
}

// ── Policy impulse ───────────────────────────────────────────────────────────

function explainPolicyImpulse(prev, next, detail) {
  const messages = [];
  const drivers = detail.demand_drivers;
  const fiscal = drivers.fiscal_total;
  const monetary = drivers.monetary;

  if (Math.abs(fiscal) >= 0.3) {
    const stimulating = fiscal > 0;
    const slack = prev.output_gap < 0;
    messages.push({
      topic: 'fiscal',
      tone: 'info',
      title: stimulating ? 'Fiscal stimulus at work' : 'Fiscal consolidation at work',
      text:
        `Your budget decisions contributed ${signed(fiscal)} pp to demand ` +
        `(multiplier ${num(drivers.fiscal_detail.multiplier)} — ` +
        `${slack ? 'larger because the economy has slack' : 'smaller near full capacity'}). ` +
        (stimulating
          ? 'Spending multipliers exceed tax multipliers: demand rose more than the deficit.'
          : 'The drag on demand is the price of repairing the budget — timing matters.'),
    });
  }

  if (Math.abs(monetary) >= 0.3) {
    const tightening = monetary < 0;
    messages.push({
      topic: 'monetary',
      tone: 'info',
      title: tightening ? 'Monetary policy is tightening' : 'Monetary policy is stimulating',
      text:
        `The real effective rate (${num(next.policy_rate - next.expected_inflation)} %) ` +
        `${tightening ? 'sits above' : 'sits below'} the neutral rate r* (${MONETARY.neutral_real_rate} %), ` +
        `${tightening ? 'cooling' : 'supporting'} demand by ${signed(monetary)} pp. ` +
        (detail.stance.mode === 'taylor'
          ? 'The independent central bank set this via its Taylor rule — fiscal and monetary policy can work against each other.'
          : 'You set this stance directly through the central bank.'),
    });
  }

  return messages;
}

// ── Capacity verdict: the core Phillips-curve lesson ────────────────────────

function explainCapacity(prev, next) {
  const gap = next.output_gap;
  const gapMoved = gap - prev.output_gap;

  if (gap > 1.5) {
    return {
      topic: 'capacity',
      tone: 'warn',
      title: 'Overheating: demand exceeds capacity',
      text:
        `The output gap is ${signed(gap)} pp. Beyond potential, extra demand mostly becomes ` +
        `INFLATION (Phillips curve), not growth — this round: inflation ${num(next.inflation)} % ` +
        `against ${num(prev.inflation)} % before. Sustainable stimulus requires slack or supply-side reform.`,
    };
  }
  if (gap < -1.5) {
    return {
      topic: 'capacity',
      tone: 'bad',
      title: 'Economic slack: resources are idle',
      text:
        `The output gap is ${signed(gap)} pp. Idle capacity means stimulus would buy REAL growth ` +
        `and jobs (Okun's law) with little inflation — the multiplier is at its largest here. ` +
        `Unemployment stands at ${num(next.unemployment)} %.`,
    };
  }
  if (Math.abs(gapMoved) >= 1) {
    return {
      topic: 'capacity',
      tone: 'good',
      title: gapMoved > 0 ? 'Closing the gap' : 'Demand is cooling',
      text:
        `The output gap moved ${signed(gapMoved)} pp to ${signed(gap)} pp — near potential, ` +
        `where growth is sustainable without inflation pressure.`,
    };
  }
  return {
    topic: 'capacity',
    tone: 'good',
    title: 'Near potential output',
    text:
      `The output gap (${signed(gap)} pp) is small. The economy is close to its sustainable path — ` +
      `further demand stimulus would mostly raise prices.`,
  };
}

// ── Inflation & credibility ──────────────────────────────────────────────────

function explainInflationAndCredibility(prev, next, detail) {
  const messages = [];
  const deviation = Math.abs(next.inflation - TARGETS.inflation);

  if (deviation > TARGETS.inflation_band) {
    const above = next.inflation > TARGETS.inflation;
    messages.push({
      topic: 'inflation',
      tone: 'warn',
      title: above ? 'Inflation above the target band' : 'Inflation below the target band',
      text:
        `Inflation is ${num(next.inflation)} % (target ${TARGETS.inflation} %). ` +
        `Expectations are drifting (now ${num(next.expected_inflation)} %) — each round off target ` +
        `costs credibility (${num(next.credibility, 2)}), and lost credibility makes future ` +
        `stabilization MORE expensive (expectations-augmented Phillips curve).`,
    });
  } else if (prev.credibility < next.credibility - 0.001 && Math.abs(prev.inflation - TARGETS.inflation) > TARGETS.inflation_band) {
    messages.push({
      topic: 'inflation',
      tone: 'good',
      title: 'Back inside the target band',
      text:
        `Inflation returned to ${num(next.inflation)} %. Staying inside the band rebuilds ` +
        `credibility (${num(next.credibility, 2)}) — anchored expectations are the cheapest ` +
        `stabilization tool a central bank owns.`,
    });
  }

  if (next.risk_premium > 0.3) {
    messages.push({
      topic: 'risk',
      tone: 'bad',
      title: 'Bond markets charge a risk premium',
      text:
        `Investors demand ${num(next.risk_premium, 2)} pp extra interest ` +
        `(debt ${num(next.debt_ratio, 0)} % of GDP, credibility ${num(next.credibility, 2)}). ` +
        `The premium raises debt service — a feedback loop that punishes delay.`,
    });
  }

  return messages;
}

// ── Debt dynamics (Domar / snowball) ─────────────────────────────────────────

function explainDebt(prev, next, detail) {
  const delta = next.debt_ratio - prev.debt_ratio;
  const r = next.interest_effective * 100;
  const g = detail.nominal_growth;
  const snowballFavorable = g > r;

  if (Math.abs(delta) < 0.2) {
    return {
      topic: 'debt',
      tone: 'good',
      title: 'Debt ratio stable',
      text:
        `Debt holds at ${num(next.debt_ratio, 0)} % of GDP: the snowball term (g ${num(g)} % vs. ` +
        `r ${num(r)} %) offsets the deficit of ${num(next.deficit_ratio)} % of GDP (Domar dynamics).`,
    };
  }

  const rising = delta > 0;
  return {
    topic: 'debt',
    tone: rising ? 'warn' : 'good',
    title: rising ? 'Debt ratio rising' : 'Debt ratio falling',
    text:
      `Debt moved ${signed(delta)} pp to ${num(next.debt_ratio, 0)} % of GDP. ` +
      `Two forces: the deficit (${num(next.deficit_ratio)} % of GDP) and the snowball effect — ` +
      `nominal growth ${num(g)} % ${snowballFavorable ? 'exceeds' : 'falls short of'} the effective ` +
      `interest rate ${num(r)} %. ` +
      (snowballFavorable
        ? 'While g > r, growth itself shrinks the ratio (Blanchard 2019).'
        : 'With r > g the dynamics work against you — consolidation must do all the work.'),
  };
}

// ── Distribution ─────────────────────────────────────────────────────────────

function explainDistribution(prev, next) {
  const delta = next.gini - prev.gini;
  if (Math.abs(delta) < 0.002) {
    return {
      topic: 'distribution',
      tone: 'info',
      title: 'Distribution unchanged',
      text:
        `The Gini holds at ${num(next.gini, 3)}. The top-20/bottom-40 income ratio is ` +
        `${num(next.top_to_bottom_ratio)}. Unemployment and transfers are the fastest levers on inequality.`,
    };
  }

  const rising = delta > 0;
  const cycleDriver = (next.unemployment - prev.unemployment) * 0.8; // low incomes react strongest
  return {
    topic: 'distribution',
    tone: rising ? 'warn' : 'good',
    title: rising ? 'Inequality rising' : 'Inequality falling',
    text:
      `The Gini moved ${signed(delta, 3)} to ${num(next.gini, 3)}. ` +
      (Math.abs(cycleDriver) > 0.2
        ? `Main driver: the labor market — low-income households feel unemployment first and hardest (cyclical sensitivity). `
        : `Main driver: your budget choices — transfers reach the bottom 40 % directly, tax changes bite progressively. `) +
      `Inequality is never just a "social" variable: high-MPC households at the bottom also shape how ` +
      `strongly transfers feed demand.`,
  };
}

// ── Objectives ───────────────────────────────────────────────────────────────

function explainObjectives(status) {
  const missed = status.results.filter(r => !r.achieved);
  if (missed.length === 0) {
    return {
      topic: 'objectives',
      tone: 'good',
      title: `All ${status.total} objectives met (score ${status.score})`,
      text: 'The magic polygon is balanced — a rare moment in economic policy. Can you keep it when the next shock hits?',
    };
  }
  return {
    topic: 'objectives',
    tone: 'warn',
    title: `${status.achieved}/${status.total} objectives met (score ${status.score})`,
    text:
      `Missed: ${missed.map(m => m.label).join(', ')}. ` +
      `Hint for the hardest one — ${missed[0].label}: ${missed[0].hint}`,
  };
}
