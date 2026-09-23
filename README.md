# YZ Labs

Small-batch 3D-printed objects storefront — React + Vite frontend, Express backend with Razorpay checkout (UPI, cards, netbanking, wallets).

## Project structure

- `src/` — React frontend (components, cart state); `src/pages/admin/` is the `/admin` panel
- `server/index.js` — Express backend: creates Razorpay orders, verifies payments, serves the built frontend in production
- `server/db/` — Postgres access: `pool.js` (connection), `productsRepo.js` / `contactsRepo.js` / `ordersRepo.js`, `productsCache.js` (the in-memory cache checkout prices from), `schema.sql` (the whole database schema, applied by hand)
- `public/products/` — product photos, one folder per product (`hero.png` is the catalog/hero shot, shot on pure black) — unaffected by any of the above, still plain files

## Local development

You need a Postgres database — this app has no persistence of its own to fall back to. A free [Neon](https://neon.tech) project works well (Render's own free Postgres auto-deletes after 90 days, so it isn't a real option here).

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and your Razorpay test keys
psql "$DATABASE_URL" -f server/db/schema.sql   # or paste schema.sql into Neon's SQL editor
node scripts/seedProducts.js  # loads the starting catalog into the database, once
npm run dev
```

This runs the Vite dev server (`:5173`) and the Express backend (`:8787`) together; Vite proxies `/api/*` requests to the backend. Open http://localhost:5173.

Get test keys from the [Razorpay Dashboard](https://dashboard.razorpay.com/app/keys) → Settings → API Keys → Generate Test Key.

## Email sending

The contact form, waitlist, and order confirmations all send through **Gmail's own API** (`server/gmailApi.js`), not SMTP — a plain HTTPS call, so it isn't affected by Render (or most free hosts) blocking outbound SMTP the way `nodemailer` was. Mail still genuinely comes from your real Gmail address; no new email-provider account or domain needed. Every feature that sends email also saves its own record first (a signup/message to the database, an order to Razorpay) — see the "DB-first" comments in `server/index.js` — so nothing here being unconfigured or briefly down ever loses that record, it just means nobody gets emailed about it yet.

One-time setup, per Gmail account you want sending as:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), signed in as the Gmail account that should send mail (e.g. `yzlabs.store@gmail.com`). Create a new project (any name).
2. [APIs & Services → Library](https://console.cloud.google.com/apis/library) → search "Gmail API" → **Enable**.
3. [APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) → User type **External** → Create. Fill in an app name and your email for the two contact fields, save and continue. Under **Scopes**, add `https://www.googleapis.com/auth/gmail.send`. Under **Test users**, add the same Gmail address. Leave the app in **Testing** status — being listed as a test user is what keeps the refresh token from expiring, so there's no need to publish/verify it.
4. [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) → **Create Credentials → OAuth client ID** → Application type **Desktop app** → Create. Copy the **Client ID** and **Client secret**.
5. Add those two to `.env` as `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET`, then run:
   ```bash
   node scripts/gmailOAuthSetup.mjs
   ```
   Open the URL it prints, sign in with that same Gmail account, and approve access — the script catches the redirect automatically and prints a `GMAIL_OAUTH_REFRESH_TOKEN` to add to `.env`.
6. Set `CONTACT_EMAIL_USER` to that Gmail address (and optionally `CONTACT_TO_EMAIL`, if the shop's own copies should land somewhere else).

For production, add all five (`CONTACT_EMAIL_USER`, `CONTACT_TO_EMAIL`, `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN`) to Render's environment variables too — the refresh token from step 5 works there as well, no separate consent flow needed per environment.

## Editing the catalog

Products live in the database now, edited at **`/admin`** (see below) — add, edit, price, or archive a product there and it's live immediately, no deploy needed. Photos are still plain files: drop them into `public/products/<folder>/` and match that folder name to the product's "Image folder" field in the admin form (`hero.*` is the catalog shot; every other image becomes the detail-popup gallery).

`src/data/products.js` still exists but is no longer live data — it's only the one-time seed for a brand-new database (`scripts/seedProducts.js`) and a fixture for the test suite, so `npm test` never needs a real database.

## Admin panel

`/admin` — products (add/edit/archive/delete), contacts (waitlist signups and contact-form messages), and orders (paid orders mirrored from Razorpay, with a fulfillment status and tracking note you can set).

**Logging in.** There's no shared admin password — each person on the admin list logs in with their own email and a password they set themselves. Who's allowed is a fixed list of emails in [`server/db/schema.sql`](server/db/schema.sql) (edit the `INSERT INTO admin_users` there to add/remove people — there's no UI for this, on purpose, since it controls who can do everything else). The first time one of those emails logs in, the form asks for a password to set plus the `ADMIN_TOKEN` from your `.env` — proving they're actually one of the people you gave that token to, not just someone who guessed or found the email. Every login after that is just their email and password; `ADMIN_TOKEN` is never needed again for them. Without `ADMIN_TOKEN` set at all, `/admin` refuses every login and setup attempt outright.

**Forgot a password?** Click "Forgot password?" on the login screen and enter the admin email — if it's on the list, a reset link is emailed to it (valid 30 minutes, needs email sending configured — see "Email sending" above). The link itself is the proof of identity, not `ADMIN_TOKEN`: it only ever reaches that person's own inbox, so it's allowed to overwrite an existing password, unlike first-time setup. Without email configured, fall back to clearing that person's `password_hash` back to `NULL` in the `admin_users` table — they'll get the first-time setup screen again.

The products list is cached in memory for fast checkout (`server/db/productsCache.js`) — any edit through `/admin` invalidates that cache immediately, so a price change or a new product is live on the site right away, not after a delay.

## Deploying (Render)

1. Push this repo to GitHub.
2. On [Render](https://render.com), New → Blueprint, point it at the repo — it will pick up `render.yaml` automatically (build: `npm install && npm run build`, start: `npm start`).
3. In the Render dashboard, set the environment variables: `DATABASE_URL` (your Neon connection string — apply `server/db/schema.sql` and run `node scripts/seedProducts.js` against it once, the same as local setup, before the first real deploy), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (optional, only needed once you configure a webhook).
4. Once live, add the deployed webhook URL (`https://your-app.onrender.com/api/webhook`) in the Razorpay Dashboard (event: `payment.captured`) if you want webhook-based payment confirmation in addition to the built-in signature verification. This is also what makes sure you still get the new-order email if a customer closes the tab right after paying.

### Knowing about orders

Checkout collects the customer's name, email, mobile and India delivery address before payment. Each paid order then reaches you in three places:

- **Email**: one "New order" email per paid order (customer, items, ship-to address) to `CONTACT_TO_EMAIL`. Needs email sending configured — see "Email sending" above.

The customer gets their own confirmation too, sent to the email they entered at checkout: order ID, items, discount breakdown, delivery address, what happens next, and your contact details (replies go to `CONTACT_TO_EMAIL`; the phone number shown is `SHOP_PHONE`, default `+91 8660 828944`). The two emails are independent — if one fails to send, the other still goes, and the retry (from the webhook or a second verify) only resends the missing one. It complements Razorpay's own payment receipt rather than replacing it; in the Razorpay Dashboard → Settings → Notifications, leave the customer email/SMS receipts on. Orders with no customer email (placed before the delivery step existed) just skip it.
- **Razorpay Dashboard**: the same details are stored in the order's notes (`ship_name`, `ship_address`, …) — still the source of truth for payment status and discount history.
- **Server logs**: every paid order is printed as `PAID ORDER …`.
- **`/admin` → Orders**: a best-effort mirror into the database, for browsing and for setting a fulfillment status/tracking note. If this mirror step fails (a database blip) the order simply doesn't show up there yet — it never affects payment confirmation or either email, and never re-decides anything about discounts (that's still Razorpay + `server/orderLedger.js`, unchanged). Marking an order **"Shipped"** here also emails the customer automatically (order id, tracking note if any, what they ordered) — once, the moment it first flips to shipped; editing the tracking note afterward doesn't re-send on its own, use the row's **"Resend shipping email"** button for that.
- **Shiprocket** (see below) — pushed into your Shiprocket panel, ready to ship.

## Shipping (Shiprocket)

Every paid order is also pushed into your [Shiprocket](https://www.shiprocket.in) panel (`server/shiprocket.js`) so it's sitting there ready to go — this is deliberately "push to panel only": nothing here picks a courier, schedules a pickup, or spends any wallet balance. You still open Shiprocket and ship it by hand, same as if you'd entered the order there yourself. `/admin` → Orders shows whether each order made it across (and its Shiprocket order id) under a "Shiprocket" column.

Needs three env vars — `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_LOCATION` (see `.env.example`). Leave any blank and this step is silently skipped; nothing else about the order is affected. Setup:

1. In your Shiprocket dashboard: **Settings → API → Add New API User** — create a dedicated API user (its email must differ from your main login) and note its email/password. `SHIPROCKET_PASSWORD` goes straight into `.env`, never anywhere else.
2. **Settings → Pickup Addresses** — copy the exact saved nickname of the address you ship from (not the address itself) into `SHIPROCKET_PICKUP_LOCATION`. It has to match character-for-character.

Two things worth knowing about what gets sent: Shiprocket's order-create API takes one parcel size (length/breadth/height) for the *whole* shipment, not per product, so a single approximate default box size is used for every order (`DEFAULT_PARCEL_CM` in `server/shiprocket.js`) — adjust it there if the shop settles on a different standard box. Weight is real, though: each product has a "Weight for shipping (grams)" field at `/admin` (separate from the display-only "Weight" text field), summed per order; a product left at 0g falls back to a rough default rather than making the whole order's weight zero.

## Discount codes

Codes are defined in [`server/discounts.js`](server/discounts.js) — add an entry to `DISCOUNTS` and it works, no other change needed. They live on the server only (never in the browser bundle); the cart just asks the server whether a code is valid for its contents.

```js
FIRSTBUY10: {
  description: "10% off your first order",
  listed: true,             // show it under "Check available offers" in the cart
  type: "percent",          // or "fixed" (value = rupees off)
  value: 10,
  firstPurchaseOnly: true,  // only customers with no earlier paid order
  // optional: active, startsAt, expiresAt, minSubtotal, maxDiscount, perCustomerLimit (default 1)
},
```

**Offers list.** The cart has a "Check available offers" link under the code box. It opens a list of every code marked `listed: true` that is currently live, showing what each would save on *that* cart (or how much more to add to unlock it, if there's a minimum), with the fine print generated from the code's own rules. One tap applies an offer. A code that isn't `listed` still works if someone types it — that's what to use for private or influencer codes, since they're never sent to the browser.

**Rules.** One code per order (applying another replaces it). Each code can be used once per customer (`perCustomerLimit`), and `firstPurchaseOnly` codes only work for customers who have never paid before. An abandoned checkout doesn't use a code up — only a *paid* order does. A discount can never take an order below Razorpay's ₹1 minimum. The server always recomputes the discount itself; the browser's numbers are for display only.

**Who counts as "the same customer".** There are no accounts, so a customer is recognised by what they enter at checkout: their email (Gmail dots and `+tags` are ignored), their mobile number, or their delivery address — a match on **any one** counts. That stops someone reusing a code just by typing a new email, but it isn't airtight (a friend's phone *and* address *and* email would get around it).

**Where the history lives.** Deliberately not on this server's disk (Render's free plan wipes it on every restart, which would let codes be reused). Each order's Razorpay notes carry the customer's details and any discount used, and the server rebuilds its history from Razorpay's order list at startup and before deciding a discount. If Razorpay can't be reached and history has never been loaded, discounts are refused rather than guessed. Limits: orders placed before the delivery-address step existed carry no customer details, so those customers can't be recognised as returning; and only the most recent 5,000 orders are read.

**Tracking.** Set `ADMIN_TOKEN` (any long random string — it's also what logs you into `/admin`), then:

```
curl -H "Authorization: Bearer <ADMIN_TOKEN>" https://your-app.onrender.com/api/admin/discounts
```

returns, per code, the number of paid redemptions, total discount given, and each redemption (order, date, customer email, amounts). Redemptions that beat the once-per-customer rule (two checkouts open at once, both paid) are marked `duplicateOfEarlierUse` and also flagged in the order email. Without `ADMIN_TOKEN` the endpoint doesn't exist. Every paid order's email also shows the code, subtotal, discount and amount paid.

Run the discount tests with `npm test`.

## Before accepting real payments

- Complete Razorpay KYC/business verification and switch to live keys.
- Review every product's price, dimensions and weight at `/admin` — several still carry placeholder values as of writing.
