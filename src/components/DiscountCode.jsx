import { useState } from "react";
import { useCart } from "../store/cart.jsx";

const ERROR_COLOR = "#FF8A7A";
const OK_COLOR = "#8FE0A8";

// The "have a discount code?" control in the cart drawer: an input while no
// code is applied, a removable chip once one is. One code per order — entering
// another simply replaces it. Everything about whether a code is valid comes
// from the server (see cart.jsx); this only collects the text and shows the
// answer.
export default function DiscountCode({ offersOpen, onOpenOffers, linkRef }) {
  const { discountCode, discount, discountStatus, discountError, applyDiscount, removeDiscount, offers } = useCart();
  // Shown while the list is still loading (so the link doesn't pop in late
  // and shove the layout down) and whenever there's at least one offer; hidden
  // only once we know there are none.
  const hasOffers = offers === null || offers.length > 0;
  const [value, setValue] = useState("");
  const checking = discountStatus === "checking";

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim() || checking) return;
    if (await applyDiscount(value)) setValue("");
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {discountCode ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            border: `1px solid ${OK_COLOR}55`,
            background: `${OK_COLOR}12`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 12, letterSpacing: "0.06em", color: OK_COLOR }}>
              {discountCode}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-dim)", marginTop: 2 }}>
              {discount ? discount.description || "Discount applied" : "Checking…"}
            </div>
          </div>
          <button
            type="button"
            onClick={removeDiscount}
            className="mono"
            style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer", textDecoration: "underline", flexShrink: 0 }}
          >
            Remove
          </button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            aria-label="Discount code"
            aria-invalid={discountError ? true : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Discount code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            className="mono"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: `1px solid ${discountError ? ERROR_COLOR : "var(--border-strong)"}`,
              padding: "10px 12px",
              color: "var(--fg)",
              fontSize: 13,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderRadius: 0,
            }}
          />
          <button
            type="submit"
            disabled={!value.trim() || checking}
            className="btn btn-ghost"
            style={{ padding: "0 16px", fontSize: 12, opacity: !value.trim() || checking ? 0.5 : 1 }}
          >
            {checking ? "Checking…" : "Apply"}
          </button>
        </form>
      )}
      {hasOffers && (
        <button
          ref={linkRef}
          type="button"
          onClick={onOpenOffers}
          aria-expanded={offersOpen}
          className="mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 10,
            fontSize: 12,
            letterSpacing: "0.02em",
            color: "var(--accent)",
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
            <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
          </svg>
          Check available offers
          <span aria-hidden>›</span>
        </button>
      )}
      {discountError && (
        <p role="alert" className="mono" style={{ fontSize: 11, color: ERROR_COLOR, marginTop: 8, lineHeight: 1.4 }}>
          {discountError}
        </p>
      )}
    </div>
  );
}
