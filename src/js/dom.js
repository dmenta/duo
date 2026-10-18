"use strict";
/* Utilidades de DOM.
   Expone: esc, setStatus, IS_MAC */

const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const statusEl = document.getElementById("status");
const setStatus = t => { statusEl.textContent = t; };

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
