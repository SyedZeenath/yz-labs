import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Razorpay from "razorpay";
import { createGmailMailer } from "./gmailApi.js";
import { createShiprocketClient } from "./shiprocket.js";
import helmet from "helmet";
import { validateShipping } from "../src/lib/address.js";
import { buildCustomerEmail, buildOrderEmail, buildShippedEmail, encodeItemsNote, parseItems } from "./orderEmail.js";
import { buildWaitlistConfirmationEmail, buildWaitlistNotificationEmail } from "./waitlistEmail.js";
import { buildContactNotificationEmail } from "./contactEmail.js";
import { priceCart } from "./pricing.js";
import { DISCOUNTS, lookupDiscount, checkEligibility, listOffers, looksLikeMultipleCodes, ONE_CODE_PER_ORDER, NOT_AVAILABLE } from "./discounts.js";
import { createLedger, customerKeys } from "./orderLedger.js";
import { createProductsCache } from "./db/productsCache.js";
import * as productsRepo from "./db/productsRepo.js";
import * as contactsRepo from "./db/contactsRepo.js";
import * as ordersRepo from "./db/ordersRepo.js";
import * as adminUsersRepo from "./db/adminUsersRepo.js";
import { requireAdmin, signAdminCookie, signResetToken, verifyResetToken, ADMIN_COOKIE, timingSafeEqualStrings } from "./adminAuth.js";
import { buildAdminResetEmail } from "./adminResetEmail.js";
import { requireCustomer, signCustomerSession, signMagicLinkToken, verifyMagicLinkToken, CUSTOMER_COOKIE, SESSION_MS } from "./customerAuth.js";
import { buildMagicLinkEmail } from "./customerAuthEmail.js";
import { SITE_URL } from "./emailTemplate.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { COLORWAYS } from "../src/data/colorways.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "..", "dist");
const PRODUCTS_DIR = path.join(__dirname, "..", "public", "products");
const IMAGE_EXT = /\.(png|jpe?g|webp|avif)$/i;

// Named SERVER_PORT (not PORT) so it doesn't collide with a PORT env var the
// dev launcher may already set for the frontend's own port.
const PORT = process.env.SERVER_PORT || 8787;
// Browsers only send an Origin header (and so only trigger a CORS check) on
// cross-origin requests — the site's own frontend, served from this same
// origin, is never affected either way. This allowlist only decides whether
// SOME OTHER website's JavaScript may call this API directly (e.g. a
// look-alike site relaying checkout requests through a visitor's browser).
// PUBLIC_ORIGIN lets a custom domain (or a Render preview URL) be added
// without a code change; the deploy's own default Render URL is always
// allowed so the site keeps working the moment it's live.
const ALLOWED_ORIGINS = [
  "https://yz-labs.onrender.com",
  ...(process.env.PUBLIC_ORIGIN ? [process.env.PUBLIC_ORIGIN] : []),
  // Vite's dev server proxies /api/* to this server itself (same-origin from
  // the browser's point of view), so these only matter for hitting the API
  // directly — curl, a REST client, this repo's own e2e scripts — during
  // local development.
  ...(process.env.RENDER ? [] : ["http://localhost:5173", "http://localhost:8787"]),
];
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

// Signs customer session cookies and sign-in ("magic link") tokens — its
// own secret, deliberately never ADMIN_TOKEN, so a leaked/forged customer
// session can never double as admin access (see server/customerAuth.js).
// Unset means the whole customer-account feature is off (404s), same
// pattern as ADMIN_TOKEN gating /admin.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.warn("[server] SESSION_SECRET is not set in .env, so customer accounts (sign-in, order history) are disabled.");
}

// Who has ordered and which discounts they've used — rebuilt from Razorpay's
// own order list, so it survives this host's wiped-on-restart disk. See
// orderLedger.js. (Single server instance assumed, as before.)
const ledger = createLedger({
  fetchOrdersPage: ({ skip, count }) => {
    if (!razorpay) throw new Error("Razorpay is not configured");
    return razorpay.orders.all({ skip, count });
  },
});

// The live product catalog — see server/db/productsCache.js for why this
// exists (checkout/pricing must not do a database round-trip per request).
// Admin writes (once Phase C's routes exist) call `invalidate()` then
// `ensureFresh(0)` so an edit is reflected immediately, not after the TTL.
const productsCache = createProductsCache({ fetchAllProducts: productsRepo.listActive });

// Mail. CONTACT_EMAIL_USER is the Gmail address everything sends as; the
// shop's own copies (contact enquiries, waitlist/order notifications) land
// in CONTACT_TO_EMAIL (defaults to that same address).
//
// Sent via the Gmail API (server/gmailApi.js), not SMTP — nodemailer's SMTP
// connection to Gmail hung indefinitely on Render (very likely blocked/
// throttled outbound SMTP, a common free-tier restriction), silently losing
// every email. The Gmail API is a plain HTTPS call, so it isn't subject to
// that at all, and mail still genuinely comes from this real Gmail account.
// One-time setup per sending account: scripts/gmailOAuthSetup.mjs (see the
// README's "Email sending" section).
const CONTACT_EMAIL_USER = process.env.CONTACT_EMAIL_USER;
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || CONTACT_EMAIL_USER;
const GMAIL_OAUTH_CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID;
const GMAIL_OAUTH_CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;
const GMAIL_OAUTH_REFRESH_TOKEN = process.env.GMAIL_OAUTH_REFRESH_TOKEN;

if (!CONTACT_EMAIL_USER || !GMAIL_OAUTH_CLIENT_ID || !GMAIL_OAUTH_CLIENT_SECRET || !GMAIL_OAUTH_REFRESH_TOKEN) {
  console.warn(
    "[server] CONTACT_EMAIL_USER / GMAIL_OAUTH_CLIENT_ID / GMAIL_OAUTH_CLIENT_SECRET / GMAIL_OAUTH_REFRESH_TOKEN " +
      "are not all set in .env, so no email will be sent (the contact form, waitlist, and order confirmations " +
      "will still work — see server/index.js's DB-first comments — they just won't email anyone)."
  );
}

