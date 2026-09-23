# API-Referenz

Base URL: `https://planspiel-api.<dein-subdomain>.workers.dev`  
Lokal: `http://localhost:8787`

Alle Endpunkte unter `/api/`. Alle Requests und Responses: `Content-Type: application/json`.

Die Adresse steht **nicht mehr im Code**, sondern in `/konfig.js` (`api_basis`).

## Admin-Zugang

Endpunkte, die der Lehrperson vorbehalten sind, erwarten den Admin-Token im
Kopf der Anfrage:

```
Authorization: Bearer <admin_token>
```

`?token=…` wird aus Rücksichtnahme auf ältere Links weiterhin akzeptiert, ist
aber **abgekündigt**: Query-Parameter landen in Serverprotokollen und im
Browserverlauf. Neue Aufrufe nutzen den Header.

---

## Betrieb

### `GET /health`

Sagt, ob der Dienst läuft. Liegt bewusst außerhalb von `/api/` (kein CORS) und
enthält keinerlei Sitzungsinformation.

```json
{ "status": "ok", "version": "1.0.0", "zeit": "2026-09-12T14:03:00.000Z" }
```

Mit `?speicher=1` wird zusätzlich geprüft, ob die Speicherbindung antwortet;
schlägt das fehl, antwortet der Endpunkt mit `503` und
`{ "status": "fehler", "speicher": "nicht erreichbar" }`.

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
POST /sessions          → Session wird angelegt (TTL: 180 Tage, ~1 Semester)
PUT  /sessions/:id/...  → Jeder Write setzt die TTL zurück
                        → Nach 180 Tagen Inaktivität automatisch gelöscht (KV-TTL)

Die Frist steht in api/src/index.ts als SESSION_TTL. Sie gilt auch für
hochgeladene Matrikelnummern — siehe entwurf/BETRIEB.md, Abschnitt 5.
```

## Der Verhandlungstisch — namentliche Unterschriften

Seit dem 20.09.2026. Anders als `POST /vote`, das nur eine Stimme hochzählt,
halten diese Endpunkte fest, **wer** gezeichnet hat. `vote` bleibt daneben
bestehen — `index-klassisch.html` benutzt es weiter.

Die Ressorts einer Sitzung stehen in `session.ressorts` (Vorgabe
`["fin","wir","soz","umw"]`, bei der Anlage überschreibbar). Sobald jedes
davon gezeichnet hat **und** kein Einspruch mehr steht, wird die Periode
automatisch gesperrt.

### `POST /api/sessions/:id/teams/:team/zeichnung`

Ein Ressort zeichnet die Mappe.

```json
{ "periode_idx": 0, "ressort": "fin", "person": "Amira", "matrikelnummer": "7712345" }
```

`matrikelnummer` bleibt leer, wenn jemand für eine andere Person zeichnet —
eine falsche Zuordnung personenbezogener Daten wäre schlimmer als keine.

Antwort: `{ ok, offen[], widerspruch[], locked, zeichnungen, einsprueche }`.
`offen` sind die Ressorts ohne Unterschrift, `widerspruch` die mit Einspruch.

### `DELETE /api/sessions/:id/teams/:team/zeichnung/:ressort`

Unterschrift zurückziehen, Rumpf `{ "periode_idx": 0 }`. Nach dem Sperren
der Periode nicht mehr möglich (409).

### `POST /api/sessions/:id/teams/:team/einspruch`

```json
{ "periode_idx": 0, "ressort": "soz", "person": "Lea", "grund": "optional" }
```

Sperrt den Rundenschluss. Wer Einspruch einlegt, verliert seine Unterschrift;
wer zeichnet, nimmt seinen Einspruch zurück.

### `DELETE /api/sessions/:id/teams/:team/einspruch/:ressort`

Einspruch zurücknehmen, Rumpf `{ "periode_idx": 0 }`.

### Was dabei zu beachten ist

`PUT /teams/:team` überschreibt den Teamstand **nicht** mehr vollständig:
Unterschriften und Einsprüche gehören dem Server und werden beim Speichern
übernommen. Sonst löschte jedes Sichern eines Geräts die Unterschriften der
drei anderen.

Ein Team aus `team_names` darf zeichnen, **bevor** es zum ersten Mal
gespeichert hat — am Verhandlungstisch kann die erste Unterschrift fallen,
ehe jemand eine Zahl angefasst hat. Ein Team, das nicht in `team_names`
steht, wird weiterhin abgelehnt.
