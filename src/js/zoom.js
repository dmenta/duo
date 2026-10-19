/* Zoom con dos modos: ajustar a la vista o tamaño real (1 píxel de imagen = 1 píxel CSS).
   Al 100% la imagen se desplaza arrastrando o con la rueda; doble clic alterna los modos. */
import { byId } from "./dom.js";
import { buf, loadedImage } from "./state.js";
import { scheduleRender } from "./render.js";
import { stage, fitCanvas } from "./ui-stage.js";


/** @typedef {"fit" | "actual"} ZoomMode */
/** @type {{ mode: ZoomMode, x: number, y: number }} */
export const zoom = { mode: "fit", x: 0, y: 0 };  // x, y: esquina superior izquierda visible, en píxeles de imagen
const zoomSeg = byId("zoomSeg");
const zoomStage = byId("stage");
/** @param {number} v @param {number} lo @param {number} hi */
const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Porción visible al 100%: tamaño del canvas y origen dentro de la imagen
export function zoomViewport() {
  const r = zoomStage.getBoundingClientRect();
  const W = Math.max(1, Math.floor(r.width)), H = Math.max(1, Math.floor(r.height));
  const { w: iw, h: ih } = loadedImage().full;
  const cw = Math.min(W, iw), ch = Math.min(H, ih);
  zoom.x = clampTo(zoom.x, 0, iw - cw);
  zoom.y = clampTo(zoom.y, 0, ih - ch);
  zoomStage.classList.toggle("can-pan", cw < iw || ch < ih);
  return { W, H, cw, ch, x: Math.round(zoom.x), y: Math.round(zoom.y) };
}

/**
 * @param {ZoomMode} mode
 * @param {{ ix: number, iy: number, sx: number, sy: number }} [focus]  punto de la imagen (ix, iy) que debe quedar
 *   bajo el punto (sx, sy) del escenario
 */
export function setZoom(mode, focus) {
  zoom.mode = mode;
  if (mode === "actual" && buf.full) {
    const r = zoomStage.getBoundingClientRect(), iw = buf.full.w, ih = buf.full.h;
    const cw = Math.min(Math.floor(r.width), iw), ch = Math.min(Math.floor(r.height), ih);
    const left = (r.width - cw) / 2, top = (r.height - ch) / 2;
    if (focus) { zoom.x = focus.ix - (focus.sx - left); zoom.y = focus.iy - (focus.sy - top); }
    else { zoom.x = (iw - cw) / 2; zoom.y = (ih - ch) / 2; }
  }
  document.body.classList.toggle("zoom-actual", mode === "actual");
  zoomSeg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.z === mode)));
  if (mode === "fit") fitCanvas();
  scheduleRender();
}

zoomSeg.addEventListener("click", e => { const b = /** @type {Element} */ (e.target).closest("button"); if (b) setZoom(/** @type {ZoomMode} */ (b.dataset.z)); });

// Doble clic: alterna; al pasar a 100% conserva bajo el cursor el punto clickeado
zoomStage.addEventListener("dblclick", e => {
  if (!buf.full || /** @type {Element} */ (e.target).closest("button")) return;
  if (zoom.mode === "actual") { setZoom("fit"); return; }
  const c = byId("view", HTMLCanvasElement).getBoundingClientRect(), s = zoomStage.getBoundingClientRect();
  if (e.clientX < c.left || e.clientX > c.right || e.clientY < c.top || e.clientY > c.bottom) return;
  setZoom("actual", {
    ix: (e.clientX - c.left) / c.width * buf.full.w, iy: (e.clientY - c.top) / c.height * buf.full.h,
    sx: e.clientX - s.left, sy: e.clientY - s.top
  });
});

// Desplazamiento al 100%: arrastrar o rueda
/** Inicio del arrastre: puntero y posición de la vista @type {{ px: number, py: number, x: number, y: number } | null} */
let panning = null;
zoomStage.addEventListener("pointerdown", e => {
  if (zoom.mode !== "actual" || !buf.full || e.button !== 0 || /** @type {Element} */ (e.target).closest("button")) return;
  panning = { px: e.clientX, py: e.clientY, x: zoom.x, y: zoom.y };
  zoomStage.setPointerCapture(e.pointerId);
  zoomStage.classList.add("panning");
});
zoomStage.addEventListener("pointermove", e => {
  if (!panning) return;
  zoom.x = panning.x - (e.clientX - panning.px);
  zoom.y = panning.y - (e.clientY - panning.py);
  scheduleRender();
});
const endPan = () => { panning = null; zoomStage.classList.remove("panning"); };
zoomStage.addEventListener("pointerup", endPan);
zoomStage.addEventListener("pointercancel", endPan);
zoomStage.addEventListener("wheel", e => {
  if (zoom.mode !== "actual" || !buf.full) return;
  e.preventDefault();
  zoom.x += e.shiftKey ? e.deltaY : e.deltaX;
  zoom.y += e.shiftKey ? 0 : e.deltaY;
  scheduleRender();
}, { passive: false });

// Atajos: Ctrl+0 ajustar, Ctrl+1 tamaño real
window.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || !buf.full) return;
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "0") { e.preventDefault(); setZoom("fit"); }
  else if (e.key === "1") { e.preventDefault(); setZoom("actual"); }
});
