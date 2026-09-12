// Pure, framework-agnostic particle sampling + easing math shared by every
// journey chapter. A "source" is anything drawable to a 2D canvas context —
// an <img> or an offscreen canvas we've rendered text/icons onto — so the
// same sampler builds particle targets for a product photo, a step glyph,
// or a rendered swatch grid.

export function sampleToPoints(source, { sampleW = 160, sampleH, step = 2, alphaThreshold = 80 } = {}) {
  const srcW = source.naturalWidth || source.width;
  const srcH = source.naturalHeight || source.height;
  if (!srcW || !srcH) return [];

  const h = sampleH || Math.round((sampleW * srcH) / srcW);
  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, sampleW, h);
  const { data } = ctx.getImageData(0, 0, sampleW, h);

  const points = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < sampleW; x += step) {
      const i = (y * sampleW + x) * 4;
      const a = data[i + 3];
      if (a < alphaThreshold) continue;
      points.push({
        x: x / sampleW,
        y: y / h,
        color: `rgba(${data[i]},${data[i + 1]},${data[i + 2]},${(a / 255) * 0.95})`,
      });
    }
  }
  return points;
}

// Renders a short line of uppercase text to an offscreen canvas so it can be
// sampled the exact same way as a photo — used for the marquee transition
// beat and any glyph-style station that isn't backed by a product image.
export function textToSource(text, { font = "600 120px 'JetBrains Mono', monospace", padding = 20 } = {}) {
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = font;
  const width = Math.ceil(measure.measureText(text).width) + padding * 2;
  // parseInt(font, 10) would grab the leading font-weight ("600 78px...")
  // instead of the size — pull the number directly in front of "px".
  const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
  const fontSizePx = sizeMatch ? parseFloat(sizeMatch[1]) : 120;
  const height = Math.ceil(fontSizePx * 1.4) + padding * 2;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2);
  return canvas;
}

// One filled silhouette per process step, drawn with plain canvas paths
// (no external icon set) so it rasterizes the same solid way the bold
// JetBrains Mono step digits used to — a dense, chunky shape samples into
// a clean particle cloud at low resolution, where a thin-stroke line icon
// would just fray into scattered dots.
const ICON_DRAWERS = {
  design(ctx, s) {
    // Pencil: a thick round-capped shaft (draws as a filled capsule) plus
    // a triangular tip, mirroring how a pencil is actually held at an angle.
    ctx.lineCap = "round";
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(s * 0.18, s * 0.82);
    ctx.lineTo(s * 0.6, s * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.6, s * 0.4);
    ctx.lineTo(s * 0.88, s * 0.12);
    ctx.lineTo(s * 0.76, s * 0.52);
    ctx.closePath();
    ctx.fill();
  },
  slice(ctx, s) {
    // Three stacked bars — the layer-by-layer slicing the copy describes.
    const barH = s * 0.16;
    const gap = s * 0.14;
    const w = s * 0.76;
    const x = (s - w) / 2;
    [0, 1, 2].forEach((i) => {
      const y = s * 0.16 + i * (barH + gap);
      ctx.beginPath();
      ctx.roundRect(x, y, w, barH, barH * 0.3);
      ctx.fill();
    });
  },
  print(ctx, s) {
    // Printer silhouette: paper tray, body, ejecting sheet.
    ctx.beginPath();
    ctx.roundRect(s * 0.3, s * 0.08, s * 0.4, s * 0.24, s * 0.04);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(s * 0.12, s * 0.34, s * 0.76, s * 0.34, s * 0.06);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(s * 0.28, s * 0.7, s * 0.44, s * 0.22, s * 0.03);
    ctx.fill();
  },
  finish(ctx, s) {
    // A four-point sparkle — the polish/finishing beat.
    const c = s / 2;
    ctx.beginPath();
    ctx.moveTo(c, s * 0.04);
    ctx.quadraticCurveTo(s * 0.58, s * 0.42, s * 0.96, c);
    ctx.quadraticCurveTo(s * 0.58, s * 0.58, c, s * 0.96);
    ctx.quadraticCurveTo(s * 0.42, s * 0.58, s * 0.04, c);
    ctx.quadraticCurveTo(s * 0.42, s * 0.42, c, s * 0.04);
    ctx.closePath();
    ctx.fill();
  },
  ship(ctx, s) {
    // A box with its top flap folded up — ready to go out the door.
    ctx.beginPath();
    ctx.roundRect(s * 0.14, s * 0.32, s * 0.72, s * 0.56, s * 0.05);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.34, s * 0.32);
    ctx.lineTo(s * 0.5, s * 0.06);
    ctx.lineTo(s * 0.66, s * 0.32);
    ctx.closePath();
    ctx.fill();
  },
};

// Renders one of the named step icons to an offscreen canvas at a given
// pixel size, returning the same kind of drawable `source` textToSource
// does — so the exact same sampleToPoints() call that used to sample a
// rendered digit now samples a rendered icon instead.
export function iconToSource(name, { size = 150, padding = 20 } = {}) {
  const draw = ICON_DRAWERS[name];
  const canvas = document.createElement("canvas");
  canvas.width = size + padding * 2;
  canvas.height = size + padding * 2;
  if (!draw) return canvas;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.translate(padding, padding);
  draw(ctx, size);
  return canvas;
}

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t) {
  return t * t * t;
}
