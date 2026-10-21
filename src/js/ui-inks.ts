/* Panel de tintas: tarjetas, color, nombre, curva.
   Incluye el modo de cada tinta: color fijo o degradé (color en blancos -> color2 en negros). */
import { setStatus, cssColorToHex, byId, qs } from "./dom.ts";
import { mirrorX, mirrorY } from "./curves.ts";
import { CURVE_PRESETS, MAX_INKS, NAME_MAX, SWATCHES } from "./config.ts";
import { doc } from "./session.ts";
import { swatchName, newInk } from "./recipe.ts";
import { scheduleRender } from "./render.ts";
import { attachCurve } from "./curve-editor.ts";
import { commitHistory } from "./history.ts";

import type { InkChanges, Point, PresetKey, ReadonlyInk } from "./types.ts";
/** extremo de una tinta: color en los blancos o en los negros */
type End = "color" | "color2";

const END_KEYS: End[] = ["color", "color2"];

const inksEl = byId("inks");
const addInkBtn = byId("addInk", HTMLButtonElement);

const cardTpl = byId("inkCardTpl", HTMLTemplateElement);

// Los colores rápidos y las curvas predefinidas son fijos: se agregan una sola vez al
// template y cada tarjeta nueva los trae al clonarlo.
{
  const tpl = cardTpl.content;
  const chips = qs(tpl, ".chips");
  for (const [n, c] of SWATCHES) {
    const b = document.createElement("button");
    b.className = "chip"; b.style.background = c; b.dataset.c = c;
    b.title = n; b.setAttribute("aria-label", n); b.setAttribute("aria-pressed", "false");
    chips.append(b);
  }
  const presetSel = qs(tpl, ".preset", HTMLSelectElement);
  const custom = presetSel.firstElementChild;  // "Personalizada" va al final
  for (const [k, v] of Object.entries(CURVE_PRESETS)) presetSel.insertBefore(new Option(v.label, k), custom);
  qs(tpl, ".name", HTMLInputElement).maxLength = NAME_MAX;
}

/** Tarjeta nueva desde el <template>. */
const createInkCard = () => qs(cardTpl.content.cloneNode(true) as DocumentFragment, ".ink", HTMLDivElement);

/**
 * Conecta una tarjeta a su tinta. La tinta se lee de `ink` y se cambia con doc.updateInk,
 * que la actualiza en el lugar: `ink` siempre muestra el estado vigente.
 */
