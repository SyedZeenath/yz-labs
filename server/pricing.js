// Prices a cart entirely from the server's own catalog. Both functions take
// `products` (the live, already-resolved catalog — see
// server/db/productsCache.js) as an explicit argument rather than importing
// a static list: it keeps this file a pure function of its inputs (easy to
// unit-test with a small fixture array, no database needed — see
// discounts.test.js), and it's the caller's job to have a fresh `products`
// list in hand (via `productsCache.ensureFresh()`) before pricing anything.
//
// Price (and which color it resolves to) is looked up server-side only — a
// client-sent colorId can pick *which* known color's price applies, never
// override the price itself. Amounts are integer paise throughout so
// discount maths never touches floating-point rupees.

// The one place that's allowed to decide what a (productId, colorId) pair
// costs. `colorId` is optional; an unknown or omitted one falls back to the
// product's default (first) color rather than erroring, but the *price*
// always comes from this lookup, never from anything the client sends.
export function resolveProductPrice(productId, colorId, products) {
  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  const color = product.colors.find((c) => c.id === colorId) || product.colors[0];
  return { price: product.price + (color?.priceDelta || 0), color };
}

// Returns { ok: true, lineItems, subtotalPaise } or { ok: false, status, error }.
export function priceCart(items, products) {
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
    const resolved = resolveProductPrice(id, colorId, products);
    const price = resolved?.price;
    // Razorpay will flat-out refuse to create an order for a line/total
    // amount of ₹0 — that's exactly the rejection this was built to catch.
    // A product with no real price yet should be pulled from the catalog,
    // not left orderable at ₹0.
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
