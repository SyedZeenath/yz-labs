import { useEffect, useMemo, useRef, useState } from "react";
import { useProducts } from "../../store/products.jsx";
import { textToSource, sampleToPoints, clamp01 } from "../../lib/particleField.js";
import useParticleField from "../../hooks/useParticleField.js";
import useAmbientParticles from "../../hooks/useAmbientParticles.js";
import useViewportSize from "../../hooks/useViewportSize.js";
import SpecLabel from "../SpecLabel.jsx";

const FEATURED_ID = "round-planter";

// Slower than useParticleField's own default catch-up (0.06) — this is the
// very first thing a visitor sees, so it's worth lingering on rather than
// resolving as quickly as the scroll-scrubbed formations later in the page.
const HERO_ENTRANCE_CATCH_UP = 0.028;

// Same top position as every other chapter's mark (Catalog, GetNotified,
// GetInTouch) — the whole point is that "STUDIO" reads as the same kind of
// thing as "CATALOG" a screen later, not a smaller, differently-styled
// corner tag.
const HEADING_TOP = 90;

// The Hero chapter of the journey: the featured product assembles from
// scattered particles instead of a video scrubbing. Unlike every later
// chapter, this materialization isn't scroll-scrubbed — it's the very
// first thing a visitor sees, so it has to play on its own as soon as the
// page loads, before anyone has scrolled at all. Everything else in this
// chapter (the intro copy's fade-out, the spec labels, the scroll rail)
// still tracks scroll `progress` exactly as before; only the STUDIO mark
// and the product photo get this one-shot, load-triggered reveal.
export default function HeroChapter({ progress, active, narrow }) {
  const products = useProducts();
  const featured = products.find((p) => p.id === FEATURED_ID);
  const viewport = useViewportSize();

  const canvasRef = useRef(null);
  const [targetPoints, setTargetPoints] = useState(null);
  const [box, setBox] = useState({ width: 300, height: 300 });

  useEffect(() => {
    if (!featured?.heroImage) return;
    const img = new Image();
    img.onload = () => {
      const w = narrow ? 220 : 320;
      const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
      setBox({ width: w, height: h });
      // Coarser than before (was sampleW:150/step:2) — the particle field
      // is now only the transitional entrance; once it settles, a crisp
      // <img> crossfades in over it (see `formed` below), so the dot
      // density here just needs to read as "the product" mid-formation,
      // not carry the final, readable image on its own anymore.
      setTargetPoints(sampleToPoints(img, { sampleW: 130, step: 3 }));
    };
    img.src = featured.heroImage;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured?.heroImage, narrow]);

  // The "STUDIO" mark itself, on its own canvas — the product photo above
  // forms on a separate canvas/target box, so the two particle fields
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

  // Particles scatter from anywhere on screen, not from a cloud hugging the
  // product — the target box just says where on that full canvas the
  // planter itself should resolve, vertically centered the same way the
  // small wrapper below is (so the label anchors and the drawn particles
  // always agree on where the shape actually is) — but never higher than
  // clear of the intro copy block above it. Dead-centering in the full
  // viewport was fine while the product only ever rendered as a sparse,
  // partly-transparent particle field (the headline showing through its
  // gaps was barely noticeable); now that it settles into an opaque
  // photo, the same centering let it flatly cover "Objects, printed
  // layer by layer." on every viewport size tested, desktop included.
  // 246 is a generous estimate of the intro block's own height (eyebrow +
  // up to a two-line clamp(26px,3.6vw,44px) heading + margin) — there's no
  // ref-measured value for it, so this errs toward too much clearance
  // rather than too little. The lower clamp keeps it from being pushed
  // past the bottom edge entirely on short viewports where both can't be
  // fully satisfied — clearing the headline wins (it's the one the brief
  // calls out by name), the SCROLL hint at the very bottom may lose a
  // little clearance there, but it's a small, low-emphasis affordance
  // that fades out within the first few percent of scroll anyway.
  const targetBox = useMemo(() => {
    const centeredY = (viewport.height - box.height) / 2;
    const clearOfIntro = HEADING_TOP + headingBoxH + 246;
    const y = Math.min(Math.max(centeredY, clearOfIntro), viewport.height - box.height - 24);
    return { x: (viewport.width - box.width) / 2, y, width: box.width, height: box.height };
  }, [viewport.width, viewport.height, box.width, box.height, headingBoxH]);

  // Fires once both particle sets have real points to scatter — waiting
  // for that (rather than firing immediately on mount) means the product
  // photo and the heading are still genuinely scattered the moment this
  // flips, so useParticleField's own catch-up easing plays a real
  // materialize animation instead of appearing pre-formed. Deliberately
  // not tied to scroll `progress` at all: this chapter is what a visitor
  // sees before they've scrolled anywhere, so it has to reveal itself.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!targetPoints || !headingTargetPoints || entered) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [targetPoints, headingTargetPoints, entered]);

  // Once the product's particle field settles, it crossfades into a real
  // <img> (see the render below) — dots are inherently lower-fidelity than
  // the actual photo, and the brief wants the product "consistently
  // readable," not just recognizable mid-formation.
  const [formed, setFormed] = useState(false);
  const particleProgress = entered ? 1 : 0;
  useParticleField({
    canvasRef,
    targetPoints,
    progress: particleProgress,
    width: viewport.width,
    height: viewport.height,
    targetBox,
    particleSize: 1.5,
    catchUp: HERO_ENTRANCE_CATCH_UP,
    onSettle: (v) => {
      if (v >= 0.999) setFormed(true);
    },
  });

  // Forms alongside the product photo above, same as Catalog's "CATALOG"
  // mark — it's the chapter's own persistent mark, not part of the intro
  // copy's fade-out below.
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

  const introOpacity = 1 - clamp01((progress - 0.3) / 0.2);
  const specP = clamp01((progress - 0.45) / 0.15) * (1 - clamp01((progress - 0.85) / 0.15));
  const railP = progress;

  // The settled photo and the intro copy ("Objects, printed...") sit in
  // the same region of the screen — scrolling back up to the very top
  // (progress ~ 0, introOpacity at its max) used to show both at once,
  // photo behind text, which read as an overlap. Rather than moving or
  // resizing either one, they're made mutually exclusive: the photo's
  // opacity is the intro copy's own opacity inverted, so it only becomes
  // visible once the text has actually faded out, and reappears hidden the
  // instant you scroll back up and the text comes back. Before the photo
  // has even settled (`!formed`), it stays at 0 either way — nothing to
  // show yet.
  const imgOpacity = formed ? clamp01(1 - introOpacity) : 0;

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
        style={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)", width: 1, height: 160, background: "var(--border)" }}
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

      <div
        style={{
          position: "absolute",
          top: HEADING_TOP + headingBoxH + 32,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(90vw, 460px)",
          textAlign: "center",
          opacity: introOpacity,
          pointerEvents: introOpacity > 0.05 ? "auto" : "none",
        }}
      >
        <div className="eyebrow" style={{ justifyContent: "center", marginBottom: 16 }}>
          Small-batch 3D print studio
        </div>
        <h1 style={{ fontSize: "clamp(26px, 3.6vw, 44px)", lineHeight: 1.1, textTransform: "uppercase" }}>
          Objects, printed
          <br />
          layer by layer.
        </h1>
      </div>

      {/* Restrained blue rim light — reads as light the photo is catching,
          so it fades with the same imgOpacity the photo itself uses. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: targetBox.x - targetBox.width * 0.18,
          top: targetBox.y - targetBox.height * 0.18,
          width: targetBox.width * 1.36,
          height: targetBox.height * 1.36,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(61,107,255,0.16), rgba(61,107,255,0.05) 55%, transparent 75%)",
          opacity: imgOpacity,
          transition: "opacity 600ms ease",
          pointerEvents: "none",
        }}
      />

      {/* Stands in for the photo whenever the photo itself is hidden — not
          just pre-settle, but also whenever the intro copy is occupying
          this same spot (see `imgOpacity`) — so the settled shape stays
          visible as particles instead of leaving nothing on screen while
          the text is up front. */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          filter: "drop-shadow(0 24px 30px rgba(0,0,0,0.55))",
          pointerEvents: "none",
          opacity: entered ? 1 - imgOpacity : 0,
          transition: "opacity 600ms ease",
        }}
      />

      {/* The particle field stands in whenever this is hidden — see
          `imgOpacity` above for why that's not simply "once settled." */}
      {featured?.heroImage && (
        <img
          src={featured.heroImage}
          alt={featured.name}
          style={{
            position: "absolute",
            left: targetBox.x,
            top: targetBox.y,
            width: targetBox.width,
            height: targetBox.height,
            objectFit: "contain",
            filter: "drop-shadow(0 24px 30px rgba(0,0,0,0.55))",
            opacity: imgOpacity,
            transition: "opacity 600ms ease",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Positioned to match targetBox exactly, not flex-centered like it
          used to be — targetBox stopped being simple viewport-center once
          it started clamping to clear the intro text above (see the
          targetBox comment), so this anchor has to track it explicitly or
          the spec labels drift away from the product they're labeling. */}
      <div style={{ position: "absolute", left: targetBox.x, top: targetBox.y, width: targetBox.width, height: targetBox.height }}>
        {!narrow && (
          <>
            <SpecLabel side="left" top="14%" label="Material" value={featured?.material} visible={specP} />
            <SpecLabel side="right" top="40%" label="Dimensions" value={featured?.dims} visible={specP} />
            <SpecLabel side="left" top="66%" label="Weight" value={featured?.weight} visible={specP} />
            <SpecLabel side="right" top="88%" label="Price" value={featured ? `₹${featured.price}` : null} visible={specP} />
          </>
        )}
      </div>

      {narrow && (
        <div
          className="mono"
          style={{
            position: "absolute",
            bottom: "16%",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 18,
            fontSize: 11,
            color: "var(--fg-dim)",
            opacity: specP,
            textAlign: "center",
          }}
        >
          <span>{featured?.material}</span>
          <span style={{ color: "var(--muted)" }}>·</span>
          <span>{featured?.dims}</span>
          <span style={{ color: "var(--muted)" }}>·</span>
          <span>₹{featured?.price}</span>
        </div>
      )}

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
        SCROLL
      </div>
    </div>
  );
}
