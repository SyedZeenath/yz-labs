import { useEffect, useMemo, useRef, useState } from "react";
import { textToSource, iconToSource, sampleToPoints, clamp01 } from "../../lib/particleField.js";
import useParticleField from "../../hooks/useParticleField.js";
import useViewportSize from "../../hooks/useViewportSize.js";

const STEPS = [
  { n: "01", icon: "design", title: "Design", desc: "Every object starts as a parametric CAD model, tuned for print orientation and wall strength." },
  { n: "02", icon: "slice", title: "Slice", desc: "Layer height, infill and wall count are tuned per part, not one preset for everything." },
  { n: "03", icon: "print", title: "Print", desc: "FDM printers run the batch, layer by layer, over hours, not minutes." },
  { n: "04", icon: "finish", title: "Finish", desc: "Supports removed, edges sanded, surfaces sealed by hand in the studio." },
  { n: "05", icon: "ship", title: "Ship", desc: "Packed same-week, in reused and recyclable packaging, straight from the print farm." },
];

// Same top position as Catalog/GetNotified/GetInTouch's mark — "PROCESS"
// forms once, up top, and holds for the whole chapter while the five
// steps advance beneath it. It's a second, independent particle
// field from the big per-step icon lower down: the chapter mark and the
// step glyph are two different things sharing the page, same as the small
// eyebrow used to sit above the step glyph before this was unified with
// the rest of the journey's chapter marks.
const HEADING_TOP = 90;

// Five sequential stations instead of one static row — each step's icon
// (not a bare digit, so it actually says something about the step)
// materializes from particles, holds long enough to read its title/desc,
// then dissolves into the next. The accent rail fills across the whole
// chapter the same way the original ProcessSection's scroll-fill line did,
// just re-scoped from "this element's own scroll range" to "this chapter's
// share of the journey".
export default function ProcessChapter({ progress, active, narrow }) {
  const stepFloat = progress * STEPS.length;
  const stepIndex = Math.min(STEPS.length - 1, Math.floor(stepFloat));
  const stepLocalP = clamp01(stepFloat - stepIndex);
  const step = STEPS[stepIndex];

  const viewport = useViewportSize();
  const canvasRef = useRef(null);
  const [source, setSource] = useState(null);

  useEffect(() => {
    setSource(iconToSource(step.icon, { size: narrow ? 90 : 130 }));
  }, [step.icon, narrow]);

  const targetPoints = useMemo(
    () => (source ? sampleToPoints(source, { sampleW: narrow ? 128 : 176, step: 1, alphaThreshold: 40 }) : null),
    [source]
  );
  const boxW = source ? source.width : 0;
  const boxH = source ? source.height : 0;
  const targetBox = useMemo(
    () => ({ x: (viewport.width - boxW) / 2, y: (viewport.height - boxH) / 2 - boxH * 0.16, width: boxW, height: boxH }),
    [viewport.width, viewport.height, boxW, boxH]
  );

  const formP = clamp01(stepLocalP / 0.35);
  useParticleField({ canvasRef, targetPoints, progress: formP, width: viewport.width, height: viewport.height, targetBox, particleSize: 1.6 });

  const textP = clamp01((stepLocalP - 0.15) / 0.25) * (1 - clamp01((stepLocalP - 0.82) / 0.18));

  const headingCanvasRef = useRef(null);
  const [headingSource, setHeadingSource] = useState(null);

  useEffect(() => {
    setHeadingSource(textToSource("PROCESS", { font: `700 ${narrow ? 28 : 48}px 'JetBrains Mono', monospace` }));
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

  const headingP = clamp01(progress / 0.1);
  useParticleField({
    canvasRef: headingCanvasRef,
    targetPoints: headingTargetPoints,
    progress: headingP,
    width: viewport.width,
    height: viewport.height,
    targetBox: headingTargetBox,
    particleSize: narrow ? 1.3 : 1.8,
  });

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: active ? "auto" : "none" }}>
      <canvas ref={headingCanvasRef} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      <div
        aria-hidden
        style={{ position: "absolute", top: HEADING_TOP + headingBoxH + 44, left: "20%", right: "20%", height: 1, background: "var(--border)" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--accent)",
            transformOrigin: "left",
            transform: `scaleX(${progress})`,
          }}
        />
      </div>

      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      <div
        style={{
          position: "absolute",
          top: targetBox.y + boxH + 14,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: textP,
        }}
      >
        <h3 style={{ fontSize: narrow ? 26 : "clamp(28px, 3.4vw, 36px)", marginBottom: 12 }}>{step.title}</h3>
        <p style={{ fontSize: 14.5, color: "var(--fg-dim)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>{step.desc}</p>
      </div>

      <div style={{ position: "absolute", bottom: "10svh", left: "50%", transform: "translateX(-50%)", display: "flex", gap: 10 }}>
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: i <= stepIndex ? "var(--accent)" : "var(--border-strong)",
              transition: "background 200ms ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
