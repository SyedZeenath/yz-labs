import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Razorpay from "razorpay";
import { resolveProductPrice } from "../src/data/products.js";

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

// In-memory order ledger — fine for local dev/testing, but this resets on
// every restart and isn't shared across server instances. Swap for a real
// database (Postgres, Supabase, etc.) before accepting real payments.
const orders = new Map();

const app = express();
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
  if (orderId && orders.has(orderId) && event.event === "payment.captured") {
    orders.get(orderId).status = "paid";
  }

  res.json({ received: true });
});

app.use(express.json());

app.post("/api/create-order", async (req, res) => {
  if (!razorpay) {
    return res.status(500).json({ error: "Razorpay is not configured on the server yet — add keys to .env." });
  }

  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty." });
  }

  let amount = 0;
  const lineItems = [];
  for (const { id, colorId, qty } of items) {
    // Price (and which color it resolves to) is looked up server-side from
    // the product catalog only — a client-sent colorId can pick *which*
    // known color's price applies, never override the price itself.
    const resolved = resolveProductPrice(id, colorId);
    const price = resolved?.price;
    // Razorpay will flat-out refuse to create an order for a line/total
    // amount of ₹0 — that's exactly the rejection this was built to catch.
    // A product with no real price yet should be pulled from the catalog
    // (src/data/products.js), not left orderable at ₹0.
    if (!resolved || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: `"${id}" doesn't have a valid price yet and can't be ordered.` });
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: `Invalid quantity for: ${id}` });
    }
    amount += price * qty;
    lineItems.push({ id, colorId: resolved.color?.id, qty, price });
  }

  const amountPaise = Math.round(amount * 100);
  // Razorpay's actual minimum order amount is ₹1 (100 paise), not just
  // "more than zero" — enforce the real rule, not a looser stand-in for it.
  if (amountPaise < 100) {
    return res.status(400).json({ error: "Order total must be at least ₹1." });
  }

  try {
    const order = await razorpay.orders.create({
      amount: amountPaise, // Razorpay wants the amount in paise
      currency: "INR",
      receipt: `yzlabs_${Date.now()}`,
      notes: { items: JSON.stringify(lineItems) },
    });

    orders.set(order.id, { status: "created", amount, lineItems, createdAt: Date.now() });

    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: KEY_ID });
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

  const order = orders.get(razorpay_order_id);
  if (order) {
    order.status = "paid";
    order.paymentId = razorpay_payment_id;
  }

  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, razorpayConfigured: Boolean(razorpay) });
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
});
