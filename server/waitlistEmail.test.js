// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { buildWaitlistConfirmationEmail } from "./waitlistEmail.js";

test("builds a confirmation addressed to the signer-upper, mentioning the catalog", () => {
  const mail = buildWaitlistConfirmationEmail("fan@example.com");
  assert.equal(mail.to, "fan@example.com");
  assert.equal(mail.subject, "You're on the YZ Labs waitlist");
  assert.match(mail.text, /^Hi,/);
  assert.match(mail.text, /waitlist/i);
  assert.match(mail.text, /\/catalog/);
  assert.equal(mail.replyTo, undefined);
});

test("includes and replies-to the shop's own email when given", () => {
  const mail = buildWaitlistConfirmationEmail("fan@example.com", { shopEmail: "shop@example.com" });
  assert.equal(mail.replyTo, "shop@example.com");
  assert.match(mail.text, /shop@example\.com/);
});
