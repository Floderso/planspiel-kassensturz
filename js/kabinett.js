// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// KABINETT — Steuerung der Spielflaeche
//
// Uebersetzt zwischen der Versammlung und der Engine. Die Engine
// (js/rechner/, js/data.js) wird ausschliesslich gelesen.
//
// Alle Figuren sind hier von Hand ausgezeichnetes SVG. Keine Rastergrafik,
// kein Fremdmaterial, keine Glyphe als Ersatz fuer eine Zeichnung.
//
// Kein fetch(), kein localStorage — diese Flaeche laeuft vollstaendig lokal.
// ═══════════════════════════════════════════════════════════════════════════

import { berechne, FORMEL_QUELLEN_BERECHNE } from './rechner/berechne.js';
import { FORMEL_QUELLEN_VERT }               from './rechner/verteilung.js';
import { PRESETS, PERIOD_STATE_0 }           from './data.js';

// ── Gesichter ──────────────────────────────────────────────────────────────
//
// Zwei Punktaugen, ein Bogenmund, drei Zustaende. Das Gesicht ist das VIERTE
// Signal neben Vorzeichen, Farbe und Wort — nie das einzige. Es traegt darum
// aria-hidden: wer es nicht sieht, verliert nichts.

const MUND = {
  ruhig:       'M -9 5 Q 0 8 9 5',
  erleichtert: 'M -12 1 Q 0 17 12 1',
  besorgt:     'M -11 10 Q 0 -4 11 10',
  schlaeft:    'M -6 6 q 6 5 12 0',
};

/** Wer schlaeft, hat die Augen zu — zwei Boegen statt zweier Punkte. */
const AUGEN = z => z === 'schlaeft'
  ? `<path d="M -13 -6 q 4 4 8 0 M 5 -6 q 4 4 8 0" fill="none" stroke="var(--tinte)"
           vector-effect="non-scaling-stroke" stroke-width="3" stroke-linecap="round"/>`
  : `<circle cx="-9" cy="-6" r="3.6" fill="var(--tinte)"/>
     <circle cx="9"  cy="-6" r="3.6" fill="var(--tinte)"/>`;

const gesicht = (x, y, zustand, skal = 1) => `
  <g transform="translate(${x} ${y}) scale(${skal})" aria-hidden="true">
    ${AUGEN(zustand)}
    <path d="${MUND[zustand]}" fill="none" stroke="var(--tinte)" vector-effect="non-scaling-stroke"
          stroke-width="3" stroke-linecap="round"/>
  </g>`;

// Eine gerenderte Staerke fuer alles: non-scaling-stroke loest den
// viewBox-Massstab heraus, sonst traegt eine 70er-Figur bei gleicher
// Zahl eine doppelt so schwere Linie wie eine 120er.
const K = 'stroke="var(--tinte)" vector-effect="non-scaling-stroke" stroke-width="3" '
        + 'stroke-linejoin="round" stroke-linecap="round"';

// ── Die vier Wesen des Rates ───────────────────────────────────────────────

const WESEN = {
  // Der Saldo: ein praller Beutel, der sich zusammenzieht, wenn es eng wird
  saldo: (z, f) => `
    <svg viewBox="0 0 120 124" role="img" aria-hidden="true">
      <path d="M46 22 q-4 -12 8 -14 q8 -1 10 6 q2 -7 10 -6 q12 2 8 14"
            fill="${f}" ${K}/>
      <path d="M60 20 q34 0 40 34 q7 40 -18 54 q-22 12 -44 0 q-25 -14 -18 -54 q6 -34 40 -34 z"
            fill="${f}" ${K}/>
      ${gesicht(60, 66, z, 1.15)}
    </svg>`,

  // Die Ungleichheit: zwei Buckel, die auseinanderstreben
  gini: (z, f) => `
    <svg viewBox="0 0 120 124" role="img" aria-hidden="true">
      <path d="M18 100 q-2 -42 24 -44 q16 -1 18 16 q2 -17 18 -16 q26 2 24 44 q-42 10 -84 0 z"
            fill="${f}" ${K}/>
      <path d="M60 72 v28" fill="none" ${K}/>
      ${gesicht(42, 78, z, 0.86)}
      ${gesicht(82, 78, z, 0.86)}
    </svg>`,

  // Die Emissionen: eine Wolke, die schwerer oder leichter wird
  emissionen: (z, f) => `
    <svg viewBox="0 0 120 124" role="img" aria-hidden="true">
      <path d="M32 96 q-20 0 -20 -18 q0 -16 16 -18 q0 -24 24 -24 q18 0 24 16
               q16 -6 24 8 q12 4 10 20 q-2 16 -18 16 z" fill="${f}" ${K}/>
      ${gesicht(58, 70, z, 1.05)}
    </svg>`,

  // Die Wirtschaft: ein stabiler Block auf zwei Beinen
  bip: (z, f) => `
    <svg viewBox="0 0 120 124" role="img" aria-hidden="true">
      <rect x="22" y="26" width="76" height="66" rx="20" fill="${f}" ${K}/>
      <path d="M42 92 v14 M78 92 v14" fill="none" ${K}/>
      <path d="M34 106 h16 M70 106 h16" fill="none" ${K}/>
      ${gesicht(60, 60, z, 1.1)}
    </svg>`,
};

