import pg from "pg";

const { Pool } = pg;

// Lazy singleton: the pool is only created on first real use, not at import
// time, so a server that never touches the database (e.g. running the
// existing test suite, which stays entirely DB-free) never even tries to
// read DATABASE_URL.
let pool = null;

function buildPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — add it to .env (see README) before anything that touches the database can work."
    );
  }
  return new Pool({
    connectionString,
    // Neon (and most managed Postgres) terminate TLS with a cert chain that
    // Node's default trust store doesn't have; this is the standard relaxed
    // setting for that case. The connection is still encrypted — this only
    // skips verifying the certificate chain, not skipping TLS itself.
    ssl: { rejectUnauthorized: false },
  });
}

export function getPool() {
  if (!pool) pool = buildPool();
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}
