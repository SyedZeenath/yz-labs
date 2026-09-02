import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import ProductSwatch from "./ProductSwatch.jsx";

function seedFrom(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

// `focused` covers keyboard users (no mouse position to tilt toward);
// mouse users get the precise cursor-follow tilt via local hover state.
export default function ProductVisual({ product, focused = false }) {
  const [isHovering, setIsHovering] = useState(false);
  const [cutoutFailed, setCutoutFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  const wrapRef = useRef(null);

  const active = isHovering || focused;
  const hasCutout = Boolean(product.heroCutout) && !cutoutFailed;
  const hasImage = !hasCutout && Boolean(product.heroImage) && !imgFailed;

  const seed = seedFrom(product.id);
  const bobDuration = 4.4 + (seed % 5) * 0.4;
  const bobDelay = (seed % 7) * 0.15;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tiltX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 150, damping: 16 });
  const tiltY = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 150, damping: 16 });

  const handleMove = (e) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleEnter = () => setIsHovering(true);
  const handleLeave = () => {
    setIsHovering(false);
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      ref={wrapRef}
      onMouseEnter={reduceMotion ? undefined : handleEnter}
      onMouseMove={reduceMotion ? undefined : handleMove}
      onMouseLeave={handleLeave}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: 900,
      }}
    >
      <motion.div
        aria-hidden
        animate={{ opacity: active ? 0.9 : 0.45, scale: active ? 1.12 : 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          position: "absolute",
          inset: "-10%",
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(61,107,255,0.16), rgba(61,107,255,0.05) 55%, transparent 75%)",
          pointerEvents: "none",
        }}
      />

      <motion.div
        aria-hidden
        animate={{
          scaleX: active ? 1.18 : 1,
          opacity: active ? 0.5 : 0.28,
        }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{
          position: "absolute",
          bottom: "2%",
          width: "54%",
          height: "11%",
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(0,0,0,0.6), transparent 72%)",
          filter: "blur(5px)",
        }}
      />

      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
        transition={
          reduceMotion
            ? undefined
            : { duration: bobDuration, delay: bobDelay, repeat: Infinity, ease: "easeInOut" }
        }
        style={{ position: "absolute", inset: "8%", zIndex: 1, transformStyle: "preserve-3d" }}
      >
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            rotateX: reduceMotion ? 0 : tiltX,
            rotateY: reduceMotion ? 0 : tiltY,
            scale: active ? 1.07 : 1,
            transition: "scale 350ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {hasCutout ? (
            <motion.img
              src={product.heroCutout}
              alt={product.name}
              onError={() => setCutoutFailed(true)}
              animate={{
                filter: active
                  ? "drop-shadow(0 34px 26px rgba(0,0,0,0.55)) drop-shadow(0 6px 10px rgba(0,0,0,0.4))"
                  : "drop-shadow(0 20px 16px rgba(0,0,0,0.42)) drop-shadow(0 4px 6px rgba(0,0,0,0.3))",
              }}
              transition={{ duration: 0.35 }}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: active
                  ? "0 30px 54px -20px rgba(0,0,0,0.7)"
                  : "0 16px 32px -20px rgba(0,0,0,0.55)",
                transition: "box-shadow 320ms ease",
              }}
            >
              {hasImage ? (
                <img
                  src={product.heroImage}
                  alt={product.name}
                  onError={() => setImgFailed(true)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: product.heroImagePosition || "center",
                  }}
                />
              ) : (
                <ProductSwatch colorHex={product.colorHex} />
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