// ── Die vier Ministerfiguren ───────────────────────────────────────────────

const MINISTER = {
  fin: (z, f) => `<svg viewBox="0 0 70 70" role="img" aria-hidden="true">
      <circle cx="35" cy="38" r="26" fill="${f}" ${K}/>
      <path d="M22 16 q13 -8 26 0" fill="none" ${K}/>
      ${gesicht(35, 40, z, 0.82)}</svg>`,
  wir: (z, f) => `<svg viewBox="0 0 70 70" role="img" aria-hidden="true">
      <rect x="10" y="14" width="50" height="48" rx="16" fill="${f}" ${K}/>
      <path d="M35 14 v-8" fill="none" ${K}/><circle cx="35" cy="5" r="4" fill="var(--tinte)"/>
      ${gesicht(35, 40, z, 0.82)}</svg>`,
  soz: (z, f) => `<svg viewBox="0 0 70 70" role="img" aria-hidden="true">
      <path d="M35 62 q-26 -10 -26 -30 q0 -16 14 -16 q9 0 12 10 q3 -10 12 -10 q14 0 14 16 q0 20 -26 30 z"
            fill="${f}" ${K}/>
      ${gesicht(35, 34, z, 0.78)}</svg>`,
  umw: (z, f) => `<svg viewBox="0 0 70 70" role="img" aria-hidden="true">
      <path d="M35 64 v-16" fill="none" ${K}/>
      <path d="M35 48 q-24 -2 -24 -20 q0 -14 24 -14 q24 0 24 14 q0 18 -24 20 z" fill="${f}" ${K}/>
      ${gesicht(35, 30, z, 0.78)}</svg>`,
};

// ── Die Ressorts ───────────────────────────────────────────────────────────

const RESSORTS = [
  { id: 'fin', name: 'Finanzen und Steuern', ab: 1, farbe: 'var(--res-fin)', stell: [
    { key: 'freibetrag', bez: 'Grundfreibetrag',         einheit: '€', min: 0,  max: 30000, nk: 0, quelle: 'arbeitsangebot' },
    { key: 'eingang',    bez: 'Eingangssteuersatz',      einheit: '%', min: 0,  max: 40,    nk: 1, quelle: 'arbeitsangebot' },
    { key: 'spitze',     bez: 'Spitzensteuersatz',       einheit: '%', min: 20, max: 75,    nk: 1, quelle: 'arbeitsangebot' },
    { key: 'mwst',       bez: 'Umsatzsteuer, Regelsatz', einheit: '%', min: 0,  max: 30,    nk: 1, quelle: 'mwst_konsumanteil' },
    { key: 'erb',        bez: 'Erbschaftsteuer',         einheit: '%', min: 0,  max: 60,    nk: 0, quelle: 'erbschaft' },
  ]},
  { id: 'wir', name: 'Wirtschaft und Unternehmen', ab: 2, farbe: 'var(--res-wir)', stell: [
    { key: 'kst',   bez: 'Körperschaftsteuer',     einheit: '%', min: 0, max: 40, nk: 1, quelle: 'dynamisches_scoring' },
    { key: 'gewst', bez: 'Gewerbesteuer-Messzahl', einheit: '%', min: 0, max: 30, nk: 1, quelle: 'dynamisches_scoring' },
  ]},
  { id: 'soz', name: 'Arbeit und Soziales', ab: 3, farbe: 'var(--res-soz)', stell: [
    { key: 'rv', bez: 'Rentenversicherung',  einheit: '%',       min: 10, max: 30,   nk: 1, quelle: 'sv_beitraege' },
    { key: 'kv', bez: 'Krankenversicherung', einheit: '%',       min: 10, max: 25,   nk: 1, quelle: 'sv_beitraege' },
    { key: 'bg', bez: 'Bürgergeld',          einheit: '€/Monat', min: 0,  max: 1500, nk: 0, quelle: 'armutsrisiko' },
    { key: 'kg', bez: 'Kindergeld',          einheit: '€/Monat', min: 0,  max: 1000, nk: 0, quelle: 'armutsrisiko' },
  ]},
  { id: 'umw', name: 'Umwelt und Klima', ab: 4, farbe: 'var(--res-umw)', stell: [
    { key: 'co2',       bez: 'CO₂-Preis',           einheit: '€/t',     min: 0, max: 300, nk: 0, quelle: 'co2_emissionen' },
    { key: 'klimageld', bez: 'Klimageld auszahlen', einheit: 'ja/nein', klappe: true,           quelle: 'co2_emissionen' },
  ]},
];

