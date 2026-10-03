import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canManageDelivery, canUseRiderApp, isAdmin } from "./access.js";

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

describe("rider app visibility (canUseRiderApp)", () => {
  it("needs the delivery:rider permission — being staff is not enough", () => {
    assert.equal(canUseRiderApp({ signedIn: true, isStaff: true, roles: ["warehouse"], permissions: ["orders:read_all", "delivery:manage"] }), false);
    assert.equal(canUseRiderApp({ signedIn: true, isStaff: true, roles: ["pharmacist"], permissions: [] }), false);
    assert.equal(canUseRiderApp({ signedIn: true, isStaff: false, roles: ["delivery"], permissions: ["delivery:rider"] }), true);
  });
  it("is false for guests and for a missing session, whatever the permission list says", () => {
    assert.equal(canUseRiderApp({ signedIn: false, permissions: ["delivery:rider"] }), false);
    assert.equal(canUseRiderApp(null), false);
    assert.equal(canUseRiderApp({ signedIn: true }), false);
  });
  it("dispatch/rider management needs delivery:manage, separately", () => {
    assert.equal(canManageDelivery({ signedIn: true, permissions: ["delivery:manage"] }), true);
    assert.equal(canManageDelivery({ signedIn: true, permissions: ["delivery:rider"] }), false);
  });
});
