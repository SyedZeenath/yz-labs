// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./passwords.js";

test("a hashed password verifies against the same password, and rejects a wrong one", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", stored), true);
  assert.equal(await verifyPassword("wrong password", stored), false);
});

test("two hashes of the same password are different (random salt) but both verify", async () => {
  const a = await hashPassword("same password");
  const b = await hashPassword("same password");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("same password", a), true);
  assert.equal(await verifyPassword("same password", b), true);
});

test("garbage or missing stored values are rejected, not thrown", async () => {
  for (const bad of [null, undefined, "", "no-colon-here", ":", "salt-with-no-hash:"]) {
    assert.equal(await verifyPassword("anything", bad), false, JSON.stringify(bad));
  }
});
