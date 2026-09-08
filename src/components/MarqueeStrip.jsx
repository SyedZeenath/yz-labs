import { motion, useScroll, useVelocity, useTransform, useSpring, useReducedMotion } from "motion/react";

const ITEMS = [
  "PLA",
  "HAND FINISHED",
  "MADE TO ORDER",
  "LIMITED BATCHES",
  "0.12MM LAYERS",
  "STUDIO RUN · NOT A WAREHOUSE",
];

// The ticker reacts to how fast you're scrolling: skewing and briefly
// speeding up under a fast flick, settling flat again when you stop —
// distinct from every other section's motion on the page.
export default function MarqueeStrip() {
  const reduceMotion = useReducedMotion();
  const track = [...ITEMS, ...ITEMS];
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(velocity, { stiffness: 350, damping: 40 });
  const skew = useTransform(smoothVelocity, [-2500, 0, 2500], [-8, 0, 8], { clamp: true });

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <motion.div
        className="mono"
        style={{
          display: "flex",
          width: "max-content",
          animation: "marquee 26s linear infinite",
          padding: "16px 0",
          fontSize: 13,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          skewX: reduceMotion ? 0 : skew,
        }}
      >
        {track.map((t, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", color: "var(--fg-dim)" }}>
            {t}
            <span style={{ color: "var(--accent)", margin: "0 28px" }}>✦</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}
