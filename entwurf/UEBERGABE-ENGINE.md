<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- Copyright 2025 Florian Aram Feuerriegel — kassensturz.org -->

# Übergabe: Engine-Überarbeitung und Modelldokumentation (PR #3)

Ergänzt `entwurf/UEBERGABE.md` (Weiterbau am Verhandlungstisch); diese Datei
betrifft nur die Engine in `js/rechner/` und `docs/modell/`.

Stand: 28.09.2026, Branch `claude/determined-galileo-w0qfm4`, Head `77dfd8f`

## 1. Worum es geht

Repository `Floderso/planspiel-kassensturz` (privat). Wirtschaftspolitik-Planspiel
für Lehrveranstaltungen: Studierende stellen Steuer- und Sozialparameter ein, die
Engine in `js/rechner/` berechnet Haushaltssaldo, Verteilung, CO₂ und BIP.

Offener Pull Request: <https://github.com/Floderso/planspiel-kassensturz/pull/3>

- Titel: „Engine: Befunde beider Fachprüfungen behoben, Rechtsstand 2026“
- Head `claude/determined-galileo-w0qfm4`, Basis `ausbau/verhandlungstisch`
- 28 Commits, 68 Dateien, mergebar (clean), CI grün, keine Reviews
- Die PR-Beschreibung ist aktuell und fasst alle inhaltlichen Änderungen zusammen.
  Sie ist die beste Einstiegslektüre nach `CLAUDE.md`.

## 2. Pflichtlektüre vor jeder Arbeit

1. `CLAUDE.md` (Arbeitsregeln, verbindlich)
2. PR-Beschreibung von PR #3
3. `entwurf/PRUEFUNG.md`, `entwurf/PRUEFUNG-2.md`, `entwurf/GUTACHTEN-2026-09.md`
   (Statusspalten sind nachgeführt)
4. `docs/modell/modell.pdf` (36 Seiten: Teil I verbal, Teil II Formeln,
   Teil III gemessener Wirkungsgraph)
5. `docs/RECHTSSTAND.md` (Status quo 2026 mit Rechtsgrundlagen)

## 3. Arbeitsweise, die der Nutzer verlangt

- **Vor jeder Aufgabe ein Interview**, in dem die Ziele gemeinsam erarbeitet werden
  (das Werkzeug `AskUserQuestion` hat sich bewährt, mit einer als „(Empfohlen)“
  markierten Option).
- **Keine Emojis.**
- **Kleine Zwischenziele**: jeweils vorstellen, dann erst nach gezielter Rückfrage
  weitermachen.
- Antworten auf Deutsch, sachlich; Befunde und eigene Irrtümer offen benennen.
  Der Nutzer entscheidet Modellfragen selbst, wenn es echte Alternativen gibt.

## 4. Nicht verhandelbare Regeln (aus `CLAUDE.md`)

- Alles deutsch: Kommentare, Bezeichner, Commit-Nachrichten, Oberfläche.
- SPDX-Kopf in jeder neuen Quelldatei:
  ```js
  // SPDX-License-Identifier: CC-BY-4.0
  // Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
  ```
- Modellannahmen stehen genau einmal in `js/data.js` (z. B. `ZINS_EFFEKTIV`,
  `BIP_WACHSTUM_NOMINAL_JAHR`).
- Jede ökonomische Zahl braucht eine Quelle in `FORMEL_QUELLEN_*`
  (`formel`, `ref`, `note`).
- Nur `js/dienste/server.js` darf `fetch(` enthalten; keine URLs im Code
  (nur `/konfig.js`); Admin-Token nie in die URL.
- Kein Build-Schritt, keine npm-Abhängigkeiten im Frontend ohne Rückfrage.
- **Nichts ausrollen ohne Rückfrage** (`cd api && npm run deploy`).
- **Privates Repo**: keine Inhalte nach außen geben.
- Nach jeder Änderung an `js/rechner/` oder `js/data.js`:
  ```bash
  npm test                                   # derzeit 156 Tests, 155 grün, 1 todo
  node docs/modell/messung.js                # Messwerte neu erzeugen
  cd docs/modell && latexmk -pdf modell.tex  # PDF neu setzen
  ```
  Sonst wird `tests/modelldoku.test.js` rot. Das eine `todo` ist bekannt
  (`localStorage` in der klassischen Fläche) und kein Fehler.

## 5. Git

- Nur auf `claude/determined-galileo-w0qfm4` pushen: `git push -u origin claude/determined-galileo-w0qfm4`
- Keine neuen PRs ohne ausdrückliche Bitte.
- Keine History umschreiben; Konflikte mit der Basis per Merge lösen
  (so zuletzt in Commit `7883cb5` geschehen).
- Commit-Nachrichten deutsch, ohne Umlaute im Betreff ist üblich
  (siehe `git log`), und mit Attributionszeilen am Ende.

## 6. Was in PR #3 erledigt ist (Kurzfassung)

Engine:
- Sozialversicherung getrennt: Beitrag wirkt auf Einnahmen, Rentenniveau (neuer
  Regler, 48 %) auf Ausgaben.
