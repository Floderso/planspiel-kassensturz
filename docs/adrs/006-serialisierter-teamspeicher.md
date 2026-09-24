<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- Copyright 2025 Florian Aram Feuerriegel — kassensturz.org -->

# ADR 006 — Serialisierter Speicher je Team, hinter einer Schnittstelle

**Status:** angenommen · **Datum:** 21.09.2026
**Ersetzt teilweise:** ADR 003 (KV als Speicher)
**Hängt zusammen mit:** ADR 002 (Hono auf Cloudflare), `entwurf/BETRIEB.md`

## Wozu

Mit dem Ausbau zum Verhandlungstisch (`entwurf/PLANUNG-AUSBAU.md`) sitzt
jede Person an ihrem eigenen Gerät, bearbeitet **ein** Ressort und stimmt
über **alle** Vorlagen ab. Daraus folgen zwei Anforderungen, die der
heutige Speicher nicht erfüllt:

1. **Keine verlorenen Stimmen.** Heute macht jeder Aufruf
   `getSession → ändern → putSession` auf einem einzigen Schlüssel. Zwei
   gleichzeitige Stimmen lesen denselben Stand; die zweite überschreibt die
   erste. Niemand merkt es.
2. **Ein Zählstand, der stimmt.** Workers KV ist *eventually consistent*:
   der vorherige Wert bleibt an einem Ort so lange sichtbar, wie die
   Cache-TTL läuft — Vorgabe 60 Sekunden, kleinster einstellbarer Wert 30
   (seit 30.01.2026). Bei einer Abstimmung zeigen vier Geräte dann bis zu
   eine Minute lang vier verschiedene Werte.

## Was zuerst erwogen und verworfen wurde

**Cloudflare Durable Objects.** Fachlich genau passend: einfädig, stark
konsistent, können WebSockets halten. Cloudflares eigenes Lehrbeispiel ist
eine Sitzplatzbuchung — derselbe Fall wie „zwei drücken gleichzeitig auf
Team 20".

**Verworfen**, und zwar nicht aus technischen Gründen:

> `entwurf/BETRIEB.md`, Abschnitt 1.4, Entscheidung vom 12.09.2026:
> *„Cloudflare scheidet als Ziel aus. Personenbezogene Daten von
> Studierenden einer deutschen Hochschule auf einem US-Anbieter […] Ziel
> ist ein Uni-Server."*

Durable Objects sind ein Cloudflare-eigenes Bauteil. Es gibt sie auf keinem
Uni-Server. Darauf zu bauen hieße, die Abstimmung — das Herzstück des
Ausbaus — an genau die Plattform zu binden, die aus Datenschutzgründen
verlassen werden soll. Der Umbau käme dann ein zweites Mal, und teurer.

## Entscheidung

**Nicht das Produkt wählen, sondern die Eigenschaft.** Der Speicher muss
drei Dinge können; womit, ist austauschbar:

| Eigenschaft | Warum |
|---|---|
| **Schreibzugriffe je Team werden serialisiert** | keine verlorenen Stimmen |
| **Was geschrieben ist, wird sofort gelesen** | der Zählstand stimmt |
| **Änderungen können gemeldet werden** | „fast live" ohne Dauerabfragen |

Umgesetzt wird das hinter der Schnittstelle, die `entwurf/BETRIEB.md`
bereits skizziert:

```
speicher/schnittstelle.js   was ein Speicher können muss
speicher/sqlite.js          Uni-Server — Zielbild B
speicher/kv.js              Cloudflare — Übergang, ohne Live-Abstimmung
```

**Der springende Punkt:** Was am Rand des Netzes schwierig ist, ist auf
einem gewöhnlichen Server der Normalfall. Ein Node-Prozess mit einer
SQLite-Datei liefert Serialisierung und starke Konsistenz von sich aus —
dafür ist eine Datenbank gemacht. WebSockets kann derselbe Prozess direkt
halten. Durable Objects existieren, um Edge-Workern zu geben, was ein
einzelner Server ohnehin hat.

Damit fällt die Abstimmung nicht nur nicht schwerer als mit Durable
Objects — sie fällt **leichter**, und sie zahlt gleichzeitig auf das
Datenschutzziel ein statt dagegen.

## Folgen

**Gut**

- Die Live-Abstimmung ist auf dem Zielserver ohne Fremdbauteil möglich.
- Kein zweiter Umbau beim Umzug.
- Hono läuft unverändert unter `@hono/node-server`; von
  `api/src/index.ts` ist fast alles übertragbar. Nur die Stellen, die
  `KVNamespace` anfassen, wandern hinter die Schnittstelle.
- Gleicher Ursprung für Oberfläche und API heißt: **CORS entfällt**, und
  damit `ALLOWED_ORIGINS`.
- Die Matrikelnummern liegen dort, wo sie hingehören.

**Schlecht**

- Solange noch bei Cloudflare gespielt wird, gibt es **keine
  Live-Abstimmung**. Der Übergangsspeicher `speicher/kv.js` kann nur
  „eingereicht — Ergebnis nach dem Schließen". Das ist hinnehmbar, weil es
  ein Übergang ist, muss aber in der Oberfläche ehrlich benannt werden.
- Ein Node-Prozess je Sitzung skaliert anders als ein Edge-Netz. Für eine
  Lehrveranstaltung mit einigen Hundert Studierenden ist das unerheblich;
  für ein Produkt mit tausenden gleichzeitigen Kursen wäre es das nicht.
  Der Maßstab dieses Projekts ist die Lehrveranstaltung.
- **Setzt voraus, dass die Hochschule Node erlaubt** (Zielbild B in
  BETRIEB.md). Erlaubt sie nur statisches Hosting, greift Zielbild A —
  dann gibt es gar keine Sitzungsverwaltung und die Frage stellt sich
  anders.

## Was das für die Reihenfolge heißt

Die Speicherschnittstelle wird gebaut, **bevor** die Abstimmung entsteht —
sonst schreibt die Abstimmung direkt gegen KV und muss zweimal gebaut
werden. Sie ist Stufe 1 in `entwurf/PLANUNG-AUSBAU.md`.

Nicht entschieden und hier auch nicht zu entscheiden: **wann** der
Uni-Server kommt und ob es SQLite oder Postgres wird. Genau dafür ist die
Schnittstelle da — die Entscheidung darf später fallen, ohne dass der
Ausbau darauf wartet.
