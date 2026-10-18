"use strict";
/* Zona de la imagen: selector de vista, abrir, arrastrar y pegar.
   Expone: syncViewSeg
   Usa: state, scheduleRender, loadFile, IS_MAC */

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
document.getElementById("openSub").textContent = `Arrastrala a la vista o pegala con ${IS_MAC ? "⌘V" : "Ctrl+V"}`;
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
