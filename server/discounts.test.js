// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { DISCOUNTS, lookupDiscount, checkEligibility, normalizeCode, listOffers, describeTerms, looksLikeMultipleCodes, ONE_CODE_PER_ORDER } from "./discounts.js";
import { createLedger, canonicalEmail, customerKeys } from "./orderLedger.js";
import { priceCart } from "./pricing.js";
import { buildCustomerEmail, buildOrderEmail } from "./orderEmail.js";

// Temporarily defines codes for a test, always removing them afterwards.
function withCodes(codes, fn) {
  Object.assign(DISCOUNTS, codes);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(codes)) delete DISCOUNTS[k];
  }
}

const emptyLedger = () => createLedger({ fetchOrdersPage: async () => ({ items: [] }) });
const asha = { email: "asha@example.com", phone: "9876543210", address: "12 MG Road, Near Metro", pincode: "560001" };
const paidOrder = (ledger, id, who, code = null, createdAt = 1000) => {
  ledger.record({ id, status: "created", code, discountPaise: code ? 100 : 0, subtotalPaise: 1000, totalPaise: 900, keys: customerKeys(who), email: who.email, createdAt });
  ledger.markPaid(id, `pay_${id}`);
};

test("FIRSTBUY25 takes exactly 25% off", () => {
  const r = lookupDiscount("FIRSTBUY25", 107000); // Rs 1070
  assert.equal(r.ok, true);
  assert.equal(r.discountPaise, 26750);
  const clock = lookupDiscount("FIRSTBUY25", 1000); // Rs 10 test-priced clock
  assert.equal(clock.discountPaise, 250);
  assert.equal(1000 - clock.discountPaise, 750);
});

test("percent discounts round to the nearest paisa", () => {
  assert.equal(lookupDiscount("FIRSTBUY25", 1001).discountPaise, 250); // 250.25
  assert.equal(lookupDiscount("FIRSTBUY25", 1002).discountPaise, 251); // 250.5 rounds up
});

test("codes are case- and whitespace-insensitive", () => {
  assert.equal(normalizeCode("  firstbuy25 "), "FIRSTBUY25");
  assert.equal(lookupDiscount(" firstbuy25 ", 100000).ok, true);
  assert.equal(lookupDiscount("first buy25", 100000).ok, true);
});

test("unknown, malformed and non-string codes all fail with the same message", () => {
  const msgs = new Set(
    ["NOPE", "", "<script>alert(1)</script>", "constructor", "__proto__", null, undefined, 42, { a: 1 }].map((c) => {
      const r = lookupDiscount(c, 100000);
      assert.equal(r.ok, false);
      return r.error;
    })
  );
  assert.equal(msgs.size, 1, "must not reveal which codes exist");
});

test("switched-off, expired and not-yet-started codes are indistinguishable from unknown ones", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  withCodes(
    {
      OFF10: { type: "percent", value: 10, active: false },
      OLD10: { type: "percent", value: 10, expiresAt: "2026-01-01T00:00:00Z" },
      SOON10: { type: "percent", value: 10, startsAt: "2027-01-01T00:00:00Z" },
      LIVE10: { type: "percent", value: 10, startsAt: "2026-01-01T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" },
    },
    () => {
      const unknown = lookupDiscount("NOPE", 100000, now).error;
      for (const c of ["OFF10", "OLD10", "SOON10"]) assert.equal(lookupDiscount(c, 100000, now).error, unknown, c);
      assert.equal(lookupDiscount("LIVE10", 100000, now).ok, true);
    }
  );
});

test("minSubtotal, maxDiscount and fixed amounts", () => {
  withCodes(
    {
      MIN: { type: "percent", value: 10, minSubtotal: 500 },
      CAP: { type: "percent", value: 50, maxDiscount: 100 },
      FLAT: { type: "fixed", value: 200 },
    },
    () => {
      assert.equal(lookupDiscount("MIN", 49900).ok, false);
      assert.match(lookupDiscount("MIN", 49900).error, /at least ₹500/);
      assert.equal(lookupDiscount("MIN", 50000).discountPaise, 5000);
      assert.equal(lookupDiscount("CAP", 100000).discountPaise, 10000); // 50% would be 500, capped at 100
      assert.equal(lookupDiscount("FLAT", 100000).discountPaise, 20000);
    }
  );
});

