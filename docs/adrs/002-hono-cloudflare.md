# ADR 002 — Hono.js auf Cloudflare Workers als Backend

**Status:** Akzeptiert  
**Datum:** 2026-05-22

## Kontext

Das Planspiel braucht ein Backend für Session-Management und Multi-Team-Voting.
Das Entwicklerteam hat keine Erfahrung mit Server-Programmierung. Der Stack muss
so einfach wie möglich sein und mit einem einzigen Befehl deploybar.

## Entscheidung

Backend: **Hono.js** als Framework, deployed auf **Cloudflare Workers**.

## Begründung

**Hono.js:**
- Syntax ist nahezu identisch mit Frontend-JavaScript — keine neue Sprache nötig:
  ```js
  app.post('/api/sessions', async (c) => { ... })
  ```
- Sehr kleine API-Fläche (~5 Konzepte: `app`, `get/post/put`, `c.req`, `c.json`, `c.env`)
- Exzellente offizielle Dokumentation (hono.dev)
- Läuft auf Cloudflare Workers, Node.js und Bun ohne Änderungen

**Cloudflare Workers:**
- `wrangler deploy` — ein Befehl, kein Server-Management
- Kostenloses Tier: 100.000 Requests/Tag (reicht für Lehrveranstaltungen)
- Integriertes KV-Storage (→ ADR 003)
- Kein Cold-Start-Problem (im Gegensatz zu anderen Serverless-Plattformen)

**Alternativen verworfen:**
- *Express/Node auf VPS*: Erfordert Server-Verwaltung, SSH, Prozessmanagement
- *Firebase/Supabase*: Vendor-Lock-in, komplexere SDK-Integration, kostenpflichtig bei Wachstum
- *Vercel Functions*: Guter Kandidat, aber weniger Kontrolle; Hono + CF ist konsistenter

## Konsequenzen

- TypeScript wird verwendet (Hono hat erstklassige TS-Unterstützung; Typen verhindern
  häufige Fehler bei API-Parametern)
- Lokale Entwicklung: `wrangler dev` startet einen lokalen Worker-Emulator
- Deployment-Voraussetzung: Node.js + Wrangler CLI (`npm install -g wrangler`)
