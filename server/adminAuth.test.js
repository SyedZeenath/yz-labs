// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { signAdminCookie, verifyAdminCookie, signResetToken, verifyResetToken, requireAdmin, ADMIN_COOKIE } from "./adminAuth.js";

const SECRET = "test-admin-secret";
const EMAIL = "owner@example.com";

test("a freshly signed cookie verifies and returns the email it was signed for", () => {
  const cookie = signAdminCookie(SECRET, EMAIL);
  assert.equal(verifyAdminCookie(cookie, SECRET), EMAIL);
});

test("an expired cookie is rejected", () => {
  let t = 0;
  const cookie = signAdminCookie(SECRET, EMAIL, { now: () => t, sessionMs: 1000 });
  t = 1001;
  assert.equal(verifyAdminCookie(cookie, SECRET, { now: () => t }), null);
});

test("a tampered cookie (wrong signature, a different secret, or a swapped-in different email) is rejected", () => {
  const cookie = signAdminCookie(SECRET, EMAIL);
  const [emailPart, expiresAt] = cookie.split(".");
  assert.equal(verifyAdminCookie(`${emailPart}.${expiresAt}.deadbeef`, SECRET), null);
  assert.equal(verifyAdminCookie(cookie, "a-different-secret"), null);
  // Swapping the email segment without a matching signature must not let
  // someone else's cookie be "read as" a different admin.
  const otherEmailPart = Buffer.from("attacker@example.com").toString("base64url");
  assert.equal(verifyAdminCookie(`${otherEmailPart}.${expiresAt}.${cookie.split(".")[2]}`, SECRET), null);
});

test("garbage or missing cookie values are rejected, not thrown", () => {
  for (const bad of [null, undefined, "", "not-a-real-cookie", "123", "abc.def"]) {
    assert.equal(verifyAdminCookie(bad, SECRET), null, JSON.stringify(bad));
  }
});

// --- password-reset tokens ---

test("a freshly signed reset token verifies and returns the email it was signed for", () => {
  const token = signResetToken(SECRET, EMAIL);
  assert.equal(verifyResetToken(token, SECRET), EMAIL);
});

test("an expired reset token is rejected", () => {
  let t = 0;
  const token = signResetToken(SECRET, EMAIL, { now: () => t });
  t = 30 * 60 * 1000 + 1; // just past the 30-minute window
  assert.equal(verifyResetToken(token, SECRET, { now: () => t }), null);
});

// The whole point of scoping tokens by "purpose" (see adminAuth.js's
// signToken/verifyToken): a session cookie must never work as a password-
// reset proof, and a reset link must never work as a login session, even
// though both are signed with the same secret and the same shape.
test("a session cookie is not a valid reset token, and a reset token is not a valid session cookie", () => {
  const cookie = signAdminCookie(SECRET, EMAIL);
  const resetToken = signResetToken(SECRET, EMAIL);
  assert.equal(verifyResetToken(cookie, SECRET), null);
  assert.equal(verifyAdminCookie(resetToken, SECRET), null);
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

test("requireAdmin: a valid Bearer token passes through (existing curl usage keeps working), with no email attached", () => {
  const mw = requireAdmin(SECRET);
  const { req, res } = fakeReqRes({ authorization: `Bearer ${SECRET}` });
  let nextCalled = false;
  mw(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, true);
  assert.equal(req.adminEmail, null);
});

test("requireAdmin: a valid signed cookie passes through and attaches the admin's email", () => {
  const mw = requireAdmin(SECRET);
  const cookie = signAdminCookie(SECRET, EMAIL);
  const { req, res } = fakeReqRes({ cookie: `${ADMIN_COOKIE}=${cookie}; other=1` });
  let nextCalled = false;
  mw(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, true);
  assert.equal(req.adminEmail, EMAIL);
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
