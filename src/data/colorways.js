// The site's full named color palette — shared between every product's
// color picker and the Materials & Fit section, so a swatch always means
// the same hex wherever it appears. Reference a color by its key from a
// product's `colors` list (see products.js / server/db/productsRepo.js).
//
// Deliberately its own module, separate from product *records*: it's fixed,
// hand-maintained brand data (new filament stock, not a per-product edit),
// so it stays a static app constant even after products themselves move
// into the database — nothing here is admin-editable.
export const COLORWAYS = {
  black: { name: "Black", hex: "#2B2C31" },
  peach: { name: "Peach", hex: "#E8A97C" },
  ivory: { name: "Ivory", hex: "#E9E2D0" },
  walnut: { name: "Walnut", hex: "#5C4030" },
  "metallic-blue": { name: "Metallic Blue", hex: "#4F7196" },
};
