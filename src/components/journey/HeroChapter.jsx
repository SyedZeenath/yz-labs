import { useEffect, useMemo, useRef, useState } from "react";
import { useProducts } from "../../store/products.jsx";
import { textToSource, sampleToPoints, clamp01 } from "../../lib/particleField.js";
import useParticleField from "../../hooks/useParticleField.js";
import useViewportSize from "../../hooks/useViewportSize.js";

const FEATURED_ID = "round-planter";

// Same top position as every other chapter's mark (Catalog, GetNotified,
// GetInTouch) — the whole point is that "STUDIO" reads as the same kind of
// thing as "CATALOG" a screen later, not a smaller, differently-styled
// corner tag.
const HEADING_TOP = 90;

function LeaderLabel({ side, top, label, value, visible }) {
  if (!value) return null;
  const fromRight = side === "right";
  return (
    <div
      className="mono"
      style={{
        position: "absolute",
        [fromRight ? "left" : "right"]: "calc(100% + 28px)",
        top,
        width: 170,
        textAlign: fromRight ? "left" : "right",
        opacity: visible,
        transition: "opacity 300ms ease",
        pointerEvents: "none",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          [fromRight ? "left" : "right"]: -28,
          top: 7,
          width: 28,
          height: 1,
          background: "var(--border-strong)",
        }}
      />
      <p style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, color: "var(--fg-dim)" }}>{value}</p>
    </div>
  );
}

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
      setTargetPoints(sampleToPoints(img, { sampleW: 150, step: 2 }));
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
  // always agree on where the shape actually is).
  const targetBox = useMemo(
    () => ({ x: (viewport.width - box.width) / 2, y: (viewport.height - box.height) / 2, width: box.width, height: box.height }),
    [viewport.width, viewport.height, box.width, box.height]
  );

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

  const particleProgress = entered ? 1 : 0;
  useParticleField({
    canvasRef,
    targetPoints,
    progress: particleProgress,
    width: viewport.width,
    height: viewport.height,
    targetBox,
    particleSize: 1.5,
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
    targetBox: headingTargetBox,
    particleSize: narrow ? 1.3 : 1.8,
  });

  const introOpacity = 1 - clamp01((progress - 0.3) / 0.2);
  const specP = clamp01((progress - 0.45) / 0.15) * (1 - clamp01((progress - 0.85) / 0.15));
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
      <div className="grid-overlay" />

      <canvas
        ref={headingCanvasRef}
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
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

      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 24px 30px rgba(0,0,0,0.55))", pointerEvents: "none" }}
      />

      <div style={{ position: "relative", width: box.width, height: box.height }}>
        {!narrow && (
          <>
            <LeaderLabel side="left" top="14%" label="Material" value={featured?.material} visible={specP} />
            <LeaderLabel side="right" top="40%" label="Dimensions" value={featured?.dims} visible={specP} />
            <LeaderLabel side="left" top="66%" label="Weight" value={featured?.weight} visible={specP} />
            <LeaderLabel side="right" top="88%" label="Price" value={featured ? `₹${featured.price}` : null} visible={specP} />
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
