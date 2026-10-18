"use strict";
/* Zona de la imagen: selector de vista, abrir, arrastrar y pegar.
   Expone: syncViewSeg, setHasImage, fitCanvas
   Usa: state, buf, scheduleRender, loadFile, sampleImage, IS_MAC */

const viewSeg = document.getElementById("viewSeg");
function syncViewSeg() {
  viewSeg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === state.view)));
}
viewSeg.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (b) { state.view = b.dataset.v; scheduleRender(); }
});

const fileIn = document.getElementById("file");
const stage = document.getElementById("stage");
document.getElementById("openBtn").addEventListener("click", () => fileIn.click());
const pasteKey = IS_MAC ? "⌘V" : "Ctrl+V";
document.getElementById("openBtn").title = `Abrir imagen… También podés arrastrarla a la vista o pegarla con ${pasteKey}`;
document.getElementById("dzSub").textContent = `También podés pegarla con ${pasteKey} · JPG, PNG o WebP`;
document.getElementById("dropzone").addEventListener("click", () => fileIn.click());
document.getElementById("sampleBtn").addEventListener("click", () => sampleImage());

// Con o sin imagen: muestra la zona de carga o el visor, y habilita las descargas
const dlButtons = ["expDuo", "expMenuBtn"].map(id => document.getElementById(id));
function setHasImage(has) {
  document.body.classList.toggle("no-image", !has);
  dlButtons.forEach(b => b.disabled = !has);
  if (has) fitCanvas();
}

// Ajustar a la vista: el canvas ocupa el mayor tamaño posible dentro del escenario,
// conservando la proporción (también agranda las imágenes chicas)
const FIT_INSET = { top: 60, right: 32, bottom: 24, left: 32 };
const viewEl = document.getElementById("view");
function fitCanvas() {
  if (!buf.full) return;
  const r = stage.getBoundingClientRect();
  const aw = r.width - FIT_INSET.left - FIT_INSET.right, ah = r.height - FIT_INSET.top - FIT_INSET.bottom;
  if (aw <= 0 || ah <= 0) return;
  const s = Math.min(aw / buf.full.w, ah / buf.full.h);
  viewEl.style.width = Math.max(1, Math.floor(buf.full.w * s)) + "px";
  viewEl.style.height = Math.max(1, Math.floor(buf.full.h * s)) + "px";
}
new ResizeObserver(fitCanvas).observe(stage);
fileIn.addEventListener("change", () => { loadFile(fileIn.files[0]); fileIn.value = ""; });
["dragenter", "dragover"].forEach(t => stage.addEventListener(t, e => { e.preventDefault(); stage.classList.add("drag"); }));
// dragleave también se dispara al pasar entre elementos internos: solo cuenta si el puntero salió de #stage
stage.addEventListener("dragleave", e => {
  const r = stage.getBoundingClientRect();
  if (e.clientX <= r.left || e.clientX >= r.right || e.clientY <= r.top || e.clientY >= r.bottom) stage.classList.remove("drag");
});
stage.addEventListener("drop", e => {
  e.preventDefault();
  stage.classList.remove("drag");
  loadFile(e.dataTransfer.files[0]);
});
window.addEventListener("paste", e => {
  const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith("image/"));
  if (f) loadFile(f);
});
