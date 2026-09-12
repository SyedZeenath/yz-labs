import { useEffect, useMemo, useRef, useState } from "react";
import ProductSwatch from "../ProductSwatch.jsx";
import { COLORWAYS } from "../../data/products.js";
import { textToSource, sampleToPoints, clamp01 } from "../../lib/particleField.js";
import useParticleField from "../../hooks/useParticleField.js";
import useViewportSize from "../../hooks/useViewportSize.js";

const SWATCHES = Object.values(COLORWAYS);

const SPECS = [
  ["Materials", "PLA"],
  ["Layer height", "0.12mm fine / 0.20mm standard, chosen per part"],
  ["Wall count", "4–6 perimeters for load-bearing pieces"],
  ["Finish", "Matte sanded, satin, or raw ribbed"],
  ["Customization", "Colorway, scale (±20%), and engraved initials"],
  ["Lead time", "3–7 studio days, batch dependent"],
];

// Same top position as every other chapter's mark. This chapter used to
// carry "Materials & Fit" as a small static eyebrow inline in the left
// column — the smallest, most inconsistent chapter mark on the site. It's
// now the same particle-formed heading as Catalog/GetNotified/GetInTouch,
// and the two-column spec sheet settles in below it instead of being
// vertically centered around it.
const HEADING_TOP = 90;

// The fourth station: the same spec sheet and colorway grid as
// MaterialsSection, settled into place as the camera arrives, then held —
// it hands off into the "Get notified" chapter next, whose own entrance
// (via Journey's chapterMotion) provides the exit beat here automatically.
export default function MaterialsChapter({ progress, active, narrow }) {
  const settleP = clamp01(progress / 0.35);
  const sweepX = -30 + clamp01((progress - 0.1) / 0.6) * 160;

  const viewport = useViewportSize();
  const headingCanvasRef = useRef(null);
  const [headingSource, setHeadingSource] = useState(null);

  useEffect(() => {
    setHeadingSource(textToSource("MATERIALS & FIT", { font: `700 ${narrow ? 28 : 48}px 'JetBrains Mono', monospace` }));
  }, [narrow]);

  const headingTargetPoints = useMemo(
    () => (headingSource ? sampleToPoints(headingSource, { sampleW: narrow ? 260 : 460, step: 1, alphaThreshold: 40 }) : null),
    [headingSource, narrow]
  );
  const headingBoxW = headingSource ? headingSource.width : 0;
  const headingBoxH = headingSource ? headingSource.height : 0;
  const headingTargetBox = useMemo(
    () => ({ x: (viewport.width - headingBoxW) / 2, y: HEADING_TOP, width: headingBoxW, height: headingBoxH }),
    [viewport.width, headingBoxW, headingBoxH]
  );

  const headingP = clamp01(progress / 0.25);
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
        className="container"
        style={{
          position: "absolute",
          top: HEADING_TOP + headingBoxH + 40,
          left: "50%",
          display: "grid",
          gridTemplateColumns: narrow ? "1fr" : "1fr 1fr",
          gap: narrow ? 22 : 56,
          width: "min(92vw, 1080px)",
          opacity: settleP,
          transform: `translateX(-50%) translateY(${(1 - settleP) * 18}px)`,
        }}
      >
        <div>
          <h2 style={{ fontSize: narrow ? 26 : "clamp(28px, 3.6vw, 44px)", marginBottom: narrow ? 14 : 24, maxWidth: 520 }}>
            Tuned per part, not per catalog.
          </h2>

          <dl style={{ display: "flex", flexDirection: "column" }}>
            {SPECS.map(([label, value]) => (
              <div
                key={label}
                style={
                  narrow
                    ? { display: "flex", gap: 8, padding: "5px 0", borderTop: "1px solid var(--border)", alignItems: "baseline" }
                    : { display: "grid", gridTemplateColumns: "140px 1fr", gap: 16, padding: "10px 0", borderTop: "1px solid var(--border)" }
                }
              >
                <dt
                  className="mono"
                  style={{
                    fontSize: narrow ? 10 : 11,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: narrow ? "nowrap" : "normal",
                  }}
                >
                  {label}
                  {narrow ? " —" : ""}
                </dt>
                <dd style={{ margin: 0, fontSize: narrow ? 11 : 13, color: "var(--fg-dim)" }}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div style={{ position: "relative" }}>
          <div className="crosshair" style={{ top: -6, left: -6 }} />
          <div className="crosshair" style={{ bottom: -6, right: -6 }} />
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: narrow ? "repeat(5, 1fr)" : "repeat(5, 1fr)",
              gap: 2,
              border: "1px solid var(--border)",
              overflow: "hidden",
              maxWidth: narrow ? 260 : "none",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${sweepX}%`,
                width: "18%",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                mixBlendMode: "overlay",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
            {SWATCHES.map((s) => (
              <div key={s.name} style={{ position: "relative", aspectRatio: "1", overflow: "hidden" }}>
                <ProductSwatch colorHex={s.hex} compact angle={35} />
                {!narrow && (
                  <span
                    className="mono"
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 8,
                      fontSize: 10,
                      color: "#fff",
                      background: "rgba(0,0,0,0.45)",
                      padding: "3px 6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {s.name}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mono" style={{ fontSize: narrow ? 9 : 11, color: "var(--muted)", marginTop: narrow ? 8 : 12, textAlign: "right" }}>
            FIG. 04 · CURRENT COLORWAYS, SUBJECT TO BATCH
          </p>
        </div>
      </div>
    </div>
  );
}
