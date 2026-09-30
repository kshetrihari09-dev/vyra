import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAdmin } from "./access.js";

describe("isAdmin (admin console gate)", () => {
  it("allows only a signed-in account holding the admin role", () => {
    assert.equal(isAdmin({ signedIn: true, roles: ["admin"] }), true);
    assert.equal(isAdmin({ signedIn: true, roles: ["customer", "admin"] }), true);
  });
  it("rejects guests, customers, sellers and other staff roles", () => {
    assert.equal(isAdmin({ signedIn: false, roles: ["admin"] }), false);
    for (const r of ["customer", "seller", "pharmacist", "warehouse", "accountant", "support", "delivery"]) {
      assert.equal(isAdmin({ signedIn: true, roles: [r], isStaff: true }), false, r);
    }
    assert.equal(isAdmin(null), false);
    assert.equal(isAdmin({ signedIn: true }), false);
  });
});
