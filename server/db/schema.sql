-- YZ Labs database schema. Hand-applied once (Neon SQL console or `psql
-- "$DATABASE_URL" -f server/db/schema.sql`) — there's no migration framework
-- here, this file is the single source of truth for the shape of the
-- database. Re-running it is safe (everything is IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  image_folder  TEXT NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  tagline       TEXT NOT NULL DEFAULT '',
  material      TEXT NOT NULL DEFAULT '',
  -- [{ "id": "black", "priceDelta": 0 }, ...] — resolved against the static
  -- COLORWAYS palette (src/data/colorways.js) at read time, same as the
  -- static catalog did. Not a join table: COLORWAYS itself stays a fixed,
  -- non-editable app constant, not something rows here reference by FK.
  colors        JSONB NOT NULL DEFAULT '[]',
  dims          TEXT NOT NULL DEFAULT '',
  weight        TEXT NOT NULL DEFAULT '',
  -- Integer rupees, same convention as the old static catalog (e.g. 1070).
  -- <= 0 falls back to a default price at read time rather than selling at
  -- Rs 0 (Razorpay rejects that outright) — see productsRepo.js.
  price         INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'In stock',
  batch         TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  -- Soft delete: "remove a product" archives it rather than hard-deleting,
  -- so its id still resolves to a real name in past orders/emails instead
  -- of showing up as "undefined". Hard delete is deliberately not exposed
  -- anywhere in the app.
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category) WHERE archived_at IS NULL;
-- Structured weight in grams, for the Shiprocket push (server/shiprocket.js)
-- to sum into an order's total parcel weight — separate from the free-text
-- `weight` column above, which is only ever a display string ("134 g") and
-- isn't reliably parseable. Added after the table already existed, hence
-- ALTER rather than being in the CREATE TABLE above.
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_g INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS contacts (
  id          BIGSERIAL PRIMARY KEY,
  source      TEXT NOT NULL CHECK (source IN ('waitlist', 'contact')),
  name        TEXT,               -- null for waitlist signups (email-only)
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT,               -- null for waitlist signups
  handled_at  TIMESTAMPTZ,        -- admin marks as dealt with
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON contacts (created_at DESC);
-- One waitlist signup per email (case-insensitive) — contact-form messages
-- are unaffected (this only applies to source = 'waitlist' rows). Backs up
-- the application-level check in POST /api/waitlist against a race between
-- two near-simultaneous signups for the same brand-new email.
CREATE UNIQUE INDEX IF NOT EXISTS contacts_waitlist_email_unique ON contacts (lower(email)) WHERE source = 'waitlist';

CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,          -- Razorpay order id
  status              TEXT NOT NULL,               -- mirrored: created|attempted|paid
  payment_id          TEXT,
  subtotal_paise      INTEGER NOT NULL,
  discount_paise      INTEGER NOT NULL DEFAULT 0,
  discount_code       TEXT,
  total_paise         INTEGER NOT NULL,
  items_note          TEXT,
  ship_name           TEXT,
  ship_email          TEXT,
  ship_phone          TEXT,
  ship_address        TEXT,
  ship_city           TEXT,
  ship_state          TEXT,
  ship_pincode        TEXT,
  razorpay_created_at TIMESTAMPTZ,
  -- These three are the ONLY database-authoritative columns on this table —
  -- everything else here is a best-effort mirror of Razorpay's own record,
  -- never consulted for payment or discount correctness (see orderLedger.js,
  -- which is untouched by this table's existence).
  fulfillment_status  TEXT NOT NULL DEFAULT 'unfulfilled',
  tracking_note       TEXT,
  fulfilled_at        TIMESTAMPTZ,
  mirrored_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
-- Set once server/shiprocket.js successfully pushes this order into the
-- Shiprocket panel — purely informational (admin visibility), never
-- consulted for anything else. NULL just means "not pushed yet", which is
-- fine: it's a best-effort step, retried by nothing, fixable by hand in
-- Shiprocket if it never lands.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_pushed_at TIMESTAMPTZ;

-- Named admin accounts (replaces logging in with the bare ADMIN_TOKEN).
-- password_hash is NULL until that person sets their own password —
-- proving they're allowed to claim the account still requires ADMIN_TOKEN,
-- once, the first time (see POST /api/admin/setup-password); every login
-- after that is just email + password. Emails are seeded below; edit the
-- INSERTs (or add more) for your own admin team before/after applying this
-- file — it's the one place this list lives, there's no admin UI for it.
CREATE TABLE IF NOT EXISTS admin_users (
  email           TEXT PRIMARY KEY,
  password_hash   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  password_set_at TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ
);
INSERT INTO admin_users (email) VALUES
  ('yzlabs.store@gmail.com'),
  ('s.zeenath.ara@gmail.com'),
  ('shahidfardeen2204@gmail.com')
ON CONFLICT (email) DO NOTHING;
