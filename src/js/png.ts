/* Codificador PNG con el tipo de color justo (canvas.toBlob siempre da RGBA de 32 bits).
   Devuelve null si el navegador no tiene CompressionStream. */

/** Canales -> tipo de color PNG (gris, gris+alfa, RGB, RGBA) */
const PNG_COLOR_TYPE: Record<number, number> = { 1: 0, 2: 4, 3: 2, 4: 6 };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** @param type 4 letras */
function pngChunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) c = CRC_TABLE[(c ^ out[i]) & 255] ^ (c >>> 8);
  dv.setUint32(8 + data.length, (c ^ 0xffffffff) >>> 0);
  return out;
}

// Filtro adaptativo por fila (None, Sub, Up, Paeth): elige el de menor suma absoluta.
function filterRow(cur: Uint8Array, prev: Uint8Array, bpp: number, out: Uint8Array) {
  const n = cur.length;
  let sNone = 0, sSub = 0, sUp = 0, sPaeth = 0;
  for (let i = 0; i < n; i++) {
    const x = cur[i], a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    let v;
    v = x; sNone += v < 128 ? v : 256 - v;
    v = (x - a) & 255; sSub += v < 128 ? v : 256 - v;
    v = (x - b) & 255; sUp += v < 128 ? v : 256 - v;
    v = (x - pr) & 255; sPaeth += v < 128 ? v : 256 - v;
  }
  const min = Math.min(sNone, sSub, sUp, sPaeth);
  const type = min === sPaeth ? 4 : min === sUp ? 2 : min === sSub ? 1 : 0;
  out[0] = type;
  for (let i = 0; i < n; i++) {
    const x = cur[i], a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
    let pred = 0;
    if (type === 1) pred = a;
    else if (type === 2) pred = b;
    else if (type === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
    out[i + 1] = (x - pred) & 255;
  }
}

/**
 * @param channels 1 gris · 2 gris+alfa · 3 RGB · 4 RGBA (8 bits por canal)
 * @param fillRow escribe en `row` (w*channels bytes) la fila y
 * @returns null si el navegador no tiene CompressionStream
 */
export async function encodePNG(w: number, h: number, channels: number, fillRow: (y: number, row: Uint8Array) => void): Promise<Blob | null> {
  if (typeof CompressionStream === "undefined") return null;
  const rowLen = w * channels;
  let cur = new Uint8Array(rowLen), prev = new Uint8Array(rowLen);
  const filtered = new Uint8Array(rowLen + 1);

  // "deflate" en CompressionStream es zlib, que es lo que PNG espera en IDAT
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  const compressed = new Response(cs.readable).arrayBuffer();

  const BATCH = 1 << 20;
  let batch = new Uint8Array(Math.max(BATCH, rowLen + 1)), used = 0;
  for (let y = 0; y < h; y++) {
    fillRow(y, cur);
    filterRow(cur, prev, channels, filtered);
    if (used + filtered.length > batch.length) {
      await writer.write(batch.subarray(0, used));
      batch = new Uint8Array(batch.length); used = 0;
    }
    batch.set(filtered, used); used += filtered.length;
    [cur, prev] = [prev, cur];
  }
  if (used) await writer.write(batch.subarray(0, used));
  await writer.close();
  const idat = new Uint8Array(await compressed);

  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  ihdr[8] = 8; ihdr[9] = PNG_COLOR_TYPE[channels]; // profundidad 8, tipo de color; compresión, filtro y entrelazado en 0
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return new Blob([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("sRGB", new Uint8Array([0])),   // los valores están en sRGB
    pngChunk("IDAT", idat),
    pngChunk("IEND", new Uint8Array(0))
  ], { type: "image/png" });
}