const mailer =
  CONTACT_EMAIL_USER && GMAIL_OAUTH_CLIENT_ID && GMAIL_OAUTH_CLIENT_SECRET && GMAIL_OAUTH_REFRESH_TOKEN
    ? createGmailMailer({ clientId: GMAIL_OAUTH_CLIENT_ID, clientSecret: GMAIL_OAUTH_CLIENT_SECRET, refreshToken: GMAIL_OAUTH_REFRESH_TOKEN })
    : null;

// Pushes paid orders into the Shiprocket panel — see server/shiprocket.js
// for why this is "push to panel only" (no courier/pickup automation).
// Optional: without these three set, shiprocketClient is null and the push
// step is silently skipped, same graceful-degradation as the mailer above.
const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;
const SHIPROCKET_PICKUP_LOCATION = process.env.SHIPROCKET_PICKUP_LOCATION;
if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD || !SHIPROCKET_PICKUP_LOCATION) {
  console.warn(
    "[server] SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD / SHIPROCKET_PICKUP_LOCATION are not all set in .env, " +
      "so paid orders won't be pushed to Shiprocket (they still work fully otherwise — see /admin → Orders)."
  );
}
const shiprocketClient = createShiprocketClient({
  email: SHIPROCKET_EMAIL,
  password: SHIPROCKET_PASSWORD,
  pickupLocation: SHIPROCKET_PICKUP_LOCATION,
});

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

// Split into two steps on purpose. The first (mirrorPaidOrder) is fast and
// gets AWAITED directly by /api/verify-payment, before it even responds —
// it's what a discount-eligibility check on this same customer's very next
// order needs to see land immediately, not "eventually" (see the DB comment
// in server/db/ordersRepo.js for the bug this fixes: a second purchase
// moments after the first could still get a first-purchase discount, because
// nothing before this was guaranteed to have finished by the time the next
// request arrived). The second (sendOrderEmails) is the slow part — actual
// mail delivery — kept fire-and-forget exactly as before, since nobody
// should wait on it to know their payment succeeded.
//
// The two emails inside sendOrderEmails are claimed and retried
// independently: one failing (Gmail hiccup, a customer address that
// bounces) never stops the other, and a retry from the second confirmation
// path only resends the one that hasn't gone. Called from both
// /api/verify-payment (the customer's browser confirming) and the Razorpay
// webhook (Razorpay confirming directly, which still fires if the customer
// closes the tab right after paying) — whichever arrives first sends them,
// the other is skipped.
const notifiedOrders = new Set(); // shop email sent
const confirmedOrders = new Set(); // customer email sent
const shiprocketPushedOrders = new Set(); // pushed to Shiprocket panel
const SHOP_PHONE = process.env.SHOP_PHONE || "+91 8660 828944";

// Fetches the order from Razorpay's own record (so a server restart between
// checkout and payment doesn't lose anything), updates the in-memory ledger,
// and mirrors it into the database. Returns { order, duplicateDiscount } or
// null if the order couldn't even be loaded.
async function mirrorPaidOrder(orderId, paymentId) {
  if (!razorpay) return null;
  let order;
  let duplicateDiscount;
  try {
    order = await razorpay.orders.fetch(orderId);
    // Make sure the ledger knows this order is paid even if the server
    // restarted between checkout and payment (it was rebuilt from Razorpay's
    // list, or not at all yet) — a paid discounted order must count against
    // the customer's limit.
    ledger.upsertFromRazorpay(order, { forcePaid: true, paymentId });
    duplicateDiscount = ledger.isDuplicateRedemption(orderId);
    if (duplicateDiscount) {
      console.warn(`[server] DUPLICATE DISCOUNT on ${orderId}: this customer had already used the code on an earlier paid order.`);
    }
  } catch (err) {
    console.error(`[server] could not load paid order ${orderId}:`, err);
    return null;
  }

  // Never consulted for payment correctness — that stays Razorpay's own
  // numbers — but IS now one of two independent checks on discount reuse
  // (see server/db/ordersRepo.js). A failure here is logged but not
  // retried; the ledger-based check above still covers this order even if
  // the database mirror never lands.
  try {
    await ordersRepo.upsertFromRazorpay(order, { paymentId });
  } catch (err) {
    console.error(`[server] couldn't mirror ${orderId} into the database:`, err?.message || err);
  }

  return { order, duplicateDiscount };
}

async function sendOrderEmails(order, paymentId, duplicateDiscount) {
  const orderId = order.id;
  const sendShop = !notifiedOrders.has(orderId);
  const sendCustomer = !confirmedOrders.has(orderId);
  if (!sendShop && !sendCustomer) return;
  // Claimed before the first await so verify + webhook arriving together
  // can't both send. Released again on failure so the other path can retry.
  if (sendShop) notifiedOrders.add(orderId);
  if (sendCustomer) confirmedOrders.add(orderId);

  // Best-effort: a catalog hiccup should never block either email, it
  // should just fall back to showing bare product ids (describeItems'
  // existing fallback) instead of names.
  let products = [];
  try {
    await productsCache.ensureFresh();
    products = productsCache.getAll();
  } catch (err) {
    console.error(`[server] couldn't load the catalog for ${orderId}'s emails, falling back to bare ids:`, err?.message || err);
  }
  const shopEmail = buildOrderEmail(order, paymentId, { duplicateDiscount, products });

  if (sendShop) {
    try {
      // Always in the server log too — the one place an order is recorded even
      // if email isn't configured or delivery fails.
      console.log(`[server] PAID ORDER ${orderId}\n${shopEmail.text}`);
      if (!mailer) {
        console.warn("[server] order notification email skipped: mail is not configured (see the CONTACT_EMAIL_USER/GMAIL_OAUTH_* warning at startup).");
      } else {
        await mailer.sendMail({
          from: `"YZ Labs orders" <${CONTACT_EMAIL_USER}>`,
          to: CONTACT_TO_EMAIL,
          replyTo: shopEmail.replyTo,
          subject: shopEmail.subject,
          text: shopEmail.text,
          html: shopEmail.html,
        });
      }
    } catch (err) {
      notifiedOrders.delete(orderId);
      console.error(`[server] could not send the order notification for ${orderId}:`, err);
    }
  }

  if (sendCustomer) {
    try {
      const confirmation = buildCustomerEmail(order, paymentId, { email: CONTACT_TO_EMAIL, phone: SHOP_PHONE, products });
      if (!confirmation) {
        console.warn(`[server] no customer email on ${orderId}; confirmation not sent.`);
      } else if (!mailer) {
        console.warn("[server] customer confirmation skipped: mail is not configured (see the CONTACT_EMAIL_USER/GMAIL_OAUTH_* warning at startup).");
      } else {
        await mailer.sendMail({
          from: `"YZ Labs" <${CONTACT_EMAIL_USER}>`,
          to: confirmation.to,
          replyTo: confirmation.replyTo,
          subject: confirmation.subject,
          text: confirmation.text,
          html: confirmation.html,
        });
      }
    } catch (err) {
      confirmedOrders.delete(orderId);
      console.error(`[server] could not send the customer confirmation for ${orderId}:`, err);
    }
  }
}

