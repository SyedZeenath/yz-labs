import { useState } from "react";
import { motion } from "motion/react";

export default function CTAFooter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <footer id="contact" className="section-frame" style={{ padding: "120px 0 0" }}>
      <div className="container">
        <div className="eyebrow" style={{ marginBottom: 20 }}>
          05 / Get notified
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6 }}
          style={{ fontSize: "clamp(34px, 6vw, 74px)", maxWidth: 780, marginBottom: 40 }}
        >
          Next batch drops soon.
        </motion.h2>

        {submitted ? (
          <p className="mono" style={{ fontSize: 14, color: "var(--accent)", marginBottom: 60 }}>
            ✓ You're on the list — we'll email you when the next batch opens.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: 0, maxWidth: 480, marginBottom: 60, flexWrap: "wrap" }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mono"
              style={{
                flex: "1 1 240px",
                background: "transparent",
                border: "1px solid var(--border-strong)",
                borderRight: "none",
                padding: "16px 18px",
                color: "var(--fg)",
                fontSize: 14,
              }}
            />
            <button type="submit" className="btn btn-primary" style={{ borderRadius: 0 }}>
              Join waitlist
            </button>
          </form>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 24,
            paddingTop: 40,
            paddingBottom: 32,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo-circle.png" alt="YZ LABS" width={32} height={32} style={{ display: "block" }} />
            <span className="wordmark" style={{ fontSize: 16, color: "var(--fg)" }}>
              YZ Labs
            </span>
          </div>

          <div className="mono" style={{ display: "flex", gap: 24, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
            <a href="#catalog" style={{ cursor: "pointer" }}>Catalog</a>
            <a href="#process" style={{ cursor: "pointer" }}>Process</a>
            <a href="mailto:hello@yzlabs.studio" style={{ cursor: "pointer" }}>hello@yzlabs.studio</a>
            <a href="#" style={{ cursor: "pointer" }}>Instagram</a>
          </div>

          <p className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            © {new Date().getFullYear()} YZ LABS — PRINTED, NOT MASS-PRODUCED
          </p>
        </div>
      </div>
    </footer>
  );
}
