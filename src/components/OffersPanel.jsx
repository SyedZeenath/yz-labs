import { useEffect, useRef, useState } from "react";
import { useCart } from "../store/cart.jsx";
import { formatRupees } from "../lib/money.js";

const OK_COLOR = "#8FE0A8";
const ERROR_COLOR = "#FF8A7A";

// The list behind "Check available offers": it slides over the cart's item
// area (the code field and totals stay visible underneath it) and shows every
// offer the shop advertises, what each would save on THIS cart, and its fine
// print. One tap applies an offer and closes the list — no typing. Only one
// offer can be on an order, so applying another simply replaces the current
// one; the current one is marked so that's obvious.
export default function OffersPanel({ open, onClose }) {
  const { offers, offersStatus, refreshOffers, discountCode, applyDiscount, discountStatus, discountError } = useCart();
  const closeRef = useRef(null);
  const [applying, setApplying] = useState(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        // Don't let this same Escape also reach anything listening behind it.
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const apply = async (code) => {
    setApplying(code);
    const ok = await applyDiscount(code);
    setApplying(null);
    if (ok) onClose();
  };

  const loadingFirst = offers === null && offersStatus !== "error";

  return (
    <div
      role="region"
      aria-label="Available offers"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 3,
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0c",
        animation: "offers-in 220ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <style>{`@keyframes offers-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 12px" }}>
        <span className="eyebrow">Available offers</span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mono"
          style={{ fontSize: 12, color: "var(--fg-dim)", cursor: "pointer", textDecoration: "underline" }}
        >
          Back to cart
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "4px 24px 20px" }}>
        {loadingFirst && (
          <p className="mono" style={{ fontSize: 13, color: "var(--muted)", marginTop: 16 }}>
            Loading offers…
          </p>
        )}

        {offers === null && offersStatus === "error" && (
          <div style={{ marginTop: 16 }}>
            <p className="mono" style={{ fontSize: 13, color: ERROR_COLOR, lineHeight: 1.5 }}>
              Couldn't load the offers.
            </p>
            <button type="button" onClick={refreshOffers} className="btn btn-ghost" style={{ marginTop: 12, padding: "10px 16px", fontSize: 12 }}>
              Try again
            </button>
          </div>
        )}

        {offers && offers.length === 0 && (
          <p className="mono" style={{ fontSize: 13, color: "var(--muted)", marginTop: 16, lineHeight: 1.5 }}>
            No offers available right now. Have a code? Type it in the box below.
          </p>
        )}

        {offers && offers.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {offers.map((offer) => {
              const isApplied = offer.code === discountCode;
              const busy = applying === offer.code;
              return (
                <li
                  key={offer.code}
                  style={{
                    padding: "14px 14px 12px",
                    border: `1px solid ${isApplied ? `${OK_COLOR}66` : "var(--border-strong)"}`,
                    background: isApplied ? `${OK_COLOR}10` : "transparent",
                    opacity: offer.applicable ? 1 : 0.6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span
                      className="mono"
                      style={{ fontSize: 12.5, letterSpacing: "0.08em", color: offer.applicable ? OK_COLOR : "var(--fg-dim)", border: "1px dashed currentColor", padding: "3px 8px" }}
                    >
                      {offer.code}
                    </span>
                    {isApplied ? (
                      <span className="mono" style={{ fontSize: 11.5, color: OK_COLOR }}>
                        ✓ Applied
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => apply(offer.code)}
                        disabled={!offer.applicable || discountStatus === "checking"}
                        className="btn btn-ghost"
                        style={{ padding: "6px 14px", fontSize: 12, opacity: !offer.applicable || (discountStatus === "checking" && !busy) ? 0.5 : 1 }}
                      >
                        {busy ? "Applying…" : discountCode ? "Use instead" : "Apply"}
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: 14, fontWeight: 600, margin: "10px 0 0" }}>{offer.description}</p>

                  {offer.applicable ? (
                    <p className="mono" style={{ fontSize: 12, color: OK_COLOR, margin: "6px 0 0" }}>
                      You'd save ₹{formatRupees(offer.savingsPaise / 100)} on this order
                    </p>
                  ) : (
                    <p className="mono" style={{ fontSize: 12, color: "var(--fg-dim)", margin: "6px 0 0" }}>
                      {offer.reason}
                    </p>
                  )}

                  <p className="mono" style={{ fontSize: 10.5, color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.5 }}>
                    {offer.terms.join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {discountError && (
          <p role="alert" className="mono" style={{ fontSize: 11.5, color: ERROR_COLOR, marginTop: 14, lineHeight: 1.4 }}>
            {discountError}
          </p>
        )}

        {offers && offers.length > 0 && (
          <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 16, lineHeight: 1.5 }}>
            Only one offer can be used per order. Choosing another replaces the one you have.
          </p>
        )}
      </div>
    </div>
  );
}