const ALLE = RESSORTS.flatMap(r => r.stell);
const QUELLEN = { ...FORMEL_QUELLEN_BERECHNE, ...FORMEL_QUELLEN_VERT };
const RUNDE = 1;

// ── Zustand ────────────────────────────────────────────────────────────────

const params = { ...PRESETS.status_quo };
const SQ     = berechne({ ...PRESETS.status_quo }, PERIOD_STATE_0);
let ergebnis = SQ;

// ── Formatierung ───────────────────────────────────────────────────────────

const zahl  = (v, n = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: n, maximumFractionDigits: n });
const mitVz = (v, n = 0) => (v > 0 ? '+' : v < 0 ? '−' : '±') + zahl(Math.abs(v), n);
const rund  = (v, n) => Number(v.toFixed(n));
const anzahl = (n, ein, viele) => `${n} ${n === 1 ? ein : viele}`;
const wertText = (s, v) => s.klappe ? (v ? 'ja' : 'nein') : zahl(v, s.nk ?? 0);

function liesEingabe(text) {
  const roh = String(text).trim().replace(/\./g, '').replace(',', '.');
  if (roh === '') return { leer: true };
  const v = Number(roh);
  return Number.isFinite(v) ? { wert: v } : { ungueltig: true };
}

// ── Der Rat ────────────────────────────────────────────────────────────────
//
// Schwellen kommen aus dem Status quo DIESES Modells, nie aus einer
// Realweltzahl: sonst kann eine Politik nicht gelingen und das Gesicht luegt.

const RAT = [
  { id: 'saldo',      name: 'Haushaltssaldo', einheit: 'Mrd. €', n: 0, farbe: 'var(--res-fin)',
    lies: r => r.saldo,       gut: 'hoch', absolut: true },
  { id: 'gini',       name: 'Ungleichheit',   einheit: '',       n: 3, farbe: 'var(--res-soz)',
    lies: r => r.gini,        gut: 'niedrig' },
  { id: 'emissionen', name: 'Emissionen',     einheit: 'Mio. t', n: 0, farbe: 'var(--res-umw)',
    lies: r => r.emissionen,  gut: 'niedrig' },
  { id: 'bip',        name: 'Wirtschaft',     einheit: 'Mrd. €', n: 0, farbe: 'var(--res-wir)',
    lies: r => r.bip_aktuell, gut: 'hoch' },
];

const abw = k => { const sq = k.lies(SQ); return sq === 0 ? 0 : ((k.lies(ergebnis) - sq) / Math.abs(sq)) * 100; };

function lage(k) {
  const a = abw(k);
  if (Math.abs(a) < 0.05) return { r: 'gleich', mine: 'ruhig', wort: 'wie zum Rundenstart' };
  const besser = k.gut === 'hoch' ? a > 0 : a < 0;
  return besser
    ? { r: 'mehr',   mine: 'erleichtert', wort: (k.gut === 'hoch' ? 'höher' : 'niedriger') + ' als zum Start' }
    : { r: 'minder', mine: 'besorgt',     wort: (k.gut === 'hoch' ? 'niedriger' : 'höher') + ' als zum Start' };
}

/**
 * Jedes Ressort wacht ueber genau eine Kennzahl — dieselbe, deren Farbe es
 * traegt. Ueber alle vier zu mitteln hiesse, dass ab Runde 4 alle Minister
 * dasselbe Gesicht zeigen; dann waeren sie die Dekoration, die die THESIS
 * verbietet.
 */
