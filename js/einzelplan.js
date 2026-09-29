// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// EINZELPLAN — Steuerung der Spielflaeche
//
// Diese Datei zeichnet und rechnet nicht selbst: sie uebersetzt zwischen dem
// Dokument und der Engine. Die Engine (js/rechner/, js/data.js) wird
// ausschliesslich gelesen und bleibt unberuehrt.
//
// Kein fetch(), kein localStorage — diese Flaeche laeuft vollstaendig lokal.
// Netzwerk gehoert nach js/dienste/server.js (tests/architektur.test.js).
//
// Ladereihenfolge: data.js -> berechne.js -> diese Datei.
// ═══════════════════════════════════════════════════════════════════════════

import { berechne, FORMEL_QUELLEN_BERECHNE } from './rechner/berechne.js';
import { FORMEL_QUELLEN_VERT }               from './rechner/verteilung.js';
import { PRESETS, PERIOD_STATE_0 }           from './data.js';

// ── Der Plan: Einzelplaene, Kapitel, Titel ─────────────────────────────────
//
// Die Einzelplan-Nummern sind die echten des Bundeshaushalts. Die
// Titelnummern folgen der Logik des Gruppierungsplans (0xx Einnahmen,
// 6xx Ausgaben und Zuweisungen), sind fuer das Planspiel aber gesetzt —
// sie bilden keinen realen Haushaltstitel ab.

const EINZELPLAENE = [
  {
    nr: '08', name: 'Bundesministerium der Finanzen',
    einnahmen: ['est', 'mwst', 'erbschaft', 'vermoegen'],
    kapitel: [
      { nr: '0801', name: 'Steuern vom Einkommen', titel: [
        { t: '011 01', key: 'freibetrag', zweck: 'Grundfreibetrag',         einheit: '€', min: 0,  max: 30000, step: 12,  nk: 0, quelle: 'arbeitsangebot' },
        { t: '011 02', key: 'eingang',    zweck: 'Eingangssteuersatz',      einheit: '%', min: 0,  max: 40,    step: 0.5, nk: 1, quelle: 'arbeitsangebot' },
        { t: '011 03', key: 'spitze',     zweck: 'Spitzensteuersatz',       einheit: '%', min: 20, max: 75,    step: 0.5, nk: 1, quelle: 'arbeitsangebot' },
      ]},
      { nr: '0803', name: 'Steuern vom Umsatz', titel: [
        { t: '013 01', key: 'mwst',     zweck: 'Umsatzsteuer, Regelsatz', einheit: '%', min: 0, max: 30, step: 0.5, nk: 1, quelle: 'mwst_konsumanteil' },
        { t: '013 02', key: 'mwst_erm', zweck: 'Umsatzsteuer, ermäßigt',  einheit: '%', min: 0, max: 25, step: 0.5, nk: 1, quelle: 'mwst_konsumanteil' },
      ]},
      { nr: '0805', name: 'Steuern vom Vermögen', titel: [
        { t: '014 01', key: 'erb',  zweck: 'Erbschaftsteuer', einheit: '%', min: 0, max: 60, step: 1,   nk: 0, quelle: 'erbschaft' },
        { t: '014 02', key: 'verm', zweck: 'Vermögensteuer',  einheit: '%', min: 0, max: 5,  step: 0.1, nk: 1, quelle: 'zucman' },
      ]},
    ],
  },
  {
    nr: '09', name: 'Bundesministerium für Wirtschaft und Klimaschutz',
    einnahmen: ['kst', 'gewst'],
    kapitel: [
      { nr: '0902', name: 'Besteuerung der Unternehmen', titel: [
        { t: '012 01', key: 'kst',   zweck: 'Körperschaftsteuer',     einheit: '%', min: 0, max: 40, step: 0.5, nk: 1, quelle: 'dynamisches_scoring' },
        { t: '012 02', key: 'gewst', zweck: 'Gewerbesteuer-Messzahl', einheit: '%', min: 0, max: 30, step: 0.5, nk: 1, quelle: 'dynamisches_scoring' },
      ]},
    ],
  },
  {
    nr: '11', name: 'Bundesministerium für Arbeit und Soziales',
    einnahmen: ['rv', 'kv'], ausgaben: ['bg_auszahlung', 'kg_auszahlung'],
    kapitel: [
      { nr: '1102', name: 'Beiträge zur Sozialversicherung', titel: [
        { t: '021 01', key: 'rv', zweck: 'Beitragssatz Rentenversicherung',  einheit: '%', min: 10, max: 30, step: 0.1, nk: 1, quelle: 'sv_beitraege' },
        { t: '021 02', key: 'kv', zweck: 'Beitragssatz Krankenversicherung', einheit: '%', min: 10, max: 25, step: 0.1, nk: 1, quelle: 'sv_beitraege' },
      ]},
      { nr: '1110', name: 'Leistungen an Haushalte', titel: [
        { t: '681 01', key: 'bg', zweck: 'Bürgergeld, Regelsatz', einheit: '€/Monat', min: 0, max: 1500, step: 1, nk: 0, quelle: 'armutsrisiko' },
        { t: '681 02', key: 'kg', zweck: 'Kindergeld',            einheit: '€/Monat', min: 0, max: 1000, step: 1, nk: 0, quelle: 'armutsrisiko' },
      ]},
    ],
  },
  {
    nr: '16', name: 'Bundesministerium für Umwelt und Klimaschutz',
    einnahmen: ['co2'], ausgaben: ['klimageld_auszahlung'],
    kapitel: [
      { nr: '1602', name: 'Bepreisung von Emissionen', titel: [
        { t: '015 01', key: 'co2',       zweck: 'CO₂-Preis',           einheit: '€/t',     min: 0, max: 300, step: 5, nk: 0, quelle: 'co2_emissionen' },
        { t: '681 03', key: 'klimageld', zweck: 'Klimageld auszahlen', einheit: 'ja/nein', schalter: true,            quelle: 'co2_emissionen' },
      ]},
    ],
  },
];

