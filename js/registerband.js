// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// REGISTERBAND — Steuerung der Spielflaeche
//
// Uebersetzt zwischen dem Registerblatt und der Engine. Die Engine
// (js/rechner/, js/data.js) wird ausschliesslich gelesen.
//
// Kein fetch(), kein localStorage — diese Flaeche laeuft vollstaendig lokal.
//
// Ladereihenfolge: data.js -> berechne.js -> diese Datei.
// ═══════════════════════════════════════════════════════════════════════════

import { berechne, FORMEL_QUELLEN_BERECHNE } from './rechner/berechne.js';
import { FORMEL_QUELLEN_VERT }               from './rechner/verteilung.js';
import { PRESETS, PERIOD_STATE_0 }           from './data.js';

// ── Die Register ───────────────────────────────────────────────────────────
//
// Ein Vollton je Register. Die Reiterhoehe folgt dem Umfang — also der Zahl
// der bis dahin freigeschalteten Stellgroessen. Damit wird die Freischaltung
// je Periode, die didaktische Kernfunktion, zur Form des Bandes.

const REGISTER = [
  { nr: 1, spanne: '2025–2028', ton: '#2B3A8C' },
  { nr: 2, spanne: '2029–2032', ton: '#1C6B63' },
  { nr: 3, spanne: '2033–2036', ton: '#7A4E14' },
  { nr: 4, spanne: '2037–2040', ton: '#6B2233' },
  { nr: 5, spanne: '2041–2044', ton: '#3F5220' },
];

const RESSORTS = [
  { id: 'fin', name: 'Finanzen und Steuern', ab: 1, stell: [
    { key: 'freibetrag', bez: 'Grundfreibetrag',          einheit: '€',       min: 0,  max: 30000, nk: 0, quelle: 'arbeitsangebot' },
    { key: 'eingang',    bez: 'Eingangssteuersatz',       einheit: '%',       min: 0,  max: 40,    nk: 1, quelle: 'arbeitsangebot' },
    { key: 'spitze',     bez: 'Spitzensteuersatz',        einheit: '%',       min: 20, max: 75,    nk: 1, quelle: 'arbeitsangebot' },
    { key: 'mwst',       bez: 'Umsatzsteuer, Regelsatz',  einheit: '%',       min: 0,  max: 30,    nk: 1, quelle: 'mwst_konsumanteil' },
    { key: 'mwst_erm',   bez: 'Umsatzsteuer, ermäßigt',   einheit: '%',       min: 0,  max: 25,    nk: 1, quelle: 'mwst_konsumanteil' },
    { key: 'erb',        bez: 'Erbschaftsteuer',          einheit: '%',       min: 0,  max: 60,    nk: 0, quelle: 'erbschaft' },
    { key: 'verm',       bez: 'Vermögensteuer',           einheit: '%',       min: 0,  max: 5,     nk: 1, quelle: 'zucman' },
  ]},
  { id: 'wir', name: 'Wirtschaft und Unternehmen', ab: 2, stell: [
    { key: 'kst',   bez: 'Körperschaftsteuer',     einheit: '%', min: 0, max: 40, nk: 1, quelle: 'dynamisches_scoring' },
    { key: 'gewst', bez: 'Gewerbesteuer-Messzahl', einheit: '%', min: 0, max: 30, nk: 1, quelle: 'dynamisches_scoring' },
  ]},
  { id: 'soz', name: 'Arbeit und Soziales', ab: 3, stell: [
    { key: 'rv', bez: 'Beitragssatz Rentenversicherung',  einheit: '%',       min: 10, max: 30,   nk: 1, quelle: 'sv_beitraege' },
    { key: 'kv', bez: 'Beitragssatz Krankenversicherung', einheit: '%',       min: 10, max: 25,   nk: 1, quelle: 'sv_beitraege' },
    { key: 'bg', bez: 'Bürgergeld, Regelsatz',            einheit: '€/Monat', min: 0,  max: 1500, nk: 0, quelle: 'armutsrisiko' },
    { key: 'kg', bez: 'Kindergeld',                       einheit: '€/Monat', min: 0,  max: 1000, nk: 0, quelle: 'armutsrisiko' },
  ]},
  { id: 'umw', name: 'Umwelt und Klima', ab: 4, stell: [
    { key: 'co2',       bez: 'CO₂-Preis',           einheit: '€/t',     min: 0, max: 300, nk: 0, quelle: 'co2_emissionen' },
    { key: 'klimageld', bez: 'Klimageld auszahlen', einheit: 'ja/nein', klappe: true,           quelle: 'co2_emissionen' },
  ]},
];

