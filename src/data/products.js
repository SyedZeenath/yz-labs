// Photos are NOT listed here — each product's `imageFolder` names its
// subfolder under public/products/, and that folder is read straight off
// disk (see /api/product-images in server/index.js and src/store/
// products.jsx, which merges that scan into these records at runtime).
// Drop an image into a product's folder, or delete one, and it shows up or
// disappears on the site with no code change. A file literally named
// `hero.*` is the catalog/hero shot (shot on pure black, so it reads as a
// clean cutout with nothing but a drop-shadow); every other image in the
// folder becomes the detail-popup gallery, sorted by filename.
//
// `imageFolder` is separate from `id` on purpose — the folder names
// (round/step/corner) predate the longer product ids (round-planter/etc.)
// and renaming folders on disk isn't something this file should force.

// Any product added below without a real `price` (missing, 0, or negative)
// silently defaults to ₹500 instead of being sold at ₹0 — see the
// normalization at the bottom of this file. That default only exists so a
// future oversight fails safe (a plausible placeholder price) instead of
// failing the way this one already did once (a real product stuck at ₹0,
// which Razorpay just rejects outright at checkout). Still set a real price
// for every product before it ships — 500 is a stand-in, not a decision.
const DEFAULT_PRICE = 500;

// The site's full named color palette — shared between every product's
// color picker and the Materials & Fit section, so a swatch always means
// the same hex wherever it appears. Reference a color by its key from a
// product's `colors` list below.
export const COLORWAYS = {
  black: { name: "Black", hex: "#2B2C31" },
  peach: { name: "Peach", hex: "#E8A97C" },
  ivory: { name: "Ivory", hex: "#E9E2D0" },
  walnut: { name: "Walnut", hex: "#5C4030" },
  "metallic-blue": { name: "Metallic Blue", hex: "#4F7196" },
};

// Each entry is { id: <COLORWAYS key>, priceDelta }. priceDelta is added to
// the product's base price when that color is selected — 0 for every color
// right now (no color costs more than another yet), but the mechanism is
// live: raise a color's priceDelta and the popup, cart, and the server's
// own order pricing all pick it up automatically.
const RAW_PRODUCTS = [
  {
    id: "round-planter",
    imageFolder: "round",
    name: "Round Propagation Planter",
    category: "Planters",
    tagline: "Spiral-textured base with twin test-tube vases",
    material: "PLA",
    colors: [
      { id: "black", priceDelta: 0 },
      { id: "walnut", priceDelta: 0 },
    ],
    dims: "90 × 90 × 95 mm",
    weight: "134 g",
    price: 1070,
    status: "In stock",
    batch: "B-009",
  },
  {
    id: "step-planter",
    imageFolder: "step",
    name: "Step Propagation Planter",
    category: "Planters",
    tagline: "Stepped riser + hex tower for pens, vials & succulents",
    material: "PLA",
    colors: [
      { id: "peach", priceDelta: 0 },
      { id: "walnut", priceDelta: 0 },
    ],
    dims: "220 × 110 × 90 mm",
    weight: "212 g",
    price: 2100,
    status: "Made to order",
    batch: "B-021",
  },
  {
    id: "corner-planter",
    imageFolder: "corner",
    name: "Corner Wall Planter",
    category: "Planters",
    tagline: "Twin-tube propagation planter, built to sit flush in a corner",
    material: "PLA",
    colors: [{ id: "peach", priceDelta: 0 }],
    dims: "TBC",
    weight: "TBC",
    price: 1500,
    status: "Made to order",
    batch: "B-026",
  },
];

function resolveColors(colors) {
  return colors.map(({ id, priceDelta = 0 }) => ({ id, priceDelta, ...COLORWAYS[id] }));
}

export const PRODUCTS = RAW_PRODUCTS.map((p) => {
  const colors = resolveColors(p.colors);
  const [defaultColor] = colors;
  return {
    ...p,
    price: p.price > 0 ? p.price : DEFAULT_PRICE,
    colors,
    // Kept for anything that still wants a single flat colorway/colorHex
    // (the Hero spec panel, catalog thumbnails) — always the first/default
    // color in the list above.
    colorway: defaultColor.name,
    colorHex: defaultColor.hex,
  };
});

export const CATEGORIES = ["All", ...new Set(PRODUCTS.map((p) => p.category))];

// Server-side price resolution for a (productId, colorId) pair — the only
// place that's allowed to decide what something costs. `colorId` is
// optional; an unknown or omitted one falls back to the product's default
// color rather than erroring, but the *price* always comes from this
// lookup, never from anything the client sends.
export function resolveProductPrice(productId, colorId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return null;
  const color = product.colors.find((c) => c.id === colorId) || product.colors[0];
  return { price: product.price + (color?.priceDelta || 0), color };
}
