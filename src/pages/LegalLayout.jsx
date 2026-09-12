import { Link } from "react-router-dom";

export const LEGAL_LINKS = [
  { to: "/terms", label: "Terms & Conditions" },
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund & Cancellation" },
  { to: "/shipping-policy", label: "Shipping Policy" },
  { to: "/contact", label: "Contact Us" },
];

// Shared shell for the standalone legal/info pages (Terms, Privacy, Refund,
// Shipping, Contact). These are plain, static, individually-linkable
// routes (not scroll-anchored sections) since that's what Razorpay's own
// review checks for on a merchant's site. Kept visually consistent with the
// rest of the site (same tokens/fonts) but deliberately simpler than the
// marketing homepage.
export default function LegalLayout({ eyebrow, title, updated, children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div
          className="container"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}
        >
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/logo-circle.png"
              alt="YZ LABS"
              width={36}
              height={36}
              style={{ display: "block", borderRadius: "50%", boxShadow: "0 0 0 1px var(--border-strong)" }}
            />
            <img src="/logo-wordmark.png" alt="YZ Labs" height={18} style={{ display: "block", width: "auto" }} />
          </Link>
          <Link
            to="/"
            className="mono"
            style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-dim)" }}
          >
            ← Back to store
          </Link>
        </div>
      </header>

      <main className="container" style={{ flex: 1, padding: "72px 0 100px", maxWidth: 760 }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          {eyebrow}
        </div>
        <h1 style={{ fontSize: "clamp(30px, 4.5vw, 44px)", marginBottom: 8 }}>{title}</h1>
        {updated && (
          <p className="mono" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 48 }}>
            Last updated: {updated}
          </p>
        )}

        <div className="legal-copy">{children}</div>
      </main>

      <footer style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="container mono"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            padding: "28px 0",
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          {LEGAL_LINKS.map((l) => (
            <Link key={l.to} to={l.to} style={{ color: "var(--muted)" }}>
              {l.label}
            </Link>
          ))}
        </div>
      </footer>

      <style>{`
        .legal-copy h2 {
          font-size: 20px;
          margin: 44px 0 14px;
        }
        .legal-copy h2:first-child { margin-top: 0; }
        .legal-copy p {
          font-size: 15px;
          line-height: 1.7;
          color: var(--fg-dim);
          margin-bottom: 14px;
        }
        .legal-copy ul {
          margin: 0 0 14px;
          padding-left: 22px;
        }
        .legal-copy li {
          font-size: 15px;
          line-height: 1.7;
          color: var(--fg-dim);
          margin-bottom: 8px;
        }
        .legal-copy a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
        .legal-copy strong { color: var(--fg); }
        .legal-copy .placeholder {
          color: var(--warn);
        }
      `}</style>
    </div>
  );
}
