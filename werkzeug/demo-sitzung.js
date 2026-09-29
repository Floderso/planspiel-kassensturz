// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DEMO-SITZUNG — eine gefuellte Sitzung zum Vorfuehren
//
// Legt einen Kurs an, besetzt zwei Teams, spielt eine Runde durch und gibt
// die Adressen aus. Damit laesst sich jede Flaeche vorfuehren, ohne vorher
// von Hand vier Personen anzumelden.
//
//     node werkzeug/demo-sitzung.js [adresse-der-api]
//
// Vorgabe ist http://localhost:8787/api — also der lokal laufende Worker
// (`cd api && npm run dev`).
//
// Nur fuer die Entwicklung. Die Namen sind erfunden, die Matrikelnummern
// auch; es werden keine echten Daten angefasst.
// ═══════════════════════════════════════════════════════════════════════════

const API = (process.argv[2] ?? 'http://localhost:8787/api').replace(/\/+$/, '');

/** Ein Aufruf. Bricht laut ab, statt still danebenzulaufen. */
async function ruf(pfad, { methode = 'GET', daten = null, token = null } = {}) {
  const antwort = await fetch(`${API}${pfad}`, {
    method: methode,
    headers: {
      ...(daten ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: daten ? JSON.stringify(daten) : undefined,
  });
  const rumpf = await antwort.json().catch(() => null);
  if (!antwort.ok) {
    throw new Error(`${methode} ${pfad} → ${antwort.status}: ${rumpf?.error ?? '?'}`);
  }
  return rumpf;
}

const TEAMS = Array.from({ length: 8 }, (_, i) => `Team ${String(i + 1).padStart(2, '0')}`);

/** Zwei besetzte Teams. Das zweite bleibt unvollstaendig — so sieht man beides. */
const LEUTE = [
  { name: 'Amira Köhler',  matrikelnummer: '770101', team: 'Team 01', rolle: 'fin' },
  { name: 'Jonas Reiter',  matrikelnummer: '770102', team: 'Team 01', rolle: 'wir' },
  { name: 'Lea Brandt',    matrikelnummer: '770103', team: 'Team 01', rolle: 'soz' },
  { name: 'Tarek Yilmaz',  matrikelnummer: '770104', team: 'Team 01', rolle: 'umw' },
  { name: 'Nils Hoffmann', matrikelnummer: '770201', team: 'Team 02', rolle: 'fin' },
  { name: 'Sara Petrova',  matrikelnummer: '770202', team: 'Team 02', rolle: 'umw' },
];

const VORLAGEN = [
  { ressort: 'fin', person: 'Amira Köhler',
    aenderungen: { spitze: { von: 45, nach: 62 } },
    begruendung: 'Starke Schultern tragen mehr. Wir nehmen dafür eine höhere '
               + 'Zusatzlast in Kauf — die Lücke schließt sich nicht von allein.' },
  { ressort: 'umw', person: 'Tarek Yilmaz',
    aenderungen: { co2: { von: 55, nach: 140 } },
    begruendung: 'CO₂ braucht einen Preis, der weh tut. Das Klimageld fängt auf, '
               + 'was unten ankommt.' },
  { ressort: 'soz', person: 'Lea Brandt',
    aenderungen: { bg: { von: 563, nach: 640 } },
    begruendung: 'Wer unten steht, darf die Zeche nicht zahlen. 640 € sind das '
               + 'Mindeste, wenn Heizen teurer wird.' },
  { ressort: 'wir', person: 'Jonas Reiter', aenderungen: {},
    begruendung: 'Wir lassen die Unternehmensbesteuerung in dieser Runde in Ruhe. '
               + 'Drei Änderungen auf einmal sind genug; wir sehen erst, was sie tun.' },
];

const SCHAUKAESTEN = {
  fin: [
    { art: 'zahl', kennzahl: 'saldo', periode: 0, text: 'So weit sind wir gekommen.' },
    { art: 'beschluesse', text: 'Das habe ich entschieden — nicht, was es bewirkt hat.' },
    { art: 'nichtstun', text: 'Und das wäre passiert, hätten wir nichts getan.' },
  ],
  umw: [
    { art: 'zeitreihe', kennzahl: 'emissionen', text: 'Der CO₂-Preis wirkt sofort.' },
    { art: 'dezile', periode: 0, text: 'Wen die Bepreisung wo trifft.' },
  ],
};

async function main() {
  process.stdout.write(`Lege eine Demo-Sitzung an auf ${API} …\n`);

  const sitzung = await ruf('/sessions', { methode: 'POST', daten: {
    name: 'Demo — Wirtschaftspolitik im Wintersemester',
    team_names: TEAMS, team_groesse: 4, perioden_anzahl: 5,
  }});
  const id = sitzung.session_id, token = sitzung.admin_token;
  const T = (t) => `/sessions/${id}/teams/${encodeURIComponent(t)}`;

  for (const p of LEUTE) {
    await ruf(`/sessions/${id}/members`, { methode: 'POST', daten: {
      name: p.name, matrikelnummer: p.matrikelnummer, team: p.team } });
    await ruf(`/sessions/${id}/members/${p.matrikelnummer}/rolle`, {
      methode: 'PUT', daten: { rolle: p.rolle } });
  }
  process.stdout.write(`  ${LEUTE.length} Personen in 2 von ${TEAMS.length} Teams\n`);

  // Team 01 spielt eine Runde: Werte setzen, Vorlagen einbringen, abstimmen.
  await ruf(T('Team 01'), { methode: 'PUT', daten: { perioden: [
    { idx: 0, locked: false, votes: 0,
      params: { spitze: 62, co2: 140, bg: 640 } }] } });

  for (const v of VORLAGEN) {
    await ruf(`${T('Team 01')}/vorlagen`, { methode: 'POST', daten: {
      periode_idx: 0, ressort: v.ressort, aenderungen: v.aenderungen,
      begruendung: v.begruendung, person: v.person } });
    for (const r of ['fin', 'wir', 'soz', 'umw']) {
      if (r === v.ressort) continue;
      // Eine Ablehnung, damit auch der Fall sichtbar ist.
      const stimme = (v.ressort === 'soz' && r === 'wir') ? 'nein' : 'ja';
      await ruf(`${T('Team 01')}/vorlagen/${v.ressort}/stimme`, { methode: 'POST', daten: {
        periode_idx: 0, rolle: r, stimme, person: r,
        grund: stimme === 'nein' ? 'Das können wir uns nicht auch noch leisten.' : undefined } });
    }
  }
  process.stdout.write('  4 Vorlagen eingebracht, eine davon abgelehnt\n');

  // Periode schliessen und die zweite oeffnen
  await ruf(`${T('Team 01')}/lock`, { methode: 'PUT', token,
    daten: { periode_idx: 0, locked: true } });
  await ruf(T('Team 01'), { methode: 'PUT', daten: { perioden: [
    { idx: 0, locked: true, votes: 0, params: { spitze: 62, co2: 140, bg: 640 } },
    { idx: 1, locked: false, votes: 0, params: { spitze: 62, co2: 140, bg: 640 } }] } });
  await ruf(`/sessions/${id}/freigabe`, { methode: 'PUT', token,
    daten: { perioden_freigegeben: 2 } });

  // Zuordnung schliessen, damit Teamnamen moeglich werden
  await ruf(`/sessions/${id}/zuordnung`, { methode: 'PUT', token, daten: { offen: false } });
  await ruf(`${T('Team 01')}/anzeigename`, { methode: 'PUT',
    daten: { name: 'Die Haushaltsretter' } });

  for (const [ressort, stuecke] of Object.entries(SCHAUKAESTEN)) {
    await ruf(`${T('Team 01')}/schaukasten/${ressort}`, { methode: 'PUT', daten: { stuecke } });
  }
  process.stdout.write('  Runde 1 geschlossen, Schaukästen gefüllt\n\n');

  const w = 'http://localhost:8000';
  process.stdout.write(`Kurs-Code: ${id}\n\n`);
  process.stdout.write('Als Studierende (Amira, Finanzen — schon angemeldet):\n');
  process.stdout.write(`  ${w}/index.html?session=${id}\n\n`);
  process.stdout.write('Als Nachzügler (Team 02 hat zwei freie Plätze):\n');
  process.stdout.write(`  ${w}/index.html?session=${id}   → Beitritt, Matrikelnummer frei wählbar\n\n`);
  process.stdout.write('Auswertung und Bühne von Team 01:\n');
  process.stdout.write(`  ${w}/auswertung.html?session=${id}&team=Team%2001\n`);
  process.stdout.write(`  ${w}/buehne.html?session=${id}&team=Team%2001\n\n`);
  process.stdout.write('Als Lehrperson:\n');
  process.stdout.write(`  ${w}/leitung.html?session=${id}#token=${token}\n\n`);
  process.stdout.write('Die zehn Gestaltungsentwürfe:\n');
  process.stdout.write(`  ${w}/entwurf/ansaetze/index.html\n`);
}

main().catch((f) => {
  process.stderr.write(`\nAbgebrochen: ${f.message}\n`);
  process.stderr.write('Läuft der Worker? → cd api && npm run dev\n');
  process.exit(1);
});
