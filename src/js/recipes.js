"use strict";
/* Biblioteca de recetas: de fábrica (solo lectura) y propias (guardadas en el navegador).
   Exportar e importar en archivos .json.
   Expone: BUILTIN_RECIPES, DEFAULT_REF, syncRecipeUI
   Usa: state, defaultRecipe, CURVE_PRESETS, getRecipe, applyRecipe, normalizeRecipe, validRecipe,
        commitHistory, setActiveRecipe, inkLUT, setStatus, esc, attachMenu, askText, askConfirm,
        save, slug, IS_MAC */

const LIBRARY_KEY = "duotono:recetas:v1";
const RECIPE_NAME_MAX = 40;

/* ---------- Recetas de fábrica ---------- */
const presetInk = (name, color, preset) => ({ name, color, preset, points: CURVE_PRESETS[preset].pts });
const withInks = inks => ({ v: 1, gray: { mode: "lum", r: 21.26, g: 71.52, b: 7.22 }, inks });
const BUILTIN_RECIPES = [
  { id: "negro-naranja", name: "Negro y naranja", recipe: defaultRecipe() },
  { id: "sepia", name: "Sepia clásico", recipe: withInks([presetInk("Negro", "#231f20", "sombras"), presetInk("Sepia", "#704214", "medios")]) },
  { id: "cianotipo", name: "Cianotipo", recipe: withInks([presetInk("Azul de Prusia", "#1b3a63", "lineal")]) },
  { id: "negro-rojo", name: "Negro y rojo", recipe: withInks([presetInk("Negro", "#231f20", "luces"), presetInk("Rojo", "#c8102e", "medios")]) },
  { id: "azul-magenta", name: "Azul y magenta", recipe: withInks([presetInk("Azul", "#1f4e9c", "lineal"), presetInk("Magenta", "#c4006e", "campana")]) }
].map(b => ({ ...b, recipe: normalizeRecipe(b.recipe) }));
const DEFAULT_REF = { kind: "builtin", id: "negro-naranja" };

/* ---------- Biblioteca propia ---------- */
function loadLibrary() {
  try {
    const d = JSON.parse(localStorage.getItem(LIBRARY_KEY));
    if (!d || d.v !== 1 || !Array.isArray(d.items)) return [];
    return d.items
      .filter(i => i && typeof i.id === "string" && typeof i.name === "string" && validRecipe(i.recipe))
      .map(i => ({ id: i.id, name: i.name.slice(0, RECIPE_NAME_MAX), recipe: normalizeRecipe(i.recipe), updated: i.updated || 0 }));
  } catch { return []; }
}
let library = loadLibrary();
function saveLibrary() {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify({ v: 1, items: library })); return true; }
  catch { setStatus("No se pudo guardar en el navegador. Exportá la receta a un archivo.", "error"); return false; }
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const findRecipe = ref => !ref ? null
  : (ref.kind === "builtin" ? BUILTIN_RECIPES : library).find(r => r.id === ref.id) || null;
