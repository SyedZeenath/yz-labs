// A small glass-backed product-spec callout: a short connector line
// reaching out from a product toward a label/value pair in a translucent
// card. Originated in HeroChapter as a locally-defined component; pulled
// out here (Phase 5) so any chapter/page that wants to point out a single
// spec next to a product photo can reuse the exact same look instead of
// re-deriving it. Not the same thing as a full spec sheet (see
// MaterialsChapter's own <dl> for that) — this is for annotating one
// photo with a few short callouts around it.
//
// `side` decides which edge the connector/card sit on ("left" reaches
// leftward from the anchor point, "right" reaches rightward), `top`
// positions the callout vertically within its positioned parent, and
// `visible` is a 0..1 opacity (matching the scroll-tied fade pattern
// every chapter already uses, not a plain boolean) so callers can tie it
// to the same progress value that reveals the product itself.
export default function SpecLabel({ side, top, label, value, visible }) {
  if (!value) return null;
  const fromRight = side === "right";
  return (
    <div
      style={{
        position: "absolute",
        [fromRight ? "left" : "right"]: "calc(100% + 28px)",
        top,
        width: 170,
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
          top: 15,
          width: 28,
          height: 1,
          background: "var(--border-strong)",
        }}
      />
      <div className="mono glass" style={{ padding: "10px 12px", textAlign: fromRight ? "left" : "right" }}>
        <p style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
        <p style={{ fontSize: 13, color: "var(--fg-dim)" }}>{value}</p>
      </div>
    </div>
  );
}
