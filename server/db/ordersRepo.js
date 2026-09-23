import { query } from "./pool.js";
import { notesOf } from "../razorpayNotes.js";

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
    createdAt: row.created_at,
  };
}

// Mirrors a Razorpay order into the database for fast admin browsing —
// called best-effort from notifyOrderPaid, its own try/catch, never blocking
// the payment confirmation or either order email. This table is NEVER
// consulted for pricing or discount-eligibility correctness; that stays
// Razorpay-via-orderLedger.js exactly as before. Only the three
// fulfillment_* columns are ever authoritative here (see updateFulfillment).
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

export async function list({ limit = 100, offset = 0, fulfillmentStatus } = {}) {
  const where = fulfillmentStatus ? `WHERE fulfillment_status = $3` : "";
  const params = fulfillmentStatus ? [limit, offset, fulfillmentStatus] : [limit, offset];
  const { rows } = await query(
    `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    params
  );
  return rows.map(normalize);
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