const ALLE = RESSORTS.flatMap(r => r.stell);
const QUELLEN = { ...FORMEL_QUELLEN_BERECHNE, ...FORMEL_QUELLEN_VERT };
const umfang = nr => RESSORTS.filter(r => r.ab <= nr).reduce((s, r) => s + r.stell.length, 0);

// ── Zustand ────────────────────────────────────────────────────────────────

const AKTIV  = 1;                       // bespielbares Register dieser Etappe
const params = { ...PRESETS.status_quo };
const SQ     = berechne({ ...PRESETS.status_quo }, PERIOD_STATE_0);
let ergebnis = SQ;

// ── Die Deckkraft der Folie wird gerechnet, nicht geschaetzt ───────────────
//
// Milchacetat ueber Vollton: wie gut der Text darauf lesbar ist, haengt davon
// ab, was darunter liegt. Ein fester Wert wuerde auf Ultramarin halten und auf
// Sienna kippen. Also wird die Deckkraft gegen den Kartonton gesucht, bis das
// Lesefeld ein festes Kontrastband erreicht. Das ist die Webleistung dieser
// Welt und zugleich die Bedingung, unter der BITV haelt.

const zuLinear = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const leuchte  = ([r, g, b]) => 0.2126 * zuLinear(r) + 0.7152 * zuLinear(g) + 0.0722 * zuLinear(b);
const kontrast = (a, b) => {
  const la = leuchte(a), lb = leuchte(b);
  const [hoch, tief] = la > lb ? [la, lb] : [lb, la];
  return (hoch + 0.05) / (tief + 0.05);
};
const hexZuRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const ueber = (vorn, hinten, a) => vorn.map((v, i) => a * v + (1 - a) * hinten[i]);

/** Kleinste Deckkraft, bei der Papierweiss auf dem Karton AA erreicht.
 *  Dieselbe Suche, zweite Anwendung: auf Petrol kam der Nebenton bei fest
 *  gesetzten 0,74 auf 4,01:1, auf Sienna auf 4,49 — beide unter der Pflicht.
 *  Geraten faellt hier je nach Register durch; gerechnet nicht. */
function loeseNebenton(kartonHex, folieHex = '#F8F7F2', ziel = 4.6) {
  const karton = hexZuRgb(kartonHex), folie = hexZuRgb(folieHex);
  let tief = 0, hoch = 1;
  for (let i = 0; i < 24; i++) {
    const mitte = (tief + hoch) / 2;
    if (kontrast(ueber(folie, karton, mitte), karton) >= ziel) hoch = mitte; else tief = mitte;
  }
  return Math.min(1, Math.max(0.6, hoch));
}

/** Kleinste Deckkraft, bei der die Folie das Kontrastziel erreicht. */
function loeseDeckkraft(kartonHex, folieHex = '#F8F7F2', tinteHex = '#14140F', ziel = 13) {
  const karton = hexZuRgb(kartonHex), folie = hexZuRgb(folieHex), tinte = hexZuRgb(tinteHex);
  let tief = 0, hoch = 1;
  for (let i = 0; i < 24; i++) {
    const mitte = (tief + hoch) / 2;
    if (kontrast(tinte, ueber(folie, karton, mitte)) >= ziel) hoch = mitte; else tief = mitte;
  }
  // Untergrenze hoeher als frueher: die Loesung muss auch den Nebenrollen
  // Luft lassen, nicht nur der Volltinte.
  return Math.min(0.97, Math.max(0.80, hoch));
}

// ── Formatierung ───────────────────────────────────────────────────────────

