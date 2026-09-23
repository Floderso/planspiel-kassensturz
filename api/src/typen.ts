// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// TYPEN — die Form der Sitzungsdaten
//
// Ausgelagert aus index.ts, damit der Speicher (src/speicher/) sie kennt,
// ohne die Endpunkte zu kennen. Wer eine neue Speicherumsetzung schreibt,
// braucht genau diese Datei und sonst nichts aus dem Worker.
// ═══════════════════════════════════════════════════════════════════════════

/** Politikparameter einer Periode — spiegelt SLIDER_SECTIONS in planspiel.js */
export type PeriodParams = {
  freibetrag: number;
  eingang: number;
  spitze: number;
  mwst: number;
  mwst_erm: number;
  co2: number;
  kst: number;
  gewst: number;
  rv: number;
  kv: number;
  bbg: number;
  invest_impuls: number;
};

/** Eine Unterschrift unter der Mappe eines Ressorts. */
export type Zeichnung = {
  person:         string;
  matrikelnummer: string;
  at:             string;
};

/** Ein Einspruch sperrt den Rundenschluss, bis er zurueckgenommen wird. */
export type Einspruch = {
  person: string;
  grund?: string;
  at:     string;
};

export type Stimme = 'ja' | 'nein' | 'enthaltung';

/** Eine abgegebene Stimme. Je Ressort genau eine — auch wenn sich zwei
 *  Personen ein Ressort teilen (PLANUNG-AUSBAU.md, offener Punkt 7). */
export type Stimmabgabe = {
  stimme: Stimme;
  person: string;
  /** Wer ablehnt, darf sagen warum. Das ist der Ort des Streits. */
  grund?: string;
  at: string;
};

/**
 * Eine Vorlage: der Vorschlag EINES Ressorts fuer EINE Periode.
 *
 *   Entwurf ──einbringen──→ Eingebracht ──→ Angenommen
 *                                │              (Quorum erreicht)
 *                                ├──→ Abgelehnt (zurueck in die Werkbank,
 *                                │               Fassung +1)
 *                                └──→ Zurueckgezogen
 *
 * `aenderungen` darf LEER sein. Dann heisst die Vorlage "keine Aenderung" —
 * auch Nichtstun ist eine Entscheidung und wird begruendet und abgestimmt.
 */
export type Vorlage = {
  ressort: string;
  fassung: number;
  stand: 'eingebracht' | 'angenommen' | 'abgelehnt' | 'zurueckgezogen';
  aenderungen: Record<string, { von: number | boolean; nach: number | boolean }>;
  begruendung: string;
  eingebracht_von: string;
  eingebracht_am: string;
  /** Schluessel ist die Ressort-Kennung der stimmenden Person. */
  stimmen: Record<string, Stimmabgabe>;
};

export type TeamPeriod = {
  idx: number;
  locked: boolean;
  params: PeriodParams;
  votes: number;
  /**
   * Unterschriften und Einsprueche je Ressort-Kennung.
   *
   * Sie liegen NEBEN votes, nicht statt dessen: die klassische Flaeche
   * (index-klassisch.html) zaehlt weiter Stimmen, der Verhandlungstisch
   * zeichnet namentlich. Beide Wege muessen nebeneinander laufen koennen,
   * solange beide Flaechen existieren.
   */
  zeichnungen?: Record<string, Zeichnung>;
  einsprueche?: Record<string, Einspruch>;
  /**
   * Warum ein Ressort will, was es will — je Ressort ein Text.
   *
   * Sie steht hier und nicht nur im Browser, weil die Ressortansicht der
   * ANDEREN sie zeigen muss. Ohne sie sieht man am Tisch nur Zahlen, und
   * die Begruendung ist der eigentliche Lerninhalt (PLANUNG-AUSBAU.md B1).
   */
  begruendungen?: Record<string, string>;
  /** Die Vorlagen dieser Periode, je Ressort hoechstens eine offene. */
  vorlagen?: Record<string, Vorlage>;
};

/**
 * Ein Stueck im Schaukasten — ein Diagramm mit Bildunterschrift.
 *
 * Bewusst KEINE Zurechnung: es gibt keine Art, die behauptet, ein Ressort
 * habe so und so viel bewirkt. Was es gibt, ist "beschluesse" — was dieses
 * Ressort entschieden hat. Der Unterschied ist die Entscheidung vom
 * 21.09.2026 (PLANUNG-AUSBAU.md, C2).
 */
export type Schaustueck = {
  art: 'zeitreihe' | 'vergleich' | 'dezile' | 'haushalt' | 'beschluesse'
     | 'nichtstun' | 'zahl';
  kennzahl?: string;
  periode?: number;
  text: string;
};

