import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Razorpay from "razorpay";
import nodemailer from "nodemailer";
import { validateShipping } from "../src/lib/address.js";
import { buildCustomerEmail, buildOrderEmail, encodeItemsNote } from "./orderEmail.js";
import { priceCart } from "./pricing.js";
import { DISCOUNTS, lookupDiscount, checkEligibility, listOffers, looksLikeMultipleCodes, ONE_CODE_PER_ORDER } from "./discounts.js";
import { createLedger, customerKeys } from "./orderLedger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "..", "dist");
const PRODUCTS_DIR = path.join(__dirname, "..", "public", "products");
const IMAGE_EXT = /\.(png|jpe?g|webp|avif)$/i;

// Named SERVER_PORT (not PORT) so it doesn't collide with a PORT env var the
// dev launcher may already set for the frontend's own port.
const PORT = process.env.SERVER_PORT || 8787;
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

if (!KEY_ID || !KEY_SECRET) {
  console.warn(
    "[server] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set in .env — " +
      "/api/create-order will return an error until you add your test keys."
  );
}

const razorpay = KEY_ID && KEY_SECRET ? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET }) : null;

// Token for GET /api/admin/discounts (the discount usage report). Unset means
// that endpoint doesn't exist at all.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Who has ordered and which discounts they've used — rebuilt from Razorpay's
// own order list, so it survives this host's wiped-on-restart disk. See
// orderLedger.js. (Single server instance assumed, as before.)
const ledger = createLedger({
  fetchOrdersPage: ({ skip, count }) => {
    if (!razorpay) throw new Error("Razorpay is not configured");
    return razorpay.orders.all({ skip, count });
  },
});

// Contact form mail. CONTACT_EMAIL_USER authenticates and sends; the
// message lands in CONTACT_TO_EMAIL (defaults to that same address, so a
// single Gmail account both sends and receives). Gmail requires an App
// Password here, not the account's normal login password.
const CONTACT_EMAIL_USER = process.env.CONTACT_EMAIL_USER;
const CONTACT_EMAIL_PASS = process.env.CONTACT_EMAIL_PASS;
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || CONTACT_EMAIL_USER;

if (!CONTACT_EMAIL_USER || !CONTACT_EMAIL_PASS) {
  console.warn(
    "[server] CONTACT_EMAIL_USER / CONTACT_EMAIL_PASS are not set in .env " +
      "so /api/contact will return an error until they're added."
  );
}

const mailer =
  CONTACT_EMAIL_USER && CONTACT_EMAIL_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: CONTACT_EMAIL_USER, pass: CONTACT_EMAIL_PASS },
      })
    : null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Per-IP submission log, purely to stop the contact form being used to
// blast the inbox. In-memory, so it resets on restart;
// fine for the volume a small storefront actually gets.
const contactSubmissions = new Map();
const CONTACT_WINDOW_MS = 60 * 60 * 1000;
const CONTACT_MAX_PER_WINDOW = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (contactSubmissions.get(ip) || []).filter((t) => now - t < CONTACT_WINDOW_MS);
  contactSubmissions.set(ip, recent);
  return recent.length >= CONTACT_MAX_PER_WINDOW;
}

function recordSubmission(ip) {
  const recent = contactSubmissions.get(ip) || [];
  recent.push(Date.now());
  contactSubmissions.set(ip, recent);
}

// After a paid order, sends two emails: a summary to the shop
// (CONTACT_TO_EMAIL: customer, items, delivery address) and a confirmation to
// the customer (what they bought, where it's going, what happens next).
// Called from both /api/verify-payment (the customer's browser confirming) and
// the Razorpay webhook (Razorpay confirming directly, which still fires if the
// customer closes the tab right after paying) — whichever arrives first sends
// them, the other is skipped. The details come from Razorpay's own copy of the
// order rather than the in-memory ledger, so a server restart between checkout
// and payment doesn't lose them.
//
// The two emails are claimed and retried independently: one failing (Gmail
// hiccup, a customer address that bounces) never stops the other, and a retry
// from the second confirmation path only resends the one that hasn't gone.
const notifiedOrders = new Set(); // shop email sent
const confirmedOrders = new Set(); // customer email sent
const SHOP_PHONE = process.env.SHOP_PHONE || "+91 8660 828944";

