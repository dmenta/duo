/* Tipos compartidos de la app: recetas, tintas, imagen y vista. */
import type { CURVE_PRESETS } from "./config.ts";

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

/** Ajustar a la vista o tamaño real (1 píxel de imagen = 1 píxel CSS) */
export type ZoomMode = "fit" | "actual";

/** Píxeles RGBA de una imagen cargada. */
export interface Bitmap {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  hasAlpha: boolean;
}