const ALLE_TITEL = EINZELPLAENE.flatMap(e => e.kapitel.flatMap(k => k.titel));

// Die Quellenangaben kommen aus der Engine, nicht aus dieser Datei.
const QUELLEN = { ...FORMEL_QUELLEN_BERECHNE, ...FORMEL_QUELLEN_VERT };

// Fussnotennummern in der Reihenfolge, in der die Quellen im Plan auftauchen
const FUSSNOTEN = [...new Set(ALLE_TITEL.map(t => t.quelle))];
const fussnote  = q => FUSSNOTEN.indexOf(q) + 1;

// ── Zustand ────────────────────────────────────────────────────────────────

const params = { ...PRESETS.status_quo };
const SQ     = berechne({ ...PRESETS.status_quo }, PERIOD_STATE_0);

let ergebnis = SQ;

// ── Formatierung ───────────────────────────────────────────────────────────

const zahl = (v, n = 0) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: n, maximumFractionDigits: n });

const mitVorzeichen = (v, n = 0) => (v > 0 ? '+' : v < 0 ? '−' : '±') + zahl(Math.abs(v), n);

function wertText(t, v) {
  if (t.schalter) return v ? 'ja' : 'nein';
  return zahl(v, t.nk ?? 0);
}

/** Deutsche Eingabe lesen: Punkt ist Tausender, Komma ist Dezimaltrenner. */
function liesEingabe(text) {
  const roh = String(text).trim().replace(/\./g, '').replace(',', '.');
  if (roh === '') return { leer: true };
  const v = Number(roh);
  return Number.isFinite(v) ? { wert: v } : { ungueltig: true };
}

function fehlerText(t, lage) {
  if (lage.leer)      return `${t.zweck} braucht einen Wert. Zulässig sind ${zahl(t.min, t.nk)} bis ${zahl(t.max, t.nk)} ${t.einheit}.`;
  if (lage.ungueltig) return `„${lage.roh}" ist keine Zahl. Zulässig sind ${zahl(t.min, t.nk)} bis ${zahl(t.max, t.nk)} ${t.einheit}.`;
  return `Auf ${zahl(lage.wert, t.nk)} ${t.einheit} begrenzt. Zulässig sind ${zahl(t.min, t.nk)} bis ${zahl(t.max, t.nk)} ${t.einheit}.`;
}

