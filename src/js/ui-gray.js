"use strict";
/* Panel de conversión a gris: método, filtros y mezclador de canales.
   Expone: syncMixer
   Usa: state, recomputeGray */

const grayMode = document.getElementById("grayMode");
const mixer = document.getElementById("mixer");
const mixIns = { r: document.getElementById("mr"), g: document.getElementById("mg"), b: document.getElementById("mb") };
const filterBtns = [...document.querySelectorAll("#filters [data-mix]")];
const parseMix = b => b.dataset.mix.split(",").map(Number);

function syncMixer() {
  for (const k of ["r", "g", "b"]) {
    mixIns[k].value = state.gray[k];
    document.getElementById("m" + k + "o").textContent = Math.round(state.gray[k]) + "%";
  }
  const t = state.gray.r + state.gray.g + state.gray.b;
  document.getElementById("mixTotal").textContent = `Total ${Math.round(t)}%. Cerca de 100% conserva el brillo general.`;
  filterBtns.forEach(b => {
    const [r, g, bl] = parseMix(b);
    const on = Math.abs(r - state.gray.r) < 0.6 && Math.abs(g - state.gray.g) < 0.6 && Math.abs(bl - state.gray.b) < 0.6;
    b.setAttribute("aria-pressed", String(on));
  });
}

grayMode.addEventListener("change", () => {
  state.gray.mode = grayMode.value;
  mixer.hidden = grayMode.value !== "mix";
  recomputeGray();
});
for (const k of ["r", "g", "b"]) {
  mixIns[k].addEventListener("input", () => { state.gray[k] = +mixIns[k].value; syncMixer(); recomputeGray(); });
}
filterBtns.forEach(b => b.addEventListener("click", () => {
  const [r, g, bl] = parseMix(b);
  Object.assign(state.gray, { r, g, b: bl });
  syncMixer(); recomputeGray();
}));
