/* Estado de la aplicación y buffers de imagen. */
import { defaultRecipe } from "./config.ts";
import { makeInk } from "./recipe.ts";
import type { Bitmap, GraySettings, Ink, RecipeRef, ViewMode } from "./types.ts";

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

/** Imagen cargada: a resolución de exportación y reducida para la vista previa */
export const buf: { full: Bitmap | null; prev: Bitmap | null } = {
  full: null,       // {w, h, data, hasAlpha} a resolución de exportación
  prev: null        // {w, h, data} reducida para la vista previa
};

/**
 * La imagen cargada, para el código que solo corre cuando hay una (render, zoom, exportar).
 */
export function loadedImage(): { full: Bitmap; prev: Bitmap } {
  const { full, prev } = buf;
  if (!full || !prev) throw new Error("No hay imagen cargada");
  return { full, prev };
}
