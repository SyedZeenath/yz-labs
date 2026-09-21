import { useEffect, useMemo, useRef, useState } from "react";
import { textToSource, textLinesToSource, sampleToPoints, sampleLogoToPoints, clamp01 } from "../../lib/particleField.js";
import useParticleField from "../../hooks/useParticleField.js";
import useAmbientParticles from "../../hooks/useAmbientParticles.js";
import useViewportSize from "../../hooks/useViewportSize.js";

const LOGO_SRC = "/logo-circle.png";

// Slower than useParticleField's own default catch-up (0.06) — this is the
// very first thing a visitor sees, so it's worth lingering on rather than
// resolving as quickly as the scroll-scrubbed formations later in the page.
const HERO_ENTRANCE_CATCH_UP = 0.028;

// How long the non-particle parts of the hero (tagline, rail, scroll
// hint) take to come in — long enough to feel like part of the same
// materializing beat as the particles, not a separate UI fade.
const REVEAL_MS = 1400;

// Same top position as every other chapter's mark (Catalog, GetNotified,
// GetInTouch) — the whole point is that "STUDIO" reads as the same kind of
// thing as "CATALOG" a screen later, not a smaller, differently-styled
// corner tag.
const HEADING_TOP = 90;

// How far the tagline is pulled up into the STUDIO mark's own box (that
// box carries empty padding around the letters, so stacking flush under it
// left a needlessly wide gap).
const INTRO_PULL_UP = 8;

// Breathing room between the headline and the logo, the space kept clear at
// the bottom for the SCROLL hint, the smallest the logo may shrink to (below
// that its finest strokes stop reading), and the size increments it snaps to.
const LOGO_GAP = 16;
const BOTTOM_RESERVE = 48;
const MIN_LOGO = 140;
const LOGO_STEP = 20;

// Facts about logo-circle.png, measured from the image: the marks occupy
// about 86% of the disc's height, and the cropped box is ~0.9x as wide as
// it is tall. Only used to size the logo before it has been sampled; the
// sampled result reports its exact dimensions.
const LOGO_CONTENT_H = 0.864;
const LOGO_ASPECT = 0.903;

// Upper bound on samples across the logo's disc image (its point count
// grows with the square of this), and on the headline's point count at full
// density — past either, sampling steps down to every other screen pixel.
const MAX_LOGO_SAMPLES = 700;
const HEADLINE_MAX_POINTS = 16000;

