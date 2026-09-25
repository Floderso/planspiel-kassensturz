// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// KASSENSTURZ · Einkommensteuer-Tariffunktionen
// Rechtsgrundlage: § 32a EStG 2026 (Formeltarif, 5 Zonen) — Referenzjahr 2026
// ═══════════════════════════════════════════════════════

// Quellenmetadaten — parallel zu den Berechnungsfunktionen
const FORMEL_QUELLEN_EST = {
  estTarif: {
    formel: '∫₀ˣ r(z) dz  (stückweise lineare Grenzsteuerrate, 5 Zonen)',
    ref:    '§ 32a Abs. 1 EStG 2026 (Steuerfortentwicklungsgesetz, BGBl. 2024 I Nr. 449) · Formeltarif (kontinuierlich, keine Sprünge)',
    note:   'Zonenbreiten 2026 fest (12.348 / 17.799 / 69.878 / 277.825); spitze wirkt nur ab grenze, grenze verschiebt nur den Beginn der obersten Zone, Zone 4 fest 42 % (gedeckelt auf die Spitze). Bis 25.09.2026 skalierten alle Zonen mit (PRUEFUNG.md B1/B2)'
  },
  grenzsteuersatz: {
    formel: 'r(z) = r₀ + (rₘ − r₀) × z/g₂  [Zone 2], linear interpoliert je Zone',
    ref:    '§ 32a Abs. 1 Nr. 2–5 EStG · BMF Steuerschätzung 2025',
    note:   'Kontinuierlicher Übergang an Zonengrenzen — DE-spezifische Eigenschaft des Formeltarifs'
  },
  effSteuersatz: {
    formel: 'T(z) / z',
    ref:    '§ 2 Abs. 5 EStG',
    note:   'Durchschnittssteuersatz = Gesamtsteuer / Gesamteinkommen; stets ≤ Grenzsteuersatz'
  },
  spitzenzone: {
    formel: 'Zuschlag_D10c = (r5 − r4) × E[max(0, x − Grenze)],  x ~ Pareto(α = 1,5) mit dem zvE-Mittel des Dezils',
    ref:    'Atkinson/Piketty/Saez (2011) JEL 49(1), Top Incomes in the Long Run of History · Bartels/Jenderny (2015) DIW Discussion Paper 1508',
    note:   'Für Deutschland liegt der invertierte Pareto-Koeffizient β bei etwa 2,5–3, also α = β/(β−1) ≈ 1,5–1,7; α = 1,5 ist der untere Rand (schwerer Rand). Statisch, ohne Verhaltensreaktion der Spitzenverdiener. Näherung (PRUEFUNG.md B2)'
  },
  estHaushalt: {
    formel: 'T_HH = s × T(brutto × q / s)  mit q = zvE-Quote, s = Splitting-Faktor',
    ref:    '§§ 26, 32a Abs. 5 EStG (Splitting) · Destatis ESt-Statistik (zvE vs. Bruttoeinkünfte) · Mikrozensus 2024',
    note:   'q ≈ 0,79: Werbungskosten, Vorsorgeaufwendungen, Sonderausgaben senken das zvE unter das Brutto. ' +
            's ≈ 1,6 Tarifeinheiten je Haushalt: ~17 Mio. Einpersonen- + ~24 Mio. Mehrpersonen-HH (Splitting) von 41 Mio.'
  }
};

// ── Haushaltsebene ──────────────────────────────────────────────────────────
// Die DEZILE-Daten sind Haushalts-Bruttoeinkommen. Der Tarif gilt aber je
// Steuerpflichtigem (bzw. Splitting-Paar) auf das zu versteuernde Einkommen.
// Kalibrierung: ESt-Aufkommen bei Status-quo-Parametern ≈ BMF-Ist
// (Lohnsteuer + veranlagte ESt 2024: ~330 Mrd. € ohne Kapitalerträge).
const ZVE_QUOTE        = 0.79; // zvE / Haushaltsbrutto (Destatis ESt-Statistik)
const SPLITTING_FAKTOR = 1.6;  // Tarifeinheiten je Haushalt (Mikrozensus 2024)

// Einkommensteuer eines Haushalts auf Arbeits-/Gesamteinkommen 'brutto'.
// pareto_alpha (nur D10c): Die Einkommen innerhalb des Dezils folgen einer Pareto-
// Verteilung mit diesem Mittelwert. Der Durchschnitt des obersten Prozents liegt mit rund
// 190.000 € zvE je Veranlagung unter der Grenze der obersten Zone (277.826 €) — ohne diese
// Verteilung zahlte niemand im Modell den Spitzensatz, und der Regler wirkte auf nichts.
// Gerechnet wird: Tarif bis Zone 4 auf den Durchschnitt, dazu (r5 − r4) × E[max(0, x − Grenze)].
function estHaushalt(brutto, freibetrag, eingang, spitze, grenze, pareto_alpha = null) {
  const mittel = brutto * ZVE_QUOTE / SPLITTING_FAKTOR;
  if (!pareto_alpha) return SPLITTING_FAKTOR * estTarif(mittel, freibetrag, eingang, spitze, grenze);
  const bis_zone4 = estTarif(mittel, freibetrag, eingang, spitze, Infinity);
  const { r4, r5 } = zonen(freibetrag, eingang, spitze, grenze);
  return SPLITTING_FAKTOR * (bis_zone4 + (r5 - r4) * paretoUeberschuss(mittel, pareto_alpha, grenze));
}

// E[max(0, x − schwelle)] für x ~ Pareto(α) mit Mittelwert 'mittel'
function paretoUeberschuss(mittel, alpha, schwelle) {
  const xm = mittel * (alpha - 1) / alpha;
  if (schwelle <= xm) return mittel - schwelle;
  return Math.pow(xm, alpha) * Math.pow(schwelle, 1 - alpha) / (alpha - 1);
}