async function notifyOrderPaid(orderId, paymentId) {
  if (!razorpay) return;
  const sendShop = !notifiedOrders.has(orderId);
  const sendCustomer = !confirmedOrders.has(orderId);
  if (!sendShop && !sendCustomer) return;
  // Claimed before the first await so verify + webhook arriving together
  // can't both send. Released again on failure so the other path can retry.
  if (sendShop) notifiedOrders.add(orderId);
  if (sendCustomer) confirmedOrders.add(orderId);
  const release = () => {
    if (sendShop) notifiedOrders.delete(orderId);
    if (sendCustomer) confirmedOrders.delete(orderId);
  };

  let order;
  let shopEmail;
  try {
    order = await razorpay.orders.fetch(orderId);
    // Make sure the ledger knows this order is paid even if the server
    // restarted between checkout and payment (it was rebuilt from Razorpay's
    // list, or not at all yet) — a paid discounted order must count against
    // the customer's limit.
    ledger.upsertFromRazorpay(order, { forcePaid: true, paymentId });
    const duplicateDiscount = ledger.isDuplicateRedemption(orderId);
    if (duplicateDiscount) {
      console.warn(`[server] DUPLICATE DISCOUNT on ${orderId}: this customer had already used the code on an earlier paid order.`);
    }
    shopEmail = buildOrderEmail(order, paymentId, { duplicateDiscount });
  } catch (err) {
    release();
    console.error(`[server] could not load paid order ${orderId} to send its emails:`, err);
    return;
  }

  if (sendShop) {
    try {
      // Always in the server log too — the one place an order is recorded even
      // if email isn't configured or delivery fails.
      console.log(`[server] PAID ORDER ${orderId}\n${shopEmail.text}`);
      if (!mailer) {
        console.warn("[server] order notification email skipped: CONTACT_EMAIL_USER / CONTACT_EMAIL_PASS are not set.");
      } else {
        await mailer.sendMail({
          from: `"YZ Labs orders" <${CONTACT_EMAIL_USER}>`,
          to: CONTACT_TO_EMAIL,
          replyTo: shopEmail.replyTo,
          subject: shopEmail.subject,
          text: shopEmail.text,
        });
      }
    } catch (err) {
      notifiedOrders.delete(orderId);
      console.error(`[server] could not send the order notification for ${orderId}:`, err);
    }
  }

  if (sendCustomer) {
    try {
      const confirmation = buildCustomerEmail(order, paymentId, { email: CONTACT_TO_EMAIL, phone: SHOP_PHONE });
      if (!confirmation) {
        console.warn(`[server] no customer email on ${orderId}; confirmation not sent.`);
      } else if (!mailer) {
        console.warn("[server] customer confirmation skipped: CONTACT_EMAIL_USER / CONTACT_EMAIL_PASS are not set.");
      } else {
        await mailer.sendMail({
          from: `"YZ Labs" <${CONTACT_EMAIL_USER}>`,
          to: confirmation.to,
          replyTo: confirmation.replyTo,
          subject: confirmation.subject,
          text: confirmation.text,
        });
      }
    } catch (err) {
      confirmedOrders.delete(orderId);
      console.error(`[server] could not send the customer confirmation for ${orderId}:`, err);
    }
  }
}

const app = express();
// On Render every request arrives through their proxy, so without this
// `req.ip` is the proxy's address for EVERYONE — the per-IP limits (contact
// form, discount-code checks) would then be one shared bucket for the whole
// site. Trust exactly one hop there; not locally, where the header could be
// forged by anyone.
if (process.env.RENDER) app.set("trust proxy", 1);
app.use(cors());

// Webhook route needs the raw request body to verify Razorpay's signature,
// so it's registered BEFORE the global express.json() parser below.
app.post("/api/webhook", express.raw({ type: "*/*" }), (req, res) => {
  if (!WEBHOOK_SECRET) {
    return res.status(500).send("Webhook secret not configured.");
  }
  const signature = req.headers["x-razorpay-signature"];
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(req.body).digest("hex");

  if (signature !== expected) {
    return res.status(400).send("Invalid webhook signature.");
  }

  const event = JSON.parse(req.body.toString("utf8"));
  console.log("[server] webhook event:", event.event);

  const orderId = event.payload?.payment?.entity?.order_id;
  if (orderId && event.event === "payment.captured") {
    ledger.markPaid(orderId, event.payload.payment.entity.id);
    notifyOrderPaid(orderId, event.payload.payment.entity.id);
  }

  res.json({ received: true });
});

app.use(express.json());

