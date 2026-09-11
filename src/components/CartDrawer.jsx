import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { useCart } from "../store/cart.jsx";
import ProductSwatch from "./ProductSwatch.jsx";

const BUSY_STATUSES = ["checking-out", "awaiting-payment", "verifying"];
const BUTTON_LABEL = {
  "checking-out": "Starting checkout…",
  "awaiting-payment": "Waiting for payment…",
  verifying: "Confirming payment…",
};

export default function CartDrawer() {
  const { items, itemCount, subtotal, isOpen, closeCart, setQty, removeItem, checkout, status, notice } = useCart();
  const busy = BUSY_STATUSES.includes(status);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCart}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 90 }}
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              background: "var(--bg-elevated)",
              borderLeft: "1px solid var(--border)",
              zIndex: 91,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px", borderBottom: "1px solid var(--border)" }}>
              <span className="eyebrow">Cart · {itemCount}</span>
              <button onClick={closeCart} aria-label="Close cart" style={{ fontSize: 22, cursor: "pointer", lineHeight: 1 }}>
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 24px" }}>
              {items.length === 0 ? (
                <p className="mono" style={{ color: "var(--muted)", fontSize: 13, marginTop: 40 }}>
                  Cart is empty. Add something from the catalog.
                </p>
              ) : (
                items.map((item) => (
                  <div key={item.lineId} style={{ display: "flex", gap: 14, padding: "18px 0", borderBottom: "1px solid var(--border)" }}>
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        flexShrink: 0,
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {item.heroImage ? (
                        <img
                          src={item.heroImage}
                          alt={item.name}
                          style={{ width: "84%", height: "84%", objectFit: "contain" }}
                        />
                      ) : (
                        <ProductSwatch colorHex={item.colorHex} compact />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</span>
                        <span className="mono" style={{ fontSize: 13 }}>₹{item.price * item.qty}</span>
                      </div>
                      <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 10px" }}>
                        {item.colorway}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="mono" style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-strong)" }}>
                          <button
                            onClick={() => setQty(item.lineId, item.qty - 1)}
                            style={{ width: 26, height: 26, cursor: "pointer" }}
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            −
                          </button>
                          <span style={{ width: 26, textAlign: "center", fontSize: 12 }}>{item.qty}</span>
                          <button
                            onClick={() => setQty(item.lineId, item.qty + 1)}
                            style={{ width: 26, height: 26, cursor: "pointer" }}
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.lineId)}
                          className="mono"
                          style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer", textDecoration: "underline" }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: "20px 24px 26px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>
                  Subtotal
                </span>
                <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
                  ₹{subtotal}
                </span>
              </div>
              <button
                onClick={checkout}
                disabled={items.length === 0 || busy}
                className="btn btn-primary"
                style={{ width: "100%", opacity: items.length === 0 ? 0.5 : 1 }}
              >
                {BUTTON_LABEL[status] || "Checkout with Razorpay"}
              </button>
              <p className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
                UPI · Cards · Netbanking · Wallets
              </p>
              <p className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>
                By checking out you agree to our{" "}
                <Link to="/terms" style={{ textDecoration: "underline" }}>Terms</Link> and{" "}
                <Link to="/refund-policy" style={{ textDecoration: "underline" }}>Refund Policy</Link>.
              </p>
              <AnimatePresence>
                {notice && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: status === "success" ? "#8FE0A8" : status === "error" ? "#FF8A7A" : "var(--muted)",
                      marginTop: 12,
                      textAlign: "center",
                    }}
                  >
                    {notice}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
