import test from "node:test";
import assert from "node:assert/strict";
import { parseQty, addLine, setLineQty, stepLine, removeLine, applyStock, previewTotals, parseDiscount, cashChange, quickTenders, newRequestId, buildSaleRequest, MAX_QTY } from "./posCart.js";

const coke = { productId: "coke", variantId: null, batch: null, name: "Coke", unitPrice: 80, taxPercent: 0, cap: 10 };
const noodles = { productId: "noodles", variantId: null, batch: null, name: "Noodles", unitPrice: 40, taxPercent: 0, cap: 10 };

test("parseQty accepts whole numbers only: never 0, negative, NaN, Infinity, fractions or text", () => {
  for (const ok of [1, "1", " 7 ", 250, "10000"]) assert.ok(parseQty(ok) >= 1, String(ok));
  for (const bad of [0, "0", -1, "-3", 1.5, "1.5", NaN, Infinity, -Infinity, "abc", "", null, undefined, "1e3", "٣", "0x10", MAX_QTY + 1, {}, [], true]) assert.equal(parseQty(bad), null, String(bad));
});

test("scanning: first scan adds, the same product again raises its quantity", () => {
  let r = addLine([], coke); assert.deepEqual([r.result, r.qty], ["added", 1]);
  r = addLine(r.cart, coke); assert.deepEqual([r.result, r.qty], ["incremented", 2]);
  assert.equal(r.cart.length, 1);
  r = addLine(r.cart, noodles); assert.equal(r.cart.length, 2);
});
test("a product with no sellable stock is not added; the stock cap holds on repeat scans", () => {
  assert.equal(addLine([], { ...coke, cap: 0 }).result, "out");
  let cart = addLine([], { ...coke, cap: 2 }).cart; cart = addLine(cart, { ...coke, cap: 2 }).cart;
  const r = addLine(cart, { ...coke, cap: 2 }); assert.equal(r.result, "limit"); assert.equal(r.cart[0].qty, 2);
});
test("variants and batches are separate lines", () => {
  let c = addLine([], { ...coke, variantId: "1l" }).cart; c = addLine(c, { ...coke, variantId: "2l" }).cart; c = addLine(c, { ...coke, batch: "B1" }).cart;
  assert.equal(c.length, 3);
});
test("typing a quantity: valid sets it, over-cap clamps to the cap, garbage changes nothing", () => {
  const cart = addLine([], { ...coke, cap: 5 }).cart; const key = cart[0].key;
  assert.equal(setLineQty(cart, key, "3").cart[0].qty, 3);
  const over = setLineQty(cart, key, "99"); assert.deepEqual([over.result, over.cart[0].qty], ["limit", 5]);
  for (const bad of ["0", "-1", "NaN", "Infinity", "2.5", "", "abc"]) { const r = setLineQty(cart, key, bad); assert.equal(r.result, "invalid", bad); assert.equal(r.cart[0].qty, 1, bad); }
});
test("the − button removes at 1; + stops at the cap", () => {
  let cart = addLine([], { ...coke, cap: 2 }).cart; const key = cart[0].key;
  cart = stepLine(cart, key, +1).cart; assert.equal(cart[0].qty, 2);
  assert.equal(stepLine(cart, key, +1).cart[0].qty, 2);
  cart = stepLine(cart, key, -1).cart; cart = stepLine(cart, key, -1).cart; assert.equal(cart.length, 0);
});
test("applyStock pulls a line down to what is really there, or drops it", () => {
  let cart = addLine([], { ...coke, cap: 9 }).cart; cart = setLineQty(cart, cart[0].key, 8).cart;
  assert.equal(applyStock(cart, cart[0].key, 3)[0].qty, 3);
  assert.equal(applyStock(cart, cart[0].key, 0).length, 0);
  assert.equal(removeLine(cart, cart[0].key).length, 0);
});

test("the worked example: Coke 2×80 + Noodles 3×40, discount 20 → 280 − 20 + 0 = 260", () => {
  let cart = addLine([], coke).cart; cart = setLineQty(cart, cart[0].key, 2).cart;
  cart = addLine(cart, noodles).cart; cart = setLineQty(cart, cart[1].key, 3).cart;
  const t = previewTotals(cart, { type: "fixed", value: 20 });
  assert.deepEqual([t.subtotal, t.discount, t.tax, t.total, t.error], [280, 20, 0, 260, null]);
});
test("an invalid or oversized discount is ignored (and explained), so the total can never go below zero", () => {
  const cart = addLine([], coke).cart;
  for (const d of [{ type: "fixed", value: 80.01 }, { type: "percent", value: 101 }, { type: "percent", value: 0 }, { type: "fixed", value: -5 }, { type: "fixed", value: NaN }]) {
    const t = previewTotals(cart, d); assert.ok(t.error, JSON.stringify(d)); assert.equal(t.total, 80);
  }
  assert.equal(previewTotals(cart, { type: "percent", value: 100 }).total, 0);
});
test("parseDiscount: empty = none; junk = an error that is never sent", () => {
  assert.deepEqual(parseDiscount("percent", ""), { discount: null, error: null });
  assert.deepEqual(parseDiscount("percent", "12.5").discount, { type: "percent", value: 12.5 });
  for (const bad of ["abc", "-5", "0", "1e2", "5%", "..5"]) assert.ok(parseDiscount("fixed", bad).error, bad);
  assert.ok(parseDiscount("percent", "150").error);
});

test("cash: Rs. 850 total, 1000 received → change 150; short cash is flagged", () => {
  assert.deepEqual(cashChange(850, "1000"), { received: 1000, change: 150, short: 0, ok: true });
  assert.deepEqual(cashChange(850, "850"), { received: 850, change: 0, short: 0, ok: true });
  const short = cashChange(850, "800"); assert.deepEqual([short.ok, short.short, short.change], [false, 50, 0]);
  assert.equal(cashChange(850, "").ok, false); assert.equal(cashChange(850, "abc").ok, false);
  assert.equal(cashChange(0, "").ok, true, "a zero sale needs no cash");
  assert.equal(cashChange(0.3, "0.1").short, 0.2, "no floating-point residue");
});
test("quick tenders start with the exact amount and round up", () => {
  const q = quickTenders(850); assert.equal(q[0], 850); assert.ok(q.includes(1000)); assert.ok(q.every((v) => v >= 850));
  assert.equal(quickTenders(12.34)[0], 12.34);
});

test("request ids are valid for the server (16–64 of [A-Za-z0-9_-]) and unique", () => {
  const ids = new Set(Array.from({ length: 200 }, newRequestId));
  assert.equal(ids.size, 200); for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{16,64}$/);
});
test("the request carries WHAT is sold and how it was paid — never prices or tax as truth", () => {
  const cart = addLine([], { ...coke, variantId: "1l" }).cart;
  const body = buildSaleRequest({ store: "store-01", cart, discount: { type: "percent", value: 10 }, customerName: " Ram ", payment: "cash", received: 100, expectedTotal: 72, idempotencyKey: "k".repeat(20) });
  assert.deepEqual(body.items, [{ productId: "coke", variantId: "1l", qty: 1 }]);
  assert.deepEqual([body.paymentMethod, body.amountReceived, body.expectedTotal, body.customerName], ["cash", 100, 72, "Ram"]);
  for (const forbidden of ["unitPrice", "price", "total", "subtotal", "tax"]) { assert.ok(!(forbidden in body) && !(forbidden in body.items[0]), forbidden); }
  assert.ok(!("amountReceived" in buildSaleRequest({ store: "s", cart, payment: "upi", received: 5, expectedTotal: 80, idempotencyKey: "k".repeat(20) })));
});
