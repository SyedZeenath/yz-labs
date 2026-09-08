// `heroImage` is the photo used for the floating card thumbnail in the grid.
// `heroCutout` (optional) is its background-removed version, generated via
// scripts/remove-bg.mjs into /public/products/cutout/ — when present it's
// preferred over `heroImage` for that floating, no-background look.
// `images` is the full gallery shown in the product detail popup (plain
// photos, background intact, however many you want).

// Any product added below without a real `price` (missing, 0, or negative)
// silently defaults to ₹500 instead of being sold at ₹0 — see the
// normalization at the bottom of this file. That default only exists so a
// future oversight fails safe (a plausible placeholder price) instead of
// failing the way this one already did once (a real product stuck at ₹0,
// which Razorpay just rejects outright at checkout). Still set a real price
// for every product before it ships — 500 is a stand-in, not a decision.
const DEFAULT_PRICE = 500;

const RAW_PRODUCTS = [
  {
    id: "round-planter",
    name: "Round Propagation Planter",
    category: "Planters",
    tagline: "Spiral-textured base with twin test-tube vases",
    material: "PLA",
    colorway: "Graphite",
    colorHex: "#2B2C31",
    dims: "90 × 90 × 95 mm",
    weight: "134 g",
    price: 1070,
    status: "In stock",
    batch: "B-009",
    heroImage: "/products/round/3.png",
    heroCutout: "/products/cutout/round/3.png",
    images: ["/products/round/3.png", "/products/round/1.png", "/products/round/2.png"],
  },
  {
    id: "step-planter",
    name: "Step Propagation Planter",
    category: "Planters",
    tagline: "Stepped riser + hex tower for pens, vials & succulents",
    material: "PLA",
    colorway: "Terracotta / Clay",
    colorHex: "#C97452",
    dims: "220 × 110 × 90 mm",
    weight: "212 g",
    price: 2100,
    status: "Made to order",
    batch: "B-021",
    heroImage: "/products/step/1.png",
    heroCutout: "/products/cutout/step/1.png",
    images: ["/products/step/1.png", "/products/step/2.png"],
  },
  {
    id: "corner-planter",
    name: "Corner Wall Planter",
    category: "Planters",
    tagline: "Twin-tube propagation planter, built to sit flush in a corner",
    material: "PLA",
    colorway: "Bone",
    colorHex: "#D8D3C6",
    dims: "TBC",
    weight: "TBC",
    price: 1500,
    status: "Made to order",
    batch: "B-026",
    heroImage: "/products/corner/1.png",
    heroCutout: null,
    images: ["/products/corner/1.png", "/products/corner/2.png"],
  },
];

export const PRODUCTS = RAW_PRODUCTS.map((p) => ({
  ...p,
  price: p.price > 0 ? p.price : DEFAULT_PRICE,
}));

export const CATEGORIES = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
