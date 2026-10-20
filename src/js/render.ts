/* Dibujo de la vista.
   - Ajustar: se pinta la vista previa reducida y el canvas se escala a la vista.
   - 100%: se pinta solo la porción visible, desde la imagen a resolución completa. */
import { byId, ctx2d } from "./dom.ts";
import { state, buf, loadedImage } from "./state.ts";
import { buildLUT, paint, paintRegion } from "./process.ts";
import { syncViewSeg } from "./ui-stage.ts";
import { zoom, zoomViewport } from "./zoom.ts";
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

function renderFit() {
  const { prev, prevIdx } = loadedImage();
  sizeCanvas(prev.w, prev.h);
  const out = vctx.createImageData(prev.w, prev.h);
  paint(prev, prevIdx, state.view, out);
  vctx.putImageData(out, 0, 0);
}

function renderActual() {
  const vp = zoomViewport();
  sizeCanvas(vp.cw, vp.ch);
  viewCanvas.style.width = vp.cw + "px";
  viewCanvas.style.height = vp.ch + "px";
  const out = vctx.createImageData(vp.cw, vp.ch);
  paintRegion(loadedImage().full, vp.x, vp.y, vp.cw, vp.ch, state.view, out);
  vctx.putImageData(out, 0, 0);
}

function render() {
  if (!buf.prev) return;
  buildLUT();
  if (zoom.mode === "actual") renderActual(); else renderFit();
  document.documentElement.style.setProperty("--accent", (state.inks[1] || state.inks[0]).color);
  syncViewSeg();
  syncRecipeUI();  // muestra y marca de cambios sin guardar, en vivo
}
