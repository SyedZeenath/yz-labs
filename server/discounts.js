// Discount codes. To add one, add an entry to DISCOUNTS below — nothing else
// needs to change. Kept server-side on purpose: the browser only ever asks
// "is this code valid for my cart?" (POST /api/discount/preview), so the list
// of codes is never shipped in the JavaScript bundle where anyone could read
// every private promo.
//
// Fields (all optional except type/value):
//   description        shown to the customer when the code is applied
//   listed             true = shown in the cart's "Check available offers"
//                      list. Off by default: a code that isn't listed still
//                      works if someone types it (handy for private or
//                      influencer codes), it just isn't advertised.
//   type               "percent" (value = 0-100) or "fixed" (value = rupees off)
//   value              the amount, per `type`
//   active             set false to switch a code off without deleting it
//   startsAt/expiresAt ISO date strings bounding when the code works
//   minSubtotal        rupees; the cart must total at least this before discount
//   maxDiscount        rupees; cap on a percent discount
//   firstPurchaseOnly  true = only for customers with no earlier paid order
//   perCustomerLimit   times one customer may use this code (default 1)
//
// A customer can only ever apply ONE code per order (checkout takes a single
// code), and each code is limited per customer as above. "Customer" isn't an
// account — see orderLedger.js for how they're recognised.
export const DISCOUNTS = {
  FIRSTBUY10: {
    description: "10% off your first order",
    listed: true,
    type: "percent",
    value: 10,
    active: true,
    firstPurchaseOnly: true,
  },
};

// Razorpay's real minimum order amount is ₹1, so a discount is never allowed
// to take an order below that.
const MIN_ORDER_PAISE = 100;

// Deliberately the same wording for unknown / switched-off / expired /
// not-started codes, so the endpoint can't be used to tell which codes exist.
const INVALID = "That discount code isn't valid.";
// Same for every eligibility failure (already used, not a first order): it
// must not reveal whether a given email, phone or address has ordered
// before. Exported so server/index.js's database-backed second check (see
// server/db/ordersRepo.js) can use identical wording.
export const NOT_AVAILABLE = "This code has already been used, or isn't available for this order.";

// `reason` lets callers tell a code that's merely not met YET for this cart
// ("minimum" — worth showing as a greyed-out offer) from one that isn't
// available at all ("invalid") without parsing the message.
function fail(error, reason = "invalid") {
  return { ok: false, error, reason };
}

// A checkout carries exactly ONE code. Something shaped like several (an
// array, an object) is refused outright with this message rather than quietly
// being treated as "invalid". (Several codes typed into one string —
// "A B", "A,B" — can't get through either: whitespace is stripped and commas
// fail normalizeCode, so it never matches a real code.)
export const ONE_CODE_PER_ORDER = "Only one discount code can be used per order.";
export function looksLikeMultipleCodes(input) {
  return input !== null && typeof input === "object";
}

// "  firstbuy10 " -> "FIRSTBUY10"; anything that isn't a plausible code -> "".
export function normalizeCode(input) {
  if (typeof input !== "string") return "";
  const code = input.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9_-]{2,40}$/.test(code) ? code : "";
}

// Everything about a code that doesn't depend on WHO is buying: does it
// exist, is it live, does this cart qualify, and how much comes off.
// Returns { ok: true, code, def, discountPaise } or { ok: false, error }.
export function lookupDiscount(input, subtotalPaise, now = new Date()) {
  const code = normalizeCode(input);
  if (!code || !Object.hasOwn(DISCOUNTS, code)) return fail(INVALID);
  const def = DISCOUNTS[code];
  if (def.active === false) return fail(INVALID);
  if (def.startsAt && now < new Date(def.startsAt)) return fail(INVALID);
  if (def.expiresAt && now >= new Date(def.expiresAt)) return fail(INVALID);
  if (def.minSubtotal && subtotalPaise < Math.round(def.minSubtotal * 100)) {
    return fail(`This code needs an order of at least ₹${def.minSubtotal}.`, "minimum");
  }

  let off;
  if (def.type === "percent") {
    off = Math.round((subtotalPaise * def.value) / 100);
    if (def.maxDiscount) off = Math.min(off, Math.round(def.maxDiscount * 100));
  } else if (def.type === "fixed") {
    off = Math.round(def.value * 100);
  } else {
    return fail(INVALID);
  }
  off = Math.min(off, subtotalPaise - MIN_ORDER_PAISE);
  if (!(off > 0)) return fail("This code can't be applied to this order.", "cant_apply");

  return { ok: true, code, def, discountPaise: off };
}

const rupees = (paise) => {
  const v = Math.round(paise) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

// The fine print shown on an offer, generated from the definition so it can
// never disagree with what the server actually enforces.
export function describeTerms(def) {
  const terms = [];
  if (def.firstPurchaseOnly) terms.push("First order only");
  const limit = def.perCustomerLimit ?? 1;
  terms.push(limit === 1 ? "One use per customer" : `Up to ${limit} uses per customer`);
  if (def.minSubtotal) terms.push(`Minimum order ₹${def.minSubtotal}`);
  if (def.type === "percent" && def.maxDiscount) terms.push(`Up to ₹${def.maxDiscount} off`);
  if (def.expiresAt) {
    const when = new Date(def.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    terms.push(`Valid until ${when}`);
  }
  return terms;
}

// The offers to advertise for a cart: every `listed` code that is live, best
// saving first. A code the cart doesn't qualify for YET only because of its
// minimum is kept but marked not applicable, with how much more to add — so
// the customer sees what they could unlock. Codes that are off, expired,
// not started, or unlisted never appear. Says nothing about WHO the customer
// is (whether they've already used a code is only known at checkout).
export function listOffers(subtotalPaise, now = new Date()) {
  const offers = [];
  for (const [code, def] of Object.entries(DISCOUNTS)) {
    if (!def.listed) continue;
    const found = lookupDiscount(code, subtotalPaise, now);
    const base = { code, description: def.description || "", terms: describeTerms(def) };
    if (found.ok) {
      offers.push({ ...base, applicable: true, savingsPaise: found.discountPaise });
    } else if (found.reason === "minimum") {
      const shortfall = Math.round(def.minSubtotal * 100) - subtotalPaise;
      offers.push({ ...base, applicable: false, reason: `Add ₹${rupees(shortfall)} more to use this offer.` });
    }
  }
  offers.sort((a, b) => Number(b.applicable) - Number(a.applicable) || (b.savingsPaise || 0) - (a.savingsPaise || 0));
  return offers;
}

// The per-customer half: has THIS customer (identified by `keys`, see
// orderLedger.customerKeys) already used the code, or — for first-purchase
// codes — already bought anything before? Only paid orders count, so an
// abandoned checkout never uses a code up.
export function checkEligibility(found, keys, ledger) {
  const { code, def } = found;
  const limit = def.perCustomerLimit ?? 1;
  if (ledger.paidRedemptionCount(code, keys) >= limit) return fail(NOT_AVAILABLE);
  if (def.firstPurchaseOnly && ledger.hasPaidOrder(keys)) return fail(NOT_AVAILABLE);
  return { ok: true };
}
