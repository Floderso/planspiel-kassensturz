// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// ENTWICKLUNGSSERVER — statische Dateien, garantiert ohne Zwischenspeicher
//
// `python3 -m http.server` sendet nur Last-Modified und kein Cache-Control.
// Browser wenden dann heuristisches Zwischenspeichern an: eine Datei, die
// lange unveraendert war, bleibt danach STUNDENLANG im Cache — auch wenn sie
// sich gerade geaendert hat.
//
// Beim Ausbau ist das taeglich aufgefallen: eine geaenderte Oberflaeche trifft
// auf ein veraltetes Modul, dem ein Export fehlt, und die Seite bleibt
// schwarz. Oder schlimmer: konfig.js kommt mit der ALTEN Serveradresse.
//
// Dieser Server sendet no-store. Fuer die Entwicklung ist das richtig; fuer
// den Betrieb gelten die Regeln aus docs/adrs/005-cache-header-fuer-statische-
// module.md, die der Ausrollserver setzen muss.
//
// Kein npm-Paket, keine Abhaengigkeit — node:http und node:fs reichen.
// ═══════════════════════════════════════════════════════════════════════════

import http from 'node:http';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port   = Number(process.argv[2] ?? process.env.PORT ?? 8020);

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.md':   'text/markdown; charset=utf-8',
  '.csv':  'text/csv; charset=utf-8',
};

/**
 * Loest eine Adresse zu einer Datei im Projekt auf — oder zu null.
 *
 * Der Pfadvergleich am Ende ist kein Schmuck: ohne ihn koennte `..` in der
 * Adresse Dateien ausserhalb des Projekts ausliefern.
 */
function dateiZu(adresse) {
  const pfad = decodeURIComponent(new URL(adresse, 'http://x').pathname);
  let ziel = path.join(wurzel, pfad);
  if (!ziel.startsWith(wurzel + path.sep) && ziel !== wurzel) return null;
  try {
    if (fs.statSync(ziel).isDirectory()) ziel = path.join(ziel, 'index.html');
  } catch { return null; }
  return fs.existsSync(ziel) && fs.statSync(ziel).isFile() ? ziel : null;
}

http.createServer((anfrage, antwort) => {
  const datei = dateiZu(anfrage.url);
  if (!datei) {
    antwort.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8',
                             'Cache-Control': 'no-store' });
    antwort.end(`Nicht gefunden: ${anfrage.url}\n`);
    return;
  }
  antwort.writeHead(200, {
    'Content-Type':  TYPEN[path.extname(datei).toLowerCase()] ?? 'application/octet-stream',
    // Der eigentliche Zweck dieser Datei.
    'Cache-Control': 'no-store, must-revalidate',
    'Pragma':        'no-cache',
  });
  fs.createReadStream(datei).pipe(antwort);
}).listen(port, () => {
  console.log(`Kassensturz auf http://localhost:${port} — ohne Zwischenspeicher`);
});