export type TeamState = {
  perioden: TeamPeriod[];
  last_updated: string;
  /**
   * Der frei gewaehlte Name. Der Systemname (`Team 20`) bleibt der
   * Schluessel und steht in `team_names` — siehe PLANUNG-AUSBAU.md,
   * Abschnitt 8. Zwei Namen, damit ein Team heissen darf, wie es will,
   * ohne dass jemand die Zuordnung verliert.
   */
  anzeigename?: string;
  /** Wie oft ein Name abgelehnt wurde. Die Versuche selbst werden NICHT gespeichert. */
  namensversuche?: number;
  /**
   * Je Ressort die selbst zusammengestellte Auswertung.
   *
   * Sie liegt beim TEAM und nicht bei der Person: das Ressort wandert
   * zwischen den Runden (A3.1), der Schaukasten gehoert aber zur Sache, nicht
   * zum Menschen. Wer ein Ressort uebernimmt, erbt dessen Schaukasten und
   * kann ihn fortschreiben.
   */
  schaukaesten?: Record<string, Schaustueck[]>;
};

export type Member = {
  name: string;
  matrikelnummer: string;
  team: string;
  joined_at: string;
  /**
   * Ressort-Kennung, sobald die Person einen Platz am Tisch uebernommen hat.
   * Pflicht ab der Aufstellung — ohne Rolle darf niemand fuer ein Ressort
   * sprechen (entwurf/PLANUNG-AUSBAU.md, Abschnitt 1).
   */
  rolle?: string;
  /** 'ausgeschieden' bleibt stehen, statt die Person zu loeschen — das
   *  Protokoll abgeschlossener Perioden muss wahr bleiben. */
  zustand?: 'aktiv' | 'ausgeschieden';
};

export type Lernziel = {
  kpi:      string;
  operator: '<' | '>' | '<=' | '>=';
  wert:     number;
  label:    string;
};

export type SchockEvent = {
  periode:     number;
  id:          string;
  typ:         string;
  staerke:     number;
  name:        string;
  beschreibung:string;
  quelle?:     string;
  effekte:     Record<string, number>;
};

export type SessionData = {
  id: string;
  name: string;
  perioden_anzahl: number;
  team_groesse: number;
  min_teilnahme_quote: number;
  sandbox: boolean;
  created_at: string;
  expires_at: string;
  admin_token: string;
  team_names: string[];
  /**
   * Die Ressorts am Verhandlungstisch. Sie stehen HIER und nicht im Code des
   * Servers, damit die Sperrregel ("alle haben gezeichnet") nicht davon
   * abhaengt, wie viele Ressorts die Oberflaeche gerade kennt.
   */
  ressorts: string[];
  /** Darf noch ein Team gewechselt werden? Die Lehrperson schliesst die Zuordnung. */
  zuordnung_offen?: boolean;
  /**
   * Wann eine Vorlage angenommen ist — ausgewertet erst, wenn ALLE Ressorts
   * gestimmt haben. Frueher auszuwerten waere schneller, aber im Seminar
   * verwirrend: eine Vorlage waere entschieden, bevor alle geredet haben.
   */
  quorum?: 'einfach' | 'absolut' | 'einstimmig';
  /** Eingriffe der Lehrperson — wer zurücksetzt, hinterlässt eine Spur. */
  eingriffe?: { was: string; at: string }[];
  matrikelnummern: string[];   // erlaubte Matrikelnummern (leer = keine Verifikation)
  members: Member[];
  teams: Record<string, TeamState>;
  schocks: SchockEvent[];      // externe Schockereignisse je Periode (Admin-gesetzt)
  lernziele: Lernziel[];      // Lernziele der Session (Admin-gesetzt)
  perioden_freigegeben: number;              // Anzahl freigegebener Perioden (Lehrperson-Steuerung)
  perioden_laenge_jahre: number | number[];  // Länge je Periode in Jahren (Zahl oder Array)
  /**
   * Fristen je Periode, als ISO-Zeitpunkt. Schluessel ist der Periodenindex.
   *
   * Eine Frist SPERRT nichts — sie sagt nur, bis wann gerechnet wird. Das
   * Schliessen bleibt eine Handlung der Lehrperson: eine Runde, die um
   * Mitternacht von selbst zuklappt, waehrend ein Team noch diskutiert,
   * nimmt dem Planspiel seinen Sinn.
   */
  fristen?: Record<number, string>;
  perioden_werkzeuge?: Record<string, string[]>; // Freigegebene Ressorts je Periode (Admin-Scaffolding)
};

/**
 * Was ein Aenderungsvorgang zurueckmeldet.
 *
 * Eine Form fuer alle: entweder es hat geklappt, oder es gibt einen Grund
 * und den Statuscode dazu. Ohne diesen gemeinsamen Typ leitet TypeScript
 * aus dem ersten Rueckgabezweig ab und lehnt alle anderen ab.
 */
export type Aenderung<T> =
  | ({ ok: true } & T)
  | { ok: false; fehler: string; status: 400 | 404 | 409 | 422 };
