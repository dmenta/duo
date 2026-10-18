"use strict";
/* Estado de la aplicación y buffers de imagen.
   Expone: MAX_INKS, NAME_MAX, PREVIEW_MAX, FULL_MAX, SWATCHES, swatchName, makeInk, newInk, defaultRecipe, state, buf
   Usa: CURVE_PRESETS */

const MAX_INKS = 4;
const NAME_MAX = 32;       // largo máximo del nombre de una tinta
const PREVIEW_MAX = 1400;  // lado mayor de la vista previa
const FULL_MAX = 8000;     // lado mayor máximo para exportar

const SWATCHES = [
  ["Negro", "#231f20"], ["Sepia", "#704214"], ["Naranja", "#e3742f"], ["Rojo", "#c8102e"],
  ["Magenta", "#c4006e"], ["Azul", "#1f4e9c"], ["Cian", "#0093c9"], ["Verde", "#00875a"], ["Amarillo", "#f2c500"]
];

// Nombre del color predefinido con ese hex, o undefined si es un color propio
const swatchName = color => (SWATCHES.find(s => s[1] === color.toLowerCase()) || [])[0];

let uid = 0;
// Tinta de la receta -> tinta en el estado (con id propio para la interfaz).
// Si el color es predefinido, su nombre manda: corrige recetas con nombres desfasados.
// Una tinta en degradé lleva color2 (el color en los negros); su nombre siempre es libre.
const makeInk = ({ name, color, color2, preset, points }) => {
  color = color.toLowerCase();
  const ink = { id: ++uid, name: "", color };
  if (color2) ink.color2 = color2.toLowerCase();
  const fixedName = ink.color2 ? undefined : swatchName(color);
  ink.name = (fixedName ?? name).slice(0, NAME_MAX);
  ink.preset = preset;
  ink.points = points.map(p => p.slice());
  return ink;
};
const newInk = (name, color, preset) => makeInk({ name, color, preset, points: CURVE_PRESETS[preset].pts });

// Receta inicial: lo que se usa la primera vez y al restablecer
const defaultRecipe = () => ({
  v: 1,
  gray: { mode: "lum", r: 21.26, g: 71.52, b: 7.22 },
  inks: [
    { name: "Negro", color: "#231f20", preset: "luces", points: CURVE_PRESETS.luces.pts },
    { name: "Naranja", color: "#e3742f", preset: "medios", points: CURVE_PRESETS.medios.pts }
  ]
});

// Configuración que define el resultado
const state = {
  gray: { ...defaultRecipe().gray },
  inks: defaultRecipe().inks.map(makeInk),
  view: "result",          // "original" | "gray" | "result"
  active: null,            // receta de la biblioteca en uso: { kind: "builtin" | "user", id } o null
  name: "imagen-de-prueba"
};

// Datos derivados de la imagen cargada
const buf = {
  full: null,       // {w, h, data, hasAlpha} a resolución de exportación
  prev: null,       // {w, h, data} reducida para la vista previa
  prevIdx: null,    // Uint16Array: nivel de gris (0..N-1) por píxel de prev
  fullIdx: null,    // idem para full, se calcula al exportar
  resultLUT: null   // Uint8Array(N*3): color sRGB por nivel de gris
};
