/* Biblioteca de recetas: predeterminadas (solo lectura) y propias (guardadas en el navegador).
   Exportar e importar en archivos .json. */
import { setStatus, IS_MAC, attachMenu, byId, qs } from "./dom.ts";
import { CURVE_PRESETS } from "./curves.ts";
import { defaultRecipe, state } from "./state.ts";
import { inkLUT } from "./process.ts";
import { slug, save } from "./export.ts";
import { askText, askConfirm } from "./dialogs.ts";
import { getRecipe, normalizeRecipe, applyRecipe, validRecipe, commitHistory, setActiveRecipe } from "./history.ts";

import type { InkData, PresetKey, Recipe, RecipeRef } from "./state.ts";
/** receta propia */
type LibraryItem = { id: string, name: string, recipe: Recipe, updated: number };
type NamedRecipe = { id: string, name: string, recipe: Recipe };

const LIBRARY_KEY = "duotono:recetas:v1";
const RECIPE_NAME_MAX = 40;

/* ---------- Recetas predeterminadas ---------- */

const presetInk = (name: string, color: string, preset: PresetKey): InkData => ({ name, color, preset, points: CURVE_PRESETS[preset].pts });

const withInks = (inks: InkData[]): Recipe => ({ v: 1, gray: { mode: "lum", r: 21.26, g: 71.52, b: 7.22 }, inks });
const BUILTIN_RECIPES = [
  { id: "negro-naranja", name: "Negro y naranja", recipe: defaultRecipe() },
  { id: "sepia", name: "Sepia clásico", recipe: withInks([presetInk("Negro", "#231f20", "sombras"), presetInk("Sepia", "#704214", "medios")]) },
  { id: "cianotipo", name: "Cianotipo", recipe: withInks([presetInk("Azul de Prusia", "#1b3a63", "lineal")]) },
  { id: "negro-rojo", name: "Negro y rojo", recipe: withInks([presetInk("Negro", "#231f20", "luces"), presetInk("Rojo", "#c8102e", "medios")]) },
  { id: "azul-magenta", name: "Azul y magenta", recipe: withInks([presetInk("Azul", "#1f4e9c", "lineal"), presetInk("Magenta", "#c4006e", "campana")]) }
].map(b => ({ ...b, recipe: normalizeRecipe(b.recipe) }));

export const DEFAULT_REF: RecipeRef = { kind: "builtin", id: "negro-naranja" };

/* ---------- Biblioteca propia ---------- */

function loadLibrary(): LibraryItem[] {
  try {
    const d = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? "null");
    if (!d || d.v !== 1 || !Array.isArray(d.items)) return [];
    return d.items
      .filter((i: any) => i && typeof i.id === "string" && typeof i.name === "string" && validRecipe(i.recipe))
      .map((i: any) => ({ id: i.id, name: i.name.slice(0, RECIPE_NAME_MAX), recipe: normalizeRecipe(i.recipe), updated: i.updated || 0 }));
  } catch { return []; }
}
let library = loadLibrary();
function saveLibrary() {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify({ v: 1, items: library })); return true; }
  catch { setStatus("No se pudo guardar en el navegador. Exportá la receta a un archivo.", "error"); return false; }
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const findRecipe = (ref: RecipeRef | null): NamedRecipe | null => !ref ? null
  : (ref.kind === "builtin" ? BUILTIN_RECIPES : library).find((r: NamedRecipe) => r.id === ref.id) || null;
/** Receta propia con ese nombre (sin distinguir mayúsculas). */
const findByName = (name: string, exceptId?: string) => library.find(r => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase());

