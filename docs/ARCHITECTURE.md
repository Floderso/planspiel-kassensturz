# Systemarchitektur

## Überblick

Das Kassensturz-Planspiel ist eine Web-Anwendung für Lehrveranstaltungen.
Studierende stellen in Teams Steuerpolitik-Parameter ein; die Simulation zeigt
sofort die ökonomischen Konsequenzen. Eine Lehrperson verwaltet Sessions.

```
┌─────────────────────────────────────────────────────┐
│                  Browser (Client)                   │
│                                                     │
│  index.html ──→ js/planspiel.js (UI-Controller)     │
│                      │                              │
│              js/rechner/ (Engine)                   │
│         berechne · transition · abgeleitet          │
│         verteilung · einkommensteuer                │
│                      │                              │
│              js/data.js (Konstanten)                │
│                      │                              │
│         localStorage (Offline-State)                │
│              ↕  (wenn Session aktiv)                │
│         HTTP-Polling alle 5 s (→ ADR 004)           │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / REST
┌──────────────────────▼──────────────────────────────┐
│           Cloudflare Workers (Backend)              │
│                api/src/index.ts                     │
│                 (Hono.js App)                       │
│                      │                              │
│          POST /api/sessions                         │
│          GET  /api/sessions/:id                     │
│          PUT  /api/sessions/:id/teams/:team         │
│          POST /api/sessions/:id/teams/:team/vote    │
│          GET  /api/sessions/:id/results             │
│                      │                              │
│         Cloudflare KV (Session-Storage)             │
│         Key: "session:{id}" · TTL: 24 h             │
└─────────────────────────────────────────────────────┘
```

---

## Komponenten

### Frontend (`index.html` + `js/`)

Statische Dateien — kein Build-Schritt, kein Framework. Läuft auf jedem
statischen Hosting (GitHub Pages, Netlify, Vercel).

**Verantwortlichkeiten:**
- Slider-UI rendern und Eingaben entgegennehmen
- Simulation bei jeder Parameteränderung im Browser ausführen (< 5 ms)
- State in `localStorage` speichern (Offline-Betrieb)
- State bei aktiver Session mit dem Backend synchronisieren

**Offline-Modus:** Ohne `?session=`-URL-Parameter läuft alles ausschließlich
über `localStorage`. Das Backend ist optional — das Planspiel funktioniert auch
ohne Internetverbindung vollständig.

### Backend (`api/`)

Cloudflare Worker, geschrieben mit Hono.js (TypeScript).

**Verantwortlichkeiten:**
- Sessions erstellen und verwalten
- Team-States (Parameter + locked-Status) speichern
- Stimmen aggregieren
- Ergebnis-Vergleich aller Teams zurückgeben

Das Backend führt **keine Berechnungen** durch (→ [ADR 001](adrs/001-engine-client-side.md)).
Es ist ein reines Storage- und Koordinations-Backend.

### Simulation Engine (`js/rechner/`)

Pure-JavaScript-Module ohne Seiteneffekte. Können unverändert aus der
Kassensturz-Engine (kassensturz.org) übernommen werden.

Detaillierte Beschreibung: [ENGINE.md](ENGINE.md)

---

## Datenfluss: Normale Spielrunde

```
1. Lehrperson erstellt Session
   POST /api/sessions → {session_id: "abc123", join_url: "...?session=abc123"}

2. Studierende öffnen join_url im Browser
   Frontend liest ?session=abc123 → verbindet sich mit Session

3. Team stellt Slider ein
   Browser: params → berechne() → Ergebnis sofort angezeigt
   Hintergrund: PUT /api/sessions/abc123/teams/TeamA (Parameter speichern)

4. Team schließt Periode ab
   POST /api/sessions/abc123/teams/TeamA/vote
   → wenn Quorum erreicht: Periode locked

5. Andere Teams sehen Update
   GET /api/sessions/abc123 (alle 5 s) → Frontend rendert neu wenn locked

6. Lehrperson zeigt Ergebnis-Vergleich
   GET /api/sessions/abc123/results → alle Teams nebeneinander
```

---

## Deployment-Übersicht

| Komponente | Hosting | Kosten |
|---|---|---|
| Frontend (HTML/JS) | GitHub Pages / Netlify / Vercel | Kostenlos |
| Backend (Hono Worker) | Cloudflare Workers Free Tier | Kostenlos bis 100k Req/Tag |
| Storage (KV) | Cloudflare KV Free Tier | Kostenlos bis 1k Writes/Tag |

Schritt-für-Schritt-Anleitung: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## Technologie-Entscheidungen

Begründungen für alle Architekturentscheidungen sind in [docs/adrs/](adrs/) dokumentiert:

| ADR | Entscheidung |
|-----|---|
| [001](adrs/001-engine-client-side.md) | Simulation-Engine läuft client-seitig |
| [002](adrs/002-hono-cloudflare.md) | Hono.js auf Cloudflare Workers |
| [003](adrs/003-cloudflare-kv.md) | Cloudflare KV als Session-Storage |
| [004](adrs/004-http-polling.md) | HTTP-Polling statt WebSockets |

---

## Erweiterbarkeit (Phase 3)

Geplante Erweiterungen bauen auf dieser Architektur auf ohne strukturelle Änderungen:

- **Multi-Team-Dashboard:** Neuer Endpunkt `/api/sessions/:id/results` + neue HTML-Seite
- **Team-Passcode:** Feld in KV-Schema hinzufügen + Check in PUT-Handler
- **URL-Konfiguration:** Bereits im Frontend implementiert (→ `parseUrlKonfig()` in `planspiel.js`)
