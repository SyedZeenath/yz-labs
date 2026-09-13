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
          // The selected chip gets the shared glass-control treatment
          // (Phase 4) instead of a flat inverted fill — still clearly the
          // active one (accent border, brighter text), just consistent
          // with the rest of the site's glass surfaces rather than a
          // one-off solid-white style unique to this control.
          className={active === cat ? "glass-control" : undefined}
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "9px 14px",
            border: active === cat ? undefined : "1px solid var(--border-strong)",
            background: active === cat ? undefined : "transparent",
            color: active === cat ? "var(--fg)" : "var(--fg-dim)",
            cursor: "pointer",
            transition: "color 150ms ease",
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
