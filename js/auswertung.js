// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DIE AUSWERTUNG — C1 Gesamtauswertung, C2 Werkstattbericht
//
// Eine eigene Seite, weil sie nur LIEST. Sie braucht den Spielstand nicht im
// Speicher zu haben: `spieleNach()` rechnet den Weg aus den gespeicherten
// Parametern nach — mit denselben Funktionen wie am Tisch.
//
// ── Warum hier nicht zugerechnet wird ──────────────────────────────────────
// Entschieden am 21.09.2026: kein Ressort bekommt eine Zahl, die behauptet,
// SEIN Anteil am Ergebnis sei so und so gross. Die Engine rechnet
// Wechselwirkungen; jede Zerlegung waere Scheingenauigkeit, und im Seminar
// wuerde ueber die Zerlegung gestritten statt ueber die Politik.
//
// Stattdessen dokumentiert C2 eine ABFOLGE: was geaendert wurde, warum, und
// was danach anders war. Die dritte Spalte heisst bewusst nicht "Wirkung".
// ═══════════════════════════════════════════════════════════════════════════

import { hatBackend, holeSitzung, setzeSchaukasten, ServerFehler } from './dienste/server.js';
import { ARTEN, zeichneSchaukasten } from './schaukasten.js';
import { hole, merke } from './dienste/speicher.js';
import { spieleNach, vorausschau, RESSORTS, ALLE, KENNZAHLEN, NEBENWERTE,
         zahl, mitVz, rund, diffText, wertText } from './spielkern.js';

const $ = s => document.querySelector(s);
const P = new URLSearchParams(location.search);
const SITZUNG_ID = P.get('session');
const TEAM_PARAM = P.get('team');

let bahn = [];        // nachgespielte Perioden
let vorlagen = [];    // je Periode die Vorlagen
let teamName = null;
let anzeigename = null;
let meinRessort = null;
let stuecke = [];          // der Schaukasten in Arbeit
const HOECHSTENS = 5;

// ── Laden ──────────────────────────────────────────────────────────────────

async function lade() {
  const eigen = hole('person', SITZUNG_ID ?? 'lokal', {}) ?? {};
  teamName = TEAM_PARAM ?? eigen.team ?? null;
  meinRessort = eigen.rolle ?? null;

  if (SITZUNG_ID && hatBackend() && teamName) {
    try {
      const stand = await holeSitzung(SITZUNG_ID, { zeitlimit: 8000 });
      const t = stand?.teams?.[teamName];
      anzeigename = t?.anzeigename ?? null;
      const perioden = (t?.perioden ?? []).filter(p => p.locked || p.idx === 0);
      bahn = spieleNach(perioden);
      vorlagen = perioden.map(p => p.vorlagen ?? {});
      if (meinRessort) stuecke = [...(t?.schaukaesten?.[meinRessort] ?? [])];
    } catch (f) {
      return scheitern(f instanceof ServerFehler
        ? `Die Sitzung ist nicht erreichbar: ${f.message}` : 'Die Sitzung ist nicht erreichbar.');
    }
  } else {
    // Am eigenen Geraet: der Verlauf, den die Spielflaeche abgelegt hat.
    const abgelegt = hole('verlauf', SITZUNG_ID ?? 'lokal', null);
    if (!abgelegt?.perioden?.length) {
      return scheitern('Noch keine abgeschlossene Runde. Spiel erst eine Runde zu Ende — '
        + 'die Auswertung braucht mindestens einen Beschluss.');
    }
    teamName = abgelegt.team ?? 'Am eigenen Gerät';
    bahn = spieleNach(abgelegt.perioden);
    vorlagen = abgelegt.perioden.map(p => p.vorlagen ?? {});
    meinRessort ??= RESSORTS[0].id;
    stuecke = hole('schaukasten', SITZUNG_ID ?? 'lokal', []) ?? [];
  }

  if (bahn.length === 0) {
    return scheitern('Noch keine abgeschlossene Runde.');
  }
  $('#laedt').hidden = true;
  $('#auswertung').hidden = false;
  zeichne();
}

function scheitern(text) {
  $('#laedt').textContent = text;
}

// ── C1 · Die Aussage ───────────────────────────────────────────────────────
//
// Oben steht ein Satz, kein Diagramm. Wer nach fuenf Runden auf die Seite
// kommt, will zuerst wissen, was herausgekommen ist — nicht eine Achse lesen.

