// Whole rupees plain, fractional ones to 2 places: 1070 -> "1070", 802.5 -> "802.50".
// Discounts (25% of an odd price) produce paise, so a bare `₹{n}` would show
// things like 802.5 or 267.49999.
export function formatRupees(n) {
  const v = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
