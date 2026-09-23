import crypto from "node:crypto";

export const ADMIN_COOKIE = "yz_admin";
const DEFAULT_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

// A stateless session: no server-side session store, just an expiry
// timestamp and an HMAC of it keyed on ADMIN_TOKEN (the same secret, and the
// same crypto.timingSafeEqual-based comparison primitive, already used for
// the Razorpay webhook signature and the original /api/admin/discounts
// check) — verifying a cookie needs nothing but the secret itself.
export function signAdminCookie(secret, { sessionMs = DEFAULT_SESSION_MS, now = Date.now } = {}) {
  const expiresAt = now() + sessionMs;
  return `${expiresAt}.${hmac(secret, `admin:${expiresAt}`)}`;
}

export function verifyAdminCookie(value, secret, { now = Date.now } = {}) {
  if (typeof value !== "string") return false;
  const [expiresAtStr, sig] = value.split(".");
  const expiresAt = Number(expiresAtStr);
  if (!expiresAtStr || !sig || !Number.isFinite(expiresAt)) return false;
  if (now() > expiresAt) return false;
  const expected = Buffer.from(hmac(secret, `admin:${expiresAt}`));
  const given = Buffer.from(sig);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// No `cookie-parser` dependency — this app only ever needs to read the one
// cookie it sets itself, so a full parser is more than this needs.
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Accepts EITHER a valid signed admin cookie (the browser login flow) OR the
// original `Authorization: Bearer <ADMIN_TOKEN>` header (so any existing
// curl usage of /api/admin/discounts keeps working unchanged). 404s rather
// than 401s when ADMIN_TOKEN itself isn't configured — same "this endpoint
// doesn't exist at all" behavior the original discounts endpoint had.
export function requireAdmin(adminToken) {
  return (req, res, next) => {
    if (!adminToken) return res.status(404).json({ error: "Not found." });
    const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (bearer && timingSafeEqualStrings(bearer, adminToken)) return next();
    const cookie = readCookie(req, ADMIN_COOKIE);
    if (cookie && verifyAdminCookie(cookie, adminToken)) return next();
    return res.status(401).json({ error: "Unauthorized." });
  };
}
