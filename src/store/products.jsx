import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { PRODUCTS as BASE_PRODUCTS, CATEGORIES } from "../data/products.js";

const ProductsContext = createContext(null);

// Product photos aren't hardcoded — GET /api/product-images reads each
// product's public/products/<imageFolder>/ straight off disk on every
// request, so adding or removing a file there shows up on the next page
// load automatically. This fetches that scan once and merges it into the
// static product records (name/price/colors/etc., which still live in
// data/products.js) by matching each product's `imageFolder`.
export function ProductsProvider({ children }) {
  const [imagesByFolder, setImagesByFolder] = useState({});

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
      BASE_PRODUCTS.map((p) => {
        const found = imagesByFolder[p.imageFolder];
        return {
          ...p,
          heroImage: found?.heroImage ?? null,
          images: found?.images ?? [],
        };
      }),
    [imagesByFolder]
  );

  const value = useMemo(() => ({ products, categories: CATEGORIES }), [products]);

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
