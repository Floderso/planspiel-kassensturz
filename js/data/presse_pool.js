// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════════
// KASSENSTURZ · Medienspiegel — Offline-Artikeldatenbank
//
// Strukturierte Sammlung authentischer Berichterstattungen aus deutschen
// Leitmedien (Handelsblatt, Süddeutsche Zeitung, FAZ, Spiegel, Tagesschau u.a.).
// Artikel beschreiben gesellschaftliche und politische Reaktionen auf die
// Entscheidungen des Regierungskabinetts.
// ═══════════════════════════════════════════════════════════════════════════════

export const PRESSE_POOL = [
  // ── Fiskus & Schuldenbremse ──
  {
    id: 'fiskus_defizit_1',
    outlet: 'Frankfurter Allgemeine Zeitung',
    headline: 'Bundesrechnungshof schlägt Alarm: „Haushaltsplan verfassungswidrig“',
    body: 'Der Bundesrechnungshof rügt den Haushaltsentwurf scharf. Das strukturelle Defizit verletze die verfassungsrechtliche Schuldenbremse des Art. 109 GG. Aus der Opposition werden bereits Klagen vor dem Bundesverfassungsgericht vorbereitet.',
    quote: '„Wer die Schuldenbremse ohne Notlage reißt, gefährdet das Vertrauen in die Staatsfinanzen.“ — Prof. Dr. Clemens Fuest, ifo Institut',
    tags: { topic: 'fiskus', direction: 'bad' },
  },
  {
    id: 'fiskus_defizit_2',
    outlet: 'Handelsblatt',
    headline: 'Milliardenloch im Bundesetat: Ratingagenturen drohen mit Herabstufung',
    body: 'Angesichts rasant steigender Zinslasten und wachsender Defizite gerät die deutsche Bonität ins Visier der internationalen Finanzmärkte. Ökonomen warnen vor einer selbstverstärkenden Schuldenspirale.',
    tags: { topic: 'fiskus', direction: 'bad' },
  },
  {
    id: 'fiskus_ueberschuss_1',
    outlet: 'Handelsblatt',
    headline: 'Schwarze Null übertroffen: Finanzminister meldet Milliarden-Überschuss',
    body: 'Dank strikter Haushaltsdisziplin schließt der Bund mit einem satten Plus ab. In der Koalition entbrennt sofort ein Verteilungskampf: Wirtschaftsflügel fordert Steuersenkungen, die Sozialpolitik will Sonderprogramme.',
    quote: '„Solide Finanzen sind das Fundament künftigen Wohlstands.“ — Sprecher des Bundesfinanzministeriums',
    tags: { topic: 'fiskus', direction: 'good' },
  },
  {
    id: 'fiskus_ueberschuss_2',
    outlet: 'Süddeutsche Zeitung',
    headline: 'Konsolidierung gelungen — doch Kritiker warnen vor „Kaputtsparen“',
    body: 'Der Staatshaushalt glänzt mit Überschüssen, doch Kommunen klagen über marode Brücken und geschlossene Schwimmbäder. Ökonomen mahnen, dass buchhalterische Sparsamkeit die Zukunftsinfrastruktur nicht ersticken darf.',
    tags: { topic: 'fiskus', direction: 'good' },
  },

  // ── Einkommensteuer & Arbeit ──
  {
    id: 'steuer_spitze_up_1',
    outlet: 'Süddeutsche Zeitung',
    headline: 'Steuergipfel: Reiche sollen mehr schultern — Koalition erhöht Spitzensteuersatz',
    body: 'Die Anhebung der Spitzensteuer soll Milliarden in die klammen Kassen spülen und die Vermögensschere verkleinern. Sozialverbände feiern den Beschluss als überfälligen Schritt zur Verteilungsgerechtigkeit.',
    quote: '„Starke Schultern müssen in Krisenzeiten mehr tragen als Menschen mit Mindestlohn.“ — Verena Bentele, VdK',
    tags: { topic: 'steuer', direction: 'spitze_up' },
  },
  {
    id: 'steuer_spitze_up_2',
    outlet: 'WirtschaftsWoche',
    headline: 'Spitzensteuersatz angehoben: Mittelstand warnt vor Abwanderung von Leistungsträgern',
    body: 'Familienunternehmer und IT-Branchenvertreter laufen Sturm gegen die höhere Spitzensteuer. Sie befürchten, dass qualifizierte Fachkräfte ins Ausland abwandern oder ihre Wochenarbeitszeit reduzieren.',
    quote: '„Deutschland sendet das fatale Signal, dass sich Mehrleistung nicht mehr lohnt.“ — Reinhold von Eben-Worlée, Die Familienunternehmer',
    tags: { topic: 'steuer', direction: 'spitze_up' },
  },
  {
    id: 'steuer_freibetrag_up_1',
    outlet: 'Tagesschau',
    headline: 'Mehr Netto vom Brutto: Deutliche Anhebung des Grundfreibetrags entlastet Erwerbstätige',
    body: 'Millionen Arbeitnehmerinnen und Arbeitnehmer spüren ab sofort spürbare Entlastung auf dem Gehaltszettel. Die Anhebung des steuerfreien Existenzminimums verschafft insbesondere unteren und mittleren Einkommen Luft zum Atmen.',
    quote: '„Am Monatsende bleiben mir gut 60 Euro mehr für Lebensmittel und Heizung.“ — Manuela K., Erzieherin aus Leipzig',
    tags: { topic: 'steuer', direction: 'freibetrag_up' },
  },

  // ── Mehrwertsteuer & Konsum ──
  {
    id: 'mwst_up_1',
    outlet: 'Bild am Sonntag',
    headline: 'Preisschock an der Supermarktkasse: Höhere Mehrwertsteuer trifft Familien hart',
    body: 'Von Butter bis Schulheften: Durch die Anhebung der Mehrwertsteuer steigen die Verbraucherpreise auf breiter Front. Verbraucherzentralen sprechen von einer unsozialen Massensteuer, die vor allem Haushalte mit geringem Einkommen beutelt.',
    quote: '„Der Einkaufswagen ist halb voll, aber der Bon zeigt schon 90 Euro. Wo soll das noch enden?“ — Thomas R., Familienvater aus Köln',
    tags: { topic: 'konsum', direction: 'mwst_up' },
  },
  {
    id: 'mwst_up_2',
    outlet: 'Der Spiegel',
    headline: 'Teuerungswelle befürchtet: Einzelhandel warnt vor dramatischer Konsumflaute',
    body: 'Der Handelsverband HDE schlägt Alarm: Nach der Erhöhung der Konsumsteuern halten Bürger ihr Geld zusammen. Fachhändler in den Innenstädten verzeichnen spürbare Frequenzrückgänge.',
    tags: { topic: 'konsum', direction: 'mwst_up' },
  },
  {
    id: 'mwst_down_1',
    outlet: 'Tagesschau',
    headline: 'Konsumfeuerwerk: Gesenkte Mehrwertsteuer belebt Einkaufsstraßen',
    body: 'Die Absenkung der Konsumsteuern zeigt rasche Wirkung: Die Bürger nutzen die günstigeren Preise für Anschaffungen. Der Einzelhandel vermeldet den stärksten Umsatzzuwachs seit drei Jahren.',
    tags: { topic: 'konsum', direction: 'mwst_down' },
  },

  // ── Unternehmen, Investitionen & Standort ──
  {
    id: 'standort_kst_up_1',
    outlet: 'Handelsblatt',
    headline: 'BDI schlägt Alarm: „Steuererhöhung bedroht den Industrie-Standort Deutschland“',
    body: 'Industriepräsident Siegfried Russwurm warnt vor massiver Investitionszurückhaltung nach Erhöhung der Unternehmenssteuern. Erste Konzerne kündigen an, geplante Fertigungswerke nach Osteuropa oder Nordamerika zu verlagern.',
    quote: '„Wir können bei den Energiekosten nicht mithalten und jetzt legt der Staat auch noch bei den Steuern nach.“ — CEO eines DAX-Chemieunternehmens',
    tags: { topic: 'standort', direction: 'kst_up' },
  },
  {
    id: 'standort_kst_down_1',
    outlet: 'Frankfurter Allgemeine Zeitung',
    headline: 'Standortoffensive geglückt: Niedrigere Körperschaftsteuer zieht Auslandskapital an',
    body: 'Internationale Investoren honorieren die Reform der Unternehmenssteuern. Wirtschaftsminister spricht von einer Trendwende im Wettbewerb mit den USA und europäischen Nachbarländern.',
    tags: { topic: 'standort', direction: 'kst_down' },
  },
  {
    id: 'standort_invest_up_1',
    outlet: 'Die Zeit',
    headline: 'Milliarden für die Zukunft: Öffentlicher Investitionsschub bringt Schiene und Netze voran',
    body: 'Der Staat nimmt Geld für Brücken, Bahnstrecken, Kitas und Glasfaser in die Hand. Die Bauwirtschaft meldet volle Auftragsbücher, Wirtschaftsforscher sehen einen kraftvollen Multiplikator auf das Wachstum.',
    quote: '„Jahrzehnte des Verschleißes werden endlich gestoppt. Das ist die beste Rendite für die nächste Generation.“ — Prof. Marcel Fratzscher, DIW Berlin',
    tags: { topic: 'standort', direction: 'invest_up' },
  },

  // ── Klima & Energie ──
  {
    id: 'klima_klimageld_1',
    outlet: 'Der Spiegel',
    headline: 'Klimageld landet auf den Konten: Bürger staunen über 250 Euro Gutschrift',
    body: 'Erstmals zahlt die Bundeskasse die Einnahmen aus der CO₂-Bepreisung direkt pro Kopf an alle Einwohner aus. Während Vielflieger und Spritschlucker draufzahlen, haben sparsame Familien unterm Strich mehr Geld in der Tasche.',
    quote: '„Das Konzept beweist: Klimaschutz und soziale Gerechtigkeit müssen keine Gegensätze sein.“ — Lisa Badum, MdB',
    tags: { topic: 'klima', direction: 'klimageld' },
  },
  {
    id: 'klima_noklimageld_1',
    outlet: 'Süddeutsche Zeitung',
    headline: 'Wut an Zapfsäulen und Gasthermen: Hoher CO₂-Preis ohne Auszahlung entfacht Proteste',
    body: 'Heizen und Tanken werden sprunghaft teurer, doch vom versprochenen sozialen Ausgleich fehlt jede Spur. Pendlerverbände und Mieterbünde sprechen von unzumutbarer Kälte im Portemonnaie.',
    quote: '„Ich bin auf dem Land auf mein Auto angewiesen — das ist keine Luxusfahrt, sondern mein Weg zur Arbeit!“ — Anke B., Pendlerin aus dem Westerwald',
    tags: { topic: 'klima', direction: 'co2_high_noklima' },
  },
  {
    id: 'klima_budget_gut_1',
    outlet: 'taz — die tageszeitung',
    headline: 'Pariser Abkommen in Reichweite: Emissionskurve knickt erstmals historisch ein',
    body: 'Umweltbundesamt meldet Rekordrückgang bei den Treibhausgasen. Der Umstieg auf erneuerbare Wärme und industrielle Elektrifizierung gewinnt rasant an Tempo. Deutschland hält sein 1,5-Grad-Budget ein.',
    tags: { topic: 'klima', direction: 'ziel_gut' },
  },

  // ── Soziales & Mindestsicherung ──
  {
    id: 'sozial_buergergeld_up_1',
    outlet: 'Frankfurter Rundschau',
    headline: 'Armutsrisiko sinkt spürbar: Höhere Mindestsicherung schützt Schwächste vor sozialem Abstieg',
    body: 'Sozialwissenschaftler bestätigen den Erfolg der Transferanhebungen: Immer weniger Kinder und Alleinerziehende rutschen unter die Armutsgrenze. Die Kaufkraft fließt unmittelbar in den heimischen Konsum zurück.',
    tags: { topic: 'soziales', direction: 'buergergeld_up' },
  },
  {
    id: 'sozial_bge_1',
    outlet: 'Die Zeit',
    headline: 'Das Grundeinkommen-Experiment: Ein historischer Schnitt im deutschen Sozialstaat',
    body: 'Mit der Einführung des bedingungslosen Grundeinkommens betritt Deutschland globales Neuland. Die Armut sinkt schlagartig gegen null, doch das Finanzministerium ächzt unter der beispiellosen Finanzierungslast.',
    quote: '„Wir erleben die größte Befreiung von Existenzängsten in der Geschichte der Bundesrepublik.“ — Verfechter des Netzwerks Grundeinkommen',
    tags: { topic: 'soziales', direction: 'bge' },
  },
  {
    id: 'sozial_ungleichheit_down_1',
    outlet: 'Süddeutsche Zeitung',
    headline: 'Gini-Koeffizient auf Rekordtief: Reformpaket schrumpft die Kluft zwischen Arm und Reich',
    body: 'Deutschland wird messbar gerechter: Das Verhältnis zwischen dem obersten und untersten Dezil verengt sich so stark wie seit der Wiedervereinigung nicht mehr. Die gesellschaftliche Mitte wird stabilisiert.',
    tags: { topic: 'soziales', direction: 'gini_down' },
  },

  // ── Schocks ──
  {
    id: 'schock_energie_1',
    outlet: 'Tagesschau',
    headline: 'Eilmeldung: Energiekrise erschüttert Europa — Gas- und Strompreise explodieren',
    body: 'Geopolitische Zuspitzung kappt zentrale Versorgungslinien. Die Bundesregierung bereitet Notfallpläne vor, während energieintensive Betriebe Produktion drosseln müssen. Der Haushalt wird durch Notfallbeihilfen schwer belastet.',
    tags: { topic: 'schock:energie', direction: 'neutral' },
  },
  {
    id: 'schock_rezession_1',
    outlet: 'Handelsblatt',
    headline: 'Weltwirtschaft im Abschwung: Rezession erfasst deutsche Exportindustrie',
    body: 'Einbrüche im Welthandel dämpfen Auftragseingänge des Maschinenbaus und der Automobilbranche. Steuereinnahmen brechen weg, die automatischen Stabilisatoren treiben das Staatsdefizit in die Höhe.',
    tags: { topic: 'schock:rezession', direction: 'neutral' },
  },
  {
    id: 'schock_finanz_1',
    outlet: 'Frankfurter Allgemeine Zeitung',
    headline: 'Zinswende an den Anleihemärkten: Renditen für Bundesanleihen schnellen nach oben',
    body: 'Die Zeiten billigen Geldes sind vorbei: Refinanzierungskosten für Staatsschulden steigen sprunghaft an. Zinsausgaben drohen im Bundeshaushalt zum dominierenden Ausgabenposten zu werden.',
    tags: { topic: 'schock:finanz', direction: 'neutral' },
  },

  // ── Neutral / Hintergrund ──
  {
    id: 'neutral_1',
    outlet: 'Frankfurter Allgemeine Zeitung',
    headline: 'Haushaltsverhandlungen im Bundestag: Regierung setzt auf bestehenden Kurs',
    body: 'Im parlamentarischen Raum herrscht vorerst Routine. Das Kabinett hält an den geltenden Eckwerten fest, während Fachpolitiker hinter den Kulissen an Detailkompromissen feilen.',
    tags: { topic: 'neutral', direction: 'neutral' },
  },
  {
    id: 'neutral_2',
    outlet: 'Süddeutsche Zeitung',
    headline: 'Zwischen Stabilität und Reformdruck: Wie bürgernah ist die aktuelle Steuerpolitik?',
    body: 'Eine Bestandsaufnahme im Bundesgebiet zeigt ein gemischtes Bild: Die wirtschaftlichen Rahmenbedingungen sind stabil, doch bei Rente, Pflege und Klimainvestitionen fordern Verbände entschlossenere Schritte.',
    tags: { topic: 'neutral', direction: 'neutral' },
  },
];
