/* Entorno: lo que no se elige ni se guarda, se detecta del navegador donde corre la app. */

/** Mac o iOS: los atajos se muestran con ⌘ en vez de Ctrl */
export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** El navegador puede comprimir: sin esto, los PNG se generan con canvas.toBlob (siempre RGBA) */
export const HAS_COMPRESSION = typeof CompressionStream !== "undefined";

/** Capacidad de descargas de claude.ai: existe solo si la página corre ahí, y llega al iniciar */
export let downloads: { save(o: { filename: string; data: Blob }): Promise<void> } | null = null;
if (window.claude && typeof window.claude.use === "function") {
  window.claude.use("downloads").then(d => { downloads = d; }).catch(() => {});
}
