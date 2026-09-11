// Shared category pill row — used by the homepage's curated catalog teaser
// and the full /catalog page, so both stay visually identical without
// duplicating the same markup twice.
export default function CategoryFilter({ categories, active, onChange }) {
  return (
    <div className="mono" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "9px 14px",
            border: "1px solid var(--border-strong)",
            background: active === cat ? "var(--fg)" : "transparent",
            color: active === cat ? "var(--bg)" : "var(--fg-dim)",
            cursor: "pointer",
            transition: "background 150ms ease, color 150ms ease",
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
