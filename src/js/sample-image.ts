/* Imagen de prueba: paisaje con esferas de colores y escala de grises. */
import { enc, YfromL } from "./color.ts";
import { ctx2d } from "./dom.ts";

/** Dibuja la imagen de prueba (1200 × 800) en un canvas nuevo */
export function createSampleImage() {
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

  return c;
}
