/* Dibujo de la vista.
   - Ajustar: se pinta la vista previa reducida y el canvas se escala a la vista.
   - 100%: se pinta solo la porción visible, desde la imagen a resolución completa. */
import { byId, ctx2d } from "./dom.ts";
import { state, buf, loadedImage } from "./state.ts";
import type { Bitmap } from "./state.ts";
import { buildLUT, grayWeights, paint, paintRegion } from "./process.ts";
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

// Lo último que se pintó: imagen de origen y una clave con todo lo que afecta al canvas.
// Si al renderizar coinciden, el canvas ya muestra lo correcto y no se repinta.
let painted: { img: Bitmap; key: string } | null = null;

/** Todo lo que afecta a los píxeles de la vista actual; lo que no se ve, no entra. */
function viewKey(vp: ReturnType<typeof zoomViewport> | null) {
  const parts: unknown[] = [state.view, vp && [vp.x, vp.y, vp.cw, vp.ch]];
  if (state.view !== "original") parts.push(grayWeights());              // gris y resultado
  if (state.view === "result") parts.push(state.inks.map(i => [i.color, i.color2, i.points]));
  return JSON.stringify(parts);
}

function renderFit(prev: Bitmap) {
  sizeCanvas(prev.w, prev.h);
  const out = vctx.createImageData(prev.w, prev.h);
  paint(prev, state.view, out);
  vctx.putImageData(out, 0, 0);
}

function renderActual(full: Bitmap, vp: ReturnType<typeof zoomViewport>) {
  sizeCanvas(vp.cw, vp.ch);
  viewCanvas.style.width = vp.cw + "px";
  viewCanvas.style.height = vp.ch + "px";
  const out = vctx.createImageData(vp.cw, vp.ch);
  paintRegion(full, vp.x, vp.y, vp.cw, vp.ch, state.view, out);
  vctx.putImageData(out, 0, 0);
}

function render() {
  if (!buf.prev) return;
  const { full, prev } = loadedImage();
  const actual = zoom.mode === "actual";
  const img = actual ? full : prev, vp = actual ? zoomViewport() : null;
  const key = viewKey(vp);
  if (painted?.img !== img || painted.key !== key) {
    if (state.view === "result") buildLUT();
    if (vp) renderActual(full, vp); else renderFit(prev);
    painted = { img, key };
  }
  document.documentElement.style.setProperty("--accent", (state.inks[1] || state.inks[0]).color);
  syncViewSeg();
  syncRecipeUI();  // muestra y marca de cambios sin guardar, en vivo
}