// ── Die vier Kennzahlen des Gesamtplans ────────────────────────────────────
//
// Jede Schwelle wird aus dem Status quo DIESES Modells abgeleitet, nie aus
// einer Realweltzahl. Sonst kann eine Politik nicht gelingen, und die Farbe
// sagt etwas, das nicht stimmt.

const KENNZAHLEN = [
  { id: 'saldo', name: 'Haushaltssaldo', einheit: 'Mrd. €', n: 0,
    lies: r => r.saldo,        gut: 'hoch' },
  { id: 'gini',  name: 'Gini-Ungleichheit', einheit: '', n: 3,
    lies: r => r.gini,         gut: 'niedrig' },
  { id: 'co2',   name: 'Emissionen', einheit: 'Mio. t', n: 0,
    lies: r => r.emissionen,   gut: 'niedrig' },
  { id: 'bip',   name: 'Bruttoinlandsprodukt', einheit: 'Mrd. €', n: 0,
    lies: r => r.bip_aktuell,  gut: 'hoch' },
];

const abweichung = k => {
  const jetzt = k.lies(ergebnis), sq = k.lies(SQ);
  return sq === 0 ? 0 : ((jetzt - sq) / Math.abs(sq)) * 100;
};

function richtung(k) {
  const a = abweichung(k);
  if (Math.abs(a) < 0.05) return { r: 'gleich', wort: 'unverändert' };
  const besser = k.gut === 'hoch' ? a > 0 : a < 0;
  return besser
    ? { r: 'mehr',   wort: k.gut === 'hoch' ? 'höher' : 'niedriger' }
    : { r: 'minder', wort: k.gut === 'hoch' ? 'niedriger' : 'höher' };
}

// ── Die Schlagzeile schreibt sich aus dem Modell ───────────────────────────

function schlagzeile() {
  const saldo = ergebnis.saldo;
  const d     = saldo - SQ.saldo;
  const gini  = ergebnis.gini - SQ.gini;

  if (Math.abs(d) < 0.5 && Math.abs(gini) < 0.0005) {
    return {
      kopf: 'Kabinett tagt ohne Beschluss',
      text: `Der Entwurf entspricht in allen ${ALLE_TITEL.length} Titeln der Fortschreibung. ` +
            `Der Haushalt schließt mit ${zahl(Math.abs(saldo))} Mrd. € ` +
            `${saldo < 0 ? 'Defizit' : 'Überschuss'}, wie im Vorjahr.`,
    };
  }

  const kopf = saldo < 0
    ? `Haushaltsloch von ${zahl(Math.abs(saldo))} Mrd. Euro im Entwurf`
    : `Entwurf schließt mit ${zahl(saldo)} Mrd. Euro Überschuss`;

  const teile = [];
  teile.push(d > 0
    ? `Gegenüber der Fortschreibung verbessert sich der Saldo um ${zahl(d)} Mrd. €.`
    : `Gegenüber der Fortschreibung verschlechtert sich der Saldo um ${zahl(Math.abs(d))} Mrd. €.`);
  if (Math.abs(gini) >= 0.0005) {
    teile.push(gini < 0
      ? `Die Einkommen rücken zusammen; der Gini fällt um ${zahl(Math.abs(gini), 3)}.`
      : `Die Einkommen spreizen sich; der Gini steigt um ${zahl(gini, 3)}.`);
  }
  const co2 = ergebnis.emissionen - SQ.emissionen;
  if (Math.abs(co2) >= 1) {
    teile.push(co2 < 0
      ? `Die Emissionen sinken um ${zahl(Math.abs(co2))} Mio. t.`
      : `Die Emissionen steigen um ${zahl(co2)} Mio. t.`);
  }
  return { kopf, text: teile.join(' ') };
}

// ── Zeichnen ───────────────────────────────────────────────────────────────

const $ = s => document.querySelector(s);

