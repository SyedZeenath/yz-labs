// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { signCustomerSession, verifyCustomerSession, signMagicLinkToken, verifyMagicLinkToken, requireCustomer, CUSTOMER_COOKIE } from "./customerAuth.js";
import { signAdminCookie, signResetToken } from "./adminAuth.js";

const SECRET = "test-session-secret";
const OTHER_SECRET = "a-completely-different-secret";
const EMAIL = "customer@example.com";

test("a freshly signed session cookie verifies and returns the email it was signed for", () => {
  const cookie = signCustomerSession(SECRET, EMAIL);
  assert.equal(verifyCustomerSession(cookie, SECRET), EMAIL);
});

test("a freshly signed magic-link token verifies and returns the email it was signed for", () => {
  const token = signMagicLinkToken(SECRET, EMAIL);
  assert.equal(verifyMagicLinkToken(token, SECRET), EMAIL);
});

test("an expired magic-link token is rejected", () => {
  let t = 0;
  const token = signMagicLinkToken(SECRET, EMAIL, { now: () => t });
  t = 30 * 60 * 1000 + 1; // just past the 30-minute window
  assert.equal(verifyMagicLinkToken(token, SECRET, { now: () => t }), null);
});

// The core security property this whole two-secret design exists for: a
// customer session must never double as admin access, and an admin's own
// tokens must never double as a customer session — even by accident, even
// though both systems share the same underlying signing mechanism (see
// server/authTokens.js).
test("a magic-link token is not a valid session cookie, and vice versa", () => {
  const session = signCustomerSession(SECRET, EMAIL);
  const magicLink = signMagicLinkToken(SECRET, EMAIL);
  assert.equal(verifyMagicLinkToken(session, SECRET), null);
  assert.equal(verifyCustomerSession(magicLink, SECRET), null);
});

test("an admin cookie or admin reset token is never valid as a customer session, even with the 'right' looking token shape", () => {
  const adminCookie = signAdminCookie(SECRET, EMAIL); // same secret on purpose — still must not cross over
  const adminReset = signResetToken(SECRET, EMAIL);
  assert.equal(verifyCustomerSession(adminCookie, SECRET), null);
  assert.equal(verifyMagicLinkToken(adminReset, SECRET), null);
});

test("a session signed with a different secret is rejected", () => {
  const cookie = signCustomerSession(SECRET, EMAIL);
  assert.equal(verifyCustomerSession(cookie, OTHER_SECRET), null);
});

// --- requireCustomer middleware ---

function fakeReqRes({ cookie } = {}) {
  const req = { headers: { cookie } };
  let statusCode = null;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };
  return { req, res, result: () => ({ statusCode, body }) };
}

test("requireCustomer: 404s (feature doesn't exist) when no SESSION_SECRET is configured", () => {
  const mw = requireCustomer(undefined);
  const { req, res, result } = fakeReqRes();
  let nextCalled = false;
  mw(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, false);
  assert.equal(result().statusCode, 404);
});

test("requireCustomer: a valid session cookie passes through and attaches the customer's email", () => {
  const mw = requireCustomer(SECRET);
  const cookie = signCustomerSession(SECRET, EMAIL);
  const { req, res } = fakeReqRes({ cookie: `${CUSTOMER_COOKIE}=${cookie}; other=1` });
  let nextCalled = false;
  mw(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, true);
  assert.equal(req.customerEmail, EMAIL);
});

test("requireCustomer: missing or garbage cookie is 401", () => {
  const mw = requireCustomer(SECRET);
  for (const opts of [{}, { cookie: `${CUSTOMER_COOKIE}=garbage` }]) {
    const { req, res, result } = fakeReqRes(opts);
    let nextCalled = false;
    mw(req, res, () => (nextCalled = true));
    assert.equal(nextCalled, false, JSON.stringify(opts));
    assert.equal(result().statusCode, 401, JSON.stringify(opts));
  }
});
