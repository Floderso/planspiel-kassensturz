# Deployment-Anleitung

## Voraussetzungen

- [Node.js](https://nodejs.org) ≥ 18 (einmalig installieren)
- Kostenloses [Cloudflare-Konto](https://dash.cloudflare.com/sign-up)

---

## Reihenfolge

**Erst das Backend, dann das Frontend.** Das Frontend schickt den Admin-Token
seit der Umstellung als `Authorization`-Kopfzeile. Ein Backend, das diese
Kopfzeile noch nicht kennt, weist alle Admin-Aufrufe ab. Umgekehrt ist es
unkritisch: Ein neues Backend versteht auch alte Frontends.

---

## Frontend deployen

Das Frontend sind reine statische Dateien (`index.html` + `js/`) — kein Build-Schritt.

### Zuerst: `konfig.js` für die Zielumgebung

`/konfig.js` ist die **einzige** Datei mit Adressen. Vor dem Hochladen
anpassen:

```js
window.KASSENSTURZ_KONFIG = {
  umgebung:  'produktion',
  api_basis: 'https://<deine-api>/api',   // '' = Betrieb ganz ohne Backend
  tutor: { aktiv: false, basis: '', token: '' },
};
```

Zwei Dinge, die im Betrieb sonst Ärger machen:

- **Der Tutor gehört auf einem Server ausgeschaltet** (`aktiv: false`). Er
  zeigt auf einen Dify-Server, den es dort nicht gibt.
- **`konfig.js` darf nicht zwischengespeichert werden.** Sonst sehen Browser
  nach einer Umstellung noch die alte Adresse. Auf dem Webserver dafür
  `Cache-Control: no-store` für genau diese Datei setzen — bei einem
  Apache-Uni-Webspace zum Beispiel per `.htaccess`:

  ```apache
  <Files "konfig.js">
    Header set Cache-Control "no-store"
  </Files>
  ```

### Danach: hochladen

**Option A — GitHub Pages (empfohlen):**

1. Repository auf GitHub pushen
2. GitHub → Settings → Pages → Source: `main` Branch, Ordner `/` (root)
3. URL: `https://<dein-user>.github.io/<repo-name>/`

**Option B — Netlify / Vercel:**

1. Repository verbinden
2. Build-Befehl: leer lassen
3. Publish-Verzeichnis: `.` (Projektroot)

---

## Backend deployen (Cloudflare Worker)

### Schritt 1 — Wrangler installieren

```bash
npm install -g wrangler
```

### Schritt 2 — Bei Cloudflare anmelden

```bash
wrangler login
# Öffnet Browser → Cloudflare-Login → Zugriff erlauben
```

### Schritt 3 — Abhängigkeiten installieren

```bash
cd api/
npm install
```

### Schritt 4 — KV-Namespace anlegen

```bash
npx wrangler kv namespace create SESSIONS
```

Ausgabe:
```
✅ Created KV namespace "SESSIONS"
id = "abc123def456..."
```

Die ausgegebene `id` in [wrangler.toml](../api/wrangler.toml) eintragen:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id      = "abc123def456..."   # ← hier eintragen
```

### Schritt 5 — CORS-Ursprung setzen

In `wrangler.toml` die Frontend-URL eintragen:

```toml
[vars]
ALLOWED_ORIGINS = "https://<dein-user>.github.io,https://planspiel.kassensturz.de"
```

### Schritt 6 — Deployen

```bash
npx wrangler deploy
```

Ausgabe:
```
✅ Deployed planspiel-api to:
   https://planspiel-api.<dein-subdomain>.workers.dev
```

Diese URL ist die `API_BASE` für das Frontend.

---

## Frontend mit Backend verbinden

In [js/planspiel.js](../js/planspiel.js) die `API_BASE`-Konstante auf die Worker-URL setzen:

```js
const API_BASE = 'https://planspiel-api.<dein-subdomain>.workers.dev/api';
```

Danach Frontend neu deployen.

---

## Lokal entwickeln

Beide Teile gleichzeitig starten:

**Terminal 1 — Frontend:**
```bash
# Im Projektroot — statischer HTTP-Server
npx serve .
# Frontend läuft auf http://localhost:3000
```

**Terminal 2 — Backend:**
```bash
cd api/
npm run dev
# API läuft auf http://localhost:8787
```

In `planspiel.js` für lokale Entwicklung:
```js
const API_BASE = 'http://localhost:8787/api';
```

---

## Eine Session starten (Lehrperson)

```bash
curl -X POST https://planspiel-api.<subdomain>.workers.dev/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name":"WiPo SS26","perioden_anzahl":5,"team_groesse":4}'
```

Antwort:
```json
{
  "session_id": "ABC123",
  "join_url": "https://planspiel.kassensturz.de?session=ABC123&..."
}
```

Die `join_url` an Studierende weitergeben (z. B. als QR-Code oder Link im LMS).

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| `wrangler: command not found` | `npm install -g wrangler` erneut ausführen |
| `KV namespace not found` | KV-ID in `wrangler.toml` korrekt eingetragen? |
| CORS-Fehler im Browser | Frontend-URL in `ALLOWED_ORIGINS` eingetragen? |
| Session nicht gefunden (404) | Session älter als 24 h → neue Session erstellen |
| API nicht erreichbar | `wrangler deploy` erneut ausführen |
