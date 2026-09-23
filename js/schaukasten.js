// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// DER SCHAUKASTEN — selbst zusammengestellte Auswertung
//
// Ein Modul, zwei Orte: der Baukasten in auswertung.html stellt zusammen,
// die Ressortansicht am Verhandlungstisch zeigt an. Zweimal derselbe
// Zeichencode waere zweimal derselbe Fehler.
//
// ── Was es hier NICHT gibt ─────────────────────────────────────────────────
// Keine Art, die behauptet, ein Ressort habe so und so viel bewirkt. Es gibt
// `beschluesse` — was dieses Ressort ENTSCHIEDEN hat — und es gibt die Lage
// des Haushalts. Was dazwischen liegt, ist die Wechselwirkung, die die Engine
// rechnet und die sich nicht sauber zerlegen laesst (Entscheidung 21.09.2026).
// ═══════════════════════════════════════════════════════════════════════════

import { RESSORTS, ALLE, KENNZAHLEN, vorausschau,
         zahl, mitVz, rund, diffText, wertText } from './spielkern.js';
import { DEZILE } from './data.js';

/** Der Katalog. `braucht` sagt, welche Angaben ein Stueck noch fuellen muss. */
export const ARTEN = [
  { id: 'zeitreihe',  name: 'Zeitreihe',
    was: 'Eine Kennzahl über alle Perioden.', braucht: ['kennzahl'] },
  { id: 'vergleich',  name: 'Vorher / Nachher',
    was: 'Eine Periode gegen ihren Rundenstart.', braucht: ['periode'] },
  { id: 'dezile',     name: 'Dezilwirkung',
    was: 'Grenzbelastung je Einkommensdezil.', braucht: ['periode'] },
  { id: 'haushalt',   name: 'Haushalt',
    was: 'Einnahmen und Ausgaben aufgegliedert.', braucht: ['periode'] },
  { id: 'beschluesse', name: 'Meine Beschlüsse',
    was: 'Was dieses Ressort entschieden hat — nicht, was es bewirkt hat.', braucht: [] },
  { id: 'nichtstun',  name: 'Gegen das Nichtstun',
    was: 'Euer Weg gegen den Status quo.', braucht: [] },
  { id: 'zahl',       name: 'Einzelwert',
    was: 'Eine große Zahl mit einem Satz.', braucht: ['kennzahl', 'periode'] },
];

const artVon = (id) => ARTEN.find(a => a.id === id);
const sicher = (t) => String(t ?? '').replace(/</g, '&lt;');

// ── Die einzelnen Stücke ───────────────────────────────────────────────────

function balken(werte, hoehe = 120) {
  const max = Math.max(...werte.map(w => Math.abs(w.wert)), 1);
  return `<div class="sk-balken" style="--h:${hoehe}px">
    ${werte.map(w => `
      <div class="sk-bal" data-vz="${w.wert < 0 ? 'minus' : 'plus'}">
        <span class="sk-w">${w.anzeige}</span>
        <i style="height:${Math.round(Math.abs(w.wert) / max * hoehe)}px"></i>
        <span class="sk-n">${sicher(w.name)}</span>
      </div>`).join('')}
  </div>`;
}

function zeichneZeitreihe(st, bahn) {
  const k = KENNZAHLEN.find(x => x.id === st.kennzahl) ?? KENNZAHLEN[0];
  const werte = bahn.map(b => k.lies(b.ergebnis));
  const t = bahn.length > 1 ? diffText(k, bahn.at(-1).ergebnis, bahn[0].ergebnis) : null;
  return `
    <p class="sk-kopf">${k.name}<span>${zahl(werte.at(-1), k.n)} ${k.einheit}${
      t ? ` · ${t.text} seit Periode 1` : ''}</span></p>
    ${balken(bahn.map((b, i) => ({ name: `P${i + 1}`, wert: werte[i],
      anzeige: zahl(werte[i], k.n) })))}`;
}