function zeichnePlan() {
  $('#plan').innerHTML = EINZELPLAENE.map(ep => `
    <section class="einzelplan">
      <h2><span class="nr">Einzelplan ${ep.nr}</span> ${ep.name}</h2>
      <div class="planrolle"><table class="plan" role="table">
        <caption>Einzelplan ${ep.nr} — Titel, Soll-Werte und Veränderung gegenüber der Fortschreibung.</caption>
        <colgroup><col class="c-marge"><col class="c-nr"><col class="c-zweck"><col class="c-soll"><col class="c-sq"><col class="c-delta"></colgroup>
        <thead>
          <tr role="row">
            <th aria-hidden="true"></th>
            <th class="nr" scope="col">Titel</th>
            <th class="zweck" scope="col">Zweckbestimmung</th>
            <th scope="col">Soll</th>
            <th class="sq-sp" scope="col">Fortschreibung</th>
            <th scope="col">Veränderung</th>
          </tr>
        </thead>
        ${ep.kapitel.map(k => `
        <tbody>
          <tr class="kapitel" role="row"><td class="marge" role="cell"></td><td class="nr" role="cell">${k.nr}</td>
            <th colspan="4" scope="colgroup" role="columnheader">${k.name}</th></tr>
          ${k.titel.map(zeileFuer).join('')}
        </tbody>`).join('')}
        <tfoot><tr class="summenzeile" role="row">
          <td class="marge" role="cell"></td><td class="nr" role="cell"></td>
          <th scope="row" role="rowheader">Erfasst in Einzelplan ${ep.nr}</th>
          <td colspan="3" id="summe-${ep.nr}" role="cell"></td>
        </tr></tfoot>
      </table></div>
    </section>`).join('');

  for (const t of ALLE_TITEL) {
    const feld = document.getElementById(`soll-${t.key}`);
    if (!feld) continue;
    if (t.schalter) {
      feld.addEventListener('click', () => setze(t, !params[t.key]));
    } else {
      feld.addEventListener('input',  () => pruefe(t, feld, false));
      feld.addEventListener('change', () => pruefe(t, feld, true));
    }
  }
}

function zeileFuer(t) {
  const v  = params[t.key];
  const sq = PRESETS.status_quo[t.key];
  const id = `zweck-${t.key}`;

  const steuer = t.schalter
    ? `<button type="button" class="schalter" id="soll-${t.key}"
         aria-pressed="${v ? 'true' : 'false'}" aria-labelledby="${id}">${v ? 'ja' : 'nein'}</button>`
    : `<input type="text" class="soll" id="soll-${t.key}" aria-labelledby="${id}"
         aria-describedby="fehler-${t.key}" inputmode="decimal" autocomplete="off"
         value="${wertText(t, v)}">`;

  const q = QUELLEN[t.quelle];

  return `
    <tr id="zeile-${t.key}" data-geaendert="false" role="row">
      <td class="marge" role="cell"></td>
      <td class="nr" role="cell">${t.t}</td>
      <td class="zweck" role="cell">
        <details class="erl">
          <summary><span id="${id}">${t.zweck}</span><span class="einheit">, ${t.einheit}</span><span
            class="fussmarke">${fussnote(t.quelle)}</span></summary>
          <dl class="erl-text">
            <dt>Rechenweg</dt><dd class="formel">${q ? q.formel : '—'}</dd>
            <dt>Fundstelle</dt><dd>${q ? q.ref : '—'}</dd>
            ${q && q.note ? `<dt>Anmerkung</dt><dd>${q.note}</dd>` : ''}
          </dl>
        </details>
        <p class="fehler" id="fehler-${t.key}" hidden></p>
      </td>
      <td role="cell" data-spalte="Soll">${steuer}</td>
      <td class="sq sq-sp" role="cell" data-spalte="Fortschreibung">${wertText(t, sq)}</td>
      <td class="delta" id="delta-${t.key}" role="cell" data-spalte="Veränderung" data-richtung="gleich">±0 <span class="wort">unverändert</span></td>
    </tr>`;
}

// ── Die gemeinsame Messachse ───────────────────────────────────────────────
//
// Eine Achse, eine durchgehende Nulllinie, ein sichtbarer Massstab. Die
// Nulllinie IST die Fortschreibung — die zweite Spur, gegen die gelesen wird.
// Wer ueber den Rand hinausschlaegt, bekommt einen Anschlagspfeil: ein
// Balken, der an der Wand stehen bleibt, wuerde sonst behaupten, es ginge
// nicht weiter.

const SPANNE = 25;   // Prozent Abweichung, die eine halbe Bahn fuellt

