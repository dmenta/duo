"""Arma un único HTML autocontenido a partir de index.html.

- Reemplaza <link rel="stylesheet" href="styles.css"> por el CSS inline.
- Reemplaza los <script src="js/..."> locales, en el orden en que aparecen,
  por un solo <script> que los concatena dentro de una función autoejecutable.
  Los scripts externos (CDN) quedan como están.

Uso: python build.py [salida.html]   (por defecto ../duotono.html)
"""
from pathlib import Path
import re
import sys

src = Path(__file__).parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else src.parent / "duotono.html"
html = (src / "index.html").read_text(encoding="utf-8")

link = '<link rel="stylesheet" href="styles.css" />'
if link not in html:
    sys.exit("Falta la referencia a styles.css en index.html")
html = html.replace(link, "<style>\n" + (src / "styles.css").read_text(encoding="utf-8") + "</style>")

tag_re = re.compile(r'[ \t]*<script src="(js/[^"]+)"></script>\n?')
paths = tag_re.findall(html)
if not paths:
    sys.exit("No se encontraron scripts locales en index.html")

parts = []
for p in paths:
    code = (src / p).read_text(encoding="utf-8").replace('"use strict";\n', "", 1)
    parts.append(f"/* ===== {p} ===== */\n{code.rstrip()}\n")
bundle = '<script>\n(() => {\n"use strict";\n\n' + "\n".join(parts) + "})();\n</script>\n"

first = True
def repl(m):
    global first
    if first:
        first = False
        return bundle
    return ""
html = tag_re.sub(repl, html)
html = html.replace("<!-- El orden importa: cada archivo usa lo que definen los anteriores -->\n", "")

out.write_text(html, encoding="utf-8")
print(f"Generado {out} ({len(paths)} scripts)")
