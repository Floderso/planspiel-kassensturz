# Makro-Planspiel

**A headless macroeconomic policy simulation game for university teaching.**
Teams govern a stylized economy ("Econland") over several annual rounds —
setting government spending, taxes, transfers, interest rates, QE and
structural reforms — and learn macroeconomic trade-offs from the consequences
of their own decisions.

Successor concept of the [Kassensturz-Planspiel](../README.md): abstract
textbook levers instead of country-specific tax law, modular architecture,
legible variables and formulas, learning-focused feedback.

Two layers, one repository:

- **`src/` — the headless framework.** Engine, scenarios, levers, feedback,
  game facade (`createGame`). Zero dependencies, fully tested.
- **`ui/` — the classroom web app "Econland Planspiel".** A static,
  build-free German-language UI on top of the facade: phased rounds with a
  decision/evaluation split (no live feedback while deciding), a persistent
  procedural country map per team, decentralized ministries, personal
  dashboards and an offline news desk. Multi-team hot-seat on one device;
  everything persists in `localStorage`.

Run the UI locally (any static server, repo root or this folder):

```bash
npx serve .
# → http://localhost:3000/ui/
```

---

## Quickstart

No dependencies, no build step. Node ≥ 18 (uses `node --test` and ES modules).

```js
import { createGame } from './src/index.js';

const game = createGame({ scenario: 'recession', rounds: 6 });

// Round 1: fight the downturn with a spending stimulus
game.setPolicies({ gov_spending_change: 2 });
const round1 = game.advanceRound();

console.log(round1.state.output_gap);     // → recovered strongly (multiplier)
console.log(round1.state.unemployment);   // → fell (Okun's law)
console.log(round1.feedback.map(f => `${f.tone}: ${f.title}`));
// → the explainer names the mechanisms behind the numbers

// Round 2: consolidate a little
game.setPolicies({ tax_change: 0.5 });
game.advanceRound();

console.log(game.getHistory().length);    // → 2
```

Run the included demo session to see a full game in the terminal:

```bash
node examples/demo-session.js
```

Run the test suite (62 tests: unit, integration, calibration, UI logic):

```bash
npm test
```

---

## Repository layout

```
src/                     ← the headless framework (see above; public API: index.js)
ui/                      ← the classroom web app (static, no build, ES modules)
  index.html             ← shell: cockpit + view container
  css/                   ← design system (Bespoke Stencil, palette 70-20-10,
                           anti-AI-look: real edges, no shadows, no radius)
  fonts/                 ← Bespoke Stencil web fonts (license: FFL)
  js/
    seed.js              ← deterministic RNG (FNV-1a + mulberry32)
    metrics.js           ← metric catalog + the 4 ministries (data quarter)
    store.js             ← session record, localStorage, deterministic replay
    news.js              ← state transition → weighted story events → articles
    data/articles.js     ← offline news pool (German, tagged, event effects)
    map/
      landform.js        ← procedural country outline per team (persistent)
      allocation.js      ← state → tile categories, clustered districts
      render.js          ← canvas renderer + PNG export
    views/               ← setup · handover · decision · evaluation ·
                           ministries · comparison (+ shared helpers)
    main.js              ← cockpit + view routing
tests/                   ← node --test, zero dependencies (62 tests:
                           engine blocks, integration, calibration, UI logic)
docs/
  MODEL.md               ← every equation, variable, value and source
  CONCEPT.md             ← game design: roles, rounds, scenarios, session plan
examples/
  demo-session.js        ← a scripted 4-round game with terminal output
```

### The UI game flow (architecture: phased rounds)

```
Setup (teams, per-team scenario, mode, rounds)
  → per round:
      Handover curtain (privacy on shared device)
      Decision phase   — ministries + levers, justification required,
                         NO live outcome feedback while deciding
      Evaluation phase — after ALL teams locked: country map reveal,
                         ministry deltas, press of the day, objectives
  → Comparison — all countries side by side, PNG export,
                 mechanics appendix (causal feedback, unlocked post-game)
```

Design guardrails implemented (from the game-architecture document):
no live trial-and-error feedback during decisions · information distributed
across ministries (never pre-sorted, never pre-judged) · personal dashboard
pins chosen by each team · news narrates phenomena without explaining
mechanics · levers unlock progressively over the periods · each country's
SHAPE is generated once per team and persists (recognition value) while its
COLORING follows the economy (industry gray, renewables sage, social
hotspots mauve, decline brown — palette of the design document).

## Design principles

- **Abstract policies, real economics.** Levers are textbook aggregates
  (spending, tax burden, transfers, policy rate, QE, structural reform) —
  the institutional detail moves to the classroom discussion.
- **Legible everything.** Full English variable names; each formula commented
  next to the code that implements it; one constants file with sources.
- **Strict modularity.** `config` (data) → `engine` (pure economics) →
  `feedback` (learning logic) → `index.js` (game flow). Each block is
  independently importable and testable; the engine has no side effects.
- **UI-agnostic by construction.** Lever definitions, state, feedback,
  objectives and history are plain serializable data — a future UI renders
  itself from `game.getLevers()` / `getState()` / `advanceRound()` without
  touching the engine.

## Where to go next

| Next step | Builds on |
|---|---|
| Multi-device sessions (backend sync) | session record shape in `ui/js/store.js`; per-team deterministic replay — a thin API (cf. the [old project's Cloudflare worker](../api)) replaces localStorage |
| Localization of engine feedback texts | texts live in `src/feedback/` + lever `blurb`s — single extraction point |
| Larger news pool | append tagged articles to `ui/js/data/articles.js` — selection logic picks them up |
| More scenarios/shocks/levers | append to `src/config/scenarios.js` / `shocks.js` / `policies.js` — engine and UI pick them up |

## License

CC-BY-4.0 · Developed for university teaching.