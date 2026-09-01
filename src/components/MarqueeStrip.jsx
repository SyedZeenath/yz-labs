const ITEMS = [
  "PLA+ & PETG",
  "HAND FINISHED",
  "MADE TO ORDER",
  "LIMITED BATCHES",
  "0.12MM LAYERS",
  "STUDIO RUN — NOT A WAREHOUSE",
];

export default function MarqueeStrip() {
  const track = [...ITEMS, ...ITEMS];

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        className="mono"
        style={{
          display: "flex",
          width: "max-content",
          animation: "marquee 26s linear infinite",
          padding: "16px 0",
          fontSize: 13,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {track.map((t, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", color: "var(--fg-dim)" }}>
            {t}
            <span style={{ color: "var(--accent)", margin: "0 28px" }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
