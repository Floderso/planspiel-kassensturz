// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DAS KASSENBUCH — Steuerung
//
// Die Idee: jede Entscheidung ist eine BUCHUNG mit Gegenkonto. Nichts
// entsteht aus dem Nichts, nichts verschwindet. Daraus folgt die Anforderung,
// an der dieser Entwurf haengt: die Spalten muessen AUFGEHEN. Soll und Haben
// stehen nebeneinander, und wer nachrechnet, muss auf dieselbe Zahl kommen.
//
// Darum kommt der ausgewiesene Saldo aus gedruckterSaldo() — aus den
// AUSGEWIESENEN Summanden, nicht aus dem ungerundeten Engine-Wert daneben.
// ═══════════════════════════════════════════════════════════════════════════

import {
  erzeugeSpiel, RESSORTS, ALLE, KENNZAHLEN, NEBENWERTE, RUNDEN,
  benutzteQuellen, zahl, mitVz, rund, diffText, punkteText, wertText,
  gedruckterSaldo,
} from '../spielkern.js';
import { bindeAlle, zieheKlappenNach } from '../felder.js';

const spiel   = erzeugeSpiel();
const quellen = benutzteQuellen();
const $  = s => document.querySelector(s);
const FN = Object.fromEntries(quellen.map((q, i) => [q.id, i + 1]));
const knoten = (s) => ({
  eingabe: document.getElementById(`e-${s.key}`),
  fehler:  document.getElementById(`fehl-${s.key}`),
  zeile:   document.getElementById(`p-${s.key}`),
});

// ── Kontenrahmen ───────────────────────────────────────────────────────────
//
// Die Nummern sind Gestaltung, nicht Engine: sie geben dem Buch die Ordnung,
// die ein Kontenplan hat. Die Seite (soll/haben) folgt aber der Sache — ein
// Beitragssatz bucht im Haben, eine Leistung im Soll.

const KONTEN = {
  freibetrag: { nr: '8110', seite: 'haben', text: 'Lohn- und Einkommensteuer' },
  eingang:    { nr: '8111', seite: 'haben', text: 'Lohn- und Einkommensteuer' },
  spitze:     { nr: '8112', seite: 'haben', text: 'Lohn- und Einkommensteuer' },
  mwst:       { nr: '8120', seite: 'haben', text: 'Umsatzsteuer' },
  erb:        { nr: '8140', seite: 'haben', text: 'Erbschaftsteuer' },
  kst:        { nr: '8130', seite: 'haben', text: 'Körperschaftsteuer' },
  gewst:      { nr: '8135', seite: 'haben', text: 'Gewerbesteuer' },
  rv:         { nr: '8210', seite: 'haben', text: 'Beiträge Rentenversicherung' },
  kv:         { nr: '8220', seite: 'haben', text: 'Beiträge Krankenversicherung' },
  bg:         { nr: '4210', seite: 'soll',  text: 'Bürgergeld' },
  kg:         { nr: '4220', seite: 'soll',  text: 'Kindergeld' },
  co2:        { nr: '8150', seite: 'haben', text: 'CO₂-Bepreisung' },
  klimageld:  { nr: '4230', seite: 'soll',  text: 'Klimageld' },
};

/**
 * Die Posten der Aufstellung. Alle Betraege kommen aus der Engine: die
 * Einnahmen aus ergebnis.rev, das die Aufgliederung schon fertig liefert und
 * exakt auf einnahmen_total summiert.
 *
 * Je Seite ist EIN Posten die Ausgleichszeile: er wird aus der gerundeten
 * Summe minus den gerundeten Einzelposten gebildet. Sonst steht in einem
 * Kassenbuch eine Spalte, die um zwei Cent nicht aufgeht — und ein Kassenbuch,
 * das nicht aufgeht, widerlegt sich selbst. Die Ausgleichszeile heisst darum,
 * was sie ist: "uebrige", nicht ein einzelner benannter Zweck.
 */
const HABEN_KONTEN = [
  ['est',       '8110', 'Lohn- und Einkommensteuer'],
  ['mwst',      '8120', 'Umsatzsteuer'],
  ['kst',       '8130', 'Körperschaftsteuer'],
  ['gewst',     '8135', 'Gewerbesteuer'],
  ['erbschaft', '8140', 'Erbschaftsteuer'],
  ['boden',     '8145', 'Bodenwertabgabe'],
  ['co2',       '8150', 'CO₂-Bepreisung'],
  ['vermoegen', '8160', 'Vermögensteuer'],
  ['zucman',    '8165', 'Mindeststeuer auf hohe Vermögen'],
  ['rv',        '8210', 'Beiträge Rentenversicherung'],
  ['kv',        '8220', 'Beiträge Krankenversicherung'],
  ['al',        '8230', 'Beiträge Arbeitslosenversicherung'],
];

