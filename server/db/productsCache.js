// Freshness cache in front of the products table — the same shape as
// server/orderLedger.js's own cache, deliberately: `pricing.js` needs a
// products list on every /api/create-order request, and that must not mean
// a database round-trip per checkout. `fetchAllProducts` is injected so this
// stays testable without a real database (see productsCache.test.js).
export function createProductsCache({ fetchAllProducts, now = Date.now, ttlMs = 30_000 }) {
  let products = [];
  let byId = new Map();
  let hydratedAt = 0;
  let loaded = false; // has ANY load from the database ever succeeded?
  let hydrating = null;

  function index(list) {
    products = list;
    byId = new Map(list.map((p) => [p.id, p]));
  }

  // Concurrent callers share one in-flight fetch. Rejects if the database
  // can't be read.
  function hydrate() {
    if (hydrating) return hydrating;
    hydrating = (async () => {
      const list = await fetchAllProducts();
      index(list);
      hydratedAt = now();
      loaded = true;
      return list;
    })().finally(() => {
      hydrating = null;
    });
    return hydrating;
  }

  // Makes sure the cache is fresh enough to price a cart from. If a refresh
  // fails but there's EARLIER data, that stale (but once-real) list is kept
  // in service rather than failing checkout over a momentary database blip;
  // if it has never loaded since boot, the error is thrown — the caller must
  // not price anything against an empty catalog.
  async function ensureFresh(maxAgeMs = ttlMs) {
    if (loaded && now() - hydratedAt <= maxAgeMs) return;
    try {
      await hydrate();
    } catch (err) {
      if (!loaded) throw err;
      console.error("[products-cache] refresh failed, using earlier data:", err?.message || err);
    }
  }

  return {
    ensureFresh,
    hydrate,
    // Only clears the "how fresh is this" timestamp, not the data itself —
    // an admin write calls this then `ensureFresh(0)` so its own next read
    // (and the very next checkout) sees the edit immediately, but a refresh
    // that then fails still leaves the last-known-good list in place rather
    // than an empty one.
    invalidate: () => {
      hydratedAt = 0;
    },
    getAll: () => products,
    getById: (id) => byId.get(id) || null,
    isLoaded: () => loaded,
    hydratedAt: () => hydratedAt,
  };
}
