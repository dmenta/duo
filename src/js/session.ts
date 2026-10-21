/* Estado de la sesión: vive mientras la pestaña esté abierta.
   - doc: el documento, lo que el usuario edita y exporta.
   - view: cómo se mira el documento. */
import { defaultRecipe } from "./config.ts";
import { inkData, makeInk, validRecipe } from "./recipe.ts";
import { loadResume, saveResume } from "./storage.ts";
import type { Bitmap, GraySettings, Ink, InkChanges, ReadonlyInk, Recipe, RecipeRef, ViewMode, ZoomMode } from "./types.ts";

class Doc {
  #image: { full: Bitmap; prev: Bitmap; } | null = null;
  #name: string = 'sin imagen';
  #gray: GraySettings;
  #inks: Ink[];
  #active: RecipeRef | null = null;

  get name() { return this.#name; }
  get gray(): Readonly<GraySettings> { return this.#gray; }
  get inks(): readonly ReadonlyInk[] { return this.#inks; }
  get active() { return this.#active; }

  get hasImage() { return this.#image !== null; }

  get fullSize() {
    if (!this.#image) throw new Error("No hay imagen cargada");
    return { w: this.#image.full.w, h: this.#image.full.h };
  }
  get image() {
    if (!this.#image) throw new Error("No hay imagen cargada");
    return this.#image;
  }

  setActive(ref: RecipeRef | null) {
    this.#active = ref ? { ...ref } : null;
  }

  setImage(image: { full: Bitmap; prev: Bitmap; }, name: string) {
    this.#image = image;
    this.#name = name;
  }

  getRecipe(): Recipe {
    return { v: 1, gray: this.#normalizeGray(this.#gray), inks: this.#inks.map(inkData) };
  }

  setRecipe(r: Recipe) {
    this.#gray = this.#normalizeGray(r.gray);
    this.#inks = r.inks.map(makeInk);
  }

  /* ---------- Conversión a gris ---------- */

  setGrayMode(mode: GraySettings["mode"]) { this.#gray.mode = mode; }

  setGrayWeights(w: Partial<Pick<GraySettings, "r" | "g" | "b">>) { Object.assign(this.#gray, w); }

  /* ---------- Tintas ---------- */
  // Se cambian en el lugar: quien tiene una tinta de doc.inks la ve actualizada.

  /** Agrega una tinta al principio */
  addInk(ink: Ink) { this.#inks.unshift(ink); }

  removeInk(id: number) { this.#inks = this.#inks.filter(i => i.id !== id); }

  updateInk(id: number, changes: InkChanges) {
    const ink = this.#inks.find(i => i.id === id);
    if (!ink) return;
    const { points, ...rest } = changes;
    Object.assign(ink, rest);
    if ("color2" in changes && changes.color2 === undefined) delete ink.color2;
    if (points) ink.points = points.map(p => [p[0], p[1]]);
  }

  #normalizeGray(gs: GraySettings) {
    return { mode: gs.mode, r: gs.r, g: gs.g, b: gs.b };
  }

  constructor(r: Recipe) {
    this.#gray = this.#normalizeGray(r.gray);
    this.#inks = r.inks.map(makeInk);
  }
}
export const doc = new Doc(defaultRecipe());

class View {
  #mode: ViewMode = "result";
  #zoom: ZoomMode = "fit";
  #x = 0;
  #y = 0;

  get mode() { return this.#mode; }
  get zoom() { return this.#zoom; }
  get x() { return this.#x; }
  get y() { return this.#y; }

  setMode(mode: ViewMode) { this.#mode = mode; }
  setZoom(mode: ZoomMode) { this.#zoom = mode; }

  setXY(x: number, y: number) {
    this.#x = x;
    this.#y = y;
  }
}
export const view = new View();

/* ---------- Punto de retorno ---------- */
// La receta en curso y la activa se guardan en cada paso para que la app, al abrirse,
// arranque desde la última receta tocada (en cualquier pestaña).

const validRef = (a: any): a is RecipeRef | null => a === null || (a && ["builtin", "user"].includes(a.kind) && typeof a.id === "string");

export const saveResumePoint = () => saveResume(doc.getRecipe(), doc.active);

/** Receta y activa guardadas, si la receta es válida */
export function loadResumePoint() {
  const { recipe, active } = loadResume();
  if (!validRecipe(recipe)) return null;
  return { recipe, active: validRef(active) ? active : null };
}
