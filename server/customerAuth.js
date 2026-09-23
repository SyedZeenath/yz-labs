import { signToken, verifyToken, readCookie } from "./authTokens.js";

export const CUSTOMER_COOKIE = "yz_customer";
// Customers sign in far less often than admins do their day-to-day work, so
// this stays valid much longer than the admin session (12h) — 30 days,
// closer to "stay signed in" than a work session. Exported so
// server/index.js's authenticated customer routes can renew the cookie by
// this same amount on every request (a sliding session — an active
// customer never has to sign in again, only one gone a full 30 days
// straight does) and tell the customer the resulting expiry, without a
// second copy of this number drifting out of sync with it.
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MAGIC_LINK_MS = 30 * 60 * 1000; // 30 minutes

// Its own secret (SESSION_SECRET), never ADMIN_TOKEN — a leaked/forged
// customer session must never double as admin access, and vice versa.
// Same stateless signed-token mechanism as server/adminAuth.js (see
// server/authTokens.js), just a different secret and different `purpose`
// strings, so tokens from the two systems can never be swapped either.
export function signCustomerSession(secret, email, { now = Date.now } = {}) {
  return signToken(secret, "customer", email, SESSION_MS, now);
}

export function verifyCustomerSession(value, secret, { now = Date.now } = {}) {
  return verifyToken(value, secret, "customer", now);
}

// The sign-in ("magic link") email's proof of identity — see POST
// /api/customer/request-signin. No password ever exists to check: clicking
// a link that only ever reached their own inbox IS the login.
export function signMagicLinkToken(secret, email, { now = Date.now } = {}) {
  return signToken(secret, "magiclink", email, MAGIC_LINK_MS, now);
}

export function verifyMagicLinkToken(value, secret, { now = Date.now } = {}) {
  return verifyToken(value, secret, "magiclink", now);
}

// 404s (not 401) when SESSION_SECRET isn't configured — same "this feature
// doesn't exist at all" behavior server/adminAuth.js uses for ADMIN_TOKEN.
export function requireCustomer(secret) {
  return (req, res, next) => {
    if (!secret) return res.status(404).json({ error: "Not found." });
    const cookie = readCookie(req, CUSTOMER_COOKIE);
    const email = cookie ? verifyCustomerSession(cookie, secret) : null;
    if (!email) return res.status(401).json({ error: "Not signed in." });
    req.customerEmail = email;
    next();
  };
}
