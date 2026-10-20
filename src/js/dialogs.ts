/* Diálogos modales propios (prompt y confirm del navegador suelen estar bloqueados
   en páginas embebidas). */
import { byId } from "./dom.ts";

const dlg = byId("dlg", HTMLDialogElement);
const dlgTitle = byId("dlgTitle");
const dlgMsg = byId("dlgMsg");
const dlgField = byId("dlgField");
const dlgLabel = byId("dlgLabel");
const dlgInput = byId("dlgInput", HTMLInputElement);
const dlgOk = byId("dlgOk", HTMLButtonElement);

function openDialog({ title, message = "", input = null, confirm = "Aceptar", danger = false }: {
title: string; message?: string; input?: { label: string; value?: string; max?: number } | null;
confirm?: string; danger?: boolean }): Promise<any> {
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
/**
 * Pide un texto. Devuelve el texto sin espacios en los extremos, o null si se cancela o queda vacío.
 */
export const askText = ({ title, label, value, max, confirm }: { title: string; label: string; value?: string; max?: number; confirm?: string }): Promise<string | null> => openDialog({ title, confirm, input: { label, value, max } });
/**
 * Pide confirmación. danger pinta el botón de aceptar como acción destructiva.
 */
export const askConfirm = ({ title, message, confirm, danger }: { title: string; message: string; confirm?: string; danger?: boolean }): Promise<boolean> => openDialog({ title, message, confirm, danger });
