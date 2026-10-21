/* Receta (configuración de gris y tintas) e historial de deshacer/rehacer.
   Cada entrada del historial es una copia completa de la receta más cuál receta de la
   biblioteca estaba activa: no hace falta programar la operación inversa de cada comando. */
import { byId } from "./dom.ts";
import { IS_MAC } from "./env.ts";
import { HISTORY_MAX } from "./config.ts";
import { state } from "./state.ts";
import { inkData, makeInk, validRecipe } from "./recipe.ts";
import type { Recipe, RecipeRef } from "./types.ts";
import { scheduleRender } from "./render.ts";
import { renderInks } from "./ui-inks.ts";
import { syncGrayUI } from "./ui-gray.ts";
import { syncRecipeUI } from "./recipes.ts";
import { loadResume, saveResume } from "./storage.ts";

// Receta actual, con claves en orden fijo para poder comparar recetas por su JSON
export function getRecipe(): Recipe {
  const g = state.gray;
  return {
    v: 1,
    gray: { mode: g.mode, r: g.r, g: g.g, b: g.b },
    inks: state.inks.map(inkData)
  };
}

/** Reemplaza la configuración actual por la receta y redibuja todo. */
export function applyRecipe(r: Recipe) {
  const g = r.gray;
  state.gray = { mode: g.mode, r: g.r, g: g.g, b: g.b };
  state.inks = r.inks.map(makeInk);
  syncGrayUI();
  renderInks();
  scheduleRender();  // el gris se recalcula solo si cambió la conversión
}

/* ---------- Punto de retorno ---------- */

const validRef = (a: any): a is RecipeRef | null => a === null || (a && ["builtin", "user"].includes(a.kind) && typeof a.id === "string");

const persist = (entry: HistoryEntry) => saveResume(entry.recipe, entry.active);

/** Receta y activa del punto de retorno, si la receta guardada es válida */
function loadSaved() {
  const { recipe, active } = loadResume();
  if (!validRecipe(recipe)) return null;
  return { recipe, active: validRef(active) ? active : null };
}

/* ---------- Historial ---------- */
type HistoryEntry = { recipe: Recipe, active: RecipeRef | null };

const hist: { stack: HistoryEntry[]; index: number } = { stack: [], index: -1 };
const undoBtn = byId("undoBtn", HTMLButtonElement);
const redoBtn = byId("redoBtn", HTMLButtonElement);

const currentEntry = (): HistoryEntry => ({ recipe: getRecipe(), active: state.active ? { ...state.active } : null });

const sameEntry = (a: HistoryEntry, b: HistoryEntry) => JSON.stringify(a) === JSON.stringify(b);

function syncHistoryUI() {
  undoBtn.disabled = hist.index <= 0;
  redoBtn.disabled = hist.index >= hist.stack.length - 1;
}

// Registrar el estado actual al terminar un gesto. Si nada cambió, no agrega entrada.
export function commitHistory() {
  const e = currentEntry();
  if (hist.index >= 0 && sameEntry(hist.stack[hist.index], e)) { syncRecipeUI(); return; }
  hist.stack.splice(hist.index + 1);
  hist.stack.push(e);
  if (hist.stack.length > HISTORY_MAX) hist.stack.shift();
  hist.index = hist.stack.length - 1;
  persist(e);
  syncHistoryUI();
  syncRecipeUI();
}

// Cambiar la receta activa sin agregar un paso (por ejemplo, al guardar con otro nombre)
export function setActiveRecipe(ref: RecipeRef | null) {
  state.active = ref ? { ...ref } : null;
  if (hist.index >= 0) hist.stack[hist.index] = { ...hist.stack[hist.index], active: state.active };
  persist(currentEntry());
  syncRecipeUI();
}

function restoreCurrent() {
  const e = hist.stack[hist.index];
  state.active = e.active ? { ...e.active } : null;
  applyRecipe(e.recipe);
  persist(e);
  syncHistoryUI();
  syncRecipeUI();
}
function undo() { if (hist.index > 0) { hist.index--; restoreCurrent(); } }
function redo() { if (hist.index < hist.stack.length - 1) { hist.index++; restoreCurrent(); } }

// La primera vez arranca con la receta de fábrica por defecto
export function initHistory(defaultRef: RecipeRef) {
  const saved = loadSaved();
  if (saved) { state.active = saved.active; applyRecipe(saved.recipe); }
  else { state.active = defaultRef; syncGrayUI(); renderInks(); }
  hist.stack = [currentEntry()];
  hist.index = 0;
  syncHistoryUI();
  syncRecipeUI();
}

/* ---------- Controles ---------- */
undoBtn.title = `Deshacer (${IS_MAC ? "⌘Z" : "Ctrl+Z"})`;
redoBtn.title = `Rehacer (${IS_MAC ? "⇧⌘Z" : "Ctrl+Y"})`;
undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

window.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  // En campos de texto, el navegador maneja su propio deshacer
  if (e.target instanceof Element && e.target.closest('input[type="text"], input:not([type]), textarea, [contenteditable]')) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
});
