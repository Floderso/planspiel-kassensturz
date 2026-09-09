# Game Concept — Makro-Planspiel

A **macroeconomic policy simulation game** for university teaching. Teams
govern a stylized economy ("Econland") over several annual rounds. Instead of
tweaking individual laws, they pull the **big levers of economic policy** and
learn the trade-offs from the consequences of their own decisions.

This document describes the game design the framework is built for. The
framework itself is **headless** — everything here maps to data structures
and APIs, no UI assumptions.

---

## Design pillars

1. **Abstract, not institutional.** No specific country's tax code. Levers are
   the textbook aggregates: government spending, the tax burden, transfers,
   the policy rate, QE, structural reform. The transfer of concepts to any
   real economy happens in the classroom discussion, not in the UI.
2. **Legible variables and formulas.** Every state variable has a full English
   name; every equation is documented in `docs/MODEL.md` with values and
   sources; every parameter lives in one file (`src/config/constants.js`).
3. **Learning from consequences.** After each round, the explainer
   (`src/feedback/explainer.js`) reconstructs the dominant causal chains —
   *"your stimulus closed the gap; at capacity the Phillips curve turned the
   rest into inflation"* — naming the mechanism (multiplier, Taylor rule,
   Domar dynamics, Okun's law) every time.
4. **Trade-offs are the curriculum.** The objectives ("magic polygon": price
   stability, full employment, debt sustainability, social cohesion, green
   transition) are designed so that meeting all of them at once is genuinely
   hard. The difficulty IS the lesson.

## Roles and game modes

| Mode | `central_bank` | Who decides what |
|---|---|---|
| **Parallel governments** | `taylor` | Each team runs fiscal + structural policy; an independent AI central bank reacts via the Taylor rule. Teams learn fiscal–monetary interaction (and conflict). |
| **Government + central bank** | `player` | Additionally, students set the interest rate and QE — either as a separate role within the team or as a competing "central bank" team. Credibility management becomes a first-class skill. |

Both modes share the same engine; `src/config/policies.js` decides which
levers are editable. The domains map to classroom roles:

- **Ministry of Finance** — `gov_spending_change`, `tax_change`, `transfer_change`
- **Central Bank** — `interest_rate`, `qe_volume` *(player mode only)*
- **Ministry of Economic Affairs** — `labor_market_reform`, `green_investment`

## Round flow (per team)

```
1. Review        state indicators + last round's feedback messages
2. Decide        set any subset of the available levers
3. Advance       engine resolves the year (all blocks, documented order)
4. Debrief       explainer messages + objective status + history chart data
```

Lever semantics matter for learning:

- **Impulse levers** (spending, tax, transfers, QE, green investment) are
  *decisions for this year*. They accumulate into the budget ratios but reset
  in the decision form — a stimulus is a choice, not a default.
- **Level levers** (interest rate, labor reform) are *stances* that persist
  until changed — institutional settings, not one-off actions.

## Scenarios (starting economies)

| Scenario | Stages | Core lesson |
|---|---|---|
| `stable` | Steady state | Reading indicators; "doing nothing" is also a policy |
| `recession` | gap −3, low inflation | Multipliers, automatic stabilizers, the ZLB |
| `overheating` | gap +2.5, inflation 4.5 | Phillips trade-off, expectations, sacrifice ratio |
| `stagflation` | gap −2 AND inflation 5.5 (+ embedded energy shock) | Supply shocks defeat demand management; credibility as an asset |
| `debt_crisis` | debt 110 %, risk premium | Domar dynamics, denominator effect, feedback loops |

## Shocks (instructor-controlled)

Scheduled per round (`createGame({ shocks: [{ round, shock_id }] })`) or
embedded in scenarios. Library in `src/config/shocks.js`: energy crisis,
financial crisis, export boom, commodity relief, migration wave, productivity
boom, trade war — each with a teaching blurb and effects mapped 1:1 onto
engine channels (demand, supply inflation, risk premium, NAIRU, potential).

## Learning objectives & scoring

`src/feedback/objectives.js` evaluates instructor-defined objectives
(`metric`, `op`, `value`, `weight`, `hint`) against each round's state and
produces a weighted score (0–100). The default set is the magic polygon:

- price stability: inflation ∈ [1, 3]
- full employment: unemployment ≤ 7
- debt sustainability: debt ≤ 75 % of GDP
- social cohesion: Gini ≤ 0.38
- green transition: emissions falling year over year

## What a UI needs (already exposed)

Everything is plain serializable data from `src/index.js`:

- `game.getLevers()` — full lever definitions (bounds, unit, teaching blurb,
  domain/role) with pending values → renders the control panel
- `game.getState()` — the economy state → renders dashboards/charts
- `advanceRound() → { state, feedback, objectives, shock }` → renders the
  debrief view
- `game.getHistory()` — per-round states + feedback → renders trajectory
  charts and the final debriefing
- `simulatePath()` — pure multi-round simulation → "what-if" previews,
  teacher analysis, AI opponents

## Intended session structure (90–120 min)

1. **Briefing (10')** — one scenario, the magic polygon, the lever set.
2. **Calibration round (10')** — all teams play round 1 of `stable` and
   compare: the model reads the same for everyone.
3. **Main game (50–70')** — 5–6 rounds of an assigned scenario; instructor
   injects one shock mid-game.
4. **Debriefing (20–30')** — compare team trajectories (`getHistory()`),
   best-score defense, and the classic discussion: *which trade-off did you
   accept, and would a real electorate let you?*