// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
import { DEZILE, PRESETS, ELAST, BASIS_MAKRO, STAATSAUSGABEN, KINDER_JE_HH, BUERGERGELD_QUOTE, CO2_GEWICHT } from '../data.js';

// Grundsicherung außerhalb des Reglers (Unterkunft, Mehrbedarfe) je Haushalt, nach dem
// Bürgergeldprofil — der Staat bucht sie fest, also kommt sie auch fest an (PRUEFUNG-2.md I.4)
const GRUNDSICHERUNG_FIX_HH = (() => {
  const summe = DEZILE.reduce((a, d, i) => a + d.anzahl * BUERGERGELD_QUOTE[i], 0);
  return BUERGERGELD_QUOTE.map(q => STAATSAUSGABEN.grundsicherung_fix * 1000 * q / summe);
})();
import { estHaushalt } from './einkommensteuer.js';

// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Verteilungsmetriken & Dezilberechnung
// Abhängigkeiten: DEZILE, ELAST (aus data.js), estTarif, grenzsteuersatz (aus einkommensteuer.js)
// ═══════════════════════════════════════════════════════

// Quellenmetadaten — parallel zu den Berechnungsfunktionen
const FORMEL_QUELLEN_VERT = {
  aequivalenzEinkommen: {
    formel: 'y_äq,i = Netto_i / Bedarfsgewicht_i  (neue OECD-Skala: 1,0 erste Person · 0,5 weitere ab 14 J. · 0,3 Kinder unter 14 J.)',
    ref:    'Eurostat EU-SILC Methodik (äquivalisiertes verfügbares Einkommen) · Destatis Glossar „Äquivalenzeinkommen" · OECD (2013) Framework for Statistics on the Distribution of Household Income',
    note:   'Bedarfsgewicht = DEZILE[i].gewicht (1,3–2,0, Haushaltsdurchschnitt je Dezil). Gezählt wird über Haushalte, nicht Personen — Personenzahlen je Dezil fehlen im Datensatz. Status quo: Gini 0,310 gegen 0,295 amtlich (EU-SILC); ohne Bedarfsgewichtung deutlich höher (vor dem Abgleich Haushalt/Staat 0,377)'
  },
  berechneGini: {
    formel: 'G = 1 − 2·∫Lorenz(x)dx  (Trapezregel, gewichtet nach Haushaltszahl)',
    ref:    'Sen (1973) On Economic Inequality · Cowell (2011) Measuring Inequality · Destatis Methodik Gini-Koeffizient',
    note:   'Gewichtet nach DEZILE[i].anzahl; D10a/b/c (2,05 / 1,64 / 0,41 Mio. HH) werden korrekt gewichtet. berechne() übergibt Äquivalenzeinkommen wie EU-SILC, nicht Haushaltsnetto'
  },
  berechnePalma: {
    formel: 'Palma = Einkommensanteil(Top 10%) / Einkommensanteil(Bottom 40%)',
    ref:    'Palma (2011) Homogeneous Middles vs. Heterogeneous Tails · UNDP HDR 2013',
    note:   'Robuster gegenüber Mittelstand-Verzerrung als Gini; international gut vergleichbar. Auf Äquivalenzeinkommen wie der Gini: Status quo 1,25 (Lehrbuchwert DE ~1,2)'
  },
  berechneMedianGewichtet: {
    formel: 'Gewichteter Median: kumulierte Haushaltsanteile bis 50 %',
    ref:    'Destatis Mikrozensus 2024 · SOEP v40',
    note:   'Basis für Armutsgrenze: 60 % des gewichteten Medians (EU-SILC-Konvention, Art. 7 VO 2019/1700)'
  },
  armutsrisiko: {
    formel: 'pov_i = pov_sq_i × (y_i/y_sq_i ÷ PL/PL_sq)^(−1,5)',
    ref:    'Bourguignon (2003) · EU-SILC DE 2023 (14,8 % Kalibrierung) · SOEP v40 · IAB Kurzbericht 2024',
    note:   'Elastizität −1,5: +1 % Einkommen → −1,5 % Armutsanteil. Intra-Dezil: D1 90 %, D2 62 %, D3 5 % (SOEP). Übertragene Elastizität: Bourguignon schätzt sie für absolute Armut in Entwicklungsländern; für eine relative Armutsquote ist sie eine Näherung (PRUEFUNG-2.md IV)'
  },
  berechneNettoSQ: {
    formel: 'Netto_SQ = Brutto − ESt(SQ) − SV(SQ) − MwSt(SQ) − CO₂(SQ) + Klimageld(SQ) + Transfers(SQ)',
    ref:    'PRESETS.status_quo (data.js) · § 32a EStG 2025 · § 158 SGB VI · § 241 SGB V',
    note:   'Referenzpunkt für alle Δ-Berechnungen; Parameter: freibetrag 12.084, eingang 14 %, spitze 45 %'
  },
  berechneDezilDelta: {
    formel: 'Δ_i = Netto_neu_i − Netto_SQ_i',
    ref:    'SOEP v40 · Destatis Mikrozensus 2024 · BMF Steuerschätzung 2025',
    note:   'Profile aus data.js (BUERGERGELD_QUOTE, KINDER_JE_HH auf 17 Mio. Kinder, CO2_GEWICHT auf das Aufkommen normiert) — dieselben Zahlen, die der Staat bucht'
  }
};


