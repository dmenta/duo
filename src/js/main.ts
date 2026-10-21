/* Arranque. */
import "./dom.ts";
import "./color.ts";
import "./curves.ts";
import "./session.ts";
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
import { applyRecipe } from "./recipes.ts";
import { doc, getRecipe, loadResumePoint } from "./session.ts";
import { DEFAULT_REF } from "./config.ts";

// Arranca desde el punto de retorno, si hay; si no, con la receta de fábrica
const saved = loadResumePoint();
doc.active = saved ? saved.active : DEFAULT_REF;
applyRecipe(saved ? saved.recipe : getRecipe());
initHistory();
setHasImage(false);  // arranca sin imagen: se ve la zona de carga
