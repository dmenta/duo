/* Utilidades de DOM. */

/**
 * Elemento por id, con el tipo esperado. Falla enseguida si no existe o es de otro tipo,
 * en vez de dar un error confuso más adelante.
 * @param type p. ej. HTMLInputElement
 */
export function byId<T extends HTMLElement = HTMLElement>(id: string, type?: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof (type ?? HTMLElement))) throw new Error(`#${id}: no existe o no es ${(type ?? HTMLElement).name}`);
  return el as T;
}

/**
 * Primer elemento dentro de `root` que coincide con `selector`, con el tipo esperado.
 * Como byId: falla enseguida si no existe o es de otro tipo.
 */
export function qs<T extends Element = HTMLElement>(root: ParentNode, selector: string, type?: new () => T): T {
  const el = root.querySelector(selector), t = type ?? HTMLElement;
  if (!(el instanceof t)) throw new Error(`${selector}: no existe o no es ${t.name}`);
  return el as T;
}

/**
 * Contexto 2D de un canvas (solo es null si el canvas ya tiene otro tipo de contexto).
 */
export function ctx2d(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings) {
  const ctx = canvas.getContext("2d", options);
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
  return ctx;
}

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

export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// Cualquier color CSS -> "#rrggbb", usando el intérprete del navegador:
// hex (con o sin #, abreviado), rgb(), hsl(), oklch(), nombres... También "255, 0, 0".
// Los colores fuera de sRGB se ajustan al más cercano. Devuelve null si no es un color válido.
const colorProbe = ctx2d(document.createElement("canvas"), { willReadFrequently: true });

export function cssColorToHex(input: string): string | null {
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
 * @param toggle botón que abre y cierra el menú
 * @param menu contenedor de los [role="menuitem"]
 * @param options onOpen corre justo antes de mostrarlo
 */
export function attachMenu(toggle: HTMLElement, menu: HTMLElement, { onOpen }: { onOpen?: () => void } = {}): { open: (focusFirst: boolean) => void; close: (returnFocus: boolean) => void } {
  const items = () => ([...menu.querySelectorAll('[role^="menuitem"]:not([disabled])')] as HTMLElement[]);

  const open = (focusFirst: boolean) => {
    if (onOpen) onOpen();
    menu.hidden = false; toggle.setAttribute("aria-expanded", "true");
    if (focusFirst) ((menu.querySelector('[aria-checked="true"]:not([disabled])') as HTMLElement) || items()[0])?.focus();
  };

  const close = (returnFocus: boolean) => {
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
    const list = items(), n = list.length, i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); close(true); return; }
    if (e.key === "Tab") { close(false); return; }
    if (!n) return;
    if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % n].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + n) % n].focus(); }
    else if (e.key === "Home") { e.preventDefault(); list[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); list[n - 1].focus(); }
  });
  // Las acciones de cada opción corren primero (en el botón); después se cierra
  menu.addEventListener("click", e => { if ((e.target as Element).closest('[role^="menuitem"]')) close(false); });
  document.addEventListener("pointerdown", e => {
    const t = e.target as Node;
    if (!menu.contains(t) && !toggle.contains(t)) close(false);
  });
  return { open, close };
}