// Ein Haushalt mit vier Personen braucht mehr als einer mit einer. Ohne diese
// Bedarfsgewichtung stehen die großen Haushalte oben, die kleinen unten, und die
// Ungleichheit fällt zu hoch aus: 0,377 statt ~0,29 — so hoch, dass jede Politik
// im Spiel „stark zunehmende Ungleichheit" hieß (PRUEFUNG.md B3).
function aequivalenzEinkommen(netto, dez) {
  return netto.map((v, i) => v / dez[i].gewicht);
}

function berechneGini(werte, dez) {
  const pairs = werte.map((v, i) => ({ v, n: dez[i].anzahl })).sort((a, b) => a.v - b.v);
  const total_n = pairs.reduce((a, p) => a + p.n, 0);
  const total_y = pairs.reduce((a, p) => a + p.v * p.n, 0);
  if (total_y <= 0) return 0;
  let cum_n = 0, cum_y = 0, gini = 0;
  for (const p of pairs) {
    const prev_n = cum_n, prev_y = cum_y;
    cum_n += p.n / total_n;
    cum_y += p.v * p.n / total_y;
    gini += (cum_n - prev_n) * (cum_y + prev_y);
  }
  return Math.max(0, Math.min(1, 1 - gini));
}

function berechneMedianGewichtet(werte, dez) {
  // Gewichteter Median: Hälfte der Haushalte liegt darunter
  const pairs = werte.map((v,i) => ({v, n: dez[i].anzahl})).sort((a,b)=>a.v-b.v);
  const half = pairs.reduce((a,p)=>a+p.n,0) / 2;
  let cum = 0;
  for (const p of pairs) { cum += p.n; if (cum >= half) return p.v; }
  return pairs[pairs.length-1].v;
}

function berechnePalma(werte) {
  // Palma-Ratio: Durchschnittseinkommen Top-10% / Durchschnitt Bottom-40%
  const pairs = werte.map((v,i) => ({v, n: DEZILE[i].anzahl})).sort((a,b)=>a.v-b.v);
  const total_n = pairs.reduce((a,p)=>a+p.n,0);
  const bot_limit = total_n * 0.40;
  const top_limit = total_n * 0.10;
  let bot_sum=0, bot_n=0, top_sum=0, top_n=0, cum_bot=0, cum_top=0;
  for (const p of pairs) {
    if (cum_bot + p.n <= bot_limit + 1e-9) { bot_sum+=p.v*p.n; bot_n+=p.n; cum_bot+=p.n; }
  }
  for (let j=pairs.length-1; j>=0; j--) {
    if (cum_top + pairs[j].n <= top_limit + 1e-9) { top_sum+=pairs[j].v*pairs[j].n; top_n+=pairs[j].n; cum_top+=pairs[j].n; }
  }
  // Palma (2011): Verhältnis der EINKOMMENSANTEILE, nicht der Durchschnitte.
  // Da beide Anteile denselben Nenner (Gesamteinkommen) haben, kürzt er sich —
  // es bleibt die Summe oben geteilt durch die Summe unten. Die frühere Fassung
  // teilte die Durchschnitte und lieferte damit das Vierfache: 6,87 statt ~1,7,
  // während der Lehrbuchwert für Deutschland bei ~1,2 liegt (PRUEFUNG.md A3).
  return (bot_sum > 0 && top_n > 0) ? top_sum / bot_sum : 0;
}

