/* Estado de la aplicación y buffers de imagen. */
import { CURVE_PRESETS } from "./curves.js";

/** @typedef {[number, number]} Point  Punto de curva: [gris 0..1, tinta 0..1] */
/** @typedef {keyof typeof CURVE_PRESETS} PresetKey */

/**
 * Conversión a gris. Los pesos r, g, b (en %) solo cuentan en modo "mix".
 * @typedef {{ mode: "lum" | "mix", r: number, g: number, b: number }} GraySettings
 */

/**
 * Tinta tal como se guarda en una receta.
 * @typedef {object} InkData
 * @property {string} name
 * @property {string} color      "#rrggbb"; en degradé, el color en los blancos
 * @property {string} [color2]   "#rrggbb" en los negros; solo si la tinta es un degradé
 * @property {PresetKey | "custom"} preset
 * @property {Point[]} points    curva de transferencia, x creciente de 0 a 1
 */

/**
 * Tinta en el estado: lo mismo que InkData más un id único para la interfaz.
 * @typedef {InkData & { id: number }} Ink
 */

/**
 * Receta: todo lo que define el resultado (se guarda, se exporta y va al historial).
 * @typedef {{ v: 1, gray: GraySettings, inks: InkData[] }} Recipe
 */

/** @typedef {{ kind: "builtin" | "user", id: string }} RecipeRef */
/** @typedef {"original" | "gray" | "result"} ViewMode */

/**
 * Píxeles RGBA de una imagen cargada.
 * @typedef {{ w: number, h: number, data: Uint8ClampedArray, hasAlpha: boolean }} Bitmap
 */


export const MAX_INKS = 4;
export const NAME_MAX = 32;       // largo máximo del nombre de una tinta
export const PREVIEW_MAX = 1400;  // lado mayor de la vista previa
export const FULL_MAX = 8000;     // lado mayor máximo para exportar

/** @type {[name: string, hex: string][]} */
export const SWATCHES = [
  ["Negro", "#231f20"], ["Sepia", "#704214"], ["Naranja", "#e3742f"], ["Rojo", "#c8102e"],
  ["Magenta", "#c4006e"], ["Azul", "#1f4e9c"], ["Cian", "#0093c9"], ["Verde", "#00875a"], ["Amarillo", "#f2c500"]
];

// Nombre del color predefinido con ese hex, o undefined si es un color propio
/** @param {string} color @returns {string | undefined} */
export const swatchName = color => (SWATCHES.find(s => s[1] === color.toLowerCase()) || [])[0];

let uid = 0;
// Tinta de la receta -> tinta en el estado (con id propio para la interfaz).
// Si el color es predefinido, su nombre manda: corrige recetas con nombres desfasados.
// Una tinta en degradé lleva color2 (el color en los negros); su nombre siempre es libre.
/** @param {InkData} data @returns {Ink} */
export const makeInk = ({ name, color, color2, preset, points }) => {
  color = color.toLowerCase();
  const ink = /** @type {Ink} */ ({ id: ++uid, name: "", color });
  if (color2) ink.color2 = color2.toLowerCase();
  const fixedName = ink.color2 ? undefined : swatchName(color);
  ink.name = (fixedName ?? name).slice(0, NAME_MAX);
  ink.preset = preset;
  ink.points = points.map(p => /** @type {Point} */ (p.slice()));
  return ink;
};
/** @param {string} name @param {string} color @param {PresetKey} preset */
export const newInk = (name, color, preset) => makeInk({ name, color, preset, points: CURVE_PRESETS[preset].pts });

// Receta inicial: lo que se usa la primera vez y al restablecer
/** @returns {Recipe} */
export const defaultRecipe = () => ({
  v: 1,
  gray: { mode: "lum", r: 21.26, g: 71.52, b: 7.22 },
  inks: [
    { name: "Negro", color: "#231f20", preset: "luces", points: CURVE_PRESETS.luces.pts },
    { name: "Naranja", color: "#e3742f", preset: "medios", points: CURVE_PRESETS.medios.pts }
  ]
});

/**
 * Configuración que define el resultado
 * @type {{ gray: GraySettings, inks: Ink[], view: ViewMode, active: RecipeRef | null, name: string }}
 */
export const state = {
  gray: { ...defaultRecipe().gray },
  inks: defaultRecipe().inks.map(makeInk),
  view: "result",
  active: null,            // receta de la biblioteca en uso
  name: "imagen-de-prueba"
};

/**
 * Datos derivados de la imagen cargada
 * @type {{ full: Bitmap | null, prev: Bitmap | null, prevIdx: Uint16Array | null, fullIdx: Uint16Array | null, resultLUT: Uint8Array | null }}
 */
export const buf = {
  full: null,       // {w, h, data, hasAlpha} a resolución de exportación
  prev: null,       // {w, h, data} reducida para la vista previa
  prevIdx: null,    // Uint16Array: nivel de gris (0..N-1) por píxel de prev
  fullIdx: null,    // idem para full, se calcula al exportar
  resultLUT: null   // Uint8Array(N*3): color sRGB por nivel de gris
};

/**
 * La imagen cargada, para el código que solo corre cuando hay una (render, zoom, exportar).
 * @returns {{ full: Bitmap, prev: Bitmap, prevIdx: Uint16Array }}
 */
export function loadedImage() {
  const { full, prev, prevIdx } = buf;
  if (!full || !prev || !prevIdx) throw new Error("No hay imagen cargada");
  return { full, prev, prevIdx };
}

/** Tabla de colores del resultado; se arma con buildLUT antes de pintar. */
export function resultLUT() {
  if (!buf.resultLUT) throw new Error("Falta buildLUT() antes de pintar el resultado");
  return buf.resultLUT;
}
