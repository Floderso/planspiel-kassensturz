// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DER KASSENBON — Steuerung
//
// Die Idee dieses Entwurfs ist, dass der Bon MITDRUCKT. Daraus folgt eine
// Entscheidung, die ihn von den vier anderen trennt: die Werte auf dem Beleg
// sind selbst die Eingabefelder. Es gibt kein Bedienfeld neben dem Ergebnis,
// das man mit dem Ergebnis abgleichen muesste — man schreibt in den Beleg.
//
// Alles Rechnen liegt in ../rechner/. Diese Datei zeichnet nur.
// ═══════════════════════════════════════════════════════════════════════════

import {
  erzeugeSpiel, RESSORTS, ALLE, KENNZAHLEN, NEBENWERTE, RUNDEN,
  benutzteQuellen, zahl, mitVz, rund, zeigDiff, diffText, punkteText, gedruckterSaldo,
  wertText,
} from '../spielkern.js';
import { bindeAlle, zieheKlappenNach } from '../felder.js';

/** Zu einer Stellgroesse ihre drei Knoten im Beleg. */
const knoten = (s) => ({
  eingabe: document.getElementById(`e-${s.key}`),
  fehler:  document.getElementById(`fehl-${s.key}`),
  zeile:   document.getElementById(`p-${s.key}`),
});

const spiel   = erzeugeSpiel();
const quellen = benutzteQuellen();
const $ = s => document.querySelector(s);

/** Fussnotenziffer je Quelle — einmal vergeben, ueberall dieselbe. */
const FN = Object.fromEntries(quellen.map((q, i) => [q.id, i + 1]));

// ── Der Beleg ──────────────────────────────────────────────────────────────

function zeileFuer(s) {
  const v = spiel.params[s.key];
  const start = spiel.startwerte[s.key];
  const bewegt = v !== start;
  const feld = s.klappe
    ? `<button type="button" class="klappe" id="e-${s.key}"
         aria-labelledby="l-${s.key} e-${s.key}" aria-pressed="${v ? 'true' : 'false'}"
       >${v ? 'ja' : 'nein'}</button>`
    : `<input type="text" class="feld" id="e-${s.key}" value="${wertText(s, v)}"
         inputmode="decimal" autocomplete="off" spellcheck="false"
         aria-labelledby="l-${s.key}" aria-describedby="fehl-${s.key}"
         size="${String(s.max).length + (s.nk ? s.nk + 1 : 0)}">`;
  return `
    <div class="pos${bewegt ? ' bewegt' : ''}" id="p-${s.key}">
      <span class="txt" id="l-${s.key}">${s.bez}<a class="fn"
        href="#quellen" aria-label="Fundstelle ${FN[s.quelle]}">${FN[s.quelle]}</a></span>
      <span class="eingabe">${feld}<span class="eh">${s.einheit}</span></span>
      ${bewegt ? `<span class="storno">zuvor ${wertText(s, start)}</span>` : ''}
      <span class="fehl" id="fehl-${s.key}" role="status" hidden></span>
    </div>`;
}

function druckeBon() {
  $('#bon-kopf').innerHTML =
    `Runde ${spiel.runde} von ${RUNDEN} · ${spiel.jahre.text}<br>`
    + `Bon-Nr. ${String(spiel.runde).padStart(4, '0')} · alle Beträge Mrd. €`;

  $('#posten').innerHTML = RESSORTS.map(r => `
    <section class="block" aria-labelledby="k-${r.id}">
      <h2 class="kap" id="k-${r.id}">${r.name.toUpperCase()}</h2>
      ${r.stell.map(zeileFuer).join('')}
    </section>`).join('');

  druckeAbschnittUnten();
}

/**
 * Alles unterhalb der Posten. Steht als eigene Funktion, weil es bei jeder
 * Eingabe neu gesetzt wird — die Posten selbst duerfen dabei NICHT angefasst
 * werden, sonst verliert das Feld, in das gerade getippt wird, den Fokus.
 */
function druckeAbschnittUnten() {
  const e = spiel.ergebnis, b = spiel.basis;

  // Der ausgewiesene Saldo entsteht aus den ausgewiesenen Summanden, damit
  // die Spalte aufgeht — siehe gedruckterSaldo() im Spielkern.
  const sJetzt = gedruckterSaldo(e), sStart = gedruckterSaldo(b);
  $('#summen').innerHTML = `
    <div class="z"><span>Summe Einnahmen</span><b>${zahl(e.einnahmen_total, 2)}</b></div>
    <div class="z"><span>Summe Ausgaben</span><b>${zahl(e.ausgaben_total, 2)}</b></div>
    <div class="trenn"></div>
    <div class="z gross ${sJetzt < 0 ? 'rot' : 'gruen'}">
      <span>KASSENSTURZ</span><b>${zahl(sJetzt, 2)}</b></div>
    <div class="z sub"><span>zum Rundenstart</span><b>${zahl(sStart, 2)}</b></div>
    <div class="z sub"><span>Veränderung</span><b>${mitVz(rund(sJetzt, 0) - rund(sStart, 0))}</b></div>`;

  $('#stempel').hidden = e.schuldenbremse_ok;
  $('#stempel-ok').hidden = !e.schuldenbremse_ok;

  $('#neben').innerHTML = KENNZAHLEN.slice(1).concat(NEBENWERTE.slice(0, 2)).map(k => {
    const t = diffText(k, e, b);
    return `<div class="z" data-richtung="${t.richtung}">
      <span>${k.name}${k.einheit ? ` ${k.einheit}` : ''}</span>
      <b>${zahl(k.lies(e), k.n)}<em> ${t.text}</em></b></div>`;
  }).join('');

  druckeProtokoll();
  druckeLade();
}

