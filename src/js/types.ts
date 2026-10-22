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
  /** Puntos negro y blanco (L* del gris, 0..100): lo más oscuro que black pasa a negro puro, lo más claro que white a blanco */
  black: number;
  white: number;
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

/** Puntos de curva de solo lectura */
export type ReadonlyPoints = readonly (readonly [number, number])[];

/** Datos de una tinta de solo lectura */
export type ReadonlyInkData = Readonly<Omit<InkData, "points">> & { readonly points: ReadonlyPoints };

/** Tinta tal como la expone el documento: se lee acá y se cambia con doc.updateInk */
export type ReadonlyInk = ReadonlyInkData & { readonly id: number };

/** Cambios a una tinta; color2: undefined la vuelve de color fijo */
export type InkChanges = Partial<Omit<InkData, "points">> & { points?: ReadonlyPoints };

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

/* ---------- Avisos de cambio del estado ---------- */

/** Opciones de un cambio: live mientras el gesto sigue (arrastrar, mover un control) */
export interface ChangeOptions { live?: boolean }

/**
 * Qué cambió en el documento. live: el gesto sigue en curso (el historial espera al final).
 * commit: false en "recipe" cuando la receta viene del historial o del arranque.
 */
export type DocChange =
  | { what: "image" }
  | { what: "recipe"; commit: boolean }
  | { what: "active" }
  | { what: "gray"; live: boolean }
  | { what: "inks" }
  | { what: "ink"; id: number; live: boolean };

/** Qué cambió en la vista */
export type ViewChange = { what: "mode" } | { what: "zoom" } | { what: "position" };

/** Receta propia guardada en la biblioteca */
export interface LibraryItem { id: string; name: string; recipe: Recipe; updated: number }

/** Cambió la biblioteca de recetas propias */
export type LibraryChange = { what: "items" };
