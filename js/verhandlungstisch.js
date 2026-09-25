// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DER VERHANDLUNGSTISCH — Spielflaeche
//
// Die Regel, um die diese Flaeche gebaut ist: keine Zahl gilt, bevor alle
// vier Ressorts eine ANGENOMMENE Vorlage haben. Ein Ressort bringt ein,
// alle vier stimmen ab — das ist der Lerninhalt: die eigene Politik muss
// erklaert und mehrheitsfaehig gemacht werden.
//
// ── Drei Ansichten, ein Dokument ───────────────────────────────────────────
//   B0  Tisch          Heimatbasis. Beantwortet: muss ich handeln?
//   B1  Ressortansicht Beantwortet: was will das Ressort, und warum?
//   B1a Werkbank       Beantwortet: wie stelle ich es ein?
//
// Warum keine drei HTML-Dateien: der Spielstand liegt im Speicher dieses
// Dokuments (spielkern.js). Ein Seitenwechsel wuerde ihn wegwerfen. Statt
// dessen wechselt die Adresse im Fragment — Zuruecktaste und Lesezeichen
// funktionieren, der Stand bleibt.
//
// ── Zwei Wege, denselben Tisch zu decken ───────────────────────────────────
// AN EINEM GERAET: vier Personen sitzen davor, jede uebernimmt ein Ressort
// und traegt ihren Namen ein. Braucht keinen Server und zwingt zum Gespraech.
//
// UEBER VIER GERAETE: die Unterschriften liegen in der Sitzung
// (POST /teams/:team/zeichnung) und werden reihum abgefragt, damit jeder
// Tisch den Auszaehlstand sieht. Das eigene Ressort kommt aus der
// Aufstellung (aufstellung.html).
//
// Welcher Weg laeuft, haengt allein daran, ob eine Sitzung erreichbar ist.
//
// Was zum Server geht, geht ueber js/dienste/server.js und sonst nirgends:
// der Rundenschluss sichert die Entscheidungen (sendeTeamZustand) und gibt
// die Stimme des Teams ab (stimmeAb). Ohne konfiguriertes Backend laeuft
// alles weiter — das ist ein gueltiger Betriebsfall, kein Fehler.
// ═══════════════════════════════════════════════════════════════════════════

import {
  erzeugeSpiel, RESSORTS as ALLE_RESSORTS, ALLE, KENNZAHLEN, NEBENWERTE,
  benutzteQuellen, QUELLEN, spieleNach, zahl, mitVz, rund, diffText, punkteText,
  wertText, kursAus, ressortsIm, schockWirkung, istOffen, abRunde, WERKZEUGE,
} from './spielkern.js';
import { verlaufskurve, wirkungsbalken, VERLAUF_LEGENDE } from './diagramme.js';
import { bindeAlle, zieheKlappenNach } from './felder.js';
import { merke, hole, merkeSitznamen, holeSitznamen } from './dienste/speicher.js';
import { zeichneSchaukasten } from './schaukasten.js';
import { hatBackend, holeMitglieder, trittBei, holeSitzung,
         sendeTeamZustand, stimmeAb,
         setzeBegruendung, waehleRessort, holeVorlagen, bringeVorlageEin,
         ziehVorlageZurueck, stimmeUeberVorlage,
         ServerFehler } from './dienste/server.js';

const spiel   = erzeugeSpiel();

/**
 * Die Ressorts, die in DIESEM Kurs am Tisch sitzen. Bis die Sitzung
 * geantwortet hat, alle vier; danach die, mit denen der Kurs angelegt wurde.
 * Eine Variable und keine Konstante, weil die Sitzung erst nach dem Start
 * antwortet — jede Funktion liest sie beim Aufruf, nicht beim Laden.
 */
let RESSORTS = ALLE_RESSORTS;
const quellen = benutzteQuellen();
const $  = s => document.querySelector(s);
const FN = Object.fromEntries(quellen.map((q, i) => [q.id, i + 1]));
const knoten = (s) => ({
  eingabe: document.getElementById(`e-${s.key}`),
  fehler:  document.getElementById(`fehl-${s.key}`),
  zeile:   document.getElementById(`p-${s.key}`),
});

const SITZUNG_ID = new URLSearchParams(location.search).get('session');
const ONLINE     = Boolean(SITZUNG_ID) && hatBackend();

/** Die Sitzung. `team` bleibt null, solange offline gespielt wird. */
const bekannt = hole('person', SITZUNG_ID ?? 'lokal', {}) ?? {};
const sitzung = { team: bekannt.team ?? null, person: bekannt.name ?? null,
                  matrikelnummer: bekannt.matrikelnummer ?? '', mitglieder: null,
                  abfrage: null };

/**
 * Der Verhandlungsstand. Er liegt neben dem Spielstand, nicht in ihm: er ist
 * die Regel DIESER Flaeche, keine Eigenschaft des Modells.
 */
const gemerkteSitze = holeSitznamen(SITZUNG_ID) ?? {};

/**
 * Der Verhandlungsstand: je Ressort hoechstens eine offene Vorlage.
 *
 * Er liegt neben dem Spielstand, nicht in ihm — die Abstimmung ist die Regel
 * DIESER Flaeche, keine Eigenschaft des Modells. `spielkern.js` weiss nichts
 * von Stimmen.
 *
 * Online ist der Server massgeblich; die Auszaehlung hier ist nur die
 * Anzeige und fuer den Betrieb am eigenen Geraet, wo es keinen Server gibt.
 */
const tisch = Object.fromEntries(ALLE_RESSORTS.map(r => [r.id, {
  sitz: gemerkteSitze[r.id] ?? '', begruendung: '', vorlage: null,
}]));

const QUORUM_TEXT = {
  einfach:     'einfacher Mehrheit — mehr Zustimmung als Ablehnung',
  absolut:     'absoluter Mehrheit — mehr als die Hälfte aller Ressorts',
  einstimmig:  'Einstimmigkeit — keine Ablehnung, Enthaltung erlaubt',
};
let quorum = 'einfach';

/** Je Ressort der Schaukasten, wie ihn die andern zusammengestellt haben. */
const schaukaesten = {};

/**
 * Die abgeschlossenen Perioden des Teams, vom Server.
 *
 * NICHT aus `protokoll`: wer mitten im Kurs dazukommt oder die Seite neu
 * laedt, hat dort nichts stehen — der Schaukasten der anderen waere dann
 * leer, obwohl er gefuellt ist. Der Server weiss es, also wird er gefragt.
 */
let teamBahn = [];
let teamVorlagen = [];
let schaukastenGeholt = false;

/**
 * Den Stand des Teams uebernehmen, bevor dieses Geraet etwas sendet.
 *
 * Gilt nur fuer die LAUFENDE Periode. Abgeschlossene sind ohnehin gesperrt.
 */
async function uebernimmTeamstand() {
  try {
    const stand = await holeSitzung(SITZUNG_ID, { zeitlimit: 8000 });
    // Erst der Kurs, dann das Nachspielen: die Runden werden mit den
    // Laengen und Ereignissen DIESES Kurses nachgerechnet.
    uebernimmKurs(stand);
    const t = stand?.teams?.[sitzung.team];
    const perioden = [...(t?.perioden ?? [])].sort((a, b) => a.idx - b.idx);

    // Die ABGESCHLOSSENEN Runden nachspielen, bevor die laufende uebernommen
    // wird. Ohne das landet jeder, der die Seite neu laedt oder spaeter
    // dazukommt, wieder in Runde 1 — mitten im Kurs. Nachgespielt wird mit
    // denselben Schritten wie am Tisch: Werte setzen, Runde schliessen.
    for (const p of perioden.filter(x => x.locked)) {
      if (p.idx !== spiel.runde - 1) continue;      // nur luekenlos vorwaerts
      uebernimmParams(p.params);
      protokoll.push({
        runde: spiel.runde, jahre: spiel.jahre,
        ergebnis: spiel.ergebnis, basis: spiel.basis,
        vorlagen: p.vorlagen ?? {}, schock: spiel.schock,
      });
      spiel.schliesseRunde();
      leereTisch();
    }

    const laufend = perioden.find(p => !p.locked && p.idx === spiel.runde - 1);
    if (laufend?.params) uebernimmParams(laufend.params);

    alles();
  } catch (_) {
    // Kein Stand erreichbar: dann eben mit dem eigenen weiterspielen. Gesendet
    // wird trotzdem nichts — sonst waere genau der Schaden da, den das hier
    // verhindern soll.
  }
}

