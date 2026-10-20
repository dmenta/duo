/* Estado de la aplicación y buffers de imagen. */
import { CURVE_PRESETS } from "./curves.ts";

/** Punto de curva: [gris 0..1, tinta 0..1] */
export type Point = [number, number];
export type PresetKey = keyof typeof CURVE_PRESETS;

/** Conversión a gris. Los pesos r, g, b (en %) solo cuentan en modo "mix". */
export interface GraySettings {
  mode: "lum" | "mix";
  r: number;
  g: number;
  b: number;
}

/** Tinta tal como se guarda en una receta. */
export interface InkData {
  name: string;
  /** "#rrggbb"; en degradé, el color en los blancos */
  color: string;
  /** "#rrggbb" en los negros; solo si la tinta es un degradé */
  color2?: string;
  preset: PresetKey | "custom";
  /** Curva de transferencia, x creciente de 0 a 1 */
  points: Point[];
}

/** Tinta en el estado: lo mismo que InkData más un id único para la interfaz. */
export interface Ink extends InkData {
  id: number;
}

/** Receta: todo lo que define el resultado (se guarda, se exporta y va al historial). */
export interface Recipe {
  v: 1;
  gray: GraySettings;
  inks: InkData[];
}

export interface RecipeRef {
  kind: "builtin" | "user";
  id: string;
}

export type ViewMode = "original" | "gray" | "result";

/** Píxeles RGBA de una imagen cargada. */
export interface Bitmap {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  hasAlpha: boolean;
}

export const MAX_INKS = 4;
export const NAME_MAX = 32;       // largo máximo del nombre de una tinta
export const PREVIEW_MAX = 1400;  // lado mayor de la vista previa
export const FULL_MAX = 8000;     // lado mayor máximo para exportar

export const SWATCHES: [name: string, hex: string][] = [
  ["Negro", "#231f20"], ["Sepia", "#704214"], ["Naranja", "#e3742f"], ["Rojo", "#c8102e"],
  ["Magenta", "#c4006e"], ["Azul", "#1f4e9c"], ["Cian", "#0093c9"], ["Verde", "#00875a"], ["Amarillo", "#f2c500"]
];

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

// Receta inicial: lo que se usa la primera vez y al restablecer
export const defaultRecipe = (): Recipe => ({
  v: 1,
  gray: { mode: "lum", r: 21.26, g: 71.52, b: 7.22 },
  inks: [
    { name: "Negro", color: "#231f20", preset: "luces", points: CURVE_PRESETS.luces.pts },
    { name: "Naranja", color: "#e3742f", preset: "medios", points: CURVE_PRESETS.medios.pts }
  ]
});

/**
 * Configuración que define el resultado
 */
export const state: { gray: GraySettings; inks: Ink[]; view: ViewMode; active: RecipeRef | null; name: string } = {
  gray: { ...defaultRecipe().gray },
  inks: defaultRecipe().inks.map(makeInk),
  view: "result",
  active: null,            // receta de la biblioteca en uso
  name: "imagen-de-prueba"
};

/**
 * Datos derivados de la imagen cargada
 */
export const buf: { full: Bitmap | null; prev: Bitmap | null; prevIdx: Uint16Array | null; fullIdx: Uint16Array | null; resultLUT: Uint8Array | null } = {
  full: null,       // {w, h, data, hasAlpha} a resolución de exportación
  prev: null,       // {w, h, data} reducida para la vista previa
  prevIdx: null,    // Uint16Array: nivel de gris (0..N-1) por píxel de prev
  fullIdx: null,    // idem para full, se calcula al exportar
  resultLUT: null   // Uint8Array(N*3): color sRGB por nivel de gris
};

/**
 * La imagen cargada, para el código que solo corre cuando hay una (render, zoom, exportar).
 */
export function loadedImage(): { full: Bitmap; prev: Bitmap; prevIdx: Uint16Array } {
  const { full, prev, prevIdx } = buf;
  if (!full || !prev || !prevIdx) throw new Error("No hay imagen cargada");
  return { full, prev, prevIdx };
}

/** Tabla de colores del resultado; se arma con buildLUT antes de pintar. */
export function resultLUT() {
  if (!buf.resultLUT) throw new Error("Falta buildLUT() antes de pintar el resultado");
  return buf.resultLUT;
}
