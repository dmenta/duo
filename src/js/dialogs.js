"use strict";
/* Diálogos modales propios (prompt y confirm del navegador suelen estar bloqueados
   en páginas embebidas).
   Expone: askText({ title, label, value, max, confirm }) -> Promise<string | null>
           askConfirm({ title, message, confirm, danger }) -> Promise<boolean> */

const dlg = document.getElementById("dlg");
const dlgTitle = document.getElementById("dlgTitle");
const dlgMsg = document.getElementById("dlgMsg");
const dlgField = document.getElementById("dlgField");
const dlgLabel = document.getElementById("dlgLabel");
const dlgInput = document.getElementById("dlgInput");
const dlgOk = document.getElementById("dlgOk");

function openDialog({ title, message = "", input = null, confirm = "Aceptar", danger = false }) {
  return new Promise(resolve => {
    dlgTitle.textContent = title;
    dlgMsg.textContent = message; dlgMsg.hidden = !message;
    dlgField.hidden = !input;
    dlgInput.required = !!input;
    if (input) { dlgLabel.textContent = input.label; dlgInput.value = input.value || ""; dlgInput.maxLength = input.max || 100; }
    dlgOk.textContent = confirm;
    dlgOk.classList.toggle("danger", danger);
    dlg.returnValue = "";
    dlg.addEventListener("close", () => {
      const ok = dlg.returnValue === "ok";
      if (input) resolve(ok && dlgInput.value.trim() ? dlgInput.value.trim() : null);
      else resolve(ok);
    }, { once: true });
    dlg.showModal();
    if (input) { dlgInput.focus(); dlgInput.select(); } else dlgOk.focus();
  });
}
const askText = ({ title, label, value, max, confirm }) => openDialog({ title, confirm, input: { label, value, max } });
const askConfirm = ({ title, message, confirm, danger }) => openDialog({ title, message, confirm, danger });