/**
 * Den Kurs der Sitzung uebernehmen: Runden, Laengen, Ereignisse, Werkzeuge,
 * Ressorts und Quorum. Die Lehrperson legt sie fest, nicht diese Flaeche.
 */
function uebernimmKurs(stand) {
  if (!stand) return;
  quorum = stand.quorum ?? quorum;
  RESSORTS = ressortsIm(kursAus(stand));
  spiel.setzeKurs(kursAus(stand));
}

/**
 * Die Werte der ANDEREN Ressorts aus ihren Vorlagen uebernehmen.
 *
 * Online bearbeitet jedes Geraet nur sein eigenes Ressort. Bis 24.09.2026
 * kannte es von den anderen nur die Vorlage, nicht deren Werte: jedes Geraet
 * zeigte eine andere Lage, und wer die Runde schloss, meldete der Lehrperson
 * nur die eigenen Beschluesse. Jetzt gilt am Tisch, was eingebracht oder
 * angenommen ist; eine abgelehnte oder zurueckgezogene Vorlage faellt auf
 * den Rundenstart zurueck.
 */
function uebernimmFremdeWerte() {
  if (!sitzung.team || !meinRessort) return;
  for (const r of RESSORTS) {
    if (r.id === meinRessort) continue;
    const v = tisch[r.id].vorlage;
    const gilt = v && ['eingebracht', 'angenommen'].includes(v.stand);
    for (const s of r.stell) {
      const soll = gilt && v.aenderungen?.[s.key] !== undefined
        ? v.aenderungen[s.key].nach : spiel.startwerte[s.key];
      if (soll !== undefined && spiel.params[s.key] !== soll) spiel.setze(s.key, soll);
    }
  }
}

/** Nach einem Rundenschluss: der Tisch ist leer, die Plaetze bleiben besetzt. */
function leereTisch() {
  for (const r of ALLE_RESSORTS) {
    tisch[r.id].vorlage = null;
    tisch[r.id].begruendung = '';   // jede Runde will neu begruendet werden
  }
}

/** Die Stellgroessen einer Periode uebernehmen, ohne die uebrigen anzufassen. */
function uebernimmParams(params) {
  if (!params) return;
  for (const st of ALLE) {
    const wert = params[st.key];
    if (wert !== undefined && wert !== spiel.params[st.key]) spiel.setze(st.key, wert);
  }
}

/** Holt Bahn und Schaukaesten — einmal, und dann wenn sich etwas geaendert hat. */
async function holeSchaukaesten({ erzwingen = false } = {}) {
  if (!sitzung.team) return;
  if (schaukastenGeholt && !erzwingen) return;
  try {
    const stand = await holeSitzung(SITZUNG_ID, { zeitlimit: 6000 });
    // Nach einem Rundenschluss steht hier das Ereignis der NEUEN Runde. Es ist
    // ab jetzt fest: der Server nimmt keine Aenderung mehr an, sobald ein
    // Team die Periode davor abgeschlossen hat.
    uebernimmKurs(stand);
    const t = stand?.teams?.[sitzung.team];
    Object.assign(schaukaesten, t?.schaukaesten ?? {});
    const perioden = (t?.perioden ?? []).filter(p => p.locked);
    teamBahn = spieleNach(perioden, spiel.kurs);
    teamVorlagen = perioden.map(p => p.vorlagen ?? {});
    schaukastenGeholt = true;
    if (ansicht.name === 'ressort') zeichneAnsicht();
  } catch (_) {
    // Der naechste Blick in ein Ressort versucht es wieder.
  }
}

/**
 * Schreibvorgaenge DIESES Geraets laufen nacheinander, nie gleichzeitig.
 *
 * Der Server liest und schreibt bei jedem Aufruf die ganze Sitzung. Zwei
 * gleichzeitige Aufrufe lesen denselben Stand, und der spaetere ueberschreibt
 * den frueheren. Genau so ging am 24.09.2026 im Durchspielen eine Vorlage
 * verloren: Begruendung tippen, direkt "Zur Abstimmung stellen" klicken — das
 * Feld speicherte beim Verlassen die Begruendung, die Vorlage startete in
 * derselben Millisekunde, und die Begruendung gewann.
 *
 * Zwischen verschiedenen Geraeten hilft das nicht; das ist die Grenze des
 * KV-Speichers (ADR 006).
 */
let warteschlange = Promise.resolve();
function nacheinander(auftrag) {
  const lauf = warteschlange.then(auftrag, auftrag);
  warteschlange = lauf.catch(() => {});
  return lauf;
}

/** Was in abgeschlossenen Runden beschlossen wurde. Wächst, wird nie geleert. */
const protokoll = [];

/** Zaehlt aus. Entschieden wird erst, wenn ALLE Ressorts gestimmt haben. */
function werteAus(v) {
  if (!v || v.stand !== 'eingebracht') {
    return { ja: 0, nein: 0, enthaltung: 0, fehlen: [], entschieden: true,
             angenommen: v?.stand === 'angenommen' };
  }
  const ab = Object.values(v.stimmen ?? {});
  const ja = ab.filter(x => x.stimme === 'ja').length;
  const nein = ab.filter(x => x.stimme === 'nein').length;
  const enthaltung = ab.filter(x => x.stimme === 'enthaltung').length;
  const fehlen = RESSORTS.filter(r => !v.stimmen?.[r.id]).map(r => r.id);
  if (fehlen.length) return { ja, nein, enthaltung, fehlen, entschieden: false };
  const angenommen = quorum === 'einstimmig' ? nein === 0
                   : quorum === 'absolut'    ? ja > RESSORTS.length / 2
                   : ja > nein;
  return { ja, nein, enthaltung, fehlen, entschieden: true, angenommen };
}

/** Eine Runde schliesst, wenn jedes Ressort eine angenommene Vorlage hat. */
const erledigt = (r) => tisch[r.id].vorlage?.stand === 'angenommen';
const offeneRessorts = () => RESSORTS.filter(r => !erledigt(r));
const kannSchliessen = () => offeneRessorts().length === 0;

/**
 * Welches Ressort diese Person bearbeiten darf.
 *
 * Online: genau eines — das aus der Aufstellung. Wer an seinem eigenen Geraet
 * sitzt, soll nicht fuer andere eintragen koennen.
 *
 * Am eigenen Geraet ohne Sitzung: alle vier. Dort SIND vier Personen am
 * selben Bildschirm, und ihnen die Bedienung zu sperren waere Schikane.
 */
const meinRessort = bekannt.rolle ?? null;
const darfBearbeiten = (id) => !sitzungAktiv() || meinRessort === null || meinRessort === id;
function sitzungAktiv() { return Boolean(SITZUNG_ID) && hatBackend(); }

// ── Beitritt ───────────────────────────────────────────────────────────────

