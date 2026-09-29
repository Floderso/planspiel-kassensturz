// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// KASSENSTURZ · Serverzugriff
//
// DIE EINZIGE DATEI MIT fetch(). Wer sonst irgendwo im Projekt eine
// Netzwerkanfrage stellt, bricht die Architektur — tests/architektur.test.js
// schlägt dann fehl.
//
// Warum: Solange jede Oberflächendatei selbst mit dem Server spricht, lässt
// sich weder das Backend austauschen noch die Oberfläche umbauen, ohne beides
// gleichzeitig anzufassen. Siehe entwurf/ARCHITEKTUR.md.
//
// Die Funktionen hier sprechen Fachsprache ("hole die Mitglieder"), nicht
// HTTP. Kein Aufrufer kennt eine URL, ein Verb oder eine Statuszahl.
//
// Fehler kommen einheitlich als ServerFehler zurück:
//   status 0   → gar nicht angekommen (offline, Zeitüberschreitung)
//   status >0  → der Server hat geantwortet, aber abgelehnt
// ═══════════════════════════════════════════════════════════════════════════

import { api, hatBackend } from '../konfig.js';

export { hatBackend };

export class ServerFehler extends Error {
  constructor(nachricht, status = 0, ursache = null) {
    super(nachricht);
    this.name    = 'ServerFehler';
    this.status  = status;
    this.ursache = ursache;
  }
  /** true, wenn die Anfrage den Server nie erreicht hat. */
  get istNetzwerkfehler() { return this.status === 0; }
}

/**
 * Eine Anfrage. Gibt bei Erfolg die geparsten Daten zurück und wirft sonst
 * einen ServerFehler — nie beides, nie ein rohes Response-Objekt.
 *
 * @param {string} pfad        z. B. '/sessions/ABC/members'
 * @param {object} [optionen]
 * @param {string} [optionen.methode]   Standard 'GET'
 * @param {object} [optionen.daten]     wird als JSON-Rumpf gesendet
 * @param {string} [optionen.token]     Admin-Zugang, geht als Kopfzeile raus
 * @param {number} [optionen.zeitlimit] Millisekunden bis zum Abbruch
 */
async function anfrage(pfad, { methode = 'GET', daten = null, token = null, zeitlimit = null } = {}) {
  const kopf = {};
  if (daten) kopf['Content-Type'] = 'application/json';
  // Nie als Query-Parameter: der landet in Protokollen. Siehe BETRIEB.md 1.5.
  if (token) kopf.Authorization = `Bearer ${token}`;

  const abbruch = zeitlimit ? new AbortController() : null;
  const wecker  = abbruch ? setTimeout(() => abbruch.abort(), zeitlimit) : null;

  let antwort;
  try {
    antwort = await fetch(api(pfad), {
      method:  methode,
      headers: kopf,
      body:    daten ? JSON.stringify(daten) : undefined,
      signal:  abbruch?.signal,
    });
  } catch (fehler) {
    const zeitueberschritten = fehler?.name === 'AbortError';
    throw new ServerFehler(
      zeitueberschritten ? 'Zeitüberschreitung — Server antwortet nicht.'
                         : 'Netzwerkfehler — Verbindung prüfen.',
      0, fehler,
    );
  } finally {
    if (wecker) clearTimeout(wecker);
  }

  const rumpf = await antwort.json().catch(() => null);

  if (!antwort.ok) {
    throw new ServerFehler(
      rumpf?.error ?? `Der Server hat abgelehnt (HTTP ${antwort.status}).`,
      antwort.status,
    );
  }
  return rumpf;
}

// ── Spielseite ───────────────────────────────────────────────────────────────

/** Kompletter Stand einer Sitzung: alle Teams, ohne Admin-Angaben. */
export function holeSitzung(sitzungId, { zeitlimit = null } = {}) {
  return anfrage(`/sessions/${encodeURIComponent(sitzungId)}`, { zeitlimit });
}

