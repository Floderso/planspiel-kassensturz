// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DIE BÜHNE — D1 Vortrag, D2 Regie
//
// Zwei Ansichten in einem Dokument:
//   D2 Regie   Was soll gezeigt werden, in welcher Reihenfolge?
//   D1 Bühne   Vollbild, ein Schritt je Aussage, Pfeiltasten.
//
// ── Was auf der Bühne NICHT steht ──────────────────────────────────────────
// Keine Navigation, keine Menüs, keine Bedienelemente. Wer vor einem Raum
// steht, soll auf seine Zahlen zeigen koennen und nicht auf Knoepfe. Verlassen
// wird die Buehne mit Escape.
//
// Die Quellen sind die Schaukaesten aus Stufe 9 — nichts wird hier zweitens
// zusammengestellt. Wer etwas anderes zeigen will, aendert seinen Schaukasten.
// ═══════════════════════════════════════════════════════════════════════════

import { hatBackend, holeSitzung, ServerFehler } from './dienste/server.js';
import { hole, merke } from './dienste/speicher.js';
import { zeichneSchaukasten } from './schaukasten.js';
import { spieleNach, vorausschau, RESSORTS, KENNZAHLEN,
         zahl, mitVz, rund, diffText } from './spielkern.js';

const $ = s => document.querySelector(s);
const P = new URLSearchParams(location.search);
const SITZUNG_ID = P.get('session');
const TEAM_PARAM = P.get('team');

let bahn = [], vorlagen = [], schaukaesten = {};
let teamName = null, anzeigename = null;
let bausteine = [];     // alles, was gezeigt werden kann
let folge = [];         // die gewaehlte Reihenfolge, als Baustein-Kennungen
let schritt = 0;

// ── Laden ──────────────────────────────────────────────────────────────────

async function lade() {
  const eigen = hole('person', SITZUNG_ID ?? 'lokal', {}) ?? {};
  teamName = TEAM_PARAM ?? eigen.team ?? null;

  if (SITZUNG_ID && hatBackend() && teamName) {
    try {
      const stand = await holeSitzung(SITZUNG_ID, { zeitlimit: 8000 });
      const t = stand?.teams?.[teamName];
      anzeigename = t?.anzeigename ?? null;
      schaukaesten = t?.schaukaesten ?? {};
      const perioden = (t?.perioden ?? []).filter(p => p.locked);
      bahn = spieleNach(perioden);
      vorlagen = perioden.map(p => p.vorlagen ?? {});
    } catch (f) {
      return scheitern(f instanceof ServerFehler
        ? `Die Sitzung ist nicht erreichbar: ${f.message}` : 'Die Sitzung ist nicht erreichbar.');
    }
  } else {
    const abgelegt = hole('verlauf', SITZUNG_ID ?? 'lokal', null);
    if (!abgelegt?.perioden?.length) {
      return scheitern('Noch keine abgeschlossene Runde. Für einen Vortrag braucht es '
        + 'mindestens eine gespielte Periode.');
    }
    teamName = abgelegt.team ?? 'Am eigenen Gerät';
    bahn = spieleNach(abgelegt.perioden);
    vorlagen = abgelegt.perioden.map(p => p.vorlagen ?? {});
    schaukaesten = { [RESSORTS[0].id]: hole('schaukasten', SITZUNG_ID ?? 'lokal', []) ?? [] };
  }

  if (bahn.length === 0) return scheitern('Noch keine abgeschlossene Runde.');

  baueBausteine();
  folge = hole('regie', SITZUNG_ID ?? 'lokal', null) ?? bausteine.map(b => b.id);
  folge = folge.filter(id => bausteine.some(b => b.id === id));

  $('#laedt').hidden = true;
  zeigeAnsicht();
}

const scheitern = (text) => { $('#laedt').textContent = text; };

// ── Die Bausteine ──────────────────────────────────────────────────────────

