// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { buildMagicLinkEmail } from "./customerAuthEmail.js";

test("builds a sign-in email addressed to the customer, carrying the sign-in link", () => {
  const mail = buildMagicLinkEmail("fan@example.com", "https://yz-labs.onrender.com/account?signin=abc.123.def");
  assert.equal(mail.to, "fan@example.com");
  assert.equal(mail.subject, "Sign in to YZ Labs");
  assert.match(mail.text, /https:\/\/yz-labs\.onrender\.com\/account\?signin=abc\.123\.def/);
  assert.match(mail.text, /30 minutes/);
  assert.match(mail.html, /<!DOCTYPE html>/);
  assert.match(mail.html, /href="https:\/\/yz-labs\.onrender\.com\/account\?signin=abc\.123\.def"/);
});
