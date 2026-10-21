/* Zoom con dos modos: ajustar a la vista o tamaño real (1 píxel de imagen = 1 píxel CSS).
   Al 100% la imagen se desplaza arrastrando o con la rueda; doble clic alterna los modos. */
import { byId } from "./dom.ts";
import { doc, view } from "./session.ts";
import type { ZoomMode } from "./types.ts";
import { scheduleRender } from "./render.ts";
import { fitCanvas } from "./ui-stage.ts";

const zoomSeg = byId("zoomSeg");
const zoomStage = byId("stage");

const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Porción visible al 100%: tamaño del canvas y origen dentro de la imagen
export function zoomViewport() {
  const r = zoomStage.getBoundingClientRect();
  const W = Math.max(1, Math.floor(r.width)), H = Math.max(1, Math.floor(r.height));
  const { w: iw, h: ih } = doc.fullSize;
  const cw = Math.min(W, iw), ch = Math.min(H, ih);
  view.setXY(clampTo(view.x, 0, iw - cw), clampTo(view.y, 0, ih - ch));
  zoomStage.classList.toggle("can-pan", cw < iw || ch < ih);
  return { W, H, cw, ch, x: Math.round(view.x), y: Math.round(view.y) };
}

/**
 * @param focus punto de la imagen (ix, iy) que debe quedar
 *   bajo el punto (sx, sy) del escenario
 */
export function setZoom(mode: ZoomMode, focus?: { ix: number; iy: number; sx: number; sy: number; }) {
  view.setZoom(mode);
  if (mode === "actual" && doc.hasImage) {
    const full = doc.fullSize;
    const r = zoomStage.getBoundingClientRect(), iw = full.w, ih = full.h;
    const cw = Math.min(Math.floor(r.width), iw), ch = Math.min(Math.floor(r.height), ih);
    const left = (r.width - cw) / 2, top = (r.height - ch) / 2;
    if (focus) { view.setXY(focus.ix - (focus.sx - left), focus.iy - (focus.sy - top)); }
    else { view.setXY((iw - cw) / 2, (ih - ch) / 2); }
  }
  document.body.classList.toggle("zoom-actual", mode === "actual");
  zoomSeg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.z === mode)));
  if (mode === "fit") fitCanvas();
  scheduleRender();
}

zoomSeg.addEventListener("click", e => { const b = (e.target as Element).closest("button"); if (b) setZoom(b.dataset.z as ZoomMode); });

// Doble clic: alterna; al pasar a 100% conserva bajo el cursor el punto clickeado
zoomStage.addEventListener("dblclick", e => {
  if (!doc.hasImage || (e.target as Element).closest("button")) return;
  if (view.zoom === "actual") { setZoom("fit"); return; }
  const c = byId("view", HTMLCanvasElement).getBoundingClientRect(), s = zoomStage.getBoundingClientRect();
  if (e.clientX < c.left || e.clientX > c.right || e.clientY < c.top || e.clientY > c.bottom) return;
  const full = doc.fullSize;
  setZoom("actual", {
    ix: (e.clientX - c.left) / c.width * full.w, iy: (e.clientY - c.top) / c.height * full.h,
    sx: e.clientX - s.left, sy: e.clientY - s.top
  });
});

// Desplazamiento al 100%: arrastrar o rueda
/** Inicio del arrastre: puntero y posición de la vista */
let panning: { px: number; py: number; x: number; y: number; } | null = null;
zoomStage.addEventListener("pointerdown", e => {
  if (view.zoom !== "actual" || !doc.hasImage || e.button !== 0 || (e.target as Element).closest("button")) return;
  panning = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
  zoomStage.setPointerCapture(e.pointerId);
  zoomStage.classList.add("panning");
});
zoomStage.addEventListener("pointermove", e => {
  if (!panning) return;
  view.setXY(panning.x - (e.clientX - panning.px), panning.y - (e.clientY - panning.py));
  scheduleRender();
});
const endPan = () => { panning = null; zoomStage.classList.remove("panning"); };
zoomStage.addEventListener("pointerup", endPan);
zoomStage.addEventListener("pointercancel", endPan);
zoomStage.addEventListener("wheel", e => {
  if (view.zoom !== "actual" || !doc.hasImage) return;
  e.preventDefault();
  view.setXY(view.x + (e.shiftKey ? e.deltaY : e.deltaX), view.y + (e.shiftKey ? 0 : e.deltaY));
  scheduleRender();
}, { passive: false });

// Atajos: Ctrl+0 ajustar, Ctrl+1 tamaño real
window.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || !doc.hasImage) return;
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "0") { e.preventDefault(); setZoom("fit"); }
  else if (e.key === "1") { e.preventDefault(); setZoom("actual"); }
});
