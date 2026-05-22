# ADR 001 — Simulationsengine läuft client-seitig

**Status:** Akzeptiert  
**Datum:** 2026-05-22

## Kontext

Das Planspiel enthält eine numerische Wirtschaftssimulation (`js/rechner/`), die bei jeder
Slider-Bewegung neu berechnet wird. Die Frage ist, ob diese Berechnung im Browser oder auf
einem Server stattfinden soll.

## Entscheidung

Die Engine bleibt vollständig im Browser (client-seitig). Der Server speichert ausschließlich
die **Eingabe-Parameter** (Slider-Werte) und die **Zustands-Metadaten** (locked, votes) —
nicht die Berechnungsergebnisse.

## Begründung

- **Keine Netzwerklatenz:** Slider-Feedback muss sofort spürbar sein (<16 ms). Ein Server-
  Roundtrip würde die Interaktivität zerstören.
- **Einfachheit:** Die Engine ist bereits als saubere Pure-JS-Module vorhanden (`berechne.js`,
  `transition.js`, etc.). Eine server-seitige Kopie würde zwei Codebasen erzeugen.
- **Offline-Fähigkeit:** Das Planspiel funktioniert auch ohne Internetverbindung weiterhin
  vollständig — wichtig für Lehrveranstaltungen mit schlechtem WLAN.
- **Kein Anti-Cheat-Bedarf:** Im Bildungskontext ist serverseitige Validierung nicht nötig.

## Konsequenzen

- Verschiedene Clients können bei identischen Parametern minimal abweichende Ergebnisse
  liefern, wenn die Engine-Version unterschiedlich ist → Engine-Version wird im State mitgeführt.
- Ergebnis-Vergleiche zwischen Teams werden client-seitig aus den gespeicherten Parametern
  neu berechnet (kein separater Ergebnis-Store nötig).
