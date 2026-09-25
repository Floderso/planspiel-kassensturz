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
    note:   'Zonen werden proportional zur grenze-Parameter skaliert; Referenz: SQ-Grenzwerte 2026 (12.348 / 17.799 / 69.878 / 277.825)'
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

// Einkommensteuer eines Haushalts auf Arbeits-/Gesamteinkommen 'brutto'
function estHaushalt(brutto, freibetrag, eingang, spitze, grenze) {
  return SPLITTING_FAKTOR
    * estTarif(brutto * ZVE_QUOTE / SPLITTING_FAKTOR, freibetrag, eingang, spitze, grenze);
}

// Grenzbelastung eines zusätzlichen Euro Haushaltsbrutto:
// d/dB [s·T(B·q/s)] = q · T'(B·q/s)
function grenzsteuersatzHaushalt(brutto, freibetrag, eingang, spitze, grenze) {
  return ZVE_QUOTE
    * grenzsteuersatz(brutto * ZVE_QUOTE / SPLITTING_FAKTOR, freibetrag, eingang, spitze, grenze);
}


// Basis-Grenzwerte 2026; werden beim Ändern von Freibetrag/Spitze/Grenze skaliert.
// Für Status Quo: exakt gesetzliche Werte.
// Bei Parameteränderung: Zonen werden proportional skaliert.

// Zonenbreiten § 32a Abs. 1 EStG 2026 — einmal definiert, von Tarif und Grenzsatz genutzt
const ZONE_2026 = { z2: 17799 - 12348, z3: 69878 - 17799, z4: 277825 - 69878 };

function estTarif(einkommen, freibetrag, eingang, spitze, grenze) {
  if (einkommen <= freibetrag) return 0;
  const zve = einkommen - freibetrag;

  // Status-Quo-Grenzwerte 2026 (relativ zum Freibetrag; § 32a Abs. 1 EStG 2026)
  // Zone 2: 12.349–17.799 (5.451 € breit), Zone 3: 17.800–69.878 (52.079 € breit)
  // Zone 4: 69.879–277.825 (207.947 € breit), Zone 5: ab 277.826
  // Vorher: Breiten von 2025 mit dem Grundfreibetrag 2026 — ein Tarif, den es nie gab (PRUEFUNG.md B6).
  // Wir skalieren Zone 4/5-Grenze auf 'grenze' und Zone 2/3-Grenzwerte proportional.
  const sq_z2 = ZONE_2026.z2;
  const sq_z3 = ZONE_2026.z3;
  const sq_z4 = ZONE_2026.z4;
  const sq_total = sq_z2 + sq_z3 + sq_z4; // = 265.477 = 277.825 − 12.348
  const scale = (grenze - freibetrag) / sq_total;
  const g2 = sq_z2 * scale; // Breite Zone 2 skaliert
  const g3 = sq_z3 * scale; // Breite Zone 3 skaliert

  // Eingangssatz beeinflusst Zone 2 (Progressionszone)
  // Spitzensatz gilt ab Zone 5 (=grenze)
  // Zone 4: Interpolation so gewichtet, dass SQ (14 %, 45 %) exakt die
  // gesetzlichen 42 % ergibt: 42 = 14×(3/31) + 45×(28/31)
  const satz4 = Math.min(spitze, eingang * (3 / 31) + spitze * (28 / 31)) / 100;

  // Marginalsteuersatz-Grenzen (keine Sprünge an Zonengrenzen):
  // Zone 2: r0 → rm  (Eingangssatz → Zwischensatz)
  // Zone 3: rm → r4  (Zwischensatz → Zone-4-Satz, kontinuierlich)
  // Zone 4: r4 (konstant)  Zone 5: r5 = spitze/100
  // rm = r0 + (r4 - r0) × 0.35607 — § 32a 2025 und 2026: Grenzsatz am Zone-2-Ende = 23,97 %
  const r0 = eingang / 100;
  const r4 = satz4;
  const r5 = spitze / 100;
  const rm = r0 + (r4 - r0) * 0.35607;
  const g4 = sq_z4 * scale;

  // Integral der stückweise linearen Grenzsteuerrate: ∫₀ˣ [a + (b−a)·t/w] dt
  const T = (a, b, w, x) => a * x + (b - a) * x * x / (2 * w);

  const T2 = T(r0, rm, g2, g2);
  const T3 = T(rm, r4, g3, g3);
  const T4 = r4 * g4;

  if (zve <= g2) {
    return T(r0, rm, g2, zve);
  } else if (zve <= g2 + g3) {
    return T2 + T(rm, r4, g3, zve - g2);
  } else if (zve <= g2 + g3 + g4) {
    // Zone 4: linear mit satz4
    const zv4 = zve - g2 - g3;
    return T2 + T3 + r4 * zv4;
  } else {
    const zv5 = zve - g2 - g3 - g4;
    return T2 + T3 + T4 + r5 * zv5;
  }
}

function grenzsteuersatz(einkommen, freibetrag, eingang, spitze, grenze) {
  if (einkommen <= freibetrag) return 0;
  const zve = einkommen - freibetrag;
  const scale = (grenze - freibetrag) / (ZONE_2026.z2 + ZONE_2026.z3 + ZONE_2026.z4);
  const g2 = ZONE_2026.z2 * scale;
  const g3 = ZONE_2026.z3 * scale;
  const g4 = ZONE_2026.z4 * scale;
  const r0 = eingang / 100;
  const r4 = Math.min(spitze, eingang * (3 / 31) + spitze * (28 / 31)) / 100;
  const rm = r0 + (r4 - r0) * 0.35607; // kontinuierlich: Zone-2-Ende = Zone-3-Start (SQ: 23,97 %)

  if (zve <= g2)           return r0 + (rm - r0) * zve / g2;
  if (zve <= g2 + g3)      return rm + (r4 - rm) * (zve - g2) / g3;
  if (zve <= g2 + g3 + g4) return r4;
  return spitze / 100;
}

// Effektiver Durchschnittssteuersatz
function effSteuersatz(einkommen, freibetrag, eingang, spitze, grenze) {
  if (einkommen <= freibetrag) return 0;
  return estTarif(einkommen, freibetrag, eingang, spitze, grenze) / einkommen;
}

export { estTarif, grenzsteuersatz, effSteuersatz, estHaushalt, grenzsteuersatzHaushalt, ZVE_QUOTE, SPLITTING_FAKTOR, FORMEL_QUELLEN_EST };
