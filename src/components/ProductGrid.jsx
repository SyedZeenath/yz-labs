import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { PRODUCTS, CATEGORIES } from "../data/products.js";
import ProductCard from "./ProductCard.jsx";
import ProductScatter from "./ProductScatter.jsx";
import ProductModal from "./ProductModal.jsx";
import RevealText from "./RevealText.jsx";

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const MOBILE_BREAKPOINT = 760;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

export default function ProductGrid() {
  const [active, setActive] = useState("All");
  const [selected, setSelected] = useState(null);
  const isMobile = useIsMobile();
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
            <RevealText as="h2" style={{ fontSize: "clamp(30px, 4vw, 46px)", maxWidth: 560 }} parts={["Current run."]} />
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

        {isMobile ? (
          <motion.div
            key={active}
            variants={gridVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.05 }}
            className="product-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              rowGap: 64,
            }}
          >
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} onOpen={() => setSelected(product)} />
            ))}
          </motion.div>
        ) : (
          <ProductScatter key={active} products={filtered} onOpen={setSelected} />
        )}
      </div>

      <ProductModal product={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
