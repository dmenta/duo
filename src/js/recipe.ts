/* Modelo de receta: crear, normalizar y validar recetas y tintas. Sin estado de la sesión. */
import { CURVE_PRESETS, MAX_INKS, NAME_MAX, SWATCHES } from "./config.ts";
import type { Ink, InkData, Point, PresetKey, Recipe } from "./types.ts";

// Nombre del color predefinido con ese hex, o undefined si es un color propio
export const swatchName = (color: string): string | undefined => (SWATCHES.find(s => s[1] === color.toLowerCase()) || [])[0];

let uid = 0;
// Tinta de la receta -> tinta en el estado (con id propio para la interfaz).
// Si el color es predefinido, su nombre manda: corrige recetas con nombres desfasados.
// Una tinta en degradé lleva color2 (el color en los negros); su nombre siempre es libre.
export const makeInk = ({ name, color, color2, preset, points }: InkData): Ink => {
  color = color.toLowerCase();
  const ink = { id: ++uid, name: "", color } as Ink;
  if (color2) ink.color2 = color2.toLowerCase();
  const fixedName = ink.color2 ? undefined : swatchName(color);
  ink.name = (fixedName ?? name).slice(0, NAME_MAX);
  ink.preset = preset;
  ink.points = points.map(p => (p.slice() as Point));
  return ink;
};

export const newInk = (name: string, color: string, preset: PresetKey) => makeInk({ name, color, preset, points: CURVE_PRESETS[preset].pts });

// Datos de una tinta para la receta, con claves en orden fijo (color2 solo si es degradé)
export const inkData = ({ name, color, color2, preset, points }: InkData): InkData =>
  color2 ? { name, color, color2, preset, points: points.map(p => (p.slice() as Point)) }
         : { name, color, preset, points: points.map(p => (p.slice() as Point)) };

// Receta de cualquier origen -> misma forma que getRecipe (nombres y colores normalizados)
export function normalizeRecipe(r: Recipe): Recipe {
  const g = r.gray;
  return {
    v: 1,
    gray: { mode: g.mode, r: g.r, g: g.g, b: g.b },
    inks: r.inks.map(makeInk).map(inkData)
  };
}

/**
 * Comprueba que una receta (guardada, importada…) tenga una forma válida
 * @param r datos de origen desconocido
 */
export function validRecipe(r: any): r is Recipe {
  try {
    const isHex = (c: unknown) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
    const g = r && r.gray;
    if (!r || r.v !== 1 || !g || !["lum", "mix"].includes(g.mode) || ![g.r, g.g, g.b].every(Number.isFinite)) return false;
    if (!Array.isArray(r.inks) || r.inks.length < 1 || r.inks.length > MAX_INKS) return false;
    return r.inks.every((i: any) =>
      typeof i.name === "string" && isHex(i.color) && (i.color2 === undefined || isHex(i.color2)) &&
      (i.preset === "custom" || Object.hasOwn(CURVE_PRESETS, i.preset)) &&
      Array.isArray(i.points) && i.points.length >= 2 &&
      i.points[0][0] === 0 && i.points[i.points.length - 1][0] === 1 &&
      i.points.every((p: any, k: number, a: any[]) => Array.isArray(p) && p.length === 2 &&
        p.every((v: any) => Number.isFinite(v) && v >= 0 && v <= 1) && (k === 0 || p[0] > a[k - 1][0])));
  } catch { return false; }
}
