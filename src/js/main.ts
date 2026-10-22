/* Arranque. */
import "./ui-inks.ts";
import "./ui-gray.ts";
import "./histogram.ts";
import "./ui-stage.ts";
import "./recipes.ts";
import { initHistory } from "./history.ts";
import { doc, loadResumePoint } from "./session.ts";
import { DEFAULT_REF } from "./config.ts";

// Arranca desde el punto de retorno, si hay; si no, con la receta de fábrica
const saved = loadResumePoint();
doc.loadRecipe(saved?.recipe ?? doc.getRecipe(), saved ? saved.active : DEFAULT_REF, { commit: false });
initHistory();
