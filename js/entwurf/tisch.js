// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DER VERHANDLUNGSTISCH — Steuerung
//
// Die Idee: keine Zahl gilt, bevor alle vier Ressorts gezeichnet haben.
// Daraus folgt der Unterschied zu den vier anderen Entwuerfen — hier ist der
// Rundenschluss GESPERRT, solange eine Mappe offen ist. Das ist keine
// Verzierung, sondern die Regel, um die dieser Entwurf gebaut ist.
//
// Eine Mappe wird ungezeichnet, sobald sich in ihrem Ressort etwas aendert:
// wer nach der Unterschrift nachbessert, muss neu zeichnen. Sonst waere die
// Unterschrift eine Geste ohne Bindung.
//
// Der Einspruch sperrt zusaetzlich — und nennt, wogegen er sich richtet.
// ═══════════════════════════════════════════════════════════════════════════

import {
  erzeugeSpiel, RESSORTS, ALLE, KENNZAHLEN, NEBENWERTE, RUNDEN,
  benutzteQuellen, zahl, mitVz, rund, diffText, punkteText, wertText,
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

/** Der Verhandlungsstand liegt neben dem Spielstand, nicht in ihm: er ist
 *  eine Regel DIESES Entwurfs, keine Eigenschaft des Modells. */
const tisch = Object.fromEntries(
  RESSORTS.map(r => [r.id, { gezeichnet: false, einspruch: false }]));

const offen     = () => RESSORTS.filter(r => !tisch[r.id].gezeichnet);
const einsprueche = () => RESSORTS.filter(r => tisch[r.id].einspruch);
const kannSchliessen = () => offen().length === 0 && einsprueche().length === 0;

// ── Die Mappen ─────────────────────────────────────────────────────────────

function feldFuer(s) {
  const v = spiel.params[s.key];
  return s.klappe
    ? `<button type="button" class="klappe" id="e-${s.key}" aria-labelledby="l-${s.key} e-${s.key}"
         aria-pressed="${v ? 'true' : 'false'}">${v ? 'ja' : 'nein'}</button>`
    : `<input type="text" class="feld" id="e-${s.key}" value="${wertText(s, v)}"
         inputmode="decimal" autocomplete="off" spellcheck="false"
         aria-labelledby="l-${s.key}" aria-describedby="fehl-${s.key}">`;
}

function standText(r) {
  const t = tisch[r.id];
  if (t.einspruch)  return { klasse: 'einspruch',  text: 'Einspruch eingelegt' };
  if (t.gezeichnet) return { klasse: 'gezeichnet', text: 'eingelegt und gezeichnet' };
  const bewegt = r.stell.filter(s => spiel.bewegt(s.key)).length;
  return { klasse: 'offen',
           text: bewegt ? `${bewegt} Änderung${bewegt === 1 ? '' : 'en'}, noch nicht gezeichnet`
                        : 'unverändert, noch nicht gezeichnet' };
}

function zeichneMappen() {
  $('#tisch').innerHTML = RESSORTS.map(r => {
    const k = KENNZAHLEN.find(x => x.id === r.kennzahl);
    const t = diffText(k, spiel.ergebnis, spiel.basis);
    const st = standText(r);
    return `
    <article class="mappe m-${r.id}" id="m-${r.id}" data-stand="${st.klasse}"
             aria-labelledby="h-${r.id}">
      <p class="reiter">${r.kurz}</p>
      <h2 id="h-${r.id}">${r.name}</h2>
      <div class="blatt">
        ${r.stell.map(s => `
          <div class="pos${spiel.bewegt(s.key) ? ' gefordert' : ''}" id="p-${s.key}">
            <label class="n" id="l-${s.key}" for="e-${s.key}">${s.bez}<a class="fn"
              href="#quellen" aria-label="Fundstelle ${FN[s.quelle]}">${FN[s.quelle]}</a></label>
            <span class="v">${feldFuer(s)}<span class="eh">${s.einheit}</span></span>
            <span class="fehl" id="fehl-${s.key}" role="status" hidden></span>
          </div>`).join('')}
      </div>
      <p class="wacht" data-richtung="${t.richtung}">
        <span>wacht über <b>${k.name}</b></span>
        <span class="w">${zahl(k.lies(spiel.ergebnis), k.n)}${k.einheit ? `<em> ${k.einheit}</em>` : ''}</span>
        <span class="d">${t.text}</span></p>
      <p class="stand" id="st-${r.id}">${st.text}</p>
      <div class="knoepfe">
        <button type="button" class="zeichnen" id="z-${r.id}"
          aria-pressed="${tisch[r.id].gezeichnet ? 'true' : 'false'}"
        >${tisch[r.id].gezeichnet ? 'Unterschrift zurückziehen' : 'Mappe zeichnen'}</button>
        <button type="button" class="einspruch" id="w-${r.id}"
          aria-pressed="${tisch[r.id].einspruch ? 'true' : 'false'}"
        >${tisch[r.id].einspruch ? 'Einspruch zurücknehmen' : 'Einspruch'}</button>
      </div>
    </article>`;
  }).join('');

  for (const r of RESSORTS) {
    document.getElementById(`z-${r.id}`).addEventListener('click', () => {
      tisch[r.id].gezeichnet = !tisch[r.id].gezeichnet;
      if (tisch[r.id].gezeichnet) tisch[r.id].einspruch = false;
      zeichneMappen(); bindeAlle(spiel, ALLE, knoten); zeichneMitte();
    });
    document.getElementById(`w-${r.id}`).addEventListener('click', () => {
      tisch[r.id].einspruch = !tisch[r.id].einspruch;
      if (tisch[r.id].einspruch) tisch[r.id].gezeichnet = false;
      zeichneMappen(); bindeAlle(spiel, ALLE, knoten); zeichneMitte();
    });
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
      <p class="d">${t.text}</p></div>`;
  }).join('');

  const fehlend = Math.max(0, Math.round(Math.abs(e.saldo) - Math.abs(e.bip_aktuell * 0.0035)));
  $('#streit').innerHTML = (() => {
    const w = einsprueche(), o = offen();
    const teile = [];
    if (w.length) {
      teile.push(`<b>Einspruch von ${w.map(r => r.kurz).join(' und ')}.</b> Solange er steht,
        kann die Runde nicht geschlossen werden.`);
    }
    if (o.length && !w.length) {
      teile.push(`Es fehlen noch die Unterschriften von <b>${o.map(r => r.kurz).join(', ')}</b>.`);
    }
    if (!o.length && !w.length) {
      teile.push('<b>Alle vier Mappen sind gezeichnet.</b> Die Runde kann geschlossen werden.');
    }
    teile.push(e.schuldenbremse_ok
      ? `Die Schuldenbremse ist eingehalten (${zahl(Math.abs(e.saldo_bip_pct), 2)} % des BIP).`
      : `Die Schuldenbremse ist gerissen: ${zahl(Math.abs(e.saldo_bip_pct), 2)} % des BIP statt
         0,35 %. Zum Schließen der Lücke fehlen rund <b>${zahl(fehlend)} Milliarden</b>.
         Die Runde kann trotzdem geschlossen werden — der Fehlbetrag wandert dann weiter.`);
    return teile.join(' ');
  })();
  $('#streit').dataset.ok = String(kannSchliessen());

  $('#unterschriften').innerHTML = RESSORTS.map(r => `
    <div class="us" data-stand="${standText(r).klasse}">
      <p class="line">${tisch[r.id].gezeichnet ? r.kurz
        : tisch[r.id].einspruch ? '✗' : ''}</p>
      <p class="l">${r.kurz}</p></div>`).join('');

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
    `Sitzung ${spiel.runde} von ${RUNDEN} · ${spiel.jahre.text} · `
    + `${RESSORTS.length - offen().length} von ${RESSORTS.length} Mappen gezeichnet`;

  const knopf = $('#abschluss');
  const gesperrt = !kannSchliessen() || spiel.letzteRunde;
  knopf.disabled = gesperrt;
  knopf.textContent = spiel.letzteRunde ? `Sitzung ${spiel.runde} ist die letzte`
    : kannSchliessen() ? `Sitzung ${spiel.runde} schließen`
    : 'Gesperrt — es fehlen Unterschriften';
  $('#sperre').textContent = spiel.letzteRunde ? 'Der Kurs endet nach dieser Sitzung.'
    : kannSchliessen() ? 'Alle Mappen liegen vor.'
    : einsprueche().length
      ? `Einspruch von ${einsprueche().map(r => r.kurz).join(' und ')} — erst zurücknehmen.`
      : `Offen: ${offen().map(r => r.kurz).join(', ')}.`;

  $('#protokoll').innerHTML = spiel.verlauf.length === 0
    ? '<p class="leer">Noch keine Sitzung protokolliert.</p>'
    : spiel.verlauf.map(v => `<p class="e"><b>Sitzung ${v.runde}</b> · ${v.jahre.text} ·
        Saldo ${zahl(v.ergebnis.saldo, 0)} Mrd. € · Gini ${zahl(v.ergebnis.gini, 3)} ·
        CO₂ ${zahl(v.ergebnis.emissionen, 0)} Mio. t</p>`).join('');
}

// ── Aenderungen ────────────────────────────────────────────────────────────

function alles() { zeichneMappen(); bindeAlle(spiel, ALLE, knoten); zeichneMitte(); }

spiel.aufAenderung(({ art, key }) => {
  if (art === 'runde') {
    // Neue Sitzung: der Tisch ist leer, alle Mappen sind wieder offen.
    for (const r of RESSORTS) { tisch[r.id].gezeichnet = false; tisch[r.id].einspruch = false; }
    alles();
    return;
  }
  // Wer nach der Unterschrift nachbessert, muss neu zeichnen — sonst waere
  // die Unterschrift eine Geste ohne Bindung.
  const r = RESSORTS.find(x => x.stell.some(s => s.key === key));
  if (r && tisch[r.id].gezeichnet) {
    tisch[r.id].gezeichnet = false;
    document.getElementById(`z-${r.id}`).setAttribute('aria-pressed', 'false');
    document.getElementById(`z-${r.id}`).textContent = 'Mappe zeichnen';
  }
  for (const s of ALLE) {
    document.getElementById(`p-${s.key}`)?.classList.toggle('gefordert', spiel.bewegt(s.key));
  }
  for (const res of RESSORTS) {
    const st = standText(res);
    document.getElementById(`m-${res.id}`).dataset.stand = st.klasse;
    document.getElementById(`st-${res.id}`).textContent = st.text;
    const k = KENNZAHLEN.find(x => x.id === res.kennzahl);
    const t = diffText(k, spiel.ergebnis, spiel.basis);
    const zeile = document.querySelector(`#m-${res.id} .wacht`);
    zeile.dataset.richtung = t.richtung;
    zeile.querySelector('.w').innerHTML =
      zahl(k.lies(spiel.ergebnis), k.n) + (k.einheit ? `<em> ${k.einheit}</em>` : '');
    zeile.querySelector('.d').textContent = t.text;
  }
  zieheKlappenNach(spiel, ALLE, knoten);
  zeichneMitte();
});

$('#quellen-liste').innerHTML = quellen.map(q => `
  <li id="q-${q.id}"><p class="nr">${FN[q.id]}</p>
    <div><p class="betrifft">${q.stell.join(' · ')}</p>
      <p class="formel">${q.formel}</p><p class="ref">${q.ref}</p>
      ${q.note ? `<p class="note">${q.note}</p>` : ''}</div></li>`).join('');

$('#abschluss').addEventListener('click', () => { if (kannSchliessen()) spiel.schliesseRunde(); });
alles();
