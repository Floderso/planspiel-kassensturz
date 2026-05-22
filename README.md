# Kassensturz Planspiel

Interaktives Planspiel für Lehrveranstaltungen (BWL/VWL).  
Privates Repo — nicht öffentlich zugänglich.

## Struktur

```
index.html          → Planspiel-UI (ehemals planspiel.html)
js/
  planspiel.js      → UI-Controller, localStorage-State
  data.js           → Wirtschaftsdaten, KURS_KONFIG_DEFAULT, SCHOCK_BIBLIOTHEK
  rechner/
    berechne.js     → Hauptsimulation (aus Kassensturz-Engine, Stand 2026-05)
    transition.js   → Multi-Perioden-Übergänge, DICE-Klimaschaden, HANK-Multiplikator
    abgeleitet.js   → Fiskalindikatoren (Domar, S2, GGI)
    verteilung.js   → Dezil-Verteilung, Gini, Palma
    einkommensteuer.js
    rente.js
```

## Engine-Synchronisation

Die Rechenmodule (`js/rechner/`, `js/data.js`) sind eine eigenständige Kopie  
der Kassensturz-Engine (Stand 2026-05-22). Bei größeren Modell-Updates die  
geänderten Dateien manuell übernehmen und auf Kompatibilität prüfen.

## Deployment

Statisches Hosting — kein Build-Schritt.  
Ziel: `planspiel.kassensturz.de` (z.B. Netlify, Vercel, GitHub Pages privat).

## Konfiguration (Lehrpersonal)

`KURS_KONFIG_DEFAULT` in `js/data.js` — oder als URL-Parameter (Phase 2).  
Schocks: `SCHOCK_BIBLIOTHEK` — 10 vordefinierte Events (Energie, Nachfrage, Finanz, Geopolitisch).

## Lizenz

Interne Nutzung. Engine-Code: CC-BY-4.0 (kassensturz.org).