const RESSORT_KENNZAHL = { fin: 'saldo', wir: 'bip', soz: 'gini', umw: 'emissionen' };

function ressortMine(res) {
  if (res.ab > RUNDE) return 'schlaeft';
  const k = RAT.find(x => x.id === RESSORT_KENNZAHL[res.id]);
  return k ? lage(k).mine : 'ruhig';
}

// ── Die Lage schreibt sich aus dem Modell ──────────────────────────────────

function ausruf() {
  const saldo = ergebnis.saldo, d = rund(saldo, 0) - rund(SQ.saldo, 0), gini = ergebnis.gini - SQ.gini;
  if (d === 0 && Math.abs(gini) < 0.0005) {
    return { kopf: 'Das Kabinett tagt und beschließt nichts',
      text: `Alle ${ALLE.filter(s => RESSORTS.find(r => r.stell.includes(s)).ab <= RUNDE).length} freigegebenen `
          + `Stellgrößen stehen wie zum Rundenstart. Der Haushalt schließt mit `
          + `${zahl(Math.abs(saldo))} Mrd. € ${saldo < 0 ? 'Defizit' : 'Überschuss'}.` };
  }
  const kopf = saldo < 0
    ? `${zahl(Math.abs(saldo))} Milliarden Euro fehlen im Haushalt`
    : `${zahl(saldo)} Milliarden Euro Überschuss im Haushalt`;
  const teile = [d > 0 ? `Das sind ${zahl(d)} Mrd. € besser als zum Rundenstart.`
                       : `Das sind ${zahl(Math.abs(d))} Mrd. € schlechter als zum Rundenstart.`];
  if (Math.abs(gini) >= 0.0005) {
    teile.push(gini < 0 ? `Die Einkommen rücken zusammen; der Gini fällt um ${zahl(Math.abs(gini), 3)}.`
                        : `Die Einkommen spreizen sich; der Gini steigt um ${zahl(gini, 3)}.`);
  }
  const co2 = rund(ergebnis.emissionen, 0) - rund(SQ.emissionen, 0);
  if (co2 !== 0) teile.push(co2 < 0 ? `Die Emissionen sinken um ${zahl(Math.abs(co2))} Mio. t.`
                                    : `Die Emissionen steigen um ${zahl(co2)} Mio. t.`);
  return { kopf, text: teile.join(' ') };
}

// ── Zeichnen ───────────────────────────────────────────────────────────────

const $ = s => document.querySelector(s);

function zeichneRat() {
  $('#rat').innerHTML = RAT.map(k => {
    const l = lage(k);
    const mass = k.absolut ? `${mitVz(rund(k.lies(ergebnis), k.n) - rund(k.lies(SQ), k.n), k.n)} ${k.einheit}`
                           : `${mitVz(abw(k), 1)} %`;
    return `<div class="wesen" id="w-${k.id}">
        ${WESEN[k.id](l.mine, k.farbe)}
        <p class="schild">
          <span class="name">${k.name}</span>
          <span class="wert zahl">${zahl(k.lies(ergebnis), k.n)}${k.einheit ? `<span class="einheit"> ${k.einheit}</span>` : ''}</span>
          <span class="lage" data-richtung="${l.r}"><span class="zahl">${mass}</span> ${l.wort}</span>
        </p>
      </div>`;
  }).join('');
}

function zeichneKabinett() {
  $('#kabinett').innerHTML = RESSORTS.map(res => {
    const schlaeft = res.ab > RUNDE;
    return `<section class="ressort" id="r-${res.id}" data-schlaeft="${schlaeft}" aria-labelledby="h-${res.id}">
      <header>
        ${MINISTER[res.id](schlaeft ? 'schlaeft' : ressortMine(res), res.farbe)}
        <div><h2 id="h-${res.id}">${res.name}</h2>
          <p class="anzahl">${anzahl(res.stell.length, 'Stellgröße', 'Stellgrößen')}</p></div>
      </header>
      ${schlaeft ? `<p class="schlafnotiz">Schläft noch — wacht in Runde ${res.ab} auf.</p>` : ''}
      ${res.stell.map(s => zeile(s, schlaeft)).join('')}
    </section>`;
  }).join('');

  for (const s of ALLE) {
    const feld = document.getElementById(`s-${s.key}`);
    if (!feld || feld.disabled) continue;
    if (s.klappe) feld.addEventListener('click', () => setze(s, feld.getAttribute('aria-pressed') !== 'true'));
    else { feld.addEventListener('input',  () => pruefe(s, feld, false));
           feld.addEventListener('change', () => pruefe(s, feld, true)); }
  }
}

