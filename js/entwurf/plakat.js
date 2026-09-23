// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DIE LITFASSSAEULE — Steuerung
//
// Die Idee: jede Entscheidung muss sich einen SATZ leisten, mit dem man vor
// die Leute treten kann. Darum schreibt diese Flaeche die Parole aus dem
// Beschluss — und wer nichts beschliesst, bekommt kein Plakat, sondern eine
// leere Flaeche. Das Schweigen eines Ressorts ist hier sichtbar.
//
// Der Resonanzboden zeigt die Verschiebung der GRENZBELASTUNG je Dezil
// (ergebnis.metr aus der Engine). Kein gedeutetes Mass, kein erfundener Wert.
// ═══════════════════════════════════════════════════════════════════════════

import {
  erzeugeSpiel, RESSORTS, ALLE, KENNZAHLEN, NEBENWERTE, RUNDEN,
  benutzteQuellen, zahl, mitVz, rund, diffText, punkteText, wertText,
} from '../spielkern.js';
import { bindeAlle, zieheKlappenNach } from '../felder.js';
import { DEZILE } from '../data.js';

const spiel   = erzeugeSpiel();
const quellen = benutzteQuellen();
const $  = s => document.querySelector(s);
const FN = Object.fromEntries(quellen.map((q, i) => [q.id, i + 1]));

const knoten = (s) => ({
  eingabe: document.getElementById(`e-${s.key}`),
  fehler:  document.getElementById(`fehl-${s.key}`),
  zeile:   document.getElementById(`p-${s.key}`),
});

// ── Die Parole ─────────────────────────────────────────────────────────────
//
// Sie entsteht aus dem Beschluss, nicht aus einer Liste vorgefertigter
// Sprueche: sonst koennte man dieselbe Parole zu zwei gegensaetzlichen
// Politiken bekommen, und die Flaeche wuerde luegen.

const RICHTUNGSWORT = {
  freibetrag: ['Mehr steuerfrei zum Leben.',        'Weniger steuerfrei zum Leben.'],
  eingang:    ['Der Einstieg wird teurer.',          'Der Einstieg wird billiger.'],
  spitze:     ['Starke Schultern tragen mehr.',      'Starke Schultern werden entlastet.'],
  mwst:       ['Konsum wird teurer.',                'Konsum wird billiger.'],
  erb:        ['Erben wird stärker besteuert.',      'Erben wird milder besteuert.'],
  kst:        ['Gewinne werden stärker besteuert.',  'Gewinne werden entlastet.'],
  gewst:      ['Die Gewerbesteuer zieht an.',        'Die Gewerbesteuer gibt nach.'],
  rv:         ['Höhere Beiträge für die Rente.',     'Niedrigere Beiträge für die Rente.'],
  kv:         ['Höhere Beiträge für die Gesundheit.','Niedrigere Beiträge für die Gesundheit.'],
  bg:         ['Das Bürgergeld steigt.',             'Das Bürgergeld sinkt.'],
  kg:         ['Mehr Geld für Kinder.',              'Weniger Geld für Kinder.'],
  co2:        ['CO₂ wird teuer.',                    'CO₂ wird billiger.'],
  klimageld:  ['Und alles zurück ans Volk.',         'Ohne Rückgabe ans Volk.'],
};

function parole(res) {
  const bewegte = res.stell.filter(s => spiel.bewegt(s.key));
  if (bewegte.length === 0) return null;
  const saetze = bewegte.map(s => {
    const von = spiel.startwerte[s.key], nach = spiel.params[s.key];
    const hoch = s.klappe ? Boolean(nach) : nach > von;
    return RICHTUNGSWORT[s.key][hoch ? 0 : 1];
  });
  return saetze.slice(0, 2).join(' ');
}

/** Die Zahl unter der Parole: die Kennzahl, ueber die dieses Ressort wacht. */
function ressortZahl(res) {
  const k = KENNZAHLEN.find(x => x.id === res.kennzahl);
  const t = diffText(k, spiel.ergebnis, spiel.basis);
  return { name: k.name, wert: zahl(k.lies(spiel.ergebnis), k.n),
           einheit: k.einheit, dif: t.text, richtung: t.richtung };
}

// ── Die Wand ───────────────────────────────────────────────────────────────

function feldFuer(s) {
  const v = spiel.params[s.key];
  return s.klappe
    ? `<button type="button" class="klappe" id="e-${s.key}"
         aria-labelledby="l-${s.key} e-${s.key}"
         aria-pressed="${v ? 'true' : 'false'}">${v ? 'ja' : 'nein'}</button>`
    : `<input type="text" class="feld" id="e-${s.key}" value="${wertText(s, v)}"
         inputmode="decimal" autocomplete="off" spellcheck="false"
         aria-labelledby="l-${s.key}" aria-describedby="fehl-${s.key}">`;
}

function zeichneWand() {
  $('#wand').innerHTML = RESSORTS.map(res => {
    const p = parole(res), z = ressortZahl(res);
    return `
    <article class="plakat p-${res.id}${p ? ' geklebt' : ' leer'}" aria-labelledby="h-${res.id}">
      <p class="partei">${res.kurz}</p>
      <h2 id="h-${res.id}">${p ?? 'Noch nichts zu plakatieren.'}</h2>
      ${p ? '' : `<p class="stumm">Dieses Ressort hat in Runde ${spiel.runde} nichts entschieden.
                  Die Fläche bleibt frei — und das sieht man.</p>`}
      <div class="saetze">
        ${res.stell.map(s => `
          <div class="pos${spiel.bewegt(s.key) ? ' bewegt' : ''}" id="p-${s.key}">
            <label class="txt" id="l-${s.key}" for="e-${s.key}">${s.bez}<a class="fn"
              href="#quellen" aria-label="Fundstelle ${FN[s.quelle]}">${FN[s.quelle]}</a></label>
            <span class="eingabe">${feldFuer(s)}<span class="eh">${s.einheit}</span></span>
            <span class="fehl" id="fehl-${s.key}" role="status" hidden></span>
          </div>`).join('')}
      </div>
      <p class="zahl" data-richtung="${z.richtung}">
        <span class="e">${z.name}</span>
        <span class="w">${z.wert}${z.einheit ? `<em> ${z.einheit}</em>` : ''}</span>
        <span class="d">${z.dif}</span></p>
    </article>`;
  }).join('');
}

