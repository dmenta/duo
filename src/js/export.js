/* Exportación a PNG y ZIP a resolución completa. */
import { setStatus, attachMenu, byId, ctx2d, qs } from "./dom.js";
import { state, buf, loadedImage, resultLUT } from "./state.js";
/** @import { ViewMode } from "./state.js" */
import { computeIdx, buildLUT, grayLUT, paint } from "./process.js";
import { encodePNG } from "./png.js";


let downloads = null;
if (window.claude && typeof window.claude.use === "function") {
  window.claude.use("downloads").then(d => { downloads = d; }).catch(() => {});
}

// Niveles de gris de la imagen completa: se calculan recién al exportar
function fullIdx() {
  return buf.fullIdx ??= computeIdx(loadedImage().full);
}

/** @param {ViewMode} mode */
function fullCanvas(mode) {
  const full = loadedImage().full, { w, h } = full;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = ctx2d(c), out = ctx.createImageData(w, h);
  paint(full, fullIdx(), mode, out); ctx.putImageData(out, 0, 0);
  return c;
}
const toBlob = c => new Promise(res => c.toBlob(res, "image/png"));

// PNG con el tipo de color justo: gris 8 bits (o gris+alfa) y RGB 24 bits (o RGBA 32).
// Devuelve { blob, desc }.
/** @param {"result" | "gray"} mode */
async function exportPNG(mode) {
  const { w, h, data, hasAlpha } = loadedImage().full, idx = fullIdx();
  const color = mode === "result", lut = color ? resultLUT() : grayLUT;
  const channels = (color ? 3 : 1) + (hasAlpha ? 1 : 0);
  const blob = await encodePNG(w, h, channels, (y, row) => {
    for (let x = 0, p = y * w, o = 0; x < w; x++, p++) {
      const k = idx[p];
      if (color) { row[o++] = lut[k * 3]; row[o++] = lut[k * 3 + 1]; row[o++] = lut[k * 3 + 2]; }
      else row[o++] = grayLUT[k];
      if (hasAlpha) row[o++] = data[p * 4 + 3];
    }
  });
  if (!blob) return { blob: await toBlob(fullCanvas(mode)), desc: "RGBA 32 bits" };  // navegador sin CompressionStream
  const desc = color ? (hasAlpha ? "RGBA 32 bits" : "RGB 24 bits") : (hasAlpha ? "gris con alfa, 16 bits" : "gris 8 bits");
  return { blob, desc };
}
/** Texto -> nombre de archivo seguro: sin acentos, minúsculas y guiones. @param {string} s */
export const slug = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "imagen";

// En la página publicada usa la capacidad de descargas; fuera de ella, un enlace común.
/** @param {string} filename @param {Blob} blob @param {string} [desc]  detalle para el aviso */
export async function save(filename, blob, desc) {
  const done = `Guardado: ${filename}${desc ? ` (${desc})` : ""}`;
  if (downloads) {
    try { await downloads.save({ filename, data: blob }); setStatus(done); }
    catch (err) { err && err.code === "declined" ? setStatus("Descarga cancelada.") : setStatus("No se pudo guardar el archivo en esta vista.", "error"); }
    return;
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  setStatus(done);
}

/* ---------- Split button de descargas ---------- */
const dlMain = byId("expDuo", HTMLButtonElement);
const dlToggle = byId("expMenuBtn", HTMLButtonElement);
const dlMenu = byId("expMenu");
const dlItems = [...dlMenu.querySelectorAll(/** @type {'button'} */ ('[role="menuitem"]'))];
const dlAll = [dlMain, dlToggle, ...dlItems];

const EXPORTS = {
  result: async () => {
    const { blob, desc } = await exportPNG("result");
    await save(`${slug(state.name)}-duotono.png`, blob, desc);
  },
  gray: async () => {
    const { blob, desc } = await exportPNG("gray");
    await save(`${slug(state.name)}-gris.png`, blob, desc);
  },
  zip: async () => {
    if (typeof JSZip === "undefined") { setStatus("No se pudo cargar el compresor. Descargá cada imagen por separado.", "error"); return; }
    const zip = new JSZip(), base = slug(state.name);
    zip.file(`${base}-duotono.png`, (await exportPNG("result")).blob);
    zip.file(`${base}-gris.png`, (await exportPNG("gray")).blob);
    await save(`${base}-duotono.zip`, await zip.generateAsync({ type: "blob" }));
  }
};

async function runExport(action) {
  if (!buf.full) return;
  const lbl = qs(dlMain, ".lbl"), t = lbl.textContent;
  dlAll.forEach(b => b.disabled = true); lbl.textContent = "Procesando…";
  await new Promise(r => setTimeout(r, 30));  // deja pintar el estado antes del cálculo
  try { buildLUT(); await EXPORTS[action](); }
  finally { dlAll.forEach(b => b.disabled = false); lbl.textContent = t; }
}

dlMain.addEventListener("click", () => runExport("result"));
attachMenu(dlToggle, dlMenu);
dlItems.forEach(item => item.addEventListener("click", () => runExport(item.dataset.action)));
