import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ProductsContext = createContext(null);

// Product RECORDS come from the database via GET /api/products (see
// server/db/productsCache.js) — no longer a static import, so this now
// genuinely starts empty until that request resolves; `loading` lets
// consumers (CatalogPage, ProductGrid) tell "still loading" apart from "this
// category really has nothing in it". Product PHOTOS are unchanged: GET
// /api/product-images still scans public/products/<imageFolder>/ straight
// off disk on every request, merged in here exactly as before.
export function ProductsProvider({ children }) {
  const [baseProducts, setBaseProducts] = useState([]);
  const [imagesByFolder, setImagesByFolder] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setBaseProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // Offline / API not reachable — leave the list empty rather than
        // crashing the page; `loading` still clears below so an empty
        // catalog reads as "nothing here" rather than spinning forever.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/product-images")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (!cancelled) setImagesByFolder(data);
      })
      .catch(() => {
        // Offline / API not reachable — products still render, just
        // without photos, rather than crashing the page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const products = useMemo(
    () =>
      baseProducts.map((p) => {
        const found = imagesByFolder[p.imageFolder];
        return {
          ...p,
          heroImage: found?.heroImage ?? null,
          images: found?.images ?? [],
        };
      }),
    [baseProducts, imagesByFolder]
  );

  // Derived from whatever's actually in the live catalog, not a fixed list —
  // an admin adding/removing a product's only category shows up here with no
  // separate step.
  const categories = useMemo(() => ["All", ...new Set(products.map((p) => p.category))], [products]);

  const value = useMemo(() => ({ products, categories, loading }), [products, categories, loading]);

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

function useProductsContext() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts/useCategories must be used within ProductsProvider");
  return ctx;
}

export function useProducts() {
  return useProductsContext().products;
}

export function useCategories() {
  return useProductsContext().categories;
}

// True until the initial GET /api/products request settles (success, empty,
// or failure) — lets a "Nothing in this category yet." empty state tell
// itself apart from "still loading, nothing to show yet".
export function useProductsLoading() {
  return useProductsContext().loading;
}
