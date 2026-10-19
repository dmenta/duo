/* Panel de conversión a gris: método, filtros y mezclador de canales. */
import { byId } from "./dom.js";
import { state } from "./state.js";
import { recomputeGray } from "./loader.js";
import { commitHistory } from "./history.js";


const grayMode = byId("grayMode", HTMLSelectElement);
const mixer = byId("mixer");
const mixIns = { r: byId("mr", HTMLInputElement), g: byId("mg", HTMLInputElement), b: byId("mb", HTMLInputElement) };
/** @typedef {"r" | "g" | "b"} Channel */
/** @type {Channel[]} */
const CHANNELS = ["r", "g", "b"];
const filterBtns = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll("#filters [data-mix]")]);
/** Pesos r, g, b del filtro de un botón (data-mix="r,g,b") @param {HTMLElement} b */
const parseMix = b => (b.dataset.mix ?? "").split(",").map(Number);

function syncMixer() {
  for (const k of CHANNELS) {
    mixIns[k].value = String(state.gray[k]);
    byId("m" + k + "o").textContent = Math.round(state.gray[k]) + "%";
  }
  const t = state.gray.r + state.gray.g + state.gray.b;
  byId("mixTotal").textContent = `Total ${Math.round(t)}%. Cerca de 100% conserva el brillo general.`;
  filterBtns.forEach(b => {
    const [r, g, bl] = parseMix(b);
    const on = Math.abs(r - state.gray.r) < 0.6 && Math.abs(g - state.gray.g) < 0.6 && Math.abs(bl - state.gray.b) < 0.6;
    b.setAttribute("aria-pressed", String(on));
  });
}

// Refleja state.gray en todos los controles (al iniciar, deshacer o restablecer)
export function syncGrayUI() {
  grayMode.value = state.gray.mode;
  mixer.hidden = state.gray.mode !== "mix";
  syncMixer();
}

grayMode.addEventListener("change", () => {
  state.gray.mode = /** @type {"lum" | "mix"} */ (grayMode.value);
  mixer.hidden = grayMode.value !== "mix";
  recomputeGray();
  commitHistory();
});
for (const k of CHANNELS) {
  mixIns[k].addEventListener("input", () => { state.gray[k] = +mixIns[k].value; syncMixer(); recomputeGray(); });
  mixIns[k].addEventListener("change", () => commitHistory());  // una entrada por arrastre
}
filterBtns.forEach(b => b.addEventListener("click", () => {
  const [r, g, bl] = parseMix(b);
  Object.assign(state.gray, { r, g, b: bl });
  syncMixer(); recomputeGray();
  commitHistory();
}));
