# Vom Projekt zur Software — Betrieb auf einem Uni-Server

**Stand 12.09.2026 · Vorschlag, noch nichts umgesetzt.**
Zweiter Teil zu [ARCHITEKTUR.md](ARCHITEKTUR.md): dort der Schnitt im
Code, hier alles, was dazukommt, sobald die Uni das Ding betreibt.

---

## 1. Was heute einen Serverbetrieb verhindert

Sieben Befunde. **Fünf davon sind am 12.09.2026 erledigt worden** — die
Abschnitte darunter beschreiben jeweils den Ausgangszustand und was daraus
geworden ist.

| | Befund | Stand |
|---|---|---|
| 1.1 | Serveradresse dreimal im Code | ✔ steht jetzt nur in `/konfig.js` |
| 1.2 | Fremdskript von localhost | ✔ hängt an einem Schalter |
| 1.3 | Schriften von Google | ✔ liegen lokal in `fonts/` |
| 1.4 | Matrikelnummern bei Cloudflare | offen — braucht Abstimmung, siehe Abschnitt 5 |
| 1.5 | Admin-Token in der URL | ✔ Kopfzeile statt Query, Fragment in Links |
| 1.6 | Keine Lizenz, keine Versionen | ○ `LICENSE` da; Versionen und CHANGELOG offen |
| 1.7 | Tests laufen nur von Hand | ✔ CI unter `.github/workflows/test.yml` |
| 1.8 | QR-Code von `api.qrserver.com` | ✔ abschaltbar; lokale Erzeugung offen |


### 1.1 Die Serveradresse steht dreimal fest im Code ✔ erledigt 12.09.2026

```
js/planspiel.js:1988   const API_BASE = 'https://planspiel-api.aramisda2.workers.dev/api'
js/admin.js:11         dieselbe Zeile
js/debriefing.js:11    dieselbe Zeile
```

Das ist **deine private Cloudflare-Adresse**, fest verdrahtet in drei
Dateien. Auf einem Uni-Server zeigt die Anwendung damit weiter auf
deinen Privataccount. Gleiches Muster in `api/wrangler.toml`, wo
`ALLOWED_ORIGINS` auf `localhost` und `floderso.github.io` steht.

Professionelle Software hat **keine Adressen im Code**, sondern eine
Konfiguration, die beim Ausrollen gesetzt wird. Für dich ohne
Build-Schritt am einfachsten als eine Datei `konfig.js`, die auf dem
Server liegt und pro Umgebung anders aussieht.

### 1.2 Ein fremdes Skript von localhost ✔ erledigt 12.09.2026

```html
index.html:2294   <script src="http://localhost:8080/embed.min.js"
                          id="<TOKEN>" defer></script>
```

(Die ID ist hier geschwärzt — sie ist ein Zugangsschlüssel und gehört
nicht in die Git-Historie, auch nicht als Beispiel.)

Unverschlüsseltes `http`, ein Fremdskript mit undurchsichtiger ID,
Ladeadresse `localhost`. Auf einem Server lädt das entweder gar nicht
oder — schlimmer — vom Rechner des Studierenden. **Das muss raus,
bevor irgendetwas hochgeladen wird.** Sag mir, was es tun soll, dann
suchen wir einen sauberen Ersatz.

### 1.3 Die Schriften kommen bei jedem Aufruf von Google ✔ erledigt 12.09.2026

Alle vier HTML-Dateien laden von `fonts.googleapis.com`. Bei einer
Hochschule als öffentlicher Stelle ist das ein echtes Problem, kein
Schönheitsfehler: Jeder Seitenaufruf überträgt die IP-Adresse des
Studierenden an einen US-Anbieter, ohne Einwilligung. Genau dafür gab
es 2022 das bekannte Urteil des LG München.

Lösung ist billig: Schriften ins Projekt legen, lokal einbinden. Steht
schon in [REDESIGN.md](REDESIGN.md).

