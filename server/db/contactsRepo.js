import { query } from "./pool.js";

function normalize(row) {
  return {
    id: row.id,
    source: row.source,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    handledAt: row.handled_at,
    createdAt: row.created_at,
  };
}

// `source` is 'waitlist' or 'contact' (see server/db/schema.sql's CHECK
// constraint). Called best-effort, right after the existing notification
// email — never the other way around, and never something a failure here
// should be allowed to block.
export async function insert({ source, name = null, email, phone = null, message = null }) {
  const { rows } = await query(
    `INSERT INTO contacts (source, name, email, phone, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [source, name, email, phone, message]
  );
  return normalize(rows[0]);
}

// Used by POST /api/waitlist to refuse a repeat signup — checks every
// waitlist row regardless of handled_at (being "handled" is just an admin
// bookkeeping flag, see markHandled below; deleting the row is what
// actually lets that email sign up again).
export async function existsWaitlistEmail(email) {
  const { rows } = await query(
    `SELECT 1 FROM contacts WHERE source = 'waitlist' AND lower(email) = lower($1) LIMIT 1`,
    [email]
  );
  return rows.length > 0;
}

export async function list({ limit = 200, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT * FROM contacts ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map(normalize);
}

export async function markHandled(id) {
  const { rows } = await query(
    `UPDATE contacts SET handled_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ? normalize(rows[0]) : null;
}

export async function remove(id) {
  const { rowCount } = await query(`DELETE FROM contacts WHERE id = $1`, [id]);
  return rowCount > 0;
}
