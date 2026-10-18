"use strict";
/* Procesamiento: imagen -> niveles de gris -> tintas -> píxeles.
   Expone: grayWeights, computeIdx, inkLUT, buildLUT, grayLUT, paint, paintRegion
   Usa: state, buf, N, LIN, enc, hexToLin, YfromL, LfromY, coverage, makeCurve */

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
function computeIdx(img) {
  const [wr, wg, wb] = grayWeights(), d = img.data, n = img.w * img.h, out = new Uint16Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    let Y = wr * LIN[d[i]] + wg * LIN[d[i + 1]] + wb * LIN[d[i + 2]];
    Y = Y < 0 ? 0 : Y > 1 ? 1 : Y;
    out[p] = IDX_FROM_Y[(Y * Y_STEPS + 0.5) | 0];
  }
  return out;
}

// Tabla tono -> color sRGB de `size` niveles para un conjunto de tintas,
// simulando sobreimpresión multiplicativa en RGB lineal
function inkLUT(inks, size) {
  const cols = inks.map(i => hexToLin(i.color));
  const covs = inks.map(ink => {
    const f = makeCurve(ink.points), a = new Float32Array(size);
    for (let k = 0; k < size; k++) a[k] = coverage(f(k / (size - 1)));
    return a;
  });
  const lut = new Uint8Array(size * 3);
  for (let k = 0; k < size; k++) {
    let r = 1, g = 1, b = 1;
    for (let j = 0; j < cols.length; j++) {
      const c = covs[j][k], ink = cols[j];
      r *= 1 - c * (1 - ink[0]); g *= 1 - c * (1 - ink[1]); b *= 1 - c * (1 - ink[2]);
    }
    lut[k * 3] = enc(r); lut[k * 3 + 1] = enc(g); lut[k * 3 + 2] = enc(b);
  }
  return lut;
}
function buildLUT() { buf.resultLUT = inkLUT(state.inks, N); }

// Tabla tono -> gris sRGB
const grayLUT = (() => {
  const a = new Uint8Array(N);
  for (let k = 0; k < N; k++) a[k] = enc(YfromL(100 * (1 - k / (N - 1))));
  return a;
})();

// Escribe en `out` (ImageData) la vista pedida, con la transparencia compuesta sobre blanco
function paint(img, idx, mode, out) {
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
  const lut = buf.resultLUT, d = img.data;
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const k = idx[p];
    if (mode === "result") { o[i] = lut[k * 3]; o[i + 1] = lut[k * 3 + 1]; o[i + 2] = lut[k * 3 + 2]; }
    else { const v = grayLUT[k]; o[i] = v; o[i + 1] = v; o[i + 2] = v; }
    const a = d[i + 3];
    if (a < 255) { const t = a / 255; for (let c = 0; c < 3; c++) o[i + c] = enc(LIN[o[i + c]] * t + (1 - t)); }
    o[i + 3] = 255;
  }
}

// Pinta la región (x0, y0, w, h) de la imagen calculando el gris al vuelo: se usa al 100%,
// donde solo se procesa lo visible y siempre con la conversión a gris vigente
function paintRegion(img, x0, y0, w, h, mode, out) {
  const [wr, wg, wb] = grayWeights(), d = img.data, o = out.data, lut = buf.resultLUT, iw = img.w;
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
