// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DIE EINRICHTUNG — einen Kurs anlegen (E1)
//
// Der Anfang der Kette: Einrichtung → Leitung → Tisch. Was hier eingestellt
// wird, liest der Tisch ueber kursAus() (js/spielkern.js) — Periodenzahl,
// Laengen, Ressorts, Quorum und Werkzeuge. Es gibt keine Einstellung auf
// dieser Seite, die der Tisch nicht auch beachtet; eine solche waere eine
// Behauptung.
//
// ── Der Token steht im Fragment, nie in der Abfrage ────────────────────────
// Der Leitungslink traegt ihn hinter dem #. Den Teil schickt kein Browser an
// einen Server, er landet in keinem Protokoll (CLAUDE.md).
// ═══════════════════════════════════════════════════════════════════════════

import { hatBackend, erstelleSitzung, ServerFehler } from './dienste/server.js';
import { RESSORTS, WERKZEUGE, kursAus, jahreDerRunde, werkzeugeAusAb } from './spielkern.js';

const $ = s => document.querySelector(s);

const QUOREN = [
  { id: 'einfach',    name: 'einfacher Mehrheit',   was: 'mehr Zustimmung als Ablehnung' },
  { id: 'absolut',    name: 'absoluter Mehrheit',   was: 'mehr als die Hälfte aller Ressorts' },
  { id: 'einstimmig', name: 'Einstimmigkeit',       was: 'keine Ablehnung, Enthaltung erlaubt' },
];

/**
 * Ein Vorschlag zum schrittweisen Freischalten: in Runde 1 je Ressort ein
 * Werkzeug, dann mehr. Nur ein Vorschlag — jede Zeile bleibt einstellbar.
 */
const SCHRITTWEISE = { est: 1, kst: 1, transfers: 1, co2: 1, mwst: 2, sv: 2, verm: 3 };

// ── Lesen ──────────────────────────────────────────────────────────────────

const ganz = (id) => Math.round(Number($(id).value));
const perioden = () => Math.max(1, Math.min(12, ganz('#perioden') || 5));
const gewaehlteRessorts = () =>
  [...document.querySelectorAll('input[name="ressort"]:checked')].map(x => x.value);

/** Die Laengen je Periode — aus den Einzelfeldern, wenn die aufgeklappt sind. */
function laengen() {
  const n = perioden(), grund = ganz('#jahre') || 4;
  if (!$('#einzeln').open) return Array(n).fill(grund);
  return Array.from({ length: n }, (_, i) =>
    Math.round(Number(document.getElementById(`laenge-${i}`)?.value)) || grund);
}

// ── Zeichnen ───────────────────────────────────────────────────────────────

function zeichneLaengen() {
  const n = perioden(), grund = ganz('#jahre') || 4;
  const alt = [...document.querySelectorAll('#laengen input')].map(x => x.value);
  $('#laengen').innerHTML = Array.from({ length: n }, (_, i) => `
    <div class="feld"><label for="laenge-${i}">Periode ${i + 1}</label>
      <input type="number" id="laenge-${i}" min="1" max="20" value="${alt[i] ?? grund}"></div>`)
    .join('');
  zeichneZeitraum();
}

function zeichneZeitraum() {
  const kurs = kursAus({ perioden_anzahl: perioden(), perioden_laenge_jahre: laengen() });
  $('#zeitraum').textContent =
    `${jahreDerRunde(1, kurs).von}–${jahreDerRunde(kurs.runden, kurs).bis}`;
}

