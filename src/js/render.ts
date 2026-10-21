/* Dibujo de la vista.
   - Ajustar: se pinta la vista previa reducida y el canvas se escala a la vista.
   - 100%: se pinta solo la porción visible, desde la imagen a resolución completa. */
import { byId, ctx2d } from "./dom.ts";
import { doc, view, loadedImage } from "./session.ts";
import type { Bitmap } from "./types.ts";
import { paint, paintRegion } from "./process.ts";
import { syncViewSeg } from "./ui-stage.ts";
import { zoomViewport } from "./zoom.ts";
import { syncRecipeUI } from "./recipes.ts";

const viewCanvas = byId("view", HTMLCanvasElement);
const vctx = ctx2d(viewCanvas);

let rafPending = false;
export function scheduleRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; render(); });
}

function sizeCanvas(w: number, h: number) {
  if (viewCanvas.width !== w || viewCanvas.height !== h) { viewCanvas.width = w; viewCanvas.height = h; }
}

function renderFit(prev: Bitmap) {
  sizeCanvas(prev.w, prev.h);
  const out = vctx.createImageData(prev.w, prev.h);
  paint(prev, view.mode, out);
  vctx.putImageData(out, 0, 0);
}

function renderActual(full: Bitmap, vp: ReturnType<typeof zoomViewport>) {
  sizeCanvas(vp.cw, vp.ch);
  viewCanvas.style.width = vp.cw + "px";
  viewCanvas.style.height = vp.ch + "px";
  const out = vctx.createImageData(vp.cw, vp.ch);
  paintRegion(full, vp.x, vp.y, vp.cw, vp.ch, view.mode, out);
  vctx.putImageData(out, 0, 0);
}

function render() {
  if (!doc.image) return;
  const { full, prev } = loadedImage();
  if (view.zoom === "actual") renderActual(full, zoomViewport()); else renderFit(prev);
  document.documentElement.style.setProperty("--accent", (doc.inks[1] || doc.inks[0]).color);
  syncViewSeg();
  syncRecipeUI();  // muestra y marca de cambios sin guardar, en vivo
}
