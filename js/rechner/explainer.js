// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════════
// KASSENSTURZ · Kausalketten-Explainer (Wirkungsanalyse)
//
// Rekonstruiert die dominanten ökonomischen Kausalketten hinter den
// Simulationsergebnissen und formuliert prägnante didaktische Erklärungen.
// Nennt explizit die wissenschaftlichen Mechanismen (Saez/Chetty, Lewbel/Pendakur,
// HANK-Multiplikator, Domar r-g, Blanchard, DICE-Klimaschaden, SVR).
// ═══════════════════════════════════════════════════════════════════════════════

import { PRESETS } from '../data.js';

// Formatierungshelfer
const num = (v, digits = 1) => (Math.abs(v) < 0.5 * 10 ** -digits ? '0' : v.toFixed(digits));
const signed = (v, digits = 1) => (v >= 0 ? '+' : '') + num(v, digits);

/**
 * Erzeugt strukturierte Kausalketten-Meldungen für die aktuelle Periode.
 *
 * @param {object} params       Aktuelle Politikparameter
 * @param {object} result       Ergebnis aus berechne(params, zustand)
 * @param {object|null} zustand Aktueller Periodenzustand
 * @param {object|null} refParams Referenzparameter (Standard: PRESETS.status_quo)
 * @param {object|null} refZustand Referenzzustand (optional)
 * @param {object|null} schock  Aktiver Schock in dieser Periode (optional)
 * @returns {Array<{topic: string, tone: 'good'|'warn'|'bad'|'info', title: string, mechanism: string, text: string, kpiBadge?: string}>}
 */