// The "your order has shipped" email — sent from the DB order mirror (see
// server/db/ordersRepo.js), triggered automatically the moment an order's
// fulfillment status first flips to "shipped" (below, in the admin route),
// and available on demand from the admin orders page (POST
// /api/admin/orders/:id/notify-shipped) for resending after a tracking note
// is added or corrected. Throws rather than swallowing its own errors —
// unlike the fire-and-forget order emails, both call sites here want to
// know whether it actually sent (one to log it, one to tell the admin).
async function sendShippedEmail(order, trackingNote) {
  let products = [];
  try {
    await productsCache.ensureFresh();
    products = productsCache.getAll();
  } catch (err) {
    console.error(`[server] couldn't load the catalog for ${order.id}'s shipped email, falling back to bare ids:`, err?.message || err);
  }
  const mail = buildShippedEmail(order, { trackingNote, email: CONTACT_TO_EMAIL, phone: SHOP_PHONE, products });
  if (!mail) throw new Error("This order has no customer email on file.");
  if (!mailer) throw new Error("Mail is not configured (see the CONTACT_EMAIL_USER/GMAIL_OAUTH_* warning at startup).");
  await mailer.sendMail({ from: `"YZ Labs" <${CONTACT_EMAIL_USER}>`, ...mail });
}

// Same claim-before-await/release-on-failure pattern as the two emails
// above (see notifiedOrders/confirmedOrders) — called from both
// /api/verify-payment and the webhook, whichever arrives first pushes it,
// a later retry only pushes if the first attempt never succeeded. A no-op
// if Shiprocket isn't configured (see shiprocketClient above).
async function pushOrderToShiprocket(order) {
  if (!shiprocketClient) return;
  const orderId = order.id;
  if (shiprocketPushedOrders.has(orderId)) return;
  shiprocketPushedOrders.add(orderId);
  try {
    let products = [];
    try {
      await productsCache.ensureFresh();
      products = productsCache.getAll();
    } catch (err) {
      console.error(`[server] couldn't load the catalog for ${orderId}'s Shiprocket push, falling back to bare ids:`, err?.message || err);
    }
    const { shiprocketOrderId } = await shiprocketClient.pushOrder(order, { products });
    console.log(`[server] pushed ${orderId} to Shiprocket as ${shiprocketOrderId}.`);
    await ordersRepo.markShiprocketPushed(orderId, shiprocketOrderId);
  } catch (err) {
    shiprocketPushedOrders.delete(orderId);
    console.error(`[server] could not push ${orderId} to Shiprocket:`, err?.message || err);
  }
}

// Convenience wrapper for callers (the webhook) that don't need to await the
// mirror step separately from the emails — see /api/verify-payment for the
// one caller that does.
async function notifyOrderPaid(orderId, paymentId) {
  const mirrored = await mirrorPaidOrder(orderId, paymentId);
  if (!mirrored) return;
  await sendOrderEmails(mirrored.order, paymentId, mirrored.duplicateDiscount);
  await pushOrderToShiprocket(mirrored.order);
}

const app = express();
// On Render every request arrives through their proxy, so without this
// `req.ip` is the proxy's address for EVERYONE — the per-IP limits (contact
// form, discount-code checks) would then be one shared bucket for the whole
// site. Trust exactly one hop there; not locally, where the header could be
// forged by anyone.
if (process.env.RENDER) app.set("trust proxy", 1);

// Content-Security-Policy is deliberately left off for now rather than
// guessed at: Razorpay's checkout widget spans several of their own
// subdomains (script, iframe, XHR beacons) across UPI/cards/netbanking/
// wallets, and their published guidance is broad allowlists per method —
// getting a directive wrong wouldn't show up here, it would silently break
// one payment method for real customers.
//
// Two of helmet's OTHER defaults turned out to do exactly that anyway, found
// via a real failed card/netbanking payment (UPI worked, those didn't —
// confirmed live, not guessed):
// - crossOriginResourcePolicy defaults to "same-origin", which blocks
//   Razorpay's checkout (running on their own origin) from loading our
//   public assets (the logo passed as `image` in the checkout config) —
//   "NotSameOrigin" in the console. Relaxed for exactly what it's for:
//   public, non-sensitive static assets meant to be embedded elsewhere.
// - crossOriginOpenerPolicy defaults to "same-origin", which severs
//   window.opener for any cross-origin popup — cards/netbanking commonly
//   redirect to the bank via a popup; UPI doesn't need one, which is why
//   only those two broke. "same-origin-allow-popups" keeps the isolation
//   for the page itself while still letting a popup WE open keep talking to
//   the window that opened it.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// Only a request that carries an Origin AND isn't on the allowlist is
// refused — same-origin requests (the site's own frontend, Razorpay's
// server-to-server webhook) never send one, so they're unaffected.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  })
);

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
// One signup per keystroke-mistake retry is normal; the cap only needs to
// stop someone scripting the endpoint to spam the shop inbox.
const waitlistLimited = makeLimiter(60 * 60 * 1000, 8);
// A real shopper might create a handful of orders (cart changes, an
// abandoned checkout retried, switching the discount code) — this only needs
// to catch a script hammering Razorpay's create-order API (and, when a code
// is given, the discount-history refetch) through this endpoint.
const createOrderLimited = makeLimiter(10 * 60 * 1000, 20);
// Verification is called once per real payment attempt; a little slack
// covers a flaky connection retrying it.
const verifyPaymentLimited = makeLimiter(10 * 60 * 1000, 30);
// Login attempts against a single shared secret — tight, since a wrong guess
// here is either a typo or someone trying to brute-force ADMIN_TOKEN.
const adminLoginLimited = makeLimiter(10 * 60 * 1000, 10);
// A real customer might retype their email a couple of times; this only
// needs to stop the sign-in endpoint being scripted to spam someone's inbox.
const customerSigninLimited = makeLimiter(60 * 60 * 1000, 8);
const clientIp = (req) => req.ip || req.socket?.remoteAddress || "unknown";

