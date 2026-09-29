<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- Copyright 2025 Florian Aram Feuerriegel — kassensturz.org -->

# ADR 005 — Statische Dateien brauchen Cache-Regeln

**Status:** offen · **Datum:** 20.09.2026

## Was aufgefallen ist

Beim Test des Verhandlungstischs gegen den lokalen Worker lieferte der
Browser hartnäckig eine **veraltete Fassung** von `js/dienste/server.js`
(6.411 statt 7.946 Bytes) — und, schlimmer, eine veraltete `konfig.js` mit
der **alten API-Adresse**. Beides mehrere Neuladen lang.

Die Ursache ist kein Fehler im Code: `python3 -m http.server` sendet nur
`Last-Modified` und kein `Cache-Control`. Browser wenden dann *heuristisches
Caching* an — typischerweise 10 % der bisherigen Lebensdauer der Datei. Eine
Datei, die seit Wochen unverändert war, bleibt danach stundenlang im Cache,
auch wenn sie sich gerade geändert hat.

## Warum das mehr ist als eine Unbequemlichkeit

Ohne Build-Schritt (ADR 001) tragen die Dateinamen keine Versionskennung.
Es gibt also nichts, was den Cache von selbst umgeht. Daraus folgen zwei
konkrete Betriebsrisiken:

1. **`konfig.js` ist die Datei, die beim Ausrollen ersetzt wird.** Wird sie
   gecacht, spricht eine Oberfläche nach dem Umzug auf den Uni-Server
   weiterhin mit der alten Adresse — bei Studierenden, die die Seite vorher
   schon einmal offen hatten.
2. **ES-Module werden einzeln gecacht.** Eine aktualisierte Oberfläche kann
   auf ein veraltetes Modul treffen; dann fehlt ein Export, und die Seite
   bleibt schwarz. Genau dieser Fehler trat im Test auf
   (`does not provide an export named 'legeEinspruchEin'`).

Im Seminar fällt das auf die unangenehmste Art auf: bei einem Teil der
Studierenden läuft es, bei einem anderen nicht, und beide haben dieselbe
Adresse aufgerufen.

## Was zu entscheiden ist

Der Server muss Cache-Regeln senden. Vorschlag:

| Datei | Regel | Grund |
|---|---|---|
| `konfig.js` | `Cache-Control: no-store` | wird beim Ausrollen ersetzt |
| `*.html` | `no-cache` (revalidieren) | Einstiegspunkte |
| `js/**`, `css/**` | `no-cache` bis Versionskennungen existieren | Module hängen zusammen |
| `fonts/**` | `max-age=31536000, immutable` | ändern sich nie |

Auf Cloudflare Pages geht das über `_headers`, auf einem Apache/nginx der
Hochschule über die Server-Konfiguration. Für `npm start` (lokale
Entwicklung) bleibt es bei der Einschränkung — dort hilft im Zweifel ein
Neuladen mit geleertem Cache.

**Nicht entschieden:** ob stattdessen mittelfristig Versionskennungen in die
Dateinamen sollen. Das hieße Build-Schritt und widerspräche ADR 001.

## Was noch nicht getan ist

Diese Datei hält den Befund fest, sie behebt ihn nicht. Die Cache-Regeln
gehören zur Ausrollumgebung und sind mit der Hochschul-IT abzustimmen.