function zeile(s, schlaeft) {
  const v = params[s.key], id = `b-${s.key}`, q = QUELLEN[s.quelle];
  const steuer = s.klappe
    ? `<button type="button" class="klappe" id="s-${s.key}" aria-labelledby="${id} s-${s.key}"
         aria-pressed="${v ? 'true' : 'false'}" ${schlaeft ? 'disabled' : ''}>${v ? 'ja' : 'nein'}</button>`
    : `<input type="text" class="stell" id="s-${s.key}" aria-labelledby="${id}"
         aria-describedby="f-${s.key}" inputmode="decimal" autocomplete="off"
         value="${wertText(s, v)}" ${schlaeft ? 'disabled' : ''}>`;
  return `
    <div class="zeile" id="z-${s.key}">
      <details class="woher">
        <summary><span id="${id}">${s.bez}</span><span class="einheit">, ${s.einheit}</span></summary>
        <dl>
          <dt>Rechenweg</dt><dd class="formel">${q ? q.formel : '—'}</dd>
          <dt>Fundstelle</dt><dd>${q ? q.ref : '—'}</dd>
          ${q && q.note ? `<dt>Anmerkung</dt><dd>${q.note}</dd>` : ''}
        </dl>
      </details>
      <span>${steuer}</span>
      <p class="delta" id="d-${s.key}" data-richtung="gleich">steht wie zum Rundenstart</p>
      <p class="fehler" id="f-${s.key}" hidden></p>
    </div>`;
}

function zeichneAusruf() {
  const a = ausruf();
  $('#ausruf-kopf').textContent = a.kopf;
  $('#ausruf-text').textContent = a.text;
  const bewegt = ALLE.filter(s => params[s.key] !== PRESETS.status_quo[s.key]).length;
  $('#fakt-abschluss').textContent = `${mitVz(ergebnis.saldo)} Mrd. €`;
  $('#fakt-bewegt').textContent = anzahl(bewegt, 'Stellgröße bewegt', 'Stellgrößen bewegt');
  const knopf = $('#btn-schliessen');
  if (knopf.textContent !== 'Runde beschlossen') knopf.disabled = bewegt === 0;
  melde(`Abschluss ${mitVz(ergebnis.saldo)} Milliarden Euro, ${anzahl(bewegt, 'Stellgröße bewegt', 'Stellgrößen bewegt')}.`);
}

let uhr = 0;
const melde  = t => { clearTimeout(uhr); uhr = setTimeout(() => { $('#live').textContent = t; }, 700); };
const sageAn = t => { clearTimeout(uhr); $('#live').textContent = t; };

/** Der eine Moment: das betroffene Wesen sackt einmal und richtet sich auf. */
function sacke(el) { if (!el) return; el.classList.remove('sackt'); void el.offsetWidth; el.classList.add('sackt'); }

// ── Eine Stellgroesse wird bewegt ──────────────────────────────────────────

function pruefe(s, feld, endgueltig) {
  const l = liesEingabe(feld.value), err = document.getElementById(`f-${s.key}`);
  if (l.leer || l.ungueltig) {
    if (!endgueltig) return;
    err.textContent = l.leer
      ? `${s.bez} braucht einen Wert — zwischen ${zahl(s.min, s.nk)} und ${zahl(s.max, s.nk)} ${s.einheit}.`
      : `„${feld.value}" ist keine Zahl — zwischen ${zahl(s.min, s.nk)} und ${zahl(s.max, s.nk)} ${s.einheit}.`;
    err.hidden = false; feld.setAttribute('aria-invalid', 'true');
    feld.value = wertText(s, params[s.key]);
    sageAn(err.textContent);
    return;
  }
  let w = l.wert;
  const draussen = w < s.min || w > s.max;
  w = Math.max(s.min, Math.min(s.max, w));
  if (endgueltig) {
    if (draussen) {
      err.textContent = `Auf ${zahl(w, s.nk)} ${s.einheit} begrenzt — mehr geht nicht.`;
      err.hidden = false; feld.setAttribute('aria-invalid', 'true'); sageAn(err.textContent);
    } else { err.hidden = true; feld.removeAttribute('aria-invalid'); }
  }
  setze(s, w);
  if (endgueltig) feld.value = wertText(s, w);
}