test("a discount can never take an order below Razorpay's Rs 1 minimum", () => {
  withCodes({ ALL: { type: "percent", value: 100 }, BIG: { type: "fixed", value: 5000 } }, () => {
    assert.equal(lookupDiscount("ALL", 30000).discountPaise, 29900); // pays Rs 1
    assert.equal(lookupDiscount("BIG", 30000).discountPaise, 29900);
    assert.equal(lookupDiscount("ALL", 100).ok, false); // nothing left to discount
  });
});

test("canonicalEmail sees through Gmail dots and +tags", () => {
  assert.equal(canonicalEmail("A.B.C+promo@Gmail.com"), "abc@gmail.com");
  assert.equal(canonicalEmail("abc@googlemail.com"), "abc@gmail.com");
  assert.equal(canonicalEmail("first.last+x@company.com"), "first.last@company.com"); // dots kept off Gmail
  assert.equal(canonicalEmail("not-an-email"), "");
});

test("customerKeys: any one shared identifier makes two customers the same", () => {
  const a = customerKeys(asha);
  assert.equal(a.length, 3);
  const sameEmailAlias = customerKeys({ ...asha, email: "a.sha+deal@example.com", phone: "9000000001", address: "elsewhere", pincode: "110001" });
  const samePhone = customerKeys({ ...asha, email: "other@example.com", address: "elsewhere", pincode: "110001" });
  const sameAddressRespaced = customerKeys({ email: "x@y.com", phone: "9111111111", address: "12  mg road,NEAR metro", pincode: "560001" });
  const stranger = customerKeys({ email: "z@z.com", phone: "9222222222", address: "9 Other St", pincode: "560002" });
  const shares = (x, y) => x.some((k) => y.includes(k));
  assert.equal(shares(a, samePhone), true);
  assert.equal(shares(a, sameAddressRespaced), true);
  assert.equal(shares(a, stranger), false);
  // "asha" vs "a.sha": dots only collapse on Gmail, so this alias is a different customer here
  assert.equal(shares(a, sameEmailAlias), false);
});

test("FIRSTBUY25 is available to a new customer and refused after their first paid order", () => {
  const ledger = emptyLedger();
  const found = lookupDiscount("FIRSTBUY25", 100000);
  assert.equal(checkEligibility(found, customerKeys(asha), ledger).ok, true);

  paidOrder(ledger, "order_1", asha, "FIRSTBUY25");
  assert.equal(checkEligibility(found, customerKeys(asha), ledger).ok, false);
});

test("evading by changing the email doesn't work while the phone or address is reused", () => {
  const ledger = emptyLedger();
  paidOrder(ledger, "order_1", asha, "FIRSTBUY25");
  const found = lookupDiscount("FIRSTBUY25", 100000);
  const newEmail = customerKeys({ ...asha, email: "brand.new@other.com" });
  assert.equal(checkEligibility(found, newEmail, ledger).ok, false, "same phone/address");
  const allNew = customerKeys({ email: "totally@new.com", phone: "9333333333", address: "77 New Rd", pincode: "400001" });
  assert.equal(checkEligibility(found, allNew, ledger).ok, true, "a genuinely different customer");
});

test("first-purchase codes refuse anyone who has already paid for ANY order", () => {
  const ledger = emptyLedger();
  paidOrder(ledger, "order_1", asha, null); // earlier order, no discount
  assert.equal(checkEligibility(lookupDiscount("FIRSTBUY25", 100000), customerKeys(asha), ledger).ok, false);
});

