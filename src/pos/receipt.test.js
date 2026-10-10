import test from "node:test";
import assert from "node:assert/strict";
import { receiptHtml, escapeHtml } from "./receipt.js";

const money = (n) => `Rs. ${Number(n).toFixed(2)}`;
const biz = { name: "Vyra Retail Ltd.", address: "12 Harbour Street", phone: "+1 555 0142" };
const sale = (over = {}) => ({
  number: "POS-202601010007", storeName: "Vyra Central", cashierName: "Asha", customerName: "Walk-in customer", placedAt: "2026-01-01T10:30:00Z",
  totals: { subtotal: 280, discount: 20, tax: 0, total: 260 }, discount: { type: "fixed", value: 20 },
  payment: { method: "cash", received: 300, change: 40 },
  items: [{ name: "Coke", qty: 2, unitPrice: 80, lineTotal: 160, discount: 11.43, tax: 0 }, { name: "Noodles", qty: 3, unitPrice: 40, lineTotal: 120, discount: 8.57, tax: 0 }], ...over,
});

test("a receipt carries every field a customer expects", () => {
  const h = receiptHtml(sale(), biz, money);
  for (const needle of ["Vyra Retail Ltd.", "Vyra Central", "#POS-202601010007", "Asha", "Walk-in customer", "Coke", "2 × Rs. 80.00", "Rs. 160.00", "Noodles", "Subtotal", "Rs. 280.00", "Discount", "−Rs. 20.00", "TOTAL", "Rs. 260.00", "Cash", "Received", "Rs. 300.00", "Change", "Rs. 40.00"]) assert.ok(h.includes(needle), needle);
});
test("percentage discounts are labelled; tax shows only when charged; no discount row when none", () => {
  assert.ok(receiptHtml(sale({ discount: { type: "percent", value: 10 } }), biz, money).includes("Discount (10%)"));
  const plain = receiptHtml(sale({ totals: { subtotal: 100, discount: 0, tax: 13, total: 113 }, discount: null, items: [{ name: "X", qty: 1, unitPrice: 100, lineTotal: 100, discount: 0, tax: 13 }] }), biz, money);
  assert.ok(plain.includes("Tax") && plain.includes("Rs. 13.00")); assert.ok(!plain.includes("Discount"));
});
test("card / UPI receipts have no Received/Change lines", () => {
  const h = receiptHtml(sale({ payment: { method: "upi", received: 260, change: 0 } }), biz, money);
  assert.ok(h.includes("UPI")); assert.ok(!h.includes("Received") && !h.includes("Change"));
});
test("every dynamic value is escaped — a hostile product or customer name prints as text", () => {
  const evil = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const h = receiptHtml(sale({ customerName: evil, cashierName: evil, storeName: evil, items: [{ name: evil, qty: 1, unitPrice: 1, lineTotal: 1, discount: 0, tax: 0 }] }), { name: evil, address: evil, phone: evil }, money);
  assert.ok(!h.includes("<img src=x") && !h.includes("<script>alert"), "no raw tag survives");
  assert.ok(h.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
});
test("escapeHtml", () => { assert.equal(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;"); assert.equal(escapeHtml(null), ""); });
test("is a self-contained 80 mm thermal document", () => { const h = receiptHtml(sale(), biz, money); assert.match(h, /^<!doctype html>/); assert.ok(h.includes("size: 80mm auto")); assert.ok(!/<link|<script/.test(h)); });
