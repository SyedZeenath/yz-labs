import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { useCart } from "../store/cart.jsx";
import ProductSwatch from "./ProductSwatch.jsx";
import DeliveryForm from "./DeliveryForm.jsx";
import { LEGAL_LINKS } from "../pages/LegalLayout.jsx";

const DELIVERY_FORM_ID = "checkout-delivery";

const BUSY_STATUSES = ["checking-out", "awaiting-payment", "verifying"];
const BUTTON_LABEL = {
  "checking-out": "Starting checkout…",
  "awaiting-payment": "Waiting for payment…",
  verifying: "Confirming payment…",
};

export default function CartDrawer() {
  const { items, itemCount, subtotal, isOpen, closeCart, setQty, removeItem, checkout, status, notice } = useCart();
  const busy = BUSY_STATUSES.includes(status);

  // "cart" → "address" → (Razorpay widget). The delivery step is what stops
  // checkout from going straight from the cart to payment: no order is
  // created until the address has been entered and validated.
  const [step, setStep] = useState("cart");
  const bodyRef = useRef(null);

  // Always reopen on the cart itself, and fall back to it once the cart
  // empties (a successful payment clears it).
  useEffect(() => {
    if (!isOpen) setStep("cart");
  }, [isOpen]);
  useEffect(() => {
    if (items.length === 0) setStep("cart");
  }, [items.length]);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [step]);

  // The page behind is a pinned scroll journey driven purely by scroll
  // position, so any wheel/touch scroll that reaches it moves the whole
  // site under the drawer — even when the drawer's own list has nothing to
  // scroll. Lock the page while the drawer is open (same approach as
  // ContactModal and ProductModal), and keep the layout from shifting
  // sideways when the page scrollbar disappears by padding the body by the
  // scrollbar's width. Previous inline values are restored, not cleared.
  useEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    const prev = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
    return () => {
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
    };
  }, [isOpen]);

  const onDelivery = step === "address";

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
          {/* .glass-strong (not the resting .glass) — this panel sits over
              its own scrim, not over active particle content, so it needs
              to hold its own translucent-but-legible look regardless of
              whatever's behind that dimmed backdrop. */}
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="glass glass-strong"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              zIndex: 91,
              display: "flex",
              flexDirection: "column",
              overscrollBehavior: "contain",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px", borderBottom: "1px solid var(--border)" }}>
              {onDelivery ? (
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button
                    onClick={() => setStep("cart")}
                    disabled={busy}
                    aria-label="Back to cart"
                    style={{ fontSize: 20, lineHeight: 1, cursor: busy ? "default" : "pointer", opacity: busy ? 0.4 : 1 }}
                  >
                    ←
                  </button>
                  <span className="eyebrow">Delivery · Step 2 of 2</span>
                </div>
              ) : (
                <span className="eyebrow">Cart · {itemCount}</span>
              )}
              <button onClick={closeCart} aria-label="Close cart" style={{ fontSize: 22, cursor: "pointer", lineHeight: 1 }}>
                ×
              </button>
            </div>

            {/* overscrollBehavior: contain — when this list reaches its end
                (or has nothing to scroll), the leftover scroll stops here
                instead of chaining out to whatever is behind the drawer;
                covers touch devices, where locking the body alone isn't
                always enough. */}
            <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", padding: "8px 24px" }}>
              {onDelivery ? (
                <DeliveryForm id={DELIVERY_FORM_ID} disabled={busy} onSubmit={checkout} />
              ) : items.length === 0 ? (
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
              {/* Distinct keys matter: without them React reuses one <button>
                  element across both steps, so it becomes type="submit" in
                  the middle of the "Continue" click and the browser's
                  default action then submits the (still empty) form. */}
              {onDelivery ? (
                <button
                  key="pay"
                  type="submit"
                  form={DELIVERY_FORM_ID}
                  disabled={items.length === 0 || busy}
                  className="btn btn-primary"
                  style={{ width: "100%", opacity: items.length === 0 || busy ? 0.6 : 1 }}
                >
                  {BUTTON_LABEL[status] || `Pay ₹${subtotal} with Razorpay`}
                </button>
              ) : (
                <button
                  key="continue"
                  type="button"
                  onClick={() => setStep("address")}
                  disabled={items.length === 0 || busy}
                  className="btn btn-primary"
                  style={{ width: "100%", opacity: items.length === 0 ? 0.5 : 1 }}
                >
                  {BUTTON_LABEL[status] || "Continue to delivery"}
                </button>
              )}
              <p className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
                UPI · Cards · Netbanking · Wallets
              </p>
              <div
                className="mono"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: "6px 12px",
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--border)",
                }}
              >
                {LEGAL_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
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