test("an abandoned (unpaid) checkout doesn't use a code up", () => {
  const ledger = emptyLedger();
  ledger.record({ id: "order_1", status: "created", code: "FIRSTBUY25", discountPaise: 100, subtotalPaise: 1000, totalPaise: 900, keys: customerKeys(asha), email: asha.email, createdAt: 1 });
  assert.equal(checkEligibility(lookupDiscount("FIRSTBUY25", 100000), customerKeys(asha), ledger).ok, true);
});

test("perCustomerLimit allows repeat use up to the limit", () => {
  withCodes({ TWICE: { type: "percent", value: 10, perCustomerLimit: 2 } }, () => {
    const ledger = emptyLedger();
    const found = lookupDiscount("TWICE", 100000);
    paidOrder(ledger, "o1", asha, "TWICE", 1);
    assert.equal(checkEligibility(found, customerKeys(asha), ledger).ok, true);
    paidOrder(ledger, "o2", asha, "TWICE", 2);
    assert.equal(checkEligibility(found, customerKeys(asha), ledger).ok, false);
  });
});

test("eligibility errors never say WHY (can't be used to probe who has ordered)", () => {
  const ledger = emptyLedger();
  paidOrder(ledger, "o1", asha, "FIRSTBUY25");
  const r = checkEligibility(lookupDiscount("FIRSTBUY25", 100000), customerKeys(asha), ledger);
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.error, /email|phone|address|first|ordered/i);
});

test("a discount used twice by the same customer is flagged on the later order only", () => {
  const ledger = emptyLedger();
  paidOrder(ledger, "order_a", asha, "FIRSTBUY25", 1000);
  paidOrder(ledger, "order_b", asha, "FIRSTBUY25", 2000); // e.g. two tabs, both paid
  assert.equal(ledger.isDuplicateRedemption("order_a"), false);
  assert.equal(ledger.isDuplicateRedemption("order_b"), true);
});

test("history is rebuilt from Razorpay's order list, across pages", async () => {
  const notes = (who, extra = {}) => ({ ship_email: who.email, ship_phone: `+91${who.phone}`, ship_address: who.address, ship_pincode: who.pincode, ...extra });
  const pages = [
    [
      { id: "o1", status: "paid", amount: 90000, created_at: 100, notes: notes(asha, { discount_code: "FIRSTBUY25", discount_paise: "10000", subtotal_paise: "100000" }) },
      { id: "o2", status: "created", amount: 5000, created_at: 200, notes: [] }, // Razorpay sends [] for empty notes
    ],
    [{ id: "o3", status: "attempted", amount: 5000, created_at: 300, notes: notes({ email: "b@b.com", phone: "9444444444", address: "1 A St", pincode: "100001" }) }],
  ];
  let calls = 0;
  const ledger = createLedger({
    pageSize: 2,
    fetchOrdersPage: async ({ skip }) => {
      calls++;
      return { items: pages[skip / 2] || [] };
    },
  });
  assert.equal(await ledger.hydrate(), 3);
  assert.equal(calls, 2);
  assert.equal(ledger.hasPaidOrder(customerKeys(asha)), true);
  assert.equal(ledger.paidRedemptionCount("FIRSTBUY25", customerKeys(asha)), 1);
  assert.equal(ledger.hasPaidOrder(customerKeys({ email: "b@b.com", phone: "9444444444", address: "1 A St", pincode: "100001" })), false, "unpaid orders don't count");
  const stats = ledger.statsByCode().get("FIRSTBUY25");
  assert.equal(stats.paid[0].discountPaise, 10000);
  assert.equal(stats.paid[0].subtotalPaise, 100000);
});

test("simultaneous refreshes share a single load, and a fresh ledger isn't reloaded", async () => {
  let calls = 0;
  const ledger = createLedger({ fetchOrdersPage: async () => { calls++; return { items: [] }; } });
  await Promise.all([ledger.ensureFresh(), ledger.ensureFresh(), ledger.ensureFresh()]);
  assert.equal(calls, 1);
  await ledger.ensureFresh();
  assert.equal(calls, 1);
});