/** Eine Bahn: derselbe Massstab wie alle anderen, Nulllinie bei 50 %. */
function bahnGrafik(k) {
  const a = abweichung(k), { r } = richtung(k);
  const geklemmt = Math.max(-SPANNE, Math.min(SPANNE, a));
  const x = 100 + (geklemmt / SPANNE) * 100;
  const farbe = r === 'mehr' ? 'var(--fichte)' : r === 'minder' ? 'var(--oxid)' : 'var(--tinte-zweit)';
  const anschlag = Math.abs(a) > SPANNE
    ? `<path d="M${a > 0 ? 194 : 6} 1 l${a > 0 ? 6 : -6} 5 l${a > 0 ? -6 : 6} 5 z" fill="${farbe}"/>` : '';
  return `<svg class="bahn-grafik" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
      <rect x="${Math.min(100, x)}" y="2" width="${Math.max(Math.abs(x - 100), 0.6)}" height="8" fill="${farbe}"/>
      ${anschlag}
    </svg>`;
}

function zeichneGesamtplan() {
  $('#schiene').innerHTML = KENNZAHLEN.map(k => {
    const a = abweichung(k), { wort } = richtung(k);
    return `<div class="bahn">
        <dt>${k.name}</dt>
        <dd><span class="wert">${zahl(k.lies(ergebnis), k.n)}</span>${k.einheit ? `<span class="einheit"> ${k.einheit}</span>` : ''}</dd>
        <div class="bahn-mass">${bahnGrafik(k)}</div>
        <p class="bahn-abw">${mitVorzeichen(a, 1)} % <span class="wort">${wort === 'unverändert'
            ? 'gegenüber der Fortschreibung' : `${wort} als die Fortschreibung`}</span></p>
      </div>`;
  }).join('');

  for (const ep of EINZELPLAENE) {
    const ein = (ep.einnahmen ?? []).reduce((s, k) => s + (ergebnis.rev[k] ?? 0), 0);
    const aus = (ep.ausgaben  ?? []).reduce((s, k) => s + (ergebnis[k] ?? 0), 0);
    const zelle = document.getElementById(`summe-${ep.nr}`);
    if (zelle) {
      // Kein Saldo je Einzelplan: die Titel dieser Fläche decken nicht alle
      // Einnahmen und Ausgaben des Ressorts ab, eine Differenz waere also
      // eine Zahl ohne Deckung. Benannt wird nur, was zugeordnet ist.
      zelle.textContent = aus > 0
        ? `${zahl(ein)} Mrd. € erfasste Einnahmen · ${zahl(aus)} Mrd. € erfasste Ausgaben`
        : `${zahl(ein)} Mrd. € erfasste Einnahmen`;
    }
  }

  $('#abschluss').innerHTML = `
    <div><span>Einnahmen</span><span>${zahl(ergebnis.einnahmen_total)} Mrd. €</span></div>
    <div><span>Ausgaben</span><span>${zahl(ergebnis.ausgaben_total)} Mrd. €</span></div>
    <div class="doppelstrich"><span>Abschluss</span><span>${mitVorzeichen(ergebnis.saldo)} Mrd. €</span></div>`;

  const s = schlagzeile();
  $('#lage-kopf').textContent = s.kopf;
  $('#lage-text').textContent = s.text;

  const geaendert = ALLE_TITEL.filter(t => params[t.key] !== PRESETS.status_quo[t.key]);
  $('#fakt-titel').textContent = geaendert.length;
  $('#fakt-saldo').textContent = `${mitVorzeichen(ergebnis.saldo)} Mrd. €`;
  $('#btn-beschluss').disabled = geaendert.length === 0;
  meldeSpaet(`Abschluss ${mitVorzeichen(ergebnis.saldo)} Milliarden Euro, ${geaendert.length} Titel geändert.`);
}

// Die Live-Region erst melden, wenn getippt fertig ist — sonst liest der
// Screenreader jeden Tastendruck als vollen Satz vor.
let meldeUhr = 0;
function meldeSpaet(text) {
  clearTimeout(meldeUhr);
  meldeUhr = setTimeout(() => { $('#stand-live').textContent = text; }, 700);
}

