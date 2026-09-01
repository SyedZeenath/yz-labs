import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ProductVisual from "./ProductVisual.jsx";
import { useCart } from "../store/cart.jsx";

export default function ProductModal({ product, onClose }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!product) return;
    setAdded(false);
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [product, onClose]);

  const handleAdd = () => {
    addItem(product.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <AnimatePresence>
      {product && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 120 }}
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={product.name}
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              translateX: "-50%",
              translateY: "-50%",
              zIndex: 121,
              width: "min(880px, 92vw)",
              maxHeight: "88vh",
              overflowY: "auto",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
            }}
            className="product-modal"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                fontSize: 24,
                lineHeight: 1,
                cursor: "pointer",
                color: "var(--fg)",
                zIndex: 2,
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--border-strong)",
                background: "var(--bg-elevated)",
              }}
            >
              ×
            </button>

            <div style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
              <div style={{ width: "100%", maxWidth: 340 }}>
                <ProductVisual product={product} focused={true} />
              </div>
            </div>

            <div style={{ padding: "44px 40px 40px", display: "flex", flexDirection: "column" }}>
              <div
                className="mono"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 18,
                }}
              >
                <span>{product.batch}</span>
                <span style={{ color: product.status === "In stock" ? "#8FE0A8" : "#F4D58D" }}>{product.status}</span>
              </div>

              <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
                {product.category}
              </p>
              <h2 style={{ fontSize: 30, marginBottom: 12 }}>{product.name}</h2>
              <p style={{ fontSize: 14.5, color: "var(--fg-dim)", lineHeight: 1.6, marginBottom: 24 }}>{product.tagline}</p>

              <dl className="mono" style={{ display: "flex", flexDirection: "column", marginBottom: 28 }}>
                {[
                  ["Material", product.material],
                  ["Colorway", product.colorway],
                  ["Dimensions", product.dims],
                  ["Weight", product.weight],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 1fr",
                      gap: 16,
                      padding: "12px 0",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <dt style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {label}
                    </dt>
                    <dd style={{ margin: 0, fontSize: 13, color: "var(--fg-dim)" }}>{value}</dd>
                  </div>
                ))}
              </dl>

              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <span className="mono" style={{ fontSize: 24, fontWeight: 600 }}>
                  ₹{product.price}
                </span>
                <button onClick={handleAdd} className="btn btn-primary">
                  {added ? "✓ Added to cart" : "+ Add to cart"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      <style>{`
        @media (max-width: 720px) {
          .product-modal { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AnimatePresence>
  );
}
