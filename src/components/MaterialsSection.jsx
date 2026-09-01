import { motion } from "motion/react";
import ProductSwatch from "./ProductSwatch.jsx";

const SWATCHES = [
  { name: "Dusty Blue", hex: "#5D7FA8" },
  { name: "Terracotta", hex: "#C97452" },
  { name: "Graphite", hex: "#2B2C31" },
  { name: "Bone", hex: "#D8D3C6" },
  { name: "Sage", hex: "#7C8A6E" },
  { name: "Peach", hex: "#E3A67F" },
];

const SPECS = [
  ["Materials", "PLA+ and PETG, sourced from EU/US filament makers"],
  ["Layer height", "0.12mm fine / 0.20mm standard — chosen per part"],
  ["Wall count", "4–6 perimeters for load-bearing pieces"],
  ["Finish", "Matte sanded, satin, or raw ribbed — your call"],
  ["Customization", "Colorway, scale (±20%), and engraved initials"],
  ["Lead time", "3–7 studio days, batch dependent"],
];

export default function MaterialsSection() {
  return (
    <section id="materials" className="section-frame" style={{ padding: "110px 0" }}>
      <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64 }} id="materials-grid">
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            04 / Materials &amp; Fit
          </div>
          <h2 style={{ fontSize: "clamp(30px, 4vw, 46px)", marginBottom: 28, maxWidth: 480 }}>
            Tuned per part, not per catalog.
          </h2>
          <p style={{ fontSize: 15.5, color: "var(--fg-dim)", maxWidth: 460, marginBottom: 40, lineHeight: 1.65 }}>
            Nothing ships with default settings. Every model in the catalog has
            its own print profile — because a lamp shade and a bookend don't
            want the same wall thickness.
          </p>

          <dl style={{ display: "flex", flexDirection: "column" }}>
            {SPECS.map(([label, value], i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.7 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 1fr",
                  gap: 20,
                  padding: "16px 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <dt className="mono" style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </dt>
                <dd style={{ margin: 0, fontSize: 14.5, color: "var(--fg-dim)" }}>{value}</dd>
              </motion.div>
            ))}
          </dl>
        </div>

        <div style={{ position: "relative" }}>
          <div className="crosshair" style={{ top: -6, left: -6 }} />
          <div className="crosshair" style={{ bottom: -6, right: -6 }} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 2,
              border: "1px solid var(--border)",
            }}
          >
            {SWATCHES.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, scale: 0.94 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                style={{ position: "relative", aspectRatio: "1", overflow: "hidden" }}
              >
                <ProductSwatch colorHex={s.hex} compact angle={35} />
                <span
                  className="mono"
                  style={{
                    position: "absolute",
                    bottom: 8,
                    left: 8,
                    fontSize: 10,
                    color: "#fff",
                    background: "rgba(0,0,0,0.45)",
                    padding: "3px 6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {s.name}
                </span>
              </motion.div>
            ))}
          </div>
          <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 14, textAlign: "right" }}>
            FIG. 04 — CURRENT COLORWAYS, SUBJECT TO BATCH
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          #materials-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
