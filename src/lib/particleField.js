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

// Samples line-art on a black backdrop (the round YZ Labs logo) into points:
// only the marks themselves become particles, never the black disc behind
// them. sampleToPoints() can't do that — it keeps every opaque pixel, which
// for this logo would be the whole disc.
//
// `size` is the width/height, in samples, of the whole disc image; pick it so
// each sample lands on exactly one screen pixel (or a whole number of them).
// That 1:1 mapping is what keeps the settled logo crisp: thin strokes (the
// source lines are ~1px at typical sizes) otherwise straddle pixel
// boundaries and break up. To keep those thin strokes from fading out in the
// downscale, the image is rendered at 2x and each output pixel takes the
// brightest of its 2x2 block (max-pooling) rather than an average, and
// colours are used opaque, as sampled, so edges keep their natural
// anti-aliasing instead of being dimmed a second time by a transparency
// ramp.
//
// Returns { points, width, height }: points are normalised (0..1) within a
// box CROPPED to the marks — `width`/`height` are that box's size in
// samples — so the caller can size and place the logo by what's actually
// visible, not by the empty margin the disc leaves around it. The crop is
// symmetric about the disc's vertical axis (the top mark, cube, YZ and LABS
// all sit on it), so centring the box centres the logo's axis; only the
// height is trimmed tight to the marks.
//
// The logo PNG has transparent corners, so the disc's edge is already
// defined by alpha — no extra masking needed (an earlier radius mask
// centred on the image clipped the logo's top mark, because the disc isn't
// centred in the PNG).
export function sampleLogoToPoints(source, { size = 420, minLuminance = 22 } = {}) {
  const hi = size * 2;
  const canvas = document.createElement("canvas");
  canvas.width = hi;
  canvas.height = hi;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // The source is far larger than `hi`, and its lines are only a few
  // source pixels thick — default (low-quality) downscaling would skip over
  // them and leave the strokes broken up.
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, hi, hi);
  const { data } = ctx.getImageData(0, 0, hi, hi);

  const marks = [];
  // Bounds of the opaque disc itself: the PNG's transparent margin is
  // uneven, so the disc — and with it the logo's central axis — sits a
  // little off the image's own centre. Measured so the crop below can be
  // centred on the axis.
  let discMinX = size;
  let discMaxX = -1;
  // Bounds of the marks.
  let minX = size;
  let maxX = -1;
  let minY = size;
  let maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let best = -1;
      let bestLum = -1;
      let opaque = false;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = ((y * 2 + dy) * hi + (x * 2 + dx)) * 4;
          if (data[i + 3] < 128) continue;
          opaque = true;
          const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          if (lum > bestLum) {
            bestLum = lum;
            best = i;
          }
        }
      }
      if (!opaque) continue;
      if (x < discMinX) discMinX = x;
      if (x > discMaxX) discMaxX = x;
      if (bestLum < minLuminance) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      marks.push({ x, y, color: `rgb(${data[best]},${data[best + 1]},${data[best + 2]})` });
    }
  }
  if (maxX < 0) return { points: [], width: 0, height: 0 };

  const axisX = (discMinX + discMaxX + 1) / 2;
  const halfW = Math.max(axisX - minX, maxX + 1 - axisX);
  // Whole samples, so every point stays on the pixel grid.
  const x0 = Math.round(axisX - halfW);
  const width = Math.round(axisX + halfW) - x0;
  const height = maxY + 1 - minY;

  // Ordered by colour: only a few hundred distinct shades exist across tens
  // of thousands of points, and useParticleField skips re-setting the fill
  // colour between consecutive same-coloured particles — this ordering is
  // what makes that skip pay off. Draw order is otherwise irrelevant here
  // (nothing overlaps, and the scatter origins are random).
  marks.sort((a, b) => (a.color < b.color ? -1 : a.color > b.color ? 1 : 0));
  return {
    points: marks.map((p) => ({ x: (p.x - x0) / width, y: (p.y - minY) / height, color: p.color })),
    width,
    height,
  };
}

// Several centred lines of text on one offscreen canvas, so a multi-line
// headline can be sampled as a single shape (textToSource below is one line
// only). `font` should already carry the exact pixel size the canvas is to
// be drawn at — pass device pixels to sample 1:1 with the screen.
export function textLinesToSource(lines, { font, lineHeight = 1.1, padding = 6, letterSpacing = "0px" } = {}) {
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = font;
  if ("letterSpacing" in measure) measure.letterSpacing = letterSpacing;
  const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
  const fontPx = sizeMatch ? parseFloat(sizeMatch[1]) : 16;
  const widest = Math.max(...lines.map((l) => measure.measureText(l).width));
  const lineH = fontPx * lineHeight;
  const width = Math.ceil(widest) + padding * 2;
  const height = Math.ceil(lineH * lines.length) + padding * 2;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  if ("letterSpacing" in ctx) ctx.letterSpacing = letterSpacing;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  lines.forEach((line, i) => ctx.fillText(line, width / 2, padding + lineH * (i + 0.5)));
  return canvas;
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

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
