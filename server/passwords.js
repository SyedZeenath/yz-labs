// Password hashing via Node's built-in scrypt — no bcrypt/argon2 dependency
// needed, matching this codebase's no-extra-deps-when-avoidable habit.
// Stored as "<saltHex>:<hashHex>"; scrypt's cost parameters are Node's own
// documented defaults (N=16384, r=8, p=1), the same ones used in Node's own
// password-hashing example.
import crypto from "node:crypto";

const KEYLEN = 64;

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const given = await scrypt(password, salt);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