### 1.4 Matrikelnummern liegen bei Cloudflare — der große Punkt

`js/admin.js` lädt per CSV **Matrikelnummern und Namen** hoch
(`uploadMatrikeln`, Zeile 347), `api/` legt sie in Cloudflare KV ab.

**Entschieden am 12.09.2026: Die Matrikelnummern werden gebraucht.**
Damit ist eine Sache festgelegt, die vorher offen war:

> **Cloudflare scheidet als Ziel aus.** Personenbezogene Daten von
> Studierenden einer deutschen Hochschule auf einem US-Anbieter — das
> wäre ein eigenes Genehmigungsverfahren mit ungewissem Ausgang. Der
> Aufwand steht in keinem Verhältnis. Ziel ist ein Uni-Server.

Damit kommt ein Datenschutzverfahren auf dich zu. Das ist kein Grund
zur Panik — es ist der Normalfall für jede Lehrsoftware, die Teilnahme
nachhält. Aber es gehört an den Anfang, nicht ans Ende. Was dazugehört:
Rechtsgrundlage klären, Eintrag ins Verzeichnis von
Verarbeitungstätigkeiten, Löschfristen festlegen, die Studierenden
informieren. Ich bin kein Jurist — **sprich früh mit dem
Datenschutzbeauftragten der Uni**, am besten bevor gebaut wird.

Was du dagegen technisch selbst in der Hand hast, ist der *Umfang* des
Verfahrens. Dazu zwei Bauweisen, siehe Abschnitt 5.

### 1.8 Der QR-Code kommt von einem Fremdanbieter ✔ erledigt 12.09.2026

Nachgetragen am 12.09.2026 — gefunden vom Architekturtest, nicht von mir.

Das Dashboard erzeugte den Beitritts-QR-Code über `api.qrserver.com` und
schickte dabei die vollständige Join-URL samt Sitzungs-ID an einen
externen Dienst. Kein Drama, aber dasselbe Muster wie bei den Schriften:
ein Fremdanbieter erfährt, dass und wann hier eine Lehrveranstaltung
läuft.

Der Dienst steht jetzt in `konfig.js` (`qr_dienst`) und lässt sich leer
lassen — dann bietet das Dashboard keinen QR-Code mehr an. Für den
Uni-Betrieb wäre eine lokale Erzeugung das Richtige; das ist eigene
Arbeit und noch offen.

### 1.5 Das Admin-Token steht in der URL ✔ erledigt 12.09.2026

```
api/src/index.ts:190   admin_url = `${origin}/…/admin.html?session=${id}&token=${admin_token}`
```

Alles nach dem `?` landet in Serverprotokollen, im Browserverlauf und
beim Weiterleiten in fremden Händen. Ein Link, den eine Lehrperson
versehentlich in eine Mail kopiert, gibt die Sitzung frei. Für ein
Bastelprojekt hinnehmbar, für eine Uni-Anwendung nicht.

### 1.6 Keine Lizenzdatei, keine Versionen, kein Änderungsprotokoll ○ teilweise

`package.json` steht seit Beginn auf `1.0.0`. Es gibt keine
`LICENSE`-Datei, obwohl jede Quelldatei `CC-BY-4.0` im Kopf trägt, und
kein `CHANGELOG.md`. Wer die Software in einem halben Jahr übernimmt —
oder du selbst — kann nicht sagen, welcher Stand auf dem Server läuft.

### 1.7 Die Tests laufen nur, wenn jemand daran denkt ✔ erledigt 12.09.2026

70 Tests, gute Tests — aber niemand führt sie automatisch aus. Es gibt
keinen `.github/`-Ordner. Auf einem Server, den andere benutzen, ist
das der Unterschied zwischen „wir glauben, es geht" und „wir wissen es".

---

## 2. Die eine Frage, die alles andere bestimmt