const sameRecipe = (a: Recipe, b: Recipe) => JSON.stringify(a) === JSON.stringify(b);

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });
/** base, o base (2), base (3)… si ya existe */
function uniqueName(base: string) {
  if (!findByName(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`, name = base.slice(0, RECIPE_NAME_MAX - suffix.length) + suffix;
    if (!findByName(name)) return name;
  }
}

// Tira de muestra: degradé de blanco a negro pasando por las tintas
function stripCSS(recipe: Recipe) {
  const n = 24, lut = inkLUT(recipe.inks, n), stops = [];
  for (let k = 0; k < n; k++) stops.push(`rgb(${lut[k * 3]},${lut[k * 3 + 1]},${lut[k * 3 + 2]}) ${(k / (n - 1) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg,${stops.join(",")})`;
}

/* ---------- Interfaz ---------- */
const recipeBtn = byId("recipeBtn", HTMLButtonElement);
const recipeName = byId("recipeName");
const recipeStrip = byId("recipeStrip");
const recipeList = byId("recipeList");
const recipeSave = byId("recipeSave", HTMLButtonElement);
const saveMenuBtn = byId("saveMenuBtn", HTMLButtonElement);
const saveMenu = byId("saveMenu");
const recipeImport = byId("recipeImport", HTMLInputElement);

function recipeStatus() {
  const active = findRecipe(state.active);
  return { active, dirty: !active || !sameRecipe(getRecipe(), active.recipe), own: !!active && state.active?.kind === "user" };
}

export function syncRecipeUI() {
  const { active, dirty, own } = recipeStatus();
  recipeName.textContent = active ? active.name : "Receta sin guardar";
  recipeBtn.classList.toggle("dirty", !!active && dirty);
  recipeBtn.classList.toggle("unsaved", !active);
  recipeBtn.title = active ? (dirty ? `${active.name}: cambios sin guardar` : active.name) : "La configuración actual no está guardada";
  recipeStrip.style.background = stripCSS(getRecipe());
  recipeSave.disabled = own && !dirty;
}

const rowTpl = byId("recipeRowTpl", HTMLTemplateElement);
const mineEl = byId("recipesMine"), builtinEl = byId("recipesBuiltin");
const emptyEl = byId("recipesEmpty"), exportAllBtn = byId("recipesExportAll", HTMLButtonElement);

/**
 * Fila de una receta. Las propias llevan además los botones de renombrar y eliminar.
 */
function recipeRow(r: { id: string; name: string; recipe: Recipe }, kind: RecipeRef["kind"]) {
  const row = qs(rowTpl.content.cloneNode(true) as DocumentFragment, ".rrow");
  const main = qs(row, ".ritem", HTMLButtonElement);
  main.dataset.kind = kind; main.dataset.id = r.id;
  qs(row, ".rname").textContent = r.name;
  qs(row, ".rstrip").style.background = stripCSS(r.recipe);
  const icons = qs(row, ".ricons");
  if (kind === "builtin") icons.remove();
  else for (const b of icons.querySelectorAll("button")) {
    b.dataset.id = r.id;
    b.setAttribute("aria-label", `${b.title} ${r.name}`);
  }
  return row;
}

// Las predeterminadas no cambian: sus filas se arman una sola vez
builtinEl.replaceChildren(...BUILTIN_RECIPES.map(r => recipeRow(r, "builtin")));

// Las propias cambian al guardar, renombrar, eliminar, importar o desde otra pestaña.
// En vez de avisar en cada caso, se compara la biblioteca con la de las filas actuales.
let shownLibrary = "";

// Lista al abrirse: rehace las filas propias solo si cambió la biblioteca y marca la activa
function renderList() {
  const now = JSON.stringify(library);
  if (now !== shownLibrary) {
    mineEl.replaceChildren(...[...library].sort(byName).map(r => recipeRow(r, "user")));
    emptyEl.hidden = library.length > 0;
    exportAllBtn.disabled = !library.length;
    shownLibrary = now;
  }
  const cur = state.active;
  for (const b of recipeList.querySelectorAll<HTMLElement>(".ritem"))
    b.setAttribute("aria-checked", String(!!cur && cur.kind === b.dataset.kind && cur.id === b.dataset.id));
}

// Aplicar una receta de la biblioteca: es un paso del historial, se puede deshacer
function applyFromLibrary(ref: RecipeRef) {
  const r = findRecipe(ref); if (!r) return;
  state.active = { ...ref };
  applyRecipe(r.recipe);
  commitHistory();
}

/* ---------- Acciones ---------- */
function blurField() {
  // Confirma una edición de texto en curso (nombre o color) antes de guardar
  const el = document.activeElement;
  if (el instanceof HTMLInputElement && el.type === "text") el.blur();
}

async function saveRecipe() {
  blurField();
  const { active, dirty, own } = recipeStatus();
  if (!own || !active) return saveRecipeAs();
  if (!dirty) { setStatus("No hay cambios sin guardar."); return; }
  const item = active as LibraryItem;  // propia: viene de la biblioteca
  item.recipe = getRecipe(); item.updated = Date.now();
  if (saveLibrary()) setStatus(`Receta «${item.name}» guardada.`);
  syncRecipeUI();
}

async function saveRecipeAs() {
  blurField();
  const { active } = recipeStatus();
  const suggested = active ? `${active.name} (copia)`.slice(0, RECIPE_NAME_MAX) : "Mi receta";
  const name = await askText({ title: "Guardar receta", label: "Nombre", value: suggested, max: RECIPE_NAME_MAX, confirm: "Guardar" });
  if (!name) return;
  let item = findByName(name);
  if (item) {
    const ok = await askConfirm({ title: "Ya existe una receta con ese nombre", message: `¿Reemplazar «${item.name}» con la configuración actual?`, confirm: "Reemplazar" });
    if (!ok) return;
    item.recipe = getRecipe(); item.updated = Date.now();
  } else {
    item = { id: newId(), name, recipe: getRecipe(), updated: Date.now() };
    library.push(item);
  }
  if (saveLibrary()) { setActiveRecipe({ kind: "user", id: item.id }); setStatus(`Receta «${item.name}» guardada.`); }
}

async function renameRecipe(id: string) {
  const item = library.find(r => r.id === id); if (!item) return;
  const name = await askText({ title: "Renombrar receta", label: "Nombre", value: item.name, max: RECIPE_NAME_MAX, confirm: "Renombrar" });
  if (!name || name === item.name) return;
  if (findByName(name, item.id)) { setStatus(`Ya existe una receta llamada «${name}».`, "error"); return; }
  item.name = name;
  if (saveLibrary()) setStatus(`Receta renombrada a «${name}».`);
  syncRecipeUI();
}

async function deleteRecipe(id: string) {
  const item = library.find(r => r.id === id); if (!item) return;
  const isActive = !!state.active && state.active.kind === "user" && state.active.id === id;
  const ok = await askConfirm({
    title: "Eliminar receta",
    message: `¿Eliminar «${item.name}»? Esta acción no se puede deshacer.${isActive ? " La configuración actual queda aplicada." : ""}`,
    confirm: "Eliminar", danger: true
  });
  if (!ok) return;
  library = library.filter(r => r.id !== id);
  if (saveLibrary()) setStatus(`Receta «${item.name}» eliminada.`);
  if (isActive) setActiveRecipe(null); else syncRecipeUI();
}

/* ---------- Exportar e importar ---------- */

const exportFile = (items: { name: string; recipe: Recipe }[]) => new Blob([JSON.stringify({
  format: "duotono-recipes", v: 1,
  recipes: items.map(i => ({ name: i.name, ...i.recipe }))
}, null, 2)], { type: "application/json" });

async function exportCurrent() {
  blurField();
  const { active } = recipeStatus();
  const name = active ? active.name : "Receta";
  await save(`receta-${slug(name)}.json`, exportFile([{ name, recipe: getRecipe() }]));
}
async function exportAll() {
  if (!library.length) return;
  await save("recetas-duotono.json", exportFile([...library].sort(byName)));
}

recipeImport.addEventListener("change", async () => {
  const file = recipeImport.files?.[0]; recipeImport.value = "";
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); }
  catch { setStatus("El archivo no es un JSON válido.", "error"); return; }
  // Acepta el formato exportado, una lista de recetas o una receta suelta
  const list = Array.isArray(data) ? data : Array.isArray(data && data.recipes) ? data.recipes : [data];
  let added = 0, skipped = 0, last = null;
  for (const r of list) {
    const rec = r && { v: 1, gray: r.gray, inks: r.inks };
    if (!rec || !validRecipe(rec)) { skipped++; continue; }
    const base = (typeof r.name === "string" && r.name.trim() ? r.name.trim() : "Receta importada").slice(0, RECIPE_NAME_MAX);
    last = { id: newId(), name: uniqueName(base), recipe: normalizeRecipe(rec), updated: Date.now() };
    library.push(last); added++;
  }
  if (!added) { setStatus("No se encontraron recetas válidas en el archivo.", "error"); return; }
  if (!saveLibrary()) return;
  if (added === 1 && last) applyFromLibrary({ kind: "user", id: last.id });  // una sola: se aplica
  else syncRecipeUI();
  setStatus(`Se importó ${added === 1 && last ? `«${last.name}»` : `${added} recetas`}${skipped ? ` (${skipped} no válida${skipped > 1 ? "s" : ""})` : ""}.`);
});

/* ---------- Eventos ---------- */
attachMenu(recipeBtn, recipeList, { onOpen: renderList });
/** Acciones de la lista según data-op; las de una receta reciben su id */
const LIST_OPS: Record<string, (id: string) => void> = { rename: renameRecipe, delete: deleteRecipe, import: () => recipeImport.click(), exportall: exportAll };
recipeList.addEventListener("click", e => {
  const op = (e.target as Element).closest("[data-op]") as HTMLElement;
  if (op) { LIST_OPS[op.dataset.op ?? ""]?.(op.dataset.id ?? ""); return; }
  const b = (e.target as Element).closest(".ritem") as HTMLElement;
  if (b) applyFromLibrary({ kind: (b.dataset.kind as RecipeRef["kind"]), id: b.dataset.id ?? "" });
});

attachMenu(saveMenuBtn, saveMenu);

const SAVE_OPS: Record<string, () => void> = { saveas: saveRecipeAs, export: exportCurrent };
saveMenu.querySelectorAll<HTMLButtonElement>("[data-act]").forEach(b => b.addEventListener("click", () => SAVE_OPS[b.dataset.act ?? ""]?.()));
recipeSave.addEventListener("click", saveRecipe);
recipeSave.title = `Guardar receta (${IS_MAC ? "⌘S" : "Ctrl+S"})`;
byId("saveAsHint").textContent = IS_MAC ? "⇧⌘S" : "Ctrl+Shift+S";

window.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "s") return;
  e.preventDefault();
  if (document.querySelector("dialog[open]")) return;
  e.shiftKey ? saveRecipeAs() : saveRecipe();
});

// Si otra pestaña cambia la biblioteca, mantenerla al día
window.addEventListener("storage", e => { if (e.key === LIBRARY_KEY) { library = loadLibrary(); syncRecipeUI(); } });
