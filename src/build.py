"""Arma un único HTML autocontenido a partir de index.html.

- Reemplaza <link rel="stylesheet" href="styles.css"> por el CSS inline.
- Reemplaza <script type="module" src="js/main.js"> por el bundle que arma esbuild
  siguiendo los import desde main.js. Los scripts externos (CDN) quedan como están.

Requiere `npm install` una vez (instala esbuild en node_modules).
Uso: python build.py [salida.html]   (por defecto ../duotono.html)
"""
from pathlib import Path
import re
import subprocess
import sys

src = Path(__file__).parent
root = src.parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "duotono.html"
html = (src / "index.html").read_text(encoding="utf-8")

# Acepta <link ...> y <link ... /> (elementos void con o sin cierre)
link_re = re.compile(r'<link rel="stylesheet" href="styles\.css"\s*/?>')
if not link_re.search(html):
    sys.exit("Falta la referencia a styles.css en index.html")
css = (src / "styles.css").read_text(encoding="utf-8")
html = link_re.sub(lambda m: "<style>\n" + css + "</style>", html, count=1)

entry_re = re.compile(r'[ \t]*<!--[^\n]*-->\n[ \t]*<script type="module" src="js/main\.js"></script>\n?')
if not entry_re.search(html):
    sys.exit('Falta <script type="module" src="js/main.js"> en index.html')

esbuild = root / "node_modules" / ".bin" / ("esbuild.cmd" if sys.platform == "win32" else "esbuild")
if not esbuild.exists():
    sys.exit("No se encontró esbuild: ejecutá `npm install` en la raíz del proyecto")
res = subprocess.run([str(esbuild), str(src / "js" / "main.js"), "--bundle", "--format=iife", "--charset=utf8"],
                     capture_output=True, text=True, encoding="utf-8")
if res.returncode:
    sys.exit(res.stderr)
# Evita que un "</script>" dentro del código cierre la etiqueta antes de tiempo
bundle = res.stdout.replace("</script", "<\\/script")
html = entry_re.sub(lambda m: "<script>\n" + bundle + "</script>\n", html, count=1)

out.write_text(html, encoding="utf-8")
print(f"Generado {out}")
