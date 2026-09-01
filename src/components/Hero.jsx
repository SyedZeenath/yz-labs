import { motion } from "motion/react";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export default function Hero() {
  return (
    <section
      id="top"
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        paddingTop: 72,
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
        className="container"
        variants={container}
        initial="hidden"
        animate="show"
        style={{ position: "relative", zIndex: 2 }}
      >
        <motion.div variants={item} className="eyebrow" style={{ marginBottom: 24 }}>
          Small-batch 3D print studio
        </motion.div>

        <motion.h1
          variants={item}
          style={{
            fontSize: "clamp(48px, 8vw, 108px)",
            maxWidth: 900,
            textTransform: "uppercase",
          }}
        >
          Objects, printed
          <br />
          layer by <span style={{ color: "var(--accent)" }}>deliberate</span> layer.
        </motion.h1>

        <motion.p
          variants={item}
          style={{
            marginTop: 28,
            maxWidth: 480,
            fontSize: 17,
            color: "var(--fg-dim)",
          }}
        >
          YZ LABS designs and prints small objects for the desk and home —
          planters, vessels, clocks, lamps. Every piece is sliced, tuned and
          finished in-house, in short runs, not warehouses.
        </motion.p>

        <motion.div variants={item} style={{ display: "flex", gap: 14, marginTop: 40, flexWrap: "wrap" }}>
          <a href="#catalog" className="btn btn-primary">
            Shop the catalog
          </a>
          <a href="#process" className="btn btn-ghost">
            See how it's made
          </a>
        </motion.div>

        <motion.div
          variants={item}
          className="mono"
          style={{ display: "flex", gap: 28, marginTop: 64, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}
        >
          <span>MATERIAL — PLA+ / PETG</span>
          <span>BATCH SIZE — 6–20 UNITS</span>
          <span>ORIGIN — PRINTED TO ORDER</span>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="mono"
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          translateX: "-50%",
          fontSize: 11,
          color: "var(--muted)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        SCROLL
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 1, height: 26, background: "var(--muted)" }}
        />
      </motion.div>
    </section>
  );
}