// The Hero chapter of the journey: the YZ Labs logo assembles from
// scattered particles. Unlike every later chapter, this materialization
// isn't scroll-scrubbed — it's the very first thing a visitor sees, so it
// has to play on its own as soon as the page loads, before anyone has
// scrolled at all. Everything here (STUDIO mark, headline, logo, tagline,
// rail) comes in together off that one load-triggered reveal and then
// stays put — the whole hero leaves together through Journey's chapter exit
// rather than piece by piece. Only the scroll rail's fill and the SCROLL
// hint track scroll `progress`.
export default function HeroChapter({ progress, active, narrow }) {
  const viewport = useViewportSize();

  // Device pixel ratio, capped at 2 like useParticleField's own canvas. Every
  // particle shape below is sampled on this grid and placed on whole screen
  // pixels (`snap`), so settled shapes are as sharp as real text or a raster
  // image instead of being smeared by the canvas's anti-aliasing.
  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
  const snap = (v) => Math.round(v * dpr) / dpr;

  const canvasRef = useRef(null);

  // Loaded once and kept: resampling for a new size (see below) reuses this
  // already-decoded element instead of re-fetching and re-decoding the
  // 5224px-wide PNG each time.
  const [logoImg, setLogoImg] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLogoImg(img);
    };
    img.src = LOGO_SRC;
    return () => {
      cancelled = true;
    };
  }, []);

  // The "STUDIO" mark itself, on its own canvas — the headline and the logo
  // below each form on their own canvas/target box, so the particle fields
  // never compete for the same points.
  const headingCanvasRef = useRef(null);
  const [headingSource, setHeadingSource] = useState(null);

  useEffect(() => {
    setHeadingSource(textToSource("STUDIO", { font: `700 ${narrow ? 28 : 48}px 'JetBrains Mono', monospace` }));
  }, [narrow]);

  const headingTargetPoints = useMemo(
    () => (headingSource ? sampleToPoints(headingSource, { sampleW: narrow ? 220 : 360, step: 1, alphaThreshold: 40 }) : null),
    [headingSource, narrow]
  );
  const headingBoxW = headingSource ? headingSource.width : 0;
  const headingBoxH = headingSource ? headingSource.height : 0;
  const headingTargetBox = useMemo(
    () => ({ x: (viewport.width - headingBoxW) / 2, y: HEADING_TOP, width: headingBoxW, height: headingBoxH }),
    [viewport.width, headingBoxW, headingBoxH]
  );

  // "Objects, printed / layer by layer." as particles. Drawn to an offscreen
  // canvas in the same font, weight and (screen-width-scaled) size the DOM
  // <h1> used to have, at DEVICE-pixel resolution, then sampled 1:1. The
  // size is rounded to whole pixels so a window resize re-samples it a few
  // times, not on every pixel of width.
  const headlineCanvasRef = useRef(null);
  const headlineCss = Math.round(Math.min(44, Math.max(26, viewport.width * 0.036)));
  const [headlineSource, setHeadlineSource] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const px = headlineCss * dpr;
    const font = `800 ${px}px Sora, system-ui, sans-serif`;
    // Drawing before the web font has arrived would bake the fallback
    // typeface into the particles for good — wait for it.
    const build = () => {
      if (cancelled) return;
      setHeadlineSource(
        textLinesToSource(["OBJECTS, PRINTED", "LAYER BY LAYER."], {
          font,
          lineHeight: 1.1,
          letterSpacing: `${(-0.01 * px).toFixed(2)}px`,
          padding: Math.round(4 * dpr),
        })
      );
    };
    if (typeof document !== "undefined" && document.fonts?.load) document.fonts.load(font, "OBJECTS").then(build, build);
    else build();
    return () => {
      cancelled = true;
    };
  }, [headlineCss, dpr]);

  // Full density (one point per screen pixel) keeps the letters crisp; if
  // that would be too many points (large text on a dense screen), fall back
  // to every other pixel with correspondingly bigger particles.
  const headline = useMemo(() => {
    if (!headlineSource) return null;
    let step = 1;
    let points = sampleToPoints(headlineSource, { sampleW: headlineSource.width, step, alphaThreshold: 90 });
    if (points.length > HEADLINE_MAX_POINTS) {
      step = 2;
      points = sampleToPoints(headlineSource, { sampleW: headlineSource.width, step, alphaThreshold: 90 });
    }
    return { points, step, width: headlineSource.width / dpr, height: headlineSource.height / dpr };
  }, [headlineSource, dpr]);

  // Vertical stack under the STUDIO mark: tagline (real text, measured),
  // then the headline particles, then the logo in whatever room is left.
  // Nothing here is a guessed height — the eyebrow is measured from the DOM
  // and the rest come from the sampled shapes themselves — because a fixed
  // estimate plus a fixed-size logo is what let the logo run into "BY
  // LAYER." on wide-but-short windows (a 1920x1080 laptop at 125% scaling is
  // only ~730px tall).
  const introRef = useRef(null);
  const slotRef = useRef(null);
  const [slotTop, setSlotTop] = useState(0);
  useEffect(() => {
    const slot = slotRef.current;
    const intro = introRef.current;
    if (!slot || !intro) return;
    const measure = () => setSlotTop(slot.offsetTop);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(intro);
    return () => ro.disconnect();
  }, []);

  const introTop = HEADING_TOP + headingBoxH - INTRO_PULL_UP;
  const headlineBox = useMemo(
    () => ({
      x: snap((viewport.width - (headline?.width ?? 0)) / 2),
      y: snap(introTop + slotTop),
      width: headline?.width ?? 0,
      height: headline?.height ?? 0,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewport.width, introTop, slotTop, headline, dpr]
  );

  // The logo gets the vertical space left under the headline (minus room for
  // the SCROLL hint), up to a per-screen ceiling, centred in it. The PNG's
  // marks fill only ~86% of the disc's height and ~90% of that in width, so
  // it is sampled cropped to the marks themselves (see sampleLogoToPoints) —
  // otherwise that empty margin would eat the very space the logo needs.
  // Sampled 1 point per screen pixel where that keeps the particle count
  // sane; on very large logos / dense screens it steps down to 1 point per
  // 2 screen pixels (still solid: the strokes are several pixels thick by
  // then). Stepped to whole LOGO_STEP increments so dragging a window edge
  // re-samples (and re-forms) the logo a handful of times, not on every
  // pixel of resize.
  const layoutReady = slotTop > 0 && headingBoxH > 0 && !!headline;
  const bandTop = introTop + slotTop + (headline?.height ?? 0) + LOGO_GAP;
  const bandH = viewport.height - bandTop - BOTTOM_RESERVE;
  // (Phones are limited by width rather than this ceiling: the 0.8 * width
  // term below caps them at about 340px on a 390px-wide screen.)
  const maxLogoH = narrow ? 360 : Math.min(720, Math.max(420, viewport.height * 0.55));
  const fittedH = Math.min(maxLogoH, bandH, (viewport.width * 0.8) / LOGO_ASPECT);
  const wantH = Math.max(MIN_LOGO, Math.floor(fittedH / LOGO_STEP) * LOGO_STEP);
  const discSamplesNeeded = (wantH * dpr) / LOGO_CONTENT_H;
  const logoK = Math.max(1, Math.ceil(discSamplesNeeded / MAX_LOGO_SAMPLES));
  const logoSamples = Math.round(discSamplesNeeded / logoK);
  const cssPerSample = logoK / dpr;

  // Waits for the layout to be measurable, so the very first sample is
  // already the right size for this screen (not a default that then gets
  // immediately re-sampled).
  const [logo, setLogo] = useState(null);
  useEffect(() => {
    if (!logoImg || !layoutReady) return;
    setLogo({ ...sampleLogoToPoints(logoImg, { size: logoSamples }), cssPerSample });
  }, [logoImg, layoutReady, logoSamples, cssPerSample]);

  const logoW = logo ? logo.width * logo.cssPerSample : wantH * LOGO_ASPECT;
  const logoH = logo ? logo.height * logo.cssPerSample : wantH;
  const targetBox = useMemo(
    () => ({
      x: snap((viewport.width - logoW) / 2),
      y: snap(bandTop + Math.max(0, (bandH - logoH) / 2)),
      width: logoW,
      height: logoH,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewport.width, bandTop, bandH, logoW, logoH, dpr]
  );

  // Fires once every particle set has real points to scatter — waiting
  // for that (rather than firing immediately on mount) means the logo, the
  // headline and the STUDIO mark are still genuinely scattered the moment
  // this flips, so useParticleField's own catch-up easing plays a real
  // materialize animation instead of appearing pre-formed. Deliberately
  // not tied to scroll `progress` at all: this chapter is what a visitor
  // sees before they've scrolled anywhere, so it has to reveal itself.
  const [entered, setEntered] = useState(false);
  const logoPoints = logo ? logo.points : null;
  const headlinePoints = headline ? headline.points : null;
  useEffect(() => {
    if (!logoPoints || !headingTargetPoints || !headlinePoints || entered) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [logoPoints, headingTargetPoints, headlinePoints, entered]);

  // Everything on this screen enters off that one `entered` flip, so the
  // STUDIO mark, the headline, the logo, the tagline and the rail all start
  // at the same instant rather than one after another. The tagline (the
  // only part that's still plain text) gets a rise + un-blur, echoing the
  // particles materializing beside it.
  const revealStyle = {
    opacity: entered ? 1 : 0,
    transform: entered ? "translateY(0)" : "translateY(18px)",
    filter: entered ? "blur(0)" : "blur(6px)",
    transition: `opacity ${REVEAL_MS}ms ease, transform ${REVEAL_MS}ms cubic-bezier(0.16,1,0.3,1), filter ${REVEAL_MS}ms ease`,
  };

  const particleProgress = entered ? 1 : 0;
  useParticleField({
    canvasRef,
    targetPoints: logoPoints,
    progress: particleProgress,
    width: viewport.width,
    height: viewport.height,
    targetBox,
    // Exactly one sample's worth of screen, uniform: the logo is sampled on
    // a pixel grid, so any larger or varied size would blur and rag it.
    particleSize: cssPerSample,
    uniformSize: true,
    catchUp: HERO_ENTRANCE_CATCH_UP,
  });

  useParticleField({
    canvasRef: headlineCanvasRef,
    targetPoints: headlinePoints,
    progress: particleProgress,
    width: viewport.width,
    height: viewport.height,
    targetBox: headlineBox,
    particleSize: (headline?.step ?? 1) / dpr,
    uniformSize: true,
    catchUp: HERO_ENTRANCE_CATCH_UP,
  });

  // Forms alongside the logo above, same as Catalog's "CATALOG"
  // mark — it's the chapter's own persistent mark.
  const headingP = entered ? 1 : 0;
  useParticleField({
    canvasRef: headingCanvasRef,
    targetPoints: headingTargetPoints,
    progress: headingP,
    width: viewport.width,
    height: viewport.height,
    catchUp: HERO_ENTRANCE_CATCH_UP,
    targetBox: headingTargetBox,
    particleSize: narrow ? 1.3 : 1.8,
  });

  // A restrained, continuously-drifting dust layer — separate from the
  // one-shot formation fields above. Kept dim and slow on purpose ("quiet
  // scene", not "particle explosion"), dimmed further still behind the
  // headline/logo band so it never competes with either for legibility,
  // and only responds to the pointer once it exists (see useAmbientParticles
  // — touch devices get no pointer influence at all, nothing to skip here).
  const ambientCanvasRef = useRef(null);
  const protectedRect = useMemo(
    () => ({ x: 0, y: 0, width: viewport.width, height: HEADING_TOP + headingBoxH + 40 }),
    [viewport.width, headingBoxH]
  );
  useAmbientParticles({
    canvasRef: ambientCanvasRef,
    width: viewport.width,
    height: viewport.height,
    count: narrow ? 22 : 46,
    baseOpacity: 0.2,
    protectedRect,
    active,
  });

  const railP = progress;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: active ? "auto" : "none",
      }}
    >
      {/* Reduced opacity for this instance only (the shared .grid-overlay
          class stays at its normal contrast everywhere else) — a "quieter,
          mostly black scene" was one of the explicit goals here. */}
      <div className="grid-overlay" style={{ opacity: 0.55 }} />

      <canvas
        ref={ambientCanvasRef}
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      <canvas
        ref={headingCanvasRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: entered ? 1 : 0,
          transition: "opacity 900ms ease",
        }}
      />

      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 28,
          top: "50%",
          transform: "translateY(-50%)",
          width: 1,
          height: 160,
          background: "var(--border)",
          opacity: entered ? 1 : 0,
          transition: `opacity ${REVEAL_MS}ms ease`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1,
            height: "100%",
            background: "var(--accent)",
            transform: `scaleY(${railP})`,
            transformOrigin: "top",
          }}
        />
      </div>

      {/* Real heading for screen readers and search — the visible one is
          the particle canvas below, which has no text of its own. */}
      <h1
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
        }}
      >
        Objects, printed layer by layer.
      </h1>

      {/* No scroll-linked fade of its own: the tagline and headline stay up
          for as long as the STUDIO mark and the logo do, and the whole hero
          leaves together via Journey's chapter exit. Fading the copy out
          early used to leave the mark and the logo sitting alone with an
          empty gap between them. The empty slot reserves the headline's
          space in the flow (its particles are drawn on the canvas below,
          positioned from this slot's measured offset). */}
      <div
        ref={introRef}
        style={{
          position: "absolute",
          top: introTop,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(90vw, 460px)",
          textAlign: "center",
        }}
      >
        <div className="eyebrow" style={{ justifyContent: "center", marginBottom: 16, ...revealStyle }}>
          Small-batch 3D print studio
        </div>
        <div ref={slotRef} aria-hidden style={{ height: headline ? headline.height : 0 }} />
      </div>

      <canvas
        ref={headlineCanvasRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: entered ? 1 : 0,
          transition: "opacity 900ms ease",
        }}
      />

      {/* The logo, as particles. The canvas spans the whole viewport (the
          particles scatter from anywhere on screen), so the accessible
          name lives here rather than on anything sized to the logo. */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="YZ Labs logo"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: entered ? 1 : 0,
          transition: "opacity 600ms ease",
        }}
      />

      <div
        className="mono"
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11,
          color: "var(--muted)",
          letterSpacing: "0.14em",
          opacity: 1 - clamp01(progress / 0.08),
        }}
      >
        <div style={{ opacity: entered ? 1 : 0, transition: `opacity ${REVEAL_MS}ms ease` }}>SCROLL</div>
      </div>
    </div>
  );
}