test("a paid order is never downgraded by a stale Razorpay list", async () => {
  const ledger = createLedger({ fetchOrdersPage: async () => ({ items: [{ id: "o1", status: "created", amount: 100, created_at: 1, notes: {} }] }) });
  ledger.record({ id: "o1", status: "created", code: null, discountPaise: 0, subtotalPaise: 100, totalPaise: 100, keys: [], email: null, createdAt: 1 });
  ledger.markPaid("o1", "pay_1");
  await ledger.hydrate();
  assert.equal(ledger.get("o1").status, "paid");
});

test("if order history can't be loaded and we've never loaded it, refuse to decide", async () => {
  const ledger = createLedger({ fetchOrdersPage: async () => { throw new Error("razorpay down"); } });
  await assert.rejects(() => ledger.ensureFresh(), /razorpay down/);
});

test("if a refresh fails but we HAVE earlier data, that is used instead", async () => {
  let fail = false;
  let t = 0;
  const ledger = createLedger({
    now: () => t,
    ttlMs: 10,
    fetchOrdersPage: async () => {
      if (fail) throw new Error("blip");
      return { items: [] };
    },
  });
  await ledger.ensureFresh();
  fail = true;
  t = 1000;
  await assert.doesNotReject(() => ledger.ensureFresh());
});

test("markPaid returns null for an order this server hasn't seen; upsert reconciles it from Razorpay", () => {
  const ledger = emptyLedger();
  assert.equal(ledger.markPaid("order_x", "pay_x"), null);
  const rec = ledger.upsertFromRazorpay(
    { id: "order_x", status: "attempted", amount: 75000, created_at: 5, notes: { ship_email: "asha@example.com", discount_code: "FIRSTBUY25", discount_paise: "25000", subtotal_paise: "100000" } },
    { forcePaid: true, paymentId: "pay_x" }
  );
  assert.equal(rec.status, "paid");
  assert.equal(ledger.paidRedemptionCount("FIRSTBUY25", ["e:asha@example.com"]), 1);
});

test("priceCart prices from the catalog in integer paise and rejects bad carts", () => {
  const ok = priceCart([{ id: "round-planter", colorId: "black", qty: 2 }]);
  assert.equal(ok.ok, true);
  assert.equal(ok.subtotalPaise, 214000);
  for (const bad of [null, [], [null], [{ id: "nope", qty: 1 }], [{ id: "round-planter", colorId: "black", qty: 0 }], [{ id: "round-planter", colorId: "black", qty: 1.5 }]]) {
    assert.equal(priceCart(bad).ok, false, JSON.stringify(bad));
  }
});

test("the owner's order email shows the discount and flags duplicates", () => {
  const order = {
    id: "order_1",
    amount: 80250,
    notes: { ship_name: "Asha Rao", ship_email: "asha@example.com", items: "round-planter|black|1|1070", discount_code: "FIRSTBUY25", discount_paise: "26750", subtotal_paise: "107000" },
  };
  const plain = buildOrderEmail(order, "pay_1");
  assert.match(plain.subject, /Rs 802\.50 from Asha Rao \(FIRSTBUY25\)/);
  assert.match(plain.text, /Subtotal:\s+Rs 1,070/);
  assert.match(plain.text, /Discount \(FIRSTBUY25\): -Rs 267\.50/);
  assert.match(plain.text, /Paid:\s+Rs 802\.50/);
  assert.doesNotMatch(plain.text, /CHECK/);
  const dup = buildOrderEmail(order, "pay_1", { duplicateDiscount: true });
  assert.match(dup.subject, /^\[CHECK\]/);
  assert.match(dup.text, /already used FIRSTBUY25/);
  // and an ordinary undiscounted order still reads as before
  const none = buildOrderEmail({ id: "o", amount: 100000, notes: { ship_name: "B" } }, "p");
  assert.doesNotMatch(none.text, /TOTALS|Discount/);
});

