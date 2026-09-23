// Run with: npm test
// Structurally mirrors orderLedger.js's own freshness tests in
// discounts.test.js — this cache is deliberately the same shape, so the same
// test cases apply directly. No real database involved: `fetchAllProducts`
// is a plain injected function.
import test from "node:test";
import assert from "node:assert/strict";
import { createProductsCache } from "./productsCache.js";

const ONE_PRODUCT = [{ id: "round-planter", name: "Round Propagation Planter", price: 1070 }];

test("ensureFresh loads once, getAll/getById reflect it, and a fresh cache isn't reloaded", async () => {
  let calls = 0;
  const cache = createProductsCache({
    fetchAllProducts: async () => {
      calls++;
      return ONE_PRODUCT;
    },
  });
  assert.equal(cache.isLoaded(), false);
  await cache.ensureFresh();
  assert.equal(calls, 1);
  assert.deepEqual(cache.getAll(), ONE_PRODUCT);
  assert.equal(cache.getById("round-planter")?.name, "Round Propagation Planter");
  assert.equal(cache.getById("nope"), null);

  await cache.ensureFresh();
  assert.equal(calls, 1, "still fresh — no second fetch");
});

test("simultaneous refreshes share a single load", async () => {
  let calls = 0;
  const cache = createProductsCache({
    fetchAllProducts: async () => {
      calls++;
      return ONE_PRODUCT;
    },
  });
  await Promise.all([cache.ensureFresh(), cache.ensureFresh(), cache.ensureFresh()]);
  assert.equal(calls, 1);
});

test("if the catalog can't be loaded and it's never loaded before, ensureFresh throws", async () => {
  const cache = createProductsCache({
    fetchAllProducts: async () => {
      throw new Error("db down");
    },
  });
  assert.equal(cache.isLoaded(), false);
  await assert.rejects(() => cache.ensureFresh(), /db down/);
});

test("if a refresh fails but there's earlier data, the stale list is kept in service", async () => {
  let fail = false;
  let t = 0;
  const cache = createProductsCache({
    now: () => t,
    ttlMs: 10,
    fetchAllProducts: async () => {
      if (fail) throw new Error("blip");
      return ONE_PRODUCT;
    },
  });
  await cache.ensureFresh();
  fail = true;
  t = 1000; // past the TTL, so the next call actually attempts a refresh
  await cache.ensureFresh(); // does not throw — falls back to the stale list
  assert.deepEqual(cache.getAll(), ONE_PRODUCT);
});

test("invalidate() clears freshness (forcing the next ensureFresh to reload) but keeps serving the last-known list until it does", async () => {
  let calls = 0;
  const cache = createProductsCache({
    fetchAllProducts: async () => {
      calls++;
      return ONE_PRODUCT;
    },
  });
  await cache.ensureFresh();
  assert.equal(calls, 1);
  cache.invalidate();
  assert.deepEqual(cache.getAll(), ONE_PRODUCT, "stale data still served right after invalidate()");
  await cache.ensureFresh();
  assert.equal(calls, 2, "invalidate() forced a real reload");
});
