import { useEffect, useMemo, useRef, useState } from "react";
import { textToSource, sampleToPoints, clamp01 } from "../../lib/particleField.js";
import useParticleField from "../../hooks/useParticleField.js";
import useViewportSize from "../../hooks/useViewportSize.js";
import ContactModal from "../ContactModal.jsx";

// Heading sits at 32% down the viewport, same as GetNotifiedChapter — this
// chapter is just as light on content (a heading and two icons, no form,
// no grid), so centering it the same way keeps the whole closing pair
// feeling like one balanced system instead of two different layouts.
const HEADING_TOP_FRACTION = 0.32;

// The sixth and true final station — built exactly like every other
// chapter (Catalog, GetNotified): a pinned stage whose heading materializes
// from particles scattered across the full viewport. This used to be a
// normal-flow CTAFooter that the page scrolled past after the journey
// ended, which was the one place left where scrolling suddenly behaved
// like an ordinary page instead of the pinned camera the rest of the site
// uses — jarring right at the close. Now nothing in the journey ever hands
// off to normal scroll; this chapter is simply the last frame, and it
// holds there. The legal/policy links this section used to carry live in
// the cart drawer now (next to checkout, where they're actually useful),
// so there's nothing here that still needs to be a normal, crawlable page
// section — it's free to be pinned like everything before it.
export default function GetInTouchChapter({ progress, active, narrow }) {
  const [contactOpen, setContactOpen] = useState(false);

  const viewport = useViewportSize();
  const canvasRef = useRef(null);
  const [source, setSource] = useState(null);

  useEffect(() => {
    setSource(textToSource("SAY HELLO", { font: `700 ${narrow ? 28 : 48}px 'JetBrains Mono', monospace` }));
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

  // No exit beat — there's nothing after this chapter to hand off to, so
  // it just holds once formed rather than zooming past a camera that never
  // arrives anywhere next.
  const contentP = clamp01((progress - 0.32) / 0.28);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: active ? "auto" : "none" }}>
      <canvas ref={canvasRef} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      {/* Real, accessible heading — the email/Instagram links below are
          genuinely functional, so a real heading stays in the DOM even
          though the canvas carries the visible version. */}
      <h2 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>
        Say hello
      </h2>

      <div
        style={{
          position: "absolute",
          top: headingTop + boxH + 52,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: contentP,
          pointerEvents: contentP > 0.5 ? "auto" : "none",
        }}
      >
        <div style={{ display: "flex", gap: narrow ? 40 : "clamp(40px, 7vw, 96px)", justifyContent: "center", flexWrap: "wrap", marginBottom: 64 }}>
          <button onClick={() => setContactOpen(true)} aria-label="Email YZ Labs" className="big-social">
            <span className="big-social-ring" aria-hidden />
            <span className="big-social-circle">
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3.5 7l8.5 6 8.5-6" />
              </svg>
            </span>
            <span className="mono big-social-label">Email</span>
          </button>

          <a
            href="https://www.instagram.com/yzlabs.store/"
            target="_blank"
            rel="noreferrer"
            aria-label="YZ Labs on Instagram"
            className="big-social"
          >
            <span className="big-social-ring" aria-hidden />
            <span className="big-social-circle">
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4.2" />
                <circle cx="17.6" cy="6.4" r="1.15" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="mono big-social-label">Instagram</span>
          </a>
        </div>

        <p className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          © {new Date().getFullYear()} YZ LABS · PRINTED, NOT MASS-PRODUCED
        </p>
      </div>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />

      <style>{`
        .big-social {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          cursor: pointer;
        }
        .big-social-circle {
          position: relative;
          width: ${narrow ? 100 : 132}px;
          height: ${narrow ? 100 : 132}px;
          border-radius: 50%;
          border: 1px solid var(--border-strong);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--fg-dim);
          background: var(--bg);
          transition: color 200ms ease, background 200ms ease, border-color 200ms ease, transform 200ms ease;
        }
        .big-social-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid var(--accent);
          opacity: 0;
          animation: big-social-pulse 2.8s ease-out infinite;
        }
        .big-social:nth-child(2) .big-social-ring { animation-delay: 1.4s; }
        .big-social:hover .big-social-circle {
          color: #fff;
          background: var(--accent);
          border-color: var(--accent);
          transform: scale(1.06);
        }
        .big-social-label {
          font-size: 13px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          transition: color 200ms ease;
        }
        .big-social:hover .big-social-label {
          color: var(--fg);
        }
        @keyframes big-social-pulse {
          0% { transform: scale(1); opacity: 0.45; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .big-social-ring { animation: none; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
