// SPDX-License-Identifier: CC-BY-4.0
// Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
// ═══════════════════════════════════════════════════════════════════════════
// LAUFZEITKONFIGURATION — VORLAGE
//
// Diese Datei nach `konfig.js` kopieren und ausfüllen. `konfig.js` selbst ist
// bewusst NICHT versioniert: sie trägt Adressen und Zugangsschlüssel, die je
// Umgebung anders sind und nicht in die Historie gehören.
//
//     cp konfig.beispiel.js konfig.js
//
// Ohne `konfig.js` läuft das Planspiel im Offline-Betrieb — das ist ein
// gültiger Betriebsfall, kein Fehler.
//
// DIESE DATEI WIRD BEIM AUSROLLEN ERSETZT — sie ist die einzige Stelle, an der
// Adressen stehen. Im Code selbst steht keine einzige mehr.
//
// Pro Umgebung eine eigene Fassung:
//   lokal       → api_basis: 'http://localhost:8787/api',  tutor aktiv
//   Uni-Test    → api_basis: '/api',                        tutor aus
//   Produktion  → api_basis: '/api',                        tutor aus
//
// Fehlt die Datei ganz, läuft das Planspiel im Offline-Betrieb weiter
// (localStorage, keine Sitzungen) — siehe js/konfig.js.
// ═══════════════════════════════════════════════════════════════════════════

window.KASSENSTURZ_KONFIG = {

  // Welche Umgebung läuft hier? Erscheint in der Fußzeile und im Protokoll.
  umgebung: 'entwicklung',

  // Adresse der Sitzungsverwaltung.
  //   ''      → kein Backend, reiner Offline-Betrieb
  //   '/api'  → gleicher Ursprung wie die Oberfläche (Zielbild B, kein CORS)
  //
  // Übergangsweise noch Cloudflare, bis der Uni-Server steht.
  // Siehe entwurf/BETRIEB.md, Abschnitt 1.4.
  api_basis: '',

  // QR-Code für die Beitritts-URL.
  //
  // ACHTUNG: Der Dienst bekommt dabei die vollständige Join-URL inklusive
  // Sitzungs-ID zu sehen — ein externer Anbieter erfährt also, dass und wann
  // hier eine Lehrveranstaltung läuft. Auf einem Uni-Server entweder leer
  // lassen (dann bietet das Dashboard keinen QR-Code an) oder durch eine
  // lokale Erzeugung ersetzen.
  qr_dienst: 'https://api.qrserver.com/v1/create-qr-code/',

  // Kassensturz-Tutor (Dify-Chatbot, fragt die Projektdokumentation ab).
  // Läuft nur, wo ein Dify-Server erreichbar ist — auf dem Uni-Server
  // bis auf Weiteres aus.
  tutor: {
    aktiv: false,
    basis: 'http://localhost:8080',
    token: '',
  },

};
