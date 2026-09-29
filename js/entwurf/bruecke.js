// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DIE BRUECKENWACHE — Steuerung
//
// Die Idee: ein Kurs hat Traegheit. Darum zeigt diese Flaeche nicht nur die
// Lage, sondern die BAHN — wohin der Haushalt bis 2044 laeuft, wenn ab jetzt
// nichts mehr entschieden wird.
//
// Die Bahn ist keine Extrapolation. Sie entsteht, indem die restlichen Runden
// mit denselben Funktionen vorgerollt werden, mit denen auch gespielt wird
// (vorausschau() im Spielkern). Eine gemalte Trendlinie waere eine Behauptung
// ueber eine Prognosequalitaet, die das Modell nicht hat.
// ═══════════════════════════════════════════════════════════════════════════

import {
  erzeugeSpiel, vorausschau, RESSORTS, ALLE, KENNZAHLEN, NEBENWERTE, RUNDEN,
  benutzteQuellen, zahl, mitVz, rund, diffText, wertText,
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

// ── Der Horizont ───────────────────────────────────────────────────────────

const B = 900, H = 260, RAND = { l: 56, r: 22, o: 20, u: 34 };

/**
 * Zwei Bahnen: was ohne diesen Beschluss geschaehe (Fortschreibung) und was
 * mit ihm geschieht. Beide werden gerechnet, nicht gezeichnet.
 */
function zeichneHorizont() {
  const mit  = vorausschau(spiel.zustand, spiel.params,      spiel.runde);
  const ohne = vorausschau(spiel.zustand, spiel.startwerte,  spiel.runde);
  const werte = [...mit, ...ohne].map(p => p.ergebnis.saldo);
  const max = Math.max(0, ...werte), min = Math.min(...werte);
  const spanne = Math.max(40, max - min);
  const oben = max + spanne * 0.15, unten = min - spanne * 0.15;

  const x = (i, n) => RAND.l + (B - RAND.l - RAND.r) * (n === 1 ? 0.5 : i / (n - 1));
  const y = v => RAND.o + (H - RAND.o - RAND.u) * (1 - (v - unten) / (oben - unten));
  const pfad = bahn => bahn.map((p, i) => `${i ? 'L' : 'M'}${x(i, bahn.length).toFixed(1)} ${y(p.ergebnis.saldo).toFixed(1)}`).join(' ');

  const nulllinie = oben >= 0 && unten <= 0
    ? `<line x1="${RAND.l}" x2="${B - RAND.r}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"
             stroke="#4A6076" stroke-width="1"/>
       <text x="${RAND.l - 8}" y="${(y(0) + 4).toFixed(1)}" text-anchor="end"
             fill="#8FA6B8" font-size="11" font-family="JetBrains Mono, monospace">0</text>` : '';

  const marken = mit.map((p, i) => `
    <text x="${x(i, mit.length).toFixed(1)}" y="${H - 12}" text-anchor="middle"
          fill="#8FA6B8" font-size="11" font-family="JetBrains Mono, monospace">${p.jahre.von}</text>`).join('');

  const punkte = mit.map((p, i) => `
    <circle cx="${x(i, mit.length).toFixed(1)}" cy="${y(p.ergebnis.saldo).toFixed(1)}"
            r="${i === 0 ? 6 : 4}" fill="${i === 0 ? '#F0B23C' : '#0C1420'}"
            stroke="#F0B23C" stroke-width="2"/>
    <text x="${x(i, mit.length).toFixed(1)}" y="${(y(p.ergebnis.saldo) - 12).toFixed(1)}"
          text-anchor="middle" fill="#F2E3C4" font-size="12" font-weight="700"
          font-family="JetBrains Mono, monospace">${zahl(p.ergebnis.saldo, 0)}</text>`).join('');

  const ohneEnde = ohne[ohne.length - 1], mitEnde = mit[mit.length - 1];
  const unterschied = rund(mitEnde.ergebnis.saldo, 0) - rund(ohneEnde.ergebnis.saldo, 0);

  $('#horizont').innerHTML = `
    <svg viewBox="0 0 ${B} ${H}" role="img" aria-labelledby="horizont-text">
      <title id="horizont-text">Zwei Bahnen des Haushaltssaldos bis ${mitEnde.jahre.bis}.
        Mit dem jetzigen Beschluss endet sie bei ${zahl(mitEnde.ergebnis.saldo, 0)} Milliarden Euro,
        ohne ihn bei ${zahl(ohneEnde.ergebnis.saldo, 0)}.</title>
      <g stroke="#1E3044" stroke-width="1">
        ${[0, 0.25, 0.5, 0.75, 1].map(f =>
          `<line x1="${RAND.l}" x2="${B - RAND.r}"
                 y1="${(RAND.o + (H - RAND.o - RAND.u) * f).toFixed(1)}"
                 y2="${(RAND.o + (H - RAND.o - RAND.u) * f).toFixed(1)}"/>`).join('')}
      </g>
      ${nulllinie}
      <path d="${pfad(ohne)}" fill="none" stroke="#7E96AC" stroke-width="2"
            stroke-dasharray="7 5" vector-effect="non-scaling-stroke"/>
      <path d="${pfad(mit)}" fill="none" stroke="#F0B23C" stroke-width="3"
            vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      ${punkte}${marken}
    </svg>`;

  $('#horizont-lage').innerHTML = unterschied === 0
    ? `Die beiden Bahnen liegen übereinander: dieser Beschluss ändert am Kurs bis
       ${mitEnde.jahre.bis} nichts.`
    : `Bis <b>${mitEnde.jahre.bis}</b> endet der Kurs bei <b>${zahl(mitEnde.ergebnis.saldo, 0)} Mrd. €</b>
       — das sind <b>${mitVz(unterschied)} Mrd. €</b> gegenüber dem Nichtstun
       (${zahl(ohneEnde.ergebnis.saldo, 0)}). Die Schuldenquote liegt dann bei
       <b>${zahl(mitEnde.zustand.schuldenquote, 1)} %</b> statt
       ${zahl(ohneEnde.zustand.schuldenquote, 1)} %.`;

  $('#bahn-tabelle').innerHTML = mit.map((p, i) => `
    <tr${i === 0 ? ' class="jetzt"' : ''}>
      <td class="j">${p.jahre.text}</td>
      <td>${zahl(p.ergebnis.saldo, 0)}</td>
      <td class="matt">${zahl(ohne[i].ergebnis.saldo, 0)}</td>
      <td>${zahl(p.zustand.schuldenquote, 1)} %</td>
      <td>${zahl(p.ergebnis.emissionen, 0)}</td>
    </tr>`).join('');
}

// ── Rundinstrumente ────────────────────────────────────────────────────────
//
// Jeder Zeiger traegt seine Ziffer. Ein Instrument, das nur ueber einen
// Winkel spricht, ist fuer eine Vorlesesoftware stumm — und am Beamer in der
// letzten Reihe ohnehin nicht ablesbar.

function uhr(k) {
  const e = spiel.ergebnis, b = spiel.basis, t = diffText(k, e, b);
  const jetzt = k.lies(e), start = k.lies(b);
  const bezug = Math.max(Math.abs(start), Math.abs(jetzt), 1);
  const anteil = Math.max(-1, Math.min(1, (jetzt - start) / bezug / 0.5));
  const winkel = anteil * 130;
  const farbe = t.richtung === 'besser' ? '#5FC28E'
              : t.richtung === 'schlechter' ? '#E8604C' : '#F0B23C';
  return `
  <div class="uhr" data-richtung="${t.richtung}">
    <svg viewBox="0 0 120 120" role="img" aria-label="${k.name}: ${zahl(jetzt, k.n)}${k.einheit ? ' ' + k.einheit : ''}, ${t.text}">
      <circle cx="60" cy="60" r="54" fill="#0A1320" stroke="#2A3E56" stroke-width="3"/>
      <g stroke="#7E96AC" stroke-width="2">
        <path d="M60 10 v8"/><path d="M110 60 h-8"/><path d="M60 110 v-8"/><path d="M10 60 h8"/>
        <path d="M95 25 l-6 6"/><path d="M95 95 l-6 -6"/><path d="M25 95 l6 -6"/><path d="M25 25 l6 6"/>
      </g>
      <g transform="rotate(${winkel.toFixed(1)} 60 60)">
        <path d="M60 60 L60 20" stroke="${farbe}" stroke-width="3.5" stroke-linecap="round"/>
      </g>
      <circle cx="60" cy="60" r="5" fill="${farbe}"/>
      <text x="60" y="90" text-anchor="middle" fill="#D4E2EE"
            font-family="JetBrains Mono, monospace" font-size="16" font-weight="700"
      >${zahl(jetzt, k.n)}</text>
    </svg>
    <p class="bez">${k.name}</p>
    <p class="abl">${t.text}</p>
  </div>`;
}

// ── Telegraf ───────────────────────────────────────────────────────────────

function feldFuer(s) {
  const v = spiel.params[s.key];
  return s.klappe
    ? `<button type="button" class="klappe" id="e-${s.key}" aria-labelledby="l-${s.key} e-${s.key}"
         aria-pressed="${v ? 'true' : 'false'}">${v ? 'ja' : 'nein'}</button>`
    : `<input type="text" class="feld" id="e-${s.key}" value="${wertText(s, v)}"
         inputmode="decimal" autocomplete="off" spellcheck="false"
         aria-labelledby="l-${s.key}" aria-describedby="fehl-${s.key}">`;
}

function zeichneTelegraf() {
  $('#telegraf').innerHTML = RESSORTS.map(res => `
    <section class="gruppe" aria-labelledby="g-${res.id}">
      <h3 id="g-${res.id}">${res.name}</h3>
      ${res.stell.map(s => {
        const anteil = s.klappe ? (spiel.params[s.key] ? 100 : 0)
          : ((spiel.params[s.key] - s.min) / (s.max - s.min)) * 100;
        const start  = s.klappe ? (spiel.startwerte[s.key] ? 100 : 0)
          : ((spiel.startwerte[s.key] - s.min) / (s.max - s.min)) * 100;
        return `
        <div class="stell${spiel.bewegt(s.key) ? ' gestellt' : ''}" id="p-${s.key}">
          <div class="z">
            <label class="n" id="l-${s.key}" for="e-${s.key}">${s.bez}<a class="fn"
              href="#quellen" aria-label="Fundstelle ${FN[s.quelle]}">${FN[s.quelle]}</a></label>
            <span class="v">${feldFuer(s)}<span class="eh">${s.einheit}</span></span>
          </div>
          <div class="skala" aria-hidden="true">
            <i style="width:${Math.max(0, Math.min(100, anteil)).toFixed(1)}%"></i>
            <u style="left:${Math.max(0, Math.min(100, start)).toFixed(1)}%"></u></div>
          <p class="fehl" id="fehl-${s.key}" role="status" hidden></p>
        </div>`;
      }).join('')}
    </section>`).join('');
}

// ── Kopf und Rundenschluss ─────────────────────────────────────────────────

function zeichneRest() {
  $('#konsole').innerHTML = KENNZAHLEN.map(uhr).join('');
  $('#neben').innerHTML = NEBENWERTE.map(k => {
    const t = diffText(k, spiel.ergebnis, spiel.basis);
    return `<div class="nw" data-richtung="${t.richtung}">
      <p class="n">${k.name}</p>
      <p class="v">${zahl(k.lies(spiel.ergebnis), k.n)}<em> ${k.einheit}</em></p>
      <p class="d">${t.text}</p><p class="h">${k.hilfe}</p></div>`;
  }).join('');
  $('#wache').textContent =
    `Wache ${spiel.runde} von ${RUNDEN} · ${spiel.jahre.text} · `
    + `${spiel.bewegte.length} von ${ALLE.length} Stellgrößen bewegt`;
  const e = spiel.ergebnis;
  $('#bremse').textContent = e.schuldenbremse_ok
    ? `Schuldenbremse eingehalten — ${zahl(Math.abs(e.saldo_bip_pct), 2)} % des BIP.`
    : `Schuldenbremse gerissen — ${zahl(Math.abs(e.saldo_bip_pct), 2)} % des BIP statt 0,35 %.`;
  $('#bremse').dataset.ok = String(e.schuldenbremse_ok);
  const knopf = $('#abschluss');
  knopf.disabled = spiel.letzteRunde;
  knopf.textContent = spiel.letzteRunde
    ? `Wache ${spiel.runde} ist die letzte` : `Wache ${spiel.runde} übergeben`;
  $('#logbuch').innerHTML = spiel.verlauf.length === 0
    ? '<p class="leer">Noch keine Wache übergeben.</p>'
    : spiel.verlauf.map(v => `<p class="e"><b>Wache ${v.runde}</b> · ${v.jahre.text} ·
        Saldo ${zahl(v.ergebnis.saldo, 0)} Mrd. € · Gini ${zahl(v.ergebnis.gini, 3)}</p>`).join('');
}

function alles() { zeichneTelegraf(); bindeAlle(spiel, ALLE, knoten); zeichneHorizont(); zeichneRest(); }

/** Beim Tippen nur die Anzeigen nachziehen, nie die Felder neu setzen. */
function nurAnzeigen() {
  zeichneHorizont(); zeichneRest();
  for (const s of ALLE) {
    const zeile = document.getElementById(`p-${s.key}`);
    if (!zeile) continue;
    zeile.classList.toggle('gestellt', spiel.bewegt(s.key));
    const anteil = s.klappe ? (spiel.params[s.key] ? 100 : 0)
      : ((spiel.params[s.key] - s.min) / (s.max - s.min)) * 100;
    zeile.querySelector('.skala i').style.width = `${Math.max(0, Math.min(100, anteil)).toFixed(1)}%`;
  }
  zieheKlappenNach(spiel, ALLE, knoten);
}

$('#quellen-liste').innerHTML = quellen.map(q => `
  <li id="q-${q.id}"><p class="nr">${FN[q.id]}</p>
    <div><p class="betrifft">${q.stell.join(' · ')}</p>
      <p class="formel">${q.formel}</p><p class="ref">${q.ref}</p>
      ${q.note ? `<p class="note">${q.note}</p>` : ''}</div></li>`).join('');

spiel.aufAenderung(({ art }) => (art === 'runde' ? alles() : nurAnzeigen()));
$('#abschluss').addEventListener('click', () => spiel.schliesseRunde());
alles();
