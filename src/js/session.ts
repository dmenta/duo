/* Estado de la sesión: vive mientras la pestaña esté abierta.
   - doc: el documento, lo que el usuario edita y exporta.
   - view: cómo se mira el documento. */
import { defaultRecipe } from "./config.ts";
import { inkData, makeInk, normalizeGray, validRecipe } from "./recipe.ts";
import { loadResume, saveResume } from "./storage.ts";
import { Emitter } from "./emitter.ts";
import type { Bitmap, ChangeOptions, DocChange, GraySettings, Ink, InkChanges, ReadonlyInk, Recipe, RecipeRef, ViewChange, ViewMode, ZoomMode } from "./types.ts";

class Doc extends Emitter<DocChange> {
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

  /** Cambia la receta de la biblioteca activa sin tocar la receta en curso */
  setActive(ref: RecipeRef | null) {
    this.#active = ref ? { ...ref } : null;
    this.emit({ what: "active" });
  }

  setImage(image: { full: Bitmap; prev: Bitmap; }, name: string) {
    this.#image = image;
    this.#name = name;
    this.emit({ what: "image" });
  }

  getRecipe(): Recipe {
    return { v: 1, gray: normalizeGray(this.#gray), inks: this.#inks.map(inkData) };
  }

  /**
   * Reemplaza la receta en curso y la activa en un solo paso.
   * commit: false cuando viene del historial o del arranque, que no deben registrar un paso.
   */
  loadRecipe(r: Recipe, active: RecipeRef | null, { commit = true } = {}) {
    this.#setRecipe(r);
    this.#active = active ? { ...active } : null;
    this.emit({ what: "recipe", commit });
  }

  #setRecipe(r: Recipe) {
    this.#gray = normalizeGray(r.gray);
    this.#inks = r.inks.map(makeInk);
  }

  /* ---------- Conversión a gris ---------- */

  setGrayMode(mode: GraySettings["mode"]) {
    this.#gray.mode = mode;
    this.emit({ what: "gray", live: false });
  }

  setGrayWeights(w: Partial<Pick<GraySettings, "r" | "g" | "b">>, { live = false }: ChangeOptions = {}) {
    Object.assign(this.#gray, w);
    this.emit({ what: "gray", live });
  }

  /** Puntos negro y blanco; quien llama cuida que black < white */
  setGrayLevels(levels: Partial<Pick<GraySettings, "black" | "white">>, { live = false }: ChangeOptions = {}) {
    Object.assign(this.#gray, levels);
    this.emit({ what: "gray", live });
  }

  /* ---------- Tintas ---------- */
  // Se cambian en el lugar: quien tiene una tinta de doc.inks la ve actualizada.

  /** Agrega una tinta al principio */
  addInk(ink: Ink) {
    this.#inks.unshift(ink);
    this.emit({ what: "inks" });
  }

  removeInk(id: number) {
    this.#inks = this.#inks.filter(i => i.id !== id);
    this.emit({ what: "inks" });
  }

  updateInk(id: number, changes: InkChanges, { live = false }: ChangeOptions = {}) {
    const ink = this.#inks.find(i => i.id === id);
    if (!ink) return;
    const { points, ...rest } = changes;
    Object.assign(ink, rest);
    if ("color2" in changes && changes.color2 === undefined) delete ink.color2;
    if (points) ink.points = points.map(p => [p[0], p[1]]);
    this.emit({ what: "ink", id, live });
  }

  constructor(r: Recipe) {
    super();
    this.#gray = normalizeGray(r.gray);
    this.#inks = r.inks.map(makeInk);
  }
}
export const doc = new Doc(defaultRecipe());

class View extends Emitter<ViewChange> {
  #mode: ViewMode = "result";
  #zoom: ZoomMode = "fit";
  #x = 0;
  #y = 0;

  get mode() { return this.#mode; }
  get zoom() { return this.#zoom; }
  get x() { return this.#x; }
  get y() { return this.#y; }

  // Solo avisan si el valor cambió: el pintado al 100% ajusta la posición a los bordes de la
  // imagen en cada cuadro, y si avisara igual, quien repinta ante un cambio no terminaría nunca.
  setMode(mode: ViewMode) {
    if (mode === this.#mode) return;
    this.#mode = mode;
    this.emit({ what: "mode" });
  }

  setZoom(mode: ZoomMode) {
    if (mode === this.#zoom) return;
    this.#zoom = mode;
    this.emit({ what: "zoom" });
  }

  setXY(x: number, y: number) {
    if (x === this.#x && y === this.#y) return;
    this.#x = x;
    this.#y = y;
    this.emit({ what: "position" });
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