// Grenzbelastung eines zusätzlichen Euro Haushaltsbrutto:
// d/dB [s·T(B·q/s)] = q · T'(B·q/s)
// Mit pareto_alpha: durchschnittlicher Grenzsatz über die Verteilung — bis Zone 4 wie der
// Durchschnitt, dazu (r5 − r4) × Anteil der Veranlagungen über der Grenze
function grenzsteuersatzHaushalt(brutto, freibetrag, eingang, spitze, grenze, pareto_alpha = null) {
  const mittel = brutto * ZVE_QUOTE / SPLITTING_FAKTOR;
  if (!pareto_alpha) return ZVE_QUOTE * grenzsteuersatz(mittel, freibetrag, eingang, spitze, grenze);
  const { r4, r5 } = zonen(freibetrag, eingang, spitze, grenze);
  const xm = mittel * (pareto_alpha - 1) / pareto_alpha;
  const anteil_oben = grenze <= xm ? 1 : Math.pow(xm / grenze, pareto_alpha);
  return ZVE_QUOTE * (grenzsteuersatz(mittel, freibetrag, eingang, spitze, Infinity) + (r5 - r4) * anteil_oben);
}



// Zonenbreiten § 32a Abs. 1 EStG 2026 — einmal definiert, von Tarif und Grenzsatz genutzt
const ZONE_2026 = { z2: 17799 - 12348, z3: 69878 - 17799, z4: 277825 - 69878 };
const SATZ_ZONE4 = 0.42; // § 32a Abs. 1 Nr. 4 EStG: 42 % zwischen 69.879 und 277.825 €

// Jeder Regler wirkt nur dort, wo sein Name hinzeigt (PRUEFUNG.md B1/B2):
//   freibetrag — verschiebt den ganzen Tarif (Zonenbreiten 2026 bleiben)
//   eingang    — Grenzsatz am Beginn der Progressionszone
//   spitze     — Grenzsatz der obersten Zone, ab 'grenze'
//   grenze     — Beginn der obersten Zone; Zonen 2 und 3 bleiben, wo sie sind
// Bis 25.09.2026 skalierte 'grenze' alle Zonenbreiten mit (Grenze 150.000 € → 40.000 € zvE
// zahlte 41 % statt 32 % Grenzsatz), und 'spitze' hob die 42-%-Zone mit an (Spitze 55 % →
// Zone 4 bei 51 %; D5 zahlte 321 € mehr, das Aufkommen stieg um 37 statt ~5 Mrd.).
// Liegt die Spitze unter 42 %, wird Zone 4 auf sie gedeckelt — sonst wäre der Tarif oben
// regressiv. Liegt die Grenze unter dem Ende von Zone 3, endet der Tarif dort mit der Spitze.
function zonen(freibetrag, eingang, spitze, grenze) {
  const G  = Math.max(0, grenze - freibetrag);   // Beginn Zone 5, relativ zum Freibetrag
  const e2 = Math.min(ZONE_2026.z2, G);
  const e3 = Math.min(ZONE_2026.z2 + ZONE_2026.z3, G);
  const r0 = eingang / 100;
  const r5 = spitze / 100;
  const r4 = Math.min(SATZ_ZONE4, r5);
  // rm: Grenzsatz am Ende von Zone 2 — § 32a 2025 und 2026: 23,97 % bei r0 = 14 %, r4 = 42 %
  const rm = r0 + (r4 - r0) * 0.35607;
  return { e2, e3, G, r0, rm, r4, r5 };
}

function estTarif(einkommen, freibetrag, eingang, spitze, grenze) {
  if (einkommen <= freibetrag) return 0;
  const x = einkommen - freibetrag;
  const { e2, e3, G, r0, rm, r4, r5 } = zonen(freibetrag, eingang, spitze, grenze);
  const w2 = ZONE_2026.z2, w3 = ZONE_2026.z3;
  // Integral der stückweise linearen Grenzsteuerrate
  const T2 = t => r0 * t + (rm - r0) * t * t / (2 * w2);                   // 0 ≤ t ≤ w2
  const T3 = t => rm * t + (r4 - rm) * t * t / (2 * w3);                   // 0 ≤ t ≤ w3
  const bis = Math.min(x, G);
  let steuer = T2(Math.min(bis, e2));
  if (bis > e2) steuer += T3(Math.min(bis, e3) - e2);
  if (bis > e3) steuer += r4 * (bis - e3);
  if (x > G)    steuer += r5 * (x - G);
  return steuer;
}

function grenzsteuersatz(einkommen, freibetrag, eingang, spitze, grenze) {
  if (einkommen <= freibetrag) return 0;
  const x = einkommen - freibetrag;
  const { e2, e3, G, r0, rm, r4, r5 } = zonen(freibetrag, eingang, spitze, grenze);
  if (x > G)  return r5;
  if (x <= e2) return r0 + (rm - r0) * x / ZONE_2026.z2;
  if (x <= e3) return rm + (r4 - rm) * (x - e2) / ZONE_2026.z3;
  return r4;
}

// Effektiver Durchschnittssteuersatz
function effSteuersatz(einkommen, freibetrag, eingang, spitze, grenze) {
  if (einkommen <= freibetrag) return 0;
  return estTarif(einkommen, freibetrag, eingang, spitze, grenze) / einkommen;
}

export { estTarif, grenzsteuersatz, effSteuersatz, estHaushalt, grenzsteuersatzHaushalt, ZVE_QUOTE, SPLITTING_FAKTOR, FORMEL_QUELLEN_EST };
