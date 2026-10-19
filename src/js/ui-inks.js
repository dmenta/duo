/* Panel de tintas: tarjetas, color, nombre, curva.
   Incluye el modo de cada tinta: color fijo o degradé (color en blancos -> color2 en negros). */
import { esc, setStatus, cssColorToHex, byId } from "./dom.js";
import { mirrorX, mirrorY, CURVE_PRESETS } from "./curves.js";
import { MAX_INKS, NAME_MAX, SWATCHES, swatchName, newInk, state } from "./state.js";
import { scheduleRender } from "./render.js";
import { attachCurve } from "./curve-editor.js";
import { commitHistory } from "./history.js";


const inksEl = byId("inks");
const addInkBtn = byId("addInk", HTMLButtonElement);

const hexField = (cls, value, label) => `<input type="text" class="hex ${cls}" value="${value}" spellcheck="false" autocomplete="off"
      title="Hex, rgb(), hsl(), oklch() o cualquier color CSS" aria-label="${label}: hex, rgb(), hsl(), oklch() o cualquier color CSS">`;

const inkCardHTML = ink => `
  <div class="ink-head">
    <label class="swatch head-swatch" title="Elegir color"><input type="color" class="c-main" value="${ink.color}" aria-label="Color de la tinta"></label>
    <input type="text" class="name" value="${esc(ink.name)}" maxlength="${NAME_MAX}" aria-label="Nombre de la tinta">
    ${hexField("hex-main", ink.color, "Color de la tinta")}
    <button class="icon-btn rm" title="Quitar tinta" aria-label="Quitar tinta" ${state.inks.length < 2 ? "disabled" : ""}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg>
    </button>
  </div>
  <div class="seg ink-mode" role="group" aria-label="Tipo de color">
    <button data-mode="solid" aria-pressed="true">Color fijo</button>
    <button data-mode="gradient" aria-pressed="false">Degradé</button>
  </div>
  <div class="grad-row" hidden>
    <div class="grad-end" data-end="color">
      <span class="end-label">Blancos</span>
      <label class="swatch sm" title="Color en los blancos"><input type="color" class="c-end" aria-label="Color en los blancos"></label>
      ${hexField("hex-end", "", "Color en los blancos")}
    </div>
    <span class="grad-arrow" aria-hidden="true">→</span>
    <div class="grad-end" data-end="color2">
      <span class="end-label">Negros</span>
      <label class="swatch sm" title="Color en los negros"><input type="color" class="c-end" aria-label="Color en los negros"></label>
      ${hexField("hex-end", "", "Color en los negros")}
    </div>
    <span class="grad-strip" aria-hidden="true"></span>
  </div>
  <div class="chips">${SWATCHES.map(([n, c]) => `<button class="chip" style="background:${c}" data-c="${c}" data-n="${n}" title="${n}" aria-label="${n}" aria-pressed="false"></button>`).join("")}</div>
  <div class="curve-box">
    <canvas class="curve" aria-label="Curva de la tinta. Hacé clic para agregar puntos, arrastralos para ajustar y doble clic para quitarlos."></canvas>
    <span class="readout" aria-hidden="true"></span>
  </div>
  <div class="curve-foot">
    <span>Curva</span>
    <select class="preset" aria-label="Curva">
      ${Object.entries(CURVE_PRESETS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}
      <option value="custom" disabled>Personalizada</option>
    </select>
    <button class="icon-btn flip-x" title="Espejar en X: intercambia luces y sombras" aria-label="Espejar la curva horizontalmente">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5v13" stroke-dasharray="1.6 1.6"/><path d="M5.5 4L1.5 12h4z" fill="currentColor"/><path d="M10.5 4l4 8h-4z"/></svg>
    </button>
    <button class="icon-btn flip-y" title="Espejar en Y: invierte la cantidad de tinta" aria-label="Espejar la curva verticalmente">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 8h13" stroke-dasharray="1.6 1.6"/><path d="M4 5.5L12 1.5v4z" fill="currentColor"/><path d="M4 10.5l8 4v-4z"/></svg>
    </button>
  </div>`;

