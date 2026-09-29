# Schriften

Liegen hier lokal, damit kein Seitenaufruf mehr zu Google geht. Eingebunden
über [`../css/schriften.css`](../css/schriften.css).

Alle drei sind **Variable Fonts**: eine Datei je Familie und Schnitt deckt den
ganzen Gewichtsbereich ab.

| Datei | Familie | Gewichte | Größe |
|---|---|---|---|
| `inter-latin.woff2` · `inter-latin-ext.woff2` | Inter | 400–700 | 47 + 83 KB |
| `newsreader-latin.woff2` · `-latin-ext` | Newsreader | 400–700 | 129 + 85 KB |
| `newsreader-italic-latin.woff2` · `-latin-ext` | Newsreader kursiv | 400–700 | 144 + 93 KB |
| `jetbrains-mono-latin.woff2` · `-latin-ext` | JetBrains Mono | 400–600 | 31 + 11 KB |

Zusammen 623 KB. Eine deutschsprachige Seite lädt davon in der Regel nur die
drei `latin`-Dateien (~207 KB) — die `latin-ext`-Fassungen holt der Browser
erst, wenn ein Zeichen sie braucht, und die Kursive nur, wo kursiv gesetzt ist.

## Lizenz

Alle drei stehen unter der **SIL Open Font License 1.1**. Mitliefern und
Selbsthosten sind ausdrücklich erlaubt, auch kommerziell.

| Familie | Copyright | Quelle |
|---|---|---|
| Inter | The Inter Project Authors | https://github.com/rsms/inter |
| Newsreader | The Newsreader Project Authors | https://github.com/productiontype/Newsreader |
| JetBrains Mono | The JetBrains Mono Project Authors | https://github.com/JetBrains/JetBrainsMono |

> **Noch zu erledigen, bevor das Projekt öffentlich erreichbar ist:** Die OFL
> verlangt, dass der **Lizenztext bei jeder Weitergabe beiliegt**. Die drei
> `OFL.txt` aus den verlinkten Projekten gehören noch in diesen Ordner.
> Bis dahin ist die Weitergabe formal unvollständig.

## Nicht hier: Bespoke Stencil

Die Logo-Schrift darf laut Fontshare-EULA **nicht** auf einen öffentlichen
Server geladen werden. Sie liegt nur lokal und steht in `.gitignore`.
Für das Logo wird sie als Vektorgrafik exportiert — siehe `LICENSE`.