/** Teamnamen, Belegung und Teamgröße — für die Team-Auswahl. */
export function holeMitglieder(sitzungId) {
  return anfrage(`/sessions/${encodeURIComponent(sitzungId)}/members`);
}

/** Eine studierende Person tritt einem Team bei. */
export function trittBei(sitzungId, { name, matrikelnummer, team }) {
  return anfrage(`/sessions/${encodeURIComponent(sitzungId)}/members`, {
    methode: 'POST',
    daten:   { name, matrikelnummer, team },
  });
}

/** Die Entscheidungen eines Teams sichern. */
export function sendeTeamZustand(sitzungId, teamId, perioden) {
  return anfrage(
    `/sessions/${encodeURIComponent(sitzungId)}/teams/${encodeURIComponent(teamId)}`,
    { methode: 'PUT', daten: { perioden } },
  );
}

/** Eine Periode abschließen (Stimme abgeben). */
export function stimmeAb(sitzungId, teamId, periodeIdx) {
  return anfrage(
    `/sessions/${encodeURIComponent(sitzungId)}/teams/${encodeURIComponent(teamId)}/vote`,
    { methode: 'POST', daten: { periode_idx: periodeIdx } },
  );
}

// ── Aufstellung: Team, Ressort, Anzeigename ──────────────────────────────────

const kursPfad = (sitzungId, rest) => `/sessions/${encodeURIComponent(sitzungId)}/${rest}`;

/** Wer sitzt wo, welche Ressorts sind frei. Ohne fremde Matrikelnummern. */
export function holeAufstellung(sitzungId, { zeitlimit = null } = {}) {
  return anfrage(kursPfad(sitzungId, 'aufstellung'), { zeitlimit });
}

/** Das Team wechseln — nur solange die Zuordnung offen ist. */
export function waehleTeam(sitzungId, matrikelnummer, team) {
  return anfrage(kursPfad(sitzungId, `members/${encodeURIComponent(matrikelnummer)}/team`), {
    methode: 'PUT', daten: { team },
  });
}

/** Ein Ressort belegen — oder mit `null` wieder freigeben. */
export function waehleRessort(sitzungId, matrikelnummer, rolle) {
  return anfrage(kursPfad(sitzungId, `members/${encodeURIComponent(matrikelnummer)}/rolle`), {
    methode: 'PUT', daten: { rolle },
  });
}

/** Den frei gewaehlten Teamnamen setzen. Der Systemname bleibt davon unberuehrt. */
export function setzeAnzeigename(sitzungId, team, name) {
  return anfrage(kursPfad(sitzungId, `teams/${encodeURIComponent(team)}/anzeigename`), {
    methode: 'PUT', daten: { name },
  });
}

/** Die Lehrperson schliesst oder oeffnet die Teamzuordnung. */
export function setzeZuordnung(sitzungId, offen, token) {
  return anfrage(kursPfad(sitzungId, 'zuordnung'), {
    methode: 'PUT', daten: { offen }, token,
  });
}

// ── Der Verhandlungstisch ────────────────────────────────────────────────────
//
// Namentliche Unterschriften statt eines Stimmzaehlers. `stimmeAb` bleibt
// daneben bestehen — die klassische Flaeche benutzt sie weiter.

const tischPfad = (sitzungId, teamId, rest) =>
  `/sessions/${encodeURIComponent(sitzungId)}/teams/${encodeURIComponent(teamId)}/${rest}`;

/** Ein Ressort zeichnet die Mappe. */
export function zeichne(sitzungId, teamId, periodeIdx, { ressort, person, matrikelnummer }) {
  return anfrage(tischPfad(sitzungId, teamId, 'zeichnung'), {
    methode: 'POST',
    daten:   { periode_idx: periodeIdx, ressort, person, matrikelnummer },
  });
}

