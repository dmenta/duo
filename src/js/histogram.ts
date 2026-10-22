/* Histograma de los niveles de gris (de la vista previa): negro a la izquierda, blanco a la derecha.
   Debajo, los puntos negro y blanco se arrastran: lo que queda afuera pasa a negro o blanco puro. */
import { byId, ctx2d } from "./dom.ts";
import { N } from "./color.ts";
import { doc } from "./session.ts";
import type { GraySettings } from "./types.ts";
import { grayLevels } from "./process.ts";

const BINS = 256;
const canvas = byId("grayHist", HTMLCanvasElement);
/** Alto de la tira de tonos y de los marcadores, en px CSS */
const STRIP = 4, HANDLE = 9;
/** Separación mínima entre los puntos (L*) */
const MIN_GAP = 1;

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
  const ctx = ctx2d(canvas), w = canvas.width, strip = Math.round(STRIP * dpr), hh = Math.round(HANDLE * dpr);
  const h = canvas.height - hh - strip - dpr;
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
  ctx.fillStyle = g; ctx.fillRect(0, h + dpr, w, strip);
  // Fuera de los puntos, las barras quedan atenuadas: esos tonos se recortan
  const { black, white } = doc.gray, xb = black / 100 * w, xw = white / 100 * w;
  ctx.fillStyle = "rgba(128,128,128,0.25)";
  ctx.fillRect(0, 0, xb, h); ctx.fillRect(xw, 0, w - xw, h);
  // Marcadores: triángulos debajo de la tira
  const top = h + dpr + strip;
  for (const [x, fill] of [[xb, "#000"], [xw, "#fff"]] as [number, string][]) {
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + hh * 0.7, top + hh - dpr); ctx.lineTo(x - hh * 0.7, top + hh - dpr); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = dpr; ctx.strokeStyle = getComputedStyle(canvas).color; ctx.stroke();
  }
}

// Se redibuja una vez por cuadro, al cambiar la imagen o la conversión a gris
let pending = false;
function scheduleDraw() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; // Arrastre de los puntos: se toma el más cercano; en curso mientras se mueve, final al soltar
let dragging: "black" | "white" | null = null, moved = false;
/** Posición del puntero -> L* (0..100) */
const levelAt = (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  return Math.round(Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)));
};
function levels(key: "black" | "white", v: number): Partial<Pick<GraySettings, "black" | "white">> {
  return key === "black" ? { black: Math.min(v, doc.gray.white - MIN_GAP) } : { white: Math.max(v, doc.gray.black + MIN_GAP) };
}
canvas.addEventListener("pointerdown", e => {
  if (!doc.hasImage) return;
  const v = levelAt(e);
  dragging = Math.abs(v - doc.gray.black) <= Math.abs(v - doc.gray.white) ? "black" : "white";
  moved = false;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
  if (!dragging) return;
  moved = true;
  doc.setGrayLevels(levels(dragging, levelAt(e)), { live: true });
});
canvas.addEventListener("pointerup", e => {
  if (!dragging) return;
  const key = dragging; dragging = null;
  if (moved) doc.setGrayLevels(levels(key, levelAt(e)));
});
// Doble clic: vuelve a todo el rango
canvas.addEventListener("dblclick", () => { if (doc.hasImage) doc.setGrayLevels({ black: 0, white: 100 }); });

draw(); });
}

draw();
new ResizeObserver(scheduleDraw).observe(canvas);
doc.subscribe(c => { if (c.what === "image" || c.what === "gray" || c.what === "recipe") scheduleDraw(); });
