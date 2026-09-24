// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DIE LEITUNG — Zulassung, Aufstellung, Notfallwerkzeuge
//
// Deckt E2 bis E6 aus entwurf/PLANUNG-AUSBAU.md ab: Zulassung, Aufstellung,
// Personenblatt, Perioden, Ereignisse, Werkzeuge und Leitstand. Lernziele und
// der Upload der Teilnahmeliste liegen noch in admin.html.
//
// ── Der Token steht im Fragment, nie in der Abfrage ────────────────────────
// `?token=` landet in Serverprotokollen, Verlaeufen und Lesezeichen, die
// weitergegeben werden. `#token=` sieht kein Server. Das ist eine Regel des
// Projekts (CLAUDE.md), keine Vorsichtsmassnahme nach Geschmack.
// ═══════════════════════════════════════════════════════════════════════════

import { hatBackend, holeAdminSicht, holeAufstellung, lasseZu, entfernePerson,
         setzePersonUm, gibRessortFrei, setzeAnzeigenamenZurueck, setzeZuordnung,
         setzeFreigabe, setzePeriode, setzeSchocks, setzeWerkzeuge,
         ServerFehler } from './dienste/server.js';
import { spieleNach, kursAus, KENNZAHLEN, zahl, diffText, jahreDerRunde, SCHOCKS,
         schockWirkung, WERKZEUGE, RESSORTS, abRunde, werkzeugeAusAb } from './spielkern.js';

