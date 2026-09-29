// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DIE AUFSTELLUNG — Team, Ressort, Name
//
// Drei Schritte vor dem ersten Spielzug (PLANUNG-AUSBAU.md, Flow A):
//   A2  Teamzuordnung   ein Raster, man verabredet sich muendlich
//   A3  Ressortwahl     vier Plaetze, jedes Ressort genau einmal
//   A4  Teamname        erst wenn die Lehrperson die Zuordnung schliesst
//
// ── Warum Wartezustaende hier Seiten sind und keine Ladebalken ─────────────
// Wer als Erste im Team sitzt, wartet auf drei andere. Ein Spinner sagt ihr
// nichts. "3 Plaetze frei — sag deinen Leuten: Team 20" sagt ihr, was zu tun
// ist. Das ist die Regel 4 aus Abschnitt 7 des Plans.
// ═══════════════════════════════════════════════════════════════════════════

import { hatBackend, holeAufstellung, waehleTeam, waehleRessort,
         setzeAnzeigename, ServerFehler } from './dienste/server.js';
import { merke, hole } from './dienste/speicher.js';

const $ = s => document.querySelector(s);
const SITZUNG_ID = new URLSearchParams(location.search).get('session');

/** Die Ressorts, wie die Spielflaeche sie nennt — hier nur zum Anzeigen. */
const RESSORT_TEXT = {
  fin: { name: 'Finanzen und Steuern', kurz: 'Finanzen',
         satz: 'Steuersätze und Freibeträge. Wacht über den Haushaltssaldo.' },
  wir: { name: 'Wirtschaft und Unternehmen', kurz: 'Wirtschaft',
         satz: 'Unternehmensbesteuerung. Wacht über die Wirtschaftsleistung.' },
  soz: { name: 'Arbeit und Soziales', kurz: 'Soziales',
         satz: 'Beiträge und Transfers. Wacht über die Ungleichheit.' },
  umw: { name: 'Umwelt und Klima', kurz: 'Umwelt',
         satz: 'CO₂-Preis und Klimageld. Wacht über die Emissionen.' },
};

const ich = {
  matrikelnummer: hole('person', SITZUNG_ID ?? 'lokal', {})?.matrikelnummer ?? null,
  name:           hole('person', SITZUNG_ID ?? 'lokal', {})?.name ?? null,
  team:  null,
  rolle: null,
};

let stand = null;
let takt  = null;

// ── Zeichnen ───────────────────────────────────────────────────────────────

function meinTeam() {
  return stand?.teams.find(t => t.name === ich.team) ?? null;
}

function zeichneSchritte() {
  const schritt = !ich.team ? 1 : !ich.rolle ? 2 : stand?.zuordnung_offen ? 3 : 4;
  $('#schritte').innerHTML = [
    ['Team wählen',  1], ['Ressort übernehmen', 2],
    ['Auf das Team warten', 3], ['Name vergeben', 4],
  ].map(([text, nr]) => `
    <li data-stand="${nr < schritt ? 'fertig' : nr === schritt ? 'jetzt' : 'offen'}">
      <span class="nr">${nr < schritt ? '✓' : nr}</span>${text}</li>`).join('');
  return schritt;
}

function zeichneTeams() {
  const offen = stand.zuordnung_offen;
  $('#raster').innerHTML = stand.teams.map(t => {
    const voll   = t.belegung >= stand.team_groesse;
    const meins  = t.name === ich.team;
    const punkte = Array.from({ length: stand.team_groesse },
      (_, i) => `<i class="${i < t.belegung ? 'voll' : ''}"></i>`).join('');
    return `
      <button type="button" class="kachel" data-team="${t.name}"
        data-meins="${meins}" ${voll && !meins ? 'disabled' : ''}
        ${!offen && !meins ? 'disabled' : ''}
        aria-pressed="${meins}">
        <span class="tname">${t.name}</span>
        ${t.anzeigename ? `<span class="tanzeige">${t.anzeigename}</span>` : ''}
        <span class="punkte" aria-hidden="true">${punkte}</span>
        <span class="tbelegung">${t.belegung} von ${stand.team_groesse}${voll ? ' · voll' : ''}</span>
      </button>`;
  }).join('');

  for (const knopf of document.querySelectorAll('.kachel')) {
    knopf.addEventListener('click', () => waehleMeinTeam(knopf.dataset.team));
  }
}

function zeichneRessorts() {
  const t = meinTeam();
  if (!t) { $('#ressorts').innerHTML = ''; return; }

  $('#ressorts').innerHTML = stand.ressorts.map(id => {
    const r = RESSORT_TEXT[id] ?? { name: id, kurz: id, satz: '' };
    const platz = t.plaetze.find(p => p.rolle === id);
    const meins = ich.rolle === id;
    const fremd = platz && !meins;
    return `
      <button type="button" class="ressort r-${id}" data-rolle="${id}"
        ${fremd ? 'disabled' : ''} aria-pressed="${meins}">
        <span class="rkurz">${r.kurz}</span>
        <span class="rname">${r.name}</span>
        <span class="rsatz">${r.satz}</span>
        <span class="rwer">${platz ? (meins ? 'das bist du' : platz.vorname)
                                   : 'noch frei'}</span>
      </button>`;
  }).join('');

  for (const knopf of document.querySelectorAll('.ressort')) {
    knopf.addEventListener('click', () => waehleMeinRessort(knopf.dataset.rolle));
  }
}

