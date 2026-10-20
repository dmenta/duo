/* Editor interactivo de curvas (canvas). */
import type { Ink, Point } from "./state.ts";
import { ctx2d } from "./dom.ts";
import { clamp01, contrastRatio, mixHex } from "./color.ts";
import { makeCurve } from "./curves.ts";
import { scheduleRender } from "./render.ts";
import { commitHistory } from "./history.ts";

/**
 * Conecta el editor de curva al canvas de una tarjeta de tinta. Edita ink.points en el lugar.
 * @param readout etiqueta que muestra el punto bajo el cursor
 * @param onEdit se llama en cada cambio de la curva
 * @param signal al abortarse suelta lo que vive fuera del canvas (tema, tamaño)
 * @returns redibuja la curva
 */
export function attachCurve(canvas: HTMLCanvasElement, ink: Ink, readout: HTMLElement, onEdit: () => void, signal: AbortSignal): () => void {
  const PAD = 12;
  let drag = -1;
  /**
   * Escala del último dibujo (null si todavía no se dibujó): unidades de curva -> píxeles CSS
   */
  let map: { X: (v: number) => number; Yp: (v: number) => number; iw: number; ih: number } | null = null;

  function draw() {
    const r = canvas.getBoundingClientRect(), w = r.width, h = r.height, dpr = window.devicePixelRatio || 1;
    if (!w) return;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const x = ctx2d(canvas); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    const cs = getComputedStyle(document.documentElement);
    const line = cs.getPropertyValue("--line").trim(), muted = cs.getPropertyValue("--muted").trim(), text = cs.getPropertyValue("--text").trim();
    const iw = w - PAD * 2, ih = h - PAD * 2 - 8;
    const X = (v: number) => PAD + v * iw, Yp = (v: number) => PAD + (1 - v) * ih;
    // grilla
    x.strokeStyle = line; x.lineWidth = 1;
    for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(X(i / 4), PAD); x.lineTo(X(i / 4), PAD + ih); x.moveTo(PAD, Yp(i / 4)); x.lineTo(PAD + iw, Yp(i / 4)); x.stroke(); }
    x.strokeRect(PAD + .5, PAD + .5, iw - 1, ih - 1);
    // diagonal de referencia
    x.setLineDash([3, 4]); x.strokeStyle = muted; x.globalAlpha = .5;
    x.beginPath(); x.moveTo(X(0), Yp(0)); x.lineTo(X(1), Yp(1)); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
    // barra de entrada
    const gb = x.createLinearGradient(X(0), 0, X(1), 0); gb.addColorStop(0, "#fff"); gb.addColorStop(1, "#000");
    x.fillStyle = gb; x.fillRect(X(0), PAD + ih + 3, iw, 5);
    // curva: si la tinta casi no contrasta con el fondo, lleva un contorno marcado
    const surface = cs.getPropertyValue("--surface").trim();
    const minContrast = ink.color2
      ? Math.min(contrastRatio(ink.color, surface), contrastRatio(ink.color2, surface))
      : contrastRatio(ink.color, surface);
    const lowContrast = minContrast < 2.2;
    // En degradé, el trazo recorre los colores de blancos (izquierda) a negros (derecha)
    let stroke: string | CanvasGradient = ink.color;
    if (ink.color2) { const g = x.createLinearGradient(X(0), 0, X(1), 0); g.addColorStop(0, ink.color); g.addColorStop(1, ink.color2); stroke = g; }
    const f = makeCurve(ink.points);
    x.lineWidth = lowContrast ? 5 : 4; x.strokeStyle = text; x.globalAlpha = lowContrast ? .75 : .18; x.beginPath();
    for (let i = 0; i <= 120; i++) { const v = i / 120; i ? x.lineTo(X(v), Yp(f(v))) : x.moveTo(X(v), Yp(f(v))); }
    x.stroke(); x.globalAlpha = 1; x.lineWidth = 2.25; x.strokeStyle = stroke; x.stroke();
    // puntos
    ink.points.forEach((p, i) => {
      x.beginPath(); x.arc(X(p[0]), Yp(p[1]), i === drag ? 6 : 4.5, 0, Math.PI * 2);
      x.fillStyle = ink.color2 ? mixHex(ink.color, ink.color2, p[0]) : ink.color; x.fill(); x.lineWidth = 1.5; x.strokeStyle = text; x.stroke();
    });
    map = { X, Yp, iw, ih };
  }

  function toUnit(e: PointerEvent): Point {
    const r = canvas.getBoundingClientRect(), m = map as NonNullable<typeof map>;
    return [clamp01((e.clientX - r.left - PAD) / m.iw), clamp01(1 - (e.clientY - r.top - PAD) / m.ih)];
  }
  /** Índice del punto bajo el cursor, o -1. */
  function nearest(e: MouseEvent) {
    const r = canvas.getBoundingClientRect(), m = map as NonNullable<typeof map>; let best = -1, bd = 14 * 14;
    ink.points.forEach((p, i) => {
      const dx = m.X(p[0]) - (e.clientX - r.left), dy = m.Yp(p[1]) - (e.clientY - r.top), d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  const show = (a: number, b: number) => { readout.textContent = `Gris ${Math.round(a * 100)}% → tinta ${Math.round(b * 100)}%`; readout.classList.add("on"); };
  const edited = () => { onEdit(); scheduleRender(); };

  canvas.addEventListener("pointerdown", e => {
    if (!map) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    drag = nearest(e);
    if (drag < 0) {
      const [ux, uy] = toUnit(e);
      const i = ink.points.findIndex(p => p[0] > ux); if (i <= 0) return;
      if (ink.points[i][0] - ux < 0.02 || ux - ink.points[i - 1][0] < 0.02) return;
      ink.points.splice(i, 0, [ux, uy]); drag = i; edited();
    }
    draw();
  });
  canvas.addEventListener("pointermove", e => {
    if (!map) return;
    if (drag < 0) { const [ux] = toUnit(e); show(ux, makeCurve(ink.points)(ux)); return; }
    const [ux, uy] = toUnit(e), pts = ink.points, last = pts.length - 1;
    if (drag === 0) pts[0][1] = uy;
    else if (drag === last) pts[last][1] = uy;
    else { pts[drag][0] = Math.min(pts[drag + 1][0] - 0.02, Math.max(pts[drag - 1][0] + 0.02, ux)); pts[drag][1] = uy; }
    show(pts[drag][0], pts[drag][1]); edited(); draw();
  });
  // Fin del gesto: una sola entrada de historial (agregar + arrastrar cuenta como una)
  const end = () => { const was = drag; drag = -1; draw(); if (was >= 0) commitHistory(); };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => { if (drag < 0) readout.classList.remove("on"); });
  canvas.addEventListener("dblclick", e => {
    const i = nearest(e);
    if (i > 0 && i < ink.points.length - 1) { ink.points.splice(i, 1); edited(); draw(); commitHistory(); }
  });
  // Los listeners del canvas se van con él; estos dos no, porque los retiene el navegador
  // y a través de draw retienen la tarjeta entera aunque ya no esté en la página.
  const ro = new ResizeObserver(draw);
  ro.observe(canvas);
  signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw, { signal });
  return draw;
}
