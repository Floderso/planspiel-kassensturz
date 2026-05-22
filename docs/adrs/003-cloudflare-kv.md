# ADR 003 — Cloudflare KV als Session-Storage

**Status:** Akzeptiert  
**Datum:** 2026-05-22

## Kontext

Session-Daten (Konfiguration, Team-Parameter, Stimmen) müssen serverseitig gespeichert
werden, damit mehrere Browser denselben Spielstand sehen. Es wird eine Storage-Lösung
benötigt, die ohne separate Datenbank-Einrichtung funktioniert.

## Entscheidung

**Cloudflare KV** (Key-Value Store) als einzige Storage-Schicht.

## Begründung

- **Zero-Config:** KV ist direkt in Cloudflare Workers integriert — kein separater
  Datenbankserver, keine Verbindungsstrings, keine Migrationen.
- **Kostenloses Tier:** 100.000 Reads/Tag, 1.000 Writes/Tag — ausreichend für
  Lehrveranstaltungen mit 30–50 Teilnehmern.
- **Einfaches API:**
  ```js
  await env.SESSIONS.put(key, JSON.stringify(data), { expirationTtl: 86400 })
  const data = JSON.parse(await env.SESSIONS.get(key))
  ```
- **Automatisches Ablaufen:** Sessions laufen nach 24 Stunden automatisch ab
  (TTL-Parameter) — kein Aufräum-Job nötig.

## Datenschema

```
Key:   "session:{6-stellige-id}"
Value: JSON-Objekt (SessionData, siehe docs/API.md)
```

## Konsequenzen

- KV ist eventual-consistent — bei sehr schnellen gleichzeitigen Schreibvorgängen
  (~100 ms Abstand) könnte ein Update verloren gehen. Im Classroom-Kontext (Teams
  schreiben selten gleichzeitig) ist das akzeptabel.
- Maximale Value-Größe: 25 MB — bei 12 Dezilen × 5 Perioden × 5 Teams weit unterschritten.
- Wenn das Projekt wächst und stärkere Konsistenz-Garantien nötig werden, wäre
  Cloudflare D1 (SQLite) der nächste Schritt (→ zukünftiges ADR).
