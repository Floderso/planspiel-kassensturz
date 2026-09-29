// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// TESTS · Architekturgrenzen
//
// Eine Ordnerstruktur allein haelt nicht. Nach drei Monaten steht das erste
// fetch() wieder in einer Zeichenfunktion. Diese Datei zieht die Grenzen
// maschinell nach — sie faellt um, sobald jemand sie ueberschreitet.
//
// Hintergrund: entwurf/ARCHITEKTUR.md, Abschnitt 5.
//
// ── Warum hier auch HTML geprueft wird ──────────────────────────────────────
// Bis 16.09.2026 lief diese Datei ausschliesslich ueber js/ und filterte dort
// auf .js. Die Oberflaechen in der Projektwurzel tragen aber Anwendungscode in
// <script>-Bloecken — und dort standen drei Verstoesse, waehrend der Test gruen
// lief. Ein Waechter, der eine ganze Dateiart nicht ansieht, taeuscht
// Sicherheit vor; das ist schlimmer als kein Waechter. Seitdem gehoeren die
// Wurzelseiten dazu.
//
// Die Regeln stehen darum als Daten in REGELN und nicht ausgeschrieben in den
// Tests: so liest die Verfallspruefung am Ende der Datei dieselbe Definition
// wie die Pruefung selbst. Eine Ausnahme kann dadurch ihren Grund nicht
// ueberleben.
// ═══════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIENSTE = path.join('js', 'dienste');

// ── Was geprueft wird ────────────────────────────────────────────────────────

/** Alle .js-Dateien unter js/, relativ zur Projektwurzel. */
function quelldateien(unterordner = 'js') {
  const gefunden = [];
  (function durchlaufe(ordner) {
    for (const eintrag of fs.readdirSync(path.join(wurzel, ordner), { withFileTypes: true })) {
      const rel = path.join(ordner, eintrag.name);
      if (eintrag.isDirectory()) durchlaufe(rel);
      else if (eintrag.name.endsWith('.js')) gefunden.push(rel);
    }
  })(unterordner);
  return gefunden;
}

/**
 * Die Oberflaechen in der Projektwurzel. Nicht als feste Liste, sondern
 * gelesen — eine neue Seite waere sonst am Tag ihrer Entstehung ungeprueft.
 */
function wurzelseiten() {
  return fs.readdirSync(wurzel, { withFileTypes: true })
    .filter(eintrag => eintrag.isFile() && eintrag.name.endsWith('.html'))
    .map(eintrag => eintrag.name)
    .sort();
}

/**
 * Alles, was die projektweiten Grenzen einhalten muss.
 *
 * Bewusst NICHT dabei: /konfig.js in der Wurzel. Dort gehoeren Adressen und
 * Token hin — das ist der Sinn der Datei, nicht ihre Verletzung.
 */
function pruefdateien() {
  return [...quelldateien(), ...wurzelseiten()];
}

// ── Wie gelesen wird ─────────────────────────────────────────────────────────

const lies = rel => fs.readFileSync(path.join(wurzel, rel), 'utf-8');

/**
 * Blendet in einer HTML-Datei alles aus, was kein Code ist, und ersetzt es
 * durch Leerraum gleicher Laenge. Die Zeilennummern bleiben dadurch die der
 * Originaldatei — ein Befund laesst sich direkt anspringen.
 *
 * `mitVerweisen` nimmt zusaetzlich die <script>- und <link>-Tags selbst dazu.
 * Denn eine Adresse in einem src-Attribut ist genauso eine Adresse im Code wie
 * eine in einer Zeichenkette. Prosa-Links (<a href>) bleiben aussen vor: ein
 * Verweis auf das Repo oder die Lizenz ist Inhalt, keine Konfiguration.
 */
function maskiereHtml(inhalt, { mitVerweisen = false } = {}) {
  const zeichen = inhalt.replace(/[^\n]/g, ' ').split('');
  const zurueckholen = (von, bis) => {
    for (let i = von; i < bis; i++) zeichen[i] = inhalt[i];
  };

  for (const treffer of inhalt.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const start = treffer.index + treffer[0].indexOf('>') + 1;
    zurueckholen(start, start + treffer[1].length);
  }
  if (mitVerweisen) {
    for (const treffer of inhalt.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
      zurueckholen(treffer.index, treffer.index + treffer[0].length);
    }
  }
  return zeichen.join('');
}

