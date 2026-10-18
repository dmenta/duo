"use strict";
/* Utilidades de DOM.
   Expone: esc, setStatus */

const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const statusEl = document.getElementById("status");
const setStatus = t => { statusEl.textContent = t; };