function zeichneWerkzeuge(ab = {}) {
  const n = perioden();
  const drin = gewaehlteRessorts();
  $('#werkzeuge').innerHTML = WERKZEUGE.filter(w => drin.includes(w.ressort)).map(w => {
    const jetzt = Math.min(ab[w.id] ?? liesAb(w.id) ?? 1, n);
    return `<tr><td><b>${w.name}</b></td>
      <td class="s">${w.stell.map(s => s.bez).join(', ')}</td>
      <td><select data-werkzeug="${w.id}" aria-label="${w.name} offen ab Runde">${
        Array.from({ length: n }, (_, i) => `<option value="${i + 1}"${
          i + 1 === jetzt ? ' selected' : ''}>Runde ${i + 1}</option>`).join('')}</select></td></tr>`;
  }).join('');
  zeichneWerkzeuglage();
}

const liesAb = (id) => {
  const f = document.querySelector(`select[data-werkzeug="${id}"]`);
  return f ? Number(f.value) : null;
};

function werkzeugAb() {
  return Object.fromEntries(WERKZEUGE.map(w => [w.id, liesAb(w.id) ?? 1]));
}

function zeichneWerkzeuglage() {
  const spaeter = WERKZEUGE.filter(w => (liesAb(w.id) ?? 1) > 1).length;
  $('#werkzeug-lage').textContent = spaeter === 0 ? 'Alles ist ab Runde 1 offen'
    : `${spaeter} Werkzeug${spaeter === 1 ? '' : 'e'} später freigeschaltet`;
}

function zeichneWahl() {
  $('#ressorts').innerHTML = RESSORTS.map(r => `
    <label><input type="checkbox" name="ressort" value="${r.id}" checked>
      <span class="r" style="background:var(--${r.id})" aria-hidden="true"></span>${r.kurz}</label>`)
    .join('');
  $('#quoren').innerHTML = QUOREN.map((q, i) => `
    <label class="quorum"><b><input type="radio" name="quorum" value="${q.id}"${
      i === 0 ? ' checked' : ''}>${q.name}</b><span>${q.was}</span></label>`).join('');
}

// ── Pruefen und anlegen ────────────────────────────────────────────────────

function pruefe() {
  const name = $('#kursname').value.trim();
  const teams = ganz('#teams'), groesse = ganz('#groesse');
  const ressorts = gewaehlteRessorts();
  if (!name) return { fehler: 'Der Kurs braucht einen Namen.', feld: '#kursname' };
  if (!(teams >= 1 && teams <= 100)) return { fehler: 'Zwischen 1 und 100 Teams.', feld: '#teams' };
  if (!(groesse >= 1 && groesse <= 12)) return { fehler: 'Zwischen 1 und 12 Plätzen je Team.', feld: '#groesse' };
  if (ressorts.length < 2) return { fehler: 'Ein Tisch braucht mindestens zwei Ressorts.', feld: '#ressorts input' };
  // Weniger Plaetze als Ressorts: dann bleibt ein Ressort leer, und keine
  // Runde kann je schliessen. Das faellt sonst erst im Seminar auf.
  if (groesse < ressorts.length) {
    return { fehler: `${groesse} Plätze reichen nicht für ${ressorts.length} Ressorts — `
      + 'ein Ressort bliebe leer, und keine Runde könnte schließen.', feld: '#groesse' };
  }
  if (laengen().some(n => !(n >= 1 && n <= 20))) {
    return { fehler: 'Eine Periode dauert 1 bis 20 Jahre.', feld: '#jahre' };
  }
  return { name, teams, groesse, ressorts };
}

function zeigeFehler(text, feld) {
  const f = $('#fehler');
  f.textContent = text;
  f.hidden = false;
  (feld ? document.querySelector(feld) : f).focus();
}