function aussage() {
  const erste = bahn[0].ergebnis, letzte = bahn.at(-1).ergebnis;
  const teile = [];

  const s0 = rund(erste.saldo, 0), s1 = rund(letzte.saldo, 0);
  if (s1 > s0) {
    teile.push(`Ihr habt den Fehlbetrag von ${zahl(Math.abs(s0))} auf `
             + `${zahl(Math.abs(s1))} Milliarden gedrückt.`);
  } else if (s1 < s0) {
    teile.push(`Der Fehlbetrag ist von ${zahl(Math.abs(s0))} auf `
             + `${zahl(Math.abs(s1))} Milliarden gewachsen.`);
  } else {
    teile.push(`Der Fehlbetrag liegt unverändert bei ${zahl(Math.abs(s1))} Milliarden.`);
  }

  const co0 = rund(erste.emissionen, 0), co1 = rund(letzte.emissionen, 0);
  if (co1 !== co0) {
    const anteil = Math.round(Math.abs(co1 - co0) / co0 * 100);
    teile.push(`Die Emissionen habt ihr um ${anteil} Prozent `
             + `${co1 < co0 ? 'gesenkt' : 'steigen lassen'}.`);
  }

  const g0 = rund(erste.gini, 3), g1 = rund(letzte.gini, 3);
  if (g1 !== g0) {
    teile.push(g1 < g0
      ? `Die Einkommen sind zusammengerückt — der Gini fiel von ${zahl(g0, 3)} auf ${zahl(g1, 3)}.`
      : `Die Einkommen haben sich gespreizt — der Gini stieg von ${zahl(g0, 3)} auf ${zahl(g1, 3)}.`);
  }

  const gerissen = bahn.filter(b => !b.ergebnis.schuldenbremse_ok).length;
  teile.push(gerissen === 0
    ? 'Die Schuldenbremse habt ihr in jeder Periode eingehalten.'
    : gerissen === bahn.length
      ? 'Die Schuldenbremse habt ihr in keiner Periode eingehalten.'
      : `Die Schuldenbremse habt ihr in ${gerissen} von ${bahn.length} Perioden gerissen.`);

  return teile.join(' ');
}

// ── C1 · Zeitreihen ────────────────────────────────────────────────────────
//
// Eine je Kennzahl. Jede traegt ihre Zahlen auch als Text — eine Kurve
// allein ist fuer eine Vorlesesoftware stumm und am Beamer oft unlesbar.

function zeitreihe(k) {
  const werte = bahn.map(b => k.lies(b.ergebnis));
  const min = Math.min(...werte), max = Math.max(...werte);
  const spanne = Math.max(Math.abs(max - min), Math.abs(max) * 0.05, 1);
  const oben = max + spanne * 0.2, unten = min - spanne * 0.2;
  const B = 460, H = 130, L = 8, R = 8, O = 14, U = 24;

  const x = (i) => L + (B - L - R) * (werte.length === 1 ? 0.5 : i / (werte.length - 1));
  const y = (v) => O + (H - O - U) * (1 - (v - unten) / (oben - unten));
  const pfad = werte.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const t = diffText(k, bahn.at(-1).ergebnis, bahn[0].ergebnis);

  return `
  <figure class="reihe" data-richtung="${t.richtung}">
    <figcaption>
      <span class="rn">${k.name}</span>
      <span class="rw">${zahl(werte.at(-1), k.n)}${k.einheit ? ` <em>${k.einheit}</em>` : ''}</span>
      <span class="rd">${bahn.length > 1 ? `${t.text} seit Periode 1` : 'erste Periode'}</span>
    </figcaption>
    <svg viewBox="0 0 ${B} ${H}" role="img" aria-label="${k.name} über ${bahn.length} Perioden: ${
      bahn.map((b, i) => `Periode ${i + 1} ${zahl(werte[i], k.n)}`).join(', ')}">
      ${oben >= 0 && unten <= 0
        ? `<line x1="${L}" x2="${B - R}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"
             stroke="#C6BEA8" stroke-width="1" stroke-dasharray="4 4"/>` : ''}
      <path d="${pfad}" fill="none" stroke="currentColor" stroke-width="2.5"
            vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      ${werte.map((v, i) => `
        <circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" fill="currentColor"/>
        <text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10"
              fill="#585F54" font-family="JetBrains Mono, monospace">${i + 1}</text>`).join('')}
    </svg>
    <table class="zahlen">
      <caption>${k.name} je Periode</caption>
      <tbody><tr>${bahn.map((b, i) =>
        `<th scope="col">P${i + 1}</th>`).join('')}</tr>
      <tr>${werte.map(v => `<td>${zahl(v, k.n)}</td>`).join('')}</tr></tbody>
    </table>
  </figure>`;
}

