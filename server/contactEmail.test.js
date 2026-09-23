// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { buildContactNotificationEmail } from "./contactEmail.js";

test("builds a notification naming the sender, their message, and replies to them", () => {
  const mail = buildContactNotificationEmail({ name: "Asha Rao", email: "asha@example.com", phone: "9876543210", message: "Do you ship to Kerala?" });
  assert.equal(mail.subject, "New website enquiry from Asha Rao");
  assert.equal(mail.replyTo, "asha@example.com");
  assert.match(mail.text, /Name: Asha Rao/);
  assert.match(mail.text, /Phone: 9876543210/);
  assert.match(mail.text, /Do you ship to Kerala\?/);
  assert.match(mail.html, /<!DOCTYPE html>/);
  assert.match(mail.html, /Asha Rao/);
  assert.match(mail.html, /Do you ship to Kerala\?/);
});

test("omits the phone row entirely when none is given", () => {
  const mail = buildContactNotificationEmail({ name: "Asha", email: "asha@example.com", phone: "", message: "Hi" });
  assert.doesNotMatch(mail.text, /Phone:/);
  assert.doesNotMatch(mail.html, /Phone</);
});

test("a hostile name or message can't inject markup into the HTML", () => {
  const mail = buildContactNotificationEmail({ name: '<script>alert(1)</script>', email: "a@b.co", phone: "", message: "line one\nline two & more" });
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /&lt;script&gt;/);
  assert.match(mail.html, /line one\nline two &amp; more/);
});
