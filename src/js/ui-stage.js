"use strict";
/* Zona de la imagen: selector de vista, abrir, arrastrar y pegar.
   Expone: syncViewSeg
   Usa: state, scheduleRender, loadFile */

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
fileIn.addEventListener("change", () => { loadFile(fileIn.files[0]); fileIn.value = ""; });
["dragenter", "dragover"].forEach(t => stage.addEventListener(t, e => { e.preventDefault(); stage.classList.add("drag"); }));
["dragleave", "drop"].forEach(t => stage.addEventListener(t, e => { e.preventDefault(); stage.classList.remove("drag"); }));
stage.addEventListener("drop", e => loadFile(e.dataTransfer.files[0]));
window.addEventListener("paste", e => {
  const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith("image/"));
  if (f) loadFile(f);
});
