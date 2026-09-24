# Schriftdateien

Die `.woff2`-Dateien von **Bespoke Stencil** liegen bewusst **nicht** im Repo.

Sie stammen von [Fontshare](https://www.fontshare.com/fonts/bespoke-stencil)
(Indian Type Foundry). Die Schrift ist kostenlos, aber ihre EULA untersagt
ausdrücklich das Weitergeben der Dateien und das Ausliefern als selbst
gehostete Webfont:

> The Fonts may not […] be distributed, duplicated […] uploading them in a
> public server
>
> You are not allowed to transmit the Font Software over the Internet in font
> serving […] such as but not limited to EOT, Cufon, sIFR

## Zum lokalen Arbeiten

Schriften bei Fontshare herunterladen und hier ablegen:
`BespokeStencil-Regular.woff2`, `-Italic`, `-Medium`, `-Bold`.

## Vor der Veröffentlichung

`ui/css/tokens.css` von den lokalen `@font-face`-Regeln auf die Fontshare-API
umstellen — das ist der lizenzkonforme Weg:

```html
<link rel="stylesheet"
      href="https://api.fontshare.com/v2/css?f[]=bespoke-stencil@400,401,500,700&display=swap">
```
