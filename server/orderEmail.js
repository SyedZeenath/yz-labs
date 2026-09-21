import { PRODUCTS } from "../src/data/products.js";

// Razorpay caps every order note at 256 characters, so the line items are
// stored as a compact "id|colorId|qty|price;..." string rather than JSON
// (JSON overflowed the limit at around five distinct cart lines).
const NOTE_LIMIT = 250;

export function encodeItemsNote(lineItems) {
  const note = lineItems.map((l) => `${l.id}|${l.colorId}|${l.qty}|${l.price}`).join(";");
  return note.length > NOTE_LIMIT ? `${note.slice(0, NOTE_LIMIT - 1)}…` : note;
}

function describeItems(itemsNote) {
  return String(itemsNote || "")
    .split(";")
    .filter(Boolean)
    .map((entry) => {
      const [id, colorId, qty, price] = entry.split("|");
      const product = PRODUCTS.find((p) => p.id === id);
      const color = product?.colors.find((c) => c.id === colorId);
      return `  - ${qty} x ${product?.name || id}${color ? ` (${color.name})` : ""} @ Rs ${price} each`;
    });
}

const inr = (n) => Number(n).toLocaleString("en-IN");

// Builds the "you have a new paid order" email from a Razorpay order object
// (as returned by razorpay.orders.fetch) — Razorpay's own record is the
// source of truth, so this still works after the server has restarted and
// forgotten its in-memory order list.
export function buildOrderEmail(order, paymentId) {
  const n = order.notes || {};
  const amount = Number(order.amount) / 100;

  const text = [
    `New paid order - Rs ${inr(amount)}`,
    "",
    `Order ID:   ${order.id}`,
    `Payment ID: ${paymentId || "(see Razorpay dashboard)"}`,
    "",
    "ITEMS",
    ...(describeItems(n.items).length ? describeItems(n.items) : ["  (not recorded - check the Razorpay dashboard)"]),
    "",
    "CUSTOMER",
    `  Name:  ${n.ship_name || "-"}`,
    `  Email: ${n.ship_email || "-"}`,
    `  Phone: ${n.ship_phone || "-"}`,
    "",
    "SHIP TO",
    `  ${n.ship_name || "-"}`,
    `  ${n.ship_address || "-"}`,
    `  ${[n.ship_city, n.ship_state].filter(Boolean).join(", ") || "-"} - ${n.ship_pincode || "-"}`,
    "  India",
  ].join("\n");

  return {
    subject: `New order: Rs ${inr(amount)}${n.ship_name ? ` from ${n.ship_name}` : ""}`,
    text,
    replyTo: n.ship_email || undefined,
  };
}
