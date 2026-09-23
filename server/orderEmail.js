import { BRAND, esc, eyebrow, cardHtml, emailShell } from "./emailTemplate.js";

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
// exactly as it always has. Shared by both the plain-text and HTML builders
// below so line-item parsing only lives in one place.
function parseItems(itemsNote, products = []) {
  return String(itemsNote || "")
    .split(";")
    .filter(Boolean)
    .map((entry) => {
      const [id, colorId, qty, price] = entry.split("|");
      const product = products.find((p) => p.id === id);
      const color = product?.colors.find((c) => c.id === colorId);
      return { name: product?.name || id, colorName: color?.name || null, qty: Number(qty) || 0, price: Number(price) || 0 };
    });
}

function describeItems(itemsNote, products = []) {
  return parseItems(itemsNote, products).map((it) => `  - ${it.qty} x ${it.name}${it.colorName ? ` (${it.colorName})` : ""} @ Rs ${it.price} each`);
}

// Whole rupees plain, fractional ones to 2 places ("Rs 4,240" / "Rs 802.50").
const inr = (n) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });

// ------------------------------------------------------------- HTML emails
//
// Every order email is sent multipart/alternative (see gmailApi.js) — this
// HTML part alongside the plain-text one above, never instead of it. Brand
// colors, the logo header, and the rounded card come from emailTemplate.js
// (shared with waitlistEmail.js); these two helpers are order-specific
// (line items, subtotal/discount/total) so they stay local to this file.
function itemsTableHtml(items) {
  const rows = items
    .map(
      (it) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.fg};font-size:14px;">
            ${esc(it.qty)} &times; ${esc(it.name)}${it.colorName ? `<span style="color:${BRAND.muted};"> (${esc(it.colorName)})</span>` : ""}
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.fgDim};font-size:14px;white-space:nowrap;">Rs ${esc(it.price)} each</td>
        </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
}

function totalsHtml(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px;">
    ${rows
      .map(
        ({ label, value, strong, color }) => `
      <tr>
        <td style="padding:4px 0;font-size:${strong ? 15 : 13}px;color:${color || (strong ? BRAND.fg : BRAND.muted)};font-weight:${strong ? 600 : 400};">${esc(label)}</td>
        <td align="right" style="padding:4px 0;font-size:${strong ? 15 : 13}px;color:${color || (strong ? BRAND.fg : BRAND.fgDim)};font-weight:${strong ? 600 : 400};">${esc(value)}</td>
      </tr>`
      )
      .join("")}
  </table>`;
}

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
  const itemsStructured = parseItems(n.items, products);

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

  const html = emailShell({
    preheader: `New paid order — Rs ${inr(amount)}${n.ship_name ? ` from ${n.ship_name}` : ""}`,
    bodyHtml: `
      <tr><td>
        ${
          duplicateDiscount
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,90,60,0.12);border:1px solid ${BRAND.warn};border-radius:2px;margin-bottom:24px;">
                <tr><td style="padding:14px 16px;font-size:13px;line-height:1.6;color:${BRAND.fg};">
                  <strong style="color:${BRAND.warn};">Check this order:</strong> this customer had already used <strong>${esc(discountCode)}</strong> on an earlier paid order.
                  The once-per-customer rule was beaten (likely two checkouts open at once). The payment went through, so decide whether to refund the discount.
                </td></tr>
              </table>`
            : ""
        }
        <h1 style="margin:0 0 4px;font-size:22px;font-weight:600;color:${BRAND.fg};">New paid order</h1>
        <p style="margin:0;font-size:24px;font-weight:600;color:${BRAND.accent};">Rs ${esc(inr(amount))}</p>
        ${cardHtml(`
          ${eyebrow("Order", { first: true })}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:${BRAND.fgDim};">
            <tr><td style="padding:2px 0;color:${BRAND.muted};width:110px;">Order ID</td><td style="padding:2px 0;font-family:monospace;">${esc(order.id)}</td></tr>
            <tr><td style="padding:2px 0;color:${BRAND.muted};">Payment ID</td><td style="padding:2px 0;font-family:monospace;">${esc(paymentId || "see Razorpay dashboard")}</td></tr>
          </table>
          ${eyebrow("Items")}
          ${itemsStructured.length ? itemsTableHtml(itemsStructured) : `<p style="font-size:13px;color:${BRAND.muted};">Not recorded — check the Razorpay dashboard.</p>`}
          ${
            discountCode
              ? totalsHtml([
                  { label: "Subtotal", value: `Rs ${inr(subtotal)}` },
                  { label: `Discount (${discountCode})`, value: `-Rs ${inr(discount)}`, color: BRAND.accent },
                  { label: "Paid", value: `Rs ${inr(amount)}`, strong: true },
                ])
              : ""
          }
          ${eyebrow("Ship to")}
          <p style="margin:0;font-size:13px;line-height:1.7;color:${BRAND.fgDim};">
            ${esc(n.ship_name || "-")}<br/>
            ${esc(n.ship_address || "-")}<br/>
            ${esc([n.ship_city, n.ship_state].filter(Boolean).join(", ") || "-")} - ${esc(n.ship_pincode || "-")}<br/>
            India
          </p>
        `)}
        ${eyebrow("Customer", { first: true })}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:${BRAND.fgDim};">
          <tr><td style="padding:2px 0;color:${BRAND.muted};width:110px;">Name</td><td style="padding:2px 0;">${esc(n.ship_name || "-")}</td></tr>
          <tr><td style="padding:2px 0;color:${BRAND.muted};">Email</td><td style="padding:2px 0;">${esc(n.ship_email || "-")}</td></tr>
          <tr><td style="padding:2px 0;color:${BRAND.muted};">Phone</td><td style="padding:2px 0;">${esc(n.ship_phone || "-")}</td></tr>
        </table>
      </td></tr>`,
  });

  return {
    subject: `${duplicateDiscount ? "[CHECK] " : ""}New order: Rs ${inr(amount)}${n.ship_name ? ` from ${n.ship_name}` : ""}${discountCode ? ` (${discountCode})` : ""}`,
    text,
    html,
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
  const itemsStructured = parseItems(n.items, products);

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

  const addressLines = [oneLine(n.ship_address), `${[n.ship_city, n.ship_state].map(oneLine).filter(Boolean).join(", ")}${n.ship_pincode ? ` - ${oneLine(n.ship_pincode)}` : ""}`].filter(Boolean);
  const nextSteps = [
    "In-stock items are packed and dispatched within 3-5 business days; made-to-order pieces take 7-10.",
    "Once dispatched, delivery usually takes 3-7 business days. We'll email you tracking details when your order ships.",
    "You may also get a separate payment receipt from Razorpay.",
  ];

  const html = emailShell({
    preheader: `Thanks${name ? `, ${name}` : ""} — your order is confirmed and on its way to being packed.`,
    bodyHtml: `
      <tr><td>
        <div style="display:inline-block;padding:3px 10px;border:1px solid ${BRAND.accent};border-radius:20px;font-size:11px;letter-spacing:0.06em;color:${BRAND.accent};text-transform:uppercase;margin-bottom:14px;">Payment confirmed</div>
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:${BRAND.fg};">${name ? `Thanks, ${esc(name)}.` : "Thanks for your order."}</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.fgDim};">Your payment went through and we've got it — here's everything you ordered.</p>
        ${cardHtml(`
          ${eyebrow("Order", { first: true })}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:${BRAND.fgDim};">
            <tr><td style="padding:2px 0;color:${BRAND.muted};width:110px;">Order ID</td><td style="padding:2px 0;font-family:monospace;">${esc(order.id)}</td></tr>
            ${paymentId ? `<tr><td style="padding:2px 0;color:${BRAND.muted};">Payment ID</td><td style="padding:2px 0;font-family:monospace;">${esc(paymentId)}</td></tr>` : ""}
          </table>
          ${eyebrow("What you ordered")}
          ${itemsStructured.length ? itemsTableHtml(itemsStructured) : `<p style="font-size:13px;color:${BRAND.muted};">See your Razorpay payment receipt for the amount.</p>`}
          ${totalsHtml([
            ...(discountCode
              ? [
                  { label: "Subtotal", value: `Rs ${inr(subtotal)}` },
                  { label: `Discount (${discountCode})`, value: `-Rs ${inr(discount)}`, color: BRAND.accent },
                ]
              : []),
            { label: "Total paid", value: `Rs ${inr(amount)}`, strong: true },
          ])}
          <p style="margin:6px 0 0;font-size:12px;color:${BRAND.muted};">Shipping is included in the price.</p>
          ${eyebrow("Delivering to")}
          <p style="margin:0;font-size:13px;line-height:1.7;color:${BRAND.fgDim};">
            ${[name, ...addressLines, "India"].filter(Boolean).map(esc).join("<br/>")}
          </p>
        `)}
        ${eyebrow("What happens next", { first: true })}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${nextSteps
            .map(
              (step) => `
            <tr>
              <td valign="top" style="padding:4px 10px 4px 0;color:${BRAND.accent};font-size:13px;">&bull;</td>
              <td style="padding:4px 0;font-size:13px;line-height:1.6;color:${BRAND.fgDim};">${esc(step)}</td>
            </tr>`
            )
            .join("")}
        </table>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${BRAND.fgDim};">
          Spotted a mistake in the address, or have a question? Reply to this email${shop.phone ? ` or call ${esc(shop.phone)}` : ""} and quote your order ID — the sooner the better, before it ships.
        </p>
      </td></tr>`,
  });

  return {
    to,
    subject: `Your YZ Labs order is confirmed (Rs ${inr(amount)})`,
    text,
    html,
    replyTo: shop.email || undefined,
  };
}