function bindInkCard(el: HTMLElement, ink: ReadonlyInk, signal: AbortSignal) {
  const set = (changes: InkChanges) => doc.updateInk(ink.id, changes);
  const presetSel = qs(el, ".preset", HTMLSelectElement);
  presetSel.value = ink.preset;

  // Editar la curva a mano la vuelve personalizada
  const redraw = attachCurve(qs(el, ".curve", HTMLCanvasElement), ink, qs(el, ".readout"), points => {
    set({ points, preset: "custom" }); presetSel.value = "custom";
  }, signal);

  const nameIn = qs(el, ".name", HTMLInputElement);
  const headSwatch = qs(el, ".head-swatch"), mainColor = qs(el, ".c-main", HTMLInputElement), mainHex = qs(el, ".hex-main", HTMLInputElement);
  const modeSeg = qs(el, ".ink-mode"), gradRow = qs(el, ".grad-row"), strip = qs(el, ".grad-strip");
  const chips = [...el.querySelectorAll(".chip")] as HTMLButtonElement[];

  const endRefs = (end: End) => {
    const box = qs(el, `.grad-end[data-end="${end}"]`);
    return { box, color: qs(box, ".c-end", HTMLInputElement), hex: qs(box, ".hex-end", HTMLInputElement) };
  };
  const ends = { color: endRefs("color"), color2: endRefs("color2") };
  /** Extremo al que se aplican los colores rápidos (en color fijo, siempre el único color) */
  let activeEnd: End = ink.color2 ? "color2" : "color";

  // El nombre se edita salvo en un color fijo predefinido, que lleva su nombre
  const syncName = () => {
    const fixed = !ink.color2 && swatchName(ink.color) !== undefined;
    nameIn.value = ink.name;
    nameIn.readOnly = fixed;
    nameIn.tabIndex = fixed ? -1 : 0;
    nameIn.title = fixed ? "Color predefinido. Para ponerle un nombre propio, elegí un color personalizado o un degradé." : "";
  };
  // Color rápido marcado: el que coincide con el extremo activo
  const syncChips = () => chips.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.c === ink[activeEnd])));

  // Refleja colores y modo en toda la tarjeta
  const syncColors = () => {
    const grad = !!ink.color2;
    el.classList.toggle("is-gradient", grad);
    el.style.setProperty("--ink", ink.color);
    el.style.setProperty("--ink-bar", grad ? `linear-gradient(${ink.color}, ${ink.color2})` : ink.color);
    headSwatch.style.background = grad ? `linear-gradient(135deg, ${ink.color} 50%, ${ink.color2} 50%)` : "";
    mainColor.disabled = grad; mainColor.value = ink.color; mainHex.value = ink.color;
    gradRow.hidden = !grad;
    if (grad) {
      for (const k of END_KEYS) {
        const c = ink[k] ?? ink.color;
        ends[k].color.value = c; ends[k].hex.value = c;
        (ends[k].color.parentElement as HTMLElement).style.background = c;  // cada extremo muestra su propio color
        ends[k].box.classList.toggle("active", activeEnd === k);
      }
      strip.style.background = `linear-gradient(90deg, ${ink.color}, ${ink.color2})`;
    }
    modeSeg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === (grad ? "gradient" : "solid"))));
    syncName(); syncChips();
  };

  /** Cambiar un extremo. En color fijo valen las reglas de nombre de siempre. */
  const setEndColor = (end: End, c: string) => {
    const changes: InkChanges = { [end]: c };
    if (end === "color" && !ink.color2) {
      const preset = swatchName(c), wasPreset = swatchName(ink.color) !== undefined;
      if (preset) changes.name = preset;                 // predefinido: su nombre
      else if (wasPreset) changes.name = "Personalizado"; // de predefinido a propio
    }
    set(changes);
    syncColors(); redraw(); scheduleRender();
  };

  const setMode = (mode: string | undefined) => {
    if ((mode === "gradient") === !!ink.color2) return;
    if (mode === "gradient") { set({ color2: ink.color }); activeEnd = "color2"; }  // arranca sin cambio visible
    else {
      const preset = swatchName(ink.color);
      set(preset ? { color2: undefined, name: preset } : { color2: undefined }); activeEnd = "color";
    }
    syncColors(); redraw(); scheduleRender(); commitHistory();
  };
  modeSeg.addEventListener("click", e => { const b = (e.target as Element).closest("button"); if (b) setMode(b.dataset.mode); });

  // Campo de color: acepta cualquier color CSS
  const bindHex = (input: HTMLInputElement, end: End) => {
    input.addEventListener("change", () => {
      const c = cssColorToHex(input.value);
      if (c) setEndColor(end, c);
      else {
        if (input.value.trim()) setStatus(`No reconozco «${input.value.trim()}» como color. Probá con #e3742f, rgb(227, 116, 47) u oklch(…).`, "error");
        input.value = ink[end] ?? ink.color;
      }
      commitHistory();
    });
    input.addEventListener("keydown", e => { if (e.key === "Enter") input.blur(); });
  };

  const bindPicker = (input: HTMLInputElement, end: End) => {
    input.addEventListener("input", () => setEndColor(end, input.value));
    input.addEventListener("change", () => commitHistory());  // al cerrar el selector
  };
  bindPicker(mainColor, "color"); bindHex(mainHex, "color");
  for (const k of END_KEYS) {
    bindPicker(ends[k].color, k); bindHex(ends[k].hex, k);
    // Tocar un extremo lo vuelve el activo para los colores rápidos
    ends[k].box.addEventListener("pointerdown", () => { activeEnd = k; syncColors(); });
    ends[k].box.addEventListener("focusin", () => { if (activeEnd !== k) { activeEnd = k; syncColors(); } });
  }

  nameIn.addEventListener("input", () => set({ name: nameIn.value }));
  nameIn.addEventListener("change", () => {
    if (!nameIn.value.trim()) { set({ name: "Personalizado" }); nameIn.value = ink.name; }
    commitHistory();  // al terminar de editar
  });
  nameIn.addEventListener("keydown", e => { if (e.key === "Enter") nameIn.blur(); });
  chips.forEach(b => b.addEventListener("click", () => { setEndColor(activeEnd, (b.dataset.c as string)); commitHistory(); }));
  syncColors();

  // Espejar: solo acciones; el resultado queda en los puntos de la curva
  const setPoints = (points: Point[]) => {
    set({ points, preset: "custom" }); presetSel.value = "custom";
    redraw(); scheduleRender(); commitHistory();
  };
  qs(el, ".flip-x").addEventListener("click", () => setPoints(mirrorX(ink.points)));
  qs(el, ".flip-y").addEventListener("click", () => setPoints(mirrorY(ink.points)));

  presetSel.addEventListener("change", () => {
    const p = CURVE_PRESETS[presetSel.value]; if (!p) return;
    set({ preset: presetSel.value as PresetKey, points: p.pts });
    redraw(); scheduleRender();
    commitHistory();
  });

  const rm = qs(el, ".rm", HTMLButtonElement);
  rm.disabled = doc.inks.length < 2;
  rm.addEventListener("click", () => { doc.removeInk(ink.id); renderInks(); scheduleRender(); commitHistory(); });
}

// Se aborta al volver a dibujar las tarjetas: suelta lo que las anteriores dejaron fuera de ellas
let cardsLife = new AbortController();

export function renderInks() {
  cardsLife.abort();
  cardsLife = new AbortController();
  inksEl.innerHTML = "";
  for (const ink of doc.inks) {
    const el = createInkCard();
    inksEl.append(el);
    bindInkCard(el, ink, cardsLife.signal);
  };
  addInkBtn.disabled = doc.inks.length >= MAX_INKS;
}

addInkBtn.addEventListener("click", () => {
  if (doc.inks.length >= MAX_INKS) return;
  const used = new Set(doc.inks.map(i => i.color));
  const sw = SWATCHES.find(s => !used.has(s[1])) || SWATCHES[0];
  doc.addInk(newInk(sw[0], sw[1], "campana"));  // la nueva queda primera
  renderInks(); scheduleRender();
  commitHistory();
});