async function zeigeBeitritt() {
  $('#beitritt').hidden = false;
  $('#spielflaeche').hidden = true;

  if (!ONLINE) {
    $('#beitritt-lage').textContent = SITZUNG_ID
      ? 'Für diese Seite ist keine Sitzungsverwaltung eingerichtet. Der Tisch läuft am '
        + 'eigenen Gerät weiter; die Runden werden nicht an die Lehrperson gemeldet.'
      : 'Kein Kurs-Code in der Adresse. Der Tisch läuft am eigenen Gerät — zum Üben und '
        + 'Vorbereiten vollständig nutzbar, aber ohne Meldung an die Lehrperson.';
    $('#beitritt-form').hidden = true;
    $('#allein').hidden = false;
    return;
  }

  // Schon angemeldet? Dann direkt an den Tisch. Das Formular waere eine
  // Wiederholung, und ein zweiter Beitritt mit derselben Matrikelnummer
  // wuerde ohnehin abgelehnt.
  if (sitzung.team && sitzung.matrikelnummer) { starteTisch(); return; }

  try {
    // Die Antwort liefert { team_names, team_groesse, belegung } — keine
    // fertige Teamliste. Genauso liest es js/planspiel.js seit jeher.
    sitzung.mitglieder = await holeMitglieder(SITZUNG_ID);
    const namen   = sitzung.mitglieder?.team_names ?? [];
    const groesse = sitzung.mitglieder?.team_groesse ?? 0;
    const belegung = sitzung.mitglieder?.belegung ?? {};

    if (namen.length === 0) {
      $('#beitritt-lage').textContent =
        'Diese Sitzung hat noch keine Teams. Frag die Lehrperson — oder spiel so lange '
        + 'am eigenen Gerät.';
      $('#allein').hidden = false;
      return;
    }

    $('#team').innerHTML = namen.map(name => {
      const belegt = belegung[name] ?? 0;
      const voll   = groesse > 0 && belegt >= groesse;
      return `<option value="${name}"${voll ? ' disabled' : ''}>${name} — `
           + `${belegt} von ${groesse} Plätzen${voll ? ', voll' : ''}</option>`;
    }).join('');
    const freie = namen.filter(n => (belegung[n] ?? 0) < groesse).length;
    $('#beitritt-lage').textContent = freie === 0
      ? `Kurs ${SITZUNG_ID} · alle ${namen.length} Teams sind voll. Frag die Lehrperson.`
      : `Kurs ${SITZUNG_ID} · ${namen.length} Teams, ${freie} mit freien Plätzen. `
        + 'Such dir dein Team und trag dich ein.';
    $('#beitritt-form').hidden = false;
    $('#allein').hidden = false;
  } catch (f) {
    $('#beitritt-lage').textContent = f instanceof ServerFehler
      ? `Die Sitzung ist nicht erreichbar: ${f.message} Du kannst am eigenen Gerät weiterspielen.`
      : 'Die Sitzung ist nicht erreichbar. Du kannst am eigenen Gerät weiterspielen.';
    $('#beitritt-form').hidden = true;
    $('#allein').hidden = false;
  }
}

async function beitreten(ev) {
  ev.preventDefault();
  const name = $('#name').value.trim();
  const matrikelnummer = $('#matrikelnummer').value.trim();
  const team = $('#team').value;
  const fehler = $('#beitritt-fehler');
  fehler.hidden = true;

  if (!name) { return zeigeBeitrittsfehler('Bitte trag deinen Namen ein.'); }
  if (matrikelnummer.replace(/\D/g, '').length < 4) {
    return zeigeBeitrittsfehler('Die Matrikelnummer sieht nicht vollständig aus.');
  }

  const knopf = $('#beitreten');
  knopf.disabled = true;
  knopf.textContent = 'Wird eingetragen …';
  try {
    await trittBei(SITZUNG_ID, { name, matrikelnummer, team });
    sitzung.team = team;
    sitzung.person = name;
    sitzung.matrikelnummer = matrikelnummer;
    // Die Person merken, damit die Aufstellung weiss, wer da kommt. Nur Name
    // und Matrikelnummer der EIGENEN Person — siehe js/dienste/speicher.js.
    merke('person', SITZUNG_ID, { name, matrikelnummer, team, rolle: null });
    // Weiter zur Aufstellung: erst das Ressort, dann der Tisch (Flow A).
    location.href = `aufstellung.html?session=${encodeURIComponent(SITZUNG_ID)}`;
  } catch (f) {
    zeigeBeitrittsfehler(f instanceof ServerFehler ? f.message
      : 'Der Beitritt hat nicht geklappt. Prüf die Verbindung und versuch es noch einmal.');
  } finally {
    knopf.disabled = false;
    knopf.textContent = 'Team beitreten';
  }
}

function zeigeBeitrittsfehler(text) {
  const f = $('#beitritt-fehler');
  f.textContent = text;
  f.hidden = false;
  f.focus();
}

function starteTisch() {
  $('#beitritt').hidden = true;
  $('#spielflaeche').hidden = false;
  // Nur online: die anderen drei Tische reihum abfragen. Vier Sekunden sind
  // schnell genug fuer eine Verhandlung und schonen einen Worker, an dem ein
  // ganzer Kurs haengt.
  if (sitzung.team && !sitzung.abfrage) {
    // ZUERST den Stand des Teams uebernehmen, dann erst senden.
    //
    // Andersherum waere es ein Datenverlust: ein zweites Geraet, das sich
    // oeffnet, wuerde seinen eigenen Status quo hochschicken und damit die
    // Werte ueberschreiben, die das erste Geraet schon gesetzt hat. Wer
    // dazukommt, uebernimmt — er diktiert nicht.
    uebernimmTeamstand();
    sitzung.abfrage = setInterval(holeTischstand, 4000);
    addEventListener('pagehide', () => clearInterval(sitzung.abfrage));
  }
  $('#kurslage').textContent = sitzung.team
    ? `Kurs ${SITZUNG_ID} · ${sitzung.team}`
    : 'Am eigenen Gerät — keine Meldung an die Lehrperson';
  $('#kurslage').dataset.online = String(Boolean(sitzung.team));
  alles();
}

// ── Ansichtswechsel ────────────────────────────────────────────────────────
//
// Das Fragment traegt die Ansicht: #tisch · #ressort=fin · #werkbank.
// Dadurch funktionieren Zuruecktaste und Lesezeichen, ohne dass das Dokument
// neu geladen wird — und damit ohne den Spielstand zu verlieren.

let ansicht = { name: 'tisch', ressort: null };

