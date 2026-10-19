// Globales que no vienen de nuestros módulos. Solo para el chequeo de tipos del editor.

/** JSZip, cargado desde el CDN en index.html. Se tipa lo mínimo que usa export.js. */
declare class JSZip {
  file(name: string, data: Blob | string): this;
  generateAsync(options: { type: "blob" }): Promise<Blob>;
}

interface Window {
  /** API del entorno de claude.ai, presente solo cuando la app corre embebida ahí. */
  claude?: { use(name: string): Promise<any> };
}