function zeichneWarten() {
  const t = meinTeam();
  if (!t) return;
  const frei  = stand.team_groesse - t.belegung;
  const ohne  = t.plaetze.filter(p => !p.rolle).length;
  const feld  = $('#warten');

  if (frei > 0) {
    feld.innerHTML = `
      <p class="gross">${frei === 1 ? 'Ein Platz ist noch frei' : `${frei} Plätze sind noch frei`}</p>
      <p>Sag deinen Leuten: <b>${t.name}</b>.</p>
      <p class="klein">${t.belegung} von ${stand.team_groesse} sitzen schon hier.</p>`;
  } else if (ohne > 0) {
    feld.innerHTML = `
      <p class="gross">Das Team ist vollständig</p>
      <p>${ohne === 1 ? 'Eine Person hat' : `${ohne} Personen haben`} noch kein Ressort gewählt.</p>`;
  } else if (stand.zuordnung_offen) {
    feld.innerHTML = `
      <p class="gross">Ihr seid aufgestellt</p>
      <p>Sobald die Lehrperson die Zuordnung schließt, könnt ihr euch einen Namen geben.</p>`;
  } else {
    feld.innerHTML = '';
  }
}

function zeichneName() {
  const t = meinTeam();
  const feld = $('#namensfeld');
  if (!t || stand.zuordnung_offen) { feld.hidden = true; return; }
  feld.hidden = false;
  $('#name-vorschau').innerHTML = t.anzeigename
    ? `<b>${t.anzeigename}</b> <span class="system">(${t.name})</span>`
    : `<span class="system">${t.name}</span> — noch ohne Namen`;
  if (t.anzeigename && !$('#anzeigename').value) $('#anzeigename').value = t.anzeigename;
}

function zeichne() {
  const schritt = zeichneSchritte();
  zeichneTeams();
  zeichneRessorts();
  zeichneWarten();
  zeichneName();

  $('#abschnitt-ressort').hidden = !ich.team;
  $('#abschnitt-warten').hidden  = !ich.team;
  $('#weiter').hidden = !(ich.team && ich.rolle);
  $('#weiter').href   = `index.html?session=${encodeURIComponent(SITZUNG_ID)}`;

  $('#zuordnung-hinweis').textContent = stand.zuordnung_offen
    ? 'Die Zuordnung ist offen — ihr könnt das Team noch wechseln.'
    : 'Die Zuordnung ist geschlossen. Das Team lässt sich nicht mehr wechseln.';
  $('#zuordnung-hinweis').dataset.offen = String(stand.zuordnung_offen);
  return schritt;
}

// ── Handeln ────────────────────────────────────────────────────────────────

function melde(text, art = 'schlecht') {
  const m = $('#meldung');
  if (!text) { m.hidden = true; return; }
  m.textContent = text;
  m.dataset.art = art;
  m.hidden = false;
}

async function waehleMeinTeam(team) {
  melde(null);
  try {
    await waehleTeam(SITZUNG_ID, ich.matrikelnummer, team);
    ich.team  = team;
    ich.rolle = null;   // das Ressort gehoert dem Team, nicht der Person
    merke('person', SITZUNG_ID, { ...ich });
    await hole_stand();
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.');
    await hole_stand();
  }
}

async function waehleMeinRessort(rolle) {
  melde(null);
  const neu = ich.rolle === rolle ? null : rolle;
  try {
    await waehleRessort(SITZUNG_ID, ich.matrikelnummer, neu);
    ich.rolle = neu;
    merke('person', SITZUNG_ID, { ...ich });
    await hole_stand();
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.');
    await hole_stand();
  }
}

async function benenne(ev) {
  ev.preventDefault();
  melde(null);
  try {
    const antwort = await setzeAnzeigename(SITZUNG_ID, ich.team, $('#anzeigename').value);
    melde(`Ihr heißt jetzt „${antwort.anzeigename}".`, 'gut');
    await hole_stand();
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Der Name ließ sich nicht setzen.');
  }
}

// ── Stand holen ────────────────────────────────────────────────────────────

async function hole_stand() {
  try {
    stand = await holeAufstellung(SITZUNG_ID, { zeitlimit: 8000 });
    // Die eigene Lage aus dem Stand ableiten, nicht aus dem Gedaechtnis:
    // wer umgesetzt wurde, soll das sehen.
    const meins = stand.teams.find(t =>
      t.plaetze.some(p => p.vorname === (ich.name ?? '').split(' ')[0]));
    if (meins && !ich.team) ich.team = meins.name;
    $('#laedt').hidden = true;
    $('#aufstellung').hidden = false;
    zeichne();
  } catch (f) {
    $('#laedt').textContent = f instanceof ServerFehler
      ? `Die Sitzung ist nicht erreichbar: ${f.message}`
      : 'Die Sitzung ist nicht erreichbar.';
  }
}

// ── Start ──────────────────────────────────────────────────────────────────

if (!SITZUNG_ID || !hatBackend()) {
  $('#laedt').innerHTML =
    'Für die Aufstellung braucht es einen Kurs-Code und eine erreichbare Sitzung.<br>'
    + '<a href="index.html">Am eigenen Gerät weiterspielen</a>';
} else if (!ich.matrikelnummer) {
  $('#laedt').innerHTML =
    'Du bist in dieser Sitzung noch nicht angemeldet.<br>'
    + `<a href="index.html?session=${encodeURIComponent(SITZUNG_ID)}">Zur Anmeldung</a>`;
} else {
  $('#namensform').addEventListener('submit', benenne);
  hole_stand();
  // Die anderen drei kommen nach und nach an — ohne Abgleich sieht man das nicht.
  takt = setInterval(hole_stand, 4000);
  addEventListener('pagehide', () => clearInterval(takt));
}