**Was stellt die Uni dir zur Verfügung?** Es gibt drei Fälle mit sehr
unterschiedlichen Folgen:

| Fall | Was möglich ist |
|---|---|
| **A — nur statisches Webhosting** (Dateien in ein Verzeichnis legen) | Kein eigenes Backend. Alles läuft im Browser — datenschutzrechtlich der einfachste Fall, siehe Abschnitt 5. |
| **B — Container oder virtuelle Maschine** (Docker/Node erlaubt) | Der Idealfall. Alles auf einem Uni-Server, kein Cloudflare mehr. |
| **C — Hosting durch das Rechenzentrum** | Deren Regeln gelten: Image-Vorgaben, Backup, Monitoring, Freigabeprozess. Früh fragen. |

**Stand 12.09.2026: noch offen — du fragst beim Rechenzentrum nach.**
Eine fertige Anfrage dafür steht in Abschnitt 8.

Bis die Antwort da ist, wird so gebaut, dass **A und B beide
offenbleiben**. Das kostet nichts Zusätzliches: Es ist genau derselbe
Schnitt, den [ARCHITEKTUR.md](ARCHITEKTUR.md) ohnehin vorschlägt — der
Kern weiß nicht, ob unter ihm ein Server steht oder nur `localStorage`.

---

## 3. Zielbild A — ohne Backend

Für viele Lehrveranstaltungen reicht das vollständig, und es ist der
mit Abstand günstigste Betrieb.

```
Uni-Webserver (statisch)
  index.html · admin.html · debriefing.html
  css/ · js/ · fonts/
        ↕
  localStorage im Browser
```

Kein Server-Prozess, keine Datenbank, keine personenbezogenen Daten,
kein Datenschutzverfahren, nichts, was nachts ausfallen kann.
Multi-Team läuft dann als Hot-Seat auf einem Gerät — genau so macht es
`makro-planspiel/ui/` bereits.

Was du verlierst: getrennte Geräte je Team und den Live-Vergleich.

**Mit Matrikelnummern bleibt das trotzdem der sauberste Fall:** Die
CSV wird im Browser der Lehrperson gelesen und verlässt das Gerät nie.
Es gibt keinen Server, der sie speichern könnte.

---

## 4. Zielbild B — ein Prozess, ein Ursprung

Falls die Uni Node erlaubt, ist das die saubere Lösung — und der
Umbau ist kleiner, als du denkst.

```
┌── Uni-Server ─────────────────────────────────┐
│  Node + Hono (ein Prozess)                    │
│    /            → die statischen Dateien      │
│    /api/*       → die Sitzungsverwaltung      │
│    /health      → „läuft" für das Monitoring  │
│         │                                     │
│    speicher/    ← austauschbar                │
│    └─ SQLite-Datei oder Postgres der Uni      │
└───────────────────────────────────────────────┘
```

**Warum das wenig Arbeit ist:** Hono ist nicht an Cloudflare gebunden.
Dieselbe App läuft mit `@hono/node-server` unverändert auf Node, und
sie kann die statischen Dateien gleich mitliefern:

```js
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

app.use('/*', serveStatic({ root: './oeffentlich' }));
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8787) });
```

Von deinen 570 Zeilen `api/src/index.ts` ist damit fast alles direkt
übertragbar. Nur die Stellen, die `KVNamespace` anfassen, müssen weg —
und zwar hinter eine Schnittstelle:

```js
// speicher/schnittstelle.js — was ein Speicher können muss
//   lies(id) · schreib(id, sitzung) · loesch(id) · listeAbgelaufene()
//
// speicher/sqlite.js   ← Uni-Server, eine Datei, kein Datenbankserver
// speicher/kv.js       ← Cloudflare, falls du es weiter brauchst
```

Das ist dieselbe Idee wie `dienste/` im Frontend: **eine Stelle, die
die Außenwelt anfasst, und sie ist austauschbar.**

