// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { buildWaitlistConfirmationEmail, buildWaitlistNotificationEmail } from "./waitlistEmail.js";

test("builds a confirmation addressed to the signer-upper, mentioning the catalog", () => {
  const mail = buildWaitlistConfirmationEmail("fan@example.com");
  assert.equal(mail.to, "fan@example.com");
  assert.equal(mail.subject, "You're on the YZ Labs waitlist");
  assert.match(mail.text, /^Hi,/);
  assert.match(mail.text, /waitlist/i);
  assert.match(mail.text, /\/catalog/);
  assert.equal(mail.replyTo, undefined);
  assert.match(mail.html, /<!DOCTYPE html>/);
  assert.match(mail.html, /waitlist/i);
  assert.match(mail.html, /\/catalog/);
});

test("includes and replies-to the shop's own email when given", () => {
  const mail = buildWaitlistConfirmationEmail("fan@example.com", { shopEmail: "shop@example.com" });
  assert.equal(mail.replyTo, "shop@example.com");
  assert.match(mail.text, /shop@example\.com/);
});

test("the shop's own notification names the signer-upper and replies to them", () => {
  const mail = buildWaitlistNotificationEmail("fan@example.com");
  assert.equal(mail.subject, "Waitlist signup: fan@example.com");
  assert.match(mail.text, /fan@example\.com joined/);
  assert.equal(mail.replyTo, "fan@example.com");
  assert.match(mail.html, /<!DOCTYPE html>/);
  assert.match(mail.html, /fan@example\.com/);
});

test("a hostile email can't inject markup into the notification's HTML", () => {
  const mail = buildWaitlistNotificationEmail('<script>alert(1)</script>@x.com');
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /&lt;script&gt;/);
});