function zeichneVergleich(st, bahn) {
  const i = Math.min(st.periode ?? 0, bahn.length - 1);
  const b = bahn[i], vorher = i === 0 ? null : bahn[i - 1];
  return `
    <p class="sk-kopf">Periode ${i + 1}<span>${b.jahre.text}</span></p>
    <table class="sk-tab"><tbody>
      ${KENNZAHLEN.map(k => {
        const t = vorher ? diffText(k, b.ergebnis, vorher.ergebnis) : null;
        return `<tr><th>${k.name}</th>
          <td>${zahl(k.lies(b.ergebnis), k.n)} ${k.einheit}</td>
          <td class="sk-d" data-richtung="${t?.richtung ?? 'gleich'}">${
            t ? t.text : 'erste Periode'}</td></tr>`;
      }).join('')}
    </tbody></table>`;
}

function zeichneDezile(st, bahn) {
  const i = Math.min(st.periode ?? 0, bahn.length - 1);
  const e = bahn[i].ergebnis, v = i === 0 ? null : bahn[i - 1].ergebnis;
  return `
    <p class="sk-kopf">Grenzbelastung je Dezil<span>Periode ${i + 1}</span></p>
    ${balken(DEZILE.map((d, j) => {
      const jetzt = (e.metr?.[j] ?? 0) * 100;
      const alt   = v ? (v.metr?.[j] ?? 0) * 100 : jetzt;
      return { name: d.name ?? `D${j + 1}`, wert: jetzt,
               anzeige: `${zahl(jetzt, 0)}%${v && rund(jetzt,1) !== rund(alt,1)
                 ? ` ${mitVz(rund(jetzt,1) - rund(alt,1), 1)}` : ''}` };
    }), 96)}
    <p class="sk-fuss">Wie viel vom nächsten verdienten Euro an Steuern und Beiträgen abgeht.</p>`;
}

function zeichneHaushalt(st, bahn) {
  const i = Math.min(st.periode ?? 0, bahn.length - 1);
  const e = bahn[i].ergebnis;
  const posten = [
    { name: 'Lohn/ESt', wert: e.rev?.est ?? 0 },
    { name: 'USt',      wert: e.rev?.mwst ?? 0 },
    { name: 'Sozialb.', wert: (e.rev?.rv ?? 0) + (e.rev?.kv ?? 0) + (e.rev?.al ?? 0) },
    { name: 'KSt/GewSt', wert: (e.rev?.kst ?? 0) + (e.rev?.gewst ?? 0) },
    { name: 'CO₂',      wert: e.rev?.co2 ?? 0 },
  ];
  return `
    <p class="sk-kopf">Woher das Geld kommt<span>Periode ${i + 1} · Mrd. €</span></p>
    ${balken(posten.map(p => ({ ...p, anzeige: zahl(p.wert, 0) })))}
    <table class="sk-tab"><tbody>
      <tr><th>Einnahmen</th><td>${zahl(e.einnahmen_total, 1)} Mrd. €</td><td></td></tr>
      <tr><th>Ausgaben</th><td>${zahl(e.ausgaben_total, 1)} Mrd. €</td><td></td></tr>
      <tr><th>Saldo</th><td><b>${zahl(rund(e.einnahmen_total, 1) - rund(e.ausgaben_total, 1), 1)}
        Mrd. €</b></td><td></td></tr>
    </tbody></table>`;
}

function zeichneBeschluesse(st, bahn, kontext) {
  const zeilen = [];
  bahn.forEach((b, i) => {
    const v = (kontext.vorlagen?.[i] ?? {})[kontext.ressort];
    if (!v || v.stand !== 'angenommen') return;
    for (const [key, w] of Object.entries(v.aenderungen ?? {})) {
      const s = ALLE.find(x => x.key === key);
      if (s) zeilen.push({ p: i + 1, bez: s.bez,
        von: wertText(s, w.von), nach: wertText(s, w.nach), einheit: s.einheit });
    }
  });
  const r = RESSORTS.find(x => x.id === kontext.ressort);
  return `
    <p class="sk-kopf">Beschlüsse ${r ? r.kurz : ''}<span>${zeilen.length} Änderung${
      zeilen.length === 1 ? '' : 'en'}</span></p>
    ${zeilen.length === 0
      ? '<p class="sk-leer">Dieses Ressort hat nichts geändert.</p>'
      : `<table class="sk-tab"><tbody>${zeilen.map(z => `
          <tr><th>P${z.p} · ${sicher(z.bez)}</th>
            <td>${z.von} → <b>${z.nach}</b> ${z.einheit}</td><td></td></tr>`).join('')}
        </tbody></table>`}
    <p class="sk-fuss">Was entschieden wurde — nicht, was es bewirkt hat.
       In einer Volkswirtschaft wirkt nichts allein.</p>`;
}