async function lege(ev) {
  ev.preventDefault();
  $('#fehler').hidden = true;
  const p = pruefe();
  if (p.fehler) return zeigeFehler(p.fehler, p.feld);

  const n = perioden();
  const l = laengen();
  const ab = werkzeugAb();
  const knopf = $('#anlegen');
  knopf.disabled = true;
  knopf.textContent = 'Wird angelegt …';
  try {
    const antwort = await erstelleSitzung({
      name: p.name,
      perioden_anzahl: n,
      perioden_laenge_jahre: l.every(x => x === l[0]) ? l[0] : l,
      team_names: Array.from({ length: p.teams }, (_, i) =>
        `Team ${String(i + 1).padStart(p.teams >= 100 ? 3 : 2, '0')}`),
      team_groesse: p.groesse,
      ressorts: p.ressorts,
      quorum: document.querySelector('input[name="quorum"]:checked')?.value ?? 'einfach',
      // Nur mitschicken, wenn wirklich etwas spaeter aufgeht — sonst gilt
      // "alles offen", und das braucht keinen Eintrag.
      perioden_werkzeuge: Object.values(ab).some(x => x > 1) ? werkzeugeAusAb(ab, n) : undefined,
      // Der Tisch meldet den Rundenschluss erst, wenn jede Vorlage angenommen
      // ist — DAS ist die Entscheidung des Teams. Eine zweite Stimmenzaehlung
      // auf dem Server (Anteil der Mitglieder) wuerde die Periode nie sperren,
      // weil nur ein Geraet den Schluss meldet.
      min_teilnahme_quote: 0,
      sandbox: false,
    });
    zeigeErgebnis(p.name, antwort.session_id, antwort.admin_token);
  } catch (f) {
    zeigeFehler(f instanceof ServerFehler
      ? `Der Kurs ließ sich nicht anlegen: ${f.message}`
      : 'Der Kurs ließ sich nicht anlegen. Prüf die Verbindung.');
  } finally {
    knopf.disabled = false;
    knopf.textContent = 'Kurs anlegen';
  }
}

function zeigeErgebnis(name, id, token) {
  // Relativ zur eigenen Adresse gebaut: keine Adresse im Code (CLAUDE.md).
  const tisch   = new URL(`index.html?session=${encodeURIComponent(id)}`, location.href).href;
  const leitung = new URL(`leitung.html?session=${encodeURIComponent(id)}`, location.href).href
                + `#token=${encodeURIComponent(token)}`;
  $('#einrichtung').hidden = true;
  $('#ergebnis').hidden = false;
  $('#ergebnis-titel').textContent = `${name} ist angelegt`;
  $('#code').textContent = id;
  $('#link-tisch').value = tisch;
  $('#link-leitung').value = leitung;
  $('#zur-leitung').href = leitung;
  $('#ergebnis-titel').focus();
}

async function kopiere(knopf) {
  const feld = document.getElementById(knopf.dataset.kopiere);
  try {
    await navigator.clipboard.writeText(feld.value);
    knopf.textContent = 'Kopiert';
  } catch (_) {
    // Ohne Zugriff auf die Zwischenablage: markieren, dann kopiert man selbst.
    feld.select();
    knopf.textContent = 'Markiert';
  }
  setTimeout(() => { knopf.textContent = 'Kopieren'; }, 2000);
}

// ── Start ──────────────────────────────────────────────────────────────────

zeichneWahl();
zeichneLaengen();
zeichneWerkzeuge();

if (!hatBackend()) {
  $('#offline').hidden = false;
  $('#anlegen').disabled = true;
}

$('#perioden').addEventListener('input', () => { zeichneLaengen(); zeichneWerkzeuge(); });
$('#jahre').addEventListener('input', () => { $('#laengen').innerHTML = ''; zeichneLaengen(); });
$('#einzeln').addEventListener('toggle', zeichneZeitraum);
$('#laengen').addEventListener('input', zeichneZeitraum);
$('#ressorts').addEventListener('change', () => zeichneWerkzeuge());
$('#werkzeuge').addEventListener('change', zeichneWerkzeuglage);
$('#vorschlag').addEventListener('click', () => zeichneWerkzeuge(SCHRITTWEISE));
$('#einrichtung').addEventListener('submit', lege);
for (const k of document.querySelectorAll('[data-kopiere]')) {
  k.addEventListener('click', () => kopiere(k));
}
