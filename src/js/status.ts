/* Aviso flotante para el usuario. */
import { byId } from "./dom.ts";

// Aviso flotante: desaparece solo; los errores quedan más tiempo. Texto vacío lo oculta.
const toastEl = byId("toast");
let toastTimer = 0;
/** Texto vacío lo oculta. */
export function setStatus(text: string, kind: "info" | "error" = "info") {
  clearTimeout(toastTimer);
  if (!text) { toastEl.classList.remove("on"); return; }
  toastEl.textContent = text;
  toastEl.dataset.kind = kind;
  toastEl.classList.add("on");
  toastTimer = setTimeout(() => toastEl.classList.remove("on"), kind === "error" ? 7000 : 3500);
}