// Tiny in-memory per-IP limiter: returns a function that records a hit for an
// IP and says whether it has now gone over `max` within `windowMs`.
function makeLimiter(windowMs, max) {
  const hits = new Map();
  return (ip) => {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > max;
  };
}
// Checking a typed code is capped tightly so it can't be used to guess codes
// by brute force. Listing the offers takes no code (it only ever returns
// codes the shop chose to advertise), so it gets a far looser cap — the cart
// asks for it every time it opens or changes.
const codeCheckLimited = makeLimiter(10 * 60 * 1000, 40);
const offersLimited = makeLimiter(10 * 60 * 1000, 120);
const clientIp = (req) => req.ip || req.socket?.remoteAddress || "unknown";

// Is this code good for this cart? Deliberately knows nothing about WHO is
// asking: whether the customer has already used it (or has ordered before)
// can only be decided once they've entered their details, so that check
// happens in /api/create-order — this is just the "does it exist and what
// would it take off" preview the cart shows.
app.post("/api/discount/preview", (req, res) => {
  if (codeCheckLimited(clientIp(req))) {
    return res.status(429).json({ ok: false, error: "Too many attempts. Please try again in a few minutes." });
  }
  if (looksLikeMultipleCodes(req.body?.code)) return res.status(400).json({ ok: false, error: ONE_CODE_PER_ORDER });
  const priced = priceCart(req.body?.items);
  if (!priced.ok) return res.status(priced.status).json({ ok: false, error: priced.error });

  const found = lookupDiscount(req.body?.code, priced.subtotalPaise);
  if (!found.ok) return res.status(400).json({ ok: false, error: found.error });

  res.json({
    ok: true,
    code: found.code,
    description: found.def.description || "",
    subtotalPaise: priced.subtotalPaise,
    discountPaise: found.discountPaise,
    totalPaise: priced.subtotalPaise - found.discountPaise,
  });
});

// The offers the cart advertises under "Check available offers": only codes
// marked `listed` in discounts.js, each with what it would save on THIS cart
// (or, if the cart is under its minimum, how much more to add). Unlisted
// codes are never returned — they only work if typed.
app.post("/api/discount/offers", (req, res) => {
  if (offersLimited(clientIp(req))) {
    return res.status(429).json({ ok: false, error: "Too many requests. Please try again in a few minutes." });
  }
  const priced = priceCart(req.body?.items);
  if (!priced.ok) return res.status(priced.status).json({ ok: false, error: priced.error });
  res.json({ ok: true, offers: listOffers(priced.subtotalPaise) });
});