/** Zeilen ohne Zeilenkommentare und ohne Blockkommentare. */
function codezeilen(inhalt) {
  return inhalt
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((zeile, i) => ({ nr: i + 1, text: zeile }))
    .filter(({ text }) => !text.trim().startsWith('//'));
}

/** Die pruefbaren Zeilen einer Datei — bei .html nur der Code darin. */
function codezeilenVon(rel, optionen) {
  const inhalt = lies(rel);
  return codezeilen(rel.endsWith('.html') ? maskiereHtml(inhalt, optionen) : inhalt);
}

// ── Die Regeln ───────────────────────────────────────────────────────────────

const REGELN = {
  fetch: {
    muster:        /\bfetch\s*\(/,
    nurAusserhalb: DIENSTE,
    hinweis: 'Netzwerkzugriff gehoert in js/dienste/server.js — sonst laesst sich das ' +
             'Backend nicht austauschen, ohne die Oberflaeche anzufassen.',
  },
  adressen: {
    // Erlaubt sind Adressen in Zeichenketten NICHT — sie gehoeren in konfig.js.
    muster:   /https?:\/\/(?!\S*\bschema\b)/,
    optionen: { mitVerweisen: true, mitText: true },
    hinweis: 'Adressen gehoeren in /konfig.js. Im Code machen sie jede zweite ' +
             'Umgebung unmoeglich.',
  },
  token: {
    muster: /[?&]token=/,
    hinweis: 'Query-Parameter landen in Serverprotokollen. Der Token geht als ' +
             'Authorization-Kopfzeile raus (siehe entwurf/BETRIEB.md 1.5).',
  },
  speicher: {
    muster:        /\blocalStorage\b/,
    nurAusserhalb: DIENSTE,
    hinweis: 'localStorage gehoert hinter js/dienste/speicher.js.',
  },
};

/**
 * Was noch verletzt wird — mit Grund und mit dem Befund im Klartext.
 *
 * Kein Freibrief: jeder Eintrag nennt genau die Regeln, von denen er befreit
 * ist, und der Test "jede Ausnahme wird noch gebraucht" faellt um, sobald ein
 * Eintrag ueberfluessig geworden ist. Eine Ausnahme kann ihren Grund hier
 * nicht ueberleben — genau daran ist die alte Luecke gescheitert.
 */
const AUSNAHMEN = {
  'demo.html': {
    regeln: ['fetch', 'adressen'],
    grund:  'Wird im Redesign gestrichen (Entscheidung 16.09.2026). Die Seite ' +
            'laedt konfig.js nicht und spricht direkt mit der API.',
    befunde: [
      'demo.html:523 — Adresse der ausgerollten API als Zeichenkette',
      'demo.html:536 — fetch() ausserhalb js/dienste/',
    ],
  },
  'news_portal_mockup.html': {
    regeln: ['adressen'],
    grund:  'Mockup, wird nicht ausgeliefert und im Redesign ersetzt.',
    befunde: [
      'news_portal_mockup.html:7 — Tailwind von gstatic.com statt aus dem Projekt',
    ],
  },
};

const istAusgenommen = (datei, regel) => AUSNAHMEN[datei]?.regeln.includes(regel) ?? false;

/** Treffer eines Musters in einer Datei, als "datei:zeile". */
function sucheIn(datei, { muster, optionen = {} }) {
  const treffer = [];
  for (const { nr, text } of codezeilenVon(datei, optionen)) {
    if (muster.test(text)) {
      treffer.push(optionen.mitText ? `${datei}:${nr} → ${text.trim().slice(0, 70)}` : `${datei}:${nr}`);
    }
  }
  return treffer;
}

/** Alle Befunde einer Regel im Projekt — Ausnahmen bleiben aussen vor. */
function befunde(regelName) {
  const regel = REGELN[regelName];
  const suender = [];
  for (const datei of pruefdateien()) {
    if (regel.nurAusserhalb && datei.startsWith(regel.nurAusserhalb)) continue;
    if (istAusgenommen(datei, regelName)) continue;
    suender.push(...sucheIn(datei, regel));
  }
  return suender;
}

// ── Genau eine Datei spricht mit dem Server ──────────────────────────────────

test('fetch() steht ausschliesslich in js/dienste/', () => {
  assert.deepEqual(befunde('fetch'), [], REGELN.fetch.hinweis);
});

// ── Die Engine bleibt frei von Oberflaeche ───────────────────────────────────
//
// Hier bleibt es bei .js: js/rechner/ enthaelt keine HTML-Dateien, und eine
// Oberflaeche darf document und window selbstverstaendlich benutzen.

test('js/rechner/ kennt weder DOM noch Browser', () => {
  const suender = [];
  for (const datei of quelldateien(path.join('js', 'rechner'))) {
    for (const { nr, text } of codezeilen(lies(datei))) {
      if (/\b(document|window|localStorage|innerHTML)\b/.test(text)) {
        suender.push(`${datei}:${nr} → ${text.trim().slice(0, 60)}`);
      }
    }
  }
  assert.deepEqual(suender, [],
    'Die Rechenmodule muessen ohne Browser laufen — sonst sind sie nicht testbar.');
});

// ── Adressen stehen in der Konfiguration, nicht im Code ──────────────────────

test('keine Serveradressen im Quellcode', () => {
  assert.deepEqual(befunde('adressen'), [], REGELN.adressen.hinweis);
});

// ── Der Admin-Zugang gehoert nicht in eine URL ───────────────────────────────

test('kein Token als Query-Parameter', () => {
  assert.deepEqual(befunde('token'), [], REGELN.token.hinweis);
});

// ── Die Ausnahmeliste darf ihren Grund nicht ueberleben ──────────────────────

test('jede Ausnahme wird noch gebraucht', () => {
  const ueberfaellig = [];
  for (const [datei, eintrag] of Object.entries(AUSNAHMEN)) {
    if (!fs.existsSync(path.join(wurzel, datei))) {
      ueberfaellig.push(`${datei} — Datei existiert nicht mehr`);
      continue;
    }
    for (const regelName of eintrag.regeln) {
      if (sucheIn(datei, REGELN[regelName]).length === 0) {
        ueberfaellig.push(`${datei} — verstoesst nicht mehr gegen "${regelName}"`);
      }
    }
  }
  assert.deepEqual(ueberfaellig, [],
    'Diese Eintraege in AUSNAHMEN sind ueberfluessig geworden und muessen raus. ' +
    'Sonst waechst aus der dokumentierten Schuld wieder eine stille Erlaubnis — ' +
    'genau die Luecke, die am 16.09.2026 drei Verstoesse verdeckt hat.');
});

// ── Noch offen: die naechste Etappe ──────────────────────────────────────────
//
// Stand 22.09.2026: `js/dienste/speicher.js` existiert jetzt — das Ziel
// dieses Schritts ist also gebaut. Was noch fehlt, ist die Umstellung der
// sieben Fundstellen in der KLASSISCHEN Flaeche:
//
//   js/admin.js:22,25,55,76 · js/debriefing.js:71 · js/planspiel.js:82,103
//
// Sie bleiben liegen, bis entschieden ist, wie lange index-klassisch.html
// noch gebraucht wird (siehe entwurf/PLANUNG-AUSBAU.md, Abschnitt 15). Der
// Verhandlungstisch selbst haelt die Regel bereits ein.
//
// Sobald die sieben umgestellt sind: `todo` entfernen — nicht vorher, denn
// ein Test, der rot ist und rot bleiben darf, wird nach zwei Wochen ignoriert.

test('localStorage nur in js/dienste/', { todo: 'noch 7 Fundstellen in der klassischen Flaeche' }, () => {
  assert.deepEqual(befunde('speicher'), []);
});