const zahl = (v, n = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: n, maximumFractionDigits: n });
const mitVz = (v, n = 0) => (v > 0 ? '+' : v < 0 ? '−' : '±') + zahl(Math.abs(v), n);
const wertText = (s, v) => s.klappe ? (v ? 'ja' : 'nein') : zahl(v, s.nk ?? 0);
const anzahl = (n, ein, viele) => `${n} ${n === 1 ? ein : viele}`;

/** Die angezeigte Differenz wird aus den ANGEZEIGTEN Werten gebildet, nicht
 *  aus den rohen. Sonst steht −119, −53 und „+65" nebeneinander und die
 *  Bilanz geht um eins daneben — in einem Lehrplanspiel das Schlimmste,
 *  was eine Zahl tun kann. */
const rund = (v, n) => Number(v.toFixed(n));
const zeigDiff = (k) => rund(k.lies(ergebnis), k.n) - rund(k.lies(SQ), k.n);

function liesEingabe(text) {
  const roh = String(text).trim().replace(/\./g, '').replace(',', '.');
  if (roh === '') return { leer: true };
  const v = Number(roh);
  return Number.isFinite(v) ? { wert: v } : { ungueltig: true };
}

// ── Kennzahlen ─────────────────────────────────────────────────────────────
//
// Schwellen kommen aus dem Status quo DIESES Modells, nie aus einer
// Realweltzahl — sonst kann eine Politik nicht gelingen und die Farbe luegt.

const KENNZAHLEN = [
  { name: 'Haushaltssaldo',       einheit: 'Mrd. €', n: 0, lies: r => r.saldo,       gut: 'hoch', absolut: true },
  { name: 'Gini-Ungleichheit',    einheit: '',       n: 3, lies: r => r.gini,        gut: 'niedrig' },
  { name: 'Emissionen',           einheit: 'Mio. t', n: 0, lies: r => r.emissionen,  gut: 'niedrig' },
  { name: 'Bruttoinlandsprodukt', einheit: 'Mrd. €', n: 0, lies: r => r.bip_aktuell, gut: 'hoch'    },
];

const abweichung = k => {
  const sq = k.lies(SQ);
  return sq === 0 ? 0 : ((k.lies(ergebnis) - sq) / Math.abs(sq)) * 100;
};

function richtung(k) {
  const a = abweichung(k);
  if (Math.abs(a) < 0.05) return { r: 'gleich', wort: 'unverändert gegenüber dem Rundenstart' };
  const besser = k.gut === 'hoch' ? a > 0 : a < 0;
  return besser
    ? { r: 'mehr',   wort: (k.gut === 'hoch' ? 'höher' : 'niedriger') + ' als zum Rundenstart' }
    : { r: 'minder', wort: (k.gut === 'hoch' ? 'niedriger' : 'höher') + ' als zum Rundenstart' };
}

// ── Die Lage schreibt sich aus dem Modell ──────────────────────────────────

function lage() {
  const saldo = ergebnis.saldo, d = saldo - SQ.saldo, gini = ergebnis.gini - SQ.gini;
  if (Math.abs(d) < 0.5 && Math.abs(gini) < 0.0005) {
    return { kopf: 'Kabinett tagt ohne Beschluss',
      text: `Das Register entspricht in allen ${umfang(AKTIV)} freigegebenen Stellgrößen der Fortschreibung. ` +
            `Der Haushalt schließt mit ${zahl(Math.abs(saldo))} Mrd. € ${saldo < 0 ? 'Defizit' : 'Überschuss'}.` };
  }
  const kopf = saldo < 0
    ? `Haushaltsloch von ${zahl(Math.abs(saldo))} Mrd. Euro im Register`
    : `Register schließt mit ${zahl(saldo)} Mrd. Euro Überschuss`;
  const teile = [d > 0
    ? `Gegenüber dem Rundenstart verbessert sich der Saldo um ${zahl(d)} Mrd. €.`
    : `Gegenüber dem Rundenstart verschlechtert sich der Saldo um ${zahl(Math.abs(d))} Mrd. €.`];
  if (Math.abs(gini) >= 0.0005) {
    teile.push(gini < 0 ? `Die Einkommen rücken zusammen; der Gini fällt um ${zahl(Math.abs(gini), 3)}.`
                        : `Die Einkommen spreizen sich; der Gini steigt um ${zahl(gini, 3)}.`);
  }
  const co2 = ergebnis.emissionen - SQ.emissionen;
  if (Math.abs(co2) >= 1) {
    teile.push(co2 < 0 ? `Die Emissionen sinken um ${zahl(Math.abs(co2))} Mio. t.`
                       : `Die Emissionen steigen um ${zahl(co2)} Mio. t.`);
  }
  return { kopf, text: teile.join(' ') };
}

