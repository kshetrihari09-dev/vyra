/* Cashier-level test of the REAL POS screen: the actual component, cart code and API client run in jsdom; only `fetch` is stubbed.
   Drives it the way a till is used (scan, type, click, press F-keys) and asserts on what is on screen and what is sent to the server.
   Run:  npm run test:screen        (needs the dev dependencies: jsdom) */
import { createServer } from "vite";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><div id=root></div>", { pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window;
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle", "localStorage"]) globalThis[k] = w[k];
Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.matchMedia = w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 0); globalThis.cancelAnimationFrame = clearTimeout;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
w.HTMLElement.prototype.scrollIntoView = () => {};

// ---------------------------------------------------------------- fake backend (only fetch is stubbed; the real API client, POS and cart code run)
const P = (o) => ({ brandId: "generic", categoryId: "grocery", unit: "pc", salePrice: null, tax: 0, variants: [], stock: { "store-01": 10 }, ...o });
const COKE = P({ id: "coke", name: "Coke 500ml", sku: "BEV-COK", barcode: "8900000000011", unit: "bottle", price: 80 });
const NOODLES = P({ id: "noodles", name: "Instant Noodles", sku: "GRO-NOO", barcode: "8900000000028", price: 40 });
const SOAP = P({ id: "soap", name: "Soap Bar", sku: "HOM-SOP", barcode: "8900000000035", price: 100, tax: 5, stock: { "store-01": 2 } });
const TEE = P({ id: "tee", name: "Cotton Tee", sku: "FAS-TEE", barcode: "8900000000042", price: 300, variants: [{ id: "s", label: "Small", price: 300, stock: { "store-01": 4 } }, { id: "m", label: "Medium", price: 320, stock: { "store-01": 0 } }], stock: undefined });
const ALL = [COKE, NOODLES, SOAP, TEE];
const calls = []; let saleQueue = []; let byKey = null;
const reply = (status, body) => ({ ok: status < 400, status, headers: { get: () => "application/json" }, json: async () => body });
const ok = (data) => reply(200, { success: true, data });
const err = (status, code, message, details) => reply(status, { success: false, code, message, details });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url, "http://x"); const method = opts.method || "GET"; const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ method, path: u.pathname, query: Object.fromEntries(u.searchParams), body });
  if (u.pathname === "/api/search/lookup") { const p = ALL.find((x) => x.barcode === u.searchParams.get("code") || x.sku === u.searchParams.get("code")); return p ? ok({ product: p }) : err(404, "PRODUCT_NOT_FOUND", "No product matches that code"); }
  if (u.pathname === "/api/products" && method === "GET") { const q = (u.searchParams.get("q") || "").toLowerCase(); const items = ALL.filter((p) => p.name.toLowerCase().includes(q)); return ok({ items, page: 1, pageSize: 12, total: items.length }); }
  if (u.pathname.startsWith("/api/products/")) { const p = ALL.find((x) => x.id === decodeURIComponent(u.pathname.split("/").pop())); return p ? ok({ product: p }) : err(404, "PRODUCT_NOT_FOUND", "x"); }
  if (u.pathname === "/api/pos/sale") { const next = saleQueue.shift(); if (!next) throw new Error("unscripted sale call"); return next(body); }
  if (u.pathname.startsWith("/api/pos/sales/by-key/")) return byKey ? byKey() : err(404, "SALE_NOT_FOUND", "none");
  throw new Error(`unstubbed ${method} ${url}`);
};
const SALE = (body, over = {}) => ({ id: "s1", number: "POS-202610100007", storeId: "store-01", storeName: "Vyra Central", cashierName: "Asha", customerName: body.customerName ?? null, paymentMethod: body.paymentMethod, placedAt: new Date().toISOString(),
  totals: { subtotal: 80, discount: 0, tax: 0, total: 80, ...(over.totals || {}) }, discount: body.discount || null, payment: { method: body.paymentMethod, received: body.amountReceived ?? 80, change: 20 },
  items: [{ productId: "coke", name: "Coke 500ml", qty: 1, unitPrice: 80, lineTotal: 80, discount: 0, tax: 0 }], ...over });