function lesAnsicht() {
  const roh = location.hash.replace(/^#/, '');
  if (roh.startsWith('ressort=')) {
    const id = roh.slice(8);
    if (RESSORTS.some(r => r.id === id)) return { name: 'ressort', ressort: id };
  }
  if (roh === 'abstimmung') return { name: 'abstimmung', ressort: null };
  if (roh === 'protokoll')  return { name: 'protokoll', ressort: null };
  if (roh === 'werkbank' && meinRessort) return { name: 'werkbank', ressort: meinRessort };
  if (roh === 'werkbank') return { name: 'werkbank', ressort: ansicht.ressort ?? RESSORTS[0].id };
  return { name: 'tisch', ressort: null };
}

function geheZu(name, ressort = null) {
  const ziel = name === 'tisch' ? '#tisch'
             : name === 'werkbank' ? '#werkbank'
             : name === 'abstimmung' ? '#abstimmung'
             : name === 'protokoll' ? '#protokoll'
             : `#ressort=${ressort}`;
  if (location.hash !== ziel) location.hash = ziel;
  else zeichneAnsicht();
}

function zeichneAnsicht() {
  ansicht = lesAnsicht();
  for (const name of ['tisch', 'ressort', 'werkbank', 'abstimmung', 'protokoll']) {
    document.getElementById(`ansicht-${name}`).hidden = ansicht.name !== name;
  }
  if (ansicht.name === 'tisch')    zeichneTisch();
  if (ansicht.name === 'ressort')  zeichneRessortansicht(ansicht.ressort);
  if (ansicht.name === 'werkbank') zeichneWerkbank(ansicht.ressort);
  if (ansicht.name === 'abstimmung') zeichneAbstimmung();
  if (ansicht.name === 'protokoll')  zeichneProtokollansicht();
  zeichneMitte();
  document.getElementById('ansicht-' + ansicht.name)
    .querySelector('h2, h1')?.focus?.();
}

addEventListener('hashchange', zeichneAnsicht);

// ── B0 · Der Tisch ─────────────────────────────────────────────────────────
//
// Drei Zahlen je Ressort, nicht dreizehn. Was hier steht, beantwortet genau
// eine Frage: muss ich handeln? Alles Weitere liegt einen Klick tiefer.

function stand(r) {
  const v = tisch[r.id].vorlage;
  if (!v || v.stand === 'zurueckgezogen') {
    const bewegt = r.stell.filter(s => spiel.bewegt(s.key)).length;
    return { klasse: 'entwurf',
             text: bewegt ? `${bewegt} Änderung${bewegt === 1 ? '' : 'en'} im Entwurf`
                          : 'noch nichts eingebracht' };
  }
  if (v.stand === 'angenommen') return { klasse: 'angenommen', text: 'angenommen' };
  if (v.stand === 'abgelehnt')  return { klasse: 'abgelehnt',
    text: `abgelehnt — Fassung ${v.fassung} überarbeiten` };
  const a = werteAus(v);
  return { klasse: 'abstimmung',
           text: `zur Abstimmung · ${a.ja} ja, ${a.nein} nein`
               + (a.fehlen.length ? ` · fehlen ${a.fehlen.length}` : '') };
}

/** Das Ereignis der laufenden Runde — ein Zettel ueber den Mappen. */
function zeichneEreignis() {
  const s = spiel.schock, feld = $('#ereignis');
  if (!s) { feld.hidden = true; return; }
  const w = schockWirkung(s);
  const nicht = w.filter(x => !x.wirkt);
  feld.hidden = false;
  feld.innerHTML = `
    <p class="ek">Ereignis · Sitzung ${spiel.runde}</p>
    <h2>${s.name}</h2>
    <p class="eb">${s.beschreibung}</p>
    <p class="ew">${w.filter(x => x.wirkt).map(x => x.text).join(' · ')}</p>
    ${nicht.length ? `<p class="en">Im Modell nicht gerechnet: ${nicht.map(x => x.text).join(' · ')}</p>` : ''}
    <p class="en">Steckt in allen Zahlen, auch in „ohne Beschluss“ — die Veränderungen
       zeigen nur, was ihr beschließt. Quelle: ${s.quelle}</p>`;
}

function zeichneTisch() {
  zeichneEreignis();
  $('#tisch').innerHTML = RESSORTS.map(r => {
    const k  = KENNZAHLEN.find(x => x.id === r.kennzahl);
    const t  = diffText(k, spiel.ergebnis, spiel.basis);
    const st = stand(r);
    const meins   = meinRessort === r.id;
    const bewegte = r.stell.filter(s => spiel.bewegt(s.key));
    return `
    <article class="mappe m-${r.id}" id="m-${r.id}" data-stand="${st.klasse}"
             data-meins="${meins}" aria-labelledby="h-${r.id}">
      <p class="reiter">${r.kurz}${meins ? ' · dein Ressort' : ''}</p>
      <h2 id="h-${r.id}">${r.name}</h2>

      <p class="wacht" data-richtung="${t.richtung}">
        <span>wacht über <b>${k.name}</b></span>
        <span class="w">${zahl(k.lies(spiel.ergebnis), k.n)}${k.einheit ? `<em> ${k.einheit}</em>` : ''}</span>
        <span class="d">${t.text}</span></p>

      <p class="kurzlage">${bewegte.length === 0
        ? 'Nichts geändert in dieser Runde.'
        : `${anzahlText(bewegte.length)} geändert${tisch[r.id].begruendung ? '' : ' · noch ohne Begründung'}`}</p>

      <p class="stand" id="st-${r.id}">${st.text}</p>

      <div class="knoepfe">
        <button type="button" class="blick" data-ressort="${r.id}">Ansehen</button>
        ${darfBearbeiten(r.id)
          ? `<button type="button" class="werkbank-auf" data-ressort="${r.id}">Bearbeiten</button>`
          : ''}
      </div>
    </article>`;
  }).join('');

  for (const r of RESSORTS) {
    $(`.blick[data-ressort="${r.id}"]`).addEventListener('click', () => geheZu('ressort', r.id));
    $(`.werkbank-auf[data-ressort="${r.id}"]`)
      ?.addEventListener('click', () => geheZu('werkbank', r.id));

  }
}

const anzahlText = (n) => `${n} Stellgröße${n === 1 ? '' : 'n'}`;

// ── B3 · Das Rundenprotokoll ───────────────────────────────────────────────
//
// Wer wie gestimmt hat, bleibt nachlesbar. Das ist kein Beiwerk: im
// Debriefing ist die Frage "warum habt ihr das damals so entschieden?" die
// eigentliche, und ohne Protokoll beantwortet sie niemand ehrlich.

function zeichneProtokollansicht() {
  $('#protokoll-liste').innerHTML = protokoll.length === 0
    ? '<p class="leer">Noch keine Runde abgeschlossen.</p>'
    : protokoll.slice().reverse().map(p => `
      <article class="runde">
        <h3>Sitzung ${p.runde} <span class="jahre">${p.jahre.text}</span></h3>
        ${p.schock ? `<p class="pe">Ereignis: ${p.schock.name}</p>` : ''}
        <div class="runde-lage">
          ${KENNZAHLEN.map(k => {
            const t = diffText(k, p.ergebnis, p.basis);
            return `<span class="rk" data-richtung="${t.richtung}">
              <b>${k.kurz}</b> ${zahl(k.lies(p.ergebnis), k.n)}
              <em>${t.text}</em></span>`;
          }).join('')}
        </div>
        ${RESSORTS.map(r => {
          const v = p.vorlagen[r.id];
          if (!v) return `<div class="pv"><p class="pk">${r.kurz}</p>
            <p class="leer">nichts eingebracht</p></div>`;
          const zeilen = Object.entries(v.aenderungen ?? {}).map(([key, w]) => {
            const st = ALLE.find(x => x.key === key);
            return st ? `${st.bez} ${wertText(st, w.von)} → ${wertText(st, w.nach)} ${st.einheit}` : '';
          }).filter(Boolean).join(' · ');
          return `<div class="pv" data-stand="${v.stand}">
            <p class="pk">${r.kurz}<span class="pf">Fassung ${v.fassung}</span></p>
            <p class="pa">${zeilen || 'keine Änderung'}</p>
            <p class="pb">${(v.begruendung || '').replace(/</g, '&lt;')}</p>
            <p class="ps">${RESSORTS.map(x => {
              const st = v.stimmen?.[x.id];
              return `<span data-wert="${st?.stimme ?? 'offen'}">${x.kurz}: ${
                st ? STIMM_TEXT[st.stimme] : '—'}</span>`;
            }).join('')}</p></div>`;
        }).join('')}
      </article>`).join('');
}

// ── B1 · Ressortansicht ────────────────────────────────────────────────────

function zeichneRessortansicht(id) {
  const r = RESSORTS.find(x => x.id === id);
  const k = KENNZAHLEN.find(x => x.id === r.kennzahl);
  const t = diffText(k, spiel.ergebnis, spiel.basis);
  const bewegte = r.stell.filter(s => spiel.bewegt(s.key));
  const meins = meinRessort === r.id;

  $('#ressort-kopf').innerHTML = `
    <p class="reiter r-${r.id}">${r.kurz}</p>
    <h2 id="ressort-titel" tabindex="-1">${r.name}</h2>
    <p class="unter">wacht über ${k.name} · ${zahl(k.lies(spiel.ergebnis), k.n)}
       ${k.einheit} <span data-richtung="${t.richtung}">${t.text}</span></p>`;

  $('#vorlage').innerHTML = bewegte.length === 0
    ? '<p class="leer">Dieses Ressort hat in der laufenden Runde nichts geändert.</p>'
    : `<table><thead><tr><th class="l">Stellgröße</th><th>vorher</th><th>jetzt</th>
         <th>Veränderung</th></tr></thead><tbody>` +
      bewegte.map(s => {
        const von = spiel.startwerte[s.key], nach = spiel.params[s.key];
        const mass = s.klappe ? '—'
          : s.einheit === '%' ? punkteText(von, nach, s.nk)
          : `${mitVz(rund(nach, s.nk) - rund(von, s.nk), s.nk)} ${s.einheit}`;
        return `<tr><td class="l">${s.bez}</td>
          <td class="b">${wertText(s, von)}</td>
          <td class="b jetzt">${wertText(s, nach)}</td>
          <td class="b">${mass}</td></tr>`;
      }).join('') + '</tbody></table>';

  const text = tisch[r.id].begruendung;
  $('#begruendung-anzeige').innerHTML = text
    ? `<blockquote>${text.replace(/</g, '&lt;')}</blockquote>`
    : `<p class="leer">${meins ? 'Du hast noch nicht aufgeschrieben, warum.'
                               : 'Dieses Ressort hat noch nicht aufgeschrieben, warum.'}</p>`;

  $('#wirkung').innerHTML = KENNZAHLEN.map(kz => {
    const d = diffText(kz, spiel.ergebnis, spiel.basis);
    return `<div class="kz" data-richtung="${d.richtung}">
      <p class="n">${kz.name}</p>
      <p class="v">${zahl(kz.lies(spiel.ergebnis), kz.n)}${kz.einheit ? `<em> ${kz.einheit}</em>` : ''}</p>
      <p class="d">${d.text}</p>${kurve(kz)}</div>`;
  }).join('');
  // Die Ehrlichkeitsauskunft bleibt — nur kuerzer. Hier wird nicht zugerechnet.
  $('#wirkung-hinweis').innerHTML = `${VERLAUF_LEGENDE}<br>Die Lage des ganzen Haushalts `
    + 'nach allen Beschlüssen — nicht der Beitrag dieses Ressorts.';

  $('#zur-werkbank').hidden = !darfBearbeiten(r.id);
  $('#zur-werkbank').onclick = () => geheZu('werkbank', r.id);
  // B1b · Der Schaukasten: was DIESE Person selbst zusammengestellt hat.
  // Beim ersten Blick in ein Ressort vom Server holen — genau dann wird er
  // gebraucht, und genau dann ist die Wartezeit unauffaellig.
  if (!schaukastenGeholt) holeSchaukaesten();
  const stuecke = schaukaesten[r.id] ?? [];
  const bahn = teamBahn.length ? teamBahn : spieleNach(protokoll.map(x => ({
    idx: x.runde - 1,
    params: spiel.verlauf.find(v => v.runde === x.runde)?.params ?? {},
  })), spiel.kurs);
  $('#schaukasten').innerHTML = stuecke.length === 0
    ? `<p class="leer">${meins ? 'Noch nichts zusammengestellt.'
        : 'Dieses Ressort hat noch nichts zusammengestellt.'}</p>`
      + (meins ? `<p><a class="leiser-link" href="auswertung.html${
          SITZUNG_ID ? `?session=${encodeURIComponent(SITZUNG_ID)}` : ''
        }">Zum Diagrammbaukasten</a></p>` : '')
    : zeichneSchaukasten(stuecke, bahn, {
        ressort: r.id, kurs: spiel.kurs,
        vorlagen: teamVorlagen.length ? teamVorlagen : protokoll.map(x => x.vorlagen ?? {}),
      });
}

// ── B2 · Die Abstimmung ────────────────────────────────────────────────────

const STIMM_TEXT = { ja: 'Zustimmung', nein: 'Ablehnung', enthaltung: 'Enthaltung' };

function zeichneAbstimmung() {
  $('#quorum-text').textContent = `Angenommen ist eine Vorlage bei ${QUORUM_TEXT[quorum]}. `
    + `Ausgezählt wird erst, wenn alle ${RESSORTS.length} gestimmt haben.`;

  const offene = RESSORTS.filter(r => tisch[r.id].vorlage
    && ['eingebracht', 'angenommen', 'abgelehnt'].includes(tisch[r.id].vorlage.stand));

  // Was jede Vorlage fuer sich bewirkte. Die Skala je Kennzahl ist ueber
  // ALLE Vorlagen geteilt — nur so ist "diese bewegt den Saldo mehr als jene"
  // am Bild ablesbar. Zwischen Kennzahlen gibt es keine gemeinsame Skala.
  const allein = Object.fromEntries(offene.map(r => {
    const e = spiel.probe(tisch[r.id].vorlage.aenderungen);
    return [r.id, KENNZAHLEN.map(k => ({ k, ...diffText(k, e, spiel.basis) }))];
  }));
  const rand = Object.fromEntries(KENNZAHLEN.map((k, i) => [k.id,
    Math.max(0, ...Object.values(allein).map(z => Math.abs(z[i].d)))]));
  $('#allein-hinweis').hidden = !offene.some(r =>
    Object.keys(tisch[r.id].vorlage.aenderungen ?? {}).length);

  $('#abstimmung-liste').innerHTML = offene.length === 0
    ? '<p class="leer">Noch ist nichts eingebracht.</p>'
    : offene.map(r => {
        const v = tisch[r.id].vorlage, a = werteAus(v);
        const meine = meinRessort ? v.stimmen?.[meinRessort] : null;
        const zeilen = Object.entries(v.aenderungen ?? {}).map(([key, w]) => {
          const st = ALLE.find(x => x.key === key);
          if (!st) return '';
          return `<li>${st.bez}: <b>${wertText(st, w.von)} → ${wertText(st, w.nach)}</b>
                  ${st.einheit}</li>`;
        }).join('');
        return `
        <article class="vorlage v-${r.id}" data-stand="${v.stand}">
          <header>
            <p class="reiter r-${r.id}">${r.kurz}</p>
            <h3>${r.name}<span class="fassung">Fassung ${v.fassung}</span></h3>
            <p class="von">eingebracht von ${v.eingebracht_von || r.kurz}</p>
          </header>
          ${zeilen ? `<ul class="aenderungen">${zeilen}</ul>
            <div class="allein" role="group" aria-label="Diese Vorlage für sich allein gerechnet">
              <p class="ak">Für sich allein</p>
              ${allein[r.id].map(z => `<p class="az" data-richtung="${z.richtung}">
                <span class="n">${z.k.kurz}</span>
                ${wirkungsbalken(z.d, rand[z.k.id], z.richtung)}
                <span class="t">${z.text}</span></p>`).join('')}
            </div>`
                   : '<p class="keine">Keine Änderung — dieses Ressort lässt alles, wie es ist.</p>'}
          <blockquote>${(v.begruendung || '').replace(/</g, '&lt;')}</blockquote>
          <div class="auszaehlung">
            ${RESSORTS.map(x => {
              const st = v.stimmen?.[x.id];
              return `<span class="stimme" data-wert="${st?.stimme ?? 'offen'}">
                <b>${x.kurz}</b> ${st ? STIMM_TEXT[st.stimme] : 'offen'}</span>`;
            }).join('')}
          </div>
          ${a.entschieden
            ? `<p class="ergebnis" data-an="${v.stand === 'angenommen'}">${
                v.stand === 'angenommen' ? 'Angenommen.' : 'Abgelehnt — überarbeiten und neu einbringen.'}</p>`
            : `<p class="ergebnis" data-an="offen">Es fehlen noch ${a.fehlen.length} Stimme${
                a.fehlen.length === 1 ? '' : 'n'}.</p>`}
          ${v.stand === 'eingebracht' && darfStimmen()
            ? `<div class="stimmknoepfe" data-ressort="${r.id}">
                 ${['ja', 'nein', 'enthaltung'].map(w => `
                   <button type="button" data-stimme="${w}"
                     aria-pressed="${meine?.stimme === w}">${STIMM_TEXT[w]}</button>`).join('')}
               </div>
               ${meine ? `<p class="meine">Du hast mit „${STIMM_TEXT[meine.stimme]}“ gestimmt — änderbar, bis alle gestimmt haben.</p>` : ''}`
            : ''}
          ${v.stand === 'eingebracht' && meinRessort === r.id
            ? `<p><button type="button" class="zurueckziehen" data-ressort="${r.id}">Vorlage zurückziehen</button></p>`
            : ''}
        </article>`;
      }).join('');

  for (const knopf of document.querySelectorAll('.stimmknoepfe button')) {
    knopf.addEventListener('click', () =>
      gibStimme(knopf.closest('.stimmknoepfe').dataset.ressort, knopf.dataset.stimme));
  }
  for (const knopf of document.querySelectorAll('.zurueckziehen')) {
    knopf.addEventListener('click', () => ziehZurueck(knopf.dataset.ressort));
  }
}

/**
 * Wer darf stimmen?
 *
 * Online braucht es ein Ressort — ohne Rolle keine Stimme. Am eigenen Geraet
 * sitzen vier Personen davor; dort stimmt jede der Reihe nach ab, und die
 * Flaeche fragt nicht nach, wer gerade tippt.
 */
const darfStimmen = () => !sitzungAktiv() || Boolean(meinRessort);

async function gibStimme(ressort, stimme) {
  const v = tisch[ressort]?.vorlage;
  if (!v || v.stand !== 'eingebracht') return;

  // Am eigenen Geraet gilt die Reihenfolge: wer noch nicht gestimmt hat, ist dran.
  const rolle = meinRessort ?? (RESSORTS.find(r => !v.stimmen?.[r.id])?.id);
  if (!rolle) { zeigeMeldung('Alle Ressorts haben schon gestimmt.', 'schlecht'); return; }

  if (!sitzung.team) {
    v.stimmen = { ...(v.stimmen ?? {}),
      [rolle]: { stimme, person: tisch[rolle].sitz || rolle, at: new Date().toISOString() } };
    const a = werteAus(v);
    if (a.entschieden) v.stand = a.angenommen ? 'angenommen' : 'abgelehnt';
    zeichneAnsicht();
    return;
  }
  try {
    const antwort = await nacheinander(() => stimmeUeberVorlage(
      SITZUNG_ID, sitzung.team, spiel.runde - 1, ressort,
      { rolle, stimme, person: sitzung.person ?? tisch[rolle].sitz ?? rolle }));
    tisch[ressort].vorlage = antwort.vorlage;
    zeigeMeldung(null);
    zeichneAnsicht();
  } catch (f) {
    zeigeMeldung(f instanceof ServerFehler ? f.message : 'Die Stimme kam nicht durch.', 'schlecht');
  }
}

async function ziehZurueck(ressort) {
  if (!sitzung.team) { tisch[ressort].vorlage = null; zeichneAnsicht(); return; }
  try {
    await nacheinander(() => ziehVorlageZurueck(SITZUNG_ID, sitzung.team, spiel.runde - 1, ressort));
    tisch[ressort].vorlage = null;
    zeichneAnsicht();
  } catch (f) {
    zeigeMeldung(f instanceof ServerFehler ? f.message : 'Das Zurückziehen hat nicht geklappt.',
                 'schlecht');
  }
}

/** Die Aenderungen dieses Ressorts in der Form, die eine Vorlage traegt. */
function aenderungenVon(r) {
  return Object.fromEntries(r.stell.filter(s => spiel.bewegt(s.key))
    .map(s => [s.key, { von: spiel.startwerte[s.key], nach: spiel.params[s.key] }]));
}

async function bringEin(ressortId) {
  const r = RESSORTS.find(x => x.id === ressortId);
  const text = $('#begruendung').value.trim();
  if (!text) {
    zeigeMeldung('Eine Vorlage braucht eine Begründung — auch wenn nichts geändert wird.',
                 'schlecht');
    $('#begruendung').focus();
    return;
  }
  tisch[r.id].begruendung = text;
  const person = tisch[r.id].sitz || sitzung.person || r.kurz;
  const aenderungen = aenderungenVon(r);

  if (!sitzung.team) {
    const alt = tisch[r.id].vorlage;
    tisch[r.id].vorlage = {
      ressort: r.id, fassung: (alt?.fassung ?? 0) + 1, stand: 'eingebracht',
      aenderungen, begruendung: text, eingebracht_von: person,
      eingebracht_am: new Date().toISOString(),
      stimmen: { [r.id]: { stimme: 'ja', person, at: new Date().toISOString() } },
    };
    geheZu('abstimmung');
    return;
  }
  try {
    const antwort = await nacheinander(() => bringeVorlageEin(SITZUNG_ID, sitzung.team,
      spiel.runde - 1, { ressort: r.id, aenderungen, begruendung: text, person }));
    tisch[r.id].vorlage = antwort.vorlage;
    zeigeMeldung(null);
    geheZu('abstimmung');
  } catch (f) {
    zeigeMeldung(f instanceof ServerFehler ? f.message : 'Die Vorlage kam nicht durch.', 'schlecht');
  }
}

function zeigeMeldung(text, art = 'gut') {
  const m = $('#meldung');
  if (!text) { m.hidden = true; return; }
  m.textContent = text;
  m.dataset.art = art;
  m.hidden = false;
}

/** Den Stand der anderen Geraete uebernehmen — Vorlagen und Stimmen. */
async function holeTischstand() {
  if (!sitzung.team) return;
  try {
    const antwort = await holeVorlagen(SITZUNG_ID, sitzung.team, spiel.runde - 1);
    quorum = antwort.quorum ?? quorum;
    if (antwort.locked) {
      // Ein anderes Geraet hat die Runde geschlossen. Nachziehen — mit den
      // Werten, die es gemeldet hat, nicht mit den eigenen.
      const vorher = spiel.runde;
      await uebernimmTeamstand();
      if (spiel.runde > vorher) {
        zeigeMeldung(`Sitzung ${vorher} ist geschlossen. Weiter geht es mit Sitzung ${spiel.runde}.`);
        geheZu('tisch');
      }
      return;
    }
    let geaendert = false;
    for (const r of RESSORTS) {
      const neu = antwort.vorlagen?.[r.id] ?? null;
      const altStand = JSON.stringify(tisch[r.id].vorlage ?? null);
      if (JSON.stringify(neu) !== altStand) geaendert = true;
      tisch[r.id].vorlage = neu;
      if (neu?.begruendung) tisch[r.id].begruendung = neu.begruendung;
    }
    uebernimmFremdeWerte();
    const tippt = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (geaendert && !tippt) zeichneAnsicht();
  } catch (_) {
    // Ein verpasster Abgleich ist kein Fehler — der naechste kommt gleich.
  }
}

// ── B1a · Die Werkbank ─────────────────────────────────────────────────────
//
// Hier DARF es ausführlich sein. Geöffnet ist nur, was bewegt wurde; der Rest
// zeigt eine Kurzfassung. Das ist Regel 3 aus Abschnitt 7 des Plans.

function feldFuer(s) {
  const v = spiel.params[s.key];
  return s.klappe
    ? `<button type="button" class="klappe" id="e-${s.key}" aria-labelledby="l-${s.key} e-${s.key}"
         aria-pressed="${v ? 'true' : 'false'}">${v ? 'ja' : 'nein'}</button>`
    : `<input type="text" class="feld" id="e-${s.key}" value="${wertText(s, v)}"
         inputmode="decimal" autocomplete="off" spellcheck="false"
         aria-labelledby="l-${s.key}" aria-describedby="fehl-${s.key}">`;
}

function zeichneWerkbank(id) {
  const r = RESSORTS.find(x => x.id === id);
  if (!darfBearbeiten(r.id)) { geheZu('ressort', r.id); return; }

  $('#werkbank-kopf').innerHTML = `
    <p class="reiter r-${r.id}">${r.kurz}</p>
    <h2 id="werkbank-titel" tabindex="-1">Werkbank — ${r.name}</h2>
    <p class="unter">Verbindlich wird es erst, wenn die Vorlage angenommen ist.</p>`;

  // Was die Lehrperson fuer diese Runde noch nicht freigegeben hat, bleibt
  // SICHTBAR — zugeklappt, mit "ab Runde n". Wer es nicht saehe, wuesste
  // nicht, dass es spaeter mehr gibt.
  const offen    = r.stell.filter(s => istOffen(s, spiel.runde, spiel.kurs));
  const gesperrt = WERKZEUGE.filter(w => w.ressort === r.id
    && !istOffen(w.id, spiel.runde, spiel.kurs));

  const bewegte = r.stell.filter(s => spiel.bewegt(s.key));
  $('#stellgroessen').innerHTML = offen.map(s => {
    const offen = spiel.bewegt(s.key);
    const q = QUELLEN[s.quelle];
    return `
    <details class="stell" id="p-${s.key}" ${offen ? 'open' : ''}
             data-bewegt="${offen}">
      <summary>
        <span class="n" id="l-${s.key}">${s.bez}</span>
        <span class="kurz">${wertText(s, spiel.params[s.key])} ${s.einheit}${
          offen ? ` · von ${wertText(s, spiel.startwerte[s.key])}` : ' · unverändert'}</span>
      </summary>
      <div class="inhalt">
        <p class="eingabe">${feldFuer(s)}<span class="eh">${s.einheit}</span>
          <span class="bereich">${s.klappe ? 'ja oder nein'
            : `zulässig ${zahl(s.min, s.nk)} bis ${zahl(s.max, s.nk)}`}</span></p>
        <p class="vorwert">Zum Rundenstart: <b>${wertText(s, spiel.startwerte[s.key])} ${s.einheit}</b></p>
        <p class="fehl" id="fehl-${s.key}" role="status" hidden></p>
        ${q ? `<details class="quelle"><summary>Woher kommt das?</summary>
          <p class="formel">${q.formel}</p><p class="ref">${q.ref}</p>
          ${q.note ? `<p class="note">${q.note}</p>` : ''}</details>` : ''}
      </div>
    </details>`;
  }).join('') + gesperrt.map(w => {
    const ab = abRunde(w.id, spiel.kurs);
    return `
    <details class="stell gesperrt">
      <summary><span class="n">${w.name}</span>
        <span class="kurz">${ab ? `ab Runde ${ab}` : 'in diesem Kurs nicht frei'}</span></summary>
      <div class="inhalt">${w.stell.map(s => `<p class="vorwert">${s.bez}:
        <b>${wertText(s, spiel.params[s.key])} ${s.einheit}</b></p>`).join('')}
        <p class="vorwert">Bleibt${ab ? ' bis dahin' : ''}, wie es ist.</p></div>
    </details>`;
  }).join('');

  $('#werkbank-zahl').textContent = bewegte.length === 0
    ? 'Noch nichts geändert' : `${anzahlText(bewegte.length)} geändert`;

  $('#begruendung').value = tisch[r.id].begruendung;
  $('#begruendung').dataset.ressort = r.id;

  bindeAlle(spiel, offen, knoten);
  zeichneWirkungsleiste();
  $('#zum-tisch').onclick = () => geheZu('tisch');

  const v = tisch[r.id].vorlage;
  const knopf = $('#einbringen');
  knopf.disabled = v?.stand === 'angenommen';
  knopf.textContent = v?.stand === 'angenommen' ? 'Angenommen — nichts mehr zu tun'
    : v?.stand === 'abgelehnt' ? `Fassung ${v.fassung + 1} zur Abstimmung stellen`
    : v?.stand === 'eingebracht' ? 'Überarbeitet neu einbringen'
    : 'Zur Abstimmung stellen';
  knopf.onclick = () => bringEin(r.id);
  $('#einbringen-hinweis').textContent = v?.stand === 'abgelehnt'
    ? 'Die letzte Fassung wurde abgelehnt. Was änderst du?' : '';
}

/** Die schmale Leiste am Fuß der Werkbank — was sich gerade ändert. */
function zeichneWirkungsleiste() {
  $('#wirkungsleiste').innerHTML = KENNZAHLEN.map(k => {
    const t = diffText(k, spiel.ergebnis, spiel.basis);
    return `<div class="wl" data-richtung="${t.richtung}">
      <span class="n">${k.kurz}</span>
      <span class="v">${zahl(k.lies(spiel.ergebnis), k.n)}</span>
      <span class="d">${t.text}</span>${kurve(k)}</div>`;
  }).join('');
}

/** Die Verlaufspunkte einer Kennzahl: gespielte Runden, dann die laufende. */
function verlaufVon(k) {
  return spiel.verlauf.map(v => ({ name: `Runde ${v.runde}`, wert: k.lies(v.ergebnis) }))
    .concat({ name: `Runde ${spiel.runde}`, wert: k.lies(spiel.ergebnis) });
}

/** Verlauf samt Hantel "ohne Beschluss → jetzt" fuer die laufende Runde. */
const kurve = (k) => verlaufskurve(k, verlaufVon(k), k.lies(spiel.basis));

async function sichereBegruendung() {
  const feld = $('#begruendung');
  const id   = feld.dataset.ressort;
  if (!id) return;
  const text = feld.value.trim();
  if (text === tisch[id].begruendung) return;   // nichts Neues, nichts zu senden
  tisch[id].begruendung = text;
  if (!sitzung.team) return;
  try {
    await nacheinander(() => setzeBegruendung(SITZUNG_ID, sitzung.team, spiel.runde - 1,
                                              { ressort: id, text }));
    zeigeMeldung(null);
  } catch (f) {
    zeigeMeldung(f instanceof ServerFehler
      ? `Die Begründung kam nicht durch: ${f.message}`
      : 'Die Begründung kam nicht durch.', 'schlecht');
  }
}

// ── Das gemeinsame Blatt ───────────────────────────────────────────────────

function zeichneMitte() {
  const e = spiel.ergebnis, b = spiel.basis;

  $('#bilanz').innerHTML = KENNZAHLEN.concat(NEBENWERTE.slice(0, 2)).map(k => {
    const t = diffText(k, e, b);
    return `<div class="kz" data-richtung="${t.richtung}">
      <p class="n">${k.name}</p>
      <p class="v">${zahl(k.lies(e), k.n)}${k.einheit ? `<em> ${k.einheit}</em>` : ''}</p>
      <p class="d">${t.text}</p>${KENNZAHLEN.includes(k) ? kurve(k) : ''}</div>`;
  }).join('');
  $('#bilanz-legende').innerHTML = VERLAUF_LEGENDE;

  const fehlend = Math.round(e.schuldenbremse_luecke ?? 0);
  const o = offeneRessorts(), teile = [];
  const abgelehnt = o.filter(r => tisch[r.id].vorlage?.stand === 'abgelehnt');
  if (o.length === 0) {
    teile.push(`<b>Alle ${RESSORTS.length} Vorlagen sind angenommen.</b> Die Sitzung kann geschlossen werden.`);
  } else if (abgelehnt.length) {
    teile.push(`<b>Abgelehnt: ${abgelehnt.map(r => r.kurz).join(', ')}.</b> Diese Ressorts
      überarbeiten und bringen neu ein.`);
  } else {
    teile.push(`Es fehlen noch angenommene Vorlagen von
      <b>${o.map(r => r.kurz).join(', ')}</b>.`);
  }
  teile.push(e.schuldenbremse_ok
    ? `Die Schuldenbremse ist eingehalten (strukturell ${zahl(e.struktureller_saldo_pct, 2)} % des BIP).`
    : `Die Schuldenbremse ist gerissen: strukturell ${zahl(e.struktureller_saldo_pct, 2)} % des BIP statt
       höchstens −0,70 % (Verteidigung über 1 % und Sondervermögen ausgenommen). Zum Schließen der Lücke fehlen rund <b>${zahl(fehlend)} Milliarden</b>.
       Die Sitzung kann trotzdem geschlossen werden — der Fehlbetrag wandert dann weiter.`);
  $('#streit').innerHTML = teile.join(' ');
  $('#streit').dataset.ok = String(kannSchliessen());

  $('#unterschriften').innerHTML = RESSORTS.map(r => {
    const v = tisch[r.id].vorlage;
    const zeichen = v?.stand === 'angenommen' ? '✓'
                  : v?.stand === 'abgelehnt'  ? '✗'
                  : v?.stand === 'eingebracht' ? '…' : '';
    return `<div class="us" data-stand="${stand(r).klasse}">
      <p class="line">${zeichen}</p>
      <p class="l">${r.kurz}</p></div>`;
  }).join('');

  $('#forderungen').innerHTML = spiel.bewegte.length === 0
    ? '<p class="leer">Noch nichts auf dem Tisch.</p>'
    : spiel.bewegte.map(s => {
        const r = RESSORTS.find(x => x.stell.includes(s));
        const von = spiel.startwerte[s.key], nach = spiel.params[s.key];
        const mass = s.klappe ? `${wertText(s, von)} → ${wertText(s, nach)}`
          : s.einheit === '%' ? punkteText(von, nach, s.nk)
          : `${mitVz(rund(nach, s.nk) - rund(von, s.nk), s.nk)} ${s.einheit}`;
        return `<p class="f"><span class="q q-${r.id}">${r.kurz}</span>
          <span class="t">${s.bez}</span><b>${mass}</b></p>`;
      }).join('');

  $('#lage').textContent =
    `Sitzung ${spiel.runde} von ${spiel.runden} · ${spiel.jahre.text} · `
    + `${RESSORTS.length - offeneRessorts().length} von ${RESSORTS.length} Vorlagen angenommen`;

  const knopf = $('#abschluss');
  knopf.disabled = !kannSchliessen() || spiel.letzteRunde;
  knopf.textContent = spiel.letzteRunde ? `Sitzung ${spiel.runde} ist die letzte`
    : kannSchliessen() ? `Sitzung ${spiel.runde} schließen`
    : 'Gesperrt — es fehlen Unterschriften';
  $('#sperre').textContent = spiel.letzteRunde
    ? 'Der Kurs endet nach dieser Sitzung.'
    : kannSchliessen() ? 'Alle Vorlagen sind angenommen.'
    : `Offen: ${o.map(r => r.kurz).join(', ')}.`;

  $('#protokoll').innerHTML = spiel.verlauf.length === 0
    ? '<p class="leer">Noch keine Sitzung protokolliert.</p>'
    : spiel.verlauf.map(v => `<p class="e"><b>Sitzung ${v.runde}</b> · ${v.jahre.text} ·
        Saldo ${zahl(v.ergebnis.saldo, 0)} Mrd. € · Gini ${zahl(v.ergebnis.gini, 3)} ·
        CO₂ ${zahl(v.ergebnis.emissionen, 0)} Mio. t</p>`).join('');

  $('#ende').hidden = !spiel.letzteRunde;
}

// ── Rundenschluss, mit Meldung an die Sitzung ──────────────────────────────

/** Die Perioden in der Form, die die Sitzungsverwaltung erwartet. */
function periodenFuerServer() {
  const abgeschlossen = spiel.verlauf.map(v => ({
    idx: v.runde - 1, locked: true, params: { ...v.params },
  }));
  return [...abgeschlossen,
          { idx: spiel.runde - 1, locked: false, params: { ...spiel.params } }];
}

async function schliesseSitzung() {
  if (!kannSchliessen()) return;
  const knopf = $('#abschluss');
  knopf.disabled = true;

  if (sitzung.team) {
    knopf.textContent = 'Wird gemeldet …';
    try {
      await nacheinander(() => sendeTeamZustand(SITZUNG_ID, sitzung.team, periodenFuerServer()));
      const antwort = await nacheinander(() => stimmeAb(SITZUNG_ID, sitzung.team, spiel.runde - 1));
      zeigeMeldung(antwort.locked
        ? 'An die Lehrperson gemeldet — die Periode ist gesperrt.'
        : `An die Lehrperson gemeldet — ${antwort.votes} Stimme(n) für den Abschluss.`);
    } catch (f) {
      // Der Tisch laeuft weiter: die Runde ist am Tisch entschieden, auch wenn
      // die Meldung nicht durchkam. Verschwiegen wird das aber nicht.
      zeigeMeldung(f instanceof ServerFehler
        ? `Die Meldung an die Lehrperson hat nicht geklappt (${f.message}) `
          + '— am Tisch geht es weiter; sag der Lehrperson Bescheid.'
        : 'Die Meldung an die Lehrperson hat nicht geklappt. Am Tisch geht es weiter.',
        'schlecht');
    }
  }

  // Was beschlossen wurde, wandert ins Protokoll — BEVOR der Tisch geleert
  // wird. Ein Protokoll, das man nachtraeglich rekonstruieren muesste, ist
  // keines.
  protokoll.push({
    runde: spiel.runde,
    jahre: spiel.jahre,
    ergebnis: spiel.ergebnis,
    basis: spiel.basis,
    vorlagen: Object.fromEntries(RESSORTS.map(r => [r.id, tisch[r.id].vorlage])),
    schock: spiel.schock,
  });

  // Fuer die Auswertung ablegen. Am eigenen Geraet gibt es keinen Server, der
  // den Weg liefern koennte — dort ist das hier die einzige Quelle.
  merke('verlauf', SITZUNG_ID ?? 'lokal', {
    team: sitzung.team,
    perioden: protokoll.map(x => ({
      idx: x.runde - 1,
      params: { ...spiel.verlauf.find(v => v.runde === x.runde)?.params },
      vorlagen: x.vorlagen,
    })),
  });

  // Neue Sitzung: der Tisch ist leer, die Plaetze bleiben besetzt.
  spiel.schliesseRunde();
  leereTisch();
  holeSchaukaesten({ erzwingen: true });
  geheZu('tisch');
  zeichneAnsicht();
  bieteWechselAn();
}

// ── Ressorttausch zwischen den Runden ──────────────────────────────────────
//
// Damit jede einmal in jeden Bereich schaut. Der Tausch geht NUR zwischen
// zwei Runden: mitten in einer Runde haengen Unterschrift und Begruendung an
// einem Ressort, das man dann nicht mehr haette.

function bieteWechselAn() {
  const feld = $('#wechsel');
  if (!sitzung.team || !meinRessort || spiel.letzteRunde) { feld.hidden = true; return; }
  feld.hidden = false;
  const jetzt = RESSORTS.find(r => r.id === meinRessort);
  $('#wechsel-text').textContent =
    `Du hattest ${jetzt.kurz}. Vor Runde ${spiel.runde} könnt ihr tauschen.`;
  $('#wechsel-liste').innerHTML = RESSORTS.map(r => `
    <button type="button" class="wechseln r-${r.id}" data-rolle="${r.id}"
      ${r.id === meinRessort ? 'disabled' : ''}>${r.kurz}</button>`).join('');
  for (const r of RESSORTS) {
    $(`.wechseln[data-rolle="${r.id}"]`)?.addEventListener('click', () => wechsleRessort(r.id));
  }
}

async function wechsleRessort(neu) {
  try {
    await waehleRessort(SITZUNG_ID, sitzung.matrikelnummer, neu);
    merke('person', SITZUNG_ID, { ...bekannt, rolle: neu });
    // Die Rolle steckt in einer Konstanten — ein Neuladen ist hier der
    // ehrliche Weg, statt den halben Zustand von Hand nachzuziehen.
    location.reload();
  } catch (f) {
    zeigeMeldung(f instanceof ServerFehler ? f.message : 'Der Tausch hat nicht geklappt.',
                 'schlecht');
  }
}

// ── Zusammensetzen ─────────────────────────────────────────────────────────

function alles() { zeichneAnsicht(); bieteWechselAn(); }

spiel.aufAenderung(({ art, key }) => {
  if (art === 'runde') return;
  // Wer nach dem Einbringen nachbessert, muss neu einbringen — sonst stuende
  // eine Vorlage zur Abstimmung, die nicht mehr das ist, was im Feld steht.
  // Die alte Fassung bleibt gueltig, bis die neue eingebracht wird; der
  // Knopf in der Werkbank sagt dann "Ueberarbeitet neu einbringen".
  // Beim Tippen NICHT neu zeichnen — sonst verliert das Feld den Fokus.
  // Nur die Anzeigen nachziehen, die sich geaendert haben koennen.
  if (ansicht.name === 'werkbank') {
    for (const st of ALLE) {
      const knoten = document.getElementById(`p-${st.key}`);
      if (!knoten) continue;
      const bewegt = spiel.bewegt(st.key);
      knoten.dataset.bewegt = String(bewegt);
      const kurz = knoten.querySelector('.kurz');
      if (kurz) kurz.textContent = `${wertText(st, spiel.params[st.key])} ${st.einheit}`
        + (bewegt ? ` · von ${wertText(st, spiel.startwerte[st.key])}` : ' · unverändert');
    }
    const r = RESSORTS.find(x => x.id === ansicht.ressort);
    const n = r.stell.filter(x => spiel.bewegt(x.key)).length;
    $('#werkbank-zahl').textContent = n === 0 ? 'Noch nichts geändert' : `${anzahlText(n)} geändert`;
    zeichneWirkungsleiste();
  } else {
    zeichneAnsicht();
  }
  zieheKlappenNach(spiel, ALLE, knoten);
  zeichneMitte();
});

$('#quellen-zahl').textContent = `${quellen.length} Fundstellen`;
$('#quellen-liste').innerHTML = quellen.map(q => `
  <li id="q-${q.id}"><p class="nr">${FN[q.id]}</p>
    <div><p class="betrifft">${q.stell.join(' · ')}</p>
      <p class="formel">${q.formel}</p><p class="ref">${q.ref}</p>
      ${q.note ? `<p class="note">${q.note}</p>` : ''}</div></li>`).join('');

$('#abschluss').addEventListener('click', schliesseSitzung);
// Nur `change`: es feuert beim Verlassen des Feldes, wenn sich etwas
// geaendert hat. Ein zusaetzliches `blur` schickte dieselbe Begruendung ein
// zweites Mal — mitten in das Einbringen hinein.
$('#begruendung').addEventListener('change', sichereBegruendung);
$('#beitritt-form').addEventListener('submit', beitreten);
$('#allein-los').addEventListener('click', starteTisch);

zeigeBeitritt();
