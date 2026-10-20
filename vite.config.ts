import { defineConfig } from "vite";

export default defineConfig({
  // El código fuente (index.html, styles.css, js/) vive en src/
  root: "src",
  // Rutas relativas: el sitio funciona en cualquier subcarpeta, como dmenta.github.io/duo/
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true
  }
});
