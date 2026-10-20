/* Matemática de color: sRGB <-> lineal, Y <-> L*, tono de tinta -> cobertura. */

// Resolución de las tablas de tono (niveles de gris internos)
export const N = 1024;

// sRGB 8 bits -> lineal
export const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// lineal -> sRGB 8 bits
/** @param v 0..1 @returns 0..255 */
export const enc = (v: number): number => {
  v = v < 0 ? 0 : v > 1 ? 1 : v;
  return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
};

/** @param h "#rrggbb" @returns [r, g, b] en 0..255 */
const hexToRgb = (h: string): number[] => { h = h.replace("#", ""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

export const hexToLin = (h: string) => hexToRgb(h).map(v => LIN[v]);

// Luminancia relativa <-> luminosidad perceptual CIE L*
/** @param L 0..100 */
export const YfromL = (L: number) => { const fy = (L + 16) / 116; return L > 8 ? fy * fy * fy : L / 903.3; };
/** @param Y 0..1 */
export const LfromY = (Y: number) => Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;

// Tono de tinta perceptual (0 = nada, 1 = sólido) -> cobertura física
export const coverage = (y: number) => 1 - YfromL(100 * (1 - y));

export const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;

// Contraste WCAG entre dos colores hex (1 = iguales, 21 = blanco contra negro)
export function contrastRatio(a: string, b: string) {

  const lum = (h: string) => { const [r, g, bl] = hexToLin(h); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Degradé entre dos colores muestreado en `size` niveles. Se interpola en sRGB (como un
// linear-gradient de CSS) y se devuelve en RGB lineal para mezclar tintas.
/** @returns size*3 valores RGB lineales */
export function gradientLin(fromHex: string, toHex: string, size: number): Float32Array {
  const a = hexToRgb(fromHex), b = hexToRgb(toHex), lin = new Float32Array(size * 3);
  for (let k = 0; k < size; k++) {
    const t = size > 1 ? k / (size - 1) : 0;
    for (let c = 0; c < 3; c++) {
      const v = (a[c] + (b[c] - a[c]) * t) / 255;
      lin[k * 3 + c] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
  }
  return lin;
}

// Color hex en la posición t (0..1) entre dos colores, interpolado en sRGB
export function mixHex(fromHex: string, toHex: string, t: number) {
  const a = hexToRgb(fromHex), b = hexToRgb(toHex);
  return "#" + a.map((v, c) => Math.round(v + (b[c] - v) * t).toString(16).padStart(2, "0")).join("");
}