const $ = s => document.querySelector(s);
const P = new URLSearchParams(location.search);
const F = new URLSearchParams(location.hash.replace(/^#/, ''));

const SITZUNG_ID = P.get('session');
const TOKEN      = F.get('token') ?? '';

const RESSORT_KURZ = { fin: 'Finanzen', wir: 'Wirtschaft', soz: 'Soziales', umw: 'Umwelt' };

let sicht = null;      // Adminsicht: members, teams, matrikelnummern, eingriffe
let aufst = null;      // Aufstellung: Belegung je Team
let gewaehlt = null;   // Matrikelnummer der Person im Personenblatt

// ── Laden ──────────────────────────────────────────────────────────────────

async function lade() {
  try {
    [sicht, aufst] = await Promise.all([
      holeAdminSicht(SITZUNG_ID, TOKEN),
      holeAufstellung(SITZUNG_ID),
    ]);
    $('#laedt').hidden = true;
    $('#leitung').hidden = false;
    zeichne();
  } catch (f) {
    $('#laedt').textContent = f instanceof ServerFehler
      ? (f.status === 403 ? 'Der Zugangsschlüssel stimmt nicht. Öffne die Seite über den Link '
                          + 'aus der Sitzungsanlage — der Schlüssel steht darin hinter dem #.'
                          : `Die Sitzung ist nicht erreichbar: ${f.message}`)
      : 'Die Sitzung ist nicht erreichbar.';
  }
}

function melde(text, art = 'gut') {
  const m = $('#meldung');
  if (!text) { m.hidden = true; return; }
  m.textContent = text;
  m.dataset.art = art;
  m.hidden = false;
  m.scrollIntoView({ block: 'nearest' });
}

/** Nach jedem Eingriff neu laden — der Server ist massgeblich, nicht die Anzeige. */
async function nachEingriff(text) {
  melde(text);
  await lade();
}

// ── E2 · Zulassung ─────────────────────────────────────────────────────────

function zeichneZulassung() {
  const liste = sicht.matrikelnummern ?? [];
  $('#zulassung-zahl').textContent = liste.length === 0
    ? 'Keine Liste hinterlegt — dann darf jede Matrikelnummer beitreten.'
    : `${liste.length} Matrikelnummern zugelassen`;
  $('#zulassung-liste').innerHTML = liste.length === 0 ? ''
    : liste.map(m => {
        const drin = sicht.members?.some(x => x.matrikelnummer === m);
        return `<span class="mnr" data-drin="${drin}">${m}</span>`;
      }).join('');
  $('#zulassung-legende').hidden = liste.length === 0;
}

async function nachzueglerZulassen(ev) {
  ev.preventDefault();
  const feld = $('#nachzuegler');
  const nr = feld.value.replace(/\D/g, '');
  if (nr.length < 4) { melde('Die Matrikelnummer sieht nicht vollständig aus.', 'schlecht'); return; }
  try {
    const a = await lasseZu(SITZUNG_ID, nr, TOKEN);
    feld.value = '';
    await nachEingriff(a.schon_da ? `${nr} war schon zugelassen.` : `${nr} ist jetzt zugelassen.`);
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.', 'schlecht');
  }
}

// ── E3 · Aufstellung ───────────────────────────────────────────────────────

function zeichneAufstellung() {
  const offen = aufst.zuordnung_offen;
  $('#zuordnung-knopf').textContent = offen ? 'Zuordnung schließen' : 'Zuordnung wieder öffnen';
  $('#zuordnung-lage').textContent = offen
    ? 'Offen — Studierende können das Team noch wechseln. Teamnamen sind gesperrt.'
    : 'Geschlossen — Teams stehen fest, Namen können vergeben werden.';
  $('#zuordnung-lage').dataset.offen = String(offen);

  const belegte = aufst.teams.filter(t => t.belegung > 0);
  $('#teams-zahl').textContent =
    `${belegte.length} von ${aufst.teams.length} Teams belegt · `
    + `${sicht.members?.filter(m => m.zustand !== 'ausgeschieden').length ?? 0} Personen`;

  $('#teams').innerHTML = belegte.length === 0
    ? '<p class="leer">Noch hat sich niemand eingetragen.</p>'
    : belegte.map(t => {
        const leute = (sicht.members ?? []).filter(
          m => m.team === t.name && m.zustand !== 'ausgeschieden');
        const fehlend = aufst.ressorts.filter(r => !leute.some(m => m.rolle === r));
        return `
        <article class="team" data-vollstaendig="${fehlend.length === 0}">
          <header>
            <h3>${t.name}${t.anzeigename ? ` <span class="anz">${t.anzeigename}</span>` : ''}</h3>
            <p class="bel">${t.belegung} von ${aufst.team_groesse}${
              fehlend.length ? ` · offen: ${fehlend.map(r => RESSORT_KURZ[r] ?? r).join(', ')}`
                             : ' · vollständig'}</p>
          </header>
          <ul class="leute">
            ${leute.map(m => `
              <li><button type="button" class="person" data-mnr="${m.matrikelnummer}">
                <span class="pn">${m.name}</span>
                <span class="pr">${m.rolle ? (RESSORT_KURZ[m.rolle] ?? m.rolle) : 'ohne Ressort'}</span>
              </button></li>`).join('')}
          </ul>
          ${t.anzeigename ? `<p><button type="button" class="klein-knopf namen-weg"
            data-team="${t.name}">Namen zurücksetzen</button></p>` : ''}
        </article>`;
      }).join('');

  for (const k of document.querySelectorAll('.person')) {
    k.addEventListener('click', () => zeigePersonenblatt(k.dataset.mnr));
  }
  for (const k of document.querySelectorAll('.namen-weg')) {
    k.addEventListener('click', () => namenZuruecksetzen(k.dataset.team));
  }
}

async function zuordnungUmschalten() {
  try {
    await setzeZuordnung(SITZUNG_ID, !aufst.zuordnung_offen, TOKEN);
    await nachEingriff(aufst.zuordnung_offen
      ? 'Die Zuordnung ist geschlossen. Teams können sich jetzt Namen geben.'
      : 'Die Zuordnung ist wieder offen.');
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.', 'schlecht');
  }
}

async function namenZuruecksetzen(team) {
  if (!confirm(`Den Anzeigenamen von ${team} zurücksetzen?\n\n`
             + `${team} bleibt als Systemname bestehen. Das Team kann sich neu benennen.`)) return;
  try {
    await setzeAnzeigenamenZurueck(SITZUNG_ID, team, TOKEN);
    await nachEingriff(`Der Anzeigename von ${team} ist zurückgesetzt.`);
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.', 'schlecht');
  }
}

// ── E3a · Das Personenblatt ────────────────────────────────────────────────

function zeigePersonenblatt(mnr) {
  gewaehlt = mnr;
  const m = sicht.members.find(x => x.matrikelnummer === mnr);
  if (!m) return;

  $('#blatt-name').textContent = m.name;
  $('#blatt-daten').innerHTML = `
    <dl>
      <dt>Matrikelnummer</dt><dd>${m.matrikelnummer}</dd>
      <dt>Team</dt><dd>${m.team}${
        aufst.teams.find(t => t.name === m.team)?.anzeigename
          ? ` — ${aufst.teams.find(t => t.name === m.team).anzeigename}` : ''}</dd>
      <dt>Ressort</dt><dd>${m.rolle ? (RESSORT_KURZ[m.rolle] ?? m.rolle) : '—'}</dd>
      <dt>Beigetreten</dt><dd>${new Date(m.joined_at).toLocaleString('de-DE')}</dd>
      <dt>Zustand</dt><dd>${m.zustand === 'ausgeschieden' ? 'ausgeschieden' : 'aktiv'}</dd>
    </dl>`;

  $('#umsetzen-ziel').innerHTML = aufst.teams
    .filter(t => t.name !== m.team && t.belegung < aufst.team_groesse)
    .map(t => `<option value="${t.name}">${t.name} — ${t.belegung} von ${aufst.team_groesse}</option>`)
    .join('') || '<option value="">kein Team mit freiem Platz</option>';

  $('#ressort-frei').hidden = !m.rolle;
  $('#ressort-frei-text').textContent = m.rolle
    ? `${RESSORT_KURZ[m.rolle] ?? m.rolle} in ${m.team} wird frei.` : '';

  $('#kennwort-hinweis').textContent =
    'Zugang zurücksetzen gibt es erst, wenn die Anmeldung mit Kennwort gebaut ist '
    + '(Plan, Stufe 2). Heute weist sich niemand mit einem Kennwort aus.';

  $('#personenblatt').hidden = false;
  $('#blatt-name').focus();
}

async function umsetzen() {
  const ziel = $('#umsetzen-ziel').value;
  if (!ziel) return;
  const m = sicht.members.find(x => x.matrikelnummer === gewaehlt);
  if (!confirm(`${m.name} von ${m.team} nach ${ziel} setzen?\n\n`
             + 'Das bisherige Ressort wird frei — das Team muss es neu vergeben.')) return;
  try {
    await setzePersonUm(SITZUNG_ID, gewaehlt, ziel, TOKEN);
    $('#personenblatt').hidden = true;
    await nachEingriff(`${m.name} sitzt jetzt in ${ziel}.`);
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.', 'schlecht');
  }
}

async function ressortFreigeben() {
  const m = sicht.members.find(x => x.matrikelnummer === gewaehlt);
  if (!m?.rolle) return;
  if (!confirm(`${RESSORT_KURZ[m.rolle] ?? m.rolle} in ${m.team} freigeben?\n\n`
             + `${m.name} bleibt im Team, aber ohne Ressort.`)) return;
  try {
    await gibRessortFrei(SITZUNG_ID, m.team, m.rolle, TOKEN);
    $('#personenblatt').hidden = true;
    await nachEingriff(`Das Ressort ist frei — ${m.team} kann es neu vergeben.`);
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.', 'schlecht');
  }
}

async function entfernen() {
  const m = sicht.members.find(x => x.matrikelnummer === gewaehlt);
  if (!confirm(`${m.name} aus dem Kurs entfernen?\n\n`
    + `· Das Ressort in ${m.team} wird frei.\n`
    + '· Stimmen aus abgeschlossenen Runden bleiben im Protokoll stehen.\n'
    + '· Stimmen der laufenden Runde verfallen.\n'
    + `· Die Matrikelnummer ${m.matrikelnummer} bleibt zugelassen — die Person kann sich `
    + 'neu anmelden.')) return;
  try {
    await entfernePerson(SITZUNG_ID, gewaehlt, TOKEN);
    $('#personenblatt').hidden = true;
    await nachEingriff(`${m.name} ist entfernt. Die Matrikelnummer bleibt zugelassen.`);
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.', 'schlecht');
  }
}

// ── E4 · Perioden ──────────────────────────────────────────────────────────

/**
 * Ein ISO-Zeitpunkt in der Form, die `datetime-local` erwartet — in ORTSZEIT.
 *
 * `toISOString().slice(0,16)` waere falsch: das liefert UTC. Wer 12:00 setzt,
 * bekaeme beim naechsten Laden 10:00 zu sehen, und beim uebernaechsten 08:00.
 */
function alsOrtszeit(iso) {
  const d = new Date(iso);
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
       + `T${z(d.getHours())}:${z(d.getMinutes())}`;
}

const laengeVon = (i) => Array.isArray(sicht.perioden_laenge_jahre)
  ? (sicht.perioden_laenge_jahre[i] ?? sicht.perioden_laenge_jahre.at(-1) ?? 4)
  : sicht.perioden_laenge_jahre;

/** Wie viele Teams diese Periode abgeschlossen haben. */
function fertigIn(idx) {
  const teams = Object.values(sicht.teams ?? {});
  return teams.filter(t => t.perioden?.[idx]?.locked).length;
}

function zeichnePerioden() {
  const frei = sicht.perioden_freigegeben ?? 1;
  const teams = Object.keys(sicht.teams ?? {}).length;

  $('#perioden').innerHTML = Array.from({ length: sicht.perioden_anzahl }, (_, i) => {
    const zustand = i < frei ? (fertigIn(i) === teams && teams > 0 ? 'geschlossen' : 'offen')
                             : 'gesperrt';
    const frist = sicht.fristen?.[i];
    return `
      <tr data-zustand="${zustand}">
        <td class="nr">${i + 1}</td>
        <td class="z"><span class="marke">${zustand}</span></td>
        <td><input type="number" class="laenge" data-idx="${i}" min="1" max="20"
              value="${laengeVon(i)}" aria-label="Länge der Periode ${i + 1} in Jahren"> J.</td>
        <td><input type="datetime-local" class="frist" data-idx="${i}"
              value="${frist ? alsOrtszeit(frist) : ''}"
              aria-label="Frist für Periode ${i + 1}"></td>
        <td class="fertig">${teams === 0 ? '—' : `${fertigIn(i)} von ${teams}`}</td>
      </tr>`;
  }).join('');

  $('#freigabe-zahl').textContent = `${frei} von ${sicht.perioden_anzahl} freigegeben`;
  $('#freigabe-weiter').disabled = frei >= sicht.perioden_anzahl;
  $('#freigabe-weiter').textContent = frei >= sicht.perioden_anzahl
    ? 'Alle Perioden sind frei' : `Periode ${frei + 1} freischalten`;

  for (const feld of document.querySelectorAll('.laenge, .frist')) {
    feld.addEventListener('change', () => periodeAendern(Number(feld.dataset.idx)));
  }
}

async function periodeAendern(idx) {
  const laenge = Number(document.querySelector(`.laenge[data-idx="${idx}"]`).value);
  const roh    = document.querySelector(`.frist[data-idx="${idx}"]`).value;
  const neueFrist = roh ? new Date(roh).toISOString() : null;

  // Nur schicken, was sich wirklich geaendert hat — sonst steht im Protokoll
  // eine Laengenaenderung, die nie stattgefunden hat.
  const daten = {};
  if (laenge !== laengeVon(idx)) daten.laenge_jahre = laenge;
  if (neueFrist !== (sicht.fristen?.[idx] ?? null)) daten.frist = neueFrist;
  if (Object.keys(daten).length === 0) return;

  try {
    await setzePeriode(SITZUNG_ID, idx, daten, TOKEN);
    await nachEingriff(`Periode ${idx + 1} geändert.`);
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.', 'schlecht');
  }
}

async function weitereFreigeben() {
  // Die Freigabe ist der Moment, in dem ein Ereignis unwiderruflich wird.
  // Das soll niemandem nebenbei passieren.
  const naechste = sicht.perioden_freigegeben ?? 1;
  const ereignis = (sicht.schocks ?? []).find(s => s.periode === naechste);
  if (ereignis && !confirm(`Periode ${naechste + 1} freischalten?\n\n`
      + `Damit steht das Ereignis „${ereignis.name}“ fest. Es trifft alle Teams und lässt `
      + 'sich danach nicht mehr ändern oder entfernen.')) return;
  try {
    await setzeFreigabe(SITZUNG_ID, (sicht.perioden_freigegeben ?? 1) + 1, TOKEN);
    await nachEingriff(`Periode ${(sicht.perioden_freigegeben ?? 1) + 1} ist freigeschaltet.`);
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.', 'schlecht');
  }
}

// ── E6 · Der Leitstand ─────────────────────────────────────────────────────
//
// Wo steht jedes Team? Die Sitzungsverwaltung speichert nur Parameter, also
// wird der Weg nachgespielt — mit denselben Funktionen wie am Tisch
// (spieleNach in js/spielkern.js).

function zeichneLeitstand() {
  const eintraege = Object.entries(sicht.teams ?? {});
  if (eintraege.length === 0) {
    $('#leitstand').innerHTML = '<p class="leer">Noch hat kein Team etwas gespeichert.</p>';
    $('#leitstand-zahl').textContent = '';
    return;
  }

  const jetzt = Date.now();
  const zeilen = eintraege.map(([name, t]) => {
    const bahn = spieleNach(t.perioden ?? [], kursAus(sicht));
    const letzte = bahn.at(-1);
    const laufend = (t.perioden ?? []).find(p => !p.locked);
    const vorlagen = Object.values(laufend?.vorlagen ?? {});
    const angenommen = vorlagen.filter(v => v.stand === 'angenommen').length;
    const minuten = t.last_updated
      ? Math.round((jetzt - Date.parse(t.last_updated)) / 60000) : null;
    // "Haengt fest" heisst: lange nichts gemeldet UND noch nicht fertig.
    const haengt = minuten !== null && minuten > 15 && angenommen < (sicht.ressorts?.length ?? 4);
    return { name, anzeige: t.anzeigename, letzte, angenommen, minuten, haengt,
             periode: (laufend?.idx ?? bahn.length - 1) + 1 };
  }).sort((a, b) => Number(b.haengt) - Number(a.haengt) || a.name.localeCompare(b.name));

  $('#leitstand-zahl').textContent =
    `${zeilen.length} Teams · ${zeilen.filter(z => z.haengt).length} melden sich länger nicht`;

  $('#leitstand').innerHTML = zeilen.map(z => `
    <article class="lt" data-haengt="${z.haengt}">
      <header>
        <h3>${z.name}${z.anzeige ? ` <span class="anz">${z.anzeige}</span>` : ''}</h3>
        <p class="lz">Periode ${z.periode} · ${z.angenommen} von ${sicht.ressorts?.length ?? 4}
           Vorlagen angenommen${z.minuten === null ? ''
             : z.minuten < 1 ? ' · gerade eben'
             : ` · vor ${z.minuten} Min.`}</p>
      </header>
      ${z.letzte ? `<div class="lk">${KENNZAHLEN.map(k => `
        <span><b>${k.kurz}</b> ${zahl(k.lies(z.letzte.ergebnis), k.n)}</span>`).join('')}</div>`
        : '<p class="leer">noch nichts gerechnet</p>'}
      <p class="lnav">
        <a href="auswertung.html?session=${SITZUNG_ID}&team=${encodeURIComponent(z.name)}">Auswertung</a>
        · <a href="buehne.html?session=${SITZUNG_ID}&team=${encodeURIComponent(z.name)}">Bühne</a></p>
    </article>`).join('');
}

// ── E5 · Ereignisse ────────────────────────────────────────────────────────
//
// Dieselbe Regel wie auf dem Server (periodeGesehen in api/src/index.ts):
// fest ist, was freigegeben ist ODER worin schon ein Team sitzt. Die
// Oberflaeche zeigt es nur an — verhindern tut es der Server.

function gesehen(idx) {
  if (idx < (sicht.perioden_freigegeben ?? 1)) return true;
  return Object.values(sicht.teams ?? {}).some(t =>
    (t.perioden ?? []).some(p => p.idx >= idx - 1 && p.locked));
}

const TYP = { energie: 'Energie', nachfrage: 'Nachfrage', finanz: 'Finanzmarkt',
              geopolitisch: 'Handel' };

function wirkungsliste(schock) {
  if (!schock) return '<span class="leer">ruhige Periode</span>';
  return `<ul class="wirkung">${schockWirkung(schock).map(w =>
    `<li data-wirkt="${w.wirkt}">${w.text}</li>`).join('')}
    <li class="q">${schock.quelle}</li></ul>`;
}

function zeichneEreignisse() {
  const kurs = kursAus(sicht);
  const typen = [...new Set(SCHOCKS.map(s => s.typ))];
  $('#ereignisse').innerHTML = Array.from({ length: kurs.runden }, (_, i) => {
    const gesetzt = (sicht.schocks ?? []).find(s => s.periode === i);
    const schock = gesetzt ? SCHOCKS.find(s => s.id === gesetzt.id) ?? null : null;
    const auswahl = gesehen(i)
      ? `<p class="fest">${schock ? schock.name : 'kein Ereignis'}
           <small>steht fest — die Periode ist ${i < (sicht.perioden_freigegeben ?? 1)
             ? 'freigegeben' : 'schon in Arbeit'}</small></p>`
      : `<select class="ereignis-wahl" data-idx="${i}" aria-label="Ereignis in Periode ${i + 1}">
          <option value="">kein Ereignis</option>
          ${typen.map(t => `<optgroup label="${TYP[t] ?? t}">${SCHOCKS.filter(s => s.typ === t)
            .map(s => `<option value="${s.id}"${s.id === schock?.id ? ' selected' : ''}>${
              s.name} · Stärke ${s.staerke}</option>`).join('')}</optgroup>`).join('')}
        </select>`;
    return `<tr><td class="nr">${i + 1}</td><td class="j">${jahreDerRunde(i + 1, kurs).text}</td>
      <td>${auswahl}</td><td>${wirkungsliste(schock)}</td></tr>`;
  }).join('');

  for (const feld of document.querySelectorAll('.ereignis-wahl')) {
    feld.addEventListener('change', () => setzeEreignis(Number(feld.dataset.idx), feld.value));
  }
}

async function setzeEreignis(idx, id) {
  const liste = (sicht.schocks ?? []).filter(s => s.periode !== idx);
  const eintrag = SCHOCKS.find(s => s.id === id);
  if (eintrag) liste.push({ ...eintrag, periode: idx });
  try {
    await setzeSchocks(SITZUNG_ID, liste, TOKEN);
    await nachEingriff(eintrag ? `Periode ${idx + 1}: „${eintrag.name}“ gesetzt.`
                               : `Periode ${idx + 1}: kein Ereignis mehr.`);
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.', 'schlecht');
    await lade();
  }
}

// ── Werkzeuge: schrittweise Freischaltung ──────────────────────────────────

/** Die erste Runde, die noch niemand gesehen hat — oder null. */
function ersteFreieRunde(runden) {
  for (let r = 1; r <= runden; r++) if (!gesehen(r - 1)) return r;
  return null;
}

function zeichneWerkzeuge() {
  const kurs = kursAus(sicht);
  const frei = ersteFreieRunde(kurs.runden);
  const drin = sicht.ressorts ?? RESSORTS.map(r => r.id);
  $('#werkzeuge').innerHTML = WERKZEUGE.filter(w => drin.includes(w.ressort)).map(w => {
    const ab = abRunde(w.id, kurs);
    const fest = frei === null || (ab !== null && ab < frei);
    const zelle = fest
      ? `<p class="fest">${ab ? `Runde ${ab}` : 'nie'}<small>${ab ? 'schon offen' : 'Kurs zu weit'}</small></p>`
      : `<select class="werkzeug-wahl" data-id="${w.id}" aria-label="${w.name} offen ab Runde">
          ${Array.from({ length: kurs.runden - frei + 1 }, (_, i) => frei + i).map(r =>
            `<option value="${r}"${r === ab ? ' selected' : ''}>Runde ${r}</option>`).join('')}
          <option value=""${ab === null ? ' selected' : ''}>nie</option>
        </select>`;
    return `<tr><td><b>${w.name}</b></td>
      <td>${RESSORTS.find(r => r.id === w.ressort)?.kurz ?? w.ressort}</td>
      <td class="stl">${w.stell.map(s => s.bez).join(', ')}</td><td>${zelle}</td></tr>`;
  }).join('');

  for (const feld of document.querySelectorAll('.werkzeug-wahl')) {
    feld.addEventListener('change', () => setzeWerkzeugAb(feld.dataset.id, feld.value));
  }
}

async function setzeWerkzeugAb(id, wert) {
  const kurs = kursAus(sicht);
  const ab = Object.fromEntries(WERKZEUGE.map(w => [w.id, abRunde(w.id, kurs) ?? Infinity]));
  ab[id] = wert === '' ? Infinity : Number(wert);
  const name = WERKZEUGE.find(w => w.id === id)?.name ?? id;
  try {
    await setzeWerkzeuge(SITZUNG_ID, werkzeugeAusAb(ab, kurs.runden), TOKEN);
    await nachEingriff(wert === '' ? `${name} bleibt in diesem Kurs zu.`
                                   : `${name} ist ab Runde ${wert} offen.`);
  } catch (f) {
    melde(f instanceof ServerFehler ? f.message : 'Das hat nicht geklappt.', 'schlecht');
  }
}

// ── Eingriffe nachlesen ────────────────────────────────────────────────────

function zeichneEingriffe() {
  const e = sicht.eingriffe ?? [];
  $('#eingriffe').innerHTML = e.length === 0
    ? '<p class="leer">Noch kein Eingriff.</p>'
    : e.slice().reverse().map(x =>
        `<p class="ei"><time>${new Date(x.at).toLocaleString('de-DE')}</time> ${x.was}</p>`).join('');
}

function zeichne() {
  zeichneZulassung(); zeichneAufstellung(); zeichnePerioden();
  zeichneEreignisse(); zeichneWerkzeuge(); zeichneLeitstand(); zeichneEingriffe();
}

// ── Start ──────────────────────────────────────────────────────────────────

if (!SITZUNG_ID || !hatBackend()) {
  $('#laedt').innerHTML = 'Für die Leitung braucht es einen Kurs-Code und eine erreichbare Sitzung. '
    + '<a href="einrichtung.html" style="color:var(--zettel)">Einen Kurs anlegen</a>';
} else if (!TOKEN) {
  $('#laedt').innerHTML = 'Es fehlt der Zugangsschlüssel. Er steht im Link aus der '
    + 'Sitzungsanlage <b>hinter dem #</b> — kopier den Link vollständig.';
} else {
  $('#nachzuegler-form').addEventListener('submit', nachzueglerZulassen);
  $('#zuordnung-knopf').addEventListener('click', zuordnungUmschalten);
  $('#umsetzen').addEventListener('click', umsetzen);
  $('#ressort-frei-knopf').addEventListener('click', ressortFreigeben);
  $('#entfernen').addEventListener('click', entfernen);
  $('#blatt-zu').addEventListener('click', () => { $('#personenblatt').hidden = true; });
  $('#freigabe-weiter').addEventListener('click', weitereFreigeben);
  lade();
}
