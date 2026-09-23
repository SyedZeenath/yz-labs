// Razorpay caps every order note at 256 characters, so the line items are
// stored as a compact "id|colorId|qty|price;..." string rather than JSON
// (JSON overflowed the limit at around five distinct cart lines).
const NOTE_LIMIT = 250;

export function encodeItemsNote(lineItems) {
  const note = lineItems.map((l) => `${l.id}|${l.colorId}|${l.qty}|${l.price}`).join(";");
  return note.length > NOTE_LIMIT ? `${note.slice(0, NOTE_LIMIT - 1)}…` : note;
}

// `products` is the live catalog (see server/db/productsCache.js), passed in
// rather than imported — this file has no database/catalog dependency of its
// own, and falls back to the bare id/no color name when a product can't be
// found (an archived or since-deleted product, or `products` not supplied),
// exactly as it always has.
function describeItems(itemsNote, products = []) {
  return String(itemsNote || "")
    .split(";")
    .filter(Boolean)
    .map((entry) => {
      const [id, colorId, qty, price] = entry.split("|");
      const product = products.find((p) => p.id === id);
      const color = product?.colors.find((c) => c.id === colorId);
      return `  - ${qty} x ${product?.name || id}${color ? ` (${color.name})` : ""} @ Rs ${price} each`;
    });
}

// Whole rupees plain, fractional ones to 2 places ("Rs 4,240" / "Rs 802.50").
const inr = (n) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });

// Builds the "you have a new paid order" email from a Razorpay order object
// (as returned by razorpay.orders.fetch) — Razorpay's own record is the
// source of truth, so this still works after the server has restarted and
// forgotten its in-memory order list. `flags.duplicateDiscount` is set when
// the ledger sees the customer had already used this code (see
// orderLedger.isDuplicateRedemption).
export function buildOrderEmail(order, paymentId, { duplicateDiscount, products = [] } = {}) {
  const n = order.notes && typeof order.notes === "object" && !Array.isArray(order.notes) ? order.notes : {};
  const amount = Number(order.amount) / 100;
  const discountCode = n.discount_code || null;
  const discount = Number(n.discount_paise) / 100 || 0;
  const subtotal = Number(n.subtotal_paise) / 100 || amount + discount;
  const items = describeItems(n.items, products);

  const text = [
    ...(duplicateDiscount
      ? [
          `!! CHECK: this customer had already used ${discountCode} on an earlier paid order.`,
          "!! The once-per-customer rule was beaten (likely two checkouts open at once). The payment went through, so decide whether to refund the discount.",
          "",
        ]
      : []),
    `New paid order - Rs ${inr(amount)}`,
    "",
    `Order ID:   ${order.id}`,
    `Payment ID: ${paymentId || "(see Razorpay dashboard)"}`,
    "",
    "ITEMS",
    ...(items.length ? items : ["  (not recorded - check the Razorpay dashboard)"]),
    ...(discountCode
      ? ["", "TOTALS", `  Subtotal:            Rs ${inr(subtotal)}`, `  Discount (${discountCode}): -Rs ${inr(discount)}`, `  Paid:                Rs ${inr(amount)}`]
      : []),
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
    subject: `${duplicateDiscount ? "[CHECK] " : ""}New order: Rs ${inr(amount)}${n.ship_name ? ` from ${n.ship_name}` : ""}${discountCode ? ` (${discountCode})` : ""}`,
    text,
    replyTo: n.ship_email || undefined,
  };
}

// Header/body text that came from a form: collapse anything that could break
// a line (or a header) into a single space.
const oneLine = (s) => String(s || "").replace(/[\r\n\t]+/g, " ").trim();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The customer's own confirmation, built from the same Razorpay order record
// as the owner's email. `shop` is { email, phone } — the contact details to
// put in the footer and to use as reply-to. Returns null when the order has no
// usable customer email (orders placed before the delivery step existed).
// Razorpay sends its own payment receipt separately; this is the part it
// can't: what was bought, where it's going, and what happens next.
export function buildCustomerEmail(order, paymentId, { email, phone, products = [] } = {}) {
  const shop = { email, phone };
  const n = order.notes && typeof order.notes === "object" && !Array.isArray(order.notes) ? order.notes : {};
  const to = oneLine(n.ship_email);
  if (!EMAIL_RE.test(to)) return null;

  const amount = Number(order.amount) / 100;
  const discountCode = n.discount_code || null;
  const discount = Number(n.discount_paise) / 100 || 0;
  const subtotal = Number(n.subtotal_paise) / 100 || amount + discount;
  const name = oneLine(n.ship_name);
  const items = describeItems(n.items, products);

  const text = [
    name ? `Hi ${name},` : "Hi,",
    "",
    "Thank you for your order - your payment went through and we've got it.",
    "",
    `Order ID:   ${order.id}`,
    ...(paymentId ? [`Payment ID: ${paymentId}`] : []),
    "",
    "WHAT YOU ORDERED",
    ...(items.length ? items : ["  (see your Razorpay payment receipt for the amount)"]),
    "",
    ...(discountCode
      ? [`  Subtotal:            Rs ${inr(subtotal)}`, `  Discount (${discountCode}): -Rs ${inr(discount)}`, `  Total paid:          Rs ${inr(amount)}`]
      : [`  Total paid: Rs ${inr(amount)}`]),
    "  Shipping is included in the price.",
    "",
    "DELIVERING TO",
    ...[name, oneLine(n.ship_address), `${[n.ship_city, n.ship_state].map(oneLine).filter(Boolean).join(", ")}${n.ship_pincode ? ` - ${oneLine(n.ship_pincode)}` : ""}`, "India"]
      .filter((line) => line && line.trim())
      .map((line) => `  ${line}`),
    "",
    "WHAT HAPPENS NEXT",
    "  - In-stock items are packed and dispatched within 3-5 business days; made-to-order pieces take 7-10.",
    "  - Once dispatched, delivery usually takes 3-7 business days. We'll email you tracking details when your order ships.",
    "  - You may also get a separate payment receipt from Razorpay.",
    "",
    "Spotted a mistake in the address, or have a question? Reply to this email" + (shop.phone ? ` or call ${shop.phone}` : "") + " and quote your order ID - the sooner the better, before it ships.",
    "",
    "YZ Labs",
    "Small-batch 3D-printed objects, Bengaluru",
    ...(shop.email ? [shop.email] : []),
  ].join("\n");

  return {
    to,
    subject: `Your YZ Labs order is confirmed (Rs ${inr(amount)})`,
    text,
    replyTo: shop.email || undefined,
  };
}
