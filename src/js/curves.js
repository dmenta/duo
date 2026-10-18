"use strict";
/* Curvas de transferencia por tinta.
   Expone: makeCurve, CURVE_PRESETS
   Usa: clamp01 */

// Interpolación cúbica monótona (Fritsch–Carlson): pasa por los puntos sin rebotes.
function makeCurve(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  if (n === 2) return x => clamp01(ys[0] + (ys[1] - ys[0]) * (x - xs[0]) / (xs[1] - xs[0]));
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    x = clamp01(x);
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return clamp01((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]);
  };
}

const CURVE_PRESETS = {
  lineal: { label: "Lineal", pts: [[0, 0], [1, 1]] },
  luces: { label: "Limpia en luces", pts: [[0, 0], [0.35, 0.12], [0.7, 0.55], [1, 1]] },
  medios: { label: "Medios tonos", pts: [[0, 0], [0.3, 0.38], [0.65, 0.7], [1, 0.8]] },
  campana: { label: "Solo medios", pts: [[0, 0], [0.45, 0.6], [1, 0.25]] },
  sombras: { label: "Sombras", pts: [[0, 0], [0.5, 0.18], [1, 1]] },
  plano: { label: "Fondo plano", pts: [[0, 0.3], [1, 0.6]] }
};