// ── Zeichnen ───────────────────────────────────────────────────────────────

const $ = s => document.querySelector(s);

function zeichneKamm() {
  $('#kamm').innerHTML = REGISTER.map(reg => {
    const aktiv = reg.nr === AKTIV;
    const erledigt = reg.nr < AKTIV;
    const lage = aktiv ? 'laufendes Register' : erledigt ? 'abgeschlossen' : 'noch nicht freigegeben';
    return `<button type="button" class="reiter" style="background:${reg.ton};flex:${umfang(reg.nr)}"
       aria-current="${aktiv}" ${aktiv ? '' : 'disabled'}
       aria-label="Register ${reg.nr}, ${reg.spanne}, ${lage}, Umfang ${umfang(reg.nr)} Stellgrößen">
       <span aria-hidden="true">${reg.spanne}</span>
       ${erledigt ? '<span class="haken" aria-hidden="true"></span>' : ''}
     </button>`;
  }).join('');
}

function zeichneKarton() {
  $('#blattkoerper').innerHTML = RESSORTS.map(res => {
    const gesperrt = res.ab > AKTIV;
    return `
    <section class="ressort" data-gesperrt="${gesperrt}" aria-labelledby="res-${res.id}">
      <h2 id="res-${res.id}">${res.name}<span class="zahl">${res.stell.length} Stellgrößen</span></h2>
      ${gesperrt
        ? `<p class="sperrnotiz">Bildseite nach unten — dieses Ressort wird ab Register ${res.ab} freigegeben.</p>`
        : ''}
      ${res.stell.map(s => zeile(s, gesperrt)).join('')}
    </section>`;
  }).join('');

  for (const s of ALLE) {
    const feld = document.getElementById(`stell-${s.key}`);
    if (!feld || feld.disabled) continue;
    if (s.klappe) feld.addEventListener('click', () => setze(s, feld.getAttribute('aria-pressed') !== 'true'));
    else { feld.addEventListener('input', () => pruefe(s, feld, false));
           feld.addEventListener('change', () => pruefe(s, feld, true)); }
  }
}

function zeile(s, gesperrt) {
  const v = params[s.key], sq = PRESETS.status_quo[s.key], id = `bez-${s.key}`;
  const q = QUELLEN[s.quelle];
  const steuer = s.klappe
    ? `<button type="button" class="klappe" id="stell-${s.key}" aria-labelledby="${id}"
         aria-pressed="${v ? 'true' : 'false'}" ${gesperrt ? 'disabled' : ''}>${v ? 'ja' : 'nein'}</button>`
    : `<input type="text" class="stell" id="stell-${s.key}" aria-labelledby="${id}"
         aria-describedby="err-${s.key}" inputmode="decimal" autocomplete="off"
         value="${wertText(s, v)}" ${gesperrt ? 'disabled' : ''}>`;

  return `
    <div class="zeile" id="z-${s.key}" data-geaendert="false">
      <span class="bez">
        <details class="herleitung">
          <summary><span id="${id}">${s.bez}</span><span class="einheit">, ${s.einheit}</span></summary>
          <dl>
            <dt>Rechenweg</dt><dd class="formel">${q ? q.formel : '—'}</dd>
            <dt>Fundstelle</dt><dd>${q ? q.ref : '—'}</dd>
            ${q && q.note ? `<dt>Anmerkung</dt><dd>${q.note}</dd>` : ''}
          </dl>
        </details>
      </span>
      <span class="wert">${steuer}</span>
      <span class="fort">${wertText(s, sq)}</span>
      <span class="delta" id="d-${s.key}" data-richtung="gleich">±0 <span class="wort">unverändert</span></span>
      <p class="errata" id="err-${s.key}" hidden></p>
    </div>`;
}

