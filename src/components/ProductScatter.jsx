import { useMemo, useRef } from "react";
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
//
// The ellipse itself was tuned to feel right at REFERENCE_COUNT tiles. A
// fixed radius stopped working once the catalog's actual size drifted away
// from that: with only 3-4 tiles it left huge empty gaps and the same
// angular speed reads as a fast, sparse blade sweeping past (the "weird"
// rotation); with a lot more it would start crowding tiles together. So
// the radius scales with the current tile count instead of staying fixed:
// shrink for a small catalog, grow for a large one, unchanged right at
// REFERENCE_COUNT. sqrt (not linear) keeps that scaling gentle at both
// ends rather than letting a very small or very large count run away.
const BASE_RADIUS_X = 400;
const BASE_RADIUS_Y = 210;
const REFERENCE_COUNT = 7;
const MIN_RADIUS_SCALE = 0.45;
const MAX_RADIUS_SCALE = 1.8;
const TILE_WIDTH = 148;
const TILE_HEIGHT = 182;
const AUTO_DEG_PER_SEC = 6;
const DRAG_DEG_PER_PX = 0.35;

function radiusScaleFor(count) {
  const scale = Math.sqrt(count / REFERENCE_COUNT);
  return Math.min(MAX_RADIUS_SCALE, Math.max(MIN_RADIUS_SCALE, scale));
}

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

// The thin ellipse the tiles ride around, like the edge of a record. Purely
// decorative and always behind every tile (it renders first in the DOM,
// tiles never drop below zIndex 0, so DOM order alone settles the stacking).
// Drawn at the exact same radiusX/radiusY as the tiles themselves, so it
// always traces their real path, never an approximation of it.
function TrackRing({ radiusX, radiusY }) {
  const w = radiusX * 2;
  const h = radiusY * 2;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <ellipse cx={radiusX} cy={radiusY} rx={radiusX} ry={radiusY} fill="none" strokeWidth={1} style={{ stroke: "var(--border-strong)" }} />
    </svg>
  );
}

function OrbitTile({ product, angle, offsetDeg, radiusX, radiusY, onOpen, lastPanRef }) {
  const theta = useTransform(angle, (a) => toRad(a + offsetDeg));
  const x = useTransform(theta, (t) => Math.cos(t) * radiusX);
  const y = useTransform(theta, (t) => Math.sin(t) * radiusY);
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
      {/* Every tile is the same fixed-size rectangle — hero.png is shot on
          pure black for every product, so it floats inside the tile with
          nothing but a drop-shadow, no frame needed. */}
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
        <img
          src={product.heroImage}
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
      </motion.div>

      <div
        className="mono"
        style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, pointerEvents: "none" }}
      >
        <span style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--fg-dim)" }}>{product.name}</span>
        <span style={{ color: product.price > 0 ? "var(--fg)" : "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
          {product.price > 0 ? `₹${product.price}` : "TBA"}
        </span>
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

  const { radiusX, radiusY } = useMemo(() => {
    const scale = radiusScaleFor(products.length || 1);
    return { radiusX: BASE_RADIUS_X * scale, radiusY: BASE_RADIUS_Y * scale };
  }, [products.length]);

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

      <TrackRing radiusX={radiusX} radiusY={radiusY} />

      {products.map((product, i) => (
        <OrbitTile
          key={product.id}
          product={product}
          angle={angle}
          offsetDeg={offsets[i]}
          radiusX={radiusX}
          radiusY={radiusY}
          onOpen={onOpen}
          lastPanRef={lastPan}
        />
      ))}
    </motion.div>
  );
}
