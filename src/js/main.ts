/* Arranque. */
import "./dom.ts";
import "./color.ts";
import "./curves.ts";
import "./state.ts";
import "./process.ts";
import "./render.ts";
import "./loader.ts";
import "./curve-editor.ts";
import "./ui-inks.ts";
import "./ui-gray.ts";
import "./ui-stage.ts";
import "./zoom.ts";
import "./png.ts";
import "./export.ts";
import "./dialogs.ts";
import "./history.ts";
import "./recipes.ts";
import { setHasImage } from "./ui-stage.ts";
import { initHistory } from "./history.ts";
import { DEFAULT_REF } from "./config.ts";

initHistory(DEFAULT_REF);   // restaura la última receta guardada, si hay
setHasImage(false);         // arranca sin imagen: se ve la zona de carga