const findByName = (name, exceptId) => library.find(r => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase());
const sameRecipe = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byName = (a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });
function uniqueName(base) {
  if (!findByName(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`, name = base.slice(0, RECIPE_NAME_MAX - suffix.length) + suffix;
    if (!findByName(name)) return name;
  }
}

// Tira de muestra: degradé de blanco a negro pasando por las tintas
function stripCSS(recipe) {
  const n = 24, lut = inkLUT(recipe.inks, n), stops = [];
  for (let k = 0; k < n; k++) stops.push(`rgb(${lut[k * 3]},${lut[k * 3 + 1]},${lut[k * 3 + 2]}) ${(k / (n - 1) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg,${stops.join(",")})`;
}

/* ---------- Interfaz ---------- */
const recipeBtn = document.getElementById("recipeBtn");
const recipeName = document.getElementById("recipeName");
const recipeStrip = document.getElementById("recipeStrip");
const recipeList = document.getElementById("recipeList");
const recipeSave = document.getElementById("recipeSave");
const recipeMoreBtn = document.getElementById("recipeMoreBtn");
const recipeMenu = document.getElementById("recipeMenu");
const recipeImport = document.getElementById("recipeImport");
const act = name => recipeMenu.querySelector(`[data-act="${name}"]`);

function recipeStatus() {
  const active = findRecipe(state.active);
  return { active, dirty: !active || !sameRecipe(getRecipe(), active.recipe), own: !!active && state.active.kind === "user" };
}

function syncRecipeUI() {
  const { active, dirty, own } = recipeStatus();
  recipeName.textContent = active ? active.name : "Receta sin guardar";
  recipeBtn.classList.toggle("dirty", !!active && dirty);
  recipeBtn.classList.toggle("unsaved", !active);
  recipeBtn.title = active ? (dirty ? `${active.name}: cambios sin guardar` : active.name) : "La configuración actual no está guardada";
  recipeStrip.style.background = stripCSS(getRecipe());
  recipeSave.disabled = own && !dirty;
  act("rename").disabled = !own;
  act("delete").disabled = !own;
  act("exportall").disabled = library.length === 0;
}

function renderList() {
  const cur = state.active;
  const item = (r, kind) => {
    const on = !!cur && cur.kind === kind && cur.id === r.id;
    return `<button role="menuitemradio" aria-checked="${on}" tabindex="-1" class="ritem" data-kind="${kind}" data-id="${esc(r.id)}">
      <span class="rname">${esc(r.name)}</span><span class="rstrip" style="background:${stripCSS(r.recipe)}"></span></button>`;
  };
  recipeList.innerHTML =
    `<div class="rgroup">De fábrica</div>${BUILTIN_RECIPES.map(r => item(r, "builtin")).join("")}
     <div class="rgroup">Mis recetas</div>` +
    (library.length
      ? [...library].sort(byName).map(r => item(r, "user")).join("")
      : `<p class="rempty">Todavía no guardaste recetas. Usá Guardar o importá un archivo.</p>`);
}

// Aplicar una receta de la biblioteca: es un paso del historial, se puede deshacer
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
  if (el && el.matches && el.matches('input[type="text"]')) el.blur();
}

async function saveRecipe() {
  blurField();
  const { active, dirty, own } = recipeStatus();
  if (!own) return saveRecipeAs();
  if (!dirty) { setStatus("No hay cambios sin guardar."); return; }
  active.recipe = getRecipe(); active.updated = Date.now();
  if (saveLibrary()) setStatus(`Receta «${active.name}» guardada.`);
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

async function renameRecipe() {
  const { active, own } = recipeStatus(); if (!own) return;
  const name = await askText({ title: "Renombrar receta", label: "Nombre", value: active.name, max: RECIPE_NAME_MAX, confirm: "Renombrar" });
  if (!name || name === active.name) return;
  if (findByName(name, active.id)) { setStatus(`Ya existe una receta llamada «${name}».`, "error"); return; }
  active.name = name;
  if (saveLibrary()) setStatus(`Receta renombrada a «${name}».`);
  syncRecipeUI();
}

async function deleteRecipe() {
  const { active, own } = recipeStatus(); if (!own) return;
  const ok = await askConfirm({ title: "Eliminar receta", message: `¿Eliminar «${active.name}»? Esta acción no se puede deshacer, pero la configuración actual queda aplicada.`, confirm: "Eliminar", danger: true });
  if (!ok) return;
  library = library.filter(r => r.id !== active.id);
  if (saveLibrary()) setStatus(`Receta «${active.name}» eliminada.`);
  setActiveRecipe(null);
}

/* ---------- Exportar e importar ---------- */
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
  const file = recipeImport.files[0]; recipeImport.value = "";
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
  if (added === 1) applyFromLibrary({ kind: "user", id: last.id });  // una sola: se aplica
  else syncRecipeUI();
  setStatus(`Se importó ${added === 1 ? `«${last.name}»` : `${added} recetas`}${skipped ? ` (${skipped} no válida${skipped > 1 ? "s" : ""})` : ""}.`);
});

/* ---------- Eventos ---------- */
attachMenu(recipeBtn, recipeList, { onOpen: renderList });
recipeList.addEventListener("click", e => {
  const b = e.target.closest(".ritem");
  if (b) applyFromLibrary({ kind: b.dataset.kind, id: b.dataset.id });
});
attachMenu(recipeMoreBtn, recipeMenu, { onOpen: syncRecipeUI });
const ACTIONS = { saveas: saveRecipeAs, rename: renameRecipe, delete: deleteRecipe, export: exportCurrent, exportall: exportAll, import: () => recipeImport.click() };
recipeMenu.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => ACTIONS[b.dataset.act]()));
recipeSave.addEventListener("click", saveRecipe);
recipeSave.title = `Guardar receta (${IS_MAC ? "⌘S" : "Ctrl+S"})`;

window.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "s") return;
  e.preventDefault();
  if (document.querySelector("dialog[open]")) return;
  e.shiftKey ? saveRecipeAs() : saveRecipe();
});

// Si otra pestaña cambia la biblioteca, mantenerla al día
window.addEventListener("storage", e => { if (e.key === LIBRARY_KEY) { library = loadLibrary(); syncRecipeUI(); } });
