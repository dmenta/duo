"use strict";
/* Exportación a PNG y ZIP a resolución completa.
   Usa: state, buf, computeIdx, buildLUT, paint, setStatus, JSZip (CDN), window.claude (si existe) */

let downloads = null;
if (window.claude && typeof window.claude.use === "function") {
  window.claude.use("downloads").then(d => { downloads = d; }).catch(() => {});
}

function fullCanvas(mode) {
  if (!buf.fullIdx) buf.fullIdx = computeIdx(buf.full);
  const { w, h } = buf.full;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"), out = ctx.createImageData(w, h);
  paint(buf.full, buf.fullIdx, mode, out); ctx.putImageData(out, 0, 0);
  return c;
}
const toBlob = c => new Promise(res => c.toBlob(res, "image/png"));
const slug = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "imagen";

// En la página publicada usa la capacidad de descargas; fuera de ella, un enlace común.
async function save(filename, blob) {
  if (downloads) {
    try { await downloads.save({ filename, data: blob }); setStatus(`Guardado: ${filename}`); }
    catch (err) { setStatus(err && err.code === "declined" ? "Descarga cancelada." : "No se pudo guardar el archivo en esta vista."); }
    return;
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  setStatus(`Guardado: ${filename}`);
}

const expBtns = ["expDuo", "expGray", "expZip"].map(id => document.getElementById(id));
async function withBusy(btn, fn) {
  if (!buf.full) return;
  const lbl = btn.querySelector(".lbl"), t = lbl.textContent;
  expBtns.forEach(b => b.disabled = true); lbl.textContent = "Procesando…";
  await new Promise(r => setTimeout(r, 30));  // deja pintar el estado antes del cálculo
  try { buildLUT(); await fn(); }
  finally { expBtns.forEach(b => b.disabled = false); lbl.textContent = t; }
}

expBtns[0].addEventListener("click", e => withBusy(e.currentTarget, async () => {
  await save(`${slug(state.name)}-duotono.png`, await toBlob(fullCanvas("result")));
}));
expBtns[1].addEventListener("click", e => withBusy(e.currentTarget, async () => {
  await save(`${slug(state.name)}-gris.png`, await toBlob(fullCanvas("gray")));
}));
expBtns[2].addEventListener("click", e => withBusy(e.currentTarget, async () => {
  if (typeof JSZip === "undefined") { setStatus("No se pudo cargar el compresor. Descargá cada imagen por separado."); return; }
  const zip = new JSZip(), base = slug(state.name);
  zip.file(`${base}-duotono.png`, await toBlob(fullCanvas("result")));
  zip.file(`${base}-gris.png`, await toBlob(fullCanvas("gray")));
  await save(`${base}-duotono.zip`, await zip.generateAsync({ type: "blob" }));
}));
