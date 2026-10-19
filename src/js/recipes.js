/* Biblioteca de recetas: predeterminadas (solo lectura) y propias (guardadas en el navegador).
   Exportar e importar en archivos .json. */
import { setStatus, IS_MAC, attachMenu, byId, qs } from "./dom.js";
import { CURVE_PRESETS } from "./curves.js";
import { defaultRecipe, state } from "./state.js";
import { inkLUT } from "./process.js";
import { slug, save } from "./export.js";
import { askText, askConfirm } from "./dialogs.js";
import { getRecipe, normalizeRecipe, applyRecipe, validRecipe, commitHistory, setActiveRecipe } from "./history.js";


/** @import { InkData, PresetKey, Recipe, RecipeRef } from "./state.js" */
/** @typedef {{ id: string, name: string, recipe: Recipe, updated: number }} LibraryItem  receta propia */
/** @typedef {{ id: string, name: string, recipe: Recipe }} NamedRecipe */

const LIBRARY_KEY = "duotono:recetas:v1";
const RECIPE_NAME_MAX = 40;

/* ---------- Recetas predeterminadas ---------- */
/** @param {string} name @param {string} color @param {PresetKey} preset @returns {InkData} */
const presetInk = (name, color, preset) => ({ name, color, preset, points: CURVE_PRESETS[preset].pts });
/** @param {InkData[]} inks @returns {Recipe} */
const withInks = inks => ({ v: 1, gray: { mode: "lum", r: 21.26, g: 71.52, b: 7.22 }, inks });
const BUILTIN_RECIPES = [
  { id: "negro-naranja", name: "Negro y naranja", recipe: defaultRecipe() },
  { id: "sepia", name: "Sepia clásico", recipe: withInks([presetInk("Negro", "#231f20", "sombras"), presetInk("Sepia", "#704214", "medios")]) },
  { id: "cianotipo", name: "Cianotipo", recipe: withInks([presetInk("Azul de Prusia", "#1b3a63", "lineal")]) },
  { id: "negro-rojo", name: "Negro y rojo", recipe: withInks([presetInk("Negro", "#231f20", "luces"), presetInk("Rojo", "#c8102e", "medios")]) },
  { id: "azul-magenta", name: "Azul y magenta", recipe: withInks([presetInk("Azul", "#1f4e9c", "lineal"), presetInk("Magenta", "#c4006e", "campana")]) }
].map(b => ({ ...b, recipe: normalizeRecipe(b.recipe) }));
/** @type {RecipeRef} */
export const DEFAULT_REF = { kind: "builtin", id: "negro-naranja" };

/* ---------- Biblioteca propia ---------- */
/** @returns {LibraryItem[]} */
function loadLibrary() {
  try {
    const d = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? "null");
    if (!d || d.v !== 1 || !Array.isArray(d.items)) return [];
    return d.items
      .filter((/** @type {any} */ i) => i && typeof i.id === "string" && typeof i.name === "string" && validRecipe(i.recipe))
      .map((/** @type {any} */ i) => ({ id: i.id, name: i.name.slice(0, RECIPE_NAME_MAX), recipe: normalizeRecipe(i.recipe), updated: i.updated || 0 }));
  } catch { return []; }
}
let library = loadLibrary();
function saveLibrary() {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify({ v: 1, items: library })); return true; }
  catch { setStatus("No se pudo guardar en el navegador. Exportá la receta a un archivo.", "error"); return false; }
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
/** @param {RecipeRef | null} ref @returns {NamedRecipe | null} */
const findRecipe = ref => !ref ? null
  : (ref.kind === "builtin" ? BUILTIN_RECIPES : library).find((/** @type {NamedRecipe} */ r) => r.id === ref.id) || null;
/** Receta propia con ese nombre (sin distinguir mayúsculas). @param {string} name @param {string} [exceptId] */
const findByName = (name, exceptId) => library.find(r => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase());
/** @param {Recipe} a @param {Recipe} b */
const sameRecipe = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** @param {{ name: string }} a @param {{ name: string }} b */
const byName = (a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });
/** base, o base (2), base (3)… si ya existe @param {string} base */
function uniqueName(base) {
  if (!findByName(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`, name = base.slice(0, RECIPE_NAME_MAX - suffix.length) + suffix;
    if (!findByName(name)) return name;
  }
}

// Tira de muestra: degradé de blanco a negro pasando por las tintas
/** @param {Recipe} recipe */
function stripCSS(recipe) {
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
 * @param {{ id: string, name: string, recipe: Recipe }} r
 * @param {RecipeRef["kind"]} kind
 */
function recipeRow(r, kind) {
  const row = qs(/** @type {DocumentFragment} */ (rowTpl.content.cloneNode(true)), ".rrow");
  const cur = state.active, on = !!cur && cur.kind === kind && cur.id === r.id;
  const main = qs(row, ".ritem", HTMLButtonElement);
  main.setAttribute("aria-checked", String(on));
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

// Lista: propias y predeterminadas; las propias se renombran o eliminan desde acá
function renderList() {
  mineEl.replaceChildren(...[...library].sort(byName).map(r => recipeRow(r, "user")));
  builtinEl.replaceChildren(...BUILTIN_RECIPES.map(r => recipeRow(r, "builtin")));
  emptyEl.hidden = library.length > 0;
  exportAllBtn.disabled = !library.length;
}

// Aplicar una receta de la biblioteca: es un paso del historial, se puede deshacer
/** @param {RecipeRef} ref */
function applyFromLibrary(ref) {
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
  const item = /** @type {LibraryItem} */ (active);  // propia: viene de la biblioteca
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

/** @param {string} id */
async function renameRecipe(id) {
  const item = library.find(r => r.id === id); if (!item) return;
  const name = await askText({ title: "Renombrar receta", label: "Nombre", value: item.name, max: RECIPE_NAME_MAX, confirm: "Renombrar" });
  if (!name || name === item.name) return;
  if (findByName(name, item.id)) { setStatus(`Ya existe una receta llamada «${name}».`, "error"); return; }
  item.name = name;
  if (saveLibrary()) setStatus(`Receta renombrada a «${name}».`);
  syncRecipeUI();
}

/** @param {string} id */
async function deleteRecipe(id) {
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
/** @param {{ name: string, recipe: Recipe }[]} items */
const exportFile = items => new Blob([JSON.stringify({
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
/** Acciones de la lista según data-op; las de una receta reciben su id @type {Record<string, (id: string) => void>} */
const LIST_OPS = { rename: renameRecipe, delete: deleteRecipe, import: () => recipeImport.click(), exportall: exportAll };
recipeList.addEventListener("click", e => {
  const op = /** @type {HTMLElement} */ (/** @type {Element} */ (e.target).closest("[data-op]"));
  if (op) { LIST_OPS[op.dataset.op ?? ""]?.(op.dataset.id ?? ""); return; }
  const b = /** @type {HTMLElement} */ (/** @type {Element} */ (e.target).closest(".ritem"));
  if (b) applyFromLibrary({ kind: /** @type {RecipeRef["kind"]} */ (b.dataset.kind), id: b.dataset.id ?? "" });
});

attachMenu(saveMenuBtn, saveMenu);
/** @type {Record<string, () => void>} */
const SAVE_OPS = { saveas: saveRecipeAs, export: exportCurrent };
saveMenu.querySelectorAll(/** @type {"button"} */ ("[data-act]")).forEach(b => b.addEventListener("click", () => SAVE_OPS[b.dataset.act ?? ""]?.()));
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
