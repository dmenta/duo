/* Biblioteca de recetas propias: estado de la app, guardado en el navegador y compartido entre
   pestañas. Los cambios entran por los métodos, que guardan y avisan; cada uno devuelve false
   si el navegador no permitió guardar (el cambio queda igual en memoria). */
import { RECIPE_NAME_MAX } from "./config.ts";
import { Emitter } from "./emitter.ts";
import { normalizeRecipe, validRecipe } from "./recipe.ts";
import { loadLibraryItems, onLibraryChange, saveLibraryItems } from "./storage.ts";
import type { LibraryChange, LibraryItem, Recipe } from "./types.ts";

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Las recetas guardadas se validan y normalizan al leerlas: las inválidas se descartan
const load = (): LibraryItem[] => loadLibraryItems()
  .filter((i: any) => i && typeof i.id === "string" && typeof i.name === "string" && validRecipe(i.recipe))
  .map((i: any) => ({ id: i.id, name: i.name.slice(0, RECIPE_NAME_MAX), recipe: normalizeRecipe(i.recipe), updated: i.updated || 0 }));

class Library extends Emitter<LibraryChange> {
  #items = load();

  get items(): readonly Readonly<LibraryItem>[] { return this.#items; }

  find(id: string): Readonly<LibraryItem> | undefined { return this.#items.find(r => r.id === id); }

  /** Receta propia con ese nombre (sin distinguir mayúsculas) */
  findByName(name: string, exceptId?: string): Readonly<LibraryItem> | undefined {
    return this.#items.find(r => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase());
  }

  /** @returns la receta agregada y si se pudo guardar */
  add(name: string, recipe: Recipe) {
    const item = { id: newId(), name, recipe, updated: Date.now() };
    this.#items.push(item);
    return { item, saved: this.#changed() };
  }

  /** Varias recetas con un solo guardado y un solo aviso (importar) */
  addMany(entries: { name: string; recipe: Recipe }[]) {
    const items = entries.map(e => ({ id: newId(), name: e.name, recipe: e.recipe, updated: Date.now() }));
    this.#items.push(...items);
    return { items, saved: this.#changed() };
  }

  /** Reemplaza la receta guardada (guardar sobre una existente) */
  update(id: string, recipe: Recipe) {
    const item = this.#items.find(r => r.id === id);
    if (!item) return false;
    item.recipe = recipe; item.updated = Date.now();
    return this.#changed();
  }

  rename(id: string, name: string) {
    const item = this.#items.find(r => r.id === id);
    if (!item) return false;
    item.name = name;
    return this.#changed();
  }

  remove(id: string) {
    this.#items = this.#items.filter(r => r.id !== id);
    return this.#changed();
  }

  /** Guarda en el navegador y avisa */
  #changed() {
    const saved = saveLibraryItems(this.#items);
    this.emit({ what: "items" });
    return saved;
  }

  constructor() {
    super();
    // Otra pestaña cambió la biblioteca: se vuelve a leer
    onLibraryChange(() => { this.#items = load(); this.emit({ what: "items" }); });
  }
}
export const library = new Library();