/** Eine Unterschrift zurueckziehen. */
export function ziehZeichnungZurueck(sitzungId, teamId, periodeIdx, ressort) {
  return anfrage(tischPfad(sitzungId, teamId, `zeichnung/${encodeURIComponent(ressort)}`), {
    methode: 'DELETE',
    daten:   { periode_idx: periodeIdx },
  });
}

// ── Vorlagen und Abstimmung ──────────────────────────────────────────────────

/** Alle Vorlagen einer Periode mit ihrem Auszaehlstand. */
export function holeVorlagen(sitzungId, teamId, periodeIdx) {
  return anfrage(tischPfad(sitzungId, teamId, `vorlagen?periode_idx=${periodeIdx}`));
}

/** Eine Vorlage einbringen. Die einbringende Person stimmt automatisch zu. */
export function bringeVorlageEin(sitzungId, teamId, periodeIdx,
                                 { ressort, aenderungen, begruendung, person }) {
  return anfrage(tischPfad(sitzungId, teamId, 'vorlagen'), {
    methode: 'POST',
    daten: { periode_idx: periodeIdx, ressort, aenderungen, begruendung, person },
  });
}

/** Eine eingebrachte Vorlage zurueckziehen. */
export function ziehVorlageZurueck(sitzungId, teamId, periodeIdx, ressort) {
  return anfrage(tischPfad(sitzungId, teamId, `vorlagen/${encodeURIComponent(ressort)}`), {
    methode: 'DELETE', daten: { periode_idx: periodeIdx },
  });
}

/** Ueber eine Vorlage abstimmen. `rolle` ist das Ressort der stimmenden Person. */
export function stimmeUeberVorlage(sitzungId, teamId, periodeIdx, ressort,
                                   { rolle, stimme, person, grund }) {
  return anfrage(
    tischPfad(sitzungId, teamId, `vorlagen/${encodeURIComponent(ressort)}/stimme`),
    { methode: 'POST', daten: { periode_idx: periodeIdx, rolle, stimme, person, grund } });
}

/** Die selbst zusammengestellte Auswertung eines Ressorts sichern. */
export function setzeSchaukasten(sitzungId, teamId, ressort, stuecke) {
  return anfrage(tischPfad(sitzungId, teamId, `schaukasten/${encodeURIComponent(ressort)}`), {
    methode: 'PUT', daten: { stuecke },
  });
}

/** Warum ein Ressort will, was es will. Die anderen sollen es lesen koennen. */
export function setzeBegruendung(sitzungId, teamId, periodeIdx, { ressort, text }) {
  return anfrage(tischPfad(sitzungId, teamId, 'begruendung'), {
    methode: 'PUT', daten: { periode_idx: periodeIdx, ressort, text },
  });
}

/** Einspruch einlegen — sperrt den Rundenschluss. */
export function legeEinspruchEin(sitzungId, teamId, periodeIdx, { ressort, person, grund }) {
  return anfrage(tischPfad(sitzungId, teamId, 'einspruch'), {
    methode: 'POST',
    daten:   { periode_idx: periodeIdx, ressort, person, grund },
  });
}

/** Einspruch zuruecknehmen. */
export function nimmEinspruchZurueck(sitzungId, teamId, periodeIdx, ressort) {
  return anfrage(tischPfad(sitzungId, teamId, `einspruch/${encodeURIComponent(ressort)}`), {
    methode: 'DELETE',
    daten:   { periode_idx: periodeIdx },
  });
}

// ── Notfallwerkzeuge der Lehrperson ──────────────────────────────────────────

/** Laenge und Frist EINER Periode setzen. */
export function setzePeriode(sitzungId, idx, daten, token) {
  // Nur mitgeschickte Felder werden geaendert — `undefined` laesst der Server
  // in Ruhe. Darum wird `daten` unveraendert durchgereicht.
  return anfrage(kursPfad(sitzungId, `perioden/${idx}`), {
    methode: 'PUT', daten, token,
  });
}

