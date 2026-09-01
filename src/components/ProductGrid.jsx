import { useState } from "react";
import { motion } from "motion/react";
import { PRODUCTS, CATEGORIES } from "../data/products.js";
import ProductCard from "./ProductCard.jsx";
import ProductModal from "./ProductModal.jsx";

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const OFFSETS = [0, 64, 28];

export default function ProductGrid() {
  const [active, setActive] = useState("All");
  const [selected, setSelected] = useState(null);
  const filtered = active === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.category === active);

  return (
    <section id="catalog" className="section-frame" style={{ padding: "120px 0 100px" }}>
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 24,
            marginBottom: 64,
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              02 / Catalog
            </div>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 46px)", maxWidth: 560 }}>
              Current run.
            </h2>
          </div>

          <div className="mono" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
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
        </div>

        <motion.div
          key={active}
          variants={gridVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
          className="product-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            columnGap: 40,
            rowGap: 88,
          }}
        >
          {filtered.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              offset={OFFSETS[i % OFFSETS.length]}
              onOpen={() => setSelected(product)}
            />
          ))}
        </motion.div>
      </div>

      <ProductModal product={selected} onClose={() => setSelected(null)} />

      <style>{`
        @media (max-width: 900px) {
          .product-grid { grid-template-columns: repeat(2, 1fr) !important; row-gap: 64px !important; }
        }
        @media (max-width: 560px) {
          .product-grid { grid-template-columns: 1fr !important; }
          .product-grid > * { margin-top: 0 !important; }
        }
      `}</style>
    </section>
  );
}
