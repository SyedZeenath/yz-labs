# YZ Labs

A storefront for small-batch, 3D-printed objects — each piece printed to order rather than mass-produced and kept in stock. Built as a React frontend with an Express backend, backed by a Postgres database.

## Features

**Storefront**
- Product catalog with categories, per-product photo galleries, and color options
- Guest checkout — no account required to buy — with payment via UPI, cards, netbanking, and wallets
- Discount codes, including a first-purchase offer, enforced server-side so they can't be reused or tampered with from the browser
- A waitlist for restocks, and a contact form
- Legal pages: terms, privacy policy, refund/cancellation policy, shipping policy

**Customer accounts**
- Passwordless sign-in via a one-click emailed link — no password is ever collected from a customer
- Order history and shipment tracking, visible once signed in

**Order fulfillment**
- Every paid order is automatically pushed into a Shiprocket panel, ready for a courier to be assigned and the parcel shipped
- Order confirmation, shipping/tracking, and waitlist emails are sent automatically, styled consistently with the rest of the site

**Admin panel**
- Manage the product catalog (add, edit, price, archive)
- View and manage waitlist signups and contact-form messages
- View paid orders, set fulfillment status and tracking information
- Each admin logs in with their own email and password (with a self-service password reset), rather than a single shared credential

## Third-party services

- **Razorpay** — processes every payment (UPI, cards, netbanking, wallets). Card and bank details are handled entirely by Razorpay; this site never receives or stores them.
- **Neon** — hosts the Postgres database (product catalog, contacts, orders, admin accounts).
- **Render** — hosts and runs the site.
- **Gmail (Google)** — sends every email the site sends (order confirmations, shipping notices, sign-in links, waitlist and contact notifications) from the shop's own Gmail account.
- **Shiprocket** — receives paid orders so they're ready to ship; courier selection and pickup are still done by hand in Shiprocket's own panel.
- **Google Fonts** — the site's typefaces are loaded from Google's font service.

No analytics, advertising, or tracking services are used anywhere on the site.

## Customer information

**Collected at checkout:** name, email, mobile number, and delivery address. This is used to fulfil the order, is stored in Razorpay's own payment record, and is mirrored into this site's own database so an order can be shown in `/admin` and in the customer's own order history.

**Collected for the waitlist:** an email address.

**Collected via the contact form:** name, email, and message, plus phone number if given.

**Collected for a customer account:** only the email address used to sign in. There is no password, and nothing beyond what checkout already collects.

**Never collected or stored:** payment card or bank details (handled entirely by Razorpay), or a password for any customer.