- Fortschreibung: Einnahmen wachsen mit dem BIP, Ausgaben mit dem Trend.
- Nachfrage symmetrisch über MPC je Dezil, öffentlicher Kapitalstock mit Abschreibung.
- Buchungsidentität Haushalte = Staat für alle Steuern (`tests/buchung.test.js`).
- Klima ohne nationalen Schaden, Emissionspfad UBA 2025, Budget 1,7 °C.
- Tarif § 32a EStG 2026, Zonen entkoppelt, Pareto-Rand (α = 1,5) für D10c.
- Gini auf Äquivalenzeinkommen, Urteil relativ zum Status quo.
- Rechtsstand 2026 inkl. gesetzlicher Pfade (KSt-Senkung 2028–2032,
  RV-Beitrag nach § 158 SGB VI, Schuldenbremse 2025).

Zuletzt behoben (bei der Modelldokumentation gefunden):
- **BBG** (`berechne.js` Abschnitt 7, `verteilung.js`): Faustregel beim Staat
  symmetrisch (`1 + (bbg - BBG_SQ)/BBG_SQ*0.12`), Haushalte tragen die ganze
  Änderung (AN + AG), skaliert auf die Staatsbuchung. Ergebnis +6,2 / −5,8 Mrd.
- **Ausweichen in D10c**: ausgelöst vom tariflichen Spitzensatz, nur auf den
  Einkommensanteil über der Grenze (`einkommensanteilUeber` in
  `einkommensteuer.js`). 45 → 75 %: +2,8 Mrd., abnehmender Ertrag.
- **Arbeitsangebot**: Faktor wirkt nur auf Arbeitseinkünfte (`arbeit_adj`),
  Kapitaleinkünfte (`kapital_adj`) bleiben fest.

Modelldokumentation (`docs/modell/`):
- `messung.js` misst jede Stellgröße per endlicher Differenz, zerlegt in
  mechanisch / Verhalten / Nachfrage, prüft Symmetrie und schreibt alles nach
  `generiert/` (Tabellen, TikZ-Kanten, `\wertdef`-Makros, `messung.json`).
- `modell.tex` + `teil1.tex`, `teil2.tex`, `teil3.tex`, `anhang.tex`.
  Im Text ist keine Messzahl getippt, alles über `\wert{bereich}{key}{feld}`.
- Setzen mit pdfLaTeX (lmodern, newunicodechar). LuaLaTeX funktioniert in der
  Umgebung nicht (Schriftfehler). Fehlt `lmodern`: per apt nachinstallieren.
- Sichtprüfung der Seiten: `pip install pymupdf`, Seiten als PNG rendern.

## 7. Bekannte Fallstricke

- TikZ: Farbnamen `pos`/`neg` kollidieren mit TikZ-Schlüsseln; immer `color=...`
  schreiben.
- In `messung.js` negative Nullen abfangen (`Number(x)||0`) und Werte einzeln
  formatieren, keine Regex-Ersetzungen mit `$1` in LaTeX-Strings.
- Die Dezile sind Haushaltseinkommen, die BBG gilt je Person. Eine rein
  dezilbasierte BBG-Rechnung verdoppelt die Wirkung ungefähr. Deshalb die
  Faustregel beim Staat (bewusste Entscheidung des Nutzers).
- Der Zinsterm `r/100·b·Y` ist korrekt (identisch mit `r·b/100·Y`), auch wenn ein
  Prüfer ihn anzweifelt.

## 8. Laufende Pflicht: PR #3 beobachten

Der Nutzer hat gebeten, PR #3 zu beobachten, bis er gemergt oder geschlossen ist.

- Bei jedem Check-in: `mcp__github__pull_request_read` mit `get`,
  `get_check_runs`, `get_reviews`, `get_review_comments`, `get_comments`.
- Bei CI-Fehler oder Konflikt: selbst beheben (Tests lokal grün, dann pushen).
- Bei Reviews: kleine Wünsche umsetzen, größere dem Nutzer vorlegen.
- Wenn sich nichts geändert hat: still den nächsten Check-in planen
  (`send_later`, zuletzt etwa täglich), dem Nutzer nichts melden.
- Eine neue Sitzung erbt die geplanten Check-ins der alten nicht; ggf. neu
  abonnieren (`subscribe_pr_activity`) und neu planen.

## 9. Offene Punkte (nicht beauftragt, nur vermerkt)

Nicht ohne Interview und Zustimmung des Nutzers angehen:

- EU-Fiskalregeln im Modell
- 15. koordinierte Bevölkerungsvorausberechnung
- Schuldenbremse getrennt nach Bund und Ländern
- Wortlautprüfung der übrigen Quellenzitate
- Belegte Reaktion der Kapitaleinkünfte auf die Abgeltungsteuer
- Näherungen durch amtliche Daten ersetzen (Destatis/BMF/DRV waren aus der
  Umgebung gesperrt): Rentenanteile je Dezil, MPC-Profil, öffentlicher
  Kapitalstock, Milliardärsvermögen, Pareto-Exponent, BBG-Faustregel

## 10. Gemessene Eckwerte zur Orientierung

- Status quo 2041: Schuldenquote 102,5 %
- Automatischer Stabilisator: 0,372; Saldo → Schuldenquote: −0,084 (mit Zinseszins)
- CO₂-Preis: Aufkommensmaximum bei rund 190 €/t
- Nur Freibetrag, Eingangssatz, KSt und GewSt bewegen das BIP-Niveau 2041
