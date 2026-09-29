#!/usr/bin/env python3
# SPDX-License-Identifier: CC-BY-4.0
# Copyright 2025 Florian Aram Feuerriegel — kassensturz.org
"""
Prueft die Farbpaare, die NUR in diesem Projekt vorkommen, gegen
WCAG 2.2 AA:

    python3 entwurf/kontrast-projektpaare.py entwurf/tokens.css

Das allgemeine Skript aus dem Oberflaechen-Skill prueft die
Standardpaare (Haupttext, Links, Fokusring ...). Es kennt aber die
Stufenmarken, die Urteile und die Konturen dieses Entwurfs nicht.
Seit die getoenten Flaechen weg sind und die Farbe im Text sitzt,
haengt die Lesbarkeit genau an diesen Paaren — deshalb dieses Skript.

Beide Skripte nach jeder Farbaenderung laufen lassen.
"""
import math, re, sys
def lin(L,C,H):
    a=C*math.cos(math.radians(H)); b=C*math.sin(math.radians(H))
    l_=L+0.3963377774*a+0.2158037573*b; m_=L-0.1055613458*a-0.0638541728*b
    s_=L-0.0894841775*a-1.2914855480*b; l,m,s=l_**3,m_**3,s_**3
    return [min(1,max(0,v)) for v in (4.0767416621*l-3.3077115913*m+0.2309699292*s,
        -1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.7076147010*s)]
def lum(c):
    r,g,b=lin(*c); return 0.2126*r+0.7152*g+0.0722*b
def k(a,b):
    x,y=lum(a),lum(b); return (max(x,y)+0.05)/(min(x,y)+0.05)

TOK=re.compile(r"--([a-z0-9-]+):\s*oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)")
text=open(sys.argv[1],encoding="utf-8").read()
schnitt=text.find('@media (prefers-color-scheme: dark)')
hell={m.group(1):tuple(map(float,m.groups()[1:])) for m in TOK.finditer(text[:schnitt])}
dunkel=dict(hell); dunkel.update({m.group(1):tuple(map(float,m.groups()[1:])) for m in TOK.finditer(text[schnitt:])})

# Paare, die durch die Umstellung auf reinen Text NEU entstanden sind.
paare=[("Rubrik / Fehlerurteil auf Karte","danger-fg","gray-1"),
       ("Erfolgsurteil auf Karte","success-fg","gray-1"),
       ("Stufe Fortgeschritten","tier-fort-fg","gray-1"),
       ("Stufe Experte","tier-exp-fg","gray-1"),
       ("Stufe Einsteiger (= gedaempft)","gray-11","gray-1"),
       ("Neutrales Urteil","gray-11","gray-1"),
       ("Zaehlerzahl ohne Flaeche","gray-11","gray-1"),
       ("Periode erledigt","success-fg","gray-1"),
       ("Periode aktiv (Text)","accent-11","gray-1"),
       ("Kontur Nummernkreis (min 3:1)","gray-9","gray-1"),
       ("Kontur Ressortsymbol (min 3:1)","gray-9","gray-1")]
fehler=0
for name,tokens in [("HELL",hell),("DUNKEL",dunkel)]:
    print(f"\n=== {name} " + "="*40)
    for bez,fg,bg in paare:
        if fg not in tokens or bg not in tokens: print(f"  ?     {bez}: Token fehlt"); continue
        r=k(tokens[fg],tokens[bg]); mini=3.0 if "3:1" in bez else 4.5
        ok=r>=mini
        if not ok: fehler+=1
        print(f"  [{'OK  ' if ok else 'FAIL'}] {r:5.2f}:1 (min {mini})  {bez}")
print(f"\n{'✓ alle bestehen' if not fehler else f'✗ {fehler} durchgefallen'}")
sys.exit(1 if fehler else 0)
