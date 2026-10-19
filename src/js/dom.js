/* Utilidades de DOM. */

export const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Elemento por id, con el tipo esperado. Falla enseguida si no existe o es de otro tipo,
 * en vez de dar un error confuso más adelante.
 * @template {HTMLElement} [T=HTMLElement]
 * @param {string} id
 * @param {{ new (): T }} [type]  p. ej. HTMLInputElement
 * @returns {T}
 */
export function byId(id, type) {
  const el = document.getElementById(id);
  if (!(el instanceof (type ?? HTMLElement))) throw new Error(`#${id}: no existe o no es ${(type ?? HTMLElement).name}`);
  return /** @type {T} */ (el);
}

// Aviso flotante: desaparece solo; los errores quedan más tiempo. Texto vacío lo oculta.
const toastEl = byId("toast");
let toastTimer = 0;
export function setStatus(text, kind = "info") {
  clearTimeout(toastTimer);
  if (!text) { toastEl.classList.remove("on"); return; }
  toastEl.textContent = text;
  toastEl.dataset.kind = kind;
  toastEl.classList.add("on");
  toastTimer = setTimeout(() => toastEl.classList.remove("on"), kind === "error" ? 7000 : 3500);
}

export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// Cualquier color CSS -> "#rrggbb", usando el intérprete del navegador:
// hex (con o sin #, abreviado), rgb(), hsl(), oklch(), nombres... También "255, 0, 0".
// Los colores fuera de sRGB se ajustan al más cercano. Devuelve null si no es un color válido.
const colorProbe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
export function cssColorToHex(input) {
  let s = input.trim();
  if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
    s = s.replace("#", "");
    if (s.length === 3) s = [...s].map(c => c + c).join("");
    return "#" + s.toLowerCase();
  }
  if (/^\d{1,3}\s*[, ]\s*\d{1,3}\s*[, ]\s*\d{1,3}$/.test(s)) s = `rgb(${s.split(/[\s,]+/).join(", ")})`;
  if (!s || !CSS.supports("color", s)) return null;
  colorProbe.canvas.width = colorProbe.canvas.height = 1;
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = s;
  colorProbe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = colorProbe.getImageData(0, 0, 1, 1).data;
  if (a === 0) return null;
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

// Menú desplegable accesible: abre con clic o flecha abajo, se recorre con flechas,
// Inicio y Fin, se cierra con Escape, Tab, clic afuera o al elegir una opción.
/**
 * @param {HTMLElement} toggle  botón que abre y cierra el menú
 * @param {HTMLElement} menu    contenedor de los [role="menuitem"]
 * @param {{ onOpen?: () => void }} [options]  onOpen corre justo antes de mostrarlo
 * @returns {{ open: (focusFirst: boolean) => void, close: (returnFocus: boolean) => void }}
 */
export function attachMenu(toggle, menu, { onOpen } = {}) {
  const items = () => /** @type {HTMLElement[]} */ ([...menu.querySelectorAll('[role^="menuitem"]:not([disabled])')]);
  const open = focusFirst => {
    if (onOpen) onOpen();
    menu.hidden = false; toggle.setAttribute("aria-expanded", "true");
    if (focusFirst) (/** @type {HTMLElement} */ (menu.querySelector('[aria-checked="true"]:not([disabled])')) || items()[0])?.focus();
  };
  const close = returnFocus => {
    if (menu.hidden) return;
    menu.hidden = true; toggle.setAttribute("aria-expanded", "false");
    if (returnFocus) toggle.focus();
  };
  toggle.addEventListener("click", e => menu.hidden ? open(e.detail === 0) : close(false));  // detail 0 = teclado
  toggle.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); open(true); }
    else if (e.key === "Escape" && !menu.hidden) { e.preventDefault(); close(false); }  // abierto con el mouse
  });
  menu.addEventListener("keydown", e => {
    const list = items(), n = list.length, i = list.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (e.key === "Escape") { e.preventDefault(); close(true); return; }
    if (e.key === "Tab") { close(false); return; }
    if (!n) return;
    if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % n].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + n) % n].focus(); }
    else if (e.key === "Home") { e.preventDefault(); list[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); list[n - 1].focus(); }
  });
  // Las acciones de cada opción corren primero (en el botón); después se cierra
  menu.addEventListener("click", e => { if (/** @type {Element} */ (e.target).closest('[role^="menuitem"]')) close(false); });
  document.addEventListener("pointerdown", e => {
    const t = /** @type {Node} */ (e.target);
    if (!menu.contains(t) && !toggle.contains(t)) close(false);
  });
  return { open, close };
}
