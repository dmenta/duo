(() => {
  'use strict';
  const N = 1024;
  const MAX_INKS = 4;
  const PREVIEW_MAX = 1400;
  const FULL_MAX = 8000;

  /* ---------- Color math ---------- */
  const LIN = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  const enc = (v) => {
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    return Math.round(
      255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055),
    );
  };
  const hexToRgb = (h) => {
    h = h.replace('#', '');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const hexToLin = (h) => hexToRgb(h).map((v) => LIN[v]);
  const YfromL = (L) => {
    const fy = (L + 16) / 116;
    return L > 8 ? fy * fy * fy : L / 903.3;
  };
  const LfromY = (Y) => (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y);
  const coverage = (y) => 1 - YfromL(100 * (1 - y));
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /* ---------- Monotone cubic curve ---------- */
  function makeCurve(pts) {
    const n = pts.length,
      xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    if (n === 2)
      return (x) => clamp01(ys[0] + ((ys[1] - ys[0]) * (x - xs[0])) / (xs[1] - xs[0]));
    const d = [],
      m = new Array(n);
    for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i],
        b = m[i + 1] / d[i],
        s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
    return (x) => {
      x = clamp01(x);
      let i = 0;
      while (i < n - 2 && x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i],
        t = (x - xs[i]) / h,
        t2 = t * t,
        t3 = t2 * t;
      return clamp01(
        (2 * t3 - 3 * t2 + 1) * ys[i] +
        (t3 - 2 * t2 + t) * h * m[i] +
        (-2 * t3 + 3 * t2) * ys[i + 1] +
        (t3 - t2) * h * m[i + 1],
      );
    };
  }

  const CURVE_PRESETS = {
    lineal: {
      label: 'Lineal',
      pts: [
        [0, 0],
        [1, 1],
      ],
    },
    luces: {
      label: 'Limpia en luces',
      pts: [
        [0, 0],
        [0.35, 0.12],
        [0.7, 0.55],
        [1, 1],
      ],
    },
    medios: {
      label: 'Medios tonos',
      pts: [
        [0, 0],
        [0.3, 0.38],
        [0.65, 0.7],
        [1, 0.8],
      ],
    },
    campana: {
      label: 'Solo medios',
      pts: [
        [0, 0],
        [0.45, 0.6],
        [1, 0.25],
      ],
    },
    sombras: {
      label: 'Sombras',
      pts: [
        [0, 0],
        [0.5, 0.18],
        [1, 1],
      ],
    },
    plano: {
      label: 'Fondo plano',
      pts: [
        [0, 0.3],
        [1, 0.6],
      ],
    },
  };
  const SWATCHES = [
    ['Negro', '#231f20'],
    ['Sepia', '#704214'],
    ['Naranja', '#e3742f'],
    ['Rojo', '#c8102e'],
    ['Magenta', '#c4006e'],
    ['Azul', '#1f4e9c'],
    ['Cian', '#0093c9'],
    ['Verde', '#00875a'],
    ['Amarillo', '#f2c500'],
  ];

  /* ---------- State ---------- */
  let uid = 0;
  const newInk = (name, color, preset) => ({
    id: ++uid,
    name,
    color,
    preset,
    points: CURVE_PRESETS[preset].pts.map((p) => p.slice()),
  });
  const state = {
    gray: { mode: 'lum', r: 21.26, g: 71.52, b: 7.22 },
    inks: [newInk('Negro', '#231f20', 'luces'), newInk('Naranja', '#e3742f', 'medios')],
    view: 'result',
    name: 'imagen-de-prueba',
  };

  /* ---------- Image buffers ---------- */
  let full = null,
    prev = null,
    prevIdx = null,
    fullIdx = null,
    resultLUT = null;
  const viewCanvas = document.getElementById('view');
  const vctx = viewCanvas.getContext('2d');

  function grayWeights() {
    return state.gray.mode === 'lum'
      ? [0.2126, 0.7152, 0.0722]
      : [state.gray.r / 100, state.gray.g / 100, state.gray.b / 100];
  }
  function computeIdx(img) {
    const [wr, wg, wb] = grayWeights(),
      d = img.data,
      n = img.w * img.h,
      out = new Uint16Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      let Y = wr * LIN[d[i]] + wg * LIN[d[i + 1]] + wb * LIN[d[i + 2]];
      Y = Y < 0 ? 0 : Y > 1 ? 1 : Y;
      const a = d[i + 3] / 255;
      if (a < 1) Y = Y * a + (1 - a);
      out[p] = Math.round((1 - LfromY(Y) / 100) * (N - 1));
    }
    return out;
  }

  function buildLUT() {
    const inks = state.inks.map((i) => hexToLin(i.color));
    const covs = state.inks.map((ink) => {
      const f = makeCurve(ink.points),
        a = new Float32Array(N);
      for (let k = 0; k < N; k++) a[k] = coverage(f(k / (N - 1)));
      return a;
    });
    resultLUT = new Uint8Array(N * 3);
    for (let k = 0; k < N; k++) {
      let r = 1,
        g = 1,
        b = 1;
      for (let j = 0; j < inks.length; j++) {
        const c = covs[j][k],
          ink = inks[j];
        r *= 1 - c * (1 - ink[0]);
        g *= 1 - c * (1 - ink[1]);
        b *= 1 - c * (1 - ink[2]);
      }
      resultLUT[k * 3] = enc(r);
      resultLUT[k * 3 + 1] = enc(g);
      resultLUT[k * 3 + 2] = enc(b);
    }
  }
  const grayLUT = (() => {
    const a = new Uint8Array(N);
    for (let k = 0; k < N; k++) a[k] = enc(YfromL(100 * (1 - k / (N - 1))));
    return a;
  })();

  function paint(img, idx, mode, out) {
    const o = out.data,
      n = img.w * img.h;
    if (mode === 'original') {
      const d = img.data;
      for (let i = 0; i < o.length; i += 4) {
        const a = d[i + 3] / 255;
        if (a >= 1) {
          o[i] = d[i];
          o[i + 1] = d[i + 1];
          o[i + 2] = d[i + 2];
        } else for (let c = 0; c < 3; c++) o[i + c] = enc(LIN[d[i + c]] * a + (1 - a));
        o[i + 3] = 255;
      }
      return;
    }
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const k = idx[p];
      if (mode === 'result') {
        o[i] = resultLUT[k * 3];
        o[i + 1] = resultLUT[k * 3 + 1];
        o[i + 2] = resultLUT[k * 3 + 2];
      } else {
        const v = grayLUT[k];
        o[i] = v;
        o[i + 1] = v;
        o[i + 2] = v;
      }
      o[i + 3] = 255;
    }
  }

  let rafPending = false;
  function scheduleRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      render();
    });
  }
  function render() {
    if (!prev) return;
    buildLUT();
    if (viewCanvas.width !== prev.w || viewCanvas.height !== prev.h) {
      viewCanvas.width = prev.w;
      viewCanvas.height = prev.h;
    }
    const out = vctx.createImageData(prev.w, prev.h);
    paint(prev, prevIdx, state.view, out);
    vctx.putImageData(out, 0, 0);
    document.documentElement.style.setProperty(
      '--accent',
      (state.inks[1] || state.inks[0]).color,
    );
    viewSeg
      .querySelectorAll('button')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.view)));
  }

  /* ---------- Loading ---------- */
  function scaled(src, max) {
    const s = Math.min(1, max / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * s)),
      h = Math.max(1, Math.round(src.height * s));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    return { w, h, data: ctx.getImageData(0, 0, w, h).data };
  }
  function setSource(src, name) {
    full = scaled(src, FULL_MAX);
    prev = scaled(src, PREVIEW_MAX);
    state.name = name;
    recomputeGray();
    const capped = Math.max(src.width, src.height) > FULL_MAX;
    document.getElementById('meta').textContent =
      `${name} · ${full.w} × ${full.h} px${capped ? ' (reducida para exportar)' : ''}`;
  }
  function recomputeGray() {
    if (!prev) return;
    prevIdx = computeIdx(prev);
    fullIdx = null;
    scheduleRender();
  }
  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setStatus('Ese archivo no es una imagen. Probá con JPG, PNG o WebP.');
      return;
    }
    const url = URL.createObjectURL(file),
      img = new Image();
    img.onload = () => {
      setSource(img, file.name.replace(/\.[^.]+$/, '') || 'imagen');
      URL.revokeObjectURL(url);
      setStatus('');
    };
    img.onerror = () => {
      setStatus('No se pudo leer la imagen. Probá con otro formato.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
  function sampleImage() {
    const w = 1200,
      h = 800,
      c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    let g = x.createLinearGradient(0, 560, 0, h);
    g.addColorStop(0, '#5a4a3c');
    g.addColorStop(1, '#1c1714');
    x.fillStyle = g;
    x.fillRect(0, 560, w, h - 560);
    g = x.createLinearGradient(0, 0, 0, 560);
    g.addColorStop(0, '#9cc4e4');
    g.addColorStop(1, '#f3dcc0');
    x.fillStyle = g;
    x.fillRect(0, 0, w, 560);
    g = x.createRadialGradient(860, 230, 10, 860, 230, 170);
    g.addColorStop(0, '#fff8e0');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, 560);
    x.fillStyle = '#3d5a40';
    x.beginPath();
    x.moveTo(0, 430);
    x.bezierCurveTo(250, 330, 420, 470, 640, 390);
    x.bezierCurveTo(820, 330, 1000, 420, 1200, 360);
    x.lineTo(1200, 560);
    x.lineTo(0, 560);
    x.fill();
    x.fillStyle = '#24342a';
    x.beginPath();
    x.moveTo(0, 500);
    x.bezierCurveTo(300, 440, 600, 540, 1200, 470);
    x.lineTo(1200, 560);
    x.lineTo(0, 560);
    x.fill();
    [
      ['#d8312b', 160],
      ['#f0c419', 300],
      ['#2b7bd8', 440],
      ['#2fa35a', 580],
      ['#a43fb8', 720],
    ].forEach(([col, cx]) => {
      const rg = x.createRadialGradient(cx - 18, 650, 6, cx, 665, 60);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.25, col);
      rg.addColorStop(1, '#111');
      x.fillStyle = rg;
      x.beginPath();
      x.arc(cx, 665, 55, 0, Math.PI * 2);
      x.fill();
    });
    x.fillStyle = '#f2f2f2';
    x.fillRect(820, 590, 380, 210);
    g = x.createLinearGradient(840, 0, 1180, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#000000');
    x.fillStyle = g;
    x.fillRect(840, 610, 340, 70);
    for (let i = 0; i < 11; i++) {
      const L = 100 - i * 10,
        v = enc(YfromL(L));
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(840 + i * 31, 700, 31, 80);
    }
    setSource(c, 'imagen-de-prueba');
  }

  /* ---------- Curve editor ---------- */
  function attachCurve(canvas, ink, readout, onEdit) {
    const PAD = 12;
    let drag = -1;
    function draw() {
      const r = canvas.getBoundingClientRect(),
        w = r.width,
        h = r.height,
        dpr = window.devicePixelRatio || 1;
      if (!w) return;
      const W = Math.round(w * dpr),
        H = Math.round(h * dpr);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      const x = canvas.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);
      const cs = getComputedStyle(document.documentElement);
      const line = cs.getPropertyValue('--line').trim(),
        muted = cs.getPropertyValue('--muted').trim(),
        text = cs.getPropertyValue('--text').trim();
      const iw = w - PAD * 2,
        ih = h - PAD * 2 - 8;
      const X = (v) => PAD + v * iw,
        Yp = (v) => PAD + (1 - v) * ih;
      x.strokeStyle = line;
      x.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        x.beginPath();
        x.moveTo(X(i / 4), PAD);
        x.lineTo(X(i / 4), PAD + ih);
        x.moveTo(PAD, Yp(i / 4));
        x.lineTo(PAD + iw, Yp(i / 4));
        x.stroke();
      }
      x.strokeRect(PAD + 0.5, PAD + 0.5, iw - 1, ih - 1);
      x.setLineDash([3, 4]);
      x.strokeStyle = muted;
      x.globalAlpha = 0.5;
      x.beginPath();
      x.moveTo(X(0), Yp(0));
      x.lineTo(X(1), Yp(1));
      x.stroke();
      x.setLineDash([]);
      x.globalAlpha = 1;
      const gb = x.createLinearGradient(X(0), 0, X(1), 0);
      gb.addColorStop(0, '#fff');
      gb.addColorStop(1, '#000');
      x.fillStyle = gb;
      x.fillRect(X(0), PAD + ih + 3, iw, 5);
      const f = makeCurve(ink.points);
      x.lineWidth = 4;
      x.strokeStyle = text;
      x.globalAlpha = 0.18;
      x.beginPath();
      for (let i = 0; i <= 120; i++) {
        const v = i / 120;
        i ? x.lineTo(X(v), Yp(f(v))) : x.moveTo(X(v), Yp(f(v)));
      }
      x.stroke();
      x.globalAlpha = 1;
      x.lineWidth = 2.25;
      x.strokeStyle = ink.color;
      x.stroke();
      ink.points.forEach((p, i) => {
        x.beginPath();
        x.arc(X(p[0]), Yp(p[1]), i === drag ? 6 : 4.5, 0, Math.PI * 2);
        x.fillStyle = ink.color;
        x.fill();
        x.lineWidth = 1.5;
        x.strokeStyle = text;
        x.stroke();
      });
      canvas._map = { X, Yp, iw, ih, r };
    }
    function toUnit(e) {
      const r = canvas.getBoundingClientRect(),
        m = canvas._map;
      return [
        clamp01((e.clientX - r.left - PAD) / m.iw),
        clamp01(1 - (e.clientY - r.top - PAD) / m.ih),
      ];
    }
    function nearest(e) {
      const r = canvas.getBoundingClientRect(),
        m = canvas._map;
      let best = -1,
        bd = 14 * 14;
      ink.points.forEach((p, i) => {
        const dx = m.X(p[0]) - (e.clientX - r.left),
          dy = m.Yp(p[1]) - (e.clientY - r.top),
          d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    }
    const show = (a, b) => {
      readout.textContent = `Gris ${Math.round(a * 100)}% → tinta ${Math.round(b * 100)}%`;
      readout.classList.add('on');
    };
    const edited = () => {
      onEdit();
      scheduleRender();
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (!canvas._map) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drag = nearest(e);
      if (drag < 0) {
        const [ux, uy] = toUnit(e);
        const i = ink.points.findIndex((p) => p[0] > ux);
        if (i <= 0) return;
        if (ink.points[i][0] - ux < 0.02 || ux - ink.points[i - 1][0] < 0.02) return;
        ink.points.splice(i, 0, [ux, uy]);
        drag = i;
        edited();
      }
      draw();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!canvas._map) return;
      if (drag < 0) {
        const [ux] = toUnit(e);
        show(ux, makeCurve(ink.points)(ux));
        return;
      }
      const [ux, uy] = toUnit(e),
        pts = ink.points,
        last = pts.length - 1;
      if (drag === 0) pts[0][1] = uy;
      else if (drag === last) pts[last][1] = uy;
      else {
        pts[drag][0] = Math.min(
          pts[drag + 1][0] - 0.02,
          Math.max(pts[drag - 1][0] + 0.02, ux),
        );
        pts[drag][1] = uy;
      }
      show(pts[drag][0], pts[drag][1]);
      edited();
      draw();
    });
    const end = () => {
      drag = -1;
      draw();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => {
      if (drag < 0) readout.classList.remove('on');
    });
    canvas.addEventListener('dblclick', (e) => {
      const i = nearest(e);
      if (i > 0 && i < ink.points.length - 1) {
        ink.points.splice(i, 1);
        edited();
        draw();
      }
    });
    new ResizeObserver(draw).observe(canvas);
    return draw;
  }

  /* ---------- Ink UI ---------- */
  const inksEl = document.getElementById('inks');
  const esc = (s) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function renderInks() {
    inksEl.innerHTML = '';
    state.inks.forEach((ink, j) => {
      const el = document.createElement('div');
      el.className = 'ink';
      el.style.setProperty('--ink', ink.color);
      el.innerHTML = `
      <div class="ink-head">
        <label class="swatch" title="Elegir color"><input type="color" value="${ink.color}" aria-label="Color de la tinta"></label>
        <input type="text" class="name" value="${esc(ink.name)}" aria-label="Nombre de la tinta">
        <input type="text" class="hex" value="${ink.color}" maxlength="7" aria-label="Color en hexadecimal">
        <button class="icon-btn rm" title="Quitar tinta" aria-label="Quitar tinta" ${state.inks.length < 2 ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </div>
      <div class="chips">${SWATCHES.map(([n, c]) => `<button class="chip" style="background:${c}" data-c="${c}" data-n="${n}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
      <div class="curve-box">
        <canvas class="curve" aria-label="Curva de la tinta. Hacé clic para agregar puntos, arrastralos para ajustar y doble clic para quitarlos."></canvas>
        <span class="readout" aria-hidden="true"></span>
      </div>
      <div class="curve-foot">
        <span>Curva</span>
        <select class="preset" aria-label="Curva">
          ${Object.entries(CURVE_PRESETS)
          .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
          .join('')}
          <option value="custom" disabled>Personalizada</option>
        </select>
      </div>`;
      inksEl.appendChild(el);
      const presetSel = el.querySelector('.preset');
      presetSel.value = ink.preset;
      const redraw = attachCurve(
        el.querySelector('.curve'),
        ink,
        el.querySelector('.readout'),
        () => {
          if (ink.preset !== 'custom') {
            ink.preset = 'custom';
            presetSel.value = 'custom';
          }
        },
      );
      const colorIn = el.querySelector('input[type=color]'),
        hexIn = el.querySelector('.hex'),
        nameIn = el.querySelector('.name');
      const setColor = (c, name) => {
        ink.color = c;
        colorIn.value = c;
        hexIn.value = c;
        el.style.setProperty('--ink', c);
        ink.name = name;
        nameIn.value = name;
        redraw();
        scheduleRender();
      };
      colorIn.addEventListener('input', () => setColor(colorIn.value, 'Personalizado'));
      hexIn.addEventListener('change', () => {
        let v = hexIn.value.trim();
        if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9a-f]{6}$/i.test(v)) setColor(v.toLowerCase(), 'Personalizado');
        else hexIn.value = ink.color;
      });
      nameIn.addEventListener('input', () => {
        ink.name = nameIn.value;
      });
      el.querySelectorAll('.chip').forEach((b) =>
        b.addEventListener('click', () => setColor(b.dataset.c, b.dataset.n)),
      );
      presetSel.addEventListener('change', () => {
        const p = CURVE_PRESETS[presetSel.value];
        if (!p) return;
        ink.preset = presetSel.value;
        ink.points = p.pts.map((q) => q.slice());
        redraw();
        scheduleRender();
      });
      el.querySelector('.rm').addEventListener('click', () => {
        state.inks.splice(j, 1);
        renderInks();
        scheduleRender();
      });
    });
    document.getElementById('addInk').disabled = state.inks.length >= MAX_INKS;
  }
  document.getElementById('addInk').addEventListener('click', () => {
    if (state.inks.length >= MAX_INKS) return;
    const used = new Set(state.inks.map((i) => i.color));
    const sw = SWATCHES.find((s) => !used.has(s[1])) || SWATCHES[0];
    state.inks.unshift(newInk(sw[0], sw[1], 'campana'));
    renderInks();
    scheduleRender();
  });

  /* ---------- View selector ---------- */
  const viewSeg = document.getElementById('viewSeg');
  viewSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) {
      state.view = b.dataset.v;
      scheduleRender();
    }
  });

  /* ---------- Gray controls ---------- */
  const grayMode = document.getElementById('grayMode'),
    mixer = document.getElementById('mixer');
  const mixIns = {
    r: document.getElementById('mr'),
    g: document.getElementById('mg'),
    b: document.getElementById('mb'),
  };
  const filterBtns = [...document.querySelectorAll('#filters [data-mix]')];
  function syncMixer() {
    for (const k of ['r', 'g', 'b']) {
      mixIns[k].value = state.gray[k];
      document.getElementById('m' + k + 'o').textContent = Math.round(state.gray[k]) + '%';
    }
    const t = state.gray.r + state.gray.g + state.gray.b;
    document.getElementById('mixTotal').textContent =
      `Total ${Math.round(t)}%. Cerca de 100% conserva el brillo general.`;
    filterBtns.forEach((b) => {
      const [r, g, bl] = b.dataset.mix.split(',').map(Number);
      const on =
        Math.abs(r - state.gray.r) < 0.6 &&
        Math.abs(g - state.gray.g) < 0.6 &&
        Math.abs(bl - state.gray.b) < 0.6;
      b.setAttribute('aria-pressed', String(on));
    });
  }
  grayMode.addEventListener('change', () => {
    state.gray.mode = grayMode.value;
    mixer.hidden = grayMode.value !== 'mix';
    recomputeGray();
  });
  for (const k of ['r', 'g', 'b'])
    mixIns[k].addEventListener('input', () => {
      state.gray[k] = +mixIns[k].value;
      syncMixer();
      recomputeGray();
    });
  filterBtns.forEach((b) =>
    b.addEventListener('click', () => {
      const [r, g, bl] = b.dataset.mix.split(',').map(Number);
      Object.assign(state.gray, { r, g, b: bl });
      syncMixer();
      recomputeGray();
    }),
  );

  /* ---------- File input / drop / paste ---------- */
  const fileIn = document.getElementById('file'),
    stage = document.getElementById('stage');
  document.getElementById('openBtn').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', () => {
    loadFile(fileIn.files[0]);
    fileIn.value = '';
  });
  ['dragenter', 'dragover'].forEach((t) =>
    stage.addEventListener(t, (e) => {
      e.preventDefault();
      stage.classList.add('drag');
    }),
  );
  ['dragleave', 'drop'].forEach((t) =>
    stage.addEventListener(t, (e) => {
      e.preventDefault();
      stage.classList.remove('drag');
    }),
  );
  stage.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));
  window.addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (f) loadFile(f);
  });

  /* ---------- Export ---------- */
  const statusEl = document.getElementById('status');
  const setStatus = (t) => {
    statusEl.textContent = t;
  };
  let downloads = null;
  if (window.claude && typeof window.claude.use === 'function')
    window.claude
      .use('downloads')
      .then((d) => {
        downloads = d;
      })
      .catch(() => { });

  function fullCanvas(mode) {
    if (!fullIdx) fullIdx = computeIdx(full);
    const c = document.createElement('canvas');
    c.width = full.w;
    c.height = full.h;
    const ctx = c.getContext('2d'),
      out = ctx.createImageData(full.w, full.h);
    paint(full, fullIdx, mode, out);
    ctx.putImageData(out, 0, 0);
    return c;
  }
  const toBlob = (c) => new Promise((res) => c.toBlob(res, 'image/png'));
  const slug = (s) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'imagen';

  async function save(filename, blob) {
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
        setStatus(`Guardado: ${filename}`);
      } catch (err) {
        setStatus(
          err && err.code === 'declined'
            ? 'Descarga cancelada.'
            : 'No se pudo guardar el archivo en esta vista.',
        );
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setStatus(`Guardado: ${filename}`);
  }
  const expBtns = ['expDuo', 'expGray', 'expZip'].map((id) => document.getElementById(id));
  async function withBusy(btn, fn) {
    if (!full) return;
    const lbl = btn.querySelector('.lbl'),
      t = lbl.textContent;
    expBtns.forEach((b) => (b.disabled = true));
    lbl.textContent = 'Procesando…';
    await new Promise((r) => setTimeout(r, 30));
    try {
      buildLUT();
      await fn();
    } finally {
      expBtns.forEach((b) => (b.disabled = false));
      lbl.textContent = t;
    }
  }
  expBtns[0].addEventListener('click', (e) =>
    withBusy(e.currentTarget, async () => {
      await save(`${slug(state.name)}-duotono.png`, await toBlob(fullCanvas('result')));
    }),
  );
  expBtns[1].addEventListener('click', (e) =>
    withBusy(e.currentTarget, async () => {
      await save(`${slug(state.name)}-gris.png`, await toBlob(fullCanvas('gray')));
    }),
  );
  expBtns[2].addEventListener('click', (e) =>
    withBusy(e.currentTarget, async () => {
      if (typeof JSZip === 'undefined') {
        setStatus('No se pudo cargar el compresor. Descargá cada imagen por separado.');
        return;
      }
      const zip = new JSZip(),
        base = slug(state.name);
      zip.file(`${base}-duotono.png`, await toBlob(fullCanvas('result')));
      zip.file(`${base}-gris.png`, await toBlob(fullCanvas('gray')));
      await save(`${base}-duotono.zip`, await zip.generateAsync({ type: 'blob' }));
    }),
  );

  /* ---------- Init ---------- */
  syncMixer();
  renderInks();
  sampleImage();
})();

