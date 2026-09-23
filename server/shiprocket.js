// Pushes a paid order into the Shiprocket panel so it shows up ready to
// ship — "push to panel only" (Level 1): this never picks a courier,
// schedules a pickup, or spends any wallet balance. A human still opens
// Shiprocket and clicks ship. Best-effort like the two order emails: if
// this fails, the order is still paid and still in /admin → Orders, it
// just isn't in Shiprocket yet and can be added there by hand.
//
// Auth: POST .../auth/login with a dedicated Shiprocket API user's
// email/password (never the main account login — see the README) returns a
// bearer token good for ~10 days; cached here and refreshed a little early.
//
// Order shape: Shiprocket's "Create Custom Order" (adhoc) endpoint wants
// billing/shipping fields split out and one parcel length/breadth/height/
// weight for the WHOLE order (not per line item) — see DEFAULT_PARCEL_CM
// below for why that's an approximation, not a real box measurement.

const AUTH_URL = "https://apiv2.shiprocket.in/v1/external/auth/login";
const ORDER_URL = "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc";
// The token itself is valid ~10 days; refresh a day early rather than
// racing a request against the exact expiry moment.
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;

// One default parcel size for every order. Real per-product dimensions
// aren't worth collecting for this: Shiprocket's own order-create API takes
// a single package size for the whole shipment (not one per line item)
// regardless of how many products are in the cart, and this is "push to
// panel only" — whoever picks the courier in Shiprocket reviews/can adjust
// this before anything ships. Update this if the shop settles on a
// different standard box.
const DEFAULT_PARCEL_CM = { length: 20, breadth: 15, height: 15 };
// Used only when a product's weight_g is missing/zero, so a catalog gap
// never makes the whole order weight zero (Shiprocket requires > 0).
const FALLBACK_ITEM_WEIGHT_G = 150;

function lastTenDigits(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

// Shiprocket wants first/last name as separate fields; checkout only
// collects one full name, so the last word becomes the surname.
function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || "Customer", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

// Same "id|colorId|qty|price" note format order emails already decode (see
// orderEmail.js's describeItems) — kept independent rather than shared,
// since this needs the raw numbers (for order_items/weight), not text.
function parseItemsNote(itemsNote, products) {
  return String(itemsNote || "")
    .split(";")
    .filter(Boolean)
    .map((entry) => {
      const [id, , qty, price] = entry.split("|");
      const product = products.find((p) => p.id === id);
      const units = Number(qty) || 1;
      return {
        name: product?.name || id,
        sku: id,
        units,
        selling_price: Number(price) || 0,
        weightG: (product?.weightG > 0 ? product.weightG : FALLBACK_ITEM_WEIGHT_G) * units,
      };
    });
}

function formatOrderDate(unixSeconds) {
  const d = unixSeconds ? new Date(unixSeconds * 1000) : new Date();
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function createShiprocketClient({ email, password, pickupLocation, now = Date.now, fetchImpl = fetch } = {}) {
  if (!email || !password || !pickupLocation) return null;
  let token = null;
  let tokenAt = 0;

  async function getToken() {
    if (token && now() - tokenAt < TOKEN_TTL_MS) return token;
    const res = await fetchImpl(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.token) {
      throw new Error(`Shiprocket login failed: ${body.message || res.status}`);
    }
    token = body.token;
    tokenAt = now();
    return token;
  }

  // `order` is a raw Razorpay order object (order.notes.*, order.amount,
  // order.created_at) — the same shape buildOrderEmail/buildCustomerEmail
  // take, so this can be called from the same place with no extra fetch.
  async function pushOrder(order, { products = [] } = {}) {
    const n = order.notes && typeof order.notes === "object" && !Array.isArray(order.notes) ? order.notes : {};
    const items = parseItemsNote(n.items, products);
    if (items.length === 0) throw new Error("No line items to push to Shiprocket.");
    const { first, last } = splitName(n.ship_name);
    const totalWeightKg = Math.max(0.1, items.reduce((sum, it) => sum + it.weightG, 0) / 1000);
    const address = String(n.ship_address || "");

    const body = {
      order_id: order.id,
      order_date: formatOrderDate(order.created_at),
      pickup_location: pickupLocation,
      billing_customer_name: first,
      billing_last_name: last,
      billing_address: address.slice(0, 200),
      billing_city: n.ship_city || "",
      billing_pincode: n.ship_pincode || "",
      billing_state: n.ship_state || "",
      billing_country: "India",
      billing_email: n.ship_email || "",
      billing_phone: lastTenDigits(n.ship_phone),
      shipping_is_billing: true,
      order_items: items.map(({ name, sku, units, selling_price }) => ({ name, sku, units, selling_price })),
      payment_method: "Prepaid",
      sub_total: Math.round(Number(order.amount) / 100),
      length: DEFAULT_PARCEL_CM.length,
      breadth: DEFAULT_PARCEL_CM.breadth,
      height: DEFAULT_PARCEL_CM.height,
      weight: Math.round(totalWeightKg * 100) / 100,
    };

    const token = await getToken();
    const res = await fetchImpl(ORDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.order_id) {
      throw new Error(`Shiprocket order create failed: ${result.message || JSON.stringify(result.errors) || res.status}`);
    }
    return { shiprocketOrderId: String(result.order_id) };
  }

  return { pushOrder };
}
