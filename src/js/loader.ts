/* Carga de imágenes e imagen de prueba. */
import type { Bitmap } from "./types.ts";
import { setStatus } from "./status.ts";
import { byId, ctx2d } from "./dom.ts";
import { PREVIEW_MAX, FULL_MAX } from "./config.ts";
import { doc } from "./session.ts";

/** @param max lado mayor máximo */
function scaled(src: HTMLImageElement | HTMLCanvasElement, max: number): Bitmap {
  const s = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * s)), h = Math.max(1, Math.round(src.height * s));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = ctx2d(c); ctx.imageSmoothingQuality = "high"; ctx.drawImage(src, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { hasAlpha = true; break; }
  return { w, h, data, hasAlpha };
}

function setSource(src: HTMLImageElement | HTMLCanvasElement, name: string) {
  const image = { full: scaled(src, FULL_MAX), prev: scaled(src, PREVIEW_MAX) };
  doc.setImage(image, name);
  const capped = Math.max(src.width, src.height) > FULL_MAX;
  byId("fileName").textContent = name;
  byId("fileName").title = name;
  byId("fileDims").textContent =
    `${image.full.w} × ${image.full.h} px${capped ? " · reducida para exportar" : ""}`;
}


/** Si no es una imagen (o no hay archivo), avisa y no hace nada. */
export function loadFile(file: File | null | undefined) {
  if (!file || !file.type.startsWith("image/")) { setStatus("Ese archivo no es una imagen. Probá con JPG, PNG o WebP.", "error"); return; }
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { setSource(img, file.name.replace(/\.[^.]+$/, "") || "imagen"); URL.revokeObjectURL(url); setStatus(""); };
  img.onerror = () => { setStatus("No se pudo leer la imagen. Probá con otro formato.", "error"); URL.revokeObjectURL(url); };
  img.src = url;
}

export async function sampleImage() {
  let createSampleImage: () => HTMLCanvasElement;
  try { ({ createSampleImage } = await import("./sample-image.ts")); }
  catch { setStatus("No se pudo cargar la imagen de ejemplo.", "error"); return; }

  setSource(createSampleImage(), "imagen-de-prueba");
}
