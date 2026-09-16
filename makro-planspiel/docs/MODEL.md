# Model Documentation — Makro-Planspiel ("Econland")

Every equation in the engine, in plain text, with variables, values and sources.
One round = one year. The model is deliberately **abstract**: no country, no
institutions — a stylized advanced economy calibrated to textbook values.

Module map: `constants.js` holds every parameter; each engine block below maps
1:1 to a file in `src/engine/`.

---

## 1. Aggregate demand — `demand.js` (IS curve)

```
gap_t = persistence × gap_{t−1}
      + μ_G(slack) × (ΔG + GreenInv)
      + μ_G(slack) × MPC_tr × ΔTransfers
      − μ_T × ΔTax
      − β × (r_eff − r*)
      + shock_demand
```

| Symbol | Value | Meaning | Source |
|---|---|---|---|
| `persistence` | 0.4 | gap momentum (habits, adjustment costs) | Blanchard, macro textbook |
| `μ_G(slack)` | 1.2 if gap < 0 | spending multiplier with slack | Auerbach & Gorodnichenko (2012); Gechert & Ramey (2018) |
| `μ_G(capacity)` | 0.7 if gap ≥ 0 | spending multiplier at capacity | same |
| `MPC_tr` | 0.8 | MPC of transfer recipients | Kaplan/Moll/Violante (2018) HANK |
| `μ_T` | 0.5 | tax multiplier (< μ_G: Haavelmo) | balanced-budget theorem |
| `β` | 0.6 | IS slope: pp gap per pp real-rate gap | textbook IS curve |
| `r*` | 1.0 % | neutral real rate | Laubach & Williams (teaching value) |

Clamp: gap ∈ [−8, +8] (numerical safety).

