"""Une index.html + styles.css + scripts.js en un único HTML autocontenido."""
from pathlib import Path
import sys

src = Path(__file__).parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else src.parent / "duotono.html"
html = (src / "index.html").read_text()
css = (src / "styles.css").read_text()
js = (src / "scripts.js").read_text()

link = '<link rel="stylesheet" href="styles.css">'
tag = '<script src="scripts.js"></script>'
assert link in html and tag in html, "Faltan las referencias a styles.css o scripts.js"
html = html.replace(link, "<style>\n" + css + "</style>").replace(tag, "<script>\n" + js + "</script>")
out.write_text(html)
print(f"Generado {out}")