// ── Der Resonanzboden ──────────────────────────────────────────────────────
//
// Gezeigt wird die Verschiebung der effektiven GRENZBELASTUNG je Dezil —
// ergebnis.metr, wie die Engine sie ausgibt. Nicht das verfuegbare
// Einkommen: das gibt die Engine an dieser Stelle nicht als Dezilreihe
// heraus, und eine Zahl zu erfinden, waere schlimmer als sie wegzulassen.

function zeichneResonanz() {
  const jetzt = spiel.ergebnis.metr, start = spiel.basis.metr;
  const staerkste = Math.max(0.02, ...jetzt.map((v, i) => Math.abs(v - start[i])));
  $('#resonanz').innerHTML = DEZILE.map((d, i) => {
    const v = jetzt[i] * 100, s0 = start[i] * 100, diff = rund(v, 1) - rund(s0, 1);
    const anteil = Math.min(100, Math.abs(diff) / (staerkste * 100) * 100);
    return `<div class="gruppe" data-richtung="${diff > 0 ? 'mehr' : diff < 0 ? 'minder' : 'gleich'}">
      <p class="n"><span>${d.name ?? `D${i + 1}`}</span><span class="v">${zahl(v, 1)} %</span></p>
      <div class="bahn"><span class="mitte"></span>
        <i style="${diff >= 0 ? 'left:50%' : 'right:50%'};width:${anteil / 2}%"></i></div>
      <p class="note">${diff === 0 ? 'unverändert' : `${mitVz(diff, 1)} Prozentpunkte`}</p>
    </div>`;
  }).join('');
}

// ── Kopf, Bilanz, Rundenschluss ────────────────────────────────────────────

function zeichneKopf() {
  const geklebt = RESSORTS.filter(r => parole(r)).length;
  $('#lage').textContent =
    `Runde ${spiel.runde} von ${RUNDEN} · ${spiel.jahre.text} · `
    + `${geklebt} von ${RESSORTS.length} Ressorts haben plakatiert`;

  $('#bilanz').innerHTML = KENNZAHLEN.concat(NEBENWERTE.slice(0, 2)).map(k => {
    const t = diffText(k, spiel.ergebnis, spiel.basis);
    return `<div class="kz" data-richtung="${t.richtung}">
      <p class="n">${k.name}</p>
      <p class="v">${zahl(k.lies(spiel.ergebnis), k.n)}${k.einheit ? `<em> ${k.einheit}</em>` : ''}</p>
      <p class="d">${t.text}</p></div>`;
  }).join('');

  const e = spiel.ergebnis;
  $('#bremse').textContent = e.schuldenbremse_ok
    ? `Schuldenbremse eingehalten — Neuverschuldung ${zahl(Math.abs(e.saldo_bip_pct), 2)} % des BIP.`
    : `Schuldenbremse gerissen — Neuverschuldung ${zahl(Math.abs(e.saldo_bip_pct), 2)} % des BIP, `
      + 'zulässig sind 0,35 %.';
  $('#bremse').dataset.ok = String(e.schuldenbremse_ok);

  const knopf = $('#abschluss');
  knopf.disabled = spiel.letzteRunde;
  knopf.textContent = spiel.letzteRunde
    ? `Runde ${spiel.runde} ist die letzte` : `Runde ${spiel.runde} plakatieren und schließen`;
  $('#verlauf').innerHTML = spiel.verlauf.length === 0 ? ''
    : `<h3>Was schon an der Säule klebt</h3><ul>` + spiel.verlauf.map(v =>
        `<li><b>Runde ${v.runde}</b> · ${v.jahre.text} · Saldo ${zahl(v.ergebnis.saldo, 0)} Mrd. €</li>`
      ).join('') + '</ul>';
}

function alles() { zeichneWand(); bindeAlle(spiel, ALLE, knoten); zeichneResonanz(); zeichneKopf(); }

/** Beim Tippen darf die Wand nicht neu gesetzt werden — sonst bricht die Eingabe ab. */
function nurZahlen() {
  zeichneResonanz();
  zeichneKopf();
  for (const res of RESSORTS) {
    const p = parole(res), z = ressortZahl(res);
    const karte = document.querySelector(`.plakat.p-${res.id}`);
    karte.classList.toggle('geklebt', Boolean(p));
    karte.classList.toggle('leer', !p);
    document.getElementById(`h-${res.id}`).textContent = p ?? 'Noch nichts zu plakatieren.';
    const zeile = karte.querySelector('.zahl');
    zeile.dataset.richtung = z.richtung;
    zeile.querySelector('.w').innerHTML = z.wert + (z.einheit ? `<em> ${z.einheit}</em>` : '');
    zeile.querySelector('.d').textContent = z.dif;
    const stumm = karte.querySelector('.stumm');
    if (stumm) stumm.hidden = Boolean(p);
  }
  for (const s of ALLE) {
    document.getElementById(`p-${s.key}`)?.classList.toggle('bewegt', spiel.bewegt(s.key));
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
