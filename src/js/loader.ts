/* Carga de imágenes e imagen de prueba. */
import type { Bitmap } from "./types.ts";
import { setStatus, byId, ctx2d } from "./dom.ts";
import { enc, YfromL } from "./color.ts";
import { PREVIEW_MAX, FULL_MAX } from "./config.ts";
import { doc } from "./session.ts";
import { scheduleRender } from "./render.ts";
import { setHasImage } from "./ui-stage.ts";
import { setZoom } from "./zoom.ts";

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
  scheduleRender();
  const capped = Math.max(src.width, src.height) > FULL_MAX;
  byId("fileName").textContent = name;
  byId("fileName").title = name;
  byId("fileDims").textContent =
    `${image.full.w} × ${image.full.h} px${capped ? " · reducida para exportar" : ""}`;
  setHasImage(true);
  setZoom("fit");
}


/** Si no es una imagen (o no hay archivo), avisa y no hace nada. */
export function loadFile(file: File | null | undefined) {
  if (!file || !file.type.startsWith("image/")) { setStatus("Ese archivo no es una imagen. Probá con JPG, PNG o WebP.", "error"); return; }
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { setSource(img, file.name.replace(/\.[^.]+$/, "") || "imagen"); URL.revokeObjectURL(url); setStatus(""); };
  img.onerror = () => { setStatus("No se pudo leer la imagen. Probá con otro formato.", "error"); URL.revokeObjectURL(url); };
  img.src = url;
}

export function sampleImage() {
  const w = 1200, h = 800, c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = ctx2d(c);
  // mesa
  let g = x.createLinearGradient(0, 560, 0, h); g.addColorStop(0, "#5a4a3c"); g.addColorStop(1, "#1c1714"); x.fillStyle = g; x.fillRect(0, 560, w, h - 560);
  // cielo y sol
  g = x.createLinearGradient(0, 0, 0, 560); g.addColorStop(0, "#9cc4e4"); g.addColorStop(1, "#f3dcc0"); x.fillStyle = g; x.fillRect(0, 0, w, 560);
  g = x.createRadialGradient(860, 230, 10, 860, 230, 170); g.addColorStop(0, "#fff8e0"); g.addColorStop(1, "rgba(255,240,200,0)"); x.fillStyle = g; x.fillRect(0, 0, w, 560);
  // colinas
  x.fillStyle = "#3d5a40"; x.beginPath(); x.moveTo(0, 430); x.bezierCurveTo(250, 330, 420, 470, 640, 390); x.bezierCurveTo(820, 330, 1000, 420, 1200, 360); x.lineTo(1200, 560); x.lineTo(0, 560); x.fill();
  x.fillStyle = "#24342a"; x.beginPath(); x.moveTo(0, 500); x.bezierCurveTo(300, 440, 600, 540, 1200, 470); x.lineTo(1200, 560); x.lineTo(0, 560); x.fill();
  // esferas de colores
  ([["#d8312b", 160], ["#f0c419", 300], ["#2b7bd8", 440], ["#2fa35a", 580], ["#a43fb8", 720]] as [string, number][]).forEach(([col, cx]) => {
    const rg = x.createRadialGradient(cx - 18, 650, 6, cx, 665, 60); rg.addColorStop(0, "#ffffff"); rg.addColorStop(0.25, col); rg.addColorStop(1, "#111"); x.fillStyle = rg; x.beginPath(); x.arc(cx, 665, 55, 0, Math.PI * 2); x.fill();
  });
  // degradé y escala de grises en pasos de 10% L*
  x.fillStyle = "#f2f2f2"; x.fillRect(820, 590, 380, 210);
  g = x.createLinearGradient(840, 0, 1180, 0); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#000000"); x.fillStyle = g; x.fillRect(840, 610, 340, 70);
  for (let i = 0; i < 11; i++) { const L = 100 - i * 10, v = enc(YfromL(L)); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(840 + i * 31, 700, 31, 80); }
  setSource(c, "imagen-de-prueba");
}
