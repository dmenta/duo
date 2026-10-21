/* Procesamiento: imagen -> niveles de gris -> tintas -> píxeles. */
import type { Bitmap, InkData, ViewMode } from "./state.ts";
import { N, LIN, enc, hexToLin, YfromL, LfromY, coverage, gradientLin } from "./color.ts";
import { makeCurve } from "./curves.ts";
import { state, buf, resultLUT } from "./state.ts";

function grayWeights() {
  return state.gray.mode === "lum"
    ? [0.2126, 0.7152, 0.0722]
    : [state.gray.r / 100, state.gray.g / 100, state.gray.b / 100];
}

// Luminancia lineal Y (0..1) -> índice de tono, precalculado: evita la raíz cúbica de L* por píxel.
// Con 65536 pasos el error es menor a 1/7 de nivel incluso en las sombras profundas.
const Y_STEPS = 65535;
const IDX_FROM_Y = (() => {
  const t = new Uint16Array(Y_STEPS + 1);
  for (let i = 0; i <= Y_STEPS; i++) t[i] = Math.round((1 - LfromY(i / Y_STEPS) / 100) * (N - 1));
  return t;
})();

// Cada píxel -> índice de tono (0 = blanco, N-1 = negro) según L*.
// La transparencia no se mezcla acá: se conserva aparte en img.data para exportar.
function computeIdx(img: Bitmap): Uint16Array {
  const [wr, wg, wb] = grayWeights(), d = img.data, n = img.w * img.h, out = new Uint16Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    let Y = wr * LIN[d[i]] + wg * LIN[d[i + 1]] + wb * LIN[d[i + 2]];
    Y = Y < 0 ? 0 : Y > 1 ? 1 : Y;
    out[p] = IDX_FROM_Y[(Y * Y_STEPS + 0.5) | 0];
  }
  return out;
}

// Niveles de gris de cada imagen, con los pesos con que se calcularon. Solo dependen de la
// imagen y de los pesos efectivos: cambiar tintas o curvas, o aplicar una receta con la
// misma conversión, no los recalcula. Al soltar la imagen, su entrada se libera sola.
const grayCache = new WeakMap<Bitmap, { weights: string; idx: Uint16Array }>();

/** Niveles de gris de `img` con la conversión vigente; los calcula solo si cambiaron los pesos. */
export function grayLevels(img: Bitmap): Uint16Array {
  const weights = grayWeights().join(",");
  const cached = grayCache.get(img);
  if (cached?.weights === weights) return cached.idx;
  const idx = computeIdx(img);
  grayCache.set(img, { weights, idx });
  return idx;
}

// Tabla tono -> color sRGB de `size` niveles para un conjunto de tintas,
// simulando sobreimpresión multiplicativa en RGB lineal.
// Una tinta en degradé (color2) cambia de color con el nivel: color en el blanco, color2 en el negro.
/** @returns size*3 bytes RGB */
export function inkLUT(inks: InkData[], size: number): Uint8Array {
  const solid = inks.map(i => hexToLin(i.color));
  const grads = inks.map(i => i.color2 ? gradientLin(i.color, i.color2, size) : null);
  const covs = inks.map(ink => {
    const f = makeCurve(ink.points), a = new Float32Array(size);
    for (let k = 0; k < size; k++) a[k] = coverage(f(k / (size - 1)));
    return a;
  });
  const lut = new Uint8Array(size * 3);
  for (let k = 0; k < size; k++) {
    let r = 1, g = 1, b = 1;
    for (let j = 0; j < inks.length; j++) {
      const c = covs[j][k], gr = grads[j], s = solid[j];
      const ir = gr ? gr[k * 3] : s[0], ig = gr ? gr[k * 3 + 1] : s[1], ib = gr ? gr[k * 3 + 2] : s[2];
      r *= 1 - c * (1 - ir); g *= 1 - c * (1 - ig); b *= 1 - c * (1 - ib);
    }
    lut[k * 3] = enc(r); lut[k * 3 + 1] = enc(g); lut[k * 3 + 2] = enc(b);
  }
  return lut;
}
export function buildLUT() { buf.resultLUT = inkLUT(state.inks, N); }

// Tabla tono -> gris sRGB
export const grayLUT = (() => {
  const a = new Uint8Array(N);
  for (let k = 0; k < N; k++) a[k] = enc(YfromL(100 * (1 - k / (N - 1))));
  return a;
})();

// Escribe en `out` (ImageData) la vista pedida, con la transparencia compuesta sobre blanco.
// La vista original no necesita los niveles de gris; las otras los piden a grayLevels.
export function paint(img: Bitmap, mode: ViewMode, out: ImageData) {
  const o = out.data, n = img.w * img.h;
  if (mode === "original") {
    const d = img.data;
    for (let i = 0; i < o.length; i += 4) {
      const a = d[i + 3] / 255;
      if (a >= 1) { o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; }
      else for (let c = 0; c < 3; c++) o[i + c] = enc(LIN[d[i + c]] * a + (1 - a));
      o[i + 3] = 255;
    }
    return;
  }
  const lut = mode === "result" ? resultLUT() : grayLUT, d = img.data, idx = grayLevels(img);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const k = idx[p];
    if (mode === "result") { o[i] = lut[k * 3]; o[i + 1] = lut[k * 3 + 1]; o[i + 2] = lut[k * 3 + 2]; }
    else { const v = grayLUT[k]; o[i] = v; o[i + 1] = v; o[i + 2] = v; }
    const a = d[i + 3];
    if (a < 255) { const t = a / 255; for (let c = 0; c < 3; c++) o[i + c] = enc(LIN[o[i + c]] * t + (1 - t)); }
    o[i + 3] = 255;
  }
}

/**
 * Pinta la región (x0, y0, w, h) de la imagen en `out` (w×h) calculando el gris al vuelo:
 * se usa al 100%, donde solo se procesa lo visible y siempre con la conversión a gris vigente.
 */
export function paintRegion(img: Bitmap, x0: number, y0: number, w: number, h: number, mode: ViewMode, out: ImageData) {
  const [wr, wg, wb] = grayWeights(), d = img.data, o = out.data, lut = mode === "result" ? resultLUT() : grayLUT, iw = img.w;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0, s = ((y0 + y) * iw + x0) * 4; x < w; x++, s += 4, i += 4) {
      if (mode === "original") { o[i] = d[s]; o[i + 1] = d[s + 1]; o[i + 2] = d[s + 2]; }
      else {
        let Y = wr * LIN[d[s]] + wg * LIN[d[s + 1]] + wb * LIN[d[s + 2]];
        Y = Y < 0 ? 0 : Y > 1 ? 1 : Y;
        const k = IDX_FROM_Y[(Y * Y_STEPS + 0.5) | 0];
        if (mode === "result") { o[i] = lut[k * 3]; o[i + 1] = lut[k * 3 + 1]; o[i + 2] = lut[k * 3 + 2]; }
        else { const v = grayLUT[k]; o[i] = v; o[i + 1] = v; o[i + 2] = v; }
      }
      const a = d[s + 3];
      if (a < 255) { const t = a / 255; for (let c = 0; c < 3; c++) o[i + c] = enc(LIN[o[i + c]] * t + (1 - t)); }
      o[i + 3] = 255;
    }
  }
}
