import { useState } from "react";
import { motion } from "motion/react";
import ProductVisual from "./ProductVisual.jsx";
import { useCart } from "../store/cart.jsx";

const cardVariants = {
  hidden: { opacity: 0, y: 70, rotateX: -35, scale: 0.88 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: { duration: 1.05, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function ProductCard({ product, onOpen }) {
  const { addItem } = useCart();
  const [focused, setFocused] = useState(false);
  const [added, setAdded] = useState(false);

  const orderable = product.price > 0;

  const handleAdd = (e) => {
    e.stopPropagation();
    if (!orderable) return;
    addItem(product.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  const handleKeyOpen = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <motion.article
      variants={cardVariants}
      onMouseEnter={() => setFocused(true)}
      onMouseLeave={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={onOpen}
      onKeyDown={handleKeyOpen}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${product.name}`}
      style={{ display: "flex", flexDirection: "column", cursor: "pointer", transformPerspective: 1200 }}
    >
      <div
        className="mono"
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 14,
        }}
      >
        <span>{product.batch}</span>
        <span style={{ color: product.status === "In stock" ? "#8FE0A8" : "#F4D58D" }}>{product.status}</span>
      </div>

      <ProductVisual product={product} focused={focused} />

      <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase" }}>
            {product.category}
          </p>
          <h3 style={{ fontSize: 17, fontWeight: 600 }}>{product.name}</h3>
        </div>
        <span className="mono" style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", color: orderable ? "var(--fg)" : "var(--muted)" }}>
          {orderable ? `₹${product.price}` : "TBA"}
        </span>
      </div>

      <p style={{ fontSize: 13, color: "var(--fg-dim)", marginTop: 6, lineHeight: 1.5 }}>{product.tagline}</p>

      <div
        className="mono"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 16,
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
          {product.material} · {product.dims}
        </span>
        <button
          onClick={handleAdd}
          className="add-btn"
          disabled={!orderable}
          style={{ flexShrink: 0, opacity: orderable ? 1 : 0.4, cursor: orderable ? "pointer" : "not-allowed" }}
        >
          {!orderable ? "Not yet available" : added ? "✓ Added" : "+ Add"}
        </button>
      </div>

      <style>{`
        .add-btn {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 9px 15px;
          border: 1px solid var(--border-strong);
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
        }
        .add-btn:hover { background: var(--fg); color: var(--bg); border-color: var(--fg); }
      `}</style>
    </motion.article>
  );
}
