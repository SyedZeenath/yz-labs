# YZ Labs

Small-batch 3D-printed objects storefront — React + Vite frontend, Express backend with Razorpay checkout (UPI, cards, netbanking, wallets).

## Project structure

- `src/` — React frontend (components, product data, cart state)
- `server/index.js` — Express backend: creates Razorpay orders, verifies payments, serves the built frontend in production
- `public/products/` — product photos, one folder per product (`hero.png` is the catalog/hero shot, shot on pure black)

## Local development

```bash
npm install
cp .env.example .env   # then fill in your Razorpay test keys
npm run dev
```

This runs the Vite dev server (`:5173`) and the Express backend (`:8787`) together; Vite proxies `/api/*` requests to the backend. Open http://localhost:5173.

Get test keys from the [Razorpay Dashboard](https://dashboard.razorpay.com/app/keys) → Settings → API Keys → Generate Test Key.

## Editing the catalog

Products live in [`src/data/products.js`](src/data/products.js) — one object per product (name, price, description, material, dimensions, image). Add/edit/remove entries directly, and drop photos into `public/products/`.

## Deploying (Render)

1. Push this repo to GitHub.
2. On [Render](https://render.com), New → Blueprint, point it at the repo — it will pick up `render.yaml` automatically (build: `npm install && npm run build`, start: `npm start`).
3. In the Render dashboard, set the environment variables: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (optional, only needed once you configure a webhook).
4. Once live, add the deployed webhook URL (`https://your-app.onrender.com/api/webhook`) in the Razorpay Dashboard (event: `payment.captured`) if you want webhook-based payment confirmation in addition to the built-in signature verification. This is also what makes sure you still get the new-order email if a customer closes the tab right after paying.

### Knowing about orders

Checkout collects the customer's name, email, mobile and India delivery address before payment. Each paid order then reaches you in three places:

- **Email**: one "New order" email per paid order (customer, items, ship-to address) to `CONTACT_TO_EMAIL`. Needs the `CONTACT_EMAIL_*` variables set.
- **Razorpay Dashboard**: the same details are stored in the order's notes (`ship_name`, `ship_address`, …).
- **Server logs**: every paid order is printed as `PAID ORDER …`.

The server keeps no order database of its own; the email and the Razorpay notes are the durable record (and, below, what discount history is rebuilt from).

## Discount codes

Codes are defined in [`server/discounts.js`](server/discounts.js) — add an entry to `DISCOUNTS` and it works, no other change needed. They live on the server only (never in the browser bundle); the cart just asks the server whether a code is valid for its contents.

```js
FIRSTBUY25: {
  description: "25% off your first order",
  listed: true,             // show it under "Check available offers" in the cart
  type: "percent",          // or "fixed" (value = rupees off)
  value: 25,
  firstPurchaseOnly: true,  // only customers with no earlier paid order
  // optional: active, startsAt, expiresAt, minSubtotal, maxDiscount, perCustomerLimit (default 1)
},
```

**Offers list.** The cart has a "Check available offers" link under the code box. It opens a list of every code marked `listed: true` that is currently live, showing what each would save on *that* cart (or how much more to add to unlock it, if there's a minimum), with the fine print generated from the code's own rules. One tap applies an offer. A code that isn't `listed` still works if someone types it — that's what to use for private or influencer codes, since they're never sent to the browser.

**Rules.** One code per order (applying another replaces it). Each code can be used once per customer (`perCustomerLimit`), and `firstPurchaseOnly` codes only work for customers who have never paid before. An abandoned checkout doesn't use a code up — only a *paid* order does. A discount can never take an order below Razorpay's ₹1 minimum. The server always recomputes the discount itself; the browser's numbers are for display only.

**Who counts as "the same customer".** There are no accounts, so a customer is recognised by what they enter at checkout: their email (Gmail dots and `+tags` are ignored), their mobile number, or their delivery address — a match on **any one** counts. That stops someone reusing a code just by typing a new email, but it isn't airtight (a friend's phone *and* address *and* email would get around it).

**Where the history lives.** Deliberately not on this server's disk (Render's free plan wipes it on every restart, which would let codes be reused). Each order's Razorpay notes carry the customer's details and any discount used, and the server rebuilds its history from Razorpay's order list at startup and before deciding a discount. If Razorpay can't be reached and history has never been loaded, discounts are refused rather than guessed. Limits: orders placed before the delivery-address step existed carry no customer details, so those customers can't be recognised as returning; and only the most recent 5,000 orders are read.

**Tracking.** Set `ADMIN_TOKEN` (any long random string), then:

```
curl -H "Authorization: Bearer <ADMIN_TOKEN>" https://your-app.onrender.com/api/admin/discounts
```

returns, per code, the number of paid redemptions, total discount given, and each redemption (order, date, customer email, amounts). Redemptions that beat the once-per-customer rule (two checkouts open at once, both paid) are marked `duplicateOfEarlierUse` and also flagged in the order email. Without `ADMIN_TOKEN` the endpoint doesn't exist. Every paid order's email also shows the code, subtotal, discount and amount paid.

Run the discount tests with `npm test`.

## Before accepting real payments

- Complete Razorpay KYC/business verification and switch to live keys.
- Review product prices in `src/data/products.js` — placeholders as of writing.
