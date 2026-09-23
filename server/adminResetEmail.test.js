// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminResetEmail } from "./adminResetEmail.js";

test("builds a reset email addressed to the account, carrying the reset link", () => {
  const mail = buildAdminResetEmail("owner@example.com", "https://yz-labs.onrender.com/admin?reset=abc.123.def");
  assert.equal(mail.to, "owner@example.com");
  assert.equal(mail.subject, "Reset your YZ Labs admin password");
  assert.match(mail.text, /https:\/\/yz-labs\.onrender\.com\/admin\?reset=abc\.123\.def/);
  assert.match(mail.text, /30 minutes/);
  assert.match(mail.html, /<!DOCTYPE html>/);
  assert.match(mail.html, /href="https:\/\/yz-labs\.onrender\.com\/admin\?reset=abc\.123\.def"/);
  assert.match(mail.html, /owner@example\.com/);
});
