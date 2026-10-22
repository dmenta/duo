/* Histograma de los niveles de gris (de la vista previa): negro a la izquierda, blanco a la derecha. */
import { byId, ctx2d } from "./dom.ts";
import { N } from "./color.ts";
import { doc } from "./session.ts";
import { grayLevels } from "./process.ts";

const BINS = 256;
const canvas = byId("grayHist", HTMLCanvasElement);

/** Cantidad de píxeles por barra; los transparentes no cuentan */
function counts(): Uint32Array {
  const img = doc.image.prev, idx = grayLevels(img), d = img.data, out = new Uint32Array(BINS);
  for (let p = 0; p < idx.length; p++) {
    if (d[p * 4 + 3] === 0) continue;
    out[((N - 1 - idx[p]) * BINS / N) | 0]++;
  }
  return out;
}

function draw() {
  canvas.hidden = !doc.hasImage;
  if (!doc.hasImage) return;
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (!r.width) return;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  const ctx = ctx2d(canvas), w = canvas.width, strip = Math.round(4 * dpr), h = canvas.height - strip - dpr;
  const c = counts();
  let max = 0;
  for (const v of c) if (v > max) max = v;
  ctx.fillStyle = getComputedStyle(canvas).color;
  const bw = w / BINS;
  for (let i = 0; i < BINS; i++) {
    const bh = max ? (c[i] / max) * h : 0;
    ctx.fillRect(i * bw, h - bh, Math.ceil(bw), bh);
  }
  // Referencia de tonos debajo de las barras
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "#000"); g.addColorStop(1, "#fff");
  ctx.fillStyle = g; ctx.fillRect(0, canvas.height - strip, w, strip);
}

// Se redibuja una vez por cuadro, al cambiar la imagen o la conversión a gris
let pending = false;
function scheduleDraw() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; draw(); });
}

draw();
new ResizeObserver(scheduleDraw).observe(canvas);
doc.subscribe(c => { if (c.what === "image" || c.what === "gray" || c.what === "recipe") scheduleDraw(); });
