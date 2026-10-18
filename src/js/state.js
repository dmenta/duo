"use strict";
/* Estado de la aplicación y buffers de imagen.
   Expone: MAX_INKS, PREVIEW_MAX, FULL_MAX, SWATCHES, newInk, state, buf
   Usa: CURVE_PRESETS */

const MAX_INKS = 4;
const PREVIEW_MAX = 1400;  // lado mayor de la vista previa
const FULL_MAX = 8000;     // lado mayor máximo para exportar

const SWATCHES = [
  ["Negro", "#231f20"], ["Sepia", "#704214"], ["Naranja", "#e3742f"], ["Rojo", "#c8102e"],
  ["Magenta", "#c4006e"], ["Azul", "#1f4e9c"], ["Cian", "#0093c9"], ["Verde", "#00875a"], ["Amarillo", "#f2c500"]
];

let uid = 0;
const newInk = (name, color, preset) => ({
  id: ++uid, name, color, preset,
  points: CURVE_PRESETS[preset].pts.map(p => p.slice())
});

// Configuración que define el resultado
const state = {
  gray: { mode: "lum", r: 21.26, g: 71.52, b: 7.22 },
  inks: [newInk("Negro", "#231f20", "luces"), newInk("Naranja", "#e3742f", "medios")],
  view: "result",          // "original" | "gray" | "result"
  name: "imagen-de-prueba"
};

// Datos derivados de la imagen cargada
const buf = {
  full: null,       // {w, h, data} a resolución de exportación
  prev: null,       // {w, h, data} reducida para la vista previa
  prevIdx: null,    // Uint16Array: nivel de gris (0..N-1) por píxel de prev
  fullIdx: null,    // idem para full, se calcula al exportar
  resultLUT: null   // Uint8Array(N*3): color sRGB por nivel de gris
};