export function erzeugeKausalketten(params, result, zustand = null, refParams = null, refZustand = null, schock = null) {
  const ref = refParams || PRESETS.status_quo;
  const cards = [];

  // ── 1. Exogener Schock ──────────────────────────────────────────────────────
  if (schock) {
    cards.push({
      topic: 'schock',
      tone: 'warn',
      title: `Exogener Schock: ${schock.name || schock.id}`,
      mechanism: `Exogene Störung (${schock.typ || 'Makro'})`,
      text: `${schock.beschreibung || schock.name} Dieser Schock trifft die Volkswirtschaft unabhängig von euren politischen Hebeln. Achtet darauf, welche Kennzahlen sich allein durch das Ereignis verändern (z. B. BIP-Rückgang oder Zinsanstieg).`,
      kpiBadge: schock.typ ? `Typ: ${schock.typ}` : undefined,
    });
  }

  // ── 2. Schuldenbremse & Fiskalische Tragfähigkeit (Art. 109 GG / Domar) ─────
  const saldoPct = result?.saldo_bip_pct ?? ((result?.saldo ?? 0) / 4470 * 100);

  if (saldoPct < -0.35) {
    cards.push({
      topic: 'fiskus',
      tone: 'bad',
      title: 'Schuldenbremse verfehlt (Art. 109 GG)',
      mechanism: 'Strukturelles Defizitkriterium (−0,35 % BIP)',
      text: `Das Finanzierungsdefizit liegt bei ${num(saldoPct, 2)} % des BIP (Grenze: −0,35 % bzw. Maastricht −3,0 %). Ohne Notlagenbeschluss nach Art. 109 Abs. 3 GG ist dieser Haushalt nicht verfassungskonform. Ein Defizit von ${num(Math.abs(result?.saldo ?? 0))} Mrd. € erfordert Gegenfinanzierung oder Ausgabenkürzungen.`,
      kpiBadge: `Saldo: ${signed(saldoPct, 2)} % BIP`,
    });
  } else if (saldoPct >= 0) {
    cards.push({
      topic: 'fiskus',
      tone: 'good',
      title: 'Ausgeglichener Haushalt („Schwarze Null“)',
      mechanism: 'Haushaltssanierung & Schuldenabbau',
      text: `Mit einem Überschuss von +${num(result?.saldo ?? 0)} Mrd. € (${num(saldoPct, 2)} % BIP) sinkt die Schuldenquote. Beachtet jedoch den Trade-off: Übermäßige Konsolidierung kann die Binnennachfrage und öffentliche Zukunftsinvestitionen dämpfen.`,
      kpiBadge: `Überschuss: +${num(result?.saldo ?? 0)} Mrd. €`,
    });
  }

  // ── 3. Einkommensteuer & Arbeitsangebotselastizität (Saez/Chetty / Progression)
  const deltaSpitze = (params.spitze ?? 45) - (ref.spitze ?? 45);
  const deltaFreibetrag = (params.freibetrag ?? 12348) - (ref.freibetrag ?? 12348);

  if (Math.abs(deltaSpitze) >= 1) {
    const erhoehung = deltaSpitze > 0;
    const dynEst = result?.dynamisch_est ?? 0;
    cards.push({
      topic: 'arbeit',
      tone: erhoehung ? 'info' : 'warn',
      title: erhoehung
        ? 'Spitzensteuersatz: Erhöhung & Arbeitsangebotsreaktion'
        : 'Spitzensteuersatz: Senkung & Anreizwirkung',
      mechanism: 'Saez/Chetty/Gruber Konsens (ε = 0,20) · Progression',
      text: erhoehung
        ? `Die Anhebung des Spitzensteuersatzes um ${signed(deltaSpitze, 0)} PP erhöht das Steueraufkommen und dämpft die Ungleichheit (Gini ${num(result?.gini ?? 0, 3)}). Verhaltensbedingt dämpft der geringere Netto-Grenzlohn jedoch das Arbeitsangebot am oberen Tarifende: Die verhaltensbedingte Differenz beträgt ${signed(dynEst, 1)} Mrd. € gegenüber der rein statischen Rechnung.`
        : `Die Senkung des Spitzensteuersatzes um ${num(Math.abs(deltaSpitze), 0)} PP stärkt den Leistungsanreiz für Spitzenverdiener, führt jedoch zu merklichen Einnahmeausfällen und erhöht die Einkommensungleichheit (Palma ${num(result?.palma ?? 0, 2)}).`,
      kpiBadge: `Spitzensatz: ${params.spitze} %`,
    });
  }

  if (Math.abs(deltaFreibetrag) >= 300) {
    const erhoehung = deltaFreibetrag > 0;
    cards.push({
      topic: 'verteilung',
      tone: erhoehung ? 'good' : 'warn',
      title: erhoehung
        ? 'Grundfreibetrag: Progressive Entlastung der Erwerbseinkommen'
        : 'Grundfreibetrag: Reale Kürzung des steuerfreien Existenzminimums',
      mechanism: 'Existenzminimum (§ 32a EStG) · Breitenwirkung',
      text: erhoehung
        ? `Die Anhebung des Grundfreibetrags um ${signed(deltaFreibetrag, 0)} € entlastet ausnahmslos alle Steuerpflichtigen, wirkt aber prozentual bei unteren und mittleren Einkommen am stärksten. Das senkt den Gini-Index, mindert jedoch das staatliche Lohnsteueraufkommen erheblich.`
        : `Das Absenken des Freibetrags verbreitert die Steuerbasis, belastet jedoch Geringverdiener relativ am stärksten.`,
      kpiBadge: `Freibetrag: ${params.freibetrag.toLocaleString('de-DE')} €`,
    });
  }

  // ── 4. Mehrwertsteuer & Regressivitätseffekt (Lewbel & Pendakur 2009) ───────
  const deltaMwst = (params.mwst ?? 19) - (ref.mwst ?? 19);
  const deltaMwstErm = (params.mwst_erm ?? 7) - (ref.mwst_erm ?? 7);

  if (Math.abs(deltaMwst) >= 1 || Math.abs(deltaMwstErm) >= 1) {
    const steigerung = deltaMwst > 0 || deltaMwstErm > 0;
    cards.push({
      topic: 'verteilung',
      tone: steigerung ? 'warn' : 'good',
      title: steigerung
        ? 'MwSt-Anhebung: Verlässliches Aufkommen mit regressiver Verteilungswirkung'
        : 'MwSt-Senkung: Entlastung der Binnennachfrage',
      mechanism: 'Lewbel/Pendakur (2009) · Konsumquote nach Dezilen',
      text: steigerung
        ? `Die Mehrwertsteuer ist mit über 300 Mrd. € das Rückgrat der Einnahmen. Da einkommensschwache Haushalte nahezu ihr gesamtes Nettoeinkommen konsumieren (Konsumquote bis zu 95 %), wirkt jede MwSt-Erhöhung regressiv: Untere Dezile tragen prozentual eine höhere Last als Vermögende.`
        : `Eine Senkung der Mehrwertsteuer stärkt direkt die Kaufkraft und entlastet untere Dezile, hinterlässt jedoch eine große Lücke im Bundeshaushalt.`,
      kpiBadge: `MwSt: ${params.mwst} % / ${params.mwst_erm} %`,
    });
  }

  // ── 5. Körperschaftsteuer & Investitionen (SVR / Gechert-Heimberger) ─────────
  const deltaKst = (params.kst ?? 15) - (ref.kst ?? 15);
  if (Math.abs(deltaKst) >= 1) {
    const erhoehung = deltaKst > 0;
    const invFaktor = result?.investment_factor ?? 1.0;
    cards.push({
      topic: 'investition',
      tone: erhoehung ? 'warn' : 'info',
      title: erhoehung
        ? 'Körperschaftsteuer: Investitionsdämpfung & Standortwettbewerb'
        : 'KSt-Senkung: Investitionsanreiz für Unternehmen',
      mechanism: 'Gechert/Heimberger (2022) · SVR-Investitionselastizität',
      text: erhoehung
        ? `Die Erhöhung der KSt auf ${params.kst} % bringt Mehreinnahmen, verschlechtert jedoch die Netto-Kapitalkosten. Modelliert über die SVR-Elastizität sinkt der Investitionsfaktor auf ${(invFaktor * 100).toFixed(1)} %, was mittelfristig das Potenzialwachstum des BIP bremst.`
        : `Die KSt-Senkung auf ${params.kst} % stimuliert die unternehmerische Investitionsbereitschaft (Investitionsfaktor: ${(invFaktor * 100).toFixed(1)} %), reißt jedoch ein Loch in die Unternehmenssteuer-Einnahmen.`,
      kpiBadge: `KSt: ${params.kst} %`,
    });
  }

  // ── 6. CO₂-Bepreisung & Klimageld (BEHG / DICE / Preiselastizität) ───────────
  const deltaCo2 = (params.co2 ?? 55) - (ref.co2 ?? 55);
  const klimageldStatus = params.klimageld;
  const refKlimageld = ref.klimageld;

  if (Math.abs(deltaCo2) >= 10 || klimageldStatus !== refKlimageld) {
    const klimageldAktiv = Boolean(klimageldStatus);
    const co2Preis = params.co2 ?? 55;
    const emissionen = result?.emissionen ?? 649;

    cards.push({
      topic: 'klima',
      tone: klimageldAktiv ? 'good' : 'warn',
      title: klimageldAktiv
        ? 'CO₂-Lenkungswirkung mit sozialem Klimageld-Ausgleich'
        : 'CO₂-Bepreisung ohne Klimageld: Regressive Belastungswirkung',
      mechanism: 'Preiselastizität der Emissionen (ε = −0,30) · Pro-Kopf-Transfer',
      text: klimageldAktiv
        ? `Der CO₂-Preis von ${co2Preis} €/t senkt den CO₂-Ausstoß auf ${num(emissionen, 0)} Mt. Da 70 % der Einnahmen als pauschales Klimageld an alle Bürger zurückgezahlt werden (${num(result?.klimageld_auszahlung ?? 0, 1)} Mrd. €), werden energieeffiziente und ärmere Haushalte netto entlastet (progressive Umverteilung).`
        : `Der CO₂-Preis von ${co2Preis} €/t dämpft Emissionen, wirkt aber ohne Klimageld-Rückerstattung regressiv auf Haushalte mit niedrigen Einkommen (Heiz- und Mobilitätskosten).`,
      kpiBadge: `CO₂: ${co2Preis} €/t · ${num(emissionen, 0)} Mt`,
    });
  }

  // ── 7. Transfers & HANK-Multiplikator (Bürgergeld / BGE / Investitionsimpuls) 
  const bge = params.bge ?? 0;
  const deltaBg = (params.bg ?? 563) - (ref.bg ?? 563);
  const investImpuls = params.invest_impuls ?? 0;

  if (bge > 0) {
    cards.push({
      topic: 'verteilung',
      tone: 'info',
      title: 'Bedingungsloses Grundeinkommen: Sockelsicherung vs. Kostenlast',
      mechanism: 'BGE-Arbeitsangebotseffekt (RWI 2024) · Ersatz von Sozialtransfers',
      text: `Ein BGE von ${bge} €/Monat beseitigt Einkommensarmut und senkt den Palma-Index drastisch. Mit Bruttokosten von ${num(result?.bge_brutto ?? 0, 1)} Mrd. € erfordert es jedoch eine gewaltige Gegenfinanzierung. Zudem dämpft der höhere Reservationslohn das Arbeitsangebot insbesondere im Niedriglohnsektor.`,
      kpiBadge: `BGE: ${bge} €/Monat`,
    });
  } else if (Math.abs(deltaBg) >= 40) {
    const erhoehung = deltaBg > 0;
    cards.push({
      topic: 'verteilung',
      tone: erhoehung ? 'good' : 'info',
      title: erhoehung
        ? 'Bürgergeld: Armutsbekämpfung & HANK-Konsummultiplikator'
        : 'Bürgergeld-Kürzung: Fiskalische Einsparung',
      mechanism: 'HANK-Multiplikator μ_G (Kaplan/Moll/Violante) · Grenzkonsumneigung',
      text: erhoehung
        ? `Die Anhebung des Bürgergelds um ${signed(deltaBg, 0)} €/Monat senkt das Armutsrisiko auf ${num(result?.armutsrisiko ?? 14.8, 1)} %. Da Transferempfänger eine sehr hohe marginale Konsumquote (MPC ≈ 0,9) aufweisen, fließt das Geld fast vollständig in den Wirtschaftskreislauf zurück (starker Multiplikatoreffekt).`
        : `Die Absenkung des Bürgergelds spart Bundesmittel, erhöht jedoch das Armutsrisiko der betroffenen Haushalte.`,
      kpiBadge: `Bürgergeld: ${params.bg} €`,
    });
  }

  if (investImpuls > 0) {
    cards.push({
      topic: 'investition',
      tone: 'good',
      title: 'Öffentlicher Investitionsimpuls: Modernisierung & Multiplikator',
      mechanism: 'Keynesianischer / HANK-Multiplikator · Infrastruktur-Kapitalstock',
      text: `Zusätzliche öffentliche Investitionen von ${investImpuls} Mrd. €/Jahr belasten zwar den laufenden Haushaltssaldo, stärken jedoch die Binnennachfrage und den gesamtwirtschaftlichen Kapitalstock (Verkehr, Bildung, Digitalisierung, Netze).`,
      kpiBadge: `Investitionen: +${investImpuls} Mrd. €`,
    });
  }

  // ── 8. Domar-Schuldendynamik (r − g) ─────────────────────────────────────────
  if (zustand && zustand.schuldenquote > 65) {
    cards.push({
      topic: 'fiskus',
      tone: zustand.schuldenquote > 75 ? 'bad' : 'warn',
      title: 'Schuldenstandsquote & Domar-Dynamik',
      mechanism: 'Domar-Bedingung (r − g) · Blanchard (2019)',
      text: `Die Schuldenquote steht bei ${num(zustand.schuldenquote, 1)} % des BIP. Wenn der Effektivzins (r) die nominale Wachstumsrate (g) übersteigt, wächst die Schuldenquote selbst bei ausgeglichenem Primärsaldo von allein an (Schuldenfalle).`,
      kpiBadge: `Schulden: ${num(zustand.schuldenquote, 1)} % BIP`,
    });
  }

  // ── 9. Status-Quo-Rückfallebene (wenn keine wesentlichen Hebel bewegt) ───────
  if (cards.length === 0) {
    cards.push({
      topic: 'fiskus',
      tone: 'info',
      title: 'Status quo bestätigt: Ausgangsgleichgewicht',
      mechanism: 'Referenzpfad Deutschland 2025 (Destatis/BMF)',
      text: 'Die gewählten Parameter entsprechen dem aktuellen Rechts- und Steuerstand. Das strukturelle Defizit spiegelt die bestehende Haushaltslücke wider. Verändere einzelne Regler, um die ökonomischen Wirkungsketten und Zielkonflikte zu beobachten.',
      kpiBadge: `Saldo: ${signed(saldoPct, 2)} % BIP`,
    });
  }

  // ── Priorisierung: Max. 5 Karten, Schock & Alarme zuerst ────────────────────
  const PRIORITAET = { schock: 1, bad: 2, warn: 3, good: 4, info: 5 };
  return cards
    .sort((a, b) => {
      const pA = a.topic === 'schock' ? 0 : (PRIORITAET[a.tone] ?? 99);
      const pB = b.topic === 'schock' ? 0 : (PRIORITAET[b.tone] ?? 99);
      return pA - pB;
    })
    .slice(0, 5);
}
