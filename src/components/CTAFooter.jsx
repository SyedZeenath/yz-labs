import { useState } from "react";
import RevealBox from "./RevealBox.jsx";
import ContactModal from "./ContactModal.jsx";

// The closing beat, not a legal directory — Terms/Privacy/Refund/Shipping
// links moved into the cart drawer next to checkout (where someone actually
// needs them), and the brand row (logo/wordmark Nav already shows on every
// page) came out too. What's left is the one thing a footer full of small
// text couldn't make room for: two big, real ways to actually reach the
// studio, filling the space instead of leaving it empty above a cramped
// strip of links.
export default function CTAFooter() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <footer className="section-frame" style={{ padding: "100px 0 48px", position: "relative", overflow: "hidden" }}>
      <div className="grid-overlay" aria-hidden />
      <div className="container" style={{ position: "relative", textAlign: "center" }}>
        <div className="crosshair" style={{ top: 0, left: -6 }} aria-hidden />
        <div className="crosshair" style={{ top: 0, right: -6 }} aria-hidden />

        <RevealBox duration={0.7} y={20} blur={6} amount={0.6}>
          <div className="eyebrow" style={{ justifyContent: "center", marginBottom: 20 }}>
            Get in touch
          </div>
          <h2 style={{ fontSize: "clamp(28px, 3.6vw, 44px)" }}>Say hello.</h2>
        </RevealBox>

        <RevealBox
          index={1}
          duration={0.7}
          y={20}
          blur={6}
          amount={0.6}
          style={{ display: "flex", gap: "clamp(28px, 6vw, 72px)", justifyContent: "center", flexWrap: "wrap", margin: "64px 0 72px" }}
        >
          <button onClick={() => setContactOpen(true)} aria-label="Email YZ Labs" className="big-social">
            <span className="big-social-ring" aria-hidden />
            <span className="big-social-circle">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3.5 7l8.5 6 8.5-6" />
              </svg>
            </span>
            <span className="mono big-social-label">Email</span>
          </button>

          <a
            href="https://www.instagram.com/yzlabs.store/"
            target="_blank"
            rel="noreferrer"
            aria-label="YZ Labs on Instagram"
            className="big-social"
          >
            <span className="big-social-ring" aria-hidden />
            <span className="big-social-circle">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4.2" />
                <circle cx="17.6" cy="6.4" r="1.15" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="mono big-social-label">Instagram</span>
          </a>
        </RevealBox>

        <p className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
          © {new Date().getFullYear()} YZ LABS · PRINTED, NOT MASS-PRODUCED
        </p>
      </div>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />

      <style>{`
        .big-social {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          cursor: pointer;
        }
        .big-social-circle {
          position: relative;
          width: 96px;
          height: 96px;
          border-radius: 50%;
          border: 1px solid var(--border-strong);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--fg-dim);
          background: var(--bg);
          transition: color 200ms ease, background 200ms ease, border-color 200ms ease, transform 200ms ease;
        }
        .big-social-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid var(--accent);
          opacity: 0;
          animation: big-social-pulse 2.8s ease-out infinite;
        }
        .big-social:nth-child(2) .big-social-ring { animation-delay: 1.4s; }
        .big-social:hover .big-social-circle {
          color: #fff;
          background: var(--accent);
          border-color: var(--accent);
          transform: scale(1.06);
        }
        .big-social-label {
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          transition: color 200ms ease;
        }
        .big-social:hover .big-social-label {
          color: var(--fg);
        }
        @keyframes big-social-pulse {
          0% { transform: scale(1); opacity: 0.45; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .big-social-ring { animation: none; opacity: 0; }
        }
      `}</style>
    </footer>
  );
}