// Is this code good for this cart? Deliberately knows nothing about WHO is
// asking: whether the customer has already used it (or has ordered before)
// can only be decided once they've entered their details, so that check
// happens in /api/create-order — this is just the "does it exist and what
// would it take off" preview the cart shows.
app.post("/api/discount/preview", async (req, res) => {
  if (codeCheckLimited(clientIp(req))) {
    return res.status(429).json({ ok: false, error: "Too many attempts. Please try again in a few minutes." });
  }
  if (looksLikeMultipleCodes(req.body?.code)) return res.status(400).json({ ok: false, error: ONE_CODE_PER_ORDER });
  let products;
  try {
    await productsCache.ensureFresh();
    products = productsCache.getAll();
  } catch (err) {
    console.error("[server] couldn't load the catalog:", err?.message || err);
    return res.status(503).json({ ok: false, error: "The catalog isn't available right now. Please try again in a moment." });
  }
  const priced = priceCart(req.body?.items, products);
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
app.post("/api/discount/offers", async (req, res) => {
  if (offersLimited(clientIp(req))) {
    return res.status(429).json({ ok: false, error: "Too many requests. Please try again in a few minutes." });
  }
  let products;
  try {
    await productsCache.ensureFresh();
    products = productsCache.getAll();
  } catch (err) {
    console.error("[server] couldn't load the catalog:", err?.message || err);
    return res.status(503).json({ ok: false, error: "The catalog isn't available right now. Please try again in a moment." });
  }
  const priced = priceCart(req.body?.items, products);
  if (!priced.ok) return res.status(priced.status).json({ ok: false, error: priced.error });
  res.json({ ok: true, offers: listOffers(priced.subtotalPaise) });
});

app.post("/api/create-order", async (req, res) => {
  if (createOrderLimited(clientIp(req))) {
    return res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
  }
  if (!razorpay) {
    return res.status(500).json({ error: "Razorpay is not configured on the server yet — add keys to .env." });
  }

  let products;
  try {
    await productsCache.ensureFresh();
    products = productsCache.getAll();
  } catch (err) {
    console.error("[server] couldn't load the catalog:", err?.message || err);
    return res.status(503).json({ error: "The catalog isn't available right now. Please try again in a moment." });
  }
  const priced = priceCart(req.body?.items, products);
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

    // Second, independent check — against the database mirror of paid
    // orders (server/db/ordersRepo.js), written synchronously as part of
    // payment verification itself (see mirrorPaidOrder). The ledger check
    // above rebuilds from Razorpay's own order list, which can briefly lag
    // a payment that was JUST captured, and is kept only in memory — empty
    // again after any restart/redeploy until it rehydrates. This is what
    // actually fixed a real bug: a second purchase moments after the first,
    // same customer, still got a first-purchase-only discount, because nothing
    // before this guaranteed the first order was visible yet. Checked in
    // ADDITION to the ledger, not instead of it — the ledger alone still
    // covers orders placed before this database existed.
    try {
      const limit = found.def.perCustomerLimit ?? 1;
      const [dbCount, dbHasPaid] = await Promise.all([
        ordersRepo.paidRedemptionCount(found.code, keys),
        found.def.firstPurchaseOnly ? ordersRepo.hasPaidOrderForCustomer(keys) : Promise.resolve(false),
      ]);
      if (dbCount >= limit || dbHasPaid) {
        return res.status(400).json({ error: NOT_AVAILABLE, discountRejected: true });
      }
    } catch (err) {
      console.error("[server] couldn't check discount history in the database:", err?.message || err);
      return res.status(503).json({ error: "We couldn't verify that discount just now. Please try again in a moment." });
    }

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

app.post("/api/verify-payment", async (req, res) => {
  if (verifyPaymentLimited(clientIp(req))) {
    return res.status(429).json({ ok: false, error: "Too many attempts. Please try again in a few minutes." });
  }
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

  // Awaited — unlike the emails below — specifically so the database mirror
  // (server/db/ordersRepo.js) is guaranteed to have landed by the time this
  // response reaches the customer's browser. A discount-eligibility check on
  // this same customer's very next order, moments later, reads that table;
  // it must never be able to arrive before this order shows up in it.
  const mirrored = await mirrorPaidOrder(razorpay_order_id, razorpay_payment_id);

  res.json({ ok: true });

  // Not awaited: the customer shouldn't wait on actual mail delivery to know
  // their payment succeeded.
  if (mirrored) {
    sendOrderEmails(mirrored.order, razorpay_payment_id, mirrored.duplicateDiscount).catch((err) => console.error(`[server] could not send emails for ${razorpay_order_id}:`, err));
    pushOrderToShiprocket(mirrored.order).catch((err) => console.error(`[server] could not push ${razorpay_order_id} to Shiprocket:`, err));
  }
});

// Discount usage report: per code, how many paid orders used it, how much it
// took off, and each redemption (order, date, customer email, amounts, and
// whether it beat the once-per-customer rule). Read from the same ledger
// that enforces the rules, refreshed from Razorpay first. Off unless
// ADMIN_TOKEN is set; then needs `Authorization: Bearer <ADMIN_TOKEN>`.
app.get("/api/admin/discounts", requireAdmin(ADMIN_TOKEN), async (req, res) => {
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

// ---------------------------------------------------------------- admin auth
//
// Named admin accounts (server/db/adminUsersRepo.js), not one shared secret
// typed into a login box. ADMIN_TOKEN still exists, but its only job now is
// proving someone is allowed to CLAIM one of the pre-approved emails and set
// its first password — a one-time bootstrap, not something typed in on every
// login. `requireAdmin` still accepts the original Bearer header too, so
// nothing that already used it (curl against /api/admin/discounts) breaks.
const MIN_PASSWORD_LENGTH = 8;

function setAdminCookie(res, email) {
  res.cookie(ADMIN_COOKIE, signAdminCookie(ADMIN_TOKEN, email), {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(process.env.RENDER),
    maxAge: 12 * 60 * 60 * 1000,
  });
}

app.post("/api/admin/login", async (req, res) => {
  if (!ADMIN_TOKEN) return res.status(404).json({ error: "Not found." });
  if (adminLoginLimited(clientIp(req))) {
    return res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ error: "Enter your email and password." });

  try {
    const user = await adminUsersRepo.getByEmail(email);
    // Same message either way — this endpoint must not reveal whether a
    // given email is an admin at all.
    if (!user) return res.status(401).json({ error: "Invalid email or password." });
    if (user.needsSetup) {
      return res.status(409).json({ error: "This account hasn't been set up yet.", needsSetup: true });
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    setAdminCookie(res, user.email);
    adminUsersRepo.touchLogin(user.email).catch((err) => console.error("[server] couldn't record admin login time:", err?.message || err));
    res.json({ ok: true });
  } catch (err) {
    console.error("[server] admin login failed:", err);
    res.status(500).json({ error: "Could not log in right now. Please try again." });
  }
});

// The one-time bootstrap: proves you're allowed to claim a pre-approved
// admin email by also providing ADMIN_TOKEN, then sets that account's first
// password. Can never touch an account that already has a password — that
// would let anyone who later learns ADMIN_TOKEN hijack an existing admin,
// rather than only ever claiming an account nobody has set up yet.
app.post("/api/admin/setup-password", async (req, res) => {
  if (!ADMIN_TOKEN) return res.status(404).json({ error: "Not found." });
  if (adminLoginLimited(clientIp(req))) {
    return res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!email || !password || !token) return res.status(400).json({ error: "Fill in every field." });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }
  if (!timingSafeEqualStrings(token, ADMIN_TOKEN)) {
    return res.status(401).json({ error: "That admin key isn't right." });
  }

  try {
    const user = await adminUsersRepo.getByEmail(email);
    if (!user) return res.status(404).json({ error: "That email isn't on the admin list." });
    if (!user.needsSetup) {
      return res.status(409).json({ error: "This account is already set up — log in normally instead." });
    }
    const passwordHash = await hashPassword(password);
    const updated = await adminUsersRepo.setInitialPassword(email, passwordHash);
    if (!updated) {
      // Someone else claimed it a moment ago (setInitialPassword only
      // succeeds while password_hash is still NULL).
      return res.status(409).json({ error: "This account is already set up — log in normally instead." });
    }
    setAdminCookie(res, updated.email);
    adminUsersRepo.touchLogin(updated.email).catch((err) => console.error("[server] couldn't record admin login time:", err?.message || err));
    res.json({ ok: true });
  } catch (err) {
    console.error("[server] admin setup-password failed:", err);
    res.status(500).json({ error: "Could not set up that account right now. Please try again." });
  }
});

// For an admin who's forgotten their password (distinct from the one-time
// ADMIN_TOKEN-based setup above, which only ever claims an account that has
// no password yet). Always answers the same way whether or not the email
// is actually an admin — this endpoint must never reveal who's on the
// list — and the real work (looking the account up, emailing a reset link)
// happens after responding.
app.post("/api/admin/request-reset", async (req, res) => {
  if (!ADMIN_TOKEN) return res.status(404).json({ error: "Not found." });
  if (adminLoginLimited(clientIp(req))) {
    return res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  res.json({ ok: true });
  if (!email || !mailer) return;
  try {
    const user = await adminUsersRepo.getByEmail(email);
    // No account, or one that's never been set up (nothing to reset) — a
    // silent no-op either way, same as the generic response above.
    if (!user || user.needsSetup) return;
    const token = signResetToken(ADMIN_TOKEN, user.email);
    const resetUrl = `${SITE_URL}/admin?reset=${encodeURIComponent(token)}`;
    const mail = buildAdminResetEmail(user.email, resetUrl);
    await mailer.sendMail({ from: `"YZ Labs admin" <${CONTACT_EMAIL_USER}>`, ...mail });
  } catch (err) {
    console.error("[server] admin reset-request failed:", err?.message || err);
  }
});

// The reset link's token IS the proof of identity here (see
// server/adminAuth.js's signResetToken/verifyResetToken) — unlike
// setup-password above, no separate ADMIN_TOKEN field, and this CAN
// overwrite an existing password (adminUsersRepo.setPassword).
app.post("/api/admin/reset-password", async (req, res) => {
  if (!ADMIN_TOKEN) return res.status(404).json({ error: "Not found." });
  if (adminLoginLimited(clientIp(req))) {
    return res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
  }
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!token || !password) return res.status(400).json({ error: "Fill in every field." });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }
  const email = verifyResetToken(token, ADMIN_TOKEN);
  if (!email) return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });

  try {
    const passwordHash = await hashPassword(password);
    const updated = await adminUsersRepo.setPassword(email, passwordHash);
    if (!updated) return res.status(404).json({ error: "That account no longer exists." });
    setAdminCookie(res, updated.email);
    adminUsersRepo.touchLogin(updated.email).catch((err) => console.error("[server] couldn't record admin login time:", err?.message || err));
    res.json({ ok: true });
  } catch (err) {
    console.error("[server] admin reset-password failed:", err);
    res.status(500).json({ error: "Could not reset that password right now. Please try again." });
  }
});

app.post("/api/admin/logout", (_req, res) => {
  res.clearCookie(ADMIN_COOKIE);
  res.json({ ok: true });
});

// The cookie is httpOnly (unreadable from JS) on purpose, so this is the
// client's only way to know whether it's logged in.
app.get("/api/admin/session", requireAdmin(ADMIN_TOKEN), (_req, res) => {
  res.json({ ok: true });
});

// -------------------------------------------------------- admin: products
//
// Every mutation invalidates the products cache and forces an immediate
// reload (ensureFresh(0)) — the admin's own next read, and the very next
// checkout, sees the edit right away rather than waiting out the cache's TTL.
async function refreshProductsCacheNow() {
  productsCache.invalidate();
  await productsCache.ensureFresh(0);
}

// { id, priceDelta } for each color, where id must be one of the fixed,
// non-editable palette keys — admin edits which colors a product offers,
// never invents a new one (see src/data/colorways.js).
function validateProductBody(body) {
  const errors = {};
  if (!body || typeof body !== "object") return { ok: false, errors: { _: "Invalid request body." } };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const imageFolder = typeof body.imageFolder === "string" ? body.imageFolder.trim() : "";
  if (!name) errors.name = "Name is required.";
  if (!category) errors.category = "Category is required.";
  if (!imageFolder) errors.imageFolder = "Image folder is required (must match a folder under public/products/).";
  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) errors.price = "Price must be a positive number.";
  const colorsIn = Array.isArray(body.colors) ? body.colors : [];
  if (colorsIn.length === 0) errors.colors = "Pick at least one color.";
  const colors = [];
  for (const c of colorsIn) {
    if (!c || !Object.hasOwn(COLORWAYS, c.id)) {
      errors.colors = `"${c?.id}" isn't a known color.`;
      break;
    }
    const priceDelta = Number(c.priceDelta) || 0;
    colors.push({ id: c.id, priceDelta });
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      category,
      imageFolder,
      price,
      colors,
      tagline: typeof body.tagline === "string" ? body.tagline.trim() : "",
      material: typeof body.material === "string" ? body.material.trim() : "",
      dims: typeof body.dims === "string" ? body.dims.trim() : "",
      weight: typeof body.weight === "string" ? body.weight.trim() : "",
      // Structured grams, for the Shiprocket push (server/shiprocket.js) —
      // separate from the free-text `weight` display string above.
      weightG: Number.isFinite(Number(body.weightG)) && Number(body.weightG) >= 0 ? Math.round(Number(body.weightG)) : 0,
      status: typeof body.status === "string" && body.status.trim() ? body.status.trim() : "In stock",
      batch: typeof body.batch === "string" ? body.batch.trim() : "",
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    },
  };
}

