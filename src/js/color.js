"use strict";
/* Matemática de color: sRGB <-> lineal, Y <-> L*, tono de tinta -> cobertura.
   Expone: N, LIN, enc, hexToRgb, hexToLin, YfromL, LfromY, coverage, clamp01, contrastRatio */

// Resolución de las tablas de tono (niveles de gris internos)
const N = 1024;

// sRGB 8 bits -> lineal
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// lineal -> sRGB 8 bits
const enc = v => {
  v = v < 0 ? 0 : v > 1 ? 1 : v;
  return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
};

const hexToRgb = h => { h = h.replace("#", ""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hexToLin = h => hexToRgb(h).map(v => LIN[v]);

// Luminancia relativa <-> luminosidad perceptual CIE L*
const YfromL = L => { const fy = (L + 16) / 116; return L > 8 ? fy * fy * fy : L / 903.3; };
const LfromY = Y => Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;

// Tono de tinta perceptual (0 = nada, 1 = sólido) -> cobertura física
const coverage = y => 1 - YfromL(100 * (1 - y));

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// Contraste WCAG entre dos colores hex (1 = iguales, 21 = blanco contra negro)
function contrastRatio(a, b) {
  const lum = h => { const [r, g, bl] = hexToLin(h); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
