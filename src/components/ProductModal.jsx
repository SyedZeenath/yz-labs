import { useEffect, useState } from "react";
import ProductGallery from "./ProductGallery.jsx";
import { useCart } from "../store/cart.jsx";

// Deliberately NOT using AnimatePresence here — mounting/unmounting via its
// exit animation was confirmed unreliable in this environment (the exit
// transition runs, opacity animates to 0, but the element never actually
// leaves the DOM, so the modal becomes invisible-but-un-closeable). Same
// root cause as the Hero chapter crossfade bug; same fix: stay mounted once
// first opened, drive visibility with a plain CSS opacity/transform
// transition instead of Motion's mount lifecycle.
export default function ProductModal({ product, onClose }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [displayProduct, setDisplayProduct] = useState(product);
  const isOpen = Boolean(product);

  useEffect(() => {
    if (product) setDisplayProduct(product);
  }, [product]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose]);

  if (!displayProduct) return null;

  const p = displayProduct;

  const handleAdd = () => {
    addItem(p.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          zIndex: 120,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 340ms ease",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
        aria-label={p.name}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: isOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.94)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 460ms cubic-bezier(0.16,1,0.3,1), transform 460ms cubic-bezier(0.16,1,0.3,1)",
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

        <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
          <div style={{ width: "100%", maxWidth: 360 }}>
            <ProductGallery images={p.images} name={p.name} />
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
            <span>{p.batch}</span>
            <span style={{ color: p.status === "In stock" ? "#8FE0A8" : "#F4D58D" }}>{p.status}</span>
          </div>

          <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
            {p.category}
          </p>
          <h2 style={{ fontSize: 30, marginBottom: 12 }}>{p.name}</h2>
          <p style={{ fontSize: 14.5, color: "var(--fg-dim)", lineHeight: 1.6, marginBottom: 24 }}>{p.tagline}</p>

          <dl className="mono" style={{ display: "flex", flexDirection: "column", marginBottom: 28 }}>
            {[
              ["Material", p.material],
              ["Colorway", p.colorway],
              ["Dimensions", p.dims],
              ["Weight", p.weight],
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
            {p.price > 0 ? (
              <>
                <span className="mono" style={{ fontSize: 24, fontWeight: 600 }}>
                  ₹{p.price}
                </span>
                <button onClick={handleAdd} className="btn btn-primary">
                  {added ? "✓ Added to cart" : "+ Add to cart"}
                </button>
              </>
            ) : (
              <>
                <span className="mono" style={{ fontSize: 14, color: "var(--muted)" }}>
                  Pricing coming soon
                </span>
                <button disabled className="btn btn-primary" style={{ opacity: 0.4, cursor: "not-allowed" }}>
                  Not yet available
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .product-modal { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
