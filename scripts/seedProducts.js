// One-time, idempotent seed: inserts the old static catalog (src/data/
// products.js's RAW_PRODUCTS, via its normalized PRODUCTS export) into the
// database. Safe to re-run — existing rows (matched by id) are left alone,
// so it never clobbers an edit made through the admin panel afterwards.
//
// Usage:
//   node scripts/seedProducts.js
// Needs DATABASE_URL set (.env is loaded automatically, same as the server).
import "dotenv/config";
import { PRODUCTS } from "../src/data/products.js";
import { query, getPool } from "../server/db/pool.js";

async function main() {
  let inserted = 0;
  let skipped = 0;
  for (const p of PRODUCTS) {
    // PRODUCTS is already normalized (DEFAULT_PRICE fallback applied, colors
    // resolved to full {id,name,hex,priceDelta} objects) — store back only
    // the raw {id,priceDelta} shape the database/admin panel actually edits,
    // same as the original RAW_PRODUCTS entries.
    const colors = p.colors.map((c) => ({ id: c.id, priceDelta: c.priceDelta }));
    const { rowCount } = await query(
      `INSERT INTO products (id, image_folder, name, category, tagline, material, colors, dims, weight, price, status, batch)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [p.id, p.imageFolder, p.name, p.category, p.tagline, p.material, JSON.stringify(colors), p.dims, p.weight, p.price, p.status, p.batch]
    );
    if (rowCount > 0) {
      inserted++;
      console.log(`  + ${p.id}`);
    } else {
      skipped++;
      console.log(`  = ${p.id} (already exists, left as-is)`);
    }
  }
  console.log(`\nSeed complete: ${inserted} inserted, ${skipped} already present.`);
  await getPool().end();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
