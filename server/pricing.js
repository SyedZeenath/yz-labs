import { resolveProductPrice } from "../src/data/products.js";

// Prices a cart entirely from the server's own catalog. Returns
// { ok: true, lineItems, subtotalPaise } or { ok: false, status, error }.
//
// Price (and which color it resolves to) is looked up server-side only — a
// client-sent colorId can pick *which* known color's price applies, never
// override the price itself. Amounts are integer paise throughout so
// discount maths never touches floating-point rupees.
export function priceCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, status: 400, error: "Cart is empty." };
  }

  let subtotalPaise = 0;
  const lineItems = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { ok: false, status: 400, error: "Invalid cart item." };
    }
    const { id, colorId, qty } = item;
    const resolved = resolveProductPrice(id, colorId);
    const price = resolved?.price;
    // Razorpay will flat-out refuse to create an order for a line/total
    // amount of ₹0 — that's exactly the rejection this was built to catch.
    // A product with no real price yet should be pulled from the catalog
    // (src/data/products.js), not left orderable at ₹0.
    if (!resolved || !Number.isFinite(price) || price <= 0) {
      return { ok: false, status: 400, error: `"${id}" doesn't have a valid price yet and can't be ordered.` };
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      return { ok: false, status: 400, error: `Invalid quantity for: ${id}` };
    }
    subtotalPaise += Math.round(price * 100) * qty;
    lineItems.push({ id, colorId: resolved.color?.id, qty, price });
  }

  return { ok: true, lineItems, subtotalPaise };
}
