# ADR 004 — HTTP-Polling statt WebSockets für Echtzeit-Updates

**Status:** Akzeptiert  
**Datum:** 2026-05-22

## Kontext

Teams müssen sehen, wenn ein anderes Team eine Periode abgeschlossen hat (locked).
Die Frage ist, ob dafür eine persistente Verbindung (WebSocket) oder periodische
Abfragen (HTTP-Polling) verwendet werden sollen.

## Entscheidung

**HTTP-Polling alle 5 Sekunden** — kein WebSocket.

## Begründung

- **Komplexität:** WebSockets erfordern auf Cloudflare Workers Durable Objects
  (ein separates, kostenpflichtiges Produkt). HTTP-Polling funktioniert mit dem
  bestehenden KV-basierten Setup ohne Änderungen.
- **Ausreichend für den Anwendungsfall:** In einer Lehrveranstaltung ändern sich
  Team-States im Minutentakt, nicht im Sekundentakt. 5-Sekunden-Verzögerung ist
  für Studierende nicht spürbar.
- **Robustheit:** Polling erholt sich automatisch von Netzwerkunterbrechungen.
  WebSocket-Reconnect-Logik ist fehleranfällig.
- **Debuggbarkeit:** HTTP-Requests sind in Browser-DevTools sichtbar und nachvollziehbar.

## Implementierung

```js
// Im Frontend: nur wenn Session aktiv und nicht im Sandbox-Modus
if (state.session_id && !state.sandbox) {
  setInterval(() => pollSessionState(state.session_id), 5000);
}
```

Der Poll-Endpunkt `GET /api/sessions/:id` gibt den gesamten Session-State zurück.
Das Frontend vergleicht, ob sich etwas geändert hat, und rendert ggf. neu.

## Konsequenzen

- Last: 30 Studierende × 1 Request/5 s = 6 Requests/s — weit unter dem Free-Tier-Limit.
- Wenn Phase 3 ein Live-Dashboard einführt (alle Teams gleichzeitig sichtbar), kann
  das Polling-Intervall für die Dashboard-Ansicht auf 2 Sekunden reduziert werden.
- Echte Echtzeit (< 1 s) ist mit diesem Ansatz nicht erreichbar — das ist für diesen
  Anwendungsfall aber nicht nötig.