// ── C1 · Die Beschlüsse ────────────────────────────────────────────────────

function beschlusstabelle() {
  const zeilen = [];
  bahn.forEach((b, i) => {
    const v = vorlagen[i] ?? {};
    for (const r of RESSORTS) {
      const vor = v[r.id];
      if (!vor) continue;
      const aend = Object.entries(vor.aenderungen ?? {}).map(([key, w]) => {
        const st = ALLE.find(x => x.key === key);
        return st ? `${st.bez} ${wertText(st, w.von)} → ${wertText(st, w.nach)} ${st.einheit}` : '';
      }).filter(Boolean).join(' · ');
      const stimmen = RESSORTS.map(x => {
        const st = vor.stimmen?.[x.id];
        return st ? `${x.kurz}: ${st.stimme}` : `${x.kurz}: —`;
      }).join(' · ');
      zeilen.push(`<tr data-stand="${vor.stand}">
        <td class="p">${i + 1}</td>
        <td class="r">${r.kurz}</td>
        <td class="a">${aend || 'keine Änderung'}</td>
        <td class="w">${(vor.begruendung ?? '').replace(/</g, '&lt;')}</td>
        <td class="s">${stimmen}</td></tr>`);
    }
  });
  $('#beschluesse').innerHTML = zeilen.length === 0
    ? '<p class="leer">Für diese Runden sind keine Vorlagen gespeichert.</p>'
    : `<table><thead><tr><th>P.</th><th>Ressort</th><th>Was</th><th>Warum</th>
       <th>Abstimmung</th></tr></thead><tbody>${zeilen.join('')}</tbody></table>`;
}

// ── C1 · Gegen das Nichtstun ───────────────────────────────────────────────

