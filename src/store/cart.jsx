import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { PRODUCTS } from "../data/products.js";

const CartContext = createContext(null);
const STORAGE_KEY = "yzlabs-cart-v1";

function readStoredCart() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function CartProvider({ children }) {
  const [lines, setLines] = useState(readStoredCart);
  const [isOpen, setIsOpen] = useState(false);
  // idle | checking-out | awaiting-payment | verifying | success | error
  const [status, setStatus] = useState("idle");
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const addItem = useCallback((productId, qty = 1) => {
    setLines((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + qty }));
    setIsOpen(true);
  }, []);

  const setQty = useCallback((productId, qty) => {
    setLines((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setLines((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setLines({}), []);

  const items = useMemo(
    () =>
      Object.entries(lines)
        .map(([id, qty]) => {
          const product = PRODUCTS.find((p) => p.id === id);
          return product ? { ...product, qty } : null;
        })
        .filter(Boolean),
    [lines]
  );

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  // Real Razorpay flow:
  // 1. POST /api/create-order (server prices the cart itself, never trusts
  //    amounts from the client) → gets back a Razorpay order id.
  // 2. Open Razorpay's Checkout widget for that order (supports UPI, cards,
  //    netbanking, wallets).
  // 3. On success, POST /api/verify-payment to check the signature
  //    server-side before treating the order as paid.
  const checkout = useCallback(async () => {
    if (items.length === 0) return;

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
        body: JSON.stringify({ items: items.map((i) => ({ id: i.id, qty: i.qty })) }),
      });
      order = await res.json();
      if (!res.ok) throw new Error(order.error || "Could not create order.");
    } catch (err) {
      setStatus("error");
      setNotice(err.message || "Could not start checkout. Is the backend running?");
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
  }, [items, clearCart]);

  const value = {
    items,
    itemCount,
    subtotal,
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
