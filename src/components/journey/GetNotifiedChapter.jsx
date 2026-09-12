import { useEffect, useMemo, useRef, useState } from "react";
import { textToSource, sampleToPoints, clamp01 } from "../../lib/particleField.js";
import useParticleField from "../../hooks/useParticleField.js";
import useViewportSize from "../../hooks/useViewportSize.js";

// The heading sits at 32% down the viewport rather than pinned near the
// top — this chapter has far less content than its neighbors (no product,
// no ring, no spec grid), so anchoring it to the top the way Catalog does
// left the whole bottom two-thirds of the screen empty. Centering the
// block vertically instead makes it read as a deliberate, composed final
// station rather than a sparse leftover.
const HEADING_TOP_FRACTION = 0.32;

// The fifth station, built the same way "CATALOG" is: a pinned
// chapter whose own heading materializes from particles scattered across
// the full viewport, held in place while pinned — not a normal-flow
// section with a scroll-tied camera trick bolted on. That earlier approach
// handed off from a fixed overlay to a real DOM heading mid-page, and nothing
// pinned the section itself, so the heading kept scrolling with the page
// after the reveal (colliding with Nav once scrolled far enough) and swapped
// to an unstyled, wrong-sized <h2> at the handoff (an abrupt visual resize).
// Pinning it removes both problems at once. It hands off into the
// GetInTouchChapter next, whose own entrance (via Journey's chapterMotion)
// provides this chapter's exit beat automatically.
export default function GetNotifiedChapter({ progress, active, narrow }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const viewport = useViewportSize();
  const canvasRef = useRef(null);
  const [source, setSource] = useState(null);

  useEffect(() => {
    setSource(textToSource("GET NOTIFIED", { font: `700 ${narrow ? 28 : 48}px 'JetBrains Mono', monospace` }));
  }, [narrow]);

  const targetPoints = useMemo(
    () => (source ? sampleToPoints(source, { sampleW: narrow ? 240 : 420, step: 1, alphaThreshold: 40 }) : null),
    [source, narrow]
  );
  const boxW = source ? source.width : 0;
  const boxH = source ? source.height : 0;
  const headingTop = viewport.height * HEADING_TOP_FRACTION;
  const targetBox = useMemo(
    () => ({ x: (viewport.width - boxW) / 2, y: headingTop, width: boxW, height: boxH }),
    [viewport.width, headingTop, boxW, boxH]
  );

  const headingP = clamp01(progress / 0.35);
  useParticleField({
    canvasRef,
    targetPoints,
    progress: headingP,
    width: viewport.width,
    height: viewport.height,
    targetBox,
    particleSize: narrow ? 1.3 : 1.8,
  });

  const contentP = clamp01((progress - 0.32) / 0.28);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: active ? "auto" : "none" }}>
      <canvas ref={canvasRef} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      {/* Real, accessible heading — the waitlist form below is genuinely
          functional, so it keeps a real heading in the DOM even though the
          canvas carries the visible version. */}
      <h2 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>
        Get notified
      </h2>

      <div
        style={{
          position: "absolute",
          top: headingTop + boxH + 48,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(92vw, 640px)",
          textAlign: "center",
          opacity: contentP,
          pointerEvents: contentP > 0.5 ? "auto" : "none",
        }}
      >
        <h3 style={{ fontSize: narrow ? 34 : "clamp(38px, 5.4vw, 60px)", lineHeight: 1.12, marginBottom: 36 }}>
          Next batch drops soon.
        </h3>

        {submitted ? (
          <p className="mono" style={{ fontSize: 17, color: "var(--accent)" }}>
            ✓ You're on the list. We'll email you when the next batch opens.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: 0, maxWidth: 480, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mono"
              style={{
                flex: "1 1 260px",
                background: "transparent",
                border: "1px solid var(--border-strong)",
                borderRight: "none",
                padding: "20px 22px",
                color: "var(--fg)",
                fontSize: 16,
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ borderRadius: 0, fontSize: 15, padding: "20px 32px" }}
            >
              Join waitlist
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
