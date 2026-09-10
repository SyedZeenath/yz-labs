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
4. Once live, add the deployed webhook URL (`https://your-app.onrender.com/api/webhook`) in the Razorpay Dashboard if you want webhook-based payment confirmation in addition to the built-in signature verification.

## Before accepting real payments

- Complete Razorpay KYC/business verification and switch to live keys.
- Replace the in-memory order tracking in `server/index.js` with a real database — it currently resets on every server restart.
- Review product prices in `src/data/products.js` — placeholders as of writing.