/**
 * Das Buchungsprotokoll. Es steht bewusst NICHT neben jeder Zeile, sondern
 * einmal am Fuss: eine Offenlegung unter jeder einzelnen Stellgroesse
 * wiederholt sich zwoelfmal und wird dann von niemandem mehr gelesen.
 */
function druckeProtokoll() {
  const bewegte = spiel.bewegte;
  $('#protokoll').innerHTML = bewegte.length === 0
    ? `<p class="leerzeile">— keine Buchung in dieser Runde —</p>`
    : bewegte.map(s => {
        const von = spiel.startwerte[s.key], nach = spiel.params[s.key];
        const mass = s.klappe ? `${wertText(s, von)} → ${wertText(s, nach)}`
          : s.einheit === '%' ? punkteText(von, nach, s.nk)
          : `${mitVz(rund(nach, s.nk) - rund(von, s.nk), s.nk)} ${s.einheit}`;
        return `<div class="z"><span>${s.bez}</span><b>${mass}</b></div>`;
      }).join('');
  $('#protokoll-zahl').textContent = bewegte.length === 1
    ? '1 Buchung' : `${bewegte.length} Buchungen`;
}

// ── Die Lade ───────────────────────────────────────────────────────────────

function druckeLade() {
  const e = spiel.ergebnis, b = spiel.basis;
  $('#faecher').innerHTML = KENNZAHLEN.map(k => {
    const t = diffText(k, e, b);
    return `<div class="fach" data-richtung="${t.richtung}">
      <p class="kat">${k.name}</p>
      <p class="wert">${zahl(k.lies(e), k.n)}<em>${k.einheit ? ' ' + k.einheit : ''}</em></p>
      <p class="dif">${t.text}</p></div>`;
  }).join('') + NEBENWERTE.map(k => {
    const t = diffText(k, e, b);
    return `<div class="fach neben" data-richtung="${t.richtung}">
      <p class="kat">${k.name}</p>
      <p class="wert">${zahl(k.lies(e), k.n)}<em> ${k.einheit}</em></p>
      <p class="dif">${t.text}</p></div>`;
  }).join('') + Array.from({ length: RUNDEN - spiel.runde }, (_, i) =>
    `<div class="fach leer">Runde ${spiel.runde + i + 1}<br>noch leer</div>`).join('');

  $('#verlauf').innerHTML = spiel.verlauf.length === 0 ? ''
    : `<h3>Abgeschlossene Runden</h3>` + spiel.verlauf.map(v =>
        `<div class="z"><span>Runde ${v.runde} · ${v.jahre.text}</span>
         <b>${zahl(v.ergebnis.saldo, 0)} Mrd. €</b></div>`).join('');

  const knopf = $('#abschluss');
  knopf.disabled = spiel.letzteRunde;
  knopf.textContent = spiel.letzteRunde
    ? `Runde ${spiel.runde} ist die letzte` : `Runde ${spiel.runde} abschließen`;
  $('#abschluss-hinweis').textContent = spiel.letzteRunde
    ? 'Der Kurs endet nach dieser Runde.'
    : `Schließt die Jahre ${spiel.jahre.text} ab. Schuldenstand, Wirtschaftsleistung und `
      + 'kumuliertes CO₂ werden in die nächste Runde fortgeschrieben.';
}

// ── Eingaben ───────────────────────────────────────────────────────────────

// ── Quellen: einmal, nicht zwoelfmal ───────────────────────────────────────

function druckeQuellen() {
  $('#quellen-liste').innerHTML = quellen.map(q => `
    <li id="q-${q.id}"><p class="nr">${FN[q.id]}</p>
      <div><p class="betrifft">${q.stell.join(' · ')}</p>
        <p class="formel">${q.formel}</p>
        <p class="ref">${q.ref}</p>
        ${q.note ? `<p class="note">${q.note}</p>` : ''}</div></li>`).join('');
}

// ── Start ──────────────────────────────────────────────────────────────────

spiel.aufAenderung(({ art }) => {
  if (art === 'runde') { druckeBon(); bindeAlle(spiel, ALLE, knoten); }
  else {
    // Beim Tippen darf der Beleg nicht unter der Hand neu gesetzt werden —
    // sonst verliert das Feld den Fokus und die Eingabe bricht ab.
    druckeAbschnittUnten();
    kennzeichneBewegte();
  }
});

/** Nur die Klassen nachziehen, ohne die Felder neu zu setzen. */
function kennzeichneBewegte() {
  for (const s of ALLE) {
    const zeile = document.getElementById(`p-${s.key}`);
    if (!zeile) continue;
    const bewegt = spiel.bewegt(s.key);
    zeile.classList.toggle('bewegt', bewegt);
    let st = zeile.querySelector('.storno');
    if (bewegt && !st) {
      st = document.createElement('span');
      st.className = 'storno';
      zeile.insertBefore(st, zeile.querySelector('.fehl'));
    }
    if (st) st.textContent = bewegt ? `zuvor ${wertText(s, spiel.startwerte[s.key])}` : '';
    if (!bewegt && st) st.remove();
  }
  zieheKlappenNach(spiel, ALLE, knoten);
}

$('#abschluss').addEventListener('click', () => {
  if (spiel.schliesseRunde()) $('#bon-kopf').focus();
});

druckeBon();
bindeAlle(spiel, ALLE, knoten);
druckeQuellen();