function bindInkCard(el, ink, j, signal) {
  const presetSel = el.querySelector(".preset");
  presetSel.value = ink.preset;

  const redraw = attachCurve(el.querySelector(".curve"), ink, el.querySelector(".readout"), () => {
    if (ink.preset !== "custom") { ink.preset = "custom"; presetSel.value = "custom"; }
  }, signal);

  const nameIn = el.querySelector(".name");
  const headSwatch = el.querySelector(".head-swatch"), mainColor = el.querySelector(".c-main"), mainHex = el.querySelector(".hex-main");
  const modeSeg = el.querySelector(".ink-mode"), gradRow = el.querySelector(".grad-row"), strip = el.querySelector(".grad-strip");
  const ends = {};
  el.querySelectorAll(".grad-end").forEach(e => { ends[e.dataset.end] = { box: e, color: e.querySelector(".c-end"), hex: e.querySelector(".hex-end") }; });
  // Extremo al que se aplican los colores rápidos (en color fijo, siempre el único color)
  let activeEnd = ink.color2 ? "color2" : "color";

  // El nombre se edita salvo en un color fijo predefinido, que lleva su nombre
  const syncName = () => {
    const fixed = !ink.color2 && swatchName(ink.color) !== undefined;
    nameIn.value = ink.name;
    nameIn.readOnly = fixed;
    nameIn.tabIndex = fixed ? -1 : 0;
    nameIn.title = fixed ? "Color predefinido. Para ponerle un nombre propio, elegí un color personalizado o un degradé." : "";
  };
  // Color rápido marcado: el que coincide con el extremo activo
  const syncChips = () => el.querySelectorAll(".chip").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.c === ink[activeEnd])));

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
      for (const k of ["color", "color2"]) {
        ends[k].color.value = ink[k]; ends[k].hex.value = ink[k];
        ends[k].color.parentElement.style.background = ink[k];  // cada extremo muestra su propio color
        ends[k].box.classList.toggle("active", activeEnd === k);
      }
      strip.style.background = `linear-gradient(90deg, ${ink.color}, ${ink.color2})`;
    }
    modeSeg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === (grad ? "gradient" : "solid"))));
    syncName(); syncChips();
  };

  // Cambiar un extremo. En color fijo valen las reglas de nombre de siempre.
  const setEndColor = (end, c) => {
    if (end === "color" && !ink.color2) {
      const preset = swatchName(c), wasPreset = swatchName(ink.color) !== undefined;
      if (preset) ink.name = preset;                 // predefinido: su nombre
      else if (wasPreset) ink.name = "Personalizado"; // de predefinido a propio
    }
    ink[end] = c;
    syncColors(); redraw(); scheduleRender();
  };

  const setMode = mode => {
    if ((mode === "gradient") === !!ink.color2) return;
    if (mode === "gradient") { ink.color2 = ink.color; activeEnd = "color2"; }  // arranca sin cambio visible
    else {
      delete ink.color2; activeEnd = "color";
      const preset = swatchName(ink.color); if (preset) ink.name = preset;
    }
    syncColors(); redraw(); scheduleRender(); commitHistory();
  };
  modeSeg.addEventListener("click", e => { const b = e.target.closest("button"); if (b) setMode(b.dataset.mode); });

  // Campo de color: acepta cualquier color CSS
  const bindHex = (input, end) => {
    input.addEventListener("change", () => {
      const c = cssColorToHex(input.value);
      if (c) setEndColor(end, c);
      else {
        if (input.value.trim()) setStatus(`No reconozco «${input.value.trim()}» como color. Probá con #e3742f, rgb(227, 116, 47) u oklch(…).`, "error");
        input.value = ink[end];
      }
      commitHistory();
    });
    input.addEventListener("keydown", e => { if (e.key === "Enter") input.blur(); });
  };
  const bindPicker = (input, end) => {
    input.addEventListener("input", () => setEndColor(end, input.value));
    input.addEventListener("change", () => commitHistory());  // al cerrar el selector
  };
  bindPicker(mainColor, "color"); bindHex(mainHex, "color");
  for (const k of ["color", "color2"]) {
    bindPicker(ends[k].color, k); bindHex(ends[k].hex, k);
    // Tocar un extremo lo vuelve el activo para los colores rápidos
    ends[k].box.addEventListener("pointerdown", () => { activeEnd = k; syncColors(); });
    ends[k].box.addEventListener("focusin", () => { if (activeEnd !== k) { activeEnd = k; syncColors(); } });
  }

  nameIn.addEventListener("input", () => { ink.name = nameIn.value; });
  nameIn.addEventListener("change", () => {
    if (!nameIn.value.trim()) { ink.name = "Personalizado"; nameIn.value = ink.name; }
    commitHistory();  // al terminar de editar
  });
  nameIn.addEventListener("keydown", e => { if (e.key === "Enter") nameIn.blur(); });
  el.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => { setEndColor(activeEnd, b.dataset.c); commitHistory(); }));
  syncColors();

  // Espejar: solo acciones; el resultado queda en los puntos de la curva
  const setPoints = pts => {
    ink.points = pts; ink.preset = "custom"; presetSel.value = "custom";
    redraw(); scheduleRender(); commitHistory();
  };
  el.querySelector(".flip-x").addEventListener("click", () => setPoints(mirrorX(ink.points)));
  el.querySelector(".flip-y").addEventListener("click", () => setPoints(mirrorY(ink.points)));

  presetSel.addEventListener("change", () => {
    const p = CURVE_PRESETS[presetSel.value]; if (!p) return;
    ink.preset = presetSel.value; ink.points = p.pts.map(q => q.slice());
    redraw(); scheduleRender();
    commitHistory();
  });

  el.querySelector(".rm").addEventListener("click", () => { state.inks.splice(j, 1); renderInks(); scheduleRender(); commitHistory(); });
}

// Se aborta al volver a dibujar las tarjetas: suelta lo que las anteriores dejaron fuera de ellas
let cardsLife = new AbortController();

export function renderInks() {
  cardsLife.abort();
  cardsLife = new AbortController();
  inksEl.innerHTML = "";
  state.inks.forEach((ink, j) => {
    const el = document.createElement("div");
    el.className = "ink";
    el.innerHTML = inkCardHTML(ink);
    inksEl.appendChild(el);
    bindInkCard(el, ink, j, cardsLife.signal);
  });
  addInkBtn.disabled = state.inks.length >= MAX_INKS;
}

addInkBtn.addEventListener("click", () => {
  if (state.inks.length >= MAX_INKS) return;
  const used = new Set(state.inks.map(i => i.color));
  const sw = SWATCHES.find(s => !used.has(s[1])) || SWATCHES[0];
  state.inks.unshift(newInk(sw[0], sw[1], "campana"));  // la nueva queda primera
  renderInks(); scheduleRender();
  commitHistory();
});