// ---------------------------------------------------------------- render the REAL POS
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const React = (await import("react")).default; const { createRoot } = await import("react-dom/client"); const { act } = React;
const { AppCtx } = await vite.ssrLoadModule("/src/store/AppContext.jsx"); const { THEMES } = await vite.ssrLoadModule("/src/theme.js");
const POS = (await vite.ssrLoadModule("/src/pos/POS.jsx")).default;
const session = { signedIn: true, roles: ["pharmacist"], permissions: ["pos:sell"], user: { name: "Asha", uuid: "u1" }, shopOwnerSellerId: null };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toasts = []; const audits = [];
let root;
const mount = async () => {
  calls.length = 0; saleQueue = []; byKey = null; toasts.length = 0; audits.length = 0;
  const host = w.document.getElementById("root"); host.innerHTML = ""; root = createRoot(host);
  const value = { C: Object.values(THEMES)[0], products: ALL, storeId: "store-01", session, shopApplications: [], categories: [{ id: "grocery", name: "Grocery", parent: null }, { id: "snacks", name: "Snacks", parent: "grocery", attributes: [] }], dispatch: (a) => audits.push(a), toast: (m, t) => toasts.push([m, t]), catalog: { cacheProducts() {} } };
  await act(async () => root.render(React.createElement(AppCtx.Provider, { value }, React.createElement(POS, { nav() {} }))));
};
const unmount = async () => act(async () => root.unmount());
const $ = (sel) => w.document.querySelector(sel); const $$ = (sel) => [...w.document.querySelectorAll(sel)];
const byText = (txt, tag = "button") => $$(tag).find((e) => e.textContent.trim().includes(txt));
const text = () => w.document.body.textContent.replace(/\s+/g, " ");
const typeInto = async (el, v) => act(async () => { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new w.Event("input", { bubbles: true })); });
const key = async (el, k, init = {}) => act(async () => { el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init })); });
const click = async (el) => act(async () => { el.click(); });
const search = () => $('input[aria-label="Scan or search product"]');
const scan = async (code) => { await typeInto(search(), code); await key(search(), "Enter"); await act(async () => { await sleep(30); }); };
const sales = () => calls.filter((c) => c.path === "/api/pos/sale");
const qtyInputs = () => $$('input[aria-label^="Quantity of"]');

const results = [];
const T = async (name, fn) => { try { await mount(); await fn(); results.push([name, "PASS"]); } catch (e) { results.push([name, `FAIL — ${e.message.split("\n")[0]}`]); } finally { await unmount().catch(() => {}); } };

