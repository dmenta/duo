/* Avisa si algún módulo de src/js no se carga nunca desde main.ts.
   Los módulos se conectan al evaluarse: uno que nadie importa compila igual, pero no funciona.
   Solo cuentan los import de valor (los "import type" se borran al compilar), y no se exigen
   los módulos que solo declaran tipos. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "src/js";
const importRe = /^\s*import\s+(?!type\b)(?:[^"']*?\sfrom\s+)?["']\.\/([^"']+\.ts)["']|import\(\s*["']\.\/([^"']+\.ts)["']\s*\)/gm;

const reached = new Set(), pending = ["main.ts"];
while (pending.length) {
  const file = pending.pop();
  if (reached.has(file)) continue;
  reached.add(file);
  for (const m of readFileSync(join(dir, file), "utf-8").matchAll(importRe)) pending.push(m[1] ?? m[2]);
}

// Solo tipos: cada sentencia de primer nivel declara un tipo (no hay código que ejecutar)
const onlyTypes = (file) => readFileSync(join(dir, file), "utf-8")
  .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
  .split("\n").filter(l => /^\S/.test(l) && !/^[})\]]/.test(l))
  .every(l => /^(export\s+)?(type|interface|import\s+type)\b/.test(l));

const missing = readdirSync(dir)
  .filter(f => f.endsWith(".ts") && !f.endsWith(".d.ts") && !reached.has(f) && !onlyTypes(f));
if (missing.length) {
  console.error(`Módulos que main.ts no carga: ${missing.join(", ")}`);
  process.exit(1);
}
