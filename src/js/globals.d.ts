// Globales que no vienen de nuestros módulos. Solo para el chequeo de tipos del editor.

interface Window {
  /** API del entorno de claude.ai, presente solo cuando la app corre embebida ahí. */
  claude?: { use(name: string): Promise<any> };
}
