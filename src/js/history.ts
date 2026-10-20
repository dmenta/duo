import type { InkData, Point, Recipe, RecipeRef } from "./state.ts";
/* Receta (configuración de gris y tintas), historial de deshacer/rehacer y guardado local.
   Cada entrada del historial es una copia completa de la receta más cuál receta de la
   biblioteca estaba activa: no hace falta programar la operación inversa de cada comando. */
import { IS_MAC, byId } from "./dom.ts";
import { CURVE_PRESETS } from "./curves.ts";
import { MAX_INKS, makeInk, state } from "./state.ts";
import { recomputeGray } from "./loader.ts";
import { renderInks } from "./ui-inks.ts";
import { syncGrayUI } from "./ui-gray.ts";
import { syncRecipeUI } from "./recipes.ts";

const STORAGE_KEY = "duotono:receta:v1";   // última receta en uso
const ACTIVE_KEY = "duotono:activa:v1";    // receta de la biblioteca activa
const HISTORY_MAX = 100;

// Datos de una tinta para la receta, con claves en orden fijo (color2 solo si es degradé)
const inkData = ({ name, color, color2, preset, points }: InkData): InkData =>
  color2 ? { name, color, color2, preset, points: points.map(p => (p.slice() as Point)) }
         : { name, color, preset, points: points.map(p => (p.slice() as Point)) };

// Receta actual, con claves en orden fijo para poder comparar recetas por su JSON
export function getRecipe(): Recipe {
  const g = state.gray;
  return {
    v: 1,
    gray: { mode: g.mode, r: g.r, g: g.g, b: g.b },
    inks: state.inks.map(inkData)
  };
}

// Receta de cualquier origen -> misma forma que getRecipe (nombres y colores normalizados)
export function normalizeRecipe(r: Recipe): Recipe {
  const g = r.gray;
  return {
    v: 1,
    gray: { mode: g.mode, r: g.r, g: g.g, b: g.b },
    inks: r.inks.map(makeInk).map(inkData)
  };
}

/** Reemplaza la configuración actual por la receta y redibuja todo. */
export function applyRecipe(r: Recipe) {
  const g = r.gray;
  state.gray = { mode: g.mode, r: g.r, g: g.g, b: g.b };
  state.inks = r.inks.map(makeInk);
  syncGrayUI();
  renderInks();
  recomputeGray();
}

/**
 * Comprueba que una receta (guardada, importada…) tenga una forma válida
 * @param r datos de origen desconocido
 */
export function validRecipe(r: any): r is Recipe {
  try {

    const isHex = (c: unknown) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
    const g = r && r.gray;
    if (!r || r.v !== 1 || !g || !["lum", "mix"].includes(g.mode) || ![g.r, g.g, g.b].every(Number.isFinite)) return false;
    if (!Array.isArray(r.inks) || r.inks.length < 1 || r.inks.length > MAX_INKS) return false;
    return r.inks.every((i: any) =>
      typeof i.name === "string" && isHex(i.color) && (i.color2 === undefined || isHex(i.color2)) &&
      (i.preset === "custom" || Object.hasOwn(CURVE_PRESETS, i.preset)) &&
      Array.isArray(i.points) && i.points.length >= 2 &&
      i.points[0][0] === 0 && i.points[i.points.length - 1][0] === 1 &&
      i.points.every((p: any, k: number, a: any[]) => Array.isArray(p) && p.length === 2 &&
        p.every((v: any) => Number.isFinite(v) && v >= 0 && v <= 1) && (k === 0 || p[0] > a[k - 1][0])));
  } catch { return false; }
}

/* ---------- Guardado local ---------- */

const validRef = (a: any): a is RecipeRef | null => a === null || (a && ["builtin", "user"].includes(a.kind) && typeof a.id === "string");

function persist(entry: HistoryEntry) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry.recipe));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(entry.active));
  } catch { /* sin almacenamiento: se sigue sin guardar */ }
}
function loadSaved() {
  try {
    const recipe = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!validRecipe(recipe)) return null;
    const raw = localStorage.getItem(ACTIVE_KEY);
    const active = raw === null ? null : JSON.parse(raw);
    return { recipe, active: validRef(active) ? active : null };
  } catch { return null; }
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