function zeichneApparat() {
  $('#apparat-liste').innerHTML = FUSSNOTEN.map((q, i) => {
    const e = QUELLEN[q];
    return `<li id="q${i + 1}"><b>${e ? e.formel : q}</b> — ${e ? e.ref : 'ohne Fundstelle'}${e && e.note ? ` (${e.note})` : ''}</li>`;
  }).join('');
  $('#apparat-zahl').textContent = FUSSNOTEN.length;
}

// ── Ein Titel wird ueberschrieben ──────────────────────────────────────────

function pruefe(t, feld, endgueltig) {
  const lage = liesEingabe(feld.value);
  const fehler = document.getElementById(`fehler-${t.key}`);

  if (lage.leer || lage.ungueltig) {
    // Zwischenzustaende beim Tippen nicht rechnen — ein leeres Feld ist
    // keine Null, und eine halb getippte Zahl ist keine Politik.
    if (endgueltig) {
      fehler.textContent = fehlerText(t, { ...lage, roh: feld.value });
      fehler.hidden = false;
      feld.setAttribute('aria-invalid', 'true');
      feld.value = wertText(t, params[t.key]);
      fehler.hidden = true;
      feld.removeAttribute('aria-invalid');
    }
    return;
  }

  let w = lage.wert;
  const ausserhalb = w < t.min || w > t.max;
  w = Math.max(t.min, Math.min(t.max, w));

  if (ausserhalb && endgueltig) {
    fehler.textContent = fehlerText(t, { wert: w });
    fehler.hidden = false;
    feld.setAttribute('aria-invalid', 'true');
  } else if (endgueltig) {
    fehler.hidden = true;
    feld.removeAttribute('aria-invalid');
  }

  setze(t, w);
  if (endgueltig) feld.value = wertText(t, w);
}

function setze(t, wert) {
  params[t.key] = wert;
  ergebnis = berechne({ ...params }, PERIOD_STATE_0);

  const sq    = PRESETS.status_quo[t.key];
  const zeile = document.getElementById(`zeile-${t.key}`);
  const d     = document.getElementById(`delta-${t.key}`);

  zeile.dataset.geaendert = String(params[t.key] !== sq);

  if (t.schalter) {
    const b = document.getElementById(`soll-${t.key}`);
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
      : `${mitVorzeichen(diff, t.nk ?? 0)} <span class="wort">${diff > 0 ? 'angehoben' : 'gesenkt'}</span>`;
  }

  d.classList.remove('frisch');
  void d.offsetWidth;
  d.classList.add('frisch');

  zeichneGesamtplan();
}

// ── Der Beschluss ──────────────────────────────────────────────────────────

function oeffneVorlage() {
  const geaendert = ALLE_TITEL.filter(t => params[t.key] !== PRESETS.status_quo[t.key]);

  $('#vorlage-titel').innerHTML = geaendert.map(t => `
    <tr><td>${t.t} · ${t.zweck}</td>
        <td>${wertText(t, PRESETS.status_quo[t.key])}</td>
        <td>${wertText(t, params[t.key])}</td></tr>`).join('');

  $('#vorlage-wirkung').innerHTML = KENNZAHLEN.map(k => {
    const { r, wort } = richtung(k);
    const diff = k.lies(ergebnis) - k.lies(SQ);
    return `<tr><td>${k.name}</td>
      <td>${zahl(k.lies(SQ), k.n)}</td>
      <td>${zahl(k.lies(ergebnis), k.n)}</td>
      <td class="delta" data-richtung="${r}">${mitVorzeichen(diff, k.n)} <span class="wort">${wort}</span></td></tr>`;
  }).join('');

  $('#vorlage-zahl').textContent = geaendert.length;
  $('#vorlage').showModal();
}

// ── Aufbau ─────────────────────────────────────────────────────────────────

zeichnePlan();
zeichneApparat();
zeichneGesamtplan();

$('#btn-beschluss').addEventListener('click', oeffneVorlage);
$('#btn-zurueck').addEventListener('click', () => $('#vorlage').close());
$('#btn-fassen').addEventListener('click', () => {
  $('#vorlage').close();
  $('#stand-live').textContent = 'Beschluss vermerkt. Diese Vorschau endet hier.';
});