function posten(e) {
  const sollEinzeln = [
    { nr: '4210', text: 'Bürgergeld',             wert: rund(e.bg_auszahlung, 2) },
    { nr: '4220', text: 'Kindergeld',             wert: rund(e.kg_auszahlung, 2) },
    { nr: '4230', text: 'Klimageld',              wert: rund(e.klimageld_auszahlung, 2) },
    { nr: '4800', text: 'Zinsen auf Altschulden', wert: rund(e.zinsen_dyn ?? 0, 2) },
    { nr: '4900', text: 'Verwaltung',             wert: rund(e.admin_kosten, 2) },
  ];
  const sollRest = rund(rund(e.ausgaben_total, 2)
    - sollEinzeln.reduce((a, z) => a + z.wert, 0), 2);

  const habenEinzeln = HABEN_KONTEN
    .map(([k, nr, text]) => ({ nr, text, wert: rund(e.rev?.[k] ?? 0, 2) }));
  const habenRest = rund(rund(e.einnahmen_total, 2)
    - habenEinzeln.reduce((a, z) => a + z.wert, 0), 2);

  return {
    soll: [
      { nr: '4100', text: 'Übrige Ausgaben — Renten, Gesundheit, Bildung, Verteidigung u. a.',
        wert: sollRest },
      ...sollEinzeln,
    ],
    haben: [
      ...habenEinzeln,
      { nr: '8240', text: 'Übrige Steuern und Abgaben', wert: habenRest },
    ],
  };
}

// ── Das Buch ───────────────────────────────────────────────────────────────

function seite(art, zeilen, summe, beschriftung) {
  return `
    <h2>${beschriftung}</h2>
    <table>
      <thead><tr><th class="k">Konto</th><th class="l">Buchungstext</th><th>Betrag</th></tr></thead>
      <tbody>
        ${zeilen.map(z => `<tr><td class="k">${z.nr}</td><td class="l">${z.text}</td>
          <td class="b">${zahl(z.wert, 2)}</td></tr>`).join('')}
        <tr class="summe"><td class="k"></td><td class="l">Summe ${beschriftung.split(' ')[0]}</td>
          <td class="b">${zahl(summe, 2)}</td></tr>
      </tbody>
    </table>`;
}

function zeichneBuch() {
  const e = spiel.ergebnis;
  const p = posten(e);
  const summe = z => rund(z.reduce((a, x) => a + x.wert, 0), 2);
  $('#soll').innerHTML  = seite('soll',  p.soll,  summe(p.soll),  'Soll — Ausgaben');
  $('#haben').innerHTML = seite('haben', p.haben, summe(p.haben), 'Haben — Einnahmen');
}

// ── Die Beschlussspalte: hier wird gebucht ─────────────────────────────────

function feldFuer(s) {
  const v = spiel.params[s.key];
  return s.klappe
    ? `<button type="button" class="klappe" id="e-${s.key}" aria-labelledby="l-${s.key} e-${s.key}"
         aria-pressed="${v ? 'true' : 'false'}">${v ? 'ja' : 'nein'}</button>`
    : `<input type="text" class="feld" id="e-${s.key}" value="${wertText(s, v)}"
         inputmode="decimal" autocomplete="off" spellcheck="false"
         aria-labelledby="l-${s.key}" aria-describedby="fehl-${s.key}">`;
}

function zeichneBeschluss() {
  $('#beschluss').innerHTML = RESSORTS.map(res => `
    <section class="gruppe" aria-labelledby="g-${res.id}">
      <h3 id="g-${res.id}">${res.name}</h3>
      ${res.stell.map(s => {
        const k = KONTEN[s.key];
        return `
        <div class="pos${spiel.bewegt(s.key) ? ' gebucht' : ''}" id="p-${s.key}">
          <span class="knr">${k.nr}</span>
          <label class="n" id="l-${s.key}" for="e-${s.key}">${s.bez}<a class="fn"
            href="#quellen" aria-label="Fundstelle ${FN[s.quelle]}">${FN[s.quelle]}</a></label>
          <span class="v">${feldFuer(s)}<span class="eh">${s.einheit}</span></span>
          <span class="fehl" id="fehl-${s.key}" role="status" hidden></span>
        </div>`;
      }).join('')}
    </section>`).join('');
}

/** Das Journal: was in dieser Runde gebucht wurde, mit Gegenkonto. */
function zeichneJournal() {
  const bewegte = spiel.bewegte;
  $('#journal-zahl').textContent = bewegte.length === 1 ? '1 Buchung' : `${bewegte.length} Buchungen`;
  $('#journal').innerHTML = bewegte.length === 0
    ? '<tr class="leer"><td colspan="5">Noch keine Buchung in dieser Runde.</td></tr>'
    : bewegte.map((s, i) => {
        const k = KONTEN[s.key], von = spiel.startwerte[s.key], nach = spiel.params[s.key];
        const mass = s.klappe ? `${wertText(s, von)} → ${wertText(s, nach)}`
          : s.einheit === '%' ? punkteText(von, nach, s.nk)
          : `${mitVz(rund(nach, s.nk) - rund(von, s.nk), s.nk)} ${s.einheit}`;
        return `<tr>
          <td class="k">${String(i + 1).padStart(3, '0')}</td>
          <td class="k">${k.nr}</td>
          <td class="l">${s.bez}</td>
          <td class="l seite" data-seite="${k.seite}">${k.seite === 'soll' ? 'Soll' : 'Haben'}</td>
          <td class="b">${mass}</td></tr>`;
      }).join('');
}

