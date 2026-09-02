import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export default function ProductGallery({ images, name }) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState({});

  const valid = images.filter((_src, i) => !failed[i]);
  const activeSrc = images[active] && !failed[active] ? images[active] : valid[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1",
          borderRadius: 12,
          overflow: "hidden",
          background: "var(--bg)",
        }}
      >
        <AnimatePresence mode="wait">
          {activeSrc && (
            <motion.img
              key={activeSrc}
              src={activeSrc}
              alt={`${name}, view ${active + 1}`}
              onError={() => setFailed((f) => ({ ...f, [active]: true }))}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
        </AnimatePresence>
      </div>

      {images.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {images.map((src, i) =>
            failed[i] ? null : (
              <button
                key={src + i}
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${name}`}
                aria-current={active === i}
                style={{
                  width: 56,
                  height: 56,
                  padding: 0,
                  cursor: "pointer",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: active === i ? "2px solid var(--accent)" : "1px solid var(--border-strong)",
                  opacity: active === i ? 1 : 0.6,
                  transition: "opacity 150ms ease, border-color 150ms ease",
                  flexShrink: 0,
                }}
              >
                <img
                  src={src}
                  alt=""
                  onError={() => setFailed((f) => ({ ...f, [i]: true }))}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