function zeichneFolie() {
  $('#kennzahlen').innerHTML = KENNZAHLEN.map(k => {
    const { r, wort } = richtung(k);
    // Ein Prozentwert auf einer Groesse mit Vorzeichen luegt: −119 auf −74
    // ist keine Steigerung um 38 %. Dort fuehrt die Differenz in der Einheit.
    const mass = k.absolut
      ? `${mitVz(zeigDiff(k), k.n)} ${k.einheit}`
      : `${mitVz(abweichung(k), 1)} %`;
    return `<div class="kennzahl">
        <dt>${k.name}</dt>
        <dd><span class="wert">${zahl(k.lies(ergebnis), k.n)}${k.einheit ? `<span class="einheit"> ${k.einheit}</span>` : ''}</span></dd>
        <p class="ab" data-richtung="${r}"><b>${mass}</b> ${wort}</p>
      </div>`;
  }).join('');

  $('#abschluss').innerHTML = `
    <div><span>Einnahmen</span><span>${zahl(ergebnis.einnahmen_total)} Mrd. €</span></div>
    <div><span>Ausgaben</span><span>${zahl(ergebnis.ausgaben_total)} Mrd. €</span></div>
    <div><span>Abschluss</span><span>${mitVz(ergebnis.saldo)} Mrd. €</span></div>`;

  const l = lage();
  $('#lage-kopf').textContent = l.kopf;
  $('#lage-text').textContent = l.text;

  const bewegt = ALLE.filter(s => params[s.key] !== PRESETS.status_quo[s.key]);
  $('#fakt-abschluss').textContent = `${mitVz(ergebnis.saldo)} Mrd. €`;
  $('#fakt-bewegt').textContent = anzahl(bewegt.length, 'Stellgröße bewegt', 'Stellgrößen bewegt');
  $('#btn-schliessen').disabled = bewegt.length === 0;
  melde(`Abschluss ${mitVz(ergebnis.saldo)} Milliarden Euro, ${anzahl(bewegt.length, 'Stellgröße bewegt', 'Stellgrößen bewegt')}.`);
}

// Die Live-Region meldet erst den gesetzten Wert, nicht jeden Tastendruck.
let uhr = 0;
const melde = text => { clearTimeout(uhr); uhr = setTimeout(() => { $('#live').textContent = text; }, 700); };
/** Sofort ansagen — Fehler duerfen nicht hinter der Entprellung verschwinden. */
const sageAn = text => { clearTimeout(uhr); $('#live').textContent = text; };

// ── Eine Stellgroesse wird ueberschrieben ──────────────────────────────────

function pruefe(s, feld, endgueltig) {
  const lage = liesEingabe(feld.value);
  const err = document.getElementById(`err-${s.key}`);

  if (lage.leer || lage.ungueltig) {
    if (!endgueltig) return;                      // Zwischenzustaende nicht rechnen
    err.textContent = lage.leer
      ? `${s.bez} braucht einen Wert. Zulässig sind ${zahl(s.min, s.nk)} bis ${zahl(s.max, s.nk)} ${s.einheit}.`
      : `„${feld.value}" ist keine Zahl. Zulässig sind ${zahl(s.min, s.nk)} bis ${zahl(s.max, s.nk)} ${s.einheit}.`;
    err.hidden = false; feld.setAttribute('aria-invalid', 'true');
    feld.value = wertText(s, params[s.key]);
    sageAn(err.textContent);          // sonst erfaehrt niemand von der Abweisung
    return;
  }

  let w = lage.wert;
  const ausserhalb = w < s.min || w > s.max;
  w = Math.max(s.min, Math.min(s.max, w));

  if (endgueltig) {
    if (ausserhalb) {
      err.textContent = `Auf ${zahl(w, s.nk)} ${s.einheit} begrenzt. Zulässig sind ${zahl(s.min, s.nk)} bis ${zahl(s.max, s.nk)} ${s.einheit}.`;
      err.hidden = false; feld.setAttribute('aria-invalid', 'true');
      sageAn(err.textContent);
    } else { err.hidden = true; feld.removeAttribute('aria-invalid'); }
  }

  setze(s, w);
  if (endgueltig) feld.value = wertText(s, w);
}