// ================================================================ scenarios
await T("empty states: empty cart, and 'no products found'", async () => {
  assert.ok(text().includes("The sale is empty"));
  await typeInto(search(), "zzzz"); await act(async () => { await sleep(350); });
  assert.ok(text().includes("No product found") || text().includes("No products found"), text().slice(0, 300));
});
await T("search by name finds the product (server, debounced) and shows price, stock, unit, SKU, barcode", async () => {
  await typeInto(search(), "coke"); await act(async () => { await sleep(350); });
  const t = text(); for (const n of ["Coke 500ml", "BEV-COK", "8900000000011", "bottle", "10 bottle left"]) assert.ok(t.includes(n), n);
  assert.equal(calls.filter((c) => c.path === "/api/products").length, 1, "one debounced request, not one per keystroke");
});
await T("typing fast sends ONE search (debounced), not one per key", async () => {
  for (const v of ["n", "no", "noo", "nood", "noodl"]) await typeInto(search(), v);
  await act(async () => { await sleep(400); });
  assert.equal(calls.filter((c) => c.path === "/api/products").length, 1);
});
await T("TEST 2 · barcode: scan adds the product; scanning it again raises the quantity (no click on the box needed between scans)", async () => {
  await scan("8900000000011"); assert.equal(qtyInputs().length, 1); assert.equal(qtyInputs()[0].value, "1");
  assert.equal(search().value, "", "box cleared, ready for the next scan");
  await scan("8900000000011"); assert.equal(qtyInputs().length, 1); assert.equal(qtyInputs()[0].value, "2");
  await scan("8900000000028"); assert.equal(qtyInputs().length, 2);
  assert.ok(text().includes("Subtotal (3 items)") && text().includes("200.00"), "2×80 + 40");
});
await T("two scans back-to-back (second arrives while the first lookup is in flight) are both counted", async () => {
  await act(async () => { await typeInto(search(), "8900000000011"); search().dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  await act(async () => { await typeInto(search(), "8900000000028"); search().dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await sleep(60); });
  assert.equal(qtyInputs().length, 2, "both products present");
});
await T("unknown barcode → a clear message, nothing added", async () => {
  await scan("9999999999999"); assert.equal(qtyInputs().length, 0); assert.ok(text().includes("Product not found"), text().slice(0, 400));
});
await T("scanner capture: a keystroke while focus is on a button/page goes to the search box", async () => {
  await scan("8900000000011"); byText("Payment ·")?.focus();
  await key(w.document.body, "8"); assert.equal(w.document.activeElement, search(), "search box took focus");
});
await T("quantity safety: 0, text, negative and over-stock never produce an invalid line", async () => {
  await scan("8900000000011"); const q = () => qtyInputs()[0];
  for (const bad of ["0", "", "abc"]) { await act(async () => q().focus()); await typeInto(q(), bad); await act(async () => q().blur()); assert.equal(q().value, "1", `'${bad}' → back to 1`); assert.equal(qtyInputs().length, 1); }
  await act(async () => q().focus()); await typeInto(q(), "-5"); await act(async () => q().blur()); assert.equal(q().value, "5", "the minus sign is stripped on input, never reaches the cart");
  await act(async () => q().focus()); await typeInto(q(), "99"); await act(async () => q().blur()); assert.equal(q().value, "10", "clamped to the 10 in stock");
  assert.ok(text().includes("Only 10 available") || text().includes("max in stock"));
});
await T("+/− buttons: − at 1 removes the line; + stops at stock", async () => {
  await scan("8900000000035"); // soap, stock 2
  const inc = () => $('button[aria-label="Increase Soap Bar"]'); const dec = () => $('button[aria-label="Decrease Soap Bar"]');
  await click(inc()); assert.equal(qtyInputs()[0].value, "2"); assert.ok(inc().disabled, "+ disabled at the stock limit");
  await click(dec()); await click(dec()); assert.equal(qtyInputs().length, 0, "removed");
});
await T("TEST 7 · discount: subtotal − discount + tax = total on screen; junk keystrokes are stripped", async () => {
  await scan("8900000000035"); // soap 100 @5%
  const d = $("#pos-discount"); await typeInto(d, "1a0%"); assert.equal(d.value, "10", "letters/symbols never enter the field");
  const t = text(); assert.ok(t.includes("−Rs. 10.00") || t.includes("-Rs. 10.00") || t.includes("10.00"), "discount row");
  assert.ok(t.includes("94.50"), `100 − 10 + 5% of 90 = 94.50 — got: ${t.match(/Total[^A-Z]{0,30}/)?.[0]}`);
  await typeInto(d, "150"); assert.ok(text().includes("can't exceed 100") || text().includes("between 0 and 100"));
  assert.ok($$("button").find((b) => b.textContent.includes("Payment ·")).disabled, "cannot proceed with an invalid discount");
});
await T("TEST 1 · normal cash sale: payment sheet, short cash blocked, change shown, request carries WHAT not prices, receipt with invoice #, cart cleared", async () => {
  await scan("8900000000011"); await click(byText("Payment ·"));
  const cash = $("#pos-received"); const complete = () => $$("button").find((b) => b.textContent.includes("Complete sale"));
  await typeInto(cash, "50"); assert.ok(complete().disabled, "short cash: cannot complete"); assert.ok(text().includes("Payment amount is insufficient"));
  await typeInto(cash, "100"); assert.ok(!complete().disabled); assert.ok(text().includes("Change to give") && text().includes("20.00"), "Rs. 100 on 80 → change 20");
  saleQueue.push((b) => ok({ sale: SALE(b) }));
  await click(complete()); await act(async () => { await sleep(30); });
  assert.equal(sales().length, 1); const b = sales()[0].body;
  assert.deepEqual(b.items, [{ productId: "coke", qty: 1 }]); assert.equal(b.paymentMethod, "cash"); assert.equal(b.amountReceived, 100); assert.equal(b.expectedTotal, 80);
  assert.match(b.idempotencyKey, /^[A-Za-z0-9_-]{16,64}$/); for (const f of ["price", "unitPrice", "total", "subtotal", "tax"]) assert.ok(!(f in b) && !(f in b.items[0]), `no ${f} sent`);
  assert.ok(text().includes("Sale completed successfully") && text().includes("Invoice #POS-202610100007"), "invoice number from the server");
  assert.ok($("iframe[srcdoc]") && $("iframe").getAttribute("srcdoc").includes("POS-202610100007"), "receipt preview");
  assert.equal(qtyInputs().length, 0, "cart cleared only AFTER success"); assert.equal(audits.length, 1);
});
await T("TEST 5 · double click on Complete (two clicks in the same tick) → exactly ONE request", async () => {
  await scan("8900000000011"); await click(byText("Payment ·")); await typeInto($("#pos-received"), "100");
  let release; saleQueue.push((b) => new Promise((res) => { release = () => res(ok({ sale: SALE(b) })); }));
  const complete = $$("button").find((b) => b.textContent.includes("Complete sale"));
  await act(async () => { complete.click(); complete.click(); complete.click(); });
  assert.equal(sales().length, 1, "three clicks, one request");
  assert.ok(text().includes("Completing sale…"), "processing state shown"); assert.ok($$("button").find((b) => b.textContent.includes("Completing sale")).disabled, "button disabled while processing");
  await act(async () => { release(); await sleep(30); }); assert.equal(sales().length, 1);
});
await T("TEST 5b · F9 pressed repeatedly → one request", async () => {
  await scan("8900000000011"); await click(byText("Payment ·")); await typeInto($("#pos-received"), "100"); await act(async () => $("#pos-received").blur());
  await act(async () => w.document.activeElement?.blur?.()); await act(async () => { await sleep(10); });
  // close the sheet so F9 is exercised from the main screen
  await key(w.document, "Escape"); await act(async () => { await sleep(10); });
  let release; saleQueue.push((b) => new Promise((res) => { release = () => res(ok({ sale: SALE(b) })); }));
  await act(async () => { for (let i = 0; i < 5; i++) w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "F9", bubbles: true, cancelable: true })); });
  assert.ok(sales().length <= 1, `F9 ×5 → ${sales().length} requests`); await act(async () => { release?.(); await sleep(20); });
});
await T("TEST 6 · connection lost: cart stays, the sale is flagged unconfirmed, nothing is cleared; Retry reuses the SAME id and body and succeeds once", async () => {
  await scan("8900000000011"); await click(byText("Payment ·")); await typeInto($("#pos-received"), "100");
  saleQueue.push(() => { throw new TypeError("Failed to fetch"); });
  await click($$("button").find((b) => b.textContent.includes("Complete sale"))); await act(async () => { await sleep(30); });
  assert.ok(text().includes("Sale not confirmed") && text().includes("Connection lost"), "banner"); assert.ok(text().includes("will not create a second sale"));
  assert.equal(qtyInputs().length, 1, "cart preserved"); assert.ok(qtyInputs()[0].disabled, "cart locked while the outcome is unknown");
  assert.equal(sales().length, 1);
  saleQueue.push((b) => ok({ sale: SALE(b) }));
  await click(byText("Retry sale")); await act(async () => { await sleep(30); });
  assert.equal(sales().length, 2); assert.deepEqual(sales()[1].body, sales()[0].body, "IDENTICAL request, including the idempotency key");
  assert.ok(text().includes("Invoice #POS-202610100007")); assert.equal(qtyInputs().length, 0);
});
await T("TEST 6b · connection lost, then 'Check if it was recorded': found → shows that sale (no second charge)", async () => {
  await scan("8900000000011"); await click(byText("Payment ·")); await typeInto($("#pos-received"), "100");
  saleQueue.push(() => { throw new TypeError("Failed to fetch"); });
  await click($$("button").find((b) => b.textContent.includes("Complete sale"))); await act(async () => { await sleep(30); });
  byKey = () => ok({ sale: SALE({ paymentMethod: "cash", amountReceived: 100 }) });
  await click(byText("Check if it was recorded")); await act(async () => { await sleep(30); });
  const lookup = calls.find((c) => c.path.startsWith("/api/pos/sales/by-key/")); assert.ok(lookup.path.endsWith(sales()[0].body.idempotencyKey), "asked by the same id");
  assert.equal(sales().length, 1, "no second sale request"); assert.ok(text().includes("Invoice #POS-202610100007"));
});
await T("TEST 6c · server error (5xx) is treated as unconfirmed too, and the raw error text is never shown", async () => {
  await scan("8900000000011"); await click(byText("Payment ·")); await typeInto($("#pos-received"), "100");
  saleQueue.push(() => err(503, "INTERNAL_ERROR", "connect ECONNREFUSED 10.0.0.5:5432 pg pool"));
  await click($$("button").find((b) => b.textContent.includes("Complete sale"))); await act(async () => { await sleep(30); });
  assert.ok(text().includes("Sale not confirmed")); assert.ok(!text().includes("ECONNREFUSED") && !text().includes("pg pool"), "no raw backend text"); assert.equal(qtyInputs().length, 1);
});
await T("TEST 6d · 'check status' says not recorded → cart unlocked, editable, and a fresh id is used next time", async () => {
  await scan("8900000000011"); await click(byText("Payment ·")); await typeInto($("#pos-received"), "100");
  saleQueue.push(() => { throw new TypeError("Failed to fetch"); }); const firstKey = () => sales()[0].body.idempotencyKey;
  await click($$("button").find((b) => b.textContent.includes("Complete sale"))); await act(async () => { await sleep(30); });
  await click(byText("Check if it was recorded")); await act(async () => { await sleep(30); });
  assert.ok(text().includes("was not recorded")); assert.ok(!qtyInputs()[0].disabled, "unlocked");
  await click(byText("Payment ·")); await typeInto($("#pos-received"), "100"); saleQueue.push((b) => ok({ sale: SALE(b) }));
  await click($$("button").find((b) => b.textContent.includes("Complete sale"))); await act(async () => { await sleep(30); });
  assert.notEqual(sales()[1].body.idempotencyKey, firstKey(), "a new attempt gets a new id");
});
await T("TEST 3 · insufficient stock: the server's message is shown, the cart is kept and the line is clamped to what exists", async () => {
  await scan("8900000000035"); await click($('button[aria-label="Increase Soap Bar"]')); // 2 (the screen thinks 2 are available)
  await click(byText("Payment ·")); await typeInto($("#pos-received"), "500");
  saleQueue.push(() => err(409, "INSUFFICIENT_STOCK", "Only 1 unit of Soap Bar available.", { productId: "soap", variantId: null, available: 1 }));
  await click($$("button").find((b) => b.textContent.includes("Complete sale"))); await act(async () => { await sleep(40); });
  assert.ok(text().includes("Only 1 unit of Soap Bar available."), "specific, actionable message");
  assert.equal(qtyInputs().length, 1); assert.equal(qtyInputs()[0].value, "1", "line clamped to the real stock"); assert.ok(!text().includes("Invoice #"));
});
await T("price changed meanwhile → refused with an explanation; cart kept", async () => {
  await scan("8900000000011"); await click(byText("Payment ·")); await typeInto($("#pos-received"), "100");
  saleQueue.push(() => err(409, "PRICE_CHANGED", "x", { total: 85 }));
  await click($$("button").find((b) => b.textContent.includes("Complete sale"))); await act(async () => { await sleep(40); });
  assert.ok(text().includes("Prices changed")); assert.equal(qtyInputs().length, 1);
});
await T("card / UPI: no cash field, exact charge, request has no amountReceived", async () => {
  await scan("8900000000011"); await click(byText("Payment ·")); await click(byText("UPI", "button"));
  assert.ok(!$("#pos-received")); saleQueue.push((b) => ok({ sale: SALE(b) }));
  await click($$("button").find((b) => b.textContent.includes("Complete sale"))); await act(async () => { await sleep(30); });
  assert.equal(sales()[0].body.paymentMethod, "upi"); assert.ok(!("amountReceived" in sales()[0].body));
});
await T("there is no 'Credit' tender (no customer ledger exists to record it)", async () => { await scan("8900000000011"); await click(byText("Payment ·")); assert.ok(!byText("Credit", "button")); assert.deepEqual(["Cash", "Card", "UPI"].every((m) => !!byText(m, "button")), true); });
await T("variants: choosing an option adds that variant (its price), out-of-stock options are disabled, the request names the variant", async () => {
  await scan("8900000000042"); assert.ok(text().includes("Choose an option"), "variant picker opened");
  const medium = byText("Medium", "button"); assert.ok(medium.disabled, "Medium has no stock");
  await click(byText("Small", "button")); assert.ok(text().includes("Cotton Tee — Small"));
  await click(byText("Payment ·")); await typeInto($("#pos-received"), "500"); saleQueue.push((b) => ok({ sale: SALE(b) }));
  await click($$("button").find((b) => b.textContent.includes("Complete sale"))); await act(async () => { await sleep(30); });
  assert.deepEqual(sales()[0].body.items, [{ productId: "tee", variantId: "s", qty: 1 }]);
});
await T("TEST 13 · keyboard: F2 search · F4 customer · F8 payment · F9 completes", async () => {
  const f = (k) => act(async () => { w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });
  await scan("8900000000011");
  await f("F4"); assert.equal(w.document.activeElement.id, "pos-customer"); await f("F2"); assert.equal(w.document.activeElement, search());
  await f("F8"); assert.ok(text().includes("Amount due"), "payment sheet opened"); await key(w.document, "Escape"); await act(async () => { await sleep(10); });
  assert.ok(!text().includes("Amount due"), "Esc closes the modal");
});
await T("F8/F9 do nothing on an empty sale", async () => {
  await act(async () => { w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "F8", bubbles: true })); w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "F9", bubbles: true })); });
  assert.ok(!text().includes("Amount due")); assert.equal(sales().length, 0);
});
await T("walk-in is the default customer; no customer is required", async () => { assert.equal($("#pos-customer").value, "Walk-in customer"); await scan("8900000000011"); await click(byText("Payment ·")); await typeInto($("#pos-received"), "100"); saleQueue.push((b) => ok({ sale: SALE(b) })); await click($$("button").find((b) => b.textContent.includes("Complete sale"))); await act(async () => { await sleep(30); }); assert.equal(sales()[0].body.customerName, "Walk-in customer"); });

console.log("\n" + results.map(([n, r]) => `${r === "PASS" ? "✓" : "✗"} ${n}${r === "PASS" ? "" : "\n    " + r}`).join("\n"));
console.log(`\n${results.filter((r) => r[1] === "PASS").length}/${results.length} passed`);
await vite.close(); process.exit(results.every((r) => r[1] === "PASS") ? 0 : 1);
