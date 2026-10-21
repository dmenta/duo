/* Estado de la sesión: vive mientras la pestaña esté abierta.
   - doc: el documento, lo que el usuario edita y exporta.
   - view: cómo se mira el documento. */
import { defaultRecipe } from "./config.ts";
import { makeInk } from "./recipe.ts";
import type { Bitmap, GraySettings, Ink, RecipeRef, ViewMode, ZoomMode } from "./types.ts";

export const doc: {
  /** Imagen cargada: a resolución de exportación y reducida para la vista previa */
  image: { full: Bitmap; prev: Bitmap } | null;
  name: string;
  gray: GraySettings;
  inks: Ink[];
  /** Receta de la biblioteca en uso */
  active: RecipeRef | null;
} = {
  image: null,
  name: "imagen-de-prueba",
  gray: { ...defaultRecipe().gray },
  inks: defaultRecipe().inks.map(makeInk),
  active: null
};

export const view: {
  mode: ViewMode;
  zoom: ZoomMode;
  /** Al 100%: esquina superior izquierda visible, en píxeles de imagen */
  x: number;
  y: number;
} = { mode: "result", zoom: "fit", x: 0, y: 0 };

/** La imagen cargada, para el código que solo corre cuando hay una (render, zoom, exportar). */
export function loadedImage() {
  if (!doc.image) throw new Error("No hay imagen cargada");
  return doc.image;
}