function setze(s, wert) {
  params[s.key] = wert;
  ergebnis = berechne({ ...params }, PERIOD_STATE_0);

  const sq = PRESETS.status_quo[s.key];
  document.getElementById(`z-${s.key}`).dataset.geaendert = String(params[s.key] !== sq);
  const d = document.getElementById(`d-${s.key}`);

  if (s.klappe) {
    const b = document.getElementById(`stell-${s.key}`);
    b.setAttribute('aria-pressed', wert ? 'true' : 'false');
    b.textContent = wert ? 'ja' : 'nein';
    const gleich = wert === sq;
    d.dataset.richtung = gleich ? 'gleich' : 'mehr';
    d.innerHTML = gleich ? '±0 <span class="wort">unverändert</span>'
                         : `<span class="wort">${wert ? 'eingeführt' : 'gestrichen'}</span>`;
  } else {
    const diff = wert - sq;
    d.dataset.richtung = Math.abs(diff) < 1e-9 ? 'gleich' : diff > 0 ? 'mehr' : 'minder';
    d.innerHTML = Math.abs(diff) < 1e-9
      ? '±0 <span class="wort">unverändert</span>'
      : `${mitVz(diff, s.nk ?? 0)} <span class="wort">${diff > 0 ? 'angehoben' : 'gesenkt'}</span>`;
  }

  d.classList.remove('frisch'); void d.offsetWidth; d.classList.add('frisch');
  zeichneFolie();
  // Die Folie schreibt sich laut STORY mit um — also bekommt auch sie das
  // Scharnier, nicht nur die Delta-Zelle.
  const f = $('.folie');
  f.classList.remove('frisch'); void f.offsetWidth; f.classList.add('frisch');
}

// ── Das Register schliessen ────────────────────────────────────────────────

function oeffneVorlage() {
  const bewegt = ALLE.filter(s => params[s.key] !== PRESETS.status_quo[s.key]);
  $('#v-zahl').textContent = anzahl(bewegt.length, 'bewegte Stellgröße', 'bewegte Stellgrößen');
  $('#v-stell').innerHTML = bewegt.map(s => `
    <tr><td>${s.bez}</td><td>${wertText(s, PRESETS.status_quo[s.key])}</td><td>${wertText(s, params[s.key])}</td></tr>`).join('');
  $('#v-wirkung').innerHTML = KENNZAHLEN.map(k => {
    const { r, wort } = richtung(k);
    return `<tr><td>${k.name}</td><td>${zahl(k.lies(SQ), k.n)}</td><td>${zahl(k.lies(ergebnis), k.n)}</td>
      <td><b>${mitVz(zeigDiff(k), k.n)}</b> ${wort}</td></tr>`;
  }).join('');
  $('#vorlage').showModal();
}

// ── Aufbau ─────────────────────────────────────────────────────────────────

const reg = REGISTER[AKTIV - 1];
document.documentElement.style.setProperty('--karton', reg.ton);
document.documentElement.style.setProperty('--folie-alpha', loeseDeckkraft(reg.ton).toFixed(3));
document.documentElement.style.setProperty('--neben-alpha', loeseNebenton(reg.ton).toFixed(3));
$('#reg-nr').textContent = `Register ${reg.nr}`;
$('#reg-spanne').textContent = `Legislatur ${reg.spanne}`;

zeichneKamm();
zeichneKarton();
zeichneFolie();

$('#btn-schliessen').addEventListener('click', oeffneVorlage);
$('#btn-zurueck').addEventListener('click', () => $('#vorlage').close());
$('#btn-fassen').addEventListener('click', () => {
  $('#vorlage').close();
  const bewegt = ALLE.filter(s => params[s.key] !== PRESETS.status_quo[s.key]).length;
  const v = $('#vermerk');
  v.textContent = `Beschluss vermerkt: ${anzahl(bewegt, 'Stellgröße', 'Stellgrößen')}, `
                + `Abschluss ${mitVz(ergebnis.saldo)} Mrd. €. Das nächste Register wird in dieser Etappe nicht freigegeben.`;
  v.hidden = false;
  sageAn(v.textContent);
});