Der Nebeneffekt ist größer als der Aufwand: Weil Oberfläche und API
vom selben Ursprung kommen, entfällt CORS komplett — und damit die
`ALLOWED_ORIGINS`-Liste, die heute noch auf `localhost` zeigt.

---

## 5. Die Matrikelnummern — zwei Bauweisen

Du brauchst sie. Die Frage ist nicht *ob*, sondern *wo sie liegen* —
und davon hängt ab, wie groß das Datenschutzverfahren wird.

### Bauweise 1 — pseudonym: der Server sieht sie nie

Die Lehrperson lädt die CSV wie heute. Aber sie wird **im Browser**
gelesen und dort behalten. An den Server geht nur ein Pseudonym:

```
CSV (lokal)          →  Browser der Lehrperson  →  Server
4419437 Feuerriegel     Zuordnungstabelle           "TN-07"
                        bleibt im localStorage      mehr nicht
```

Die Lehrperson sieht in ihrer Ansicht weiter Klarnamen — der Browser
setzt sie beim Anzeigen wieder ein. Der Server kennt nur `TN-07` und
kann mit der Nummer allein niemanden identifizieren.

| | |
|---|---|
| **Dafür** | Der Server verarbeitet keine personenbezogenen Daten. Das Verfahren schrumpft erheblich. Kein Risiko bei einem Serverleck. Funktioniert in Fall A **und** B. |
| **Dagegen** | Die Zuordnung hängt an einem Gerät. Browserdaten gelöscht = Zuordnung weg (die CSV hat die Lehrperson aber noch). Zwei Lehrpersonen sehen unterschiedliche Namen. |

### Bauweise 2 — serverseitig: der Server kennt die Zuordnung

Wie heute, nur auf einem Uni-Server statt bei Cloudflare.

| | |
|---|---|
| **Dafür** | Zuordnung überall gleich, geräteunabhängig, mehrere Lehrpersonen, Teilnahmenachweis auch später noch abrufbar. |
| **Dagegen** | Volles Verfahren: Verarbeitungsverzeichnis, Rechtsgrundlage, Information der Studierenden, Löschkonzept, Auskunfts- und Löschrecht, Zugriffsschutz, Verschlüsselung. Fall B oder C zwingend. |

### Mein Vorschlag

**Bauweise 1 bauen, Bauweise 2 offenhalten.** Die Pseudonymisierung
ist eine einzige Stelle im Code — dort, wo die CSV eingelesen wird.
Wenn der Datenschutzbeauftragte später sagt „serverseitig ist in
Ordnung", tauschst du diese eine Stelle. Umgekehrt ist es viel teurer:
Wenn du serverseitig baust und es dann nicht genehmigt wird, musst du
Backend, Datenbank und Admin-Oberfläche anfassen.

Die Entscheidung selbst triffst du nicht allein — sie gehört in das
erste Gespräch mit dem Datenschutzbeauftragten. Bauweise 1 ist dabei
das bessere Angebot: Du gehst nicht mit „ich möchte Studierendendaten
speichern" hin, sondern mit „ich habe es so gebaut, dass mein Server
sie gar nicht erst sieht".

### Unabhängig von der Bauweise

| Sache | Konkret |
|---|---|
| **Datensparsamkeit** | Matrikelnummer **oder** Name — beides zusammen ist selten nötig. Die Nummer allein reicht für den Teilnahmenachweis. |
| **Löschfrist** | Heute **180 Tage** (`SESSION_TTL` in `api/src/index.ts`, ~ein Semester) — deutlich länger, als die alte Dokumentation behauptete. Auf einem eigenen Server räumst du selbst auf; die Frist gehört in die Datenschutzerklärung. |
| **Keine Nummern in Protokollen** | Beim Logging ausdrücklich ausschließen. Sonst stehen sie in Dateien, an die niemand denkt. |
| **Kein Personenbezug in URLs** | Siehe 1.5 — Query-Parameter landen in Serverprotokollen. |