app.get("/api/admin/products", requireAdmin(ADMIN_TOKEN), async (_req, res) => {
  try {
    res.json(await productsRepo.listAllForAdmin());
  } catch (err) {
    console.error("[server] admin products list failed:", err);
    res.status(500).json({ error: "Could not load products." });
  }
});

app.post("/api/admin/products", requireAdmin(ADMIN_TOKEN), async (req, res) => {
  const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
  if (!/^[a-z0-9-]{2,60}$/.test(id)) {
    return res.status(400).json({ error: "Product id must be lowercase letters, numbers and hyphens only." });
  }
  const validated = validateProductBody(req.body);
  if (!validated.ok) return res.status(400).json({ errors: validated.errors });
  try {
    const created = await productsRepo.insert({ id, ...validated.value });
    await refreshProductsCacheNow();
    res.status(201).json(created);
  } catch (err) {
    if (err?.code === "23505") return res.status(409).json({ error: `A product with id "${id}" already exists.` });
    console.error("[server] admin product create failed:", err);
    res.status(500).json({ error: "Could not create the product." });
  }
});

app.put("/api/admin/products/:id", requireAdmin(ADMIN_TOKEN), async (req, res) => {
  const validated = validateProductBody(req.body);
  if (!validated.ok) return res.status(400).json({ errors: validated.errors });
  try {
    const updated = await productsRepo.update(req.params.id, validated.value);
    if (!updated) return res.status(404).json({ error: "No product with that id." });
    await refreshProductsCacheNow();
    res.json(updated);
  } catch (err) {
    console.error("[server] admin product update failed:", err);
    res.status(500).json({ error: "Could not update the product." });
  }
});

