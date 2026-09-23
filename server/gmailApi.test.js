// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { createGmailMailer } from "./gmailApi.js";

function decodeRawFromBody(body) {
  const { raw } = JSON.parse(body);
  return Buffer.from(raw, "base64url").toString("utf8");
}

function fakeFetch({ onToken, onSend }) {
  let tokenCalls = 0;
  let sendCalls = 0;
  const fn = async (url, opts) => {
    if (url.includes("oauth2.googleapis.com")) {
      tokenCalls++;
      return onToken ? onToken(opts) : { ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
    }
    if (url.includes("gmail.googleapis.com")) {
      sendCalls++;
      return onSend ? onSend(opts) : { ok: true, json: async () => ({ id: "msg1" }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { fn, calls: () => ({ tokenCalls, sendCalls }) };
}

test("sendMail builds a correct raw message and sends with a bearer token", async (t) => {
  let capturedAuth;
  let capturedBody;
  const { fn } = fakeFetch({
    onSend: (opts) => {
      capturedAuth = opts.headers.Authorization;
      capturedBody = opts.body;
      return { ok: true, json: async () => ({ id: "msg1" }) };
    },
  });
  t.mock.method(global, "fetch", fn);

  const mailer = createGmailMailer({ clientId: "id", clientSecret: "secret", refreshToken: "refresh" });
  await mailer.sendMail({ from: "shop@x.com", to: "customer@x.com", replyTo: "reply@x.com", subject: "Hi", text: "Body text" });

  assert.equal(capturedAuth, "Bearer tok");
  const decoded = decodeRawFromBody(capturedBody);
  assert.match(decoded, /^From: shop@x\.com\r\n/);
  assert.match(decoded, /To: customer@x\.com/);
  assert.match(decoded, /Reply-To: reply@x\.com/);
  assert.match(decoded, /Subject: Hi/);
  assert.match(decoded, /\r\n\r\nBody text$/);
});

test("omits the Reply-To header entirely when none is given", async (t) => {
  let capturedBody;
  const { fn } = fakeFetch({ onSend: (opts) => { capturedBody = opts.body; return { ok: true, json: async () => ({}) }; } });
  t.mock.method(global, "fetch", fn);

  const mailer = createGmailMailer({ clientId: "id", clientSecret: "secret", refreshToken: "refresh" });
  await mailer.sendMail({ from: "shop@x.com", to: "customer@x.com", subject: "Hi", text: "Body" });

  assert.doesNotMatch(decodeRawFromBody(capturedBody), /Reply-To/);
});

test("access token is cached and reused across sends, not refetched every time", async (t) => {
  const { fn, calls } = fakeFetch({});
  t.mock.method(global, "fetch", fn);

  const mailer = createGmailMailer({ clientId: "id", clientSecret: "secret", refreshToken: "refresh" });
  await mailer.sendMail({ from: "a@x.com", to: "b@x.com", subject: "s", text: "t" });
  await mailer.sendMail({ from: "a@x.com", to: "b@x.com", subject: "s", text: "t" });
  assert.equal(calls().tokenCalls, 1);
  assert.equal(calls().sendCalls, 2);
});

test("a near-expired token is refreshed before the next send", async (t) => {
  let t0 = 0;
  const { fn, calls } = fakeFetch({});
  t.mock.method(global, "fetch", fn);

  const mailer = createGmailMailer({ clientId: "id", clientSecret: "secret", refreshToken: "refresh", now: () => t0 });
  await mailer.sendMail({ from: "a@x.com", to: "b@x.com", subject: "s", text: "t" });
  t0 = 3600_000; // an hour later — past the token's lifetime
  await mailer.sendMail({ from: "a@x.com", to: "b@x.com", subject: "s", text: "t" });
  assert.equal(calls().tokenCalls, 2);
});

test("a failed token refresh rejects with a clear message, not a raw fetch error", async (t) => {
  const { fn } = fakeFetch({ onToken: () => ({ ok: false, status: 400, json: async () => ({ error: "invalid_grant", error_description: "Token has been expired or revoked." }) }) });
  t.mock.method(global, "fetch", fn);

  const mailer = createGmailMailer({ clientId: "id", clientSecret: "secret", refreshToken: "bad" });
  await assert.rejects(() => mailer.sendMail({ from: "a@x.com", to: "b@x.com", subject: "s", text: "t" }), /Token has been expired or revoked/);
});

test("a failed send rejects with a clear message", async (t) => {
  const { fn } = fakeFetch({ onSend: () => ({ ok: false, status: 403, json: async () => ({ error: { message: "Insufficient Permission" } }) }) });
  t.mock.method(global, "fetch", fn);

  const mailer = createGmailMailer({ clientId: "id", clientSecret: "secret", refreshToken: "refresh" });
  await assert.rejects(() => mailer.sendMail({ from: "a@x.com", to: "b@x.com", subject: "s", text: "t" }), /Insufficient Permission/);
});
