// The server's memory of who has ordered and which discounts they've used.
//
// There are no customer accounts, so a "customer" is recognised by what they
// type at checkout: their email, their mobile number, or their delivery
// address. Matching on ANY of the three counts as the same customer, because
// each one alone is trivial to vary (a second email costs nothing) but
// changing all of them is real effort.
//
// Persistence: none of its own, on purpose. This app runs on a host whose disk
// is wiped on every restart/redeploy, so a local file would forget every
// redemption and let a code be reused. Instead Razorpay is the record: every
// order already carries the customer's email/phone/address and any discount
// used in its notes (see /api/create-order), and this ledger simply rebuilds
// itself from Razorpay's order list — at startup, and whenever it's gone stale
// before a discount is decided. Nothing personal is written to disk here.

import { notesOf } from "./razorpayNotes.js";

// "A.B+promo@Gmail.com" and "ab@gmail.com" are one mailbox; Gmail ignores
// dots and anything after a plus. The +tag is stripped everywhere (nearly
// every provider supports it); dot-stripping is Gmail-only, since elsewhere
// dots can genuinely distinguish two addresses.
export function canonicalEmail(email) {
  const [rawLocal, rawDomain] = String(email || "").trim().toLowerCase().split("@");
  if (!rawLocal || !rawDomain) return "";
  let local = rawLocal.split("+")[0];
  let domain = rawDomain;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

// The identifiers a customer is matched on. `address` is line 1 + line 2 as
// entered; only letters/digits are compared, so spacing, case and commas
// can't be used to dodge a match.
export function customerKeys({ email, phone, address, pincode }) {
  const keys = [];
  const e = canonicalEmail(email);
  if (e) keys.push(`e:${e}`);
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  if (digits.length === 10) keys.push(`p:${digits}`);
  const addr = String(address || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const pin = String(pincode || "").replace(/\D/g, "");
  if (addr && pin) keys.push(`a:${pin}:${addr}`);
  return keys;
}

export function keysFromNotes(notes) {
  return customerKeys({
    email: notes.ship_email,
    phone: notes.ship_phone,
    address: notes.ship_address,
    pincode: notes.ship_pincode,
  });
}

function recordFromRazorpay(order, { forcePaid = false, paymentId } = {}) {
  const n = notesOf(order);
  const discountPaise = Number(n.discount_paise) || 0;
  return {
    id: order.id,
    status: forcePaid || order.status === "paid" ? "paid" : "created",
    code: n.discount_code || null,
    discountPaise,
    subtotalPaise: Number(n.subtotal_paise) || Number(order.amount) + discountPaise,
    totalPaise: Number(order.amount),
    keys: keysFromNotes(n),
    email: n.ship_email || null,
    paymentId: paymentId || null,
    createdAt: (Number(order.created_at) || 0) * 1000,
  };
}

const overlaps = (a, b) => a.some((k) => b.includes(k));

// `fetchOrdersPage({ skip, count })` must resolve to Razorpay's order list
// shape ({ items: [...] }). Injected so the ledger can be tested without a
// Razorpay account.
export function createLedger({ fetchOrdersPage, now = Date.now, ttlMs = 60_000, pageSize = 100, maxPages = 50 }) {
  const orders = new Map();
  let hydratedAt = 0;
  let loaded = false; // has ANY load from Razorpay ever succeeded?
  let hydrating = null;

  // Razorpay is authoritative, but never downgrade an order we've already
  // seen paid to unpaid: our own payment confirmation can arrive before
  // Razorpay's list reflects it.
  function merge(rec) {
    const existing = orders.get(rec.id);
    if (existing?.status === "paid" && rec.status !== "paid") return;
    orders.set(rec.id, { ...rec, paymentId: rec.paymentId || existing?.paymentId || null });
  }

  // Rebuilds from Razorpay's full order list. Concurrent callers share one
  // run. Rejects if Razorpay can't be read.
  function hydrate() {
    if (hydrating) return hydrating;
    hydrating = (async () => {
      const seen = [];
      let skip = 0;
      let pages = 0;
      for (; pages < maxPages; pages++) {
        const res = await fetchOrdersPage({ skip, count: pageSize });
        const items = Array.isArray(res?.items) ? res.items : [];
        seen.push(...items);
        if (items.length < pageSize) break;
        skip += pageSize;
      }
      if (pages >= maxPages) {
        console.warn(`[ledger] stopped after ${maxPages * pageSize} orders — older orders aren't considered for discount history.`);
      }
      for (const o of seen) merge(recordFromRazorpay(o));
      hydratedAt = now();
      loaded = true;
      return seen.length;
    })().finally(() => {
      hydrating = null;
    });
    return hydrating;
  }

  // Makes sure the ledger has been loaded from Razorpay recently enough to
  // decide a discount on. If a refresh fails but we have EARLIER data, that
  // stale data is used; if we've never loaded, the error is thrown — the
  // caller must not grant a once-per-customer discount on no information.
  async function ensureFresh(maxAgeMs = ttlMs) {
    if (loaded && now() - hydratedAt <= maxAgeMs) return;
    try {
      await hydrate();
    } catch (err) {
      if (!loaded) throw err;
      console.error("[ledger] refresh failed, using earlier data:", err?.message || err);
    }
  }

  return {
    hydrate,
    ensureFresh,
    hydratedAt: () => hydratedAt,
    isLoaded: () => loaded,

    // A just-created (unpaid) order.
    record(rec) {
      orders.set(rec.id, { paymentId: null, ...rec });
    },

    // Our own payment confirmation. Returns the record, or null if this
    // order isn't known yet (a restart happened since it was created) — the
    // caller then reconciles it from Razorpay with upsertFromRazorpay().
    markPaid(id, paymentId) {
      const rec = orders.get(id);
      if (!rec) return null;
      rec.status = "paid";
      rec.paymentId = paymentId || rec.paymentId;
      return rec;
    },

    upsertFromRazorpay(order, opts) {
      const rec = recordFromRazorpay(order, opts);
      orders.set(rec.id, { ...(orders.get(rec.id) || {}), ...rec, paymentId: rec.paymentId || orders.get(rec.id)?.paymentId || null });
      return orders.get(rec.id);
    },

    get: (id) => orders.get(id) || null,

    // Any paid order at all for this customer?
    hasPaidOrder(keys) {
      for (const o of orders.values()) if (o.status === "paid" && overlaps(o.keys, keys)) return true;
      return false;
    },

    // How many paid orders has this customer already used `code` on?
    paidRedemptionCount(code, keys) {
      let n = 0;
      for (const o of orders.values()) if (o.status === "paid" && o.code === code && overlaps(o.keys, keys)) n++;
      return n;
    },

    // True if this paid order used a code the same customer had ALREADY used
    // on an earlier paid order — i.e. the once-per-customer rule was beaten
    // (two checkouts open at once, both paid). The money is taken either way;
    // this exists so the shop owner is told.
    isDuplicateRedemption(id) {
      const r = orders.get(id);
      if (!r || r.status !== "paid" || !r.code) return false;
      for (const o of orders.values()) {
        if (o.id === r.id || o.status !== "paid" || o.code !== r.code || !overlaps(o.keys, r.keys)) continue;
        if (o.createdAt < r.createdAt || (o.createdAt === r.createdAt && o.id < r.id)) return true;
      }
      return false;
    },

    // For the admin report: everything that used a code, grouped by code.
    statsByCode() {
      const byCode = new Map();
      for (const o of orders.values()) {
        if (!o.code) continue;
        const g = byCode.get(o.code) || { paid: [], started: 0 };
        if (o.status === "paid") g.paid.push(o);
        else g.started++;
        byCode.set(o.code, g);
      }
      return byCode;
    },
  };
}
