// SPDX-License-Identifier: CC-BY-4.0
// ═══════════════════════════════════════════════════════════════════════════
// MAKRO-PLANSPIEL UI · News pool (offline article database)
//
// Fictional German-language press from "Econland". Articles NARRATE what is
// happening in the country — they never explain mechanics. Students must
// connect headline and numbers themselves (architecture doc §5).
//
// Selection contract (used by ui/js/news.js):
//   id        unique slug
//   outlet    fictional paper
//   headline  narrative headline
//   body      1–3 sentences of observable phenomena (no mechanic names!)
//   quote     optional voice (fictional citizen/official)
//   tags      { topic, direction } — topic ∈ inflation|unemployment|debt|
//             growth|rate|gini|green|credibility|shock:<id>|neutral,
//             direction ∈ up|down|high|low|neutral
//   effects   OPTIONAL shock-shaped effects object — event articles with
//             effects are scheduled into the NEXT round (news that becomes
//             reality), keeping all state changes inside the tested engine.
// ═══════════════════════════════════════════════════════════════════════════

export const ARTICLES = [
  // ── Inflation ──
  {
    id: 'infl_up_1', outlet: 'Econland Kurier',
    headline: 'Bäckereien erhöhen Preise — „Wir ziehen alle zwei Monate nach“',
    body: 'Brot, Mieten, Tankstelle: Verbraucher spüren es überall. Händler berichten von ungewöhnlich häufigen Preisanpassungen in kurzen Abständen.',
    quote: '„Mein Wocheneinkauf kostet spürbar mehr als noch vor einem Jahr.“ — Sandra W., 34, aus der Hafenstadt',
    tags: { topic: 'inflation', direction: 'up' },
  },
  {
    id: 'infl_up_2', outlet: 'Die Bilanz',
    headline: 'Tarifverhandlungen eskalieren: Gewerkschaft fordert zweistellige Lohnerhöhung',
    body: 'Mit Blick auf die Teuerung verschärft die Gewerkschaft ihre Forderungen. Arbeitgeber warnen vor einer Lohn-Preis-Spirale — ein Begriff, der plötzlich wieder in allen Leitartikeln steht.',
    tags: { topic: 'inflation', direction: 'up' },
  },
  {
    id: 'infl_high_1', outlet: 'Marktplatz',
    headline: 'Preisschilder kommen nicht hinterher: Geschäfte drucken täglich neu',
    body: 'In den Innenstädten wechseln Preisauszeichnungen inzwischen wöchentlich. Konsumforscher beobachten Hamsterkäufe bei langlebigen Gütern — aus Angst vor den Preisen von morgen.',
    tags: { topic: 'inflation', direction: 'high' },
  },
  {
    id: 'infl_down_1', outlet: 'Econland Kurier',
    headline: 'Entspannung an der Ladenkasse: Preise stabilisieren sich',
    body: 'Nach Monaten der Unruhe bleiben die Preisschilder liegen. Verbraucher atmen auf, Händler berichten von normaler Nachfrage.',
    tags: { topic: 'inflation', direction: 'down' },
  },
  {
    id: 'infl_low_1', outlet: 'Die Bilanz',
    headline: 'Händler starten Preisschlacht: „Die Kunden bleiben aus“',
    body: 'Dauerrabatte in den Fußgängerzonen: Geschäfte kämpfen mit Preisnachlässen um kaufscheues Publikum. Ökonomen beobachten die Entwicklung mit wachsender Sorge.',
    tags: { topic: 'inflation', direction: 'low' },
  },

  // ── Unemployment ──
  {
    id: 'unemp_up_1', outlet: 'Der Staatsbürger',
    headline: 'Schichtpläne gestrichen: Erste Betriebe melden Kurzarbeit',
    body: 'In den Industriegebieten werden Hallen dunkler. Arbeitsämter registrieren steigende Fallzahlen, Beratungsstellen verlängern ihre Öffnungszeiten.',
    quote: '„Zwanzig Jahre war ich nie arbeitslos. Jetzt stehe ich hier.“ — Mehmet K., 52, Maschinenschlosser',
    tags: { topic: 'unemployment', direction: 'up' },
  },
  {
    id: 'unemp_high_1', outlet: 'Econland Kurier',
    headline: 'Schlangen vor dem Arbeitsamt: Behörde richtet Notfallteams ein',
    body: 'Die Wartelisten für Beratungstermine wachsen auf Wochen. Gewerke warnen vor einem Ausbildungs-Abbruch-Jahrgang, Sozialverbände fordern schnelle Antworten der Regierung.',
    tags: { topic: 'unemployment', direction: 'high' },
  },
  {
    id: 'unemp_down_1', outlet: 'Marktplatz',
    headline: '„Gesucht: Alle“ — Firmen plakatieren Notausgänge mit Stellenanzeigen',
    body: 'Restaurants, Baufirmen, Kliniken: Der Arbeitsmarkt dreht sich. Personalagenturen berichten von Kandidaten, die sich Angebote aussuchen können.',
    tags: { topic: 'unemployment', direction: 'down' },
  },
  {
    id: 'unemp_down_2', outlet: 'Die Bilanz',
    headline: 'Neue Einstellungswelle: Industrie fährt Schichten wieder hoch',
    body: 'Zusätzliche Frühschichten, verlängerte Wochenenden, volle Auftragsbücher — in den Fabrikhallen des Landes läuft es wieder rund.',
    tags: { topic: 'unemployment', direction: 'down' },
  },

  // ── Debt ──
  {
    id: 'debt_high_1', outlet: 'Die Bilanz',
    headline: 'Anleihe-Auktion enttäuscht: Staat muss höhere Zinsen bieten',
    body: 'Bei der jüngsten Emission staatlicher Anleihen blieben Gebote aus. Händler sprechen von „wachsender Vorsicht“ internationaler Investoren gegenüber dem Land.',
    tags: { topic: 'debt', direction: 'high' },
  },
  {
    id: 'debt_high_2', outlet: 'Marktplatz',
    headline: 'Rating-Agentur stuft Kreditwürdigkeit herab — Finanzminister „besonnen“',
    body: 'Die Herabstufung verteuert die Refinanzierung des Staates. Oppositionspolitiker wittern Versagen, der Minister betont die „solide Grundsubstanz“.',
    tags: { topic: 'debt', direction: 'high' },
  },
  {
    id: 'debt_down_1', outlet: 'Econland Kurier',
    headline: 'Staat zahlt zurück: Anleger reißen sich um sichere Papiere',
    body: 'Überzeichnete Auktion bei Rekordkonditionen — der Staat kommt günstig an Geld. Analysten loben den „langweiligen, aber verlässlichen Kurs“ der Regierung.',
    tags: { topic: 'debt', direction: 'down' },
  },

  // ── Growth ──
  {
    id: 'growth_up_1', outlet: 'Marktplatz',
    headline: 'Baumaschinen im Dauereinsatz: Auftragsbücher so voll wie nie',
    body: 'Neubaugebiete, Bahnstrecken, Lagerhallen — überall wird gebaut. Zulieferer klagen über Engpässe, Arbeiter über Überstunden. Die Konjunktur brummt.',
    tags: { topic: 'growth', direction: 'up' },
  },
  {
    id: 'growth_down_1', outlet: 'Der Staatsbürger',
    headline: 'Stillstand in der Hafenstadt: Werften melden Auftragsloch',
    body: 'Leere Lagerplätze, geparkte Kräne, ruhige Kantinen. Die Region spürt den Abschwung zuerst — und fragt sich, wie tief er geht.',
    tags: { topic: 'growth', direction: 'down' },
  },
  {
    id: 'growth_down_2', outlet: 'Econland Kurier',
    headline: 'Ladensterben in der Innenstadt: „Die Kundschaft hält das Geld zusammen“',
    body: 'Zwischen den Großfilialen stehen immer mehr Schaufenster leer. Der Einzelhandelsverband spricht von der schwierigsten Saison seit Jahren.',
    tags: { topic: 'growth', direction: 'down' },
  },

  // ── Interest rate ──
  {
    id: 'rate_up_1', outlet: 'Die Bilanz',
    headline: 'Baukredit über 5 Prozent: Junge Familien streichen Hauspläne',
    body: 'Die Zinswende ist am Küchentisch angekommen. Banken melden einbrechende Kreditanfragen, Makler streichen Preisschilder.',
    quote: '„Vor zwei Jahren hätten wir bauen können. Heute rechnen wir lieber nochmal nach.“ — Familie Berger',
    tags: { topic: 'rate', direction: 'up' },
  },
  {
    id: 'rate_down_1', outlet: 'Marktplatz',
    headline: 'Geld ist wieder billig: Banken locken mit Niedrigzins-Krediten',
    body: 'Sparkassen werben aggressiv um Kreditkunden. Unternehmen greifen zu — erste Investitionsvorhaben, die auf Eis lagen, werden aus der Schublade geholt.',
    tags: { topic: 'rate', direction: 'down' },
  },

  // ── Inequality / social ──
  {
    id: 'gini_up_1', outlet: 'Der Staatsbürger',
    headline: 'Tafeln am Limit: „Wir sehen Gesichter, die wir noch nie gesehen haben“',
    body: 'Die Ausgabestellen verzeichnen Rekordzulauf — auch Erwerbstätige kommen. Freiwillige berichten von Scham, Wut und viel Dankbarkeit.',
    tags: { topic: 'gini', direction: 'up' },
  },
  {
    id: 'gini_up_2', outlet: 'Econland Kurier',
    headline: 'Zwei Econland: Villenviertel baut Mauern, Plattenbau wartet auf Fahrstuhl-Reparatur',
    body: 'Während im Westen Sicherheitsdienste Zufahrten kontrollieren, wartet der Osten seit Monaten auf Ersatzteile. Stadtforscher sprechen von „sichtbarer Polarisierung“.',
    tags: { topic: 'gini', direction: 'up' },
  },
  {
    id: 'gini_down_1', outlet: 'Der Staatsbürger',
    headline: 'Stadtteil-Fonds zeigt Wirkung: Neuer Spielplatz, neue Kita, neue Hoffnung',
    body: 'Im Brennpunktviertel ändert sich etwas: Sanierte Treppenhäuser, belegte Kurse im Gemeinschaftszentrum. „Man merkt, dass jemand an uns denkt“, sagt eine Mutter.',
    tags: { topic: 'gini', direction: 'down' },
  },

  // ── Green transition ──
  {
    id: 'green_up_1', outlet: 'Marktplatz',
    headline: 'Rotorblätter auf der Autobahn: Windpark-Bau läuft Tag und Nacht',
    body: 'Schwertransporte rollen Richtung Küste — die Energiewende wird sichtbar. Handwerksbetriebe für Montage und Wartung können sich vor Aufträgen kaum retten.',
    tags: { topic: 'green', direction: 'up' },
  },
  {
    id: 'green_up_2', outlet: 'Econland Kurier',
    headline: 'Dächer werden Kraftwerke: Förderstelle meldet Antrags-Rekord',
    body: 'Solaranlagen, Wärmepumpen, Quartierskonzepte: Die Wartelisten der Förderberatung wachsen. Energieberater sind bundesweit ausgebucht.',
    tags: { topic: 'green', direction: 'up' },
  },
  {
    id: 'green_down_1', outlet: 'Die Bilanz',
    headline: 'Kohlekessel läuft wieder voller: Versorger warnen vor Rückschritt',
    body: 'Weil erneuerbare Kapazitäten fehlen, fahren Kraftwerke alte Reserven hoch. Umweltverbände sprechen von einem „verlorenen Jahr für das Klima“.',
    tags: { topic: 'green', direction: 'down' },
  },

  // ── Credibility ──
  {
    id: 'cred_low_1', outlet: 'Die Bilanz',
    headline: '„Wem sollen wir noch glauben?“ — Debatte um Unabhängigkeit der Zentralbank',
    body: 'Offene Kritik aus der Regierung an der Währungshüterin, Rücktrittsgerüchte, hektische Termine: An den Märkten wächst die Nervosität — und die Unsicherheit an der Supermarktkasse.',
    tags: { topic: 'credibility', direction: 'low' },
  },

  // ── Shocks ──
  {
    id: 'shock_energy_crisis', outlet: 'Econland Kurier',
    headline: 'GAS-ALARM: Preise explodieren über Nacht — Industrie drosselt Produktion',
    body: 'Versorgungsengpässe treffen das Land mit voller Wucht. Energieintensive Betriebe fahren herunter, Haushalte schrauben die Heizung runter. Die Regierung beruft einen Krisenstab ein.',
    tags: { topic: 'shock:energy_crisis', direction: 'neutral' },
  },
  {
    id: 'shock_financial_crisis', outlet: 'Die Bilanz',
    headline: 'BÖRSEN-BEBEN: Bankenaktien stürzen ab — Kredite werden knapp',
    body: 'Misstrauen zwischen den Banken lähmt den Geldfluss. Institute vergeben kaum noch Darlehen, Unternehmen stornieren Aufträge vorsorglich.',
    tags: { topic: 'shock:financial_crisis', direction: 'neutral' },
  },
  {
    id: 'shock_trade_war', outlet: 'Marktplatz',
    headline: 'ZOLLKRIEG: Partnerländer verhängen Gegenmaßnahmen — Exporteure in Alarmstimmung',
    body: 'Container stauen sich im Hafen, Aufträge werden storniert. Die exportstarke Industrie trifft der Handelskonflikt ins Mark.',
    tags: { topic: 'shock:trade_war', direction: 'neutral' },
  },
  {
    id: 'shock_export_boom', outlet: 'Marktplatz',
    headline: 'Volle Auftragsbücher aus dem Ausland: „Die Welt kauft uns die Ware aus den Regalen“',
    body: 'Aufträge aus Fernost und Übersee überschlagen sich. Reedereien erhöhen Frequenzen, Speditionen suchen Fahrer.',
    tags: { topic: 'shock:export_boom', direction: 'neutral' },
  },
  {
    id: 'shock_commodity_relief', outlet: 'Die Bilanz',
    headline: 'Ölpreis im Sinkflug: Entlastung an Tankstelle und Heizöltank',
    body: 'Fallende Rohstoffpreise machen sich bemerkbar. Spediteure atmen auf, die Inflationsdebatte verliert an Schärfe.',
    tags: { topic: 'shock:commodity_relief', direction: 'neutral' },
  },
  {
    id: 'shock_migration_wave', outlet: 'Der Staatsbürger',
    headline: 'Neue Nachbarn, neue Kollegen: Kommunen melden Zuzugsrekord',
    body: 'Sprachkurse überlaufen, Agenturen für Arbeit richten Willkommenszentren ein. Handwerkskammern sehen „die Chance des Jahrzehnts“.',
    tags: { topic: 'shock:migration_wave', direction: 'neutral' },
  },
  {
    id: 'shock_productivity_boom', outlet: 'Marktplatz',
    headline: 'Das KI-Wunder: Mittelständler verdoppeln Output mit denselben Teams',
    body: 'Neue Software, neue Maschinen, neue Prozesse — eine Innovationswelle rollt durchs Land. Selbst Traditionalisten steigen um.',
    tags: { topic: 'shock:productivity_boom', direction: 'neutral' },
  },

  // ── Neutral / background ──
  {
    id: 'neutral_1', outlet: 'Der Staatsbürger',
    headline: 'Sommerloch in der Hauptstadt: Regierung vertagt sich — die Republik dreht durch',
    body: 'Eisverkäufe steigen, Debatten ruhen. Kommentatoren nutzen die Ruhe für große Linien, Bürger für die Terrasse.',
    tags: { topic: 'neutral', direction: 'neutral' },
  },
  {
    id: 'neutral_2', outlet: 'Econland Kurier',
    headline: 'Wetter: Wechselhaft. Wirtschaft: Unübersichtlich. Rückblick: Ausgezeichnet.',
    body: 'Unser Wetterfrosch und unsere Wirtschaftsredaktion einigen sich auf eine gemeinsame Prognose: Es bleibt interessant.',
    tags: { topic: 'neutral', direction: 'neutral' },
  },

  // ── Event articles (carry effects into the NEXT round — news becomes reality) ──
  {
    id: 'event_tech_hype', outlet: 'Die Bilanz',
    headline: 'Fonds entdecken Econland-Tech: Milliarden fließen in heimische Startups',
    body: 'Internationale Investoren stürzen sich auf Technologie-Firmen des Landes. Gründerzentrums berichten von Rekordbewertungen und Einstellungsoffensiven.',
    tags: { topic: 'neutral', direction: 'neutral' },
    effects: { demand: 0.5 },
  },
  {
    id: 'event_food_prices', outlet: 'Econland Kurier',
    headline: 'Dürre im Kornkammer-Gürtel: Ernteausfälle treiben Lebensmittelpreise',
    body: 'Wochen ohne Regen haben die Böden ausgedörrt. Bauern melden Verluste, Mühlen erste Preisaufschläge — Verbraucher dürften es an der Kasse merken.',
    tags: { topic: 'neutral', direction: 'neutral' },
    effects: { supply_inflation: 0.5 },
  },
];