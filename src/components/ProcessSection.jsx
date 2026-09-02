import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import RevealText from "./RevealText.jsx";
import RevealBox from "./RevealBox.jsx";

const STEPS = [
  { n: "01", title: "Design", desc: "Every object starts as a parametric CAD model, tuned for print orientation and wall strength." },
  { n: "02", title: "Slice", desc: "Layer height, infill and wall count are tuned per part, not one preset for everything." },
  { n: "03", title: "Print", desc: "FDM printers run the batch, layer by layer, over hours, not minutes." },
  { n: "04", title: "Finish", desc: "Supports removed, edges sanded, surfaces sealed by hand in the studio." },
  { n: "05", title: "Ship", desc: "Packed same-week, in reused and recyclable packaging, straight from the print farm." },
];

export default function ProcessSection() {
  const sectionRef = useRef(null);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start 78%", "end 55%"] });
  const barScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="process" ref={sectionRef} className="section-frame" style={{ padding: "110px 0" }}>
      <div className="container">
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          03 / Process
        </div>
        <RevealText
          as="h2"
          style={{ fontSize: "clamp(30px, 4vw, 46px)", maxWidth: 560, marginBottom: 64 }}
          parts={["From G-code to your desk."]}
        />

        <div className="process-steps" style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 11, left: 0, right: 0, height: 1, background: "var(--border)" }} />
          <motion.div
            style={{
              position: "absolute",
              top: 11,
              left: 0,
              right: 0,
              height: 1,
              background: "var(--accent)",
              transformOrigin: "left",
              scaleX: barScale,
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 24 }} className="process-steps-grid">
            {STEPS.map((step, i) => (
              <RevealBox key={step.n} index={i} stagger={0.11} duration={0.75} y={22} blur={4} amount={0.6}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--bg)",
                    border: "1px solid var(--border-strong)",
                    marginBottom: 20,
                  }}
                />
                <p className="mono" style={{ fontSize: 12, color: "var(--accent)", marginBottom: 8 }}>
                  {step.n}
                </p>
                <h3 style={{ fontSize: 18, marginBottom: 10 }}>{step.title}</h3>
                <p style={{ fontSize: 13.5, color: "var(--fg-dim)", lineHeight: 1.55 }}>{step.desc}</p>
              </RevealBox>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .process-steps-grid { grid-template-columns: repeat(2, 1fr) !important; row-gap: 40px !important; }
        }
        @media (max-width: 520px) {
          .process-steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