// Soft delete only — an archived product's id still resolves to a real name
// in past orders/emails instead of "undefined". Hard delete isn't exposed
// anywhere in the app.
app.post("/api/admin/products/:id/archive", requireAdmin(ADMIN_TOKEN), async (req, res) => {
  try {
    const archived = await productsRepo.archive(req.params.id);
    if (!archived) return res.status(404).json({ error: "No active product with that id." });
    await refreshProductsCacheNow();
    res.json(archived);
  } catch (err) {
    console.error("[server] admin product archive failed:", err);
    res.status(500).json({ error: "Could not archive the product." });
  }
});

app.post("/api/admin/products/:id/restore", requireAdmin(ADMIN_TOKEN), async (req, res) => {
  try {
    const restored = await productsRepo.restore(req.params.id);
    if (!restored) return res.status(404).json({ error: "No product with that id." });
    await refreshProductsCacheNow();
    res.json(restored);
  } catch (err) {
    console.error("[server] admin product restore failed:", err);
    res.status(500).json({ error: "Could not restore the product." });
  }
});

// Real deletion, offered alongside archive — see productsRepo.hardDelete for
// why this is safe (no foreign key from orders, so an existing order can't
// be corrupted by it).
app.delete("/api/admin/products/:id", requireAdmin(ADMIN_TOKEN), async (req, res) => {
  try {
    const deleted = await productsRepo.hardDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "No product with that id." });
    await refreshProductsCacheNow();
    res.json({ ok: true });
  } catch (err) {
    console.error("[server] admin product delete failed:", err);
    res.status(500).json({ error: "Could not delete the product." });
  }
});

// -------------------------------------------------------- admin: contacts

app.get("/api/admin/contacts", requireAdmin(ADMIN_TOKEN), async (_req, res) => {
  try {
    res.json(await contactsRepo.list());
  } catch (err) {
    console.error("[server] admin contacts list failed:", err);
    res.status(500).json({ error: "Could not load contacts." });
  }
});

app.patch("/api/admin/contacts/:id/handled", requireAdmin(ADMIN_TOKEN), async (req, res) => {
  try {
    const updated = await contactsRepo.markHandled(req.params.id);
    if (!updated) return res.status(404).json({ error: "No contact with that id." });
    res.json(updated);
  } catch (err) {
    console.error("[server] admin contact update failed:", err);
    res.status(500).json({ error: "Could not update the contact." });
  }
});

