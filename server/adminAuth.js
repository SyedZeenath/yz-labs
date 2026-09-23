import crypto from "node:crypto";
import { signToken, verifyToken, readCookie } from "./authTokens.js";

export const ADMIN_COOKIE = "yz_admin";
const DEFAULT_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours
const RESET_TOKEN_MS = 30 * 60 * 1000; // 30 minutes

// Stateless tokens (no server-side session store) keyed on ADMIN_TOKEN —
// see server/authTokens.js for the shared signing/verifying mechanism
// (also used by server/customerAuth.js, with its own separate secret).
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
