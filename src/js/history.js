"use strict";
/* Receta (configuración de gris y tintas), historial de deshacer/rehacer y guardado local.
   Cada entrada del historial es una copia completa de la receta: no hace falta
   programar la operación inversa de cada comando.
   Expone: getRecipe, applyRecipe, commitHistory, undo, redo, resetRecipe, initHistory
   Usa: state, makeInk, defaultRecipe, CURVE_PRESETS, MAX_INKS, renderInks, syncGrayUI, recomputeGray */

const STORAGE_KEY = "duotono:receta:v1";
const HISTORY_MAX = 100;

function getRecipe() {
  return {
    v: 1,
    gray: { ...state.gray },
    inks: state.inks.map(({ name, color, preset, points }) => ({ name, color, preset, points: points.map(p => p.slice()) }))
  };
}

function applyRecipe(r) {
  state.gray = { ...r.gray };
  state.inks = r.inks.map(makeInk);
  syncGrayUI();
  renderInks();
  recomputeGray();
}

// Comprueba que una receta (por ejemplo, la guardada) tenga una forma válida
function validRecipe(r) {
  try {
    const isHex = c => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
    const g = r && r.gray;
    if (!r || r.v !== 1 || !g || !["lum", "mix"].includes(g.mode) || ![g.r, g.g, g.b].every(Number.isFinite)) return false;
    if (!Array.isArray(r.inks) || r.inks.length < 1 || r.inks.length > MAX_INKS) return false;
    return r.inks.every(i =>
      typeof i.name === "string" && isHex(i.color) &&
      (i.preset === "custom" || Object.hasOwn(CURVE_PRESETS, i.preset)) &&
      Array.isArray(i.points) && i.points.length >= 2 &&
      i.points[0][0] === 0 && i.points[i.points.length - 1][0] === 1 &&
      i.points.every((p, k, a) => Array.isArray(p) && p.length === 2 &&
        p.every(v => Number.isFinite(v) && v >= 0 && v <= 1) && (k === 0 || p[0] > a[k - 1][0])));
  } catch { return false; }
}

/* ---------- Guardado local ---------- */
function persist(r) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento: se sigue sin guardar */ }
}
function loadSaved() {
  try { const r = JSON.parse(localStorage.getItem(STORAGE_KEY)); return validRecipe(r) ? r : null; }
  catch { return null; }
}

/* ---------- Historial ---------- */
const hist = { stack: [], index: -1 };
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

function syncHistoryUI() {
  undoBtn.disabled = hist.index <= 0;
  redoBtn.disabled = hist.index >= hist.stack.length - 1;
}

// Registrar el estado actual al terminar un gesto. Si nada cambió, no agrega entrada.
function commitHistory() {
  const r = getRecipe();
  if (hist.index >= 0 && JSON.stringify(hist.stack[hist.index]) === JSON.stringify(r)) return;
  hist.stack.splice(hist.index + 1);
  hist.stack.push(r);
  if (hist.stack.length > HISTORY_MAX) hist.stack.shift();
  hist.index = hist.stack.length - 1;
  persist(r);
  syncHistoryUI();
}

function restoreCurrent() {
  const r = hist.stack[hist.index];
  applyRecipe(r);
  persist(r);
  syncHistoryUI();
}
function undo() { if (hist.index > 0) { hist.index--; restoreCurrent(); } }
function redo() { if (hist.index < hist.stack.length - 1) { hist.index++; restoreCurrent(); } }
function resetRecipe() { applyRecipe(defaultRecipe()); commitHistory(); }

function initHistory() {
  const saved = loadSaved();
  if (saved) applyRecipe(saved);
  else { syncGrayUI(); renderInks(); }
  hist.stack = [getRecipe()];
  hist.index = 0;
  syncHistoryUI();
}

/* ---------- Controles ---------- */
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
undoBtn.title = `Deshacer (${isMac ? "⌘Z" : "Ctrl+Z"})`;
redoBtn.title = `Rehacer (${isMac ? "⇧⌘Z" : "Ctrl+Y"})`;
undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);
document.getElementById("resetBtn").addEventListener("click", resetRecipe);

window.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  // En campos de texto, el navegador maneja su propio deshacer
  if (e.target.closest && e.target.closest('input[type="text"], input:not([type]), textarea, [contenteditable]')) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
});
