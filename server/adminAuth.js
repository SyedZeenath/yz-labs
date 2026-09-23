import crypto from "node:crypto";

export const ADMIN_COOKIE = "yz_admin";
const DEFAULT_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours
const RESET_TOKEN_MS = 30 * 60 * 1000; // 30 minutes

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

// A stateless token: no server-side store, just who it's for, an expiry
// timestamp, and an HMAC of both keyed on ADMIN_TOKEN (the same secret, and
// the same crypto.timingSafeEqual-based comparison primitive, already used
// for the Razorpay webhook signature) — verifying one needs nothing but the
// secret itself. `purpose` scopes what the token is FOR ("admin" session
// cookies vs "reset" password-reset links) into the signed message, so a
// session cookie can never be replayed as a reset token or vice versa even
// though both are the same shape. Carries the email (base64url-encoded,
// since it can't safely contain the "." separator unescaped) so a request
// can know WHO it's for, not just THAT it's valid. Reused rather than
// resigned per use, so — like the session cookie — a reset link stays
// valid for its whole window even if used more than once; acceptable for
// this app's small, named admin list.
function signToken(secret, purpose, email, ttlMs, now) {
  const expiresAt = now() + ttlMs;
  const emailPart = Buffer.from(String(email)).toString("base64url");
  return `${emailPart}.${expiresAt}.${hmac(secret, `${purpose}:${emailPart}:${expiresAt}`)}`;
}

// Returns the email the token was signed for, or null if it's missing,
// expired, tampered with, or signed for a different purpose.
function verifyToken(value, secret, purpose, now) {
  if (typeof value !== "string") return null;
  const [emailPart, expiresAtStr, sig] = value.split(".");
  const expiresAt = Number(expiresAtStr);
  if (!emailPart || !expiresAtStr || !sig || !Number.isFinite(expiresAt)) return null;
  if (now() > expiresAt) return null;
  const expected = Buffer.from(hmac(secret, `${purpose}:${emailPart}:${expiresAt}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    return Buffer.from(emailPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function signAdminCookie(secret, email, { sessionMs = DEFAULT_SESSION_MS, now = Date.now } = {}) {
  return signToken(secret, "admin", email, sessionMs, now);
}

export function verifyAdminCookie(value, secret, { now = Date.now } = {}) {
  return verifyToken(value, secret, "admin", now);
}

// A password-reset link's proof: knowing this token IS proof of owning that
// admin's inbox (it only ever reaches them via an email sent to their own
// address — see POST /api/admin/request-reset), which is why
// adminUsersRepo.setPassword (unlike setInitialPassword) is allowed to
// overwrite an EXISTING password. ADMIN_TOKEN alone is deliberately not
// enough for that — see setInitialPassword's own comment.
export function signResetToken(secret, email, { now = Date.now } = {}) {
  return signToken(secret, "reset", email, RESET_TOKEN_MS, now);
}

export function verifyResetToken(value, secret, { now = Date.now } = {}) {
  return verifyToken(value, secret, "reset", now);
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

export function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Accepts EITHER a valid signed admin cookie (the normal per-person login)
// OR the original `Authorization: Bearer <ADMIN_TOKEN>` header (so any
// existing curl usage of /api/admin/discounts keeps working unchanged, and
// ADMIN_TOKEN itself still doubles as the one-time proof needed to claim a
// new admin account — see POST /api/admin/setup-password). 404s rather than
// 401s when ADMIN_TOKEN itself isn't configured — same "this endpoint
// doesn't exist at all" behavior the original discounts endpoint had.
// Sets `req.adminEmail` to the logged-in person's email, or `null` for a
// bare Bearer-token request (no specific person attached to it).
export function requireAdmin(adminToken) {
  return (req, res, next) => {
    if (!adminToken) return res.status(404).json({ error: "Not found." });
    const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (bearer && timingSafeEqualStrings(bearer, adminToken)) {
      req.adminEmail = null;
      return next();
    }
    const cookie = readCookie(req, ADMIN_COOKIE);
    const email = cookie ? verifyAdminCookie(cookie, adminToken) : null;
    if (email) {
      req.adminEmail = email;
      return next();
    }
    return res.status(401).json({ error: "Unauthorized." });
  };
}