function zeichneNichtstun(st, bahn) {
  const ohne = vorausschau({ ...bahn[0].zustand }, {}, 1).slice(0, bahn.length);
  const k = KENNZAHLEN[0];
  const d = rund(k.lies(bahn.at(-1).ergebnis), 0) - rund(k.lies(ohne.at(-1).ergebnis), 0);
  return `
    <p class="sk-kopf">Gegen das Nichtstun<span>${mitVz(d)} Mrd. € am Ende</span></p>
    <table class="sk-tab"><tbody>
      ${bahn.map((b, i) => `<tr>
        <th>Periode ${i + 1}</th>
        <td><b>${zahl(b.ergebnis.saldo, 0)}</b> statt ${zahl(ohne[i].ergebnis.saldo, 0)}</td>
        <td class="sk-d" data-richtung="${
          rund(b.ergebnis.saldo,0) > rund(ohne[i].ergebnis.saldo,0) ? 'besser' : 'schlechter'}">${
          mitVz(rund(b.ergebnis.saldo,0) - rund(ohne[i].ergebnis.saldo,0))}</td></tr>`).join('')}
    </tbody></table>
    <p class="sk-fuss">Vergleichsrechnung mit denselben Annahmen — keine Prognose.</p>`;
}

function zeichneZahl(st, bahn) {
  const k = KENNZAHLEN.find(x => x.id === st.kennzahl) ?? KENNZAHLEN[0];
  const i = Math.min(st.periode ?? bahn.length - 1, bahn.length - 1);
  const b = bahn[i], vorher = i === 0 ? null : bahn[i - 1];
  const t = vorher ? diffText(k, b.ergebnis, vorher.ergebnis) : null;
  return `
    <p class="sk-gross" data-richtung="${t?.richtung ?? 'gleich'}">
      ${zahl(k.lies(b.ergebnis), k.n)}<em>${k.einheit ? ` ${k.einheit}` : ''}</em></p>
    <p class="sk-gross-n">${k.name} · Periode ${i + 1}${t ? ` · ${t.text}` : ''}</p>`;
}

const ZEICHNER = {
  zeitreihe: zeichneZeitreihe, vergleich: zeichneVergleich, dezile: zeichneDezile,
  haushalt: zeichneHaushalt, beschluesse: zeichneBeschluesse,
  nichtstun: zeichneNichtstun, zahl: zeichneZahl,
};

/**
 * Einen ganzen Schaukasten zeichnen.
 *
 * `kontext` traegt, was ueber die Bahn hinaus gebraucht wird: das Ressort und
 * die Vorlagen je Periode.
 */
export function zeichneSchaukasten(stuecke, bahn, kontext = {}) {
  if (!stuecke?.length) return '';
  if (!bahn?.length) {
    return '<p class="sk-leer">Noch keine abgeschlossene Periode — es gibt nichts zu zeigen.</p>';
  }
  return stuecke.map((st, i) => {
    const art = artVon(st.art);
    const inhalt = ZEICHNER[st.art]?.(st, bahn, kontext) ?? '';
    return `
      <figure class="sk-stueck" data-art="${st.art}">
        <div class="sk-inhalt">${inhalt}</div>
        ${st.text ? `<figcaption>${sicher(st.text)}</figcaption>` : ''}
        <p class="sk-nr">${i + 1} von ${stuecke.length} · ${art ? art.name : st.art}</p>
      </figure>`;
  }).join('');
}
