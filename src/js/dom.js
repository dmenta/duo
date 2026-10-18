"use strict";
/* Utilidades de DOM.
   Expone: esc, setStatus(texto, "info" | "error"), IS_MAC */

const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Aviso flotante: desaparece solo; los errores quedan más tiempo. Texto vacío lo oculta.
const toastEl = document.getElementById("toast");
let toastTimer = 0;
function setStatus(text, kind = "info") {
  clearTimeout(toastTimer);
  if (!text) { toastEl.classList.remove("on"); return; }
  toastEl.textContent = text;
  toastEl.dataset.kind = kind;
  toastEl.classList.add("on");
  toastTimer = setTimeout(() => toastEl.classList.remove("on"), kind === "error" ? 7000 : 3500);
}

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
