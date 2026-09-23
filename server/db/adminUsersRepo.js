import { query } from "./pool.js";

// Emails are matched case-insensitively but stored/looked-up lowercased —
// "Store@x.com" and "store@x.com" are the same admin account.
const normalize = (email) => String(email || "").trim().toLowerCase();

function toModel(row) {
  if (!row) return null;
  return {
    email: row.email,
    passwordHash: row.password_hash,
    needsSetup: row.password_hash == null,
    createdAt: row.created_at,
    passwordSetAt: row.password_set_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getByEmail(email) {
  const { rows } = await query(`SELECT * FROM admin_users WHERE email = $1`, [normalize(email)]);
  return toModel(rows[0]);
}

// Only succeeds while the account has no password yet — claiming an
// already-set-up account is never allowed through this path (that would
// let anyone who learns ADMIN_TOKEN later hijack an existing admin's
// account; they can only claim ones still sitting unclaimed).
export async function setInitialPassword(email, passwordHash) {
  const { rows } = await query(
    `UPDATE admin_users SET password_hash = $2, password_set_at = now() WHERE email = $1 AND password_hash IS NULL RETURNING *`,
    [normalize(email), passwordHash]
  );
  return toModel(rows[0]);
}

// Unlike setInitialPassword, this CAN overwrite an account that already has
// one — safe here because the only way to reach this is already having
// proved ownership of that admin's inbox (a signed reset token, see
// server/adminAuth.js's signResetToken/verifyResetToken and POST
// /api/admin/reset-password), not just knowing ADMIN_TOKEN.
export async function setPassword(email, passwordHash) {
  const { rows } = await query(
    `UPDATE admin_users SET password_hash = $2, password_set_at = now() WHERE email = $1 RETURNING *`,
    [normalize(email), passwordHash]
  );
  return toModel(rows[0]);
}

export async function touchLogin(email) {
  await query(`UPDATE admin_users SET last_login_at = now() WHERE email = $1`, [normalize(email)]);
}
