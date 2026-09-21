import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useProducts } from "./products.jsx";
import { formatRupees } from "../lib/money.js";

const CartContext = createContext(null);
const STORAGE_KEY = "yzlabs-cart-v1";
const DISCOUNT_KEY = "yzlabs-discount-v1";

function readStoredDiscountCode() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(DISCOUNT_KEY) || null;
  } catch {
    return null;
  }
}

// Asks the server whether `code` is good for this cart and what it takes off.
// The server is the only authority on that — the browser never computes a
// discount itself. Resolves to:
//   { ok: true, info }            the code applies (info = amounts in paise)
//   { ok: false, rejected: true } the server says the code doesn't apply
//   { ok: false }                 couldn't tell (offline, rate-limited, server error)
async function previewDiscount(code, items) {
  try {
    const res = await fetch("/api/discount/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, items }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) return { ok: true, info: body };
    return { ok: false, rejected: res.status === 400, error: body.error || "Couldn't check that code. Please try again." };
  } catch {
    return { ok: false, rejected: false, error: "Couldn't check that code. Please try again." };
  }
}

function readStoredCart() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

// The offers the shop advertises for this cart (what each would save, or how
// much more to add to unlock it). Resolves to { ok: true, offers } or { ok: false }.
async function fetchOffers(items) {
  try {
    const res = await fetch("/api/discount/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok && body.ok && Array.isArray(body.offers) ? { ok: true, offers: body.offers } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export function CartProvider({ children }) {
  const products = useProducts();
  const [lines, setLines] = useState(readStoredCart);
  const [isOpen, setIsOpen] = useState(false);
  // idle | checking-out | awaiting-payment | verifying | success | error
  const [status, setStatus] = useState("idle");
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  // A cart line is identified by product + color together (not just the
  // product id) — the same planter in two colors is two separate lines,
  // each with its own quantity and its own (possibly different) price.
  const lineKey = (productId, colorId) => `${productId}::${colorId}`;

  const addItem = useCallback((productId, colorId, qty = 1) => {
    const key = lineKey(productId, colorId);
    setLines((prev) => ({
      ...prev,
      [key]: { productId, colorId, qty: (prev[key]?.qty || 0) + qty },
    }));
    setIsOpen(true);
  }, []);

  const setQty = useCallback((key, qty) => {
    setLines((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[key];
      else next[key] = { ...next[key], qty };
      return next;
    });
  }, []);

  const removeItem = useCallback((key) => {
    setLines((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setLines({}), []);

  const items = useMemo(
    () =>
      Object.entries(lines)
        .map(([key, line]) => {
          const product = products.find((p) => p.id === line.productId);
          if (!product) return null;
          const color = product.colors.find((c) => c.id === line.colorId) || product.colors[0];
          return {
            ...product,
            qty: line.qty,
            lineId: key,
            colorId: color.id,
            colorway: color.name,
            colorHex: color.hex,
            price: product.price + (color.priceDelta || 0),
          };
        })
        .filter(Boolean),
    [lines, products]
  );

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  // --- Discount code -------------------------------------------------------
  // One code per order: applying a second replaces the first. `discount`
  // holds the server's answer (amounts in paise) for the cart it was checked
  // against; it's only shown while it still matches the cart (`discountValid`
  // below) and is re-checked whenever the cart changes. Whether THIS customer
  // is allowed to use the code (already used it / not a first order) can't be
  // known until they enter their details, so that's decided by the server at
  // checkout — if it refuses, `checkout` removes the code and says so.
  const [discountCode, setDiscountCode] = useState(readStoredDiscountCode);
  const [discount, setDiscount] = useState(null);
  const [discountStatus, setDiscountStatus] = useState("idle"); // idle | checking
  const [discountError, setDiscountError] = useState(null);

  useEffect(() => {
    try {
      if (discountCode) window.localStorage.setItem(DISCOUNT_KEY, discountCode);
      else window.localStorage.removeItem(DISCOUNT_KEY);
    } catch {
      // Storage blocked — the code just won't be remembered across visits.
    }
  }, [discountCode]);

  const cartPayload = useMemo(() => items.map((i) => ({ id: i.id, colorId: i.colorId, qty: i.qty })), [items]);
  const cartKey = JSON.stringify(cartPayload);
  const subtotalPaise = Math.round(subtotal * 100);

  const removeDiscount = useCallback(() => {
    setDiscountCode(null);
    setDiscount(null);
    setDiscountError(null);
  }, []);

  const applyDiscount = useCallback(
    async (raw) => {
      const code = String(raw || "").trim();
      if (!code || cartPayload.length === 0) return false;
      setDiscountStatus("checking");
      setDiscountError(null);
      const result = await previewDiscount(code, cartPayload);
      setDiscountStatus("idle");
      if (!result.ok) {
        setDiscountError(result.error);
        return false;
      }
      setDiscountCode(result.info.code);
      setDiscount(result.info);
      return true;
    },
    [cartPayload]
  );

  // Keep an applied code honest as the cart changes (quantities, items) and
  // when one is restored from a previous visit: re-ask the server, and drop
  // the code if it no longer applies (expired, minimum no longer met…).
  useEffect(() => {
    if (!discountCode) {
      setDiscount(null);
      return;
    }
    if (cartPayload.length === 0) return;
    if (discount && discount.code === discountCode && discount.subtotalPaise === subtotalPaise) return;
    let cancelled = false;
    previewDiscount(discountCode, cartPayload).then((result) => {
      if (cancelled) return;
      if (result.ok) setDiscount(result.info);
      else if (result.rejected) {
        removeDiscount();
        setDiscountError(`${result.error} The code was removed.`);
      }
      // Couldn't reach the server: leave things as they are and let checkout decide.
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountCode, cartKey]);

  const discountValid = Boolean(discount && discount.code === discountCode && discount.subtotalPaise === subtotalPaise);
  const discountAmount = discountValid ? discount.discountPaise / 100 : 0;
  const total = discountValid ? discount.totalPaise / 100 : subtotal;

  // The advertised offers, fetched as soon as the drawer opens (and again if
  // the cart changes while it's open) so the list is already there when the
  // customer taps "Check available offers". The previous list stays on screen
  // while a refresh is in flight.
  const [offers, setOffers] = useState(null); // null = not loaded yet
  const [offersStatus, setOffersStatus] = useState("idle"); // idle | loading | error
  const [offersNonce, setOffersNonce] = useState(0);
  const refreshOffers = useCallback(() => setOffersNonce((n) => n + 1), []);
  useEffect(() => {
    if (!isOpen || cartPayload.length === 0) return;
    let cancelled = false;
    setOffersStatus("loading");
    fetchOffers(cartPayload).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setOffers(result.offers);
        setOffersStatus("idle");
      } else {
        setOffersStatus("error");
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cartKey, offersNonce]);

  // Real Razorpay flow:
  // 0. The cart drawer's delivery step collects and validates the shipping
  //    details first; they're passed in here and never skipped.
  // 1. POST /api/create-order (server prices the cart itself, never trusts
  //    amounts from the client, and re-validates the delivery details) →
  //    gets back a Razorpay order id.
  // 2. Open Razorpay's Checkout widget for that order (supports UPI, cards,
  //    netbanking, wallets).
  // 3. On success, POST /api/verify-payment to check the signature
  //    server-side before treating the order as paid.
  const checkout = useCallback(async (shipping) => {
    if (items.length === 0 || !shipping) return;

    if (typeof window.Razorpay === "undefined") {
      setStatus("error");
      setNotice("Payment widget failed to load. Check your connection and try again.");
      return;
    }

    setStatus("checking-out");
    setNotice(null);

    let order;
    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, colorId: i.colorId, qty: i.qty })),
          shipping,
          // The server re-validates this (and checks THIS customer may use
          // it) — it never trusts an amount from here.
          ...(discountCode ? { discountCode } : {}),
        }),
      });
      order = await res.json();
      if (!res.ok) {
        const err = new Error(order.error || "Could not create order.");
        err.discountRejected = Boolean(order.discountRejected);
        throw err;
      }
    } catch (err) {
      setStatus("error");
      if (err.discountRejected) {
        // The server won't honour this code for this customer/cart. Nothing
        // was charged and no order exists; drop the code so the total shown
        // is the real one, and let them decide whether to go on.
        removeDiscount();
        setNotice(`${err.message} The code has been removed, so your total is ₹${formatRupees(subtotal)}. Review it and pay again if you'd like.`);
      } else {
        setNotice(err.message || "Could not start checkout. Is the backend running?");
      }
      return;
    }

    setStatus("awaiting-payment");

    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "YZ Labs",
      description: "Small-batch 3D printed objects",
      image: "/logo-circle.png",
      prefill: { name: shipping.name, email: shipping.email, contact: `+91${shipping.phone}` },
      theme: { color: "#3d6bff" },
      handler: async (response) => {
        setStatus("verifying");
        try {
          const verifyRes = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const result = await verifyRes.json();
          if (result.ok) {
            setStatus("success");
            setNotice("Payment successful. Thank you!");
            clearCart();
            removeDiscount();
          } else {
            setStatus("error");
            setNotice("Payment could not be verified. Contact us if you were charged.");
          }
        } catch {
          setStatus("error");
          setNotice("Payment went through, but we couldn't confirm it. Contact us to be sure.");
        }
      },
      modal: {
        ondismiss: () => {
          setStatus((s) => (s === "awaiting-payment" ? "idle" : s));
        },
      },
    });

    rzp.on("payment.failed", () => {
      setStatus("error");
      setNotice("Payment failed. No amount was charged. You can try again.");
    });

    rzp.open();
  }, [items, clearCart, discountCode, removeDiscount, subtotal]);

  const value = {
    items,
    itemCount,
    subtotal,
    discountCode,
    discount: discountValid ? discount : null,
    discountAmount,
    total,
    discountStatus,
    discountError,
    applyDiscount,
    removeDiscount,
    offers,
    offersStatus,
    refreshOffers,
    addItem,
    setQty,
    removeItem,
    clearCart,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    status,
    notice,
    checkout,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
