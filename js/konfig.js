// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// KASSENSTURZ · Konfigurationszugriff
//
// Liest die Laufzeitkonfiguration aus /konfig.js (window.KASSENSTURZ_KONFIG)
// und füllt fehlende Werte mit Vorgaben. Alle anderen Dateien holen ihre
// Adressen von hier — nirgends sonst steht eine.
//
// Fehlt /konfig.js oder ist api_basis leer, läuft das Planspiel vollständig
// offline weiter (localStorage). Das ist ein gültiger Betriebsfall, kein
// Fehler: siehe entwurf/BETRIEB.md, Zielbild A.
// ═══════════════════════════════════════════════════════════════════════════

const roh = (typeof window !== 'undefined' && window.KASSENSTURZ_KONFIG) || {};

/** Version der Oberfläche — muss zu package.json passen. */
export const VERSION = '1.0.0';

export const KONFIG = {
  umgebung:  roh.umgebung  ?? 'unbekannt',
  api_basis: (roh.api_basis ?? '').replace(/\/+$/, ''),
  qr_dienst: (roh.qr_dienst ?? '').replace(/\/+$/, ''),
  tutor: {
    aktiv: Boolean(roh.tutor?.aktiv) && Boolean(roh.tutor?.basis) && Boolean(roh.tutor?.token),
    basis: (roh.tutor?.basis ?? '').replace(/\/+$/, ''),
    token: roh.tutor?.token ?? '',
  },
};

/**
 * Adresse eines QR-Bildes für den übergebenen Inhalt — oder null, wenn kein
 * Dienst konfiguriert ist. Der Inhalt verlässt damit das Haus: siehe den
 * Warnhinweis in /konfig.js.
 */
export function qrAdresse(inhalt, groesse = 180) {
  if (!KONFIG.qr_dienst) return null;
  return `${KONFIG.qr_dienst}/?size=${groesse}x${groesse}&data=${encodeURIComponent(inhalt)}`;
}

/** Ist eine Sitzungsverwaltung konfiguriert? Sonst: Offline-Betrieb. */
export function hatBackend() {
  return KONFIG.api_basis !== '';
}

/**
 * Baut eine API-Adresse. Wirft, wenn kein Backend konfiguriert ist — damit
 * ein vergessener Aufruf sofort auffällt statt still gegen '' zu laufen.
 */
export function api(pfad) {
  if (!hatBackend()) {
    throw new Error('Kein Backend konfiguriert (konfig.js: api_basis ist leer).');
  }
  return KONFIG.api_basis + (pfad.startsWith('/') ? pfad : '/' + pfad);
}
