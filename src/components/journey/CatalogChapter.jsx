import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../../store/products.jsx";
import ProductScatter from "../ProductScatter.jsx";
import ProductModal from "../ProductModal.jsx";
import { textToSource, sampleToPoints, clamp01 } from "../../lib/particleField.js";
import useParticleField from "../../hooks/useParticleField.js";
import useViewportSize from "../../hooks/useViewportSize.js";

const HEADING_TOP = 90;

// The catalog "station": the existing orbit gallery docked as-is (same
// drag-inertia, auto-rotate, click-to-modal wiring ProductGrid already
// uses on desktop) instead of rebuilt from scratch — it's already the
// site's own working analogue of igloo's reticle-framed podium. Only the
// section heading materializes from particles; simulating a few hundred
// small product photos as their own particle fields would multiply the
// canvas cost for a beat that's on screen for a fraction of the scroll.
export default function CatalogChapter({ progress, active, narrow }) {
  const products = useProducts();
  const [selectedId, setSelectedId] = useState(null);
  const selected = products.find((p) => p.id === selectedId) || null;

  const viewport = useViewportSize();
  const canvasRef = useRef(null);
  const [source, setSource] = useState(null);

  useEffect(() => {
    setSource(textToSource("CATALOG", { font: `700 ${narrow ? 28 : 48}px 'JetBrains Mono', monospace` }));
  }, [narrow]);

  const targetPoints = useMemo(
    () => (source ? sampleToPoints(source, { sampleW: narrow ? 220 : 360, step: 1, alphaThreshold: 40 }) : null),
    [source, narrow]
  );
  const boxW = source ? source.width : 0;
  const boxH = source ? source.height : 0;
  const targetBox = useMemo(() => ({ x: (viewport.width - boxW) / 2, y: HEADING_TOP, width: boxW, height: boxH }), [viewport.width, boxW, boxH]);

  const headingP = clamp01(progress / 0.3);
  useParticleField({ canvasRef, targetPoints, progress: headingP, width: viewport.width, height: viewport.height, targetBox, particleSize: 1.3 });

  const ringP = clamp01((progress - 0.12) / 0.28);

  // ProductScatter's ellipse radius is fixed in px, independent of its
  // container's width — on a narrow phone it overflows the viewport
  // horizontally rather than shrinking. Scaling the whole ring down
  // visually (rather than rebuilding it width-aware) keeps the exact same
  // tuned drag/auto-rotate behavior; the ring itself is never resized on
  // desktop, so the "view all" link lives in a fixed corner instead of
  // below it — a spot that can't collide with the ring regardless of how
  // tall it renders.
  const widthFit = narrow ? 0.62 : 1;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: active ? "auto" : "none" }}>
      {/* zIndex keeps this above the ring regardless of exact geometry —
          the ring's own bounding box (not just its visible ellipse) runs
          tall enough that its top edge sits only a few pixels below the
          heading's, and as ringP scales it up that gap can close entirely.
          Without an explicit stack order the ring, painting later in the
          DOM, would win and the heading would vanish behind it instead of
          staying up for the whole chapter. */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: narrow ? 190 : 230,
        }}
      >
        <div
          style={{
            width: "min(94vw, 1100px)",
            opacity: ringP,
            transform: `scale(${(0.94 + ringP * 0.06) * widthFit})`,
          }}
        >
          <ProductScatter products={products} onOpen={(product) => setSelectedId(product.id)} hideHint />
        </div>
      </div>

      {/* ProductScatter's own "drag to rotate" hint anchors to its own box,
          which can run taller than the viewport here — same reason "view
          all products" can't sit below the ring. This copy anchors to the
          chapter's own root (the real, non-overflowing viewport) instead.
          On desktop, bottom-right is clear ("view all" lives up by the
          heading there). On a narrow phone "view all" is the one bottom-
          center, so bottom-right would collide with it — the heading-to-
          ring gap is the one spot clear of both. */}
      <div
        className="mono"
        style={
          narrow
            ? {
                position: "absolute",
                top: HEADING_TOP + boxH + 16,
                right: "clamp(20px, 4vw, 48px)",
                fontSize: 11,
                color: "var(--muted)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: ringP,
                pointerEvents: "none",
              }
            : {
                position: "absolute",
                bottom: 20,
                right: "clamp(20px, 4vw, 48px)",
                fontSize: 11,
                color: "var(--muted)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: ringP,
                pointerEvents: "none",
              }
        }
      >
        Drag to rotate
        <span style={{ width: 18, height: 1, background: "var(--muted)" }} />
      </div>

      {/* At full size the ring's real content (not just its container box)
          fills most of the viewport height, so there's no safe strip above
          or below it to drop a button into without the two competing for
          the same pixels. Beside the heading is clear on desktop — the
          heading is short relative to the viewport there. On a narrow
          phone the heading is nearly as wide as the screen, so that same
          spot collides with its own text instead; the ring is already
          shrunk to fit narrow widths (widthFit above), which reliably
          leaves clear room below it there. */}
      <div
        style={
          narrow
            ? {
                position: "absolute",
                bottom: "4%",
                left: "50%",
                transform: "translateX(-50%)",
                opacity: ringP,
                pointerEvents: ringP > 0.5 ? "auto" : "none",
              }
            : {
                position: "absolute",
                top: HEADING_TOP + boxH / 2,
                transform: "translateY(-50%)",
                right: "clamp(20px, 4vw, 48px)",
                opacity: ringP,
                pointerEvents: ringP > 0.5 ? "auto" : "none",
              }
        }
      >
        <Link to="/catalog" className="btn btn-ghost">
          View all products →
        </Link>
      </div>

      <ProductModal product={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