// zusatz: { renten, co2_brutto, inzidenz } aus berechne.js — Werte, die der Staat bucht und
// die hier je Haushalt ankommen (PRUEFUNG-2.md I.4). co2_brutto in Mrd. €, sonst €/Haushalt.
function berechneDezilDelta(dezile, params, est_dez, klima, bg, kg, zusatz = {}) {
  const { renten = null, co2_brutto = BASIS_MAKRO.emissions * params.co2 / 1000, inzidenz = null } = zusatz;
  // Netto-Einkommen pro Dezil NEU
  const netto = [];
  const delta = [];
  const belastung_pct = [];
  for (let i = 0; i < dezile.length; i++) {
    const d = dezile[i];
    const est = est_dez[i].est;
    const brutto = d.brutto_adj;
    // K3: SV nur auf Arbeitseinkommen (nicht Kapital); KV-BBG (62.100 €) < RV/AL-BBG
    const arbeit_dez = brutto * (1 - d.kapital);
    const bbg_rv_dez = params.bbg ?? PRESETS.status_quo.bbg;
    // kv_bbg_frei: kein KV-Beitragsdeckel → gesamtes Arbeitseinkommen KV-pflichtig
    const bbg_kv_dez = params.kv_bbg_frei ? Infinity : Math.round(bbg_rv_dez * (BASIS_MAKRO.kv_bbg_kv_sq / PRESETS.status_quo.bbg));
    const sv_lohn = Math.min(arbeit_dez, bbg_rv_dez) * (params.rv + params.alpf * 0.42) / 100 * 0.5
                  + Math.min(arbeit_dez, bbg_kv_dez) * (params.kv + params.alpf * 0.58) / 100 * 0.5;
    // kv_kapital: Kapitalerträge von GKV-Mitgliedern werden KV-pflichtig (Mieteinnahmen, Zinsen, Dividenden)
    // GKV-Quote sinkt in den oberen Dezilen (mehr PKV)
    const GKV_QUOTE = [0.95, 0.95, 0.95, 0.93, 0.90, 0.85, 0.80, 0.75, 0.70, 0.55, 0.30, 0.08];
    const sv_kapital = params.kv_kapital ? brutto * d.kapital * params.kv / 100 * 0.5 * GKV_QUOTE[i] : 0;
    const sv = sv_lohn + sv_kapital;
    // MwSt auf Konsum
    const vornetto = brutto - est - sv;
    const konsum = vornetto * d.konsum;
    const mwst = konsum * (0.7 * params.mwst / (100 + params.mwst) + 0.3 * params.mwst_erm / (100 + params.mwst_erm));
    // CO₂-Last: das Bruttoaufkommen, vollständig überwälzt, nach dem regressiven Profil
    // (CO2_GEWICHT). Vorher summierte sich die Last auf 60,8 Mrd. bei 18 Mrd. Aufkommen.
    const co2_last = co2_brutto * 1000 * CO2_GEWICHT[i];
    // Klimageld zurück (gleichverteilt pro Kopf)
    const total_hh = DEZILE.reduce((a,d)=>a+d.anzahl,0);
    const klimageld_per_hh = klima * 1000 / total_hh;
    // Transfers erhalten
    const bge_p = params.bge || 0;
    // Bürgergeld effektiv: 0 wenn BGE >= BG-Niveau (BGE ersetzt es, RWI 2024)
    const bg_effektiv_hh = bge_p >= params.bg ? 0 : params.bg;
    let transfers = 0;
    transfers += bg_effektiv_hh * 12 * BUERGERGELD_QUOTE[i];
    transfers += params.kg * 12 * KINDER_JE_HH[i];
    // Unterkunft und Mehrbedarfe entfallen mit dem Bürgergeld, wenn ein BGE es ersetzt
    transfers += bg_effektiv_hh > 0 ? GRUNDSICHERUNG_FIX_HH[i] : 0;
    const ERWACHSENE_PRO_HH = 1.71; // Destatis Mikrozensus 2024: 70 Mio. Erwachsene / 41 Mio. Haushalte
    transfers += bge_p * 12 * ERWACHSENE_PRO_HH;
    if (params.neg_est && i < 3) transfers += 3000;

    // Rentenänderung aus dem Rentenniveau (berechne.js), brutto wie vom Staat gebucht
    const rente = renten ? renten[i] : 0;
    // Unternehmens- und Vermögensteuern, soweit sie vom Status quo abweichen (berechne.js)
    const inz = inzidenz ? inzidenz[i] : 0;

    const netto_final = brutto - est - sv - mwst - co2_last + klimageld_per_hh + transfers + rente - inz;

    // STATUS-QUO-Vergleich (hart codiert auf Basisparameter gerechnet)
    const netto_sq = berechneNettoSQ(d);
    netto.push(netto_final);
    delta.push(netto_final - netto_sq);
    belastung_pct.push(100 * (est + sv + mwst + co2_last - transfers) / brutto);
  }
  return { netto, delta, belastung_pct };
}

