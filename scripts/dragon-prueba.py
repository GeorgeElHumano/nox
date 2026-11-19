#!/usr/bin/env python3
"""Arma public/jugar/vendor/dragon-prueba.js: el mismo Dragón Dorado del servidor (live/src/dragon.js) para pelearlo
sin servidor en una copia de prueba (?dragon=1, jugando sin cuenta). Volver a correrlo cada vez que cambie live/src/dragon.js."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
d = (root / 'live/src/dragon.js').read_text()
s = (root / 'live/src/sim.js').read_text()
m = re.search(r"export function mobStats\(.*?\n}\n", s, re.S)
d = re.sub(r"^import .*\n", "", d, flags=re.M).replace("export ", "")
out = "/* GENERADO por scripts/dragon-prueba.py desde live/src/dragon.js: no editar a mano */\n(function(){\n" + m.group(0).replace("export ", "") + d + "\nwindow.NoxDragonTest={Dragon,DR,dragonWindow};})();\n"
(root / 'public/jugar/vendor/dragon-prueba.js').write_text(out)
print('ok', len(out))