app.post("/api/create-order", async (req, res) => {
  if (!razorpay) {
    return res.status(500).json({ error: "Razorpay is not configured on the server yet — add keys to .env." });
  }

  const priced = priceCart(req.body?.items);
  if (!priced.ok) return res.status(priced.status).json({ error: priced.error });
  const { lineItems, subtotalPaise } = priced;

  // Delivery details are required before an order exists at all — the
  // checkout form validates them too, but this is the check that counts.
  const shippingResult = validateShipping(req.body?.shipping);
  if (!shippingResult.ok) {
    const firstError = Object.values(shippingResult.errors)[0];
    return res.status(400).json({ error: `Delivery details: ${firstError}`, fields: shippingResult.errors });
  }
  const shipping = shippingResult.value;
  const address = [shipping.line1, shipping.line2].filter(Boolean).join(", ");
  // Recorded on EVERY order (not just discounted ones): "first order only"
  // codes need to know whether this customer has ever paid before.
  const keys = customerKeys({ email: shipping.email, phone: shipping.phone, address, pincode: shipping.pincode });

  // At most one code per order — the checkout only takes a single code, and
  // this only ever looks at that one.
  let discount = null;
  const codeInput = req.body?.discountCode;
  if (looksLikeMultipleCodes(codeInput)) {
    return res.status(400).json({ error: ONE_CODE_PER_ORDER, discountRejected: true });
  }
  if (codeInput !== undefined && codeInput !== null && codeInput !== "") {
    const found = lookupDiscount(codeInput, subtotalPaise);
    if (!found.ok) return res.status(400).json({ error: found.error, discountRejected: true });

    // Decided against Razorpay's own record of past orders (see
    // orderLedger.js). If that can't be read at all, don't hand out a
    // once-per-customer discount on no information — ask them to retry.
    try {
      await ledger.ensureFresh();
    } catch (err) {
      console.error("[server] couldn't load order history to check a discount:", err);
      return res.status(503).json({ error: "We couldn't verify that discount just now. Please try again in a moment." });
    }
    const eligible = checkEligibility(found, keys, ledger);
    if (!eligible.ok) return res.status(400).json({ error: eligible.error, discountRejected: true });
    discount = found;
  }

  const discountPaise = discount ? discount.discountPaise : 0;
  const totalPaise = subtotalPaise - discountPaise;
  // Razorpay's actual minimum order amount is ₹1 (100 paise), not just
  // "more than zero" — enforce the real rule, not a looser stand-in for it.
  if (totalPaise < 100) {
    return res.status(400).json({ error: "Order total must be at least ₹1." });
  }

  try {
    const order = await razorpay.orders.create({
      amount: totalPaise, // Razorpay wants the amount in paise
      currency: "INR",
      receipt: `yzlabs_${Date.now()}`,
      // Razorpay notes are the durable record of who bought what, where it
      // ships, and which discount was used — this server's own memory of
      // orders is rebuilt FROM these (orderLedger.js), and the Razorpay
      // dashboard shows them alongside each payment. Each value stays under
      // Razorpay's 256-character-per-note limit (line1 + line2 are capped at
      // 120 apiece by the validator).
      notes: {
        items: encodeItemsNote(lineItems),
        ship_name: shipping.name,
        ship_phone: `+91${shipping.phone}`,
        ship_email: shipping.email,
        ship_address: address,
        ship_city: shipping.city,
        ship_state: shipping.state,
        ship_pincode: shipping.pincode,
        ...(discount
          ? {
              discount_code: discount.code,
              discount_paise: String(discountPaise),
              subtotal_paise: String(subtotalPaise),
            }
          : {}),
      },
    });

    ledger.record({
      id: order.id,
      status: "created",
      code: discount ? discount.code : null,
      discountPaise,
      subtotalPaise,
      totalPaise,
      keys,
      email: shipping.email,
      createdAt: Date.now(),
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: KEY_ID,
      subtotalPaise,
      discount: discount ? { code: discount.code, paise: discountPaise } : null,
    });
  } catch (err) {
    console.error("[server] create-order failed:", err);
    // Razorpay's SDK sets `statusCode` on the error — a 401 means the API
    // keys are missing/wrong/rotated, which the operator needs to see as
    // distinct from a generic upstream failure.
    if (err?.statusCode === 401) {
      return res.status(401).json({ error: "Razorpay rejected the API credentials." });
    }
    res.status(500).json({ error: "Could not create Razorpay order." });
  }
});

app.post("/api/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ ok: false, error: "Missing verification fields." });
  }
  if (!KEY_SECRET) {
    return res.status(500).json({ ok: false, error: "Server not configured." });
  }

  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    // Signature mismatch — the payload wasn't signed with our key secret.
    // Never mark the order paid; answer 400 so the client treats it as a
    // hard failure, not a "maybe".
    return res.status(400).json({ ok: false, error: "Payment signature verification failed." });
  }

  ledger.markPaid(razorpay_order_id, razorpay_payment_id);

  // Not awaited: the customer's confirmation shouldn't wait on our email.
  notifyOrderPaid(razorpay_order_id, razorpay_payment_id);

  res.json({ ok: true });
});

