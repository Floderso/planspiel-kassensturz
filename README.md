# Kassensturz Planspiel

Interaktives Wirtschaftspolitik-Planspiel für Lehrveranstaltungen (BWL/VWL).  
Studierende stellen in Teams Steuerpolitik-Parameter ein; die Simulation zeigt
sofort Haushaltssaldo, Ungleichheit, CO₂ und BIP-Auswirkungen.

Privates Repo — nicht öffentlich zugänglich.

---

## Dokumentation

| Dokument | Inhalt |
| -------- | ------ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Systemüberblick, Komponentendiagramm, Datenfluss |
| [docs/ENGINE.md](docs/ENGINE.md) | Wie die Rechenmodule funktionieren (ohne Code lesen zu müssen) |
| [docs/API.md](docs/API.md) | Alle API-Endpunkte mit Beispielen |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Schritt-für-Schritt: Frontend + Backend deployen |
| [docs/adrs/](docs/adrs/) | Architekturentscheidungen (ADR 001–004) |

---

## Projektstruktur

```text
index.html              → Planspiel-UI (statisch, kein Build-Schritt)
js/
  planspiel.js          → UI-Controller, URL-Config, API-Sync
  data.js               → Wirtschaftsdaten, Kurskonfiguration, Schock-Bibliothek
  rechner/
    berechne.js         → Hauptsimulation (eine Periode)
    transition.js       → Multi-Perioden-Übergänge, DICE-Klimaschaden, HANK
    abgeleitet.js       → Fiskalindikatoren (Domar, S2, GGI)
    verteilung.js       → Dezil-Verteilung, Gini, Palma
    einkommensteuer.js  → § 32a EStG Formeltarif
    rente.js            → Rentenversicherungs-Projektionen (Phase 3)
api/
  src/index.ts          → Hono.js API (Cloudflare Workers)
  wrangler.toml         → Cloudflare-Konfiguration
  package.json
docs/
  ARCHITECTURE.md
  ENGINE.md
  API.md
  DEPLOYMENT.md
  adrs/                 → Architecture Decision Records
```

---

## Schnellstart (offline, kein Backend nötig)

```bash
npx serve .
# → http://localhost:3000
```

Das Planspiel läuft vollständig ohne Backend — State wird in `localStorage` gespeichert.

## Kurskonfiguration per URL

Lehrpersonen können die Konfiguration per URL-Parameter setzen:

```text
?perioden=5&teams=4&sandbox=false&name=WiPo+SS26
```

| Parameter | Beschreibung | Standard |
| --------- | ------------ | -------- |
| `perioden` | Anzahl Spielperioden (1–12) | 5 |
| `teams` | Spieler je Team (1–50) | 4 |
| `sandbox` | `false` = echter Abstimmungsmodus | `true` |
| `name` | Kursname in der Session-Bar | — |
| `session` | Backend-Session-ID (Phase 2b) | — |

## Multi-Team-Betrieb (mit Backend)

Deployment-Anleitung: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## Engine-Synchronisation

Die Rechenmodule (`js/rechner/`, `js/data.js`) sind eine eigenständige Kopie  
der Kassensturz-Engine (Stand 2026-05-22). Bei Engine-Updates die geänderten  
Dateien manuell übernehmen und auf Kompatibilität prüfen.  
Technische Details der Engine: [docs/ENGINE.md](docs/ENGINE.md)

---

## Deployment

| Komponente | Empfehlung | Kosten |
| ---------- | ---------- | ------ |
| Frontend | GitHub Pages / Netlify | Kostenlos |
| Backend | Cloudflare Workers Free Tier | Kostenlos |

Ziel-URL: `planspiel.kassensturz.de`

## Lizenz

Interne Nutzung. Engine-Code: CC-BY-4.0 (kassensturz.org).
