// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// SPEICHER · Workers KV — der Uebergangsspeicher
//
// ── Was diese Umsetzung NICHT kann ─────────────────────────────────────────
// KV kennt kein Sperren. `aendereKurs` und `aendereTeam` lesen, aendern und
// schreiben; zwei gleichzeitige Aufrufe koennen sich gegenseitig
// ueberschreiben. Das ist keine Nachlaessigkeit, sondern die Eigenschaft des
// Dienstes — und genau der Grund, warum ADR 006 fuer den Betrieb einen
// serialisierenden Speicher vorsieht.
//
// Abgefedert wird es hier so weit wie moeglich:
//   · Ein optimistischer Vergleich (`stand`) erkennt die HAEUFIGSTEN
//     Kollisionen und meldet 'konflikt' statt still zu ueberschreiben.
//   · Erkannt wird nicht alles: zwischen Lesen und Schreiben liegt ein
//     Zeitfenster, das sich mit KV nicht schliessen laesst.
//
// Dazu kommt die Verzoegerung: KV ist eventually consistent, ein geaenderter
// Wert kann bis zu 60 Sekunden alt gelesen werden. Eine Live-Abstimmung ist
// damit nicht moeglich — siehe entwurf/PLANUNG-AUSBAU.md, Abschnitt 10.
// ═══════════════════════════════════════════════════════════════════════════

import type { SessionData } from '../typen.js';
import { type Speicher, KURS_LEBENSDAUER_SEKUNDEN } from './schnittstelle.js';

/** Ein billiger Fingerabdruck des Standes — reicht, um Kollisionen zu sehen. */
function stand(kurs: SessionData): string {
  const teams = Object.values(kurs.teams)
    .map(t => t.last_updated ?? '')
    .join('|');
  return `${kurs.members.length}:${teams}`;
}

export function kvSpeicher(kv: KVNamespace): Speicher {
  const schluessel = (id: string) => `session:${id}`;

  const lies = async (id: string): Promise<SessionData | null> => {
    const roh = await kv.get(schluessel(id));
    return roh ? (JSON.parse(roh) as SessionData) : null;
  };

  const schreib = async (kurs: SessionData): Promise<void> => {
    await kv.put(schluessel(kurs.id), JSON.stringify(kurs), {
      expirationTtl: KURS_LEBENSDAUER_SEKUNDEN,
    });
  };

  return {
    liesKurs:    lies,
    schreibKurs: schreib,
    loescheKurs: async (id) => { await kv.delete(schluessel(id)); },

    async aendereKurs(id, aendere) {
      const vorher = await lies(id);
      if (!vorher) return { fehler: 'nicht-gefunden' };
      const vorherStand = stand(vorher);

      const ergebnis = aendere(vorher);
      if (!ergebnis) return { ergebnis: undefined as never };

      // Zweiter Blick kurz vor dem Schreiben. Schliesst das Fenster nicht,
      // verkleinert es aber spuerbar.
      const jetzt = await lies(id);
      if (jetzt && stand(jetzt) !== vorherStand) return { fehler: 'konflikt' };

      await schreib(ergebnis.kurs);
      return { ergebnis: ergebnis.ergebnis };
    },

    async aendereTeam(kursId, team, aendere) {
      const kurs = await lies(kursId);
      if (!kurs) return { fehler: 'nicht-gefunden' };
      if (!kurs.team_names.includes(team)) return { fehler: 'nicht-gefunden' };

      const vorher = kurs.teams[team] ?? { perioden: [], last_updated: new Date().toISOString() };
      const vorherStand = vorher.last_updated;

      const ergebnis = aendere(vorher, kurs);
      if (!ergebnis) return { ergebnis: undefined as never };

      const jetzt = await lies(kursId);
      if (jetzt?.teams[team] && jetzt.teams[team].last_updated !== vorherStand) {
        return { fehler: 'konflikt' };
      }

      const gemischt = jetzt ?? kurs;
      gemischt.teams[team] = { ...ergebnis.team, last_updated: new Date().toISOString() };
      await schreib(gemischt);
      return { ergebnis: ergebnis.ergebnis };
    },
  };
}
