/* Arranque. */
import "./dom.js";
import "./color.js";
import "./curves.js";
import "./state.js";
import "./process.js";
import "./render.js";
import "./loader.js";
import "./curve-editor.js";
import "./ui-inks.js";
import "./ui-gray.js";
import "./ui-stage.js";
import "./zoom.js";
import "./png.js";
import "./export.js";
import "./dialogs.js";
import "./history.js";
import "./recipes.js";
import { setHasImage } from "./ui-stage.js";
import { initHistory } from "./history.js";
import { DEFAULT_REF } from "./recipes.js";

initHistory(DEFAULT_REF);   // restaura la última receta guardada, si hay
setHasImage(false);         // arranca sin imagen: se ve la zona de carga
