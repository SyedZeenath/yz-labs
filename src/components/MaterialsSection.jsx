import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import ProductSwatch from "./ProductSwatch.jsx";
import RevealText from "./RevealText.jsx";
import RevealBox from "./RevealBox.jsx";

const SWATCHES = [
  { name: "Graphite", hex: "#2B2C31" },
  { name: "Terracotta", hex: "#C97452" },
  { name: "Bone", hex: "#D8D3C6" },
];

const SPECS = [
  ["Materials", "PLA"],
  ["Layer height", "0.12mm fine / 0.20mm standard, chosen per part"],
  ["Wall count", "4–6 perimeters for load-bearing pieces"],
  ["Finish", "Matte sanded, satin, or raw ribbed"],
  ["Customization", "Colorway, scale (±20%), and engraved initials"],
  ["Lead time", "3–7 studio days, batch dependent"],
];

export default function MaterialsSection() {
  const sweepRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: sweepRef, offset: ["start 90%", "end 10%"] });
  const sweepX = useTransform(scrollYProgress, [0, 1], ["-30%", "130%"]);

  return (
    <section id="materials" className="section-frame" style={{ padding: "110px 0" }}>
      <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64 }} id="materials-grid">
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            04 / Materials &amp; Fit
          </div>
          <RevealText
            as="h2"
            style={{ fontSize: "clamp(30px, 4vw, 46px)", marginBottom: 28, maxWidth: 480 }}
            parts={["Tuned per part, not per catalog."]}
          />
          <RevealText
            as="p"
            style={{ fontSize: 15.5, color: "var(--fg-dim)", maxWidth: 460, marginBottom: 40, lineHeight: 1.65 }}
            stagger={0.012}
            parts={[
              "Nothing ships with default settings. Every model in the catalog has its own print profile, because a lamp shade and a bookend don't want the same wall thickness.",
            ]}
          />

          <dl style={{ display: "flex", flexDirection: "column" }}>
            {SPECS.map(([label, value], i) => (
              <RevealBox
                key={label}
                index={i}
                stagger={0.08}
                duration={0.65}
                y={16}
                blur={3}
                amount={0.7}
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
              </RevealBox>
            ))}
          </dl>
        </div>

        <div style={{ position: "relative" }} ref={sweepRef}>
          <div className="crosshair" style={{ top: -6, left: -6 }} />
          <div className="crosshair" style={{ bottom: -6, right: -6 }} />
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 2,
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <motion.div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: sweepX,
                width: "18%",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                mixBlendMode: "overlay",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
            {SWATCHES.map((s, i) => (
              <RevealBox
                key={s.name}
                index={i}
                stagger={0.09}
                duration={0.7}
                y={18}
                blur={4}
                amount={0.6}
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
              </RevealBox>
            ))}
          </div>
          <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 14, textAlign: "right" }}>
            FIG. 04 · CURRENT COLORWAYS, SUBJECT TO BATCH
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
