/* Persistencia en el navegador: lo único que sobrevive a la sesión.
   - Biblioteca de recetas propias: estado de la app, compartido entre pestañas.
   - Punto de retorno: la receta en curso y cuál está activa, para que al abrir la app
     (en cualquier pestaña) arranque desde la última receta tocada.
   Acá solo se lee y escribe JSON; la validación de las recetas queda en quien las usa.
   Sin almacenamiento disponible (modo privado, bloqueado), leer da null y escribir false. */

const KEYS = {
  library: "duotono:recetas:v1",   // { v: 1, items: [...] }
  resume: "duotono:receta:v1",     // receta en curso
  active: "duotono:activa:v1"      // receta de la biblioteca activa, o null
};

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch { return null; }
}

function write(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

/* ---------- Biblioteca de recetas propias ---------- */

/** Recetas guardadas, sin validar: [] si no hay o el formato no es el esperado */
export function loadLibraryItems(): unknown[] {
  const d = read(KEYS.library) as { v?: unknown; items?: unknown } | null;
  return d && d.v === 1 && Array.isArray(d.items) ? d.items : [];
}

/** @returns false si el navegador no permitió guardar */
export const saveLibraryItems = (items: unknown[]) => write(KEYS.library, { v: 1, items });

/** Avisa cuando otra pestaña cambia la biblioteca */
export function onLibraryChange(listener: () => void) {
  window.addEventListener("storage", e => { if (e.key === KEYS.library) listener(); });
}

/* ---------- Punto de retorno ---------- */

/** Receta en curso y receta activa guardadas, sin validar (null si no hay) */
export const loadResume = () => ({ recipe: read(KEYS.resume), active: read(KEYS.active) });

/** Si el navegador no permite guardar, se sigue sin punto de retorno */
export function saveResume(recipe: unknown, active: unknown) {
  write(KEYS.resume, recipe);
  write(KEYS.active, active);
}