**Teaching:** only *fresh* impulses move demand (a permanent spending level is
already in last year's gap). Multipliers are bigger in recessions — the same
euro buys more growth with slack than at capacity.

## 2. Monetary policy — `monetary.js`

```
Taylor rule:    i = r* + π + 0.5×(π − π*) + 0.5×gap        (clamped to [0, 10])
Fisher:         r = i − π^e
QE effect:      qe_eff = min(1.5, 0.15 × volume)
Effective:      r_eff = r − qe_eff
```

| Symbol | Value | Meaning | Source |
|---|---|---|---|
| Taylor weights | 0.5 / 0.5 | inflation & gap response | Taylor (1993) |
| `qe_eff` | 0.15 pp per % GDP, cap 1.5 pp | portfolio-balance channel | Krishnamurthy & Vissing-Jorgensen |

Two modes: `taylor` (independent AI central bank reacting to *observed*
lagged data) or `player` (students set the rate; large deviations from the
rule cost credibility).

## 3. Inflation — `inflation.js` (expectations-augmented Phillips curve)

```
π_t   = π^e_{t−1} + slope × gap_t + supply_shock
π^e_t = π^e_{t−1} + λ × (π_t − π^e_{t−1}),   λ = 0.4 × (1.25 − credibility)
```

| Symbol | Value | Meaning | Source |
|---|---|---|---|
| `slope` | 0.5 | pp inflation per pp gap | Phillips (1958); textbook 0.3–0.7 |
| adaptation | 0.4 base | adaptive expectations | Friedman (1968) |
| credibility | 0.2…1 | anchoring strength | Blanchard (2016) |

Credibility: +0.05/round inside the 2 % ± 1 band; −0.1 × min(1, |π−2|/4)
outside; extra penalties for a player bank deviating > 2 pp from its rule and
for QE while above target.

**Teaching:** demand stimulus becomes *real growth* only with slack; at
capacity the Phillips curve converts it to inflation. De-anchored expectations
make disinflation expensive (sacrifice ratio).

## 4. Labor market — `labor.js`

```
u_t    = NAIRU_t − okun × gap_t
NAIRU* = 6 − 0.5 × reform_level           (clamped [3, 12])
NAIRU_t = NAIRU_{t−1} + 0.25 × (NAIRU* − NAIRU_{t−1}) + shock
```

| Symbol | Value | Meaning | Source |
|---|---|---|---|
| `okun` | 0.4 | pp unemployment per pp gap | Okun (1962); Ball/Leigh/Loungani (2017) |
| drift | 0.25 | annual NAIRU convergence | structural persistence |

**Teaching:** cyclical unemployment moves within a year; *structural*
unemployment moves slowly and only via supply-side reform. You cannot
stimulate below the NAIRU without inflation.

## 5. Growth — composed in `economy.js`

```
potential_growth = 2 % + 0.1 pp × reform_level + shock_bonus
real_growth      = potential_growth + (gap_t − gap_{t−1})
nominal_growth   = real_growth + inflation
gdp_index       ×= (1 + real_growth);   potential_index ×= (1 + potential_growth)
```

**Teaching:** the cycle adds to, never replaces, the trend. Supply-side
reform is the only lever that raises the trend itself.

## 6. Public finances — `fiscal.js`

```
revenue_ratio  = 40 + ΣΔTax + 0.3 × gap
spending_ratio = 40 + Σ(ΔG + ΔTransfers + GreenInv) − 0.15 × min(0, gap)
primary_balance = revenue_ratio − spending_ratio
interest_burden = debt × (2 % + risk_premium)
deficit_ratio   = interest_burden − primary_balance
debt_t = debt_{t−1} × (1 + r_eff − g_nominal) + deficit_ratio      [Domar]
risk_premium = 0.03 × max(0, debt − 90) + 2.0 × max(0, 0.8 − credibility) + shock
```

| Symbol | Value | Meaning | Source |
|---|---|---|---|
| base ratios | 40 % / 40 % | revenue / primary spending | advanced-economy norm |
| buoyancy / stabilizer | 0.3 / 0.15 | automatic stabilizers | IMF Fiscal Monitor |
| baseline interest | 2 % | effective rate on the debt stock | rolling old debt |
| Domar equation | — | debt dynamics | Domar (1944); Blanchard (2019) r < g |

Ratios clamped to [25, 55] % (political feasibility). Debt clamped [0, 300].

**Teaching:** the calibrated baseline (primary 0, r 2 %, g 4 %) sits exactly at
the Domar fixed point — debt is stable *because g > r*, not because the budget
is balanced. Austerity can backfire via the denominator (growth) effect.

## 7. Households — `households.js` (three income groups)

Groups: bottom 40 %, middle 40 %, top 20 % of households.

```
disposable_i = market_share_i × (1 + sens_i × gap/100)
             − ΔTax_cum × incidence_i / 100
             + ΔTransf_cum × transfer_share_i / 100        [all in % of GDP]
Gini = 1 − 2 × area(3-point Lorenz curve, trapezoid)
top/bottom ratio = avg income top 20 % ÷ bottom 40 %
```

| Parameter | bottom40 | middle40 | top20 | Source |
|---|---|---|---|---|
| population | 0.40 | 0.40 | 0.20 | — |
| market share of GDP | 0.12 | 0.43 | 0.45 | SOEP/EU-SILC shapes |
| cycle sensitivity | 0.80 | 0.40 | 0.15 | low incomes hit first |
| tax incidence | 0.15 | 0.45 | 0.40 | ≈ proportional |
| transfer share | 0.60 | 0.30 | 0.10 | means-tested skew |

Baseline (gap 0, no impulses): shares [12, 43, 45] → Gini ≈ 0.374 (market
income), top/bottom ratio 7.5.

**Teaching:** recessions are regressive (sensitivity falls with income);
transfers redistribute immediately; every macro lever has a distributional
side effect.

## 8. Environment — `environment.js`

```
emissions_t = emissions_{t−1} × (1 + g_real − 1.5 % − 1 % × GreenInv)
```

Growth pushes emissions up (+2 % baseline), autonomous efficiency pushes down
(−1.5 %), green investment abates (−1 pp per % GDP). Floor: −6 %/yr.

**Teaching:** with the baseline numbers, *doing nothing means slowly rising
emissions* — decoupling requires dedicated (and deficit-financed) investment.

## 9. Round wiring — `economy.js`

```
stance (rate/Taylor) → gap (IS) → inflation (Phillips) → unemployment (Okun)
→ growth (potential + Δgap) → budget & debt (stabilizers, Domar)
→ distribution (stance + gap) → emissions → credibility & expectations
```

`stepEconomy(prev, policies, shock, config)` is **pure** — same inputs, same
outputs. `path.js` iterates it for multi-round paths; shocks are resolved per
round from scenario-embedded and instructor-scheduled lists.

---

## Steady-state check (calibration anchor)

Neutral policies from `stable`: gap 0 → Taylor rate 3 %, real rate 1 % = r* →
gap stays 0; inflation 2 % = target; unemployment 6 % = NAIRU; primary 0,
interest burden 1.2 % of GDP, nominal growth 4 % > r 2 % → debt pinned at
60 % (Domar fixed point); Gini 0.374; emissions +0.5 %/yr. Verified by
`tests/economy.test.js` and `tests/calibration.test.js`.

## Limitations (honest list for instructors)

- Linearized, annual, closed-economy core (open-economy effects enter only
  via shocks) — by design, for legibility.
- Expectations are adaptive, not rational; the Phillips curve is not vertical
  in the long run beyond the NAIRU mechanism.
- The distribution block has three groups; intra-group variation is ignored.
- Interest on debt uses a smoothed stock rate, not a maturity structure.