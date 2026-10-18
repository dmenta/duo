"use strict";
/* Dibujo de la vista previa.
   Expone: scheduleRender, render
   Usa: state, buf, buildLUT, paint, syncViewSeg */

const viewCanvas = document.getElementById("view");
const vctx = viewCanvas.getContext("2d");

let rafPending = false;
function scheduleRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; render(); });
}

function render() {
  const { prev } = buf;
  if (!prev) return;
  buildLUT();
  if (viewCanvas.width !== prev.w || viewCanvas.height !== prev.h) { viewCanvas.width = prev.w; viewCanvas.height = prev.h; }
  const out = vctx.createImageData(prev.w, prev.h);
  paint(prev, buf.prevIdx, state.view, out);
  vctx.putImageData(out, 0, 0);
  document.documentElement.style.setProperty("--accent", (state.inks[1] || state.inks[0]).color);
  syncViewSeg();
}
