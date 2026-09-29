// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · Metric catalog + ministries ("Regierungsstruktur")
//
// Single source for: which metrics exist, how they are labeled/formatted,
// and which ministry ("Ressort") presents them. The system deliberately
// attaches NO good/bad judgment to values (architecture doc §4) — formatting
// is neutral throughout.
//
// Ministries double as places: each shows its metrics, and (during the
// decision phase) the levers of its policy domain.
// ═══════════════════════════════════════════════════════════════════════════

const pp = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)} pp`;
const pct1 = v => `${v.toFixed(1)} %`;
const pct0 = v => `${v.toFixed(0)} %`;
const idx1 = v => v.toFixed(1);
const fixed2 = v => v.toFixed(2);
const fixed3 = v => v.toFixed(3);

export const METRICS = [
  // Wirtschaftsministerium
  { key: 'output_gap',          label: 'Produktionslücke',      unit: '% d. Potenzials', fmt: v => pp(v),        ministry: 'wirtschaft' },
  { key: 'real_growth',         label: 'Reales Wachstum',       unit: '% p.a.',          fmt: v => pp(v, 1).replace(' pp', ' %'), ministry: 'wirtschaft' },
  { key: 'gdp_index',           label: 'BIP (Index)',           unit: 'Start = 100',     fmt: idx1,              ministry: 'wirtschaft' },
  { key: 'potential_gdp_index', label: 'Potenzialoutput (Index)', unit: 'Start = 100',   fmt: idx1,              ministry: 'wirtschaft' },
  { key: 'emissions_index',     label: 'Emissionen (Index)',    unit: 'Start = 100',     fmt: idx1,              ministry: 'wirtschaft' },
  { key: 'green_investment',    label: 'Grüne Investition (lfd.)', unit: '% d. BIP',     fmt: pct1,              ministry: 'wirtschaft' },

  // Zentralbank
  { key: 'inflation',           label: 'Inflationsrate',        unit: '%',               fmt: pct1,              ministry: 'zentralbank' },
  { key: 'expected_inflation',  label: 'Inflationserwartung',   unit: '%',               fmt: pct1,              ministry: 'zentralbank' },
  { key: 'policy_rate',         label: 'Leitzins',              unit: '%',               fmt: pct1,              ministry: 'zentralbank' },
  { key: 'real_rate',           label: 'Realzins',              unit: '%',               fmt: v => pp(v, 1).replace(' pp', ' %'), ministry: 'zentralbank' },
  { key: 'credibility',         label: 'Glaubwürdigkeit',       unit: '0 – 1',           fmt: fixed2,            ministry: 'zentralbank' },

  // Finanzministerium
  { key: 'debt_ratio',          label: 'Schuldenquote',         unit: '% d. BIP',        fmt: pct0,              ministry: 'finanz' },
  { key: 'deficit_ratio',       label: 'Defizitquote',          unit: '% d. BIP',        fmt: pct1,              ministry: 'finanz' },
  { key: 'primary_balance',     label: 'Primärsaldo',           unit: '% d. BIP',        fmt: v => pp(v, 1).replace(' pp', ' %'), ministry: 'finanz' },
  { key: 'revenue_ratio',       label: 'Einnahmenquote',        unit: '% d. BIP',        fmt: pct1,              ministry: 'finanz' },
  { key: 'spending_ratio',      label: 'Ausgabenquote',         unit: '% d. BIP',        fmt: pct1,              ministry: 'finanz' },
  { key: 'risk_premium',        label: 'Risikoaufschlag',       unit: 'Prozentpunkte',   fmt: fixed2,            ministry: 'finanz' },

  // Sozial- und Arbeitsministerium
  { key: 'unemployment',        label: 'Arbeitslosenquote',     unit: '%',               fmt: pct1,              ministry: 'sozial' },
  { key: 'natural_unemployment',label: 'Strukturelle Arbeitslosigkeit', unit: '%',       fmt: pct1,              ministry: 'sozial' },
  { key: 'gini',                label: 'Gini-Koeffizient',      unit: '0 – 1',           fmt: fixed3,            ministry: 'sozial' },
  { key: 'top_to_bottom_ratio', label: 'Einkommensabstand Top/Bottom', unit: 'Faktor',   fmt: idx1,              ministry: 'sozial' },
];

export const METRIC_MAP = Object.fromEntries(METRICS.map(m => [m.key, m]));

export const MINISTRIES = [
  {
    id: 'zentralbank',
    name: 'Zentralbank',
    kicker: 'Währungshüterin des Landes',
    domains: ['monetary'],
    blurb: 'Setzt den Leitzins und wacht über Preisstabilität. Ihre Glaubwürdigkeit entscheidet, wie fest die Inflationserwartungen verankert sind.',
  },
  {
    id: 'finanz',
    name: 'Finanzministerium',
    kicker: 'Der Kassenwart',
    domains: ['fiscal'],
    blurb: 'Verantwortet Haushalt und Steuern. Hier werden Einnahmen, Ausgaben und die Entwicklung der Staatsschulden aktenkundig.',
  },
  {
    id: 'wirtschaft',
    name: 'Wirtschaftsministerium',
    kicker: 'Das Ressort für Leistungskraft',
    domains: ['structural'],
    blurb: 'Kümmert sich um Wachstum, Kapazitäten und die Energiewende. Strukturreformen wirken langsam — aber nachhaltig.',
  },
  {
    id: 'sozial',
    name: 'Sozial- und Arbeitsministerium',
    kicker: 'Das Amt für Zusammenhalt',
    domains: [],
    blurb: 'Beobachtet Arbeitsmarkt und Verteilung. Keine eigenen Hebel — aber alle Bescheide über die soziale Lage.',
  },
];

export const MINISTRY_MAP = Object.fromEntries(MINISTRIES.map(m => [m.id, m]));

export function metricsForMinistry(ministryId) {
  return METRICS.filter(m => m.ministry === ministryId);
}

/** Formatted current value of a metric from a state object. */
export function fmtMetric(key, state) {
  const def = METRIC_MAP[key];
  if (!def || state?.[key] === undefined) return '—';
  return def.fmt(state[key]);
}