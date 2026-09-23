import { query } from "./pool.js";
import { notesOf } from "../razorpayNotes.js";
import { customerKeys } from "../orderLedger.js";

function normalize(row) {
  return {
    id: row.id,
    status: row.status,
    paymentId: row.payment_id,
    subtotalPaise: row.subtotal_paise,
    discountPaise: row.discount_paise,
    discountCode: row.discount_code,
    totalPaise: row.total_paise,
    itemsNote: row.items_note,
    shipName: row.ship_name,
    shipEmail: row.ship_email,
    shipPhone: row.ship_phone,
    shipAddress: row.ship_address,
    shipCity: row.ship_city,
    shipState: row.ship_state,
    shipPincode: row.ship_pincode,
    razorpayCreatedAt: row.razorpay_created_at,
    fulfillmentStatus: row.fulfillment_status,
    trackingNote: row.tracking_note,
    fulfilledAt: row.fulfilled_at,
    shiprocketOrderId: row.shiprocket_order_id,
    shiprocketPushedAt: row.shiprocket_pushed_at,
    createdAt: row.created_at,
  };
}

// Mirrors a Razorpay order into the database — for fast admin browsing, and
// (see hasPaidOrderForCustomer/paidRedemptionCount below) as a second,
// independent check on discount reuse. Pricing itself is never decided from
// here — that stays Razorpay's own numbers, checked server-side on every
// order. Only the three fulfillment_* columns are ever authoritative here
// (see updateFulfillment).
//
// Awaited directly by /api/verify-payment (not just fire-and-forget like the
// order emails) specifically so this write lands before that request even
// responds — a discount-eligibility check on someone's very next order,
// moments later, must see this one as paid.
export async function upsertFromRazorpay(order, { paymentId } = {}) {
  const n = notesOf(order);
  const discountPaise = Number(n.discount_paise) || 0;
  const subtotalPaise = Number(n.subtotal_paise) || Number(order.amount) + discountPaise;
  const { rows } = await query(
    `INSERT INTO orders (
       id, status, payment_id, subtotal_paise, discount_paise, discount_code, total_paise,
       items_note, ship_name, ship_email, ship_phone, ship_address, ship_city, ship_state, ship_pincode,
       razorpay_created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, to_timestamp($16))
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       payment_id = COALESCE(EXCLUDED.payment_id, orders.payment_id),
       mirrored_at = now(),
       updated_at = now()
     RETURNING *`,
    [
      order.id,
      order.status === "paid" ? "paid" : "created",
      paymentId || null,
      subtotalPaise,
      discountPaise,
      n.discount_code || null,
      Number(order.amount),
      n.items || null,
      n.ship_name || null,
      n.ship_email || null,
      n.ship_phone || null,
      n.ship_address || null,
      n.ship_city || null,
      n.ship_state || null,
      n.ship_pincode || null,
      Number(order.created_at) || null,
    ]
  );
  return normalize(rows[0]);
}

export async function getById(id) {
  const { rows } = await query(`SELECT * FROM orders WHERE id = $1`, [id]);
  return rows[0] ? normalize(rows[0]) : null;
}

// A signed-in customer's own order history (GET /api/customer/orders) —
// matched by email alone, the same identity a customer account IS in this
// app (no customers table, no customer_id on orders; see
// server/customerAuth.js). Only ever their PAID orders — an abandoned
// checkout was never theirs to see reappear.
export async function listForEmail(email) {
  const { rows } = await query(
    `SELECT * FROM orders WHERE status = 'paid' AND lower(ship_email) = lower($1) ORDER BY created_at DESC LIMIT 100`,
    [email]
  );
  return rows.map(normalize);
}

export async function list({ limit = 100, offset = 0, fulfillmentStatus } = {}) {
  const where = fulfillmentStatus ? `WHERE fulfillment_status = $3` : "";
  const params = fulfillmentStatus ? [limit, offset, fulfillmentStatus] : [limit, offset];
  const { rows } = await query(
    `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    params
  );
  return rows.map(normalize);
}

const overlaps = (a, b) => a.some((k) => b.includes(k));
function keysForRow(row) {
  return customerKeys({ email: row.ship_email, phone: row.ship_phone, address: row.ship_address, pincode: row.ship_pincode });
}

// Discount-eligibility checks, backed by this table rather than Razorpay's
// order list — see the comment on upsertFromRazorpay above for why. Checked
// IN ADDITION TO (not instead of) the existing Razorpay-rebuilt ledger in
// server/orderLedger.js: that one still covers orders placed before this
// table existed, which these two can't see. A plain table scan of paid
// orders is fine at this shop's volume; revisit if that stops being true.

// Any paid order at all for this customer?
export async function hasPaidOrderForCustomer(keys) {
  const { rows } = await query(`SELECT ship_email, ship_phone, ship_address, ship_pincode FROM orders WHERE status = 'paid'`);
  return rows.some((row) => overlaps(keysForRow(row), keys));
}

// How many paid orders has this customer already used `code` on?
export async function paidRedemptionCount(code, keys) {
  const { rows } = await query(`SELECT ship_email, ship_phone, ship_address, ship_pincode FROM orders WHERE status = 'paid' AND discount_code = $1`, [code]);
  return rows.filter((row) => overlaps(keysForRow(row), keys)).length;
}

// Records that server/shiprocket.js successfully pushed this order — purely
// informational for /admin, set fire-and-forget after a paid order's
// Shiprocket push succeeds. Never awaited by anything payment-critical.
export async function markShiprocketPushed(id, shiprocketOrderId) {
  await query(
    `UPDATE orders SET shiprocket_order_id = $2, shiprocket_pushed_at = now(), updated_at = now() WHERE id = $1`,
    [id, shiprocketOrderId]
  );
}

export async function updateFulfillment(id, { fulfillmentStatus, trackingNote }) {
  const { rows } = await query(
    `UPDATE orders SET
       fulfillment_status = $2,
       tracking_note = $3,
       fulfilled_at = CASE WHEN $2 = 'shipped' THEN now() ELSE fulfilled_at END,
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, fulfillmentStatus, trackingNote ?? null]
  );
  return rows[0] ? normalize(rows[0]) : null;
}
