# API-Referenz

Base URL: `https://planspiel-api.<dein-subdomain>.workers.dev`  
Lokal: `http://localhost:8787`

Alle Endpunkte unter `/api/`. Alle Requests und Responses: `Content-Type: application/json`.

---

## Endpunkte

### `POST /api/sessions`

Erstellt eine neue Spielsession. Wird von der Lehrperson aufgerufen.

**Request-Body:**

```json
{
  "name":                 "WiPo SS26",
  "perioden_anzahl":      5,
  "team_groesse":         4,
  "min_teilnahme_quote":  0.5,
  "sandbox":              false
}
```

Alle Felder optional — fehlende Felder erhalten Standardwerte.

| Feld | Typ | Standard | Beschreibung |
|------|-----|---------|---|
| `name` | string | `"Planspiel"` | Anzeigename des Kurses |
| `perioden_anzahl` | number | `5` | Anzahl Spielperioden (1–12) |
| `team_groesse` | number | `4` | Spieler je Team |
| `min_teilnahme_quote` | number | `0.5` | Mindestanteil für Perioden-Lock (0–1) |
| `sandbox` | boolean | `false` | Sandbox = kein Quorum nötig |

**Response `201 Created`:**

```json
{
  "session_id": "ABC123",
  "join_url":   "https://planspiel.kassensturz.de?session=ABC123&perioden=5&teams=4&sandbox=false&name=WiPo+SS26"
}
```

Die `join_url` kann direkt an Studierende weitergegeben werden.

---

### `GET /api/sessions/:id`

Gibt den vollständigen Session-State zurück. Wird vom Frontend alle 5 Sekunden
gepolt (→ [ADR 004](adrs/004-http-polling.md)).

**Response `200 OK`:**

```json
{
  "id":                   "ABC123",
  "name":                 "WiPo SS26",
  "perioden_anzahl":      5,
  "team_groesse":         4,
  "min_teilnahme_quote":  0.5,
  "sandbox":              false,
  "created_at":           "2026-05-22T10:00:00.000Z",
  "expires_at":           "2026-05-23T10:00:00.000Z",
  "teams": {
    "Team A": {
      "last_updated": "2026-05-22T10:15:00.000Z",
      "perioden": [
        {
          "idx":    0,
          "locked": true,
          "votes":  4,
          "params": {
            "freibetrag":    12348,
            "eingang":       14.0,
            "spitze":        45.0,
            "mwst":          19.0,
            "mwst_erm":       7.0,
            "co2":            55,
            "kst":            15.0,
            "gewst":          14.0,
            "rv":             18.6,
            "kv":             14.6,
            "bbg":          90600,
            "invest_impuls":   0
          }
        }
      ]
    }
  }
}
```

**Response `404 Not Found`:**

```json
{ "error": "Session nicht gefunden" }
```

---

### `PUT /api/sessions/:id/teams/:team`

Speichert den Perioden-State eines Teams. Wird nach jeder Parameteränderung
(ca. alle 500 ms gedrosselt) und beim Abschließen einer Periode aufgerufen.

**URL-Parameter:** `:team` = URL-encoded Teamname (z. B. `Team%20A`)

**Request-Body:**

```json
{
  "perioden": [
    { "idx": 0, "locked": false, "votes": 0, "params": { ... } },
    { "idx": 1, "locked": false, "votes": 0, "params": { ... } }
  ]
}
```

**Response `200 OK`:**

```json
{ "ok": true }
```

---

### `POST /api/sessions/:id/teams/:team/vote`

Registriert eine Stimme für den Abschluss einer Periode. Wenn das Quorum
(`min_teilnahme_quote × team_groesse`) erreicht ist, wird die Periode
automatisch gesperrt.

**Request-Body:**

```json
{ "periode_idx": 0 }
```

**Response `200 OK`:**

```json
{
  "ok":     true,
  "locked": true,
  "votes":  4
}
```

| Feld | Beschreibung |
|------|---|
| `locked` | `true` wenn Periode nach diesem Vote gesperrt wurde |
| `votes` | Aktuelle Anzahl Stimmen für diese Periode |

---

### `GET /api/sessions/:id/results`

Gibt die Parameter aller Teams zurück — für den Ergebnis-Vergleich am Ende.
Das Frontend berechnet die Simulation aus diesen Parametern neu (→ [ADR 001](adrs/001-engine-client-side.md)).

**Response `200 OK`:**

```json
{
  "session_id":      "ABC123",
  "name":            "WiPo SS26",
  "perioden_anzahl": 5,
  "teams": {
    "Team A": [ { "idx": 0, "locked": true, "votes": 4, "params": { ... } }, ... ],
    "Team B": [ { "idx": 0, "locked": true, "votes": 3, "params": { ... } }, ... ]
  }
}
```

---

## Fehler-Codes

| HTTP | Bedeutung |
|------|---|
| `400` | Ungültige Anfrage (fehlende Felder, falscher Typ) |
| `404` | Session oder Team nicht gefunden |
| `500` | Interner Server-Fehler (KV nicht erreichbar) |

---

## Session-Lifecycle

```
POST /sessions          → Session wird angelegt (TTL: 24 h)
PUT  /sessions/:id/...  → Jeder Write setzt TTL auf 24 h zurück
                        → Nach 24 h Inaktivität automatisch gelöscht (KV-TTL)
```
