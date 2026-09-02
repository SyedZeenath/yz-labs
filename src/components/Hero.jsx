import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PRODUCTS } from "../data/products.js";
import Hero3D from "./Hero3D.jsx";
import WebGLBoundary, { supportsWebGL } from "./WebGLBoundary.jsx";
import { RevealLine, RevealFade } from "./HeroReveal.jsx";

// Only the two products that read well as isolated, background-removed
// pieces. Each chapter pairs with its real product record so the right-hand
// spec panel shows genuine data, not filler.
const CHAPTERS = [
  {
    tag: "STUDIO / 01",
    productId: "round-planter",
    cutout: "/products/cutout/round/3.png",
    heading: ["Objects, printed", "layer by layer."],
    body: "Small-batch propagation planters, sliced and finished by hand. Not a warehouse in sight.",
  },
  {
    tag: "DESK / 02",
    productId: "step-planter",
    cutout: "/products/cutout/step/1.png",
    heading: ["Built for the", "everyday surface."],
    body: "From windowsill to standing desk. Every piece is printed to fit rooms people actually live in.",
  },
];

const CYCLE_MS = 5200;

const orbit = {
  animate: { x: [0, 8, 0, -8, 0], y: [0, -6, -10, -6, 0], rotate: [0, 2, 0, -2, 0] },
  transition: { duration: 9, repeat: Infinity, ease: "easeInOut" },
};

