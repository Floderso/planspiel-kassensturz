// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// SPEICHER — was ein Speicher koennen muss
//
// Dieselbe Idee wie `js/dienste/server.js` im Frontend: EINE Stelle fasst die
// Aussenwelt an, und sie ist austauschbar. Die Endpunkte in index.ts kennen
// ab hier weder KV noch SQL — nur diese Schnittstelle.
//
// Warum das hier steht und nicht spaeter kommt: siehe ADR 006. Der Ausbau
// zum Verhandlungstisch braucht Schreibzugriffe, die sich nicht gegenseitig
// ueberschreiben. Das kann KV nicht, ein Uni-Server kann es von sich aus.
// Wer erst die Abstimmung baut und dann den Speicher, baut beides zweimal.
// ═══════════════════════════════════════════════════════════════════════════

import type { SessionData, TeamState } from '../typen.js';

export interface Speicher {
  /** Eine Sitzung lesen — oder null, wenn es sie nicht gibt. */
  liesKurs(id: string): Promise<SessionData | null>;

  /** Eine Sitzung vollstaendig schreiben. */
  schreibKurs(kurs: SessionData): Promise<void>;

  /**
   * Eine Sitzung lesen, aendern, schreiben — **ohne dass ein gleichzeitiger
   * Aufruf die Aenderung verliert**.
   *
   * Das ist die Kernoperation des ganzen Ausbaus. `aendere` bekommt die
   * Sitzung und gibt zurueck, was daraus werden soll; ob dabei serialisiert
   * wird, entscheidet die Umsetzung:
   *
   * - `kv.ts`   kann es NICHT (siehe dort) und sagt es ehrlich
   * - `sqlite.ts` kann es ueber eine Transaktion
   *
   * Gibt `aendere` null zurueck, wird nichts geschrieben.
   */
  aendereKurs<T>(
    id: string,
    aendere: (kurs: SessionData) => { kurs: SessionData; ergebnis: T } | null,
  ): Promise<{ ergebnis: T } | { fehler: 'nicht-gefunden' } | { fehler: 'konflikt' }>;

  /**
   * Dasselbe fuer ein einzelnes Team.
   *
   * Der eigene Weg ist kein Luxus: an einem Team arbeiten vier Personen
   * gleichzeitig, an einer Sitzung im Zweifel vierhundert. Ein Speicher, der
   * je Team sperrt, laesst die Teams unabhaengig voneinander laufen.
   */
  aendereTeam<T>(
    kursId: string,
    team: string,
    aendere: (team: TeamState, kurs: SessionData) => { team: TeamState; ergebnis: T } | null,
  ): Promise<{ ergebnis: T } | { fehler: 'nicht-gefunden' } | { fehler: 'konflikt' }>;

  /** Eine Sitzung loeschen. */
  loescheKurs(id: string): Promise<void>;
}

/** Wie lange eine Sitzung lebt: ein Semester. */
export const KURS_LEBENSDAUER_SEKUNDEN = 180 * 24 * 3600;