/** Nachzuegler einzeln zulassen, ohne die ganze Liste neu zu laden. */
export function lasseZu(sitzungId, matrikelnummer, token) {
  return anfrage(kursPfad(sitzungId, `zulassung/${encodeURIComponent(matrikelnummer)}`),
                 { methode: 'PUT', token });
}

/** Aus dem Kurs entfernen. Abgeschlossene Perioden bleiben unberuehrt. */
export function entfernePerson(sitzungId, matrikelnummer, token) {
  return anfrage(kursPfad(sitzungId, `personen/${encodeURIComponent(matrikelnummer)}`),
                 { methode: 'DELETE', token });
}

/** In ein anderes Team setzen — auch bei geschlossener Zuordnung. */
export function setzePersonUm(sitzungId, matrikelnummer, team, token) {
  return anfrage(kursPfad(sitzungId, `personen/${encodeURIComponent(matrikelnummer)}/umsetzen`),
                 { methode: 'PUT', daten: { team }, token });
}

/** Ein Ressort freigeben, das jemand belegt hat und nicht mehr da ist. */
export function gibRessortFrei(sitzungId, team, rolle, token) {
  return anfrage(kursPfad(sitzungId,
    `teams/${encodeURIComponent(team)}/ressort/${encodeURIComponent(rolle)}`),
    { methode: 'DELETE', token });
}

/** Einen unpassenden Teamnamen zuruecksetzen. Der Systemname bleibt. */
export function setzeAnzeigenamenZurueck(sitzungId, team, token) {
  return anfrage(kursPfad(sitzungId, `teams/${encodeURIComponent(team)}/anzeigename`),
                 { methode: 'DELETE', token });
}

// ── Lehrperson ───────────────────────────────────────────────────────────────

/** Neue Sitzung anlegen. Antwort enthält session_id und admin_token. */
export function erstelleSitzung(daten) {
  return anfrage('/sessions', { methode: 'POST', daten });
}

/** Vollbild für die Lehrperson — mit allem, was der öffentliche Stand nicht zeigt. */
export function holeAdminSicht(sitzungId, token) {
  return anfrage(`/sessions/${encodeURIComponent(sitzungId)}/admin`, { token });
}

/** Eine Periode eines Teams sperren oder wieder freigeben. */
export function setzePeriodeGesperrt(sitzungId, teamName, periodeIdx, gesperrt, token) {
  return anfrage(
    `/sessions/${encodeURIComponent(sitzungId)}/teams/${encodeURIComponent(teamName)}/lock`,
    { methode: 'PUT', daten: { periode_idx: periodeIdx, locked: gesperrt }, token },
  );
}

/** Wie viele Perioden für alle Teams freigegeben sind. */
export function setzeFreigabe(sitzungId, anzahl, token) {
  return anfrage(`/sessions/${encodeURIComponent(sitzungId)}/freigabe`, {
    methode: 'PUT', daten: { perioden_freigegeben: anzahl }, token,
  });
}

/** Die geplanten Schocks der Sitzung. */
export function setzeSchocks(sitzungId, schocks, token) {
  return anfrage(`/sessions/${encodeURIComponent(sitzungId)}/schocks`, {
    methode: 'PUT', daten: { schocks }, token,
  });
}

/** Welche Ressorts in welcher Periode zur Verfügung stehen (Scaffolding). */
export function setzeWerkzeuge(sitzungId, periodenWerkzeuge, token) {
  return anfrage(`/sessions/${encodeURIComponent(sitzungId)}/werkzeuge`, {
    methode: 'PUT', daten: { perioden_werkzeuge: periodenWerkzeuge }, token,
  });
}

/** Teilnahmeliste hochladen. Personenbezogen — siehe entwurf/BETRIEB.md 5. */
export function sendeMatrikelnummern(sitzungId, matrikelnummern, token) {
  return anfrage(`/sessions/${encodeURIComponent(sitzungId)}/matrikelnummern`, {
    methode: 'PUT', daten: { matrikelnummern }, token,
  });
}