app.delete("/api/admin/contacts/:id", requireAdmin(ADMIN_TOKEN), async (req, res) => {
  try {
    const removed = await contactsRepo.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: "No contact with that id." });
    res.json({ ok: true });
  } catch (err) {
    console.error("[server] admin contact delete failed:", err);
    res.status(500).json({ error: "Could not delete the contact." });
  }
});

// -------------------------------------------------------- admin: orders

const FULFILLMENT_STATUSES = ["unfulfilled", "shipped"];

app.get("/api/admin/orders", requireAdmin(ADMIN_TOKEN), async (_req, res) => {
  try {
    res.json(await ordersRepo.list());
  } catch (err) {
    console.error("[server] admin orders list failed:", err);
    res.status(500).json({ error: "Could not load orders." });
  }
});

app.patch("/api/admin/orders/:id/fulfillment", requireAdmin(ADMIN_TOKEN), async (req, res) => {
  const fulfillmentStatus = req.body?.fulfillmentStatus;
  if (!FULFILLMENT_STATUSES.includes(fulfillmentStatus)) {
    return res.status(400).json({ error: `fulfillmentStatus must be one of: ${FULFILLMENT_STATUSES.join(", ")}` });
  }
  const trackingNote = typeof req.body?.trackingNote === "string" ? req.body.trackingNote.trim().slice(0, 200) : null;
  try {
    // Fetched before the update purely to know whether this is the moment
    // the order FIRST becomes "shipped" — editing the tracking note on an
    // order that's already shipped shouldn't silently re-notify the
    // customer every time (that's what the explicit resend button, POST
    // .../notify-shipped below, is for).
    const before = await ordersRepo.getById(req.params.id);
    const updated = await ordersRepo.updateFulfillment(req.params.id, { fulfillmentStatus, trackingNote });
    if (!updated) return res.status(404).json({ error: "No order with that id." });
    res.json(updated);

    if (fulfillmentStatus === "shipped" && before?.fulfillmentStatus !== "shipped") {
      sendShippedEmail(updated, trackingNote).catch((err) => console.error(`[server] could not send the shipped notification for ${updated.id}:`, err?.message || err));
    }
  } catch (err) {
    console.error("[server] admin order fulfillment update failed:", err);
    res.status(500).json({ error: "Could not update the order." });
  }
});

// On-demand resend — for adding/correcting a tracking note after the
// automatic send above already fired, or retrying if that one failed
// silently (mail briefly down, no customer email on file at the time).
app.post("/api/admin/orders/:id/notify-shipped", requireAdmin(ADMIN_TOKEN), async (req, res) => {
  try {
    const order = await ordersRepo.getById(req.params.id);
    if (!order) return res.status(404).json({ error: "No order with that id." });
    if (order.fulfillmentStatus !== "shipped") {
      return res.status(400).json({ error: "Mark the order as shipped before sending this email." });
    }
    await sendShippedEmail(order, order.trackingNote);
    res.json({ ok: true });
  } catch (err) {
    console.error(`[server] manual shipped-notification for ${req.params.id} failed:`, err?.message || err);
    res.status(502).json({ error: err.message || "Could not send the email." });
  }
});

// ------------------------------------------------------------- customer accounts
//
// No password ever exists on either side — see server/customerAuth.js. A
// customer "account" IS their verified email: there's no customers table
// and no customer_id on orders, "my orders" is just server/db/ordersRepo.js's
// listForEmail matched against ship_email, the same identity checkout has
// always collected anyway. Fully separate from checkout itself (still
// guest, no login required to buy) — this is purely an optional "see my
// past orders and tracking" area.

// Returns the expiry (ms epoch) it just set, so a caller that also needs to
// tell the customer when this expires (GET /api/customer/session) always
// reports the exact value just issued, never a separately-computed guess at
// it.
function setCustomerCookie(res, email) {
  const expiresAt = Date.now() + SESSION_MS;
  res.cookie(CUSTOMER_COOKIE, signCustomerSession(SESSION_SECRET, email), {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(process.env.RENDER),
    maxAge: SESSION_MS,
  });
  return expiresAt;
}