function setze(s, wert) {
  const vorher = ergebnis;
  params[s.key] = wert;
  ergebnis = berechne({ ...params }, PERIOD_STATE_0);

  const sq = PRESETS.status_quo[s.key], d = document.getElementById(`d-${s.key}`);
  if (s.klappe) {
    const b = document.getElementById(`s-${s.key}`);
    b.setAttribute('aria-pressed', wert ? 'true' : 'false');
    b.textContent = wert ? 'ja' : 'nein';
    const gleich = wert === sq;
    d.dataset.richtung = gleich ? 'gleich' : 'mehr';
    d.textContent = gleich ? 'steht wie zum Rundenstart' : (wert ? 'neu eingeführt' : 'gestrichen');
  } else {
    const diff = rund(wert, s.nk ?? 0) - rund(sq, s.nk ?? 0);
    d.dataset.richtung = diff === 0 ? 'gleich' : diff > 0 ? 'mehr' : 'minder';
    // Auf der Ratskarte meint „%" eine relative Aenderung, hier waere es eine
    // Differenz zweier Saetze. Ein Zeichen, zwei Bedeutungen auf einem
    // Bildschirm geht in einem Lehrplanspiel nicht.
    const mass = s.einheit === '%' ? 'Prozentpunkte' : s.einheit;
    d.innerHTML = diff === 0 ? 'steht wie zum Rundenstart'
      : `<span class="zahl">${mitVz(diff, s.nk ?? 0)} ${mass}</span> ${diff > 0 ? 'angehoben' : 'gesenkt'}`;
  }

  // Zwei Gesichter kippen zugleich: das Ressort und seine Kennzahl.
  // Bewegen darf sich nur, was sich auch geaendert hat — der Vertrag sagt
  // „sonst bewegt sich nichts", und fuenf Bewegungen sind nicht eine.
  const geaendert = RAT.filter(k => rund(k.lies(ergebnis), k.n) !== rund(k.lies(vorher), k.n));
  const res = RESSORTS.find(r => r.stell.includes(s));
  zeichneRat();
  const kopf = document.querySelector(`#r-${res.id} header`);
  if (kopf) {
    kopf.querySelector('svg').outerHTML = MINISTER[res.id](ressortMine(res), res.farbe);
    sacke(kopf.querySelector('svg'));
  }
  for (const k of geaendert) sacke(document.getElementById(`w-${k.id}`));
  zeichneAusruf();
}

// ── Die Runde schliessen ───────────────────────────────────────────────────

function oeffneVorlage() {
  const bewegt = ALLE.filter(s => params[s.key] !== PRESETS.status_quo[s.key]);
  $('#v-zahl').textContent = anzahl(bewegt.length, 'bewegte Stellgröße', 'bewegte Stellgrößen');
  $('#v-stell').innerHTML = bewegt.map(s => `
    <tr><td>${s.bez}</td><td class="zahl">${wertText(s, PRESETS.status_quo[s.key])}</td>
        <td class="zahl">${wertText(s, params[s.key])}</td></tr>`).join('');
  $('#v-wirkung').innerHTML = RAT.map(k => {
    const l = lage(k), diff = rund(k.lies(ergebnis), k.n) - rund(k.lies(SQ), k.n);
    return `<tr><td>${k.name}</td><td class="zahl">${zahl(k.lies(SQ), k.n)}</td>
      <td class="zahl">${zahl(k.lies(ergebnis), k.n)}</td>
      <td><b class="zahl">${mitVz(diff, k.n)}</b> ${l.wort}</td></tr>`;
  }).join('');
  $('#vorlage').showModal();
}

// ── Aufbau ─────────────────────────────────────────────────────────────────

zeichneRat();
zeichneKabinett();
zeichneAusruf();

$('#btn-schliessen').addEventListener('click', oeffneVorlage);
$('#btn-zurueck').addEventListener('click', () => $('#vorlage').close());
$('#btn-fassen').addEventListener('click', () => {
  $('#vorlage').close();
  const bewegt = ALLE.filter(s => params[s.key] !== PRESETS.status_quo[s.key]).length;
  const v = $('#vermerk');
  v.textContent = `Beschlossen: ${anzahl(bewegt, 'Stellgröße', 'Stellgrößen')}, Abschluss `
                + `${mitVz(ergebnis.saldo)} Mrd. €. Die nächste Runde wird in dieser Etappe nicht freigegeben.`;
  v.hidden = false;
  const knopf = $('#btn-schliessen');
  knopf.disabled = true;
  knopf.textContent = 'Runde beschlossen';
  sageAn(v.textContent);
});
