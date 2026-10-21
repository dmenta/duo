/* Biblioteca de recetas: predeterminadas (solo lectura) y propias (guardadas en el navegador).
   Exportar e importar en archivos .json. */
import { setStatus, attachMenu, byId, qs } from "./dom.ts";
import { IS_MAC } from "./env.ts";
import { BUILTIN_RECIPES as BUILTIN_DEFS, RECIPE_NAME_MAX } from "./config.ts";
import { doc } from "./session.ts";
import { renderInks } from "./ui-inks.ts";
import { syncGrayUI } from "./ui-gray.ts";
import { inkLUT } from "./process.ts";
import { slug, save } from "./export.ts";
import { askText, askConfirm } from "./dialogs.ts";
import { commitHistory, setActiveRecipe } from "./history.ts";
import { normalizeRecipe, validRecipe } from "./recipe.ts";
import { loadLibraryItems, saveLibraryItems, onLibraryChange } from "./storage.ts";

import type { Recipe, RecipeRef } from "./types.ts";
/** receta propia */
type LibraryItem = { id: string, name: string, recipe: Recipe, updated: number; };
type NamedRecipe = { id: string, name: string, recipe: Recipe; };

/* ---------- Recetas predeterminadas ---------- */

// Normalizadas como cualquier receta: nombres de colores predefinidos y claves en orden fijo
const BUILTIN_RECIPES = BUILTIN_DEFS.map(b => ({ ...b, recipe: normalizeRecipe(b.recipe) }));

/* ---------- Biblioteca propia ---------- */

// Las recetas guardadas se validan y normalizan al leerlas: las inválidas se descartan
const loadLibrary = (): LibraryItem[] => loadLibraryItems()
  .filter((i: any) => i && typeof i.id === "string" && typeof i.name === "string" && validRecipe(i.recipe))
  .map((i: any) => ({ id: i.id, name: i.name.slice(0, RECIPE_NAME_MAX), recipe: normalizeRecipe(i.recipe), updated: i.updated || 0 }));
let library = loadLibrary();
function saveLibrary() {
  if (saveLibraryItems(library)) return true;
  setStatus("No se pudo guardar en el navegador. Exportá la receta a un archivo.", "error");
  return false;
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const findRecipe = (ref: RecipeRef | null): NamedRecipe | null => !ref ? null
  : (ref.kind === "builtin" ? BUILTIN_RECIPES : library).find((r: NamedRecipe) => r.id === ref.id) || null;
/** Receta propia con ese nombre (sin distinguir mayúsculas). */
const findByName = (name: string, exceptId?: string) => library.find(r => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase());

const sameRecipe = (a: Recipe, b: Recipe) => JSON.stringify(a) === JSON.stringify(b);

const byName = (a: { name: string; }, b: { name: string; }) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });
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
  const active = findRecipe(doc.active);
  return { active, dirty: !active || !sameRecipe(doc.getRecipe(), active.recipe), own: !!active && doc.active?.kind === "user" };
}

export function syncRecipeUI() {
  const { active, dirty, own } = recipeStatus();
  recipeName.textContent = active ? active.name : "Receta sin guardar";
  recipeBtn.classList.toggle("dirty", !!active && dirty);
  recipeBtn.classList.toggle("unsaved", !active);
  recipeBtn.title = active ? (dirty ? `${active.name}: cambios sin guardar` : active.name) : "La configuración actual no está guardada";
  recipeStrip.style.background = stripCSS(doc.getRecipe());
  recipeSave.disabled = own && !dirty;
}

const rowTpl = byId("recipeRowTpl", HTMLTemplateElement);
const mineEl = byId("recipesMine"), builtinEl = byId("recipesBuiltin");
const emptyEl = byId("recipesEmpty"), exportAllBtn = byId("recipesExportAll", HTMLButtonElement);

/**
 * Fila de una receta. Las propias llevan además los botones de renombrar y eliminar.
 */
function recipeRow(r: { id: string; name: string; recipe: Recipe; }, kind: RecipeRef["kind"]) {
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

// Lista al abrirse: rehace las filas propias (cambian al guardar, renombrar, eliminar,
// importar o desde otra pestaña) y marca la receta activa
function renderList() {
  mineEl.replaceChildren(...[...library].sort(byName).map(r => recipeRow(r, "user")));
  emptyEl.hidden = library.length > 0;
  exportAllBtn.disabled = !library.length;
  const cur = doc.active;
  for (const b of recipeList.querySelectorAll<HTMLElement>(".ritem"))
    b.setAttribute("aria-checked", String(!!cur && cur.kind === b.dataset.kind && cur.id === b.dataset.id));
}

/**
 * Reemplaza la receta en curso y la activa, y redibuja la interfaz.
 * commit: false cuando viene del historial o del arranque.
 */
export function applyRecipe(r: Recipe, active: RecipeRef | null, options?: { commit?: boolean }) {
  doc.loadRecipe(r, active, options);
  syncGrayUI();
  renderInks();
}

// Aplicar una receta de la biblioteca: es un paso del historial, se puede deshacer
function applyFromLibrary(ref: RecipeRef) {
  const r = findRecipe(ref); if (!r) return;
  applyRecipe(r.recipe, ref);
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
  item.recipe = doc.getRecipe(); item.updated = Date.now();
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
    item.recipe = doc.getRecipe(); item.updated = Date.now();
  } else {
    item = { id: newId(), name, recipe: doc.getRecipe(), updated: Date.now() };
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
  const isActive = !!doc.active && doc.active.kind === "user" && doc.active.id === id;
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

const exportFile = (items: { name: string; recipe: Recipe; }[]) => new Blob([JSON.stringify({
  format: "duotono-recipes", v: 1,
  recipes: items.map(i => ({ name: i.name, ...i.recipe }))
}, null, 2)], { type: "application/json" });

async function exportCurrent() {
  blurField();
  const { active } = recipeStatus();
  const name = active ? active.name : "Receta";
  await save(`receta-${slug(name)}.json`, exportFile([{ name, recipe: doc.getRecipe() }]));
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
onLibraryChange(() => { library = loadLibrary(); syncRecipeUI(); });