// ── Abschluss ──────────────────────────────────────────────────────────────

function zeichneAbschluss() {
  const e = spiel.ergebnis, b = spiel.basis;
  // Aus den AUSGEWIESENEN Summanden gebildet, damit die Spalte aufgeht.
  const sJetzt = gedruckterSaldo(e), sStart = gedruckterSaldo(b);

  $('#abschlusszeile').innerHTML = `
    <div class="posten schluss"><p class="n">Fehlbetrag der Runde</p>
      <p class="v">${zahl(sJetzt, 2)}<em> Mrd. €</em></p>
      <p class="d" data-richtung="${sJetzt > sStart ? 'besser' : sJetzt < sStart ? 'schlechter' : 'gleich'}"
      >${mitVz(rund(sJetzt, 2) - rund(sStart, 2), 2)} gegenüber Vortrag</p></div>
    <div class="posten"><p class="n">Vortrag aus dem Rundenstart</p>
      <p class="v">${zahl(sStart, 2)}<em> Mrd. €</em></p>
      <p class="d">Fortschreibung</p></div>
    ${KENNZAHLEN.slice(1).concat(NEBENWERTE.slice(0, 2)).map(k => {
      const t = diffText(k, e, b);
      return `<div class="posten"><p class="n">${k.name}</p>
        <p class="v">${zahl(k.lies(e), k.n)}<em>${k.einheit ? ' ' + k.einheit : ''}</em></p>
        <p class="d" data-richtung="${t.richtung}">${t.text}</p></div>`;
    }).join('')}`;

  $('#vermerk').innerHTML = e.schuldenbremse_ok
    ? `Die Neuverschuldung entspricht ${zahl(Math.abs(e.saldo_bip_pct), 2)} % des
       Bruttoinlandsprodukts und liegt damit innerhalb der zulässigen 0,35 %. Die Deckung
       ist erbracht.`
    : `Der Fehlbetrag entspricht ${zahl(Math.abs(e.saldo_bip_pct), 2)} % des
       Bruttoinlandsprodukts. Die Schuldenbremse lässt 0,35 % zu. Die Deckung ist nicht
       erbracht; über den Ausgleich ist in den verbleibenden
       ${RUNDEN - spiel.runde} Runden zu beschließen.`;
  $('#vermerk').dataset.ok = String(e.schuldenbremse_ok);

  $('#buchkopf').textContent =
    `Konto 0001 · Allgemeiner Haushalt · Runde ${spiel.runde} von ${RUNDEN} · `
    + `Geschäftsjahre ${spiel.jahre.text} · alle Beträge in Mrd. €`;

  const knopf = $('#abschluss');
  knopf.disabled = spiel.letzteRunde;
  knopf.textContent = spiel.letzteRunde
    ? `Runde ${spiel.runde} ist die letzte` : `Runde ${spiel.runde} abschließen und vortragen`;

  $('#vorjahre').innerHTML = spiel.verlauf.length === 0
    ? '<p class="leer">Noch keine Runde abgeschlossen.</p>'
    : `<table><thead><tr><th class="l">Runde</th><th class="l">Jahre</th><th>Saldo</th>
         <th>Gini</th><th>CO₂</th></tr></thead><tbody>`
      + spiel.verlauf.map(v => `<tr><td class="l">${v.runde}</td><td class="l">${v.jahre.text}</td>
          <td class="b">${zahl(v.ergebnis.saldo, 2)}</td>
          <td class="b">${zahl(v.ergebnis.gini, 3)}</td>
          <td class="b">${zahl(v.ergebnis.emissionen, 0)}</td></tr>`).join('')
      + '</tbody></table>';
}

function alles() {
  zeichneBeschluss(); bindeAlle(spiel, ALLE, knoten);
  zeichneBuch(); zeichneJournal(); zeichneAbschluss();
}

/** Beim Tippen nur die Zahlen, nie die Felder. */
function nurZahlen() {
  zeichneBuch(); zeichneJournal(); zeichneAbschluss();
  for (const s of ALLE) {
    document.getElementById(`p-${s.key}`)?.classList.toggle('gebucht', spiel.bewegt(s.key));
  }
  zieheKlappenNach(spiel, ALLE, knoten);
}

$('#quellen-liste').innerHTML = quellen.map(q => `
  <li id="q-${q.id}"><p class="nr">${FN[q.id]}</p>
    <div><p class="betrifft">${q.stell.join(' · ')}</p>
      <p class="formel">${q.formel}</p><p class="ref">${q.ref}</p>
      ${q.note ? `<p class="note">${q.note}</p>` : ''}</div></li>`).join('');

spiel.aufAenderung(({ art }) => (art === 'runde' ? alles() : nurZahlen()));
$('#abschluss').addEventListener('click', () => spiel.schliesseRunde());
alles();
