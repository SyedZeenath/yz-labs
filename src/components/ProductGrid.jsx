import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { useProducts, useCategories } from "../store/products.jsx";
import ProductCard from "./ProductCard.jsx";
import ProductScatter from "./ProductScatter.jsx";
import ProductModal from "./ProductModal.jsx";
import RevealText from "./RevealText.jsx";
import CategoryFilter from "./CategoryFilter.jsx";

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
  const products = useProducts();
  const categories = useCategories();
  const [active, setActive] = useState("All");
  // Store just the id, not the product object — the image scan can still
  // be resolving when a product is opened, and re-deriving from the live
  // `products` list on every render means the modal picks up its photos
  // the moment they arrive instead of being stuck with whatever (possibly
  // imageless) snapshot existed at click time.
  const [selectedId, setSelectedId] = useState(null);
  const selected = products.find((p) => p.id === selectedId) || null;
  const isMobile = useIsMobile();
  const filtered = active === "All" ? products : products.filter((p) => p.category === active);

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

          <CategoryFilter categories={categories} active={active} onChange={setActive} />
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
              <ProductCard key={product.id} product={product} onOpen={() => setSelectedId(product.id)} />
            ))}
          </motion.div>
        ) : (
          <ProductScatter key={active} products={filtered} onOpen={(product) => setSelectedId(product.id)} />
        )}

        <div style={{ display: "flex", justifyContent: "center", marginTop: 56 }}>
          <Link to="/catalog" className="btn btn-ghost">
            View all products →
          </Link>
        </div>
      </div>

      <ProductModal product={selected} onClose={() => setSelectedId(null)} />
    </section>
  );
}
