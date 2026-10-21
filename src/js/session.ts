/* Estado de la sesión: vive mientras la pestaña esté abierta.
   - doc: el documento, lo que el usuario edita y exporta.
   - view: cómo se mira el documento. */
import { defaultRecipe } from "./config.ts";
import { inkData, makeInk, validRecipe } from "./recipe.ts";
import { loadResume, saveResume } from "./storage.ts";
import type { Bitmap, GraySettings, Ink, Recipe, RecipeRef, ViewMode, ZoomMode } from "./types.ts";

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

/* ---------- Receta del documento ---------- */

/** Receta en curso, con claves en orden fijo para poder comparar recetas por su JSON */
export function getRecipe(): Recipe {
  const g = doc.gray;
  return { v: 1, gray: { mode: g.mode, r: g.r, g: g.g, b: g.b }, inks: doc.inks.map(inkData) };
}

/** Reemplaza la receta en curso (no toca la interfaz) */
export function setRecipe(r: Recipe) {
  const g = r.gray;
  doc.gray = { mode: g.mode, r: g.r, g: g.g, b: g.b };
  doc.inks = r.inks.map(makeInk);
}

/* ---------- Punto de retorno ---------- */
// La receta en curso y la activa se guardan en cada paso para que la app, al abrirse,
// arranque desde la última receta tocada (en cualquier pestaña).

const validRef = (a: any): a is RecipeRef | null => a === null || (a && ["builtin", "user"].includes(a.kind) && typeof a.id === "string");

export const saveResumePoint = () => saveResume(getRecipe(), doc.active);

/** Receta y activa guardadas, si la receta es válida */
export function loadResumePoint() {
  const { recipe, active } = loadResume();
  if (!validRecipe(recipe)) return null;
  return { recipe, active: validRef(active) ? active : null };
}
