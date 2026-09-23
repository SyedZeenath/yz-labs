import { query } from "./pool.js";
import { COLORWAYS } from "../../src/data/colorways.js";

// Same fallback the old static catalog used: a product with no real price
// yet (missing, 0, or negative) sells at this placeholder rather than at
// ₹0, which Razorpay rejects outright. Still set a real price for every
// product before it ships.
const DEFAULT_PRICE = 500;

function resolveColors(colors) {
  return (Array.isArray(colors) ? colors : []).map(({ id, priceDelta = 0 }) => ({
    id,
    priceDelta,
    ...COLORWAYS[id],
  }));
}

// Normalizes one database row into exactly the shape the rest of the app
// already expects from the old static PRODUCTS array (same fields, same
// price-fallback and color-resolution rules), so nothing downstream
// (pricing.js, orderEmail.js, the client) needs to know the catalog now
// comes from a database.
function normalize(row) {
  const colors = resolveColors(row.colors);
  const [defaultColor] = colors;
  return {
    id: row.id,
    imageFolder: row.image_folder,
    name: row.name,
    category: row.category,
    tagline: row.tagline,
    material: row.material,
    dims: row.dims,
    weight: row.weight,
    weightG: row.weight_g || 0,
    price: row.price > 0 ? row.price : DEFAULT_PRICE,
    status: row.status,
    batch: row.batch,
    sortOrder: row.sort_order,
    archived: row.archived_at != null,
    colors,
    colorway: defaultColor?.name,
    colorHex: defaultColor?.hex,
  };
}

// The live catalog: every non-archived product, in catalog order. This is
// what the products cache (server/db/productsCache.js) refreshes from — the
// one query the checkout/pricing hot path depends on.
export async function listActive() {
  const { rows } = await query(
    `SELECT * FROM products WHERE archived_at IS NULL ORDER BY sort_order, name`
  );
  return rows.map(normalize);
}

// Everything, including archived products — only for the admin product
// list, never for pricing/catalog display.
export async function listAllForAdmin() {
  const { rows } = await query(`SELECT * FROM products ORDER BY sort_order, name`);
  return rows.map(normalize);
}

export async function insert(data) {
  const { rows } = await query(
    `INSERT INTO products (id, image_folder, name, category, tagline, material, colors, dims, weight, weight_g, price, status, batch, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      data.id,
      data.imageFolder,
      data.name,
      data.category,
      data.tagline || "",
      data.material || "",
      JSON.stringify(data.colors || []),
      data.dims || "",
      data.weight || "",
      data.weightG || 0,
      data.price || 0,
      data.status || "In stock",
      data.batch || "",
      data.sortOrder || 0,
    ]
  );
  return normalize(rows[0]);
}

export async function update(id, data) {
  const { rows } = await query(
    `UPDATE products SET
       image_folder = $2, name = $3, category = $4, tagline = $5, material = $6,
       colors = $7, dims = $8, weight = $9, weight_g = $10, price = $11, status = $12, batch = $13,
       sort_order = $14, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      data.imageFolder,
      data.name,
      data.category,
      data.tagline || "",
      data.material || "",
      JSON.stringify(data.colors || []),
      data.dims || "",
      data.weight || "",
      data.weightG || 0,
      data.price || 0,
      data.status || "In stock",
      data.batch || "",
      data.sortOrder || 0,
    ]
  );
  return rows[0] ? normalize(rows[0]) : null;
}

export async function archive(id) {
  const { rows } = await query(
    `UPDATE products SET archived_at = now(), updated_at = now() WHERE id = $1 AND archived_at IS NULL RETURNING *`,
    [id]
  );
  return rows[0] ? normalize(rows[0]) : null;
}

export async function restore(id) {
  const { rows } = await query(
    `UPDATE products SET archived_at = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ? normalize(rows[0]) : null;
}

// Real deletion, offered alongside archive() rather than instead of it.
// There's no foreign key from orders to products (an order's line items are
// decoded from its own stored note, not looked up live), so this can't
// corrupt an existing order — the one real effect is cosmetic: any order
// email built AFTER this runs (a resend, a webhook retry) falls back to
// showing this product's bare id instead of its name (see
// orderEmail.js's describeItems), because there's no row left to look the
// name up from. Archiving avoids even that; this is for when a product
// genuinely shouldn't exist any more.
export async function hardDelete(id) {
  const { rowCount } = await query(`DELETE FROM products WHERE id = $1`, [id]);
  return rowCount > 0;
}
