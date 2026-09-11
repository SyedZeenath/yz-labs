import { useState } from "react";
import { motion } from "motion/react";
import Nav from "../components/Nav.jsx";
import CTAFooter from "../components/CTAFooter.jsx";
import CategoryFilter from "../components/CategoryFilter.jsx";
import ProductCard from "../components/ProductCard.jsx";
import ProductModal from "../components/ProductModal.jsx";
import RevealText from "../components/RevealText.jsx";
import { useProducts, useCategories } from "../store/products.jsx";

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

// The homepage catalog section is a curated teaser — a handful of tiles on
// an orbit gallery tuned to look right at a small count. That stops
// scaling once there are more than a dozen or so products: an orbit that
// big gets crowded, and there's no way to just scan everything at once.
// This page is the answer — a plain, dense, filterable grid with no upper
// bound on how many products it can hold.
export default function CatalogPage() {
  const products = useProducts();
  const categories = useCategories();
  const [active, setActive] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const selected = products.find((p) => p.id === selectedId) || null;
  const filtered = active === "All" ? products : products.filter((p) => p.category === active);

  return (
    <>
      <Nav />
      <main>
        <section className="section-frame" style={{ padding: "150px 0 110px" }}>
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
                  All products
                </div>
                <RevealText as="h1" style={{ fontSize: "clamp(30px, 4vw, 46px)", maxWidth: 560 }} parts={["The full catalog."]} />
              </div>

              <CategoryFilter categories={categories} active={active} onChange={setActive} />
            </div>

            {filtered.length === 0 ? (
              <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>
                Nothing in this category yet.
              </p>
            ) : (
              <motion.div
                key={active}
                variants={gridVariants}
                initial="hidden"
                animate="show"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  columnGap: 32,
                  rowGap: 64,
                }}
              >
                {filtered.map((product) => (
                  <ProductCard key={product.id} product={product} onOpen={() => setSelectedId(product.id)} />
                ))}
              </motion.div>
            )}
          </div>
        </section>

        <CTAFooter />
      </main>

      <ProductModal product={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}