function aussage() {
  const erste = bahn[0].ergebnis, letzte = bahn.at(-1).ergebnis;
  const s0 = rund(erste.saldo, 0), s1 = rund(letzte.saldo, 0);
  const gerissen = bahn.filter(b => !b.ergebnis.schuldenbremse_ok).length;
  const teile = [s1 > s0
    ? `Wir haben den Fehlbetrag von ${zahl(Math.abs(s0))} auf ${zahl(Math.abs(s1))} Milliarden gedrückt.`
    : s1 < s0
      ? `Der Fehlbetrag ist von ${zahl(Math.abs(s0))} auf ${zahl(Math.abs(s1))} Milliarden gewachsen.`
      : `Der Fehlbetrag liegt unverändert bei ${zahl(Math.abs(s1))} Milliarden.`];
  teile.push(gerissen === 0 ? 'Die Schuldenbremse haben wir immer eingehalten.'
    : gerissen === bahn.length ? 'Die Schuldenbremse haben wir nie eingehalten.'
    : `Die Schuldenbremse haben wir in ${gerissen} von ${bahn.length} Perioden gerissen.`);
  return teile.join(' ');
}

function baueBausteine() {
  bausteine = [];
  bausteine.push({ id: 'titel', gruppe: 'Team', name: 'Titelbild',
    was: `${anzeigename ?? teamName} · ${bahn.length} Perioden` });
  bausteine.push({ id: 'aussage', gruppe: 'Team', name: 'Die Aussage',
    was: aussage().slice(0, 70) + '…' });
  for (const k of KENNZAHLEN) {
    bausteine.push({ id: `kz-${k.id}`, gruppe: 'Team', name: k.name,
      was: `Verlauf über ${bahn.length} Perioden`, kennzahl: k.id });
  }
  bausteine.push({ id: 'nichtstun', gruppe: 'Team', name: 'Gegen das Nichtstun',
    was: 'Euer Weg gegen den Status quo' });

  for (const r of RESSORTS) {
    const stuecke = schaukaesten[r.id] ?? [];
    stuecke.forEach((st, i) => {
      bausteine.push({ id: `sk-${r.id}-${i}`, gruppe: r.name,
        name: st.text ? st.text.slice(0, 44) : `Stück ${i + 1}`,
        was: `aus dem Schaukasten · ${st.art}`, ressort: r.id, index: i });
    });
  }
}

// ── D2 · Die Regie ─────────────────────────────────────────────────────────

function zeichneRegie() {
  const gruppen = [...new Set(bausteine.map(b => b.gruppe))];
  $('#quellen').innerHTML = gruppen.map(g => `
    <section class="qgruppe">
      <h3>${g}</h3>
      ${bausteine.filter(b => b.gruppe === g).map(b => `
        <label class="qz">
          <input type="checkbox" data-id="${b.id}" ${folge.includes(b.id) ? 'checked' : ''}>
          <span class="qn">${b.name}</span>
          <span class="qw">${b.was}</span>
        </label>`).join('')}
    </section>`).join('');

  $('#folge').innerHTML = folge.length === 0
    ? '<p class="leer">Nichts gewählt. Links auswählen, was gezeigt werden soll.</p>'
    : folge.map((id, i) => {
        const b = bausteine.find(x => x.id === id);
        return `<div class="fz">
          <span class="fn">${i + 1}. ${b?.name ?? id}</span>
          <span class="fk">
            <button type="button" class="hoch" data-i="${i}" ${i === 0 ? 'disabled' : ''}
              aria-label="Nach oben">↑</button>
            <button type="button" class="runter" data-i="${i}"
              ${i === folge.length - 1 ? 'disabled' : ''} aria-label="Nach unten">↓</button>
          </span></div>`;
      }).join('');

  $('#folge-zahl').textContent = `${folge.length} Schritt${folge.length === 1 ? '' : 'e'}`;
  $('#los').disabled = folge.length === 0;

  for (const k of document.querySelectorAll('#quellen input')) {
    k.addEventListener('change', () => {
      const id = k.dataset.id;
      folge = k.checked ? [...folge, id] : folge.filter(x => x !== id);
      sichereFolge();
    });
  }
  for (const k of document.querySelectorAll('.hoch')) {
    k.addEventListener('click', () => tausche(Number(k.dataset.i), -1));
  }
  for (const k of document.querySelectorAll('.runter')) {
    k.addEventListener('click', () => tausche(Number(k.dataset.i), +1));
  }
}

function tausche(i, richtung) {
  const j = i + richtung;
  if (j < 0 || j >= folge.length) return;
  [folge[i], folge[j]] = [folge[j], folge[i]];
  sichereFolge();
}

function sichereFolge() {
  merke('regie', SITZUNG_ID ?? 'lokal', folge);
  zeichneRegie();
}

// ── D1 · Die Bühne ─────────────────────────────────────────────────────────

