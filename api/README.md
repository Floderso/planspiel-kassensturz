# Planspiel API

Cloudflare Worker für Session-Management und Multi-Team-Voting.
Vollständige Dokumentation: [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) · [../docs/API.md](../docs/API.md)

## Schnellstart (lokal)

```bash
npm install
npx wrangler dev
# API läuft auf http://localhost:8787
```

## Deployment

```bash
# Einmalig: KV-Namespace anlegen
npx wrangler kv namespace create SESSIONS
# → ID in wrangler.toml eintragen (Zeile: id = "...")

# Deployen
npx wrangler deploy
```

Schritt-für-Schritt mit Screenshots: [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