// Discount usage report: per code, how many paid orders used it, how much it
// took off, and each redemption (order, date, customer email, amounts, and
// whether it beat the once-per-customer rule). Read from the same ledger
// that enforces the rules, refreshed from Razorpay first. Off unless
// ADMIN_TOKEN is set; then needs `Authorization: Bearer <ADMIN_TOKEN>`.
app.get("/api/admin/discounts", async (req, res) => {
  if (!ADMIN_TOKEN) return res.status(404).json({ error: "Not found." });
  const given = Buffer.from(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(ADMIN_TOKEN);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  let warning = null;
  try {
    await ledger.ensureFresh(0);
  } catch (err) {
    warning = `Couldn't refresh from Razorpay (${err?.message || err}); showing only what this server has seen since it started.`;
  }

  const stats = ledger.statsByCode();
  const rupees = (paise) => paise / 100;
  const report = (code, def, s = { paid: [], started: 0 }) => ({
    code,
    description: def?.description || "(not defined any more)",
    active: def ? def.active !== false : false,
    paidRedemptions: s.paid.length,
    totalDiscountGiven: rupees(s.paid.reduce((sum, o) => sum + o.discountPaise, 0)),
    checkoutsStartedNotPaid: s.started,
    redemptions: s.paid
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((o) => ({
        orderId: o.id,
        at: o.createdAt ? new Date(o.createdAt).toISOString() : null,
        customerEmail: o.email,
        subtotal: rupees(o.subtotalPaise),
        discount: rupees(o.discountPaise),
        paid: rupees(o.totalPaise),
        duplicateOfEarlierUse: ledger.isDuplicateRedemption(o.id),
      })),
  });

  const discounts = Object.entries(DISCOUNTS).map(([code, def]) => report(code, def, stats.get(code)));
  // Codes that appear on past orders but are no longer defined (retired).
  for (const [code, s] of stats) if (!Object.hasOwn(DISCOUNTS, code)) discounts.push(report(code, null, s));

  res.json({
    generatedAt: new Date().toISOString(),
    historyLoadedFromRazorpayAt: ledger.hydratedAt() ? new Date(ledger.hydratedAt()).toISOString() : null,
    ...(warning ? { warning } : {}),
    discounts,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    razorpayConfigured: Boolean(razorpay),
    contactFormConfigured: Boolean(mailer),
    discountHistoryLoaded: ledger.isLoaded(),
  });
});

app.post("/api/contact", async (req, res) => {
  if (!mailer) {
    return res.status(500).json({ error: "The contact form isn't configured on the server yet." });
  }

  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many messages sent recently. Please try again later." });
  }

  const { name, email, phone, message } = req.body || {};
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
  const trimmedMessage = typeof message === "string" ? message.trim() : "";

  if (!trimmedName || !trimmedEmail || !trimmedMessage) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }
  if (!EMAIL_RE.test(trimmedEmail)) {
    return res.status(400).json({ error: "That email address doesn't look valid." });
  }
  if (trimmedName.length > 100 || trimmedEmail.length > 200 || trimmedPhone.length > 30 || trimmedMessage.length > 4000) {
    return res.status(400).json({ error: "One of the fields is too long." });
  }

  try {
    await mailer.sendMail({
      from: `"YZ Labs website" <${CONTACT_EMAIL_USER}>`,
      to: CONTACT_TO_EMAIL,
      replyTo: trimmedEmail,
      subject: `New website enquiry from ${trimmedName}`,
      text: [
        `Name: ${trimmedName}`,
        `Email: ${trimmedEmail}`,
        trimmedPhone ? `Phone: ${trimmedPhone}` : null,
        "",
        trimmedMessage,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    recordSubmission(ip);
    res.json({ ok: true });
  } catch (err) {
    console.error("[server] contact form send failed:", err);
    res.status(500).json({ error: "Could not send your message. Please try again or email us directly." });
  }
});

// Product photos live directly on disk under public/products/<folder>/ —
// this reads that folder fresh on every request, so dropping a new image
// in (or deleting one) shows up on the next page load, no code change or
// restart. Response keys are the folder names themselves; the frontend
// matches each product's `imageFolder` (data/products.js) against them —
// folder names don't have to match a product's own id. A file literally
// named `hero.*` is the catalog/hero shot; every other image in the folder
// is the detail-popup gallery, sorted by filename.
app.get("/api/product-images", (_req, res) => {
  try {
    const result = {};
    const entries = fs.readdirSync(PRODUCTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      const dir = path.join(PRODUCTS_DIR, id);
      const files = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((f) => f.isFile() && IMAGE_EXT.test(f.name))
        .map((f) => f.name);

      const heroFile = files.find((f) => /^hero\./i.test(f));
      const gallery = files.filter((f) => f !== heroFile).sort();

      result[id] = {
        heroImage: heroFile ? `/products/${id}/${heroFile}` : gallery[0] ? `/products/${id}/${gallery[0]}` : null,
        images: gallery.map((f) => `/products/${id}/${f}`),
      };
    }
    res.json(result);
  } catch (err) {
    console.error("[server] product-images failed:", err);
    res.status(500).json({ error: "Could not list product images." });
  }
});

// In production (Render, etc.) this same server also serves the built
// frontend — `npm run build` outputs to /dist. In local dev, Vite's own dev
// server handles the frontend instead and proxies /api/* here.
if (process.env.NODE_ENV === "production" || process.env.RENDER) {
  app.use(express.static(DIST_DIR));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  // Load who-has-ordered-what from Razorpay now, so the first discounted
  // checkout doesn't have to wait for it. If it fails, discounted checkouts
  // retry the load themselves (and refuse to guess if it still can't).
  if (razorpay) {
    ledger
      .hydrate()
      .then((n) => console.log(`[server] loaded ${n} past orders from Razorpay for discount history.`))
      .catch((err) => console.error("[server] couldn't load order history from Razorpay yet:", err?.message || err));
  }
});