function gegenNichtstun() {
  const start = bahn[0];
  // Was herausgekommen waere, haette niemand je etwas beschlossen.
  const ohne = vorausschau({ ...start.zustand }, {}, 1).slice(0, bahn.length);
  const mitEnde = bahn.at(-1).ergebnis, ohneEnde = ohne.at(-1)?.ergebnis;
  if (!ohneEnde) { $('#nichtstun').innerHTML = ''; return; }

  const d = rund(mitEnde.saldo, 0) - rund(ohneEnde.saldo, 0);
  $('#nichtstun').innerHTML = `
    <p class="gross">${d === 0
      ? 'Euer Kurs endet dort, wo auch Nichtstun geendet hätte.'
      : `Gegenüber Nichtstun steht ihr am Ende <b>${mitVz(d)} Milliarden</b> ${
          d > 0 ? 'besser' : 'schlechter'} da.`}</p>
    <div class="tabellenraum" tabindex="0" role="region" aria-label="Vergleich mit dem Nichtstun">
    <table class="zahlen breit">
      <thead><tr><th class="l">Periode</th><th>euer Saldo</th><th>ohne jeden Beschluss</th>
        <th>Unterschied</th></tr></thead>
      <tbody>${bahn.map((b, i) => {
        const o = ohne[i]?.ergebnis;
        const u = o ? rund(b.ergebnis.saldo, 0) - rund(o.saldo, 0) : null;
        return `<tr><td class="l">${i + 1} · ${b.jahre.text}</td>
          <td>${zahl(b.ergebnis.saldo, 0)}</td>
          <td class="matt">${o ? zahl(o.saldo, 0) : '—'}</td>
          <td>${u === null ? '—' : mitVz(u)}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
    <p class="hinweis">„Ohne jeden Beschluss" heißt: der Status quo, fortgeschrieben mit
       denselben Annahmen. Keine Prognose — eine Vergleichsrechnung.</p>`;
}

// ── C2 · Der Werkstattbericht ──────────────────────────────────────────────

function werkstattbericht() {
  $('#werkstatt').innerHTML = RESSORTS.map(r => {
    const zeilen = [];
    bahn.forEach((b, i) => {
      const v = (vorlagen[i] ?? {})[r.id];
      if (!v || v.stand !== 'angenommen') return;
      const aend = Object.entries(v.aenderungen ?? {}).map(([key, w]) => {
        const st = ALLE.find(x => x.key === key);
        return st ? `${st.bez}: ${wertText(st, w.von)} → ${wertText(st, w.nach)} ${st.einheit}` : '';
      }).filter(Boolean);
      const vorher = i === 0 ? null : bahn[i - 1].ergebnis;
      const danach = KENNZAHLEN.map(k => {
        if (!vorher) return `${k.kurz} ${zahl(k.lies(b.ergebnis), k.n)}`;
        const t = diffText(k, b.ergebnis, vorher);
        return `${k.kurz} ${zahl(k.lies(b.ergebnis), k.n)} (${t.text})`;
      }).join(' · ');
      zeilen.push(`<tr>
        <td class="p">${i + 1}</td>
        <td class="a">${aend.length ? aend.join('<br>') : 'keine Änderung'}</td>
        <td class="w">${(v.begruendung ?? '').replace(/</g, '&lt;')}</td>
        <td class="d">${danach}</td></tr>`);
    });

    const merkschluessel = `bericht-${r.id}`;
    const eigen = hole(merkschluessel, SITZUNG_ID ?? 'lokal', '');
    return `
    <section class="wb w-${r.id}">
      <h3>${r.name}</h3>
      ${zeilen.length === 0
        ? '<p class="leer">Dieses Ressort hat keine angenommene Vorlage.</p>'
        : `<div class="tabellenraum"><table>
            <thead><tr><th>P.</th><th>Was ich geändert habe</th><th>Warum</th>
              <th>Was danach anders war</th></tr></thead>
            <tbody>${zeilen.join('')}</tbody></table></div>`}
      <label for="eigen-${r.id}">Mein eigener Absatz dazu</label>
      <textarea id="eigen-${r.id}" data-ressort="${r.id}" rows="3" maxlength="600"
        placeholder="Was hältst du für deinen Beitrag? Das ist deine Einschätzung — und genau deshalb diskutierbar.">${eigen}</textarea>
    </section>`;
  }).join('');

  for (const feld of document.querySelectorAll('#werkstatt textarea')) {
    feld.addEventListener('change', () =>
      merke(`bericht-${feld.dataset.ressort}`, SITZUNG_ID ?? 'lokal', feld.value.trim()));
  }
}

// ── C3 · Der Diagrammbaukasten ─────────────────────────────────────────────
//
// Die Obergrenze von fuenf ist der eigentliche Dienst an der Sache. Wer alles
// zeigen darf, waehlt nicht aus — und wer nicht auswaehlt, erklaert nichts.

function zeichneBaukasten() {
  if (!meinRessort) {
    $('#baukasten-feld').innerHTML =
      '<p class="leer">Für den Schaukasten brauchst du ein Ressort. '
      + 'Trag dich in der Aufstellung ein.</p>';
    return;
  }
  const r = RESSORTS.find(x => x.id === meinRessort);
  $('#baukasten-ressort').textContent = r ? r.name : meinRessort;

  $('#katalog').innerHTML = ARTEN.map(a => `
    <button type="button" class="kart" data-art="${a.id}"
      ${stuecke.length >= HOECHSTENS ? 'disabled' : ''}>
      <span class="kn">${a.name}</span>
      <span class="kw">${a.was}</span>
    </button>`).join('');

  $('#gewaehlt-zahl').textContent = `${stuecke.length} von ${HOECHSTENS} gewählt`;
  $('#gewaehlt').innerHTML = stuecke.length === 0
    ? '<p class="leer">Noch nichts gewählt. Nimm links, was deine Politik erklärt.</p>'
    : stuecke.map((st, i) => {
        const a = ARTEN.find(x => x.id === st.art);
        const braucht = a?.braucht ?? [];
        return `
        <div class="gw" data-i="${i}">
          <div class="gw-kopf">
            <span class="gw-n">${i + 1}. ${a ? a.name : st.art}</span>
            <span class="gw-k">
              <button type="button" class="hoch" data-i="${i}" ${i === 0 ? 'disabled' : ''}
                aria-label="Nach oben">↑</button>
              <button type="button" class="runter" data-i="${i}"
                ${i === stuecke.length - 1 ? 'disabled' : ''} aria-label="Nach unten">↓</button>
              <button type="button" class="weg" data-i="${i}" aria-label="Entfernen">✕</button>
            </span>
          </div>
          <div class="gw-felder">
            ${braucht.includes('kennzahl') ? `
              <label>Kennzahl
                <select class="f-kennzahl" data-i="${i}">
                  ${KENNZAHLEN.map(k => `<option value="${k.id}"
                    ${st.kennzahl === k.id ? 'selected' : ''}>${k.name}</option>`).join('')}
                </select></label>` : ''}
            ${braucht.includes('periode') ? `
              <label>Periode
                <select class="f-periode" data-i="${i}">
                  ${bahn.map((b, j) => `<option value="${j}"
                    ${st.periode === j ? 'selected' : ''}>${j + 1} · ${b.jahre.text}</option>`).join('')}
                </select></label>` : ''}
          </div>
          <label class="gw-text">Bildunterschrift
            <input type="text" class="f-text" data-i="${i}" maxlength="240"
              value="${(st.text ?? '').replace(/"/g, '&quot;')}"
              placeholder="Ein Satz: Was soll man hier sehen?"></label>
        </div>`;
      }).join('');

  for (const k of document.querySelectorAll('.kart')) {
    k.addEventListener('click', () => nimmAuf(k.dataset.art));
  }
  for (const k of document.querySelectorAll('.weg')) {
    k.addEventListener('click', () => { stuecke.splice(Number(k.dataset.i), 1); sichere(); });
  }
  for (const k of document.querySelectorAll('.hoch')) {
    k.addEventListener('click', () => tausche(Number(k.dataset.i), -1));
  }
  for (const k of document.querySelectorAll('.runter')) {
    k.addEventListener('click', () => tausche(Number(k.dataset.i), +1));
  }
  for (const f of document.querySelectorAll('.f-kennzahl, .f-periode, .f-text')) {
    f.addEventListener('change', () => {
      const i = Number(f.dataset.i);
      if (f.classList.contains('f-kennzahl')) stuecke[i].kennzahl = f.value;
      if (f.classList.contains('f-periode'))  stuecke[i].periode  = Number(f.value);
      if (f.classList.contains('f-text'))     stuecke[i].text     = f.value.trim();
      sichere();
    });
  }
  zeichneVorschau();
}

function nimmAuf(art) {
  if (stuecke.length >= HOECHSTENS) return;
  const a = ARTEN.find(x => x.id === art);
  stuecke.push({ art,
    kennzahl: a?.braucht.includes('kennzahl') ? KENNZAHLEN[0].id : undefined,
    periode:  a?.braucht.includes('periode')  ? bahn.length - 1 : undefined,
    text: '' });
  sichere();
}

function tausche(i, richtung) {
  const j = i + richtung;
  if (j < 0 || j >= stuecke.length) return;
  [stuecke[i], stuecke[j]] = [stuecke[j], stuecke[i]];
  sichere();
}

async function sichere() {
  zeichneBaukasten();
  if (!SITZUNG_ID || !hatBackend() || !teamName || !meinRessort) {
    merke('schaukasten', SITZUNG_ID ?? 'lokal', stuecke);
    return;
  }
  try {
    await setzeSchaukasten(SITZUNG_ID, teamName, meinRessort, stuecke);
    $('#baukasten-meldung').hidden = true;
  } catch (f) {
    const m = $('#baukasten-meldung');
    m.textContent = f instanceof ServerFehler
      ? `Nicht gesichert: ${f.message}` : 'Der Schaukasten wurde nicht gesichert.';
    m.hidden = false;
  }
}

function zeichneVorschau() {
  $('#vorschau').innerHTML = stuecke.length === 0
    ? '<p class="leer">Die Vorschau zeigt, was deine Mitspieler am Tisch sehen.</p>'
    : zeichneSchaukasten(stuecke, bahn, { ressort: meinRessort, vorlagen });
}

// ── Zeichnen ───────────────────────────────────────────────────────────────

function zeichne() {
  $('#kopf-team').textContent = anzeigename
    ? `${anzeigename} (${teamName})` : teamName;
  $('#kopf-lage').textContent =
    `${bahn.length} abgeschlossene Periode${bahn.length === 1 ? '' : 'n'} · `
    + `${bahn[0].jahre.von}–${bahn.at(-1).jahre.bis}`;
  $('#aussage').textContent = aussage();
  $('#reihen').innerHTML = KENNZAHLEN.map(zeitreihe).join('');
  $('#neben').innerHTML = NEBENWERTE.map(k => {
    const letzte = bahn.at(-1).ergebnis, erste = bahn[0].ergebnis;
    const t = diffText(k, letzte, erste);
    return `<div class="nw" data-richtung="${t.richtung}">
      <p class="n">${k.name}</p>
      <p class="v">${zahl(k.lies(letzte), k.n)}<em> ${k.einheit}</em></p>
      <p class="d">${bahn.length > 1 ? t.text : 'erste Periode'}</p>
      <p class="h">${k.hilfe}</p></div>`;
  }).join('');
  beschlusstabelle();
  gegenNichtstun();
  werkstattbericht();
  zeichneBaukasten();
}

// ── Start ──────────────────────────────────────────────────────────────────

lade();
