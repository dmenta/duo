/* Historial de deshacer/rehacer.
   Cada entrada del historial es una copia completa de la receta más cuál receta de la
   biblioteca estaba activa: no hace falta programar la operación inversa de cada comando. */
import { byId } from "./dom.ts";
import { IS_MAC } from "./env.ts";
import { HISTORY_MAX } from "./config.ts";
import { doc, saveResumePoint } from "./session.ts";
import type { Recipe, RecipeRef } from "./types.ts";

/* ---------- Historial ---------- */
type HistoryEntry = { recipe: Recipe, active: RecipeRef | null; };

const hist: { stack: HistoryEntry[]; index: number; } = { stack: [], index: -1 };
const undoBtn = byId("undoBtn", HTMLButtonElement);
const redoBtn = byId("redoBtn", HTMLButtonElement);

const currentEntry = (): HistoryEntry => ({ recipe: doc.getRecipe(), active: doc.active ? { ...doc.active } : null });

const sameEntry = (a: HistoryEntry, b: HistoryEntry) => JSON.stringify(a) === JSON.stringify(b);

function syncHistoryUI() {
  undoBtn.disabled = hist.index <= 0;
  redoBtn.disabled = hist.index >= hist.stack.length - 1;
}

// Registrar el estado actual al terminar un gesto. Si nada cambió, no agrega entrada.
function commitHistory() {
  const e = currentEntry();
  if (hist.index >= 0 && sameEntry(hist.stack[hist.index], e)) return;
  hist.stack.splice(hist.index + 1);
  hist.stack.push(e);
  if (hist.stack.length > HISTORY_MAX) hist.stack.shift();
  hist.index = hist.stack.length - 1;
  saveResumePoint();
  syncHistoryUI();
}

// Cambió la receta activa sin cambiar la receta (por ejemplo, al guardar con otro nombre):
// se corrige el paso actual en lugar de agregar uno
function updateActive() {
  if (hist.index >= 0) hist.stack[hist.index] = { ...hist.stack[hist.index], active: doc.active };
  saveResumePoint();
}

function restoreCurrent() {
  const e = hist.stack[hist.index];
  doc.loadRecipe(e.recipe, e.active, { commit: false });
  syncHistoryUI();
}
function undo() { if (hist.index > 0) { hist.index--; restoreCurrent(); } }
function redo() { if (hist.index < hist.stack.length - 1) { hist.index++; restoreCurrent(); } }

/**
 * Arranca el historial con el estado actual como único paso. Desde acá, cada cambio terminado
 * del documento es un paso; los gestos en curso (live) esperan a terminar.
 */
export function initHistory() {
  hist.stack = [currentEntry()];
  hist.index = 0;
  syncHistoryUI();
  doc.subscribe(c => {
    if (c.what === "image" || ("live" in c && c.live)) return;
    if (c.what === "active") updateActive();
    else if (c.what === "recipe" && !c.commit) saveResumePoint();  // deshacer o rehacer
    else commitHistory();
  });
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
