/* Zona de la imagen: selector de vista, abrir, arrastrar y pegar. */
import { byId } from "./dom.ts";
import { IS_MAC } from "./env.ts";
import { FIT_INSET } from "./config.ts";
import { state, buf } from "./state.ts";
import { scheduleRender } from "./render.ts";
import { loadFile, sampleImage } from "./loader.ts";
import { zoom } from "./zoom.ts";
import type { ViewMode } from "./types.ts";

const viewSeg = byId("viewSeg");
export function syncViewSeg() {
  viewSeg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === state.view)));
}
viewSeg.addEventListener("click", e => {
  const b = (e.target as Element).closest("button");
  if (b) { state.view = b.dataset.v as ViewMode; scheduleRender(); }
});

const fileIn = byId("file", HTMLInputElement);
const stage = byId("stage");
byId("openBtn", HTMLButtonElement).addEventListener("click", () => fileIn.click());
const pasteKey = IS_MAC ? "⌘V" : "Ctrl+V";
byId("openBtn", HTMLButtonElement).title = `Abrir imagen… También podés arrastrarla a la vista o pegarla con ${pasteKey}`;
byId("dzSub").textContent = `También podés pegarla con ${pasteKey} · JPG, PNG o WebP`;
byId("dropzone", HTMLButtonElement).addEventListener("click", () => fileIn.click());
byId("sampleBtn", HTMLButtonElement).addEventListener("click", () => sampleImage());

// Con o sin imagen: muestra la zona de carga o el visor, y habilita las descargas.
// El tamaño del canvas no se toca acá: lo resuelven setZoom (al cargar) y el ResizeObserver.
const dlButtons = ["expDuo", "expMenuBtn"].map(id => byId(id, HTMLButtonElement));

export function setHasImage(has: boolean) {
  document.body.classList.toggle("no-image", !has);
  dlButtons.forEach(b => b.disabled = !has);
}

// Ajustar a la vista: el canvas ocupa el mayor tamaño posible dentro del escenario,
// conservando la proporción (también agranda las imágenes chicas)
const viewEl = byId("view", HTMLCanvasElement);
export function fitCanvas() {
  if (!buf.full) return;
  if (zoom.mode === "actual") { scheduleRender(); return; }  // al 100% el tamaño lo define la porción visible
  const r = stage.getBoundingClientRect();
  const aw = r.width - FIT_INSET.left - FIT_INSET.right, ah = r.height - FIT_INSET.top - FIT_INSET.bottom;
  if (aw <= 0 || ah <= 0) return;
  const s = Math.min(aw / buf.full.w, ah / buf.full.h);
  viewEl.style.width = Math.max(1, Math.floor(buf.full.w * s)) + "px";
  viewEl.style.height = Math.max(1, Math.floor(buf.full.h * s)) + "px";
}
new ResizeObserver(fitCanvas).observe(stage);
fileIn.addEventListener("change", () => { loadFile(fileIn.files?.[0]); fileIn.value = ""; });
["dragenter", "dragover"].forEach(t => stage.addEventListener(t, e => { e.preventDefault(); stage.classList.add("drag"); }));
// dragleave también se dispara al pasar entre elementos internos: solo cuenta si el puntero salió de #stage
stage.addEventListener("dragleave", e => {
  const r = stage.getBoundingClientRect();
  if (e.clientX <= r.left || e.clientX >= r.right || e.clientY <= r.top || e.clientY >= r.bottom) stage.classList.remove("drag");
});
stage.addEventListener("drop", e => {
  e.preventDefault();
  stage.classList.remove("drag");
  loadFile(e.dataTransfer?.files[0]);
});
window.addEventListener("paste", e => {
  const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith("image/"));
  if (f) loadFile(f);
});