test("the customer's confirmation lists the order, the address and what happens next", () => {
  const order = {
    id: "order_1",
    amount: 80250,
    notes: {
      ship_name: "Asha Rao", ship_email: "asha@example.com", ship_phone: "9876543210",
      ship_address: "12 MG Road", ship_city: "Bengaluru", ship_state: "Karnataka", ship_pincode: "560001",
      items: "round-planter|black|1|1070", discount_code: "FIRSTBUY25", discount_paise: "26750", subtotal_paise: "107000",
    },
  };
  const mail = buildCustomerEmail(order, "pay_1", { email: "shop@example.com", phone: "+91 1" });
  assert.equal(mail.to, "asha@example.com");
  assert.equal(mail.replyTo, "shop@example.com");
  assert.match(mail.subject, /confirmed \(Rs 802\.50\)/);
  assert.match(mail.text, /^Hi Asha Rao,/);
  assert.match(mail.text, /Order ID:\s+order_1/);
  assert.match(mail.text, /1 x .*Rs 1070 each/);
  assert.match(mail.text, /Subtotal:\s+Rs 1,070/);
  assert.match(mail.text, /Discount \(FIRSTBUY25\): -Rs 267\.50/);
  assert.match(mail.text, /Total paid:\s+Rs 802\.50/);
  assert.match(mail.text, /12 MG Road/);
  assert.match(mail.text, /Bengaluru, Karnataka - 560001/);
  assert.match(mail.text, /3-5 business days/);
  assert.match(mail.text, /call \+91 1/);
  // no internal notes leak to the customer
  assert.doesNotMatch(mail.text, /CHECK|CUSTOMER|Phone:/);
  // undiscounted: no discount lines
  const plain = buildCustomerEmail({ id: "o", amount: 100000, notes: { ship_email: "b@example.com" } }, "p");
  assert.match(plain.text, /^Hi,/);
  assert.match(plain.text, /Total paid: Rs 1,000/);
  assert.doesNotMatch(plain.text, /Discount|Subtotal/);
});

test("no customer confirmation without a usable email, and newlines in fields can't break lines or headers", () => {
  assert.equal(buildCustomerEmail({ id: "o", amount: 100, notes: {} }, "p"), null);
  assert.equal(buildCustomerEmail({ id: "o", amount: 100, notes: { ship_email: "not-an-email" } }, "p"), null);
  assert.equal(buildCustomerEmail({ id: "o", amount: 100 }, "p"), null);
  const notes = { ship_email: "a@b.co", ship_name: "Evil\r\nBcc: x@y.z", ship_address: "1 Road\nLine 2" };
  const mail = buildCustomerEmail({ id: "o", amount: 100, notes }, "p");
  assert.match(mail.text, /^Hi Evil Bcc: x@y\.z,/);
  assert.match(mail.text, /1 Road Line 2/);
  assert.equal(mail.to, "a@b.co");
});

// ---------------------------------------------------------------- offers list

test("the offers list advertises FIRSTBUY25 with what it would save on this cart", () => {
  const offers = listOffers(214000); // Rs 2140
  const fb = offers.find((o) => o.code === "FIRSTBUY25");
  assert.ok(fb, "FIRSTBUY25 is listed");
  assert.equal(fb.applicable, true);
  assert.equal(fb.savingsPaise, 53500);
  assert.equal(fb.description, "25% off your first order");
  assert.deepEqual(fb.terms, ["First order only", "One use per customer"]);
});

test("codes that aren't marked `listed` never appear in the offers list (but still work if typed)", () => {
  withCodes({ SECRET50: { type: "percent", value: 50, description: "private" } }, () => {
    assert.equal(listOffers(100000).some((o) => o.code === "SECRET50"), false);
    assert.equal(lookupDiscount("SECRET50", 100000).ok, true, "still redeemable by typing it");
  });
});

