/* Configuración de la app: valores fijos que define el código y no cambian en ejecución. */
import type { GraySettings, InkData, Point, PresetKey, Recipe, RecipeRef } from "./types.ts";

/* ---------- Límites ---------- */

export const MAX_INKS = 4;
export const NAME_MAX = 32;          // largo máximo del nombre de una tinta
export const RECIPE_NAME_MAX = 40;   // largo máximo del nombre de una receta
export const PREVIEW_MAX = 1400;     // lado mayor de la vista previa
export const FULL_MAX = 8000;        // lado mayor máximo para exportar
export const HISTORY_MAX = 100;      // pasos de deshacer

/* ---------- Vista ---------- */

// Margen alrededor de la imagen al ajustarla a la vista (arriba quedan los selectores)
export const FIT_INSET = { top: 60, right: 32, bottom: 24, left: 32 };

/* ---------- Colores y curvas ---------- */

/** Colores rápidos de cada tinta */
export const SWATCHES: [name: string, hex: string][] = [
  ["Negro", "#231f20"], ["Sepia", "#704214"], ["Naranja", "#e3742f"], ["Rojo", "#c8102e"],
  ["Magenta", "#c4006e"], ["Azul", "#1f4e9c"], ["Cian", "#0093c9"], ["Verde", "#00875a"], ["Amarillo", "#f2c500"]
];

/** Curvas predefinidas: cantidad de tinta según el gris */
export const CURVE_PRESETS: Record<string, { label: string; pts: Point[] }> = {
  lineal: { label: "Lineal", pts: [[0, 0], [1, 1]] },
  luces: { label: "Limpia en luces", pts: [[0, 0], [0.35, 0.12], [0.7, 0.55], [1, 1]] },
  medios: { label: "Medios tonos", pts: [[0, 0], [0.3, 0.38], [0.65, 0.7], [1, 0.8]] },
  campana: { label: "Solo medios", pts: [[0, 0], [0.45, 0.6], [1, 0.25]] },
  sombras: { label: "Sombras", pts: [[0, 0], [0.5, 0.18], [1, 1]] },
  plano: { label: "Fondo plano", pts: [[0, 0.3], [1, 0.6]] }
};

/* ---------- Recetas ---------- */

/** Conversión a gris de partida: luminancia perceptual (el mezclador arranca con sus mismos pesos) */
export const DEFAULT_GRAY: GraySettings = { mode: "lum", r: 21.26, g: 71.52, b: 7.22 };

const presetInk = (name: string, color: string, preset: PresetKey): InkData =>
  ({ name, color, preset, points: CURVE_PRESETS[preset].pts });
const withInks = (inks: InkData[]): Recipe => ({ v: 1, gray: { ...DEFAULT_GRAY }, inks });

/** Receta inicial: lo que se usa la primera vez y al restablecer */
export const defaultRecipe = (): Recipe => withInks([presetInk("Negro", "#231f20", "luces"), presetInk("Naranja", "#e3742f", "medios")]);

/** Recetas predeterminadas de la biblioteca (solo lectura) */
export const BUILTIN_RECIPES: { id: string; name: string; recipe: Recipe }[] = [
  { id: "negro-naranja", name: "Negro y naranja", recipe: defaultRecipe() },
  { id: "sepia", name: "Sepia clásico", recipe: withInks([presetInk("Negro", "#231f20", "sombras"), presetInk("Sepia", "#704214", "medios")]) },
  { id: "cianotipo", name: "Cianotipo", recipe: withInks([presetInk("Azul de Prusia", "#1b3a63", "lineal")]) },
  { id: "negro-rojo", name: "Negro y rojo", recipe: withInks([presetInk("Negro", "#231f20", "luces"), presetInk("Rojo", "#c8102e", "medios")]) },
  { id: "azul-magenta", name: "Azul y magenta", recipe: withInks([presetInk("Azul", "#1f4e9c", "lineal"), presetInk("Magenta", "#c4006e", "campana")]) }
];

/** Receta activa la primera vez que se abre la app */
export const DEFAULT_REF: RecipeRef = { kind: "builtin", id: "negro-naranja" };
