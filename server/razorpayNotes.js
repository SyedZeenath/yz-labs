// Shared parsing of a Razorpay order's `notes` object — the durable record
// /api/create-order writes onto every order (customer details, items,
// discount). Both orderLedger.js (discount-eligibility history) and
// db/ordersRepo.js (the admin orders mirror) read the exact same fields off
// it; this is the one place that shape is defined, so the two can't quietly
// drift apart on a field name.

// Razorpay returns `notes` as [] (not {}) when an order has none.
export function notesOf(order) {
  const n = order?.notes;
  return n && typeof n === "object" && !Array.isArray(n) ? n : {};
}