test("switched-off, expired and not-yet-started offers are left out of the list", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  withCodes(
    {
      OFF: { listed: true, type: "percent", value: 10, active: false },
      OLD: { listed: true, type: "percent", value: 10, expiresAt: "2026-01-01T00:00:00Z" },
      SOON: { listed: true, type: "percent", value: 10, startsAt: "2027-01-01T00:00:00Z" },
      LIVE: { listed: true, type: "percent", value: 10, description: "live" },
    },
    () => {
      const codes = listOffers(100000, now).map((o) => o.code);
      assert.ok(codes.includes("LIVE"));
      for (const hidden of ["OFF", "OLD", "SOON"]) assert.equal(codes.includes(hidden), false, hidden);
    }
  );
});

test("an offer whose minimum isn't met is shown greyed out with how much more to add", () => {
  withCodes({ BIG: { listed: true, type: "percent", value: 10, minSubtotal: 2000, description: "big spender" } }, () => {
    const big = listOffers(150000).find((o) => o.code === "BIG"); // cart Rs 1500, needs Rs 2000
    assert.equal(big.applicable, false);
    assert.equal(big.reason, "Add ₹500 more to use this offer.");
    assert.equal(listOffers(250000).find((o) => o.code === "BIG").applicable, true);
    assert.equal(listOffers(150050).find((o) => o.code === "BIG").reason, "Add ₹499.50 more to use this offer.");
  });
});

test("offers are ordered: usable first, biggest saving first", () => {
  withCodes(
    {
      SMALL: { listed: true, type: "fixed", value: 50 },
      HUGE: { listed: true, type: "fixed", value: 500 },
      LOCKED: { listed: true, type: "fixed", value: 900, minSubtotal: 99999 },
    },
    () => {
      const order = listOffers(200000).map((o) => o.code);
      assert.ok(order.indexOf("HUGE") < order.indexOf("SMALL"));
      assert.equal(order[order.length - 1], "LOCKED", "not-yet-usable offers sink to the bottom");
    }
  );
});

test("the fine print is generated from the rules actually enforced", () => {
  assert.deepEqual(describeTerms({ firstPurchaseOnly: true }), ["First order only", "One use per customer"]);
  assert.deepEqual(describeTerms({ perCustomerLimit: 3, minSubtotal: 500, type: "percent", maxDiscount: 150 }), [
    "Up to 3 uses per customer",
    "Minimum order ₹500",
    "Up to ₹150 off",
  ]);
  // 18:29 UTC on the 30th is 23:59 IST on the 30th; en-IN spells the month "Sept" or "Sep" depending on the ICU version
  assert.match(describeTerms({ expiresAt: "2026-09-30T18:29:59Z" }).at(-1), /^Valid until 30 Sept? 2026$/);
});

// ------------------------------------------------- only one discount per order

test("a checkout carries ONE code: arrays and objects are refused, with a clear message", () => {
  for (const many of [["FIRSTBUY25", "SUMMER10"], ["FIRSTBUY25"], { a: "FIRSTBUY25" }]) {
    assert.equal(looksLikeMultipleCodes(many), true);
    assert.equal(lookupDiscount(many, 100000).ok, false, "never redeemable via a non-string");
  }
  for (const single of ["FIRSTBUY25", "", null, undefined]) assert.equal(looksLikeMultipleCodes(single), false);
  assert.match(ONE_CODE_PER_ORDER, /only one/i);
});

test("several codes smuggled into one string don't work either", () => {
  withCodes({ SUMMER10: { type: "percent", value: 10 } }, () => {
    for (const combined of ["FIRSTBUY25,SUMMER10", "FIRSTBUY25 SUMMER10", "FIRSTBUY25;SUMMER10", "FIRSTBUY25+SUMMER10", "FIRSTBUY25&SUMMER10"]) {
      assert.equal(lookupDiscount(combined, 100000).ok, false, combined);
    }
  });
});

test("the discount comes off once: the result is exactly one code's saving, never a sum", () => {
  withCodes({ SUMMER10: { type: "percent", value: 10 } }, () => {
    assert.equal(lookupDiscount("FIRSTBUY25", 100000).discountPaise, 25000);
    assert.equal(lookupDiscount("SUMMER10", 100000).discountPaise, 10000);
  });
});