function berechneNettoSQ(d) {
  const sq = PRESETS.status_quo;
  const brutto = d.brutto;
  const arbeit_sq = brutto * (1 - d.kapital);
  const kapital_sq = brutto * d.kapital;
  const est = estHaushalt(arbeit_sq, sq.freibetrag, sq.eingang, sq.spitze, sq.grenze, d.pareto_alpha)
            + kapital_sq * sq.abgeltung / 100;
  // SV exakt wie berechneDezilDelta bei SQ-Parametern — die SQ-Referenz muss
  // dasselbe Modell mit denselben BBG-Konventionen sein, sonst sind die
  // Δ-Werte schon bei unveränderten Parametern ungleich null.
  const bbg_rv_sq = sq.bbg;
  const bbg_kv_sq = BASIS_MAKRO.kv_bbg_kv_sq;
  const sv = Math.min(arbeit_sq, bbg_rv_sq) * (sq.rv + sq.alpf * 0.42) / 100 * 0.5
           + Math.min(arbeit_sq, bbg_kv_sq) * (sq.kv + sq.alpf * 0.58) / 100 * 0.5;
  const vornetto = brutto - est - sv;
  const konsum = vornetto * d.konsum;
  const mwst = konsum * (0.7 * sq.mwst / (100 + sq.mwst) + 0.3 * sq.mwst_erm / (100 + sq.mwst_erm));
  const sq_co2_auf = BASIS_MAKRO.emissions * sq.co2 / 1000;
  const co2_last = sq_co2_auf * 1000 * CO2_GEWICHT[d.idx];
  const total_hh_sq = DEZILE.reduce((a,x)=>a+x.anzahl,0);
  const klimageld_per_hh = sq.klimageld ? sq_co2_auf * 0.7 * 1000 / total_hh_sq : 0;
  let transfers = 0;
  transfers += sq.bg * 12 * BUERGERGELD_QUOTE[d.idx];
  transfers += sq.kg * 12 * KINDER_JE_HH[d.idx];
  transfers += GRUNDSICHERUNG_FIX_HH[d.idx];
  return brutto - est - sv - mwst - co2_last + klimageld_per_hh + transfers;
}

export { FORMEL_QUELLEN_VERT, aequivalenzEinkommen, berechneGini, berechneMedianGewichtet, berechnePalma, berechneDezilDelta, berechneNettoSQ };
