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
| `name` | string | `"Planspiel"` | Anzeigename des Kurses (höchstens 120 Zeichen) |
| `perioden_anzahl` | number | `5` | Anzahl Spielperioden (1–12, sonst Standard) |
| `perioden_laenge_jahre` | number \| number[] | `4` | Jahre je Periode (1–20), als Array je Periode |
| `team_names` | string[] | `Team A–C` | Systemnamen der Teams |
| `team_groesse` | number | `4` | Plätze je Team (1–12, sonst Standard) |
| `ressorts` | string[] | alle vier | Ressorts am Tisch — mindestens zwei, sonst `400` |
| `quorum` | string | `"einfach"` | `einfach` · `absolut` · `einstimmig`, Unbekanntes wird `einfach` |
| `perioden_werkzeuge` | object | — | Offene Werkzeuge je Periode, siehe unten |
| `min_teilnahme_quote` | number | `0.5` | Mindestanteil für Perioden-Lock (0–1) — nur klassische Fläche, siehe `/vote` |
| `sandbox` | boolean | `false` | Sandbox = kein Quorum nötig |

Am Verhandlungstisch spielt die Quote **keine Rolle mehr**: seit 28.09.2026
sperrt `/vote` eine Periode, sobald jedes Ressort eine angenommene Vorlage
hat — und vorher nicht, egal welche Quote gilt. Die Einrichtung setzt
trotzdem `0`, damit auch eine Sitzung ohne Vorlagen nicht an zwei Stimmen
hängt. Vorher blieb eine Tischsitzung mit `0.5` auf ewig offen, weil nur ein
Gerät den Schluss meldet.

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

**`409`**, wenn eine Periode als `locked` geschickt wird, die noch nicht
freigegeben ist (`idx ≥ perioden_freigegeben`). Sperren darf nur, was die
Lehrperson freigegeben hat — sonst umginge ein einziger PUT die Freigabe.

---

### `POST /api/sessions/:id/teams/:team/vote`

Meldet den Abschluss einer Periode. Zwei Flächen, zwei Regeln:

- **Verhandlungstisch** (die Periode hat Vorlagen): gesperrt wird, sobald
  jedes Ressort aus `ressorts` eine Vorlage im Stand `angenommen` hat.
  Fehlt eine, antwortet der Server **`409`** und zählt die Meldung nicht.
- **Klassische Fläche** (keine Vorlagen): gesperrt wird, wenn das Quorum
  (`min_teilnahme_quote × Mitglieder`) erreicht ist.

**`409`** außerdem, wenn die Periode noch nicht freigegeben ist.

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
| `403` | Admin-Token fehlt oder stimmt nicht |
| `404` | Session oder Team nicht gefunden |
| `409` | Widerspricht dem Stand: Periode geschlossen oder nicht freigegeben, Werkzeug noch zu, Vorlage schon angenommen |
| `422` | Inhaltlich unvollständig — etwa eine Vorlage ohne Begründung |
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

### `GET /api/sessions/:id/teams/:team/vorlagen?periode_idx=n`

Vorlagen einer Periode mit Auszählung. Seit 24.09.2026 zusätzlich
`locked`: ob die Periode schon geschlossen ist. Daran merken die anderen
Geräte eines Teams, dass eines die Runde geschlossen hat. Seit 28.09.2026
außerdem `perioden_freigegeben` — der Tisch fragt diesen Endpunkt ohnehin
alle vier Sekunden ab und merkt so, wenn die Lehrperson die nächste
Periode freischaltet.

```json
{ "vorlagen": { "fin": { "stand": "eingebracht", "…": "…" } },
  "quorum": "einfach", "ressorts": ["fin", "wir", "soz", "umw"], "locked": false,
  "perioden_freigegeben": 1 }
```

### `POST /api/sessions/:id/teams/:team/vorlagen`

Eine Vorlage einbringen: `{ periode_idx, ressort, aenderungen, begruendung,
person }`. Die einbringende Person stimmt automatisch zu.

**`409`**, wenn die Periode geschlossen oder nicht freigegeben ist, die
Vorlage schon angenommen ist — oder wenn `aenderungen` eine Stellgröße
eines Werkzeugs anfasst, das in dieser Periode noch nicht offen ist (siehe
`/werkzeuge`). **`422`** ohne Begründung.

### `PUT /api/sessions/:id/schocks` *(Admin)*

Ereignisse je Periode: `{ "schocks": [{ "id": "nachfrage_2", "periode": 2, … }] }`.
Gerechnet wird mit dem Eintrag aus `SCHOCK_BIBLIOTHEK` (js/data.js) unter
dieser `id`, nicht mit der mitgeschickten Kopie.

**`409`**, wenn sich das Ereignis einer Periode ändern würde, die schon
jemand gesehen hat: sie ist freigegeben (`periode < perioden_freigegeben`)
oder ein Team hat die Periode davor abgeschlossen. Sonst änderten sich
rückwirkend Ergebnisse, über die Teams schon abgestimmt haben. Jede Änderung
wird in `eingriffe` vermerkt.

### `PUT /api/sessions/:id/werkzeuge` *(Admin)*

`{ "perioden_werkzeuge": { "0": ["est", "kst", "transfers", "co2"], "1": […] } }` —
je Periodenindex die offenen Werkzeuge (Kennungen aus `MOD_DEFS`). Fehlt der
Eintrag einer Periode, ist dort alles offen. Die klassische Fläche schreibt
Ressortnamen (`"finanzen"`, `"klima"`); die verstehen Tisch und Server.

Seit 28.09.2026 prüft der Server beim Einbringen einer Vorlage, ob sie nur
offene Werkzeuge anfasst (`409` sonst). Die Zuordnung Stellgröße → Werkzeug
steht in `api/src/werkzeuge.json`; `tests/spielkern.test.js` hält sie mit
`js/spielkern.js` gleich.

### `PUT /api/sessions/:id/freigabe` *(Admin)*

`{ "perioden_freigegeben": n }` — wie viele Perioden gespielt werden dürfen
(1 … `perioden_anzahl`). Die Leitung schaltet damit Periode für Periode
frei (E4).

Seit 28.09.2026 hält der **Server** die Reihenfolge ein, nicht nur die
Oberfläche: eine Periode mit `idx ≥ perioden_freigegeben` nimmt weder
Vorlage noch Stimme, Begründung, Unterschrift noch Abschlussmeldung an
(`409`). Der Tisch wartet nach dem Rundenschluss sichtbar auf die Freigabe.

### Was dabei zu beachten ist

`PUT /teams/:team` überschreibt den Teamstand **nicht** mehr vollständig:
Unterschriften und Einsprüche gehören dem Server und werden beim Speichern
übernommen. Sonst löschte jedes Sichern eines Geräts die Unterschriften der
drei anderen.

Ein Team aus `team_names` darf zeichnen, **bevor** es zum ersten Mal
gespeichert hat — am Verhandlungstisch kann die erste Unterschrift fallen,
ehe jemand eine Zahl angefasst hat. Ein Team, das nicht in `team_names`
steht, wird weiterhin abgelehnt.