// Degraded-experience fallback for browsers without WebGL, or if the 3D
// scene throws — a single flat cutout with the old float/orbit animation.
function FlatVisual({ chapter, reduceMotion }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <motion.div
        animate={{ opacity: [0.4, 0.65, 0.4], scale: [1, 1.06, 1] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: "-15%",
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(61,107,255,0.26), transparent 72%)",
          filter: "blur(24px)",
          pointerEvents: "none",
        }}
      />
      <motion.div {...(reduceMotion ? {} : orbit)} style={{ position: "absolute", inset: 0 }}>
        <img
          src={chapter.cutout}
          alt={chapter.tag}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 34px 38px rgba(0,0,0,0.55)) drop-shadow(0 8px 14px rgba(0,0,0,0.35))",
          }}
        />
      </motion.div>
    </div>
  );
}

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [webglOk] = useState(() => supportsWebGL());

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setActive((a) => (a + 1) % CHAPTERS.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <section
      id="top"
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        paddingTop: 96,
        paddingBottom: 48,
        overflow: "hidden",
      }}
    >
      <div className="grid-overlay" />
      <div className="corner-tag" style={{ top: 96, left: "clamp(20px,4vw,48px)" }}>
        01 / STUDIO
      </div>
      <div className="corner-tag" style={{ top: 96, right: "clamp(20px,4vw,48px)" }}>
        LAT 12.97 · LON 77.59
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="eyebrow"
        style={{ position: "absolute", top: 96, left: "50%", transform: "translateX(-50%)", zIndex: 2 }}
      >
        Small-batch 3D print studio
      </motion.div>

      <div className="container hero-chapters" style={{ position: "relative", width: "100%" }}>
        <div
          className="hero-chapter"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr minmax(340px, 42vw) 1fr auto",
            alignItems: "center",
            gap: 64,
            width: "100%",
          }}
        >
          {/* LEFT — per-chapter text, permanently mounted and stacked; the
              active one is opacity 1, the rest opacity 0. Chapter 0 sits in
              normal flow to establish the row's height, the rest overlay it
              absolutely. Plain CSS transition, not Motion's animate prop or
              AnimatePresence — both were confirmed unreliable in this
              environment for this exact always-mounted crossfade pattern. */}
          <div style={{ position: "relative" }}>
            {CHAPTERS.map((chapter, i) => {
              const isActive = active === i;
              return (
                <div
                  key={chapter.tag}
                  aria-hidden={!isActive}
                  style={{
                    position: i === 0 ? "relative" : "absolute",
                    inset: i === 0 ? undefined : 0,
                    opacity: isActive ? 1 : 0,
                    transition: "opacity 1000ms cubic-bezier(0.16,1,0.3,1)",
                    pointerEvents: isActive ? "auto" : "none",
                    textAlign: "left",
                  }}
                >
                  <RevealFade active={isActive} index={0} stagger={0.12}>
                    <p className="mono" style={{ fontSize: 12, color: "var(--accent)", letterSpacing: "0.14em", marginBottom: 14 }}>
                      {chapter.tag}
                    </p>
                  </RevealFade>
                  <h1 style={{ fontSize: "clamp(24px, 2.6vw, 38px)", lineHeight: 1.15, textTransform: "uppercase" }}>
                    <RevealLine active={isActive} index={1} stagger={0.12}>
                      {chapter.heading[0]}
                    </RevealLine>
                    <RevealLine active={isActive} index={2} stagger={0.12}>
                      {chapter.heading[1]}
                    </RevealLine>
                  </h1>
                  <RevealFade active={isActive} index={3} stagger={0.12}>
                    <p style={{ marginTop: 20, maxWidth: 360, fontSize: 15.5, color: "var(--fg-dim)", lineHeight: 1.6 }}>
                      {chapter.body}
                    </p>
                  </RevealFade>

                  <RevealFade active={isActive} index={4} stagger={0.12}>
                    <div style={{ display: "flex", gap: 14, marginTop: 30, flexWrap: "wrap" }}>
                      <a href="#catalog" className="btn btn-primary">
                        Shop the catalog
                      </a>
                      <a href="#process" className="btn btn-ghost">
                        See how it's made
                      </a>
                    </div>
                  </RevealFade>
                </div>
              );
            })}
          </div>

          {/* CENTER — a single persistent WebGL scene (or the flat-image
              fallback). It never mounts/unmounts between chapters; it just
              gets fed which chapter is active and crossfades its own
              textures internally, frame by frame. */}
          <div className="hero-visual" style={{ position: "relative", width: "100%", aspectRatio: "1", justifySelf: "center" }}>
            {webglOk ? (
              <WebGLBoundary fallback={<FlatVisual chapter={CHAPTERS[active]} reduceMotion={reduceMotion} />}>
                <Hero3D chapters={CHAPTERS} activeIndex={active} reduceMotion={reduceMotion} />
              </WebGLBoundary>
            ) : (
              <FlatVisual chapter={CHAPTERS[active]} reduceMotion={reduceMotion} />
            )}
          </div>

          {/* RIGHT — spec sheet, same stacked-crossfade treatment as the
              left column, reading real data per chapter's product. */}
          <div style={{ position: "relative" }}>
            {CHAPTERS.map((chapter, i) => {
              const product = PRODUCTS.find((p) => p.id === chapter.productId);
              const isActive = active === i;
              return (
                <div
                  key={chapter.tag}
                  aria-hidden={!isActive}
                  style={{
                    position: i === 0 ? "relative" : "absolute",
                    inset: i === 0 ? undefined : 0,
                    opacity: isActive ? 1 : 0,
                    transition: "opacity 1000ms cubic-bezier(0.16,1,0.3,1)",
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                  className="mono hero-specs"
                >
                  <p style={{ color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, fontSize: 12 }}>
                    Spec sheet
                  </p>
                  {[
                    ["Material", product?.material],
                    ["Colorway", product?.colorway],
                    ["Dimensions", product?.dims],
                    ["Weight", product?.weight],
                    ["Price", product ? `₹${product.price}` : null],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 0",
                        borderTop: "1px solid var(--border)",
                        fontSize: 12,
                        color: "var(--muted)",
                      }}
                    >
                      <span style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
                      <span style={{ color: "var(--fg-dim)" }}>{value}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Right-edge chapter rail — numbered stops on a vertical line
              with a moving marker, echoing a portfolio-site progress
              indicator. A real grid column (not position:absolute over the
              section) so it can never overlap the spec sheet next to it at
              narrower desktop widths. Purely navigational chrome: clicking
              a number jumps chapters, nothing here drives page scroll. */}
          <div className="hero-rail" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
          className="mono"
          style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 120, textAlign: "right" }}
        >
          {CHAPTERS.map((chapter, i) => (
            <button
              key={chapter.tag}
              onClick={() => setActive(i)}
              aria-label={`Show ${chapter.tag}`}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontFamily: "inherit",
                fontSize: 11,
                letterSpacing: "0.06em",
                color: active === i ? "var(--fg)" : "var(--muted)",
                transition: "color 200ms ease",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", width: 1, height: 120, background: "var(--border-strong)" }}>
          <motion.div
            aria-hidden
            animate={{ top: `${(active / Math.max(CHAPTERS.length - 1, 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              left: "50%",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--accent)",
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 10px rgba(61,107,255,0.7)",
            }}
          />
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="mono"
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11,
          color: "var(--muted)",
          letterSpacing: "0.14em",
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 2,
        }}
      >
        SCROLL
        <motion.span
          animate={reduceMotion ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 1, height: 22, background: "var(--muted)" }}
        />
      </motion.div>

      <style>{`
        @media (max-width: 980px) {
          .hero-chapter { grid-template-columns: 1fr !important; text-align: center !important; justify-items: center; }
          .hero-chapter > div:first-child { text-align: center !important; }
          .hero-chapter > div:first-child p, .hero-chapter > div:first-child div { margin-left: auto; margin-right: auto; }
          .hero-specs { display: none !important; }
          .hero-visual { max-width: 320px; }
          .hero-rail { display: none !important; }
        }
      `}</style>
    </section>
  );
}
