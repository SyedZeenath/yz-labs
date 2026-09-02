import { useRef } from "react";
import { motion, useMotionValue, useTransform, useAnimationFrame, animate, useReducedMotion } from "motion/react";

// A circular "orbit" gallery: tiles sit at even angles around an ellipse and
// continuously drift around it on their own. Dragging anywhere in the field
// grabs the whole ring and spins it — drag right, everything rotates
// clockwise; release, and it keeps coasting on its own momentum before
// settling back into the idle auto-rotate. Every tile stays perfectly
// upright (no per-tile tilt) — depth is read purely from scale/brightness:
// tiles nearer the top of the ellipse read larger and brighter, tiles
// nearer the bottom read smaller and dimmer, so the orbit motion is legible
// at a glance without anything visually tilting.
const RADIUS_X = 400;
const RADIUS_Y = 210;
const TILE_WIDTH = 148;
const TILE_HEIGHT = 182;
const AUTO_DEG_PER_SEC = 6;
const DRAG_DEG_PER_PX = 0.35;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// A click right after a drag should be ignored (it's the tail end of the
// same gesture, not an intentional tap) — but that "just dragged" state
// must expire on its own. Consuming/resetting it only inside a tile's own
// onClick left a bug: a drag that ends over empty space (not on any tile)
// never got consumed, so it silently blocked the *next* genuine click,
// whenever it happened. A short time window fixes that — it always expires.
const DRAG_SUPPRESS_MS = 300;

function OrbitTile({ product, angle, offsetDeg, onOpen, lastPanRef }) {
  const hasCutout = Boolean(product.heroCutout);
  const theta = useTransform(angle, (a) => toRad(a + offsetDeg));
  const x = useTransform(theta, (t) => Math.cos(t) * RADIUS_X);
  const y = useTransform(theta, (t) => Math.sin(t) * RADIUS_Y);
  // Depth reads from vertical position, not front/back on the ellipse: -1
  // at the very top, +1 at the very bottom (screen y grows downward).
  const depthY = useTransform(theta, (t) => -Math.sin(t));
  const scale = useTransform(depthY, [-1, 1], [0.76, 1.08]);
  const opacity = useTransform(depthY, [-1, 1], [0.5, 1]);
  const zIndex = useTransform(depthY, (d) => Math.round(d * 10) + 10);

  const handleClick = () => {
    const { distance, endedAt } = lastPanRef.current;
    const recentlyDragged = distance > 6 && performance.now() - endedAt < DRAG_SUPPRESS_MS;
    if (!recentlyDragged) onOpen(product);
  };

  return (
    <motion.div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${product.name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(product);
        }
      }}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        x,
        y,
        scale,
        opacity,
        zIndex,
        translateX: "-50%",
        translateY: "-50%",
        width: TILE_WIDTH,
        cursor: "grab",
      }}
    >
      {/* Every tile is the same fixed-size rectangle regardless of source
          image — cutouts float inside it via object-fit:contain, plain
          photos fill it via object-fit:cover — so the ring reads as one
          consistent shape no matter how many products are mixed in. */}
      <motion.div
        style={{
          pointerEvents: "none",
          width: TILE_WIDTH,
          height: TILE_HEIGHT,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--border-strong)",
          background: "var(--bg-elevated)",
          boxShadow: "0 24px 40px -20px rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {hasCutout ? (
          <img
            src={product.heroCutout}
            alt={product.name}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            style={{
              width: "82%",
              height: "82%",
              objectFit: "contain",
              display: "block",
              filter: "drop-shadow(0 18px 20px rgba(0,0,0,0.5))",
            }}
          />
        ) : (
          <img
            src={product.heroImage}
            alt={product.name}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              objectPosition: product.heroImagePosition || "center",
            }}
          />
        )}
      </motion.div>

      <div
        className="mono"
        style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, pointerEvents: "none" }}
      >
        <span style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--fg-dim)" }}>{product.name}</span>
        <span style={{ color: "var(--fg)", fontWeight: 600, whiteSpace: "nowrap" }}>₹{product.price}</span>
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, pointerEvents: "none" }}>
        {product.batch}
      </div>
    </motion.div>
  );
}

export default function ProductScatter({ products, onOpen }) {
  const reduceMotion = useReducedMotion();
  const angle = useMotionValue(0);
  const isDragging = useRef(false);
  const isSettling = useRef(false);
  const panDistance = useRef(0);
  const lastPan = useRef({ distance: 0, endedAt: 0 });

  useAnimationFrame((_, delta) => {
    if (reduceMotion || isDragging.current || isSettling.current) return;
    angle.set(angle.get() + (AUTO_DEG_PER_SEC * delta) / 1000);
  });

  const handlePanStart = () => {
    isDragging.current = true;
    isSettling.current = false;
    panDistance.current = 0;
  };
  const handlePan = (_, info) => {
    panDistance.current += Math.abs(info.delta.x) + Math.abs(info.delta.y);
    angle.set(angle.get() + info.delta.x * DRAG_DEG_PER_PX);
  };
  const handlePanEnd = (_, info) => {
    isDragging.current = false;
    isSettling.current = true;
    lastPan.current = { distance: panDistance.current, endedAt: performance.now() };
    animate(angle, angle.get() + info.velocity.x * DRAG_DEG_PER_PX * 4, {
      type: "inertia",
      velocity: info.velocity.x * DRAG_DEG_PER_PX,
      power: 0.4,
      timeConstant: 280,
      restDelta: 0.3,
      onComplete: () => {
        isSettling.current = false;
      },
    });
  };

  const offsets = products.map((_, i) => (360 / products.length) * i);

  return (
    <motion.div
      className="scatter-field"
      onPanStart={handlePanStart}
      onPan={handlePan}
      onPanEnd={handlePanEnd}
      style={{
        position: "relative",
        height: "clamp(560px, 58vw, 760px)",
        overflow: "hidden",
        background: "var(--bg)",
        cursor: "grab",
        touchAction: "none",
      }}
    >
      <div
        className="mono"
        style={{
          position: "absolute",
          top: 20,
          right: 24,
          fontSize: 11,
          color: "var(--muted)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 30,
          pointerEvents: "none",
        }}
      >
        Drag to rotate
        <span style={{ width: 18, height: 1, background: "var(--muted)" }} />
      </div>

      {products.map((product, i) => (
        <OrbitTile
          key={product.id}
          product={product}
          angle={angle}
          offsetDeg={offsets[i]}
          onOpen={onOpen}
          lastPanRef={lastPan}
        />
      ))}
    </motion.div>
  );
}
