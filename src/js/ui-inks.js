"use strict";
/* Panel de tintas: tarjetas, color, nombre, curva.
   Expone: renderInks
   Usa: state, SWATCHES, MAX_INKS, CURVE_PRESETS, newInk, mirrorX, mirrorY, attachCurve, scheduleRender, commitHistory, esc */

const inksEl = document.getElementById("inks");
const addInkBtn = document.getElementById("addInk");

const inkCardHTML = ink => `
  <div class="ink-head">
    <label class="swatch" title="Elegir color"><input type="color" value="${ink.color}" aria-label="Color de la tinta"></label>
    <input type="text" class="name" value="${esc(ink.name)}" aria-label="Nombre de la tinta">
    <input type="text" class="hex" value="${ink.color}" maxlength="7" aria-label="Color en hexadecimal">
    <button class="icon-btn rm" title="Quitar tinta" aria-label="Quitar tinta" ${state.inks.length < 2 ? "disabled" : ""}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg>
    </button>
  </div>
  <div class="chips">${SWATCHES.map(([n, c]) => `<button class="chip" style="background:${c}" data-c="${c}" data-n="${n}" title="${n}" aria-label="${n}"></button>`).join("")}</div>
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

function bindInkCard(el, ink, j) {
  const presetSel = el.querySelector(".preset");
  presetSel.value = ink.preset;

  const redraw = attachCurve(el.querySelector(".curve"), ink, el.querySelector(".readout"), () => {
    if (ink.preset !== "custom") { ink.preset = "custom"; presetSel.value = "custom"; }
  });

  const colorIn = el.querySelector("input[type=color]"), hexIn = el.querySelector(".hex"), nameIn = el.querySelector(".name");
  const setColor = (c, name) => {
    ink.color = c; colorIn.value = c; hexIn.value = c; el.style.setProperty("--ink", c);
    ink.name = name; nameIn.value = name;
    redraw(); scheduleRender();
  };
  colorIn.addEventListener("input", () => setColor(colorIn.value, "Personalizado"));
  colorIn.addEventListener("change", commitHistory);  // al cerrar el selector
  hexIn.addEventListener("change", () => {
    let v = hexIn.value.trim(); if (!v.startsWith("#")) v = "#" + v;
    if (/^#[0-9a-f]{6}$/i.test(v)) setColor(v.toLowerCase(), "Personalizado"); else hexIn.value = ink.color;
    commitHistory();
  });
  nameIn.addEventListener("input", () => { ink.name = nameIn.value; });
  nameIn.addEventListener("change", commitHistory);  // al terminar de editar
  el.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => { setColor(b.dataset.c, b.dataset.n); commitHistory(); }));

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

function renderInks() {
  inksEl.innerHTML = "";
  state.inks.forEach((ink, j) => {
    const el = document.createElement("div");
    el.className = "ink";
    el.style.setProperty("--ink", ink.color);
    el.innerHTML = inkCardHTML(ink);
    inksEl.appendChild(el);
    bindInkCard(el, ink, j);
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