function zeichneSchritt() {
  const id = folge[schritt];
  const b = bausteine.find(x => x.id === id);
  if (!b) return;

  let inhalt = '';
  if (b.id === 'titel') {
    inhalt = `<p class="b-titel">${anzeigename ?? teamName}</p>
      <p class="b-unter">${anzeigename ? `${teamName} · ` : ''}${bahn.length} Perioden ·
        ${bahn[0].jahre.von}–${bahn.at(-1).jahre.bis}</p>`;
  } else if (b.id === 'aussage') {
    inhalt = `<p class="b-aussage">${aussage()}</p>`;
  } else if (b.id === 'nichtstun') {
    const ohne = vorausschau({ ...bahn[0].zustand }, {}, 1).slice(0, bahn.length);
    const d = rund(bahn.at(-1).ergebnis.saldo, 0) - rund(ohne.at(-1).ergebnis.saldo, 0);
    inhalt = `<p class="b-zahl">${mitVz(d)}<em> Mrd. €</em></p>
      <p class="b-satz">gegenüber dem Nichtstun</p>
      <p class="b-klein">${bahn.map((x, i) =>
        `P${i + 1}: ${zahl(x.ergebnis.saldo, 0)} statt ${zahl(ohne[i].ergebnis.saldo, 0)}`)
        .join(' · ')}</p>`;
  } else if (b.kennzahl) {
    const k = KENNZAHLEN.find(x => x.id === b.kennzahl);
    const t = bahn.length > 1 ? diffText(k, bahn.at(-1).ergebnis, bahn[0].ergebnis) : null;
    inhalt = `<p class="b-zahl">${zahl(k.lies(bahn.at(-1).ergebnis), k.n)}<em>${
        k.einheit ? ` ${k.einheit}` : ''}</em></p>
      <p class="b-satz">${k.name}${t ? ` · ${t.text} seit Periode 1` : ''}</p>
      <p class="b-reihe">${bahn.map((x, i) =>
        `<span><b>P${i + 1}</b>${zahl(k.lies(x.ergebnis), k.n)}</span>`).join('')}</p>`;
  } else if (b.ressort !== undefined) {
    const st = (schaukaesten[b.ressort] ?? [])[b.index];
    const r = RESSORTS.find(x => x.id === b.ressort);
    inhalt = `<p class="b-quelle">${r ? r.name : b.ressort}</p>
      <div class="b-stueck">${zeichneSchaukasten([st], bahn,
        { ressort: b.ressort, vorlagen })}</div>`;
  }

  $('#buehne-inhalt').innerHTML = inhalt;
  $('#buehne-stand').textContent = `${schritt + 1} / ${folge.length}`;
  $('#buehne-melder').textContent = `Schritt ${schritt + 1} von ${folge.length}: ${b.name}`;
}

function blaettere(um) {
  const neu = schritt + um;
  if (neu < 0 || neu >= folge.length) return;
  schritt = neu;
  zeichneSchritt();
}

async function betritt() {
  schritt = 0;
  location.hash = '#buehne';
  try { await document.documentElement.requestFullscreen?.(); } catch (_) { /* geht auch ohne */ }
}

function verlasse() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  location.hash = '#regie';
}

addEventListener('keydown', (ev) => {
  if (lesAnsicht() !== 'buehne') return;
  if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'PageDown') {
    ev.preventDefault(); blaettere(+1);
  } else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') {
    ev.preventDefault(); blaettere(-1);
  } else if (ev.key === 'Escape') {
    verlasse();
  } else if (ev.key === 'Home') { schritt = 0; zeichneSchritt(); }
  else if (ev.key === 'End') { schritt = folge.length - 1; zeichneSchritt(); }
});

// ── Ansichtswechsel ────────────────────────────────────────────────────────

const lesAnsicht = () => location.hash === '#buehne' ? 'buehne' : 'regie';

function zeigeAnsicht() {
  const a = lesAnsicht();
  $('#regie').hidden = a !== 'regie';
  $('#buehne').hidden = a !== 'buehne';
  document.body.dataset.ansicht = a;
  if (a === 'regie') { zeichneRegie(); $('#regie-titel')?.focus(); }
  else { zeichneSchritt(); $('#buehne').focus(); }
}

addEventListener('hashchange', zeigeAnsicht);

$('#los').addEventListener('click', betritt);
$('#raus').addEventListener('click', verlasse);
$('#vor').addEventListener('click', () => blaettere(+1));
$('#zurueck').addEventListener('click', () => blaettere(-1));

lade();
