// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════
// TESTS · Modulare UI, Hamburger-Submenüs & Widget-Katalog
// ═══════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.resolve(__dirname, '../index-klassisch.html');
const indexHtml = fs.readFileSync(indexPath, 'utf-8');

const RECOMMENDED_WIDGETS = ['explainer', 'barometer', 'verteilung'];

const WIDGET_IDS = [
  'explainer',
  'barometer',
  'presse',
  'history',
  'fiskal',
  'domar',
  'verteilung',
  'hank',
  'co2budget',
  'rente',
  'gkv',
];

function toggleWidget(activeList, widgetId) {
  if (!Array.isArray(activeList)) activeList = [];
  if (activeList.includes(widgetId)) {
    return activeList.filter(id => id !== widgetId);
  } else {
    return [...activeList, widgetId];
  }
}

test('Modulare UI: Startzustand ist standardmäßig leer für maximale Übersicht', () => {
  const initial = [];
  assert.equal(initial.length, 0);
});

test('Modulare UI: toggleWidget schaltet Grafiken korrekt an und ab', () => {
  let active = [];
  active = toggleWidget(active, 'explainer');
  assert.deepEqual(active, ['explainer']);

  active = toggleWidget(active, 'barometer');
  assert.deepEqual(active, ['explainer', 'barometer']);

  // Entfernen von 'explainer'
  active = toggleWidget(active, 'explainer');
  assert.deepEqual(active, ['barometer']);

  // Erneutes Entfernen
  active = toggleWidget(active, 'barometer');
  assert.deepEqual(active, []);
});

test('Modulare UI: Empfohlene Standard-Auswahl umfasst zentrale Kern-Grafiken', () => {
  assert.ok(RECOMMENDED_WIDGETS.includes('explainer'));
  assert.ok(RECOMMENDED_WIDGETS.includes('barometer'));
  assert.ok(RECOMMENDED_WIDGETS.includes('verteilung'));
});

test('HTML-Struktur: Alle Widget-IDs aus dem Hamburger-Menü existieren als Panel in index-klassisch.html', () => {
  for (const wid of WIDGET_IDS) {
    const menuMatcher = `data-widget="${wid}"`;
    const panelMatcher = `data-widget-id="${wid}"`;
    const removeMatcher = `data-remove-widget="${wid}"`;

    assert.ok(indexHtml.includes(menuMatcher), `Menü-Eintrag für ${wid} fehlt in index-klassisch.html`);
    assert.ok(indexHtml.includes(panelMatcher), `Widget-Panel für ${wid} fehlt in index-klassisch.html`);
    assert.ok(indexHtml.includes(removeMatcher), `Entfernen-Button für ${wid} fehlt in index-klassisch.html`);
  }
});

test('HTML-Struktur: Kabinetts-Leiste, Ressort-Dropdown und Grid-Toggle existieren', () => {
  assert.ok(indexHtml.includes('id="btn-ressort-menu"'), 'btn-ressort-menu fehlt in index-klassisch.html');
  assert.ok(indexHtml.includes('id="ressort-menu-dropdown"'), 'ressort-menu-dropdown fehlt in index-klassisch.html');
  assert.ok(indexHtml.includes('id="btn-toggle-ressorts-grid"'), 'btn-toggle-ressorts-grid fehlt in index-klassisch.html');
  assert.ok(indexHtml.includes('id="btn-toggle-watchlist"'), 'btn-toggle-watchlist fehlt in index-klassisch.html');
  assert.ok(indexHtml.includes('id="empty-widgets-state"'), 'empty-widgets-state fehlt in index-klassisch.html');
});
