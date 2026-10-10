import test from "node:test";
import assert from "node:assert/strict";
import { describePosError, describeLookupError, isIndeterminate } from "./posErrors.js";

const err = (status, code, message = "raw backend text", details) => Object.assign(new Error(message), { status, code, details });

test("a dropped connection is INDETERMINATE: the sale may have gone through, so retry (same id) is the only safe move", () => {
  const d = describePosError(err(0, "NETWORK_ERROR"));
  assert.equal(d.kind, "network"); assert.equal(d.indeterminate, true); assert.match(d.message, /will not create a second sale/);
});
test("5xx is indeterminate too, and never shows the raw backend text", () => {
  for (const s of [500, 502, 503, 504]) { const d = describePosError(err(s, "INTERNAL_ERROR", "SequelizeConnectionError: relation \"x\" does not exist")); assert.equal(d.indeterminate, true); assert.ok(!/relation|Sequelize/.test(d.message)); }
});
test("insufficient stock keeps the server's specific message (product + real quantity); nothing is indeterminate", () => {
  const d = describePosError(err(409, "INSUFFICIENT_STOCK", "Only 5 units of Soap available.", { available: 5 }));
  assert.equal(d.message, "Only 5 units of Soap available."); assert.equal(d.kind, "stock"); assert.equal(d.indeterminate, false); assert.equal(d.details.available, 5);
});
test("the named cashier-facing messages", () => {
  assert.equal(describePosError(err(400, "INSUFFICIENT_PAYMENT")).message, "Payment amount is insufficient.");
  assert.equal(describePosError(err(404, "PRODUCT_NOT_FOUND")).message, "Product not found.");
  assert.equal(describePosError(err(403, "DISCOUNT_NOT_ALLOWED", "Discounts above 20% need a manager.")).message, "Discounts above 20% need a manager.");
  assert.equal(describePosError(err(409, "PRICE_CHANGED")).kind, "price");
});
test("auth, permission and unknown errors are explained without leaking internals", () => {
  assert.match(describePosError(err(401, "UNAUTHORIZED")).message, /sign in again/);
  assert.match(describePosError(err(403, "FORBIDDEN")).message, /permission/);
  const unknown = describePosError(err(400, "WEIRD_CODE", "stack trace at line 5")); assert.ok(!/stack trace/.test(unknown.message));
});
test("isIndeterminate", () => { assert.equal(isIndeterminate(err(0, "NETWORK_ERROR")), true); assert.equal(isIndeterminate(err(503, "X")), true); assert.equal(isIndeterminate(err(409, "INSUFFICIENT_STOCK")), false); assert.equal(isIndeterminate(err(400, "VALIDATION_ERROR")), false); });
test("lookup errors", () => {
  assert.equal(describeLookupError(err(404, "PRODUCT_NOT_FOUND"), "8901"), "Product not found for “8901”.");
  assert.match(describeLookupError(err(0, "NETWORK_ERROR")), /Network connection lost/);
});
