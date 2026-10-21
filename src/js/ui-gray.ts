/* Panel de conversión a gris: método, filtros y mezclador de canales. */
import { byId } from "./dom.ts";
import { doc } from "./session.ts";
import { scheduleRender } from "./render.ts";
import { commitHistory } from "./history.ts";

const grayMode = byId("grayMode", HTMLSelectElement);
const mixer = byId("mixer");
const mixIns = { r: byId("mr", HTMLInputElement), g: byId("mg", HTMLInputElement), b: byId("mb", HTMLInputElement) };
type Channel = "r" | "g" | "b";

const CHANNELS: Channel[] = ["r", "g", "b"];
const filterBtns = [...document.querySelectorAll("#filters [data-mix]")] as HTMLButtonElement[];
/** Pesos r, g, b del filtro de un botón (data-mix="r,g,b") */
const parseMix = (b: HTMLElement) => (b.dataset.mix ?? "").split(",").map(Number);

function syncMixer() {
  for (const k of CHANNELS) {
    mixIns[k].value = String(doc.gray[k]);
    byId("m" + k + "o").textContent = Math.round(doc.gray[k]) + "%";
  }
  const t = doc.gray.r + doc.gray.g + doc.gray.b;
  byId("mixTotal").textContent = `Total ${Math.round(t)}%. Cerca de 100% conserva el brillo general.`;
  filterBtns.forEach(b => {
    const [r, g, bl] = parseMix(b);
    const on = Math.abs(r - doc.gray.r) < 0.6 && Math.abs(g - doc.gray.g) < 0.6 && Math.abs(bl - doc.gray.b) < 0.6;
    b.setAttribute("aria-pressed", String(on));
  });
}

// Refleja doc.gray en todos los controles (al iniciar, deshacer o restablecer)
export function syncGrayUI() {
  grayMode.value = doc.gray.mode;
  mixer.hidden = doc.gray.mode !== "mix";
  syncMixer();
}

grayMode.addEventListener("change", () => {
  doc.setGrayMode(grayMode.value as "lum" | "mix");
  mixer.hidden = grayMode.value !== "mix";
  scheduleRender();
  commitHistory();
});
for (const k of CHANNELS) {
  mixIns[k].addEventListener("input", () => { doc.setGrayWeights({ [k]: +mixIns[k].value }); syncMixer(); scheduleRender(); });
  mixIns[k].addEventListener("change", () => commitHistory());  // una entrada por arrastre
}
filterBtns.forEach(b => b.addEventListener("click", () => {
  const [r, g, bl] = parseMix(b);
  doc.setGrayWeights({ r, g, b: bl });
  syncMixer(); scheduleRender();
  commitHistory();
}));
