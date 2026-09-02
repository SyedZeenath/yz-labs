import { useState } from "react";
import RevealText from "./RevealText.jsx";
import RevealBox from "./RevealBox.jsx";

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

        <RevealText
          as="h2"
          y={34}
          blur={14}
          stagger={0.05}
          style={{ fontSize: "clamp(34px, 6vw, 74px)", maxWidth: 780, marginBottom: 40 }}
          parts={["Next batch drops soon."]}
        />

        <RevealBox duration={0.7} y={18} blur={4} amount={0.8}>
          {submitted ? (
            <p className="mono" style={{ fontSize: 14, color: "var(--accent)", marginBottom: 60 }}>
              ✓ You're on the list. We'll email you when the next batch opens.
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
        </RevealBox>

        <RevealBox
          duration={0.7}
          y={16}
          blur={3}
          amount={0.6}
          baseDelay={0.08}
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
            <img
              src="/logo-circle.png"
              alt="YZ LABS"
              width={32}
              height={32}
              style={{ display: "block", borderRadius: "50%", boxShadow: "0 0 0 1px var(--border-strong)" }}
            />
            <span className="wordmark" style={{ fontSize: 16, color: "var(--fg)" }}>
              YZ Labs
            </span>
          </div>

          <div className="mono" style={{ display: "flex", gap: 24, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
            <a href="#catalog" style={{ cursor: "pointer" }}>Catalog</a>
            <a href="#process" style={{ cursor: "pointer" }}>Process</a>
            <a href="mailto:yzlabs.store@gmail.com" style={{ cursor: "pointer" }}>yzlabs.store@gmail.com</a>
            <a href="https://www.instagram.com/yzlabs.store/" target="_blank" rel="noreferrer" style={{ cursor: "pointer" }}>Instagram</a>
          </div>

          <p className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            © {new Date().getFullYear()} YZ LABS · PRINTED, NOT MASS-PRODUCED
          </p>
        </RevealBox>
      </div>
    </footer>
  );
}