---

## 6. Was „professionell" konkret bedeutet

Nicht als Wunschliste, sondern nach Reihenfolge der Wichtigkeit:

### Muss vor dem ersten Serverstart da sein

| Sache | Konkret |
|---|---|
| **Konfiguration statt Konstanten** | eine `konfig.js` je Umgebung; keine Adresse mehr im Code |
| **Keine Geheimnisse im Repo** | Tokens über Umgebungsvariablen, nie in `wrangler.toml` oder JS |
| **Token nicht in der URL** | Admin-Zugang über Kopfzeile oder ein kurzlebiges Cookie |
| **Fremdskripte raus** | `embed.min.js` entfernen, Schriften lokal |
| **LICENSE-Datei** | CC-BY-4.0 steht in 25 Dateiköpfen, aber nirgends im Ganzen |
| **`/health`** | ein Endpunkt, der „läuft" sagt — jedes Monitoring braucht ihn |

### Muss kurz danach da sein

| Sache | Konkret |
|---|---|
| **Versionen, die etwas bedeuten** | `1.2.0` in `package.json`, Git-Tag, `CHANGELOG.md`; die Version unten auf der Seite anzeigen, damit im Hörsaal klar ist, was läuft |
| **Automatische Tests** | `.github/workflows/test.yml`: bei jedem Push `npm test` und der Architekturtest aus ARCHITEKTUR.md |
| **Drei Umgebungen** | lokal · Test · Produktion, mit je eigener Konfiguration |
| **Fehler sichtbar machen** | Server: strukturierte Zeilen mit Zeitstempel und Sitzungs-ID (**keine** Matrikelnummern). Browser: eine Fehlerseite statt einer weißen Seite |
| **Datensicherung** | Was passiert, wenn die Datei weg ist? Bei SQLite: eine Kopie pro Nacht reicht |
| **Betriebsanleitung** | `docs/BETRIEB.md`: starten, neu ausrollen, Log lesen, zurückrollen. Eine Seite, für jemanden, der das Projekt nicht kennt |

### Gehört dazu, sobald die Uni draufsteht

| Sache | Warum |
|---|---|
| **Barrierefreiheit nach BITV 2.0** | Hochschulen sind öffentliche Stellen. Maßstab ist EN 301 549, praktisch WCAG 2.1 AA — plus eine veröffentlichte Barrierefreiheitserklärung. Das ist **Pflicht, nicht Kür.** |
| **Impressum und Datenschutzerklärung** | ebenfalls Pflicht, sobald die Seite unter einer Uni-Adresse erreichbar ist |
| **Verzeichnis von Verarbeitungstätigkeiten** | bei Bauweise 2 zwingend, bei Bauweise 1 deutlich schlanker — siehe Abschnitt 5 |
| **Löschfristen** | siehe Abschnitt 5 — auf einem eigenen Server räumst du selbst auf |

