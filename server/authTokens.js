import crypto from "node:crypto";

// Shared by server/adminAuth.js and server/customerAuth.js — the same
// stateless, purpose-scoped signed-token mechanism (no server-side session
// store) backs admin session cookies, admin password-reset links, customer
// session cookies, and customer sign-in ("magic link") tokens. Each caller
// brings its OWN secret (ADMIN_TOKEN vs SESSION_SECRET) and its own
// `purpose` string, so a token from one system can never be replayed as a
// token from another, even if (hypothetically) the same secret were ever
// reused — the purpose is baked into what gets signed, not just carried
// alongside it.
function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function signToken(secret, purpose, email, ttlMs, now = Date.now) {
  const expiresAt = now() + ttlMs;
  const emailPart = Buffer.from(String(email)).toString("base64url");
  return `${emailPart}.${expiresAt}.${hmac(secret, `${purpose}:${emailPart}:${expiresAt}`)}`;
}

// Returns the email the token was signed for, or null if it's missing,
// expired, tampered with, or signed for a different purpose/secret.
export function verifyToken(value, secret, purpose, now = Date.now) {
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

// No `cookie-parser` dependency — this app only ever needs to read one
// cookie of its own per request (yz_admin or yz_customer), so a full
// parser is more than it needs.
export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}