// Always the same response regardless of whether this email has ever
// ordered — anyone can sign in with any email they can prove they own; the
// magic link itself is that proof, so there's nothing to gate on here.
app.post("/api/customer/request-signin", async (req, res) => {
  if (!SESSION_SECRET) return res.status(404).json({ error: "Not found." });
  if (customerSigninLimited(clientIp(req))) {
    return res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  res.json({ ok: true });
  if (!EMAIL_RE.test(email) || !mailer) return;
  try {
    const token = signMagicLinkToken(SESSION_SECRET, email);
    const signInUrl = `${SITE_URL}/account?signin=${encodeURIComponent(token)}`;
    const mail = buildMagicLinkEmail(email, signInUrl);
    await mailer.sendMail({ from: `"YZ Labs" <${CONTACT_EMAIL_USER}>`, ...mail });
  } catch (err) {
    console.error("[server] customer sign-in email failed:", err?.message || err);
  }
});

app.post("/api/customer/verify", (req, res) => {
  if (!SESSION_SECRET) return res.status(404).json({ error: "Not found." });
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const email = token ? verifyMagicLinkToken(token, SESSION_SECRET) : null;
  if (!email) return res.status(400).json({ error: "This sign-in link is invalid or has expired. Request a new one." });
  const expiresAt = setCustomerCookie(res, email);
  res.json({ ok: true, email, expiresAt });
});

app.post("/api/customer/logout", (_req, res) => {
  res.clearCookie(CUSTOMER_COOKIE);
  res.json({ ok: true });
});

// The cookie is httpOnly (unreadable from JS), so this is the client's only
// way to know both whether it's signed in AND which email — shown in the UI
// as "Signed in as ...". Also renews the cookie for another full SESSION_MS
// (a sliding session — see customerAuth.js's SESSION_MS) and reports the
// resulting expiry, so the UI can tell the customer how long they're good
// for; every visit while signed in pushes that date out again, so an
// actually-active customer is never asked to sign in again.
app.get("/api/customer/session", requireCustomer(SESSION_SECRET), (req, res) => {
  const expiresAt = setCustomerCookie(res, req.customerEmail);
  res.json({ ok: true, email: req.customerEmail, expiresAt });
});

app.get("/api/customer/orders", requireCustomer(SESSION_SECRET), async (req, res) => {
  setCustomerCookie(res, req.customerEmail);
  try {
    let products = [];
    try {
      await productsCache.ensureFresh();
      products = productsCache.getAll();
    } catch (err) {
      console.error("[server] couldn't load the catalog for a customer's order list, falling back to bare ids:", err?.message || err);
    }
    const orders = await ordersRepo.listForEmail(req.customerEmail);
    res.json(
      orders.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        totalPaise: o.totalPaise,
        discountCode: o.discountCode,
        fulfillmentStatus: o.fulfillmentStatus,
        trackingNote: o.trackingNote,
        shipAddress: o.shipAddress,
        shipCity: o.shipCity,
        shipState: o.shipState,
        shipPincode: o.shipPincode,
        items: parseItems(o.itemsNote, products),
      }))
    );
  } catch (err) {
    console.error("[server] customer order list failed:", err);
    res.status(500).json({ error: "Could not load your orders." });
  }
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

  // The database save is what actually counts as "sent" now, and happens
  // FIRST — it used to happen only after the notification email succeeded,
  // which meant a slow or broken email connection (see the mailer comment
  // above) lost the message entirely instead of just failing to notify
  // anyone about it. The message is still visible at /admin -> Contacts
  // even when email is down.
  try {
    await contactsRepo.insert({ source: "contact", name: trimmedName, email: trimmedEmail, phone: trimmedPhone || null, message: trimmedMessage });
  } catch (err) {
    console.error("[server] couldn't save the contact message:", err?.message || err);
    return res.status(500).json({ error: "Could not send your message. Please try again or email us directly." });
  }
  recordSubmission(ip);
  res.json({ ok: true });

  // Best-effort notification, after the response — its failure (including a
  // hung/blocked SMTP connection, now bounded by the mailer's own timeouts)
  // never affects whether the message counted as received.
  if (mailer) {
    const notification = buildContactNotificationEmail({ name: trimmedName, email: trimmedEmail, phone: trimmedPhone, message: trimmedMessage });
    mailer
      .sendMail({ from: `"YZ Labs website" <${CONTACT_EMAIL_USER}>`, to: CONTACT_TO_EMAIL, ...notification })
      .catch((err) => console.error("[server] contact notification email failed:", err?.message || err));
  }
});

// "Get notified" waitlist signup. The database save is what actually counts
// as "joined" and happens FIRST — it used to happen only after the shop's
// notification email succeeded, which meant a slow or broken email
// connection (see the mailer comment above) lost the signup entirely rather
// than just failing to notify anyone about it. The signup is still visible
// at /admin -> Contacts even when email is down or not configured at all.
app.post("/api/waitlist", async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  if (waitlistLimited(ip)) {
    return res.status(429).json({ error: "Too many signups from here recently. Please try again later." });
  }

  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  if (!email) return res.status(400).json({ error: "Enter an email address." });
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return res.status(400).json({ error: "That email address doesn't look valid." });
  }

  const ALREADY_ON_WAITLIST = "You're already on the waitlist — we'll email you when the next batch drops.";
  try {
    if (await contactsRepo.existsWaitlistEmail(email)) {
      return res.status(409).json({ error: ALREADY_ON_WAITLIST, alreadyOnWaitlist: true });
    }
    await contactsRepo.insert({ source: "waitlist", email });
  } catch (err) {
    // 23505 = unique_violation on contacts_waitlist_email_unique (see
    // schema.sql) — the existsWaitlistEmail check above already covers the
    // ordinary case, this only fires if two signups for the same brand-new
    // email land at almost the exact same moment.
    if (err?.code === "23505") {
      return res.status(409).json({ error: ALREADY_ON_WAITLIST, alreadyOnWaitlist: true });
    }
    console.error("[server] couldn't save the waitlist signup:", err?.message || err);
    return res.status(500).json({ error: "Could not join the waitlist. Please try again or email us directly." });
  }
  res.json({ ok: true });

  // Best-effort, after the response — each independent of the other, so one
  // failing (or a hung connection, now bounded by the Gmail mailer's own
  // token/HTTP handling) never blocks or is blocked by the other, and
  // neither affects whether the signup counted.
  if (mailer) {
    const notification = buildWaitlistNotificationEmail(email);
    mailer
      .sendMail({ from: `"YZ Labs website" <${CONTACT_EMAIL_USER}>`, to: CONTACT_TO_EMAIL, ...notification })
      .catch((err) => console.error("[server] waitlist notification email failed:", err?.message || err));

    const confirmation = buildWaitlistConfirmationEmail(email, { shopEmail: CONTACT_TO_EMAIL });
    mailer
      .sendMail({ from: `"YZ Labs" <${CONTACT_EMAIL_USER}>`, ...confirmation })
      .catch((err) => console.error("[server] waitlist confirmation email failed:", err?.message || err));
  }
});

// The live product catalog (records only — see /api/product-images below for
// photos, which stay file-based). Backed by productsCache so this is never a
// database round-trip on every page load; 503 only if the database has never
// loaded successfully since boot (see productsCache.js's ensureFresh).
app.get("/api/products", async (_req, res) => {
  try {
    await productsCache.ensureFresh();
  } catch (err) {
    console.error("[server] couldn't load the catalog:", err?.message || err);
    return res.status(503).json({ error: "The catalog isn't available right now." });
  }
  res.json(productsCache.getAll());
});

// Product photos live directly on disk under public/products/<folder>/ —
// this reads that folder fresh on every request, so dropping a new image
// in (or deleting one) shows up on the next page load, no code change or
// restart. Response keys are the folder names themselves; the frontend
// matches each product's `imageFolder` (data/products.js) against them —
// folder names don't have to match a product's own id. A file literally
// named `hero.*` is still the one used for the catalog/orbit tile
// (`heroImage`), but the detail-popup gallery (`images`) is now every image
// in the folder, hero included — shown first, then the rest sorted by
// filename — so the popup shows the same shot used for the tile itself
// plus every other angle, not everything EXCEPT the tile's own photo.
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
      const rest = files.filter((f) => f !== heroFile).sort();
      const gallery = heroFile ? [heroFile, ...rest] : rest;

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