Zur Barrierefreiheit noch ein praktischer Hinweis: Die kritischen
Stellen sind bei dir die Schieberegler und die Dialoge. Regler brauchen
`aria-valuetext` mit dem lesbaren Wert („Spitzensteuersatz 45 Prozent"),
Dialoge brauchen Fokusführung und `Esc`. Und jede Kennzahl, deren
Aussage heute allein an Rot oder Grün hängt, braucht ein Wort dazu.
**Das fällt dir mit der Architektur aus Teil 1 in den Schoß:** Wenn die
Ansicht ohnehin schon `signal: 'besser'` liefert, ist der Text bereits
da — er muss nur ausgegeben werden.

---

## 7. Reihenfolge

Verzahnt mit den sechs Schritten aus [ARCHITEKTUR.md](ARCHITEKTUR.md).
Die beiden offenen Klärungen laufen **nebenher** — niemand muss auf
sie warten, um anzufangen:

| # | Schritt | Wann |
|---|---|---|
| — | **Anfrage ans Rechenzentrum** (Fall A/B/C) — Entwurf in Abschnitt 8 | diese Woche, läuft nebenher |
| — | **Termin beim Datenschutzbeauftragten** mit Bauweise 1 im Gepäck | sobald Abschnitt 5 gelesen, läuft nebenher |
| 1 | Fremdskript raus, Schriften lokal, LICENSE, `/health` | sofort — hängt von nichts ab |
| 2 | Konfiguration aus dem Code ziehen (`konfig.js`) | zusammen mit Architektur-Schritt 1 (`dienste/server.js`) |
| 3 | Token aus der URL | mit Schritt 2 |
| 4 | CI einrichten: `npm test` bei jedem Push | jederzeit, eine halbe Stunde |
| 5 | Pseudonymisierung an der CSV-Stelle (Bauweise 1) | sobald Architektur-Schritt 3 steht |
| 6 | Speicher-Schnittstelle im Backend, SQLite daneben | sobald Fall B feststeht |
| 7 | Versionen, CHANGELOG, Betriebsanleitung | vor der ersten echten Lehrveranstaltung |
| 8 | Barrierefreiheit prüfen und erklären | mit dem UI-Umbau (Architektur-Schritt 6) |

Schritt 1 bis 4 sind **unabhängig von beiden offenen Fragen**. Sie
räumen auf, was in jedem Fall aufgeräumt werden muss. Damit lässt sich
sofort anfangen.

---

## 8. Anfrage ans Rechenzentrum — Entwurf

Zum Kopieren. Nicht abgeschickt, das machst du selbst.

> **Betreff: Hosting einer Lehranwendung — welche Möglichkeiten gibt es?**
>
> Sehr geehrte Damen und Herren,
>
> ich entwickle für Lehrveranstaltungen der Wirtschaftswissenschaften
> ein webbasiertes Planspiel und möchte es an der Universität
> betreiben. Bevor ich die Architektur festlege, würde ich gern
> wissen, welche Betriebsform möglich ist.
>
> Die Anwendung besteht aus statischen Dateien (HTML, CSS,
> JavaScript, ohne Build-Schritt) und optional einem kleinen
> Serverdienst in Node.js, der Spielsitzungen verwaltet. Es werden
> Teilnahmedaten von Studierenden verarbeitet; ich stimme das
> gesondert mit dem Datenschutzbeauftragten ab.
>
> Konkret wäre mir geholfen mit Antworten auf:
>
> 1. Gibt es Webspace für rein statische Dateien unter einer
>    Uni-Adresse — und wie kommen Aktualisierungen dorthin?
> 2. Ist ein eigener Serverdienst möglich (Node.js, alternativ ein
>    Container)? Falls ja: als VM, über eine Container-Plattform
>    oder nur betreut durch Sie?
> 3. Falls ein Serverdienst möglich ist: Welche Datenbank steht zur
>    Verfügung, oder darf eine eingebettete Datei-Datenbank (SQLite)
>    verwendet werden?
> 4. Gibt es Vorgaben zu Backup, Protokollierung und Monitoring, die
>    ich von vornherein einplanen sollte?
> 5. Welcher Freigabeprozess ist nötig, und mit welcher Vorlaufzeit
>    sollte ich rechnen?
>
> Die Anwendung soll erstmals im [Semester eintragen] eingesetzt
> werden. Über eine Einschätzung würde ich mich freuen.
>
> Mit freundlichen Grüßen
> Florian Aram Feuerriegel
> Matrikelnummer 4419437

Die fünf Fragen sind bewusst so gestellt, dass jede Antwort direkt
eine Architekturentscheidung erledigt. Frage 2 entscheidet zwischen
Zielbild A und B, Frage 3 zwischen SQLite und Postgres, Frage 5 sagt
dir, ob der Zeitplan überhaupt aufgeht.
