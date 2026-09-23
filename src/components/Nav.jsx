import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../store/cart.jsx";
import { useContact } from "../store/contact.jsx";

const MOBILE_BREAKPOINT = 760;
const SCROLLED_THRESHOLD = 40;

function NavLink({ children, ...props }) {
  return (
    <Link
      {...props}
      className="mono nav-link"
      style={{
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--fg-dim)",
      }}
    >
      {children}
    </Link>
  );
}

// A compact glass bar (see the shared .glass/.glass-strong classes in
// index.css) rather than a solid header — the particle-heavy chapters
// underneath (Hero especially) still read through it, which is the whole
// point: the logo and links need to stay legible over whatever's
// animating beneath them without just blocking it out with a flat fill.
// Square corners throughout — a rounded floating pill is the generic-SaaS
// look this brief explicitly ruled out; this site already reads sharp and
// technical (2px radius tokens site-wide), so the nav sits flush with the
// same edges everything else uses. .glass-strong (higher opacity) swaps
// in once the page has scrolled a little, so the bar doesn't stay this
// faint over whatever content ends up behind it further down the page.
export default function Nav() {
  const { itemCount, openCart } = useCart();
  const { openContact } = useContact();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);

  // Same scroll/resize-listener-plus-poll-fallback pattern Journey.jsx
  // already uses, for the same proven reason: a plain 'scroll' listener
  // alone can miss real position changes — confirmed directly while
  // testing this nav, where a programmatic scrollTo back to the top left
  // `scrolled` stuck true because no 'scroll' event ever fired for it. The
  // poll is cheap (one scrollY read, ~6.7/sec) and catches exactly that.
  useEffect(() => {
    function measure() {
      setScrolled(window.scrollY > SCROLLED_THRESHOLD);
    }
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    const id = setInterval(measure, 150);
    return () => {
      window.removeEventListener("scroll", measure);
      clearInterval(id);
    };
  }, []);

  // The mobile dropdown closes on its own whenever the route changes (a
  // Shop/Process click just navigated away — nothing left to show), on
  // Escape, and on an outside click/tap. It never traps focus or blocks
  // the rest of the page; it's a small link list, not a modal.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  // Set imperatively rather than as a JSX prop — React 18 (this project's
  // version; `inert` only became a first-class JSX prop in React 19)
  // doesn't reliably forward it to the DOM as a plain attribute. Toggling
  // the real element property directly works regardless of React version
  // and keeps the closed menu's links out of the tab order without the
  // asymmetric-delay problem a `visibility` transition would have.
  useEffect(() => {
    if (menuRef.current) menuRef.current.inert = !menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    }
    function onPointerDown(e) {
      if (menuRef.current?.contains(e.target) || toggleRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const accountButton = (
    <Link
      to="/account"
      aria-label="Your account"
      className="mono"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        border: "1px solid var(--border-strong)",
        cursor: "pointer",
        background: "rgba(0,0,0,0.3)",
        flexShrink: 0,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
    </Link>
  );

  const cartButton = (
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
        background: "rgba(0,0,0,0.3)",
        flexShrink: 0,
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
  );

  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
      <div className={`glass${scrolled ? " glass-strong" : ""}`}>
        <div
          className="container"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 80, gap: 16 }}
        >
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            <img
              src="/logo-circle.png"
              alt="YZ LABS"
              width={48}
              height={48}
              style={{ display: "block", borderRadius: "50%", boxShadow: "0 0 0 1px var(--border-strong)" }}
            />
            <img src="/logo-wordmark.png" alt="YZ Labs" height={24} style={{ display: "block", width: "auto" }} />
          </Link>

          <nav aria-label="Primary" className="nav-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <NavLink to="/catalog">Shop</NavLink>
            <NavLink to="/#process">Process</NavLink>
            <button
              onClick={openContact}
              className="mono nav-link"
              style={{
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--fg-dim)",
                cursor: "pointer",
              }}
            >
              Contact
            </button>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {accountButton}
            {cartButton}
            <button
              ref={toggleRef}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="nav-toggle"
              style={{
                display: "none",
                width: 38,
                height: 38,
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--border-strong)",
                background: "rgba(0,0,0,0.3)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                {menuOpen ? (
                  <>
                    <line x1="5" y1="5" x2="19" y2="19" />
                    <line x1="19" y1="5" x2="5" y2="19" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="7" x2="21" y2="7" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="17" x2="21" y2="17" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown — same glass treatment as the bar itself, so it
          reads as one surface unfolding rather than a second, different
          component appearing beneath it. Animates via grid-template-rows
          (0fr/1fr) + opacity rather than max-height — max-height is a
          layout property, forcing a reflow every frame of the transition;
          the grid-rows trick gets the same "unfold to content height"
          look without that cost, and without the text-squish a scaleY
          collapse would give a 3-line link list. `inert` (not just
          opacity) keeps the closed menu's links out of the tab order —
          simpler and direction-safe than a visibility transition, which
          would need an asymmetric delay (instant on open, deferred on
          close) that plain CSS can't express cleanly. */}
      <div
        id="mobile-nav-menu"
        ref={menuRef}
        className="glass glass-strong nav-mobile-menu"
        style={{
          borderTop: "none",
          display: "grid",
          gridTemplateRows: menuOpen ? "1fr" : "0fr",
          opacity: menuOpen ? 1 : 0,
          transition: "grid-template-rows 280ms ease, opacity 220ms ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div className="container" style={{ display: "flex", flexDirection: "column", padding: "18px 0 22px", gap: 18 }}>
            <NavLink to="/catalog" style={{ fontSize: 13 }}>
              Shop
            </NavLink>
            <NavLink to="/#process" style={{ fontSize: 13 }}>
              Process
            </NavLink>
            <NavLink to="/account" style={{ fontSize: 13 }}>
              Account
            </NavLink>
            <button
              onClick={() => {
                setMenuOpen(false);
                openContact();
              }}
              className="mono nav-link"
              style={{
                fontSize: 13,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--fg-dim)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Contact
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .nav-link { transition: color 150ms ease; }
        .nav-link:hover, .nav-link:focus-visible { color: var(--fg); }
        @media (max-width: ${MOBILE_BREAKPOINT - 1}px) {
          .nav-links { display: none !important; }
          .nav-toggle { display: flex !important; }
        }
        @media (min-width: ${MOBILE_BREAKPOINT}px) {
          .nav-mobile-menu { display: none !important; }
        }
      `}</style>
    </header>
  );
}
