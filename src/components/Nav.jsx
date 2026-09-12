import { Link } from "react-router-dom";
import { useCart } from "../store/cart.jsx";

// No link menu and no background bar — the whole site is a single pinned
// scroll journey now (Catalog/Process/Materials arrive by scrolling, not
// by jumping through a menu), and every section shares the same pure-black
// ground, so there's nothing for a solid header to contrast against. The
// header is just the wordmark and the cart, floating directly on whatever
// chapter is underneath instead of sitting in its own bar above it.
export default function Nav() {
  const { itemCount, openCart } = useCart();

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
      }}
    >
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 96 }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img
            src="/logo-circle.png"
            alt="YZ LABS"
            width={56}
            height={56}
            style={{ display: "block", borderRadius: "50%", boxShadow: "0 0 0 1px var(--border-strong)" }}
          />
          <img src="/logo-wordmark.png" alt="YZ Labs" height={28} style={{ display: "block", width: "auto" }} />
        </Link>

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
            background: "var(--bg)",
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
      </div>
    </header>
  );
}
