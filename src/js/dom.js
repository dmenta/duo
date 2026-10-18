"use strict";
/* Utilidades de DOM.
   Expone: esc, setStatus(texto, "info" | "error"), IS_MAC, cssColorToHex */

const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Aviso flotante: desaparece solo; los errores quedan más tiempo. Texto vacío lo oculta.
const toastEl = document.getElementById("toast");
let toastTimer = 0;
function setStatus(text, kind = "info") {
  clearTimeout(toastTimer);
  if (!text) { toastEl.classList.remove("on"); return; }
  toastEl.textContent = text;
  toastEl.dataset.kind = kind;
  toastEl.classList.add("on");
  toastTimer = setTimeout(() => toastEl.classList.remove("on"), kind === "error" ? 7000 : 3500);
}

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// Cualquier color CSS -> "#rrggbb", usando el intérprete del navegador:
// hex (con o sin #, abreviado), rgb(), hsl(), oklch(), nombres... También "255, 0, 0".
// Los colores fuera de sRGB se ajustan al más cercano. Devuelve null si no es un color válido.
const colorProbe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
function cssColorToHex(input) {
  let s = input.trim();
  if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
    s = s.replace("#", "");
    if (s.length === 3) s = [...s].map(c => c + c).join("");
    return "#" + s.toLowerCase();
  }
  if (/^\d{1,3}\s*[, ]\s*\d{1,3}\s*[, ]\s*\d{1,3}$/.test(s)) s = `rgb(${s.split(/[\s,]+/).join(", ")})`;
  if (!s || !CSS.supports("color", s)) return null;
  colorProbe.canvas.width = colorProbe.canvas.height = 1;
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = s;
  colorProbe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = colorProbe.getImageData(0, 0, 1, 1).data;
  if (a === 0) return null;
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}
