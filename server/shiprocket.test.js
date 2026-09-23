// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { createShiprocketClient } from "./shiprocket.js";

const PRODUCTS = [
  { id: "round-planter", name: "Round Propagation Planter", weightG: 134 },
  { id: "step-planter", name: "Step Propagation Planter", weightG: 212 },
  { id: "no-weight-item", name: "Mystery Item", weightG: 0 },
];

function fakeOrder(overrides = {}) {
  return {
    id: "order_ABC123",
    amount: 214000, // paise
    created_at: 1_700_000_000,
    notes: {
      items: "round-planter|black|2|1070",
      ship_name: "Asha Rao",
      ship_email: "asha@example.com",
      ship_phone: "+919876543210",
      ship_address: "12 Palm Street",
      ship_city: "Bengaluru",
      ship_state: "Karnataka",
      ship_pincode: "560001",
    },
    ...overrides,
  };
}

function fakeFetch({ onAuth, onOrder }) {
  let authCalls = 0;
  let orderCalls = 0;
  const fn = async (url, opts) => {
    if (url.includes("/auth/login")) {
      authCalls++;
      return onAuth ? onAuth(opts) : { ok: true, json: async () => ({ token: "tok123" }) };
    }
    if (url.includes("/orders/create/adhoc")) {
      orderCalls++;
      return onOrder ? onOrder(opts) : { ok: true, json: async () => ({ order_id: 999, status: "NEW" }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { fn, calls: () => ({ authCalls, orderCalls }) };
}

test("returns null (silently disabled) when email, password or pickup location is missing", () => {
  assert.equal(createShiprocketClient({ email: "", password: "p", pickupLocation: "Loc" }), null);
  assert.equal(createShiprocketClient({ email: "e", password: "", pickupLocation: "Loc" }), null);
  assert.equal(createShiprocketClient({ email: "e", password: "p", pickupLocation: "" }), null);
});

test("pushOrder logs in, then posts a correctly-shaped order body", async () => {
  let capturedBody;
  const { fn } = fakeFetch({
    onOrder: (opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ order_id: 999 }) };
    },
  });
  const client = createShiprocketClient({ email: "api@shop.com", password: "pw", pickupLocation: "Store_Address", fetchImpl: fn });

  const result = await client.pushOrder(fakeOrder(), { products: PRODUCTS });

  assert.equal(result.shiprocketOrderId, "999");
  assert.equal(capturedBody.order_id, "order_ABC123");
  assert.equal(capturedBody.pickup_location, "Store_Address");
  assert.equal(capturedBody.billing_customer_name, "Asha");
  assert.equal(capturedBody.billing_last_name, "Rao");
  assert.equal(capturedBody.billing_phone, "9876543210");
  assert.equal(capturedBody.shipping_is_billing, true);
  assert.equal(capturedBody.payment_method, "Prepaid");
  assert.equal(capturedBody.sub_total, 2140); // amount in paise -> rupees
  assert.deepEqual(capturedBody.order_items, [{ name: "Round Propagation Planter", sku: "round-planter", units: 2, selling_price: 1070 }]);
  // 2 units x 134g each = 268g = 0.268kg
  assert.equal(capturedBody.weight, 0.27);
});

test("a product with no weight_g on record falls back rather than zeroing the whole order's weight", async () => {
  let capturedBody;
  const { fn } = fakeFetch({
    onOrder: (opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ order_id: 1 }) };
    },
  });
  const client = createShiprocketClient({ email: "e", password: "p", pickupLocation: "Loc", fetchImpl: fn });

  await client.pushOrder(fakeOrder({ notes: { ...fakeOrder().notes, items: "no-weight-item|black|1|500" } }), { products: PRODUCTS });

  assert.ok(capturedBody.weight > 0);
});

test("the auth token is fetched once and reused across two pushOrder calls", async () => {
  const { fn, calls } = fakeFetch({});
  const client = createShiprocketClient({ email: "e", password: "p", pickupLocation: "Loc", fetchImpl: fn });

  await client.pushOrder(fakeOrder(), { products: PRODUCTS });
  await client.pushOrder(fakeOrder({ id: "order_XYZ" }), { products: PRODUCTS });

  assert.equal(calls().authCalls, 1);
  assert.equal(calls().orderCalls, 2);
});

test("a stale token (past its ~10 day validity) is refreshed before the next push", async () => {
  let t0 = 0;
  const { fn, calls } = fakeFetch({});
  const client = createShiprocketClient({ email: "e", password: "p", pickupLocation: "Loc", fetchImpl: fn, now: () => t0 });

  await client.pushOrder(fakeOrder(), { products: PRODUCTS });
  t0 = 10 * 24 * 60 * 60 * 1000; // 10 days later
  await client.pushOrder(fakeOrder({ id: "order_XYZ" }), { products: PRODUCTS });

  assert.equal(calls().authCalls, 2);
});

test("a failed login rejects with a clear message", async () => {
  const { fn } = fakeFetch({ onAuth: () => ({ ok: false, status: 401, json: async () => ({ message: "Invalid Email or Password" }) }) });
  const client = createShiprocketClient({ email: "e", password: "wrong", pickupLocation: "Loc", fetchImpl: fn });

  await assert.rejects(() => client.pushOrder(fakeOrder(), { products: PRODUCTS }), /Invalid Email or Password/);
});

test("a failed order-create rejects with a clear message", async () => {
  const { fn } = fakeFetch({ onOrder: () => ({ ok: false, status: 422, json: async () => ({ message: "order_id already exists" }) }) });
  const client = createShiprocketClient({ email: "e", password: "p", pickupLocation: "Loc", fetchImpl: fn });

  await assert.rejects(() => client.pushOrder(fakeOrder(), { products: PRODUCTS }), /order_id already exists/);
});

test("an order with no parseable line items rejects rather than pushing an empty shipment", async () => {
  const { fn } = fakeFetch({});
  const client = createShiprocketClient({ email: "e", password: "p", pickupLocation: "Loc", fetchImpl: fn });

  await assert.rejects(() => client.pushOrder(fakeOrder({ notes: { ...fakeOrder().notes, items: "" } }), { products: PRODUCTS }), /No line items/);
});
