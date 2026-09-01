import { useEffect, useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { useCart } from "../store/cart.jsx";

const LINKS = [
  { href: "#catalog", label: "Catalog" },
  { href: "#process", label: "Process" },
  { href: "#materials", label: "Materials" },
  { href: "#contact", label: "Contact" },
];

export default function Nav() {
  const { itemCount, openCart } = useCart();
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 24));

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderBottom: "1px solid",
        borderColor: solid ? "var(--border)" : "transparent",
        background: solid ? "rgba(10,10,12,0.82)" : "transparent",
        backdropFilter: solid ? "blur(10px)" : "none",
        transition: "background 200ms ease, border-color 200ms ease",
      }}
    >
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}
      >
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-circle.png" alt="YZ LABS" width={40} height={40} style={{ display: "block" }} />
          <span className="wordmark" style={{ fontSize: 20, color: "var(--fg)" }}>
            YZ Labs
          </span>
        </a>

        <nav
          className="mono"
          style={{ display: "flex", gap: 32, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="nav-link"
              style={{ color: "var(--fg-dim)", cursor: "pointer" }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={openCart}
            aria-label={`Open cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
            className="mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              padding: "9px 14px",
              border: "1px solid var(--border-strong)",
              cursor: "pointer",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6h15l-1.5 9h-12z" />
              <path d="M6 6L4.5 3H2" />
              <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
            </svg>
            <span>{String(itemCount).padStart(2, "0")}</span>
          </button>

          <button
            className="mono nav-toggle"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: "none",
              width: 38,
              height: 38,
              border: "1px solid var(--border-strong)",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {menuOpen ? "×" : "≡"}
          </button>
        </div>
      </div>

      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mono"
          style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}
        >
          <div className="container" style={{ display: "flex", flexDirection: "column", padding: "16px 0" }}>
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                style={{ padding: "14px 0", borderBottom: "1px solid var(--border)", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                {l.label}
              </a>
            ))}
          </div>
        </motion.div>
      )}

      <style>{`
        .nav-link { position: relative; transition: color 150ms ease; }
        .nav-link:hover { color: var(--fg); }
        .nav-link::after {
          content: "";
          position: absolute;
          left: 0; right: 100%; bottom: -4px;
          height: 1px;
          background: var(--accent);
          transition: right 200ms ease;
        }
        .nav-link:hover::after { right: 0; }
        @media (max-width: 780px) {
          header nav { display: none; }
          .nav-toggle { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
