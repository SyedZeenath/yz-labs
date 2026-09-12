import { useEffect, useMemo, useRef, useState } from "react";
import { textToSource, sampleToPoints, clamp01 } from "../lib/particleField.js";
import useParticleField from "../hooks/useParticleField.js";
import useViewportSize from "../hooks/useViewportSize.js";

const START_VH = 1.0;
const END_VH = 0.55;

// The catalog chapter's "02 / CATALOG" heading scatters particles across
// the whole pinned viewport and converges them into the text — dramatic
// because the canvas genuinely covers the screen, not just a padded box
// around the letters. This is that same effect for a section that isn't
// pinned: the canvas is position:fixed (truly viewport-relative, so it
// covers the current screen at any scroll position) while the reveal is
// in progress, targeting the exact screen spot the real, normal-flow
// heading will occupy once scrolled to rest — so when the reveal
// completes, swapping from "fixed overlay" to "real heading" is invisible,
// and scrolling past just continues normally from there.
export default function FullScreenParticleHeading({ text, font }) {
  const viewport = useViewportSize();
  const narrow = viewport.width < 640;
  const anchorRef = useRef(null);
  const canvasRef = useRef(null);
  const [source, setSource] = useState(null);
  const [progress, setProgress] = useState(0);
  const [anchorX, setAnchorX] = useState(0);

  const resolvedFont = font || `700 ${narrow ? 40 : 84}px 'JetBrains Mono', monospace`;

  useEffect(() => {
    setSource(textToSource(text, { font: resolvedFont }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, resolvedFont]);

  const targetPoints = useMemo(
    () => (source ? sampleToPoints(source, { sampleW: narrow ? 260 : 480, step: 1, alphaThreshold: 40 }) : null),
    [source, narrow]
  );
  const boxW = source ? source.width : 0;
  const boxH = source ? source.height : 0;

  useEffect(() => {
    function measure() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setAnchorX(rect.left);
      const vh = window.innerHeight;
      const start = vh * START_VH;
      const end = vh * END_VH;
      setProgress(clamp01((start - rect.top) / (start - end)));
    }
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const id = setInterval(measure, 150);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      clearInterval(id);
    };
  }, []);

  const targetBox = useMemo(
    () => ({ x: anchorX, y: viewport.height * END_VH, width: boxW, height: boxH }),
    [anchorX, viewport.height, boxW, boxH]
  );

  useParticleField({
    canvasRef,
    targetPoints,
    progress: clamp01(progress),
    width: viewport.width,
    height: viewport.height,
    targetBox,
    particleSize: narrow ? 1.4 : 2,
  });

  const formed = progress >= 0.999;
  // progress sits at exactly 0 the entire time the section is nowhere near
  // the viewport (anchor still hundreds or thousands of px below) — not
  // just right before it arrives. A fixed, viewport-covering canvas has no
  // natural way to stay out of the way on its own, so without gating on
  // this too it renders scattered particles over every earlier section
  // (Hero, Catalog, Process, Materials) from the moment the page loads,
  // reading as "stuck" rather than as an entrance that hasn't started yet.
  const active = progress > 0 && !formed;

  return (
    <>
      {/* Reserves real layout space and carries the real, accessible text
          at all times — visually hidden while the fixed overlay is doing
          the reveal (its screen position is what the overlay targets),
          shown once the reveal lands so the page keeps normal flow after. */}
      <div ref={anchorRef} style={{ height: boxH || undefined }}>
        <h2
          style={
            formed
              ? { margin: 0 }
              : { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }
          }
        >
          {text}
        </h2>
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 45, opacity: active ? 1 : 0 }}
      />
    </>
  );
}
