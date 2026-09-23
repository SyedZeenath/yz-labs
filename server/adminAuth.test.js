// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { signAdminCookie, verifyAdminCookie, requireAdmin, ADMIN_COOKIE } from "./adminAuth.js";

const SECRET = "test-admin-secret";

test("a freshly signed cookie verifies", () => {
  const cookie = signAdminCookie(SECRET);
  assert.equal(verifyAdminCookie(cookie, SECRET), true);
});

test("an expired cookie is rejected", () => {
  let t = 0;
  const cookie = signAdminCookie(SECRET, { now: () => t, sessionMs: 1000 });
  t = 1001;
  assert.equal(verifyAdminCookie(cookie, SECRET, { now: () => t }), false);
});

test("a tampered cookie (wrong signature, or a different secret) is rejected", () => {
  const cookie = signAdminCookie(SECRET);
  const [expiresAt] = cookie.split(".");
  assert.equal(verifyAdminCookie(`${expiresAt}.deadbeef`, SECRET), false);
  assert.equal(verifyAdminCookie(cookie, "a-different-secret"), false);
});

test("garbage or missing cookie values are rejected, not thrown", () => {
  for (const bad of [null, undefined, "", "not-a-real-cookie", "123", "abc.def"]) {
    assert.equal(verifyAdminCookie(bad, SECRET), false, JSON.stringify(bad));
  }
});

// --- requireAdmin middleware ---

function fakeReqRes({ authorization, cookie } = {}) {
  const req = { headers: { authorization, cookie } };
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

test("requireAdmin: 404s (endpoint doesn't exist) when no ADMIN_TOKEN is configured", () => {
  const mw = requireAdmin(undefined);
  const { req, res, result } = fakeReqRes();
  let nextCalled = false;
  mw(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, false);
  assert.equal(result().statusCode, 404);
});

test("requireAdmin: a valid Bearer token passes through (existing curl usage keeps working)", () => {
  const mw = requireAdmin(SECRET);
  const { req, res } = fakeReqRes({ authorization: `Bearer ${SECRET}` });
  let nextCalled = false;
  mw(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, true);
});

test("requireAdmin: a valid signed cookie passes through", () => {
  const mw = requireAdmin(SECRET);
  const cookie = signAdminCookie(SECRET);
  const { req, res } = fakeReqRes({ cookie: `${ADMIN_COOKIE}=${cookie}; other=1` });
  let nextCalled = false;
  mw(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, true);
});

test("requireAdmin: wrong Bearer, wrong/expired cookie, or nothing at all is 401", () => {
  const mw = requireAdmin(SECRET);
  for (const opts of [{}, { authorization: "Bearer wrong" }, { cookie: `${ADMIN_COOKIE}=garbage` }]) {
    const { req, res, result } = fakeReqRes(opts);
    let nextCalled = false;
    mw(req, res, () => (nextCalled = true));
    assert.equal(nextCalled, false, JSON.stringify(opts));
    assert.equal(result().statusCode, 401, JSON.stringify(opts));
  }
});
