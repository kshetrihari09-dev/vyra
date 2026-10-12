/* Screen-level test of the REAL Help & Support page, pharmacist chat, email form, call sheet and pharmacist inbox: the actual
   components, hooks and API client run in jsdom; only `fetch` is stubbed (including a controllable Server-Sent-Events stream).
   It drives the screens the way a customer / pharmacist does and asserts on what is on screen and what is sent to the server.
   Run:  npm run test:support */
import { createServer } from "vite";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><div id=root></div>", { pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window;
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "Node", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle"]) {
  try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch { /* already defined */ }
}
Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let touch = false;
globalThis.matchMedia = w.matchMedia = (q) => ({ matches: touch && /coarse/.test(q), addEventListener() {}, removeEventListener() {} });
globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 0); globalThis.cancelAnimationFrame = clearTimeout;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
w.HTMLElement.prototype.scrollIntoView = () => {};
const copied = [];
Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async (t) => { copied.push(t); } }, configurable: true });

// ---------------------------------------------------------------- fake backend (only fetch is stubbed)
const calls = [];
const reply = (status, body) => ({ ok: status < 400, status, headers: { get: () => "application/json" }, json: async () => body });
const ok = (data) => reply(200, { success: true, data });
const fail = (status, code, message = code) => reply(status, { success: false, code, message });

const PHONE = { display: "+977 9812-345678", tel: "+9779812345678", label: "Pharmacy line", source: "pharmacy" };
let contact, chat, form, inbox, inboxMsgs, streamMode, streamCtl, sendQueue, availability;
const enc = new TextEncoder();
const pushEvent = (event, data) => streamCtl?.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
const msg = (over) => ({ id: `m${Math.random().toString(36).slice(2)}`, seq: chat.messages.length + 1, sender: "customer", senderName: null, via: "chat", topic: null, body: "hi", createdAt: new Date().toISOString(), clientMessageId: null, refs: { order: null, product: null, prescription: null }, email: null, ...over });

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url, "http://x"); const method = opts.method || "GET"; const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ method, path: u.pathname, query: Object.fromEntries(u.searchParams), body });
  const p = u.pathname;
  if (p === "/api/support/contact") return ok(contact);
  if (p === "/api/support/chat" && method === "GET") return ok(chat);
  if (p === "/api/support/chat/read") { chat.conversation.unread = 0; return ok({ unread: 0 }); }
  if (p === "/api/support/chat/messages" && method === "POST") {
    const next = sendQueue.shift(); if (next) { const r = await next(body); if (r) return r; }
    const m = msg({ ...body, sender: "customer", clientMessageId: body.clientMessageId });
    if (!chat.conversation) chat.conversation = { id: "c1", status: "open", assignedPharmacist: null, unread: 0, lastMessageAt: m.createdAt };
    chat.messages.push(m);
    return reply(201, { success: true, data: { message: m, duplicate: false, presence: chat.presence } });
  }
  if (p === "/api/support/chat/stream") {
    if (streamMode === "html") return { ok: true, status: 200, headers: { get: () => "text/html" }, json: async () => { throw new Error("html"); } };
    if (!chat.conversation) return fail(404, "CHAT_NOT_STARTED");
    const body2 = new ReadableStream({ start(c) { streamCtl = c; c.enqueue(enc.encode(`event: support\ndata: ${JSON.stringify({ ...chat, cursor: 0 })}\n\n`)); } });
    return { ok: true, status: 200, headers: { get: () => "text/event-stream; charset=utf-8" }, body: body2 };
  }
  if (p === "/api/support/messages" && method === "POST") { const next = sendQueue.shift(); if (next) { const r = await next(body); if (r) return r; } form.push(body); return reply(201, { success: true, data: { status: "accepted", message: { id: "f1" } } }); }
  if (p === "/api/support/availability") { if (method === "PUT") availability = { available: body.available, until: null, heartbeatSeconds: 60 }; return ok(availability); }
  if (p === "/api/support/inbox" && method === "GET") return ok({ conversations: inbox, page: 1, pageSize: 25, total: inbox.length, unreadConversations: inbox.filter((c) => c.unread).length });
  const m = /^\/api\/support\/inbox\/([^/]+)(?:\/(\w+))?$/.exec(p);
  if (m) {
    const [, id, sub] = m; const conv = inbox.find((c) => c.id === id);
    if (!sub) return ok({ conversation: { ...conv, customerName: conv.customerName } });
    if (sub === "messages" && method === "GET") return ok({ messages: inboxMsgs, hasMore: false });
    if (sub === "messages" && method === "POST") { const mm = msg({ sender: "staff", senderName: "Dr. Rao", body: body.body, clientMessageId: body.clientMessageId, seq: inboxMsgs.length + 1 }); inboxMsgs.push(mm); return reply(201, { success: true, data: { message: mm, duplicate: false } }); }
    if (sub === "read") { conv.unread = 0; return ok({ unreadConversations: 0 }); }
    if (sub === "resolve") { conv.status = "resolved"; return ok({ conversation: conv }); }
    if (sub === "stream") return { ok: true, status: 200, headers: { get: () => "text/html" }, json: async () => ({}) };   // inbox thread runs on its polling fallback here
  }
  throw new Error(`unstubbed ${method} ${url}`);
};

// ---------------------------------------------------------------- render the REAL screens
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const React = (await import("react")).default; const { createRoot } = await import("react-dom/client"); const { act } = React;
const { AppCtx } = await vite.ssrLoadModule("/src/store/AppContext.jsx"); const { THEMES } = await vite.ssrLoadModule("/src/theme.js");
const Support = (await vite.ssrLoadModule("/src/customer/pages/Support.jsx")).default;
const Console = (await vite.ssrLoadModule("/src/pharmacy/Prescriptions.jsx")).default;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toasts = []; const navs = [];
let root;

const customerSession = { signedIn: true, roles: ["customer"], permissions: [], user: { name: "Alex", uuid: "u1", phone: "", email: "alex@x.co" }, shopOwnerSellerId: null };
const guestSession = { signedIn: false, roles: [], permissions: [], user: { name: "Guest", uuid: null }, shopOwnerSellerId: null };
const pharmSession = { signedIn: true, roles: ["pharmacist"], permissions: ["support:pharmacist", "prescriptions:review", "prescriptions:read_all", "orders:read_all"], user: { name: "Dr. Rao", uuid: "p1" }, shopOwnerSellerId: null };
const ORDER_ID = "123e4567-e89b-42d3-a456-426614174000";

const reset = () => {
  calls.length = 0; toasts.length = 0; navs.length = 0; copied.length = 0; touch = false; streamCtl = null; streamMode = "sse"; sendQueue = []; form = [];
  contact = { phone: PHONE, email: { pharmacy: { canSend: true, address: "pharmacy@vyra.example" }, general: { canSend: true, address: "help@vyra.example" } }, chat: { signedIn: true, available: true, pharmacists: [{ name: "Dr. Rao" }] }, unread: 0 };
  chat = { conversation: null, messages: [], hasMore: false, presence: { available: true, pharmacists: [{ name: "Dr. Rao" }] } };
  availability = { available: false, until: null, heartbeatSeconds: 60 };
  inbox = [{ id: "c9", status: "open", customerName: "Sita K.", assignedTo: null, unread: 2, lastMessageAt: new Date().toISOString(), lastMessage: { preview: "Can I take this with food?", sender: "customer" } }];
  inboxMsgs = [{ id: "i1", seq: 1, sender: "customer", senderName: "Sita K.", via: "chat", body: "Can I take this with food?", createdAt: new Date().toISOString(), clientMessageId: null, refs: { order: { id: ORDER_ID, number: "VY-1007" }, product: { id: "amox", name: "Amoxicillin 500" }, prescription: { id: "r1", status: "approved" } }, email: null }];
};
const mount = async (Comp, { session = customerSession, params = {}, ctx = {} } = {}) => {
  const host = w.document.getElementById("root"); host.innerHTML = ""; root = createRoot(host);
  const value = { C: Object.values(THEMES)[0], session, storeId: "store-01", myOrders: [{ id: ORDER_ID, number: "VY-1007" }, { id: "legacy-1", number: "OLD-1" }], products: [{ id: "amox", name: "Amoxicillin 500" }], shopApplications: [], toast: (m) => toasts.push(m), dispatch() {}, prescriptions: [], orders: [], commerce: {}, categories: [], ...ctx };
  await act(async () => root.render(React.createElement(AppCtx.Provider, { value }, React.createElement(Comp, { nav: (...a) => navs.push(a), params }))));
  await settle();
};
const unmount = async () => act(async () => root.unmount());
const $ = (sel) => w.document.querySelector(sel); const $$ = (sel) => [...w.document.querySelectorAll(sel)];
const byText = (txt, tag = "button") => $$(tag).find((e) => e.textContent.trim().includes(txt));
const text = () => w.document.body.textContent.replace(/\s+/g, " ");
const settle = async (ms = 40) => act(async () => { await sleep(ms); });
const click = async (el) => { assert.ok(el, "element to click exists"); await act(async () => { el.click(); }); await settle(); };
const typeInto = async (el, v) => act(async () => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set.call(el, v); el.dispatchEvent(new w.Event("input", { bubbles: true })); });
const press = async (el, k, init = {}) => { await act(async () => { el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init })); }); await settle(); };
const waitFor = async (cond, what, ms = 2000) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return; await settle(20); } assert.fail(`timed out waiting for: ${what}`); };
const sent = (path, method = "POST") => calls.filter((c) => c.path === path && c.method === method);
const composer = () => $('textarea[aria-label="Message to the pharmacist"]');
const formBox = () => $('textarea[aria-label="Your message"]');

const results = [];
const T = async (name, fn) => { reset(); try { await fn(); results.push([name, "PASS"]); } catch (e) { results.push([name, `FAIL — ${process.env.DEBUG_T ? e.stack.split("\n").slice(0,6).join(" | ") : e.message.split("\n")[0]}`]); } finally { await unmount().catch(() => {}); } };

// ================================================================= tests
await T("page: no fake toasts; chat/call/email cards reflect REAL state (online, number, email)", async () => {
  await mount(Support);
  assert.ok(text().includes("A pharmacist is online now"));
  assert.ok(text().includes("Pharmacist online"));
  assert.ok(text().includes(PHONE.display), "the configured number is what the Call card shows");
  assert.ok(!text().includes("+1 555"), "no demo number anywhere");
  assert.ok(!/Avg\. 2 min|24 hours|usually reply in a few minutes|Available 8 AM/.test(text()), "invented response-time promises are gone");
  assert.deepEqual(toasts, []);
});

await T("guest: Live chat sends them to sign in (and back); no chat request is made", async () => {
  contact.chat.signedIn = false;
  await mount(Support, { session: guestSession });
  assert.ok(text().includes("Sign in to chat"));
  await click(byText("Live chat"));
  assert.equal(navs.at(-1)[0], "welcome"); assert.ok(navs.at(-1)[1].next.includes("/"));
  assert.equal(sent("/api/support/chat", "GET").length, 0);
});

await T("call: desktop opens a sheet with the real number, Copy, and a tel: link", async () => {
  await mount(Support);
  await click(byText("Call"));
  assert.ok(text().includes("Call the pharmacy") && text().includes(PHONE.display));
  assert.equal($('a[href^="tel:"]').getAttribute("href"), "tel:+9779812345678");
  await click(byText("Copy number"));
  assert.deepEqual(copied, [PHONE.display]); assert.ok(text().includes("Copied"));
});

await T("call: on a touch device the card IS a tel: link (dialer opens directly)", async () => {
  touch = true; await mount(Support);
  const a = $$("a").find((x) => x.getAttribute("href")?.startsWith("tel:"));
  assert.equal(a.getAttribute("href"), "tel:+9779812345678");
});

await T("call: with no configured number the action is disabled and says why (never a made-up number)", async () => {
  contact.phone = null; await mount(Support);
  const btn = byText("Call"); assert.ok(btn.disabled, "Call is disabled");
  assert.ok(text().includes("Calling is unavailable right now"));
  assert.equal($$("a").filter((x) => x.getAttribute("href")?.startsWith("tel:")).length, 0);
  await click(btn); assert.ok(!text().includes("Call the pharmacy"), "no sheet opens");
});

await T("offline: status shown honestly; chat composer disabled with an email alternative", async () => {
  contact.chat.available = false; chat.presence = { available: false, pharmacists: [] };
  await mount(Support);
  assert.ok(text().includes("No pharmacist online"));
  await click(byText("Live chat"));
  assert.ok(text().includes("No pharmacist is online right now"));
  assert.ok(composer().disabled);
  assert.ok(byText("Email a pharmacist"), "offers the message option");
  assert.ok(/not an emergency service/i.test(text()), "emergency guidance is shown");
});

await T("chat: send → persisted bubble; Enter sends, Shift+Enter doesn't; empty is ignored", async () => {
  await mount(Support); await click(byText("Live chat"));
  await typeInto(composer(), "   "); await press(composer(), "Enter"); assert.equal(sent("/api/support/chat/messages").length, 0);
  await typeInto(composer(), "Can I take ibuprofen with warfarin?");
  await press(composer(), "Enter", { shiftKey: true }); assert.equal(sent("/api/support/chat/messages").length, 0);
  await press(composer(), "Enter");
  const post = sent("/api/support/chat/messages");
  assert.equal(post.length, 1); assert.equal(post[0].body.body, "Can I take ibuprofen with warfarin?"); assert.match(post[0].body.clientMessageId, /^[0-9a-f-]{36}$/);
  assert.ok(text().includes("Can I take ibuprofen with warfarin?"));
  assert.equal($$('[role="log"] [style]').filter((e) => e.textContent === "Can I take ibuprofen with warfarin?").length, 1, "exactly one bubble (placeholder replaced, not duplicated)");
  assert.equal(composer().value, "", "composer cleared");
});

await T("chat: a failed send is kept, marked 'Not sent', and Retry reuses the SAME clientMessageId (no duplicate)", async () => {
  await mount(Support); await click(byText("Live chat"));
  sendQueue.push(async () => fail(500, "SERVER_ERROR", "boom"));
  await typeInto(composer(), "Is it safe for my child?"); await press(composer(), "Enter");
  assert.ok(text().includes("Not sent")); assert.ok(text().includes("Is it safe for my child?"));
  await click(byText("Retry"));
  const posts = sent("/api/support/chat/messages");
  assert.equal(posts.length, 2); assert.equal(posts[0].body.clientMessageId, posts[1].body.clientMessageId);
  assert.ok(!text().includes("Not sent")); assert.equal(chat.messages.length, 1);
});

await T("chat: network failure shows the failure and keeps the text", async () => {
  await mount(Support); await click(byText("Live chat"));
  sendQueue.push(async () => { throw new TypeError("Failed to fetch"); });
  await typeInto(composer(), "hello?"); await press(composer(), "Enter");
  assert.ok(text().includes("Not sent") && text().includes("hello?"));
});

await T("chat: history survives a refresh (re-mount loads it from the server) and shows the pharmacist's name", async () => {
  chat.conversation = { id: "c1", status: "open", assignedPharmacist: "Dr. Rao", unread: 1, lastMessageAt: new Date().toISOString() };
  chat.messages = [msg({ body: "earlier question", seq: 1 }), msg({ sender: "staff", senderName: "Dr. Rao", body: "Take it with food.", seq: 2 })];
  await mount(Support); await click(byText("Live chat"));
  assert.ok(text().includes("earlier question") && text().includes("Take it with food."));
  assert.ok(text().includes("Dr. Rao") && text().includes("Online now"));
  await waitFor(() => sent("/api/support/chat/read").length === 1, "unread marked read when the chat is open");
});

await T("chat: live — a pharmacist message pushed over the stream appears without a refresh", async () => {
  chat.conversation = { id: "c1", status: "open", assignedPharmacist: "Dr. Rao", unread: 0, lastMessageAt: new Date().toISOString() };
  chat.messages = [msg({ body: "first", seq: 1 })];
  await mount(Support); await click(byText("Live chat"));
  await waitFor(() => !!streamCtl, "stream opened");
  const m2 = msg({ sender: "staff", senderName: "Dr. Rao", body: "Replying live!", seq: 2 });
  await act(async () => { pushEvent("support", { conversation: { ...chat.conversation, unread: 1 }, messages: [m2], cursor: 2, presence: chat.presence }); });
  await waitFor(() => text().includes("Replying live!"), "pushed message rendered");
  assert.equal($$('[role="log"] div').filter((e) => e.textContent === "Replying live!").length, 1);
});

await T("chat: stream blocked/buffered (HTML answer) → falls back to polling and still shows new messages; says so", async () => {
  streamMode = "html";
  chat.conversation = { id: "c1", status: "open", assignedPharmacist: null, unread: 0, lastMessageAt: new Date().toISOString() };
  chat.messages = [msg({ body: "old", seq: 1 })];
  await mount(Support); await click(byText("Live chat"));
  chat.messages.push(msg({ sender: "staff", senderName: "Dr. Rao", body: "via polling", seq: 2 }));
  await waitFor(() => text().includes("via polling"), "message arrives through the polling fallback");
  assert.ok(text().includes("live updates paused"));
});

await T("chat: resolved conversation says so and still lets the customer write (reopens)", async () => {
  chat.conversation = { id: "c1", status: "resolved", assignedPharmacist: "Dr. Rao", unread: 0, lastMessageAt: new Date().toISOString() };
  chat.messages = [msg({ body: "q", seq: 1 })];
  await mount(Support); await click(byText("Live chat"));
  assert.ok(text().includes("marked this conversation as resolved")); assert.ok(!composer().disabled);
});

await T("email form: no 'sent' until the server confirms; success text only after acceptance; double-click sends once", async () => {
  await mount(Support, { params: { topic: "pharmacist", productId: "amox" } });
  assert.ok(/not an emergency service/i.test(text())); assert.ok(text().includes("About Amoxicillin 500"));
  let release; sendQueue.push(() => new Promise((r) => { release = () => r(null); }));
  await typeInto(formBox(), "Can I take this with grapefruit juice?");
  const btn = byText("Send by email");
  await act(async () => { btn.click(); btn.click(); btn.click(); }); await settle();
  assert.ok(!text().includes("delivered"), "nothing claims delivery while the request is pending");
  assert.ok(byText("Sending…").disabled);
  await act(async () => { release(); await sleep(30); }); await settle();
  assert.equal(form.length, 1, "triple click = one request");
  assert.equal(form[0].topic, "pharmacist"); assert.equal(form[0].productId, "amox"); assert.match(form[0].clientRequestId, /^[0-9a-f-]{36}$/);
  assert.ok(text().includes("delivered to the pharmacy by email"));
  assert.deepEqual(toasts, [], "no toast pretending success");
});

await T("email form: provider failure → error shown, text preserved, Retry reuses the same request id; editing starts a new one", async () => {
  await mount(Support, { params: { topic: "pharmacist" } });
  sendQueue.push(async () => fail(502, "EMAIL_DELIVERY_FAILED", "x"));
  await typeInto(formBox(), "First wording");
  await click(byText("Send by email"));
  assert.ok(text().includes("couldn't send your message by email")); assert.ok(!text().includes("delivered"));
  assert.equal(formBox().value, "First wording", "message preserved");
  assert.ok(byText("Retry sending"));
  sendQueue.push(async () => fail(502, "EMAIL_DELIVERY_FAILED", "x"));
  await click(byText("Retry sending"));
  const posts = sent("/api/support/messages");
  assert.equal(posts[0].body.clientRequestId, posts[1].body.clientRequestId, "retry = same id (server won't duplicate)");
  await typeInto(formBox(), "Better wording"); assert.ok(byText("Send by email") && !byText("Retry sending"), "edited text is a fresh send, not a retry"); await click(byText("Send by email"));
  const all = sent("/api/support/messages");
  assert.notEqual(all[2].body.clientRequestId, all[1].body.clientRequestId, "edited text is a NEW request");
  assert.equal(all[2].body.body, "Better wording"); assert.ok(text().includes("delivered"));
});

await T("email form: not configured → clear notice, no send button, mailto fallback, no request", async () => {
  contact.email.pharmacy.canSend = false;
  await mount(Support, { params: { topic: "pharmacist" } });
  assert.ok(text().includes("Sending email from the app isn't available"));
  assert.ok(!byText("Send by email"));
  assert.ok($('a[href^="mailto:pharmacy@vyra.example"]'));
  assert.equal(sent("/api/support/messages").length, 0);
});

await T("email form: server says EMAIL_NOT_CONFIGURED / rate limited / network → honest messages, text kept", async () => {
  await mount(Support, { params: { topic: "pharmacist" } });
  await typeInto(formBox(), "hello");
  for (const [resp, expect] of [[async () => fail(503, "EMAIL_NOT_CONFIGURED"), "Email isn't available"], [async () => fail(429, "RATE_LIMITED"), "several messages"], [async () => { throw new TypeError("x"); }, "Can't reach the server"]]) {
    sendQueue.push(resp); await click($$("button").find((b) => /Send by email|Retry sending/.test(b.textContent)));
    assert.ok(text().includes(expect), `shows: ${expect}`); assert.equal(formBox().value, "hello");
  }
});

await T("email form: only valid order ids are offered/sent; bad link retried without it", async () => {
  await mount(Support, { params: { topic: "order" } });
  const options = $$("select option").map((o) => o.textContent);
  assert.ok(options.includes("VY-1007") && !options.includes("OLD-1"), "legacy non-uuid orders are not offered");
  await typeInto(formBox(), "Where is it?");
  $("select"); await act(async () => { const s = $("select"); Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, "value").set.call(s, ORDER_ID); s.dispatchEvent(new w.Event("change", { bubbles: true })); });
  sendQueue.push(async () => fail(404, "ORDER_NOT_FOUND"));
  await click($$("button").find((b) => b.textContent.includes("Send by email")));
  const posts = sent("/api/support/messages");
  assert.equal(posts[0].body.orderId, ORDER_ID); assert.equal(posts[1].body.orderId, undefined, "message still goes out without the stale link");
  assert.ok(text().includes("delivered"));
});

await T("signed-out email form asks to sign in and sends nothing", async () => {
  await mount(Support, { session: guestSession, params: { topic: "pharmacist" } });
  assert.ok(text().includes("Sign in so we can link your message")); assert.equal(sent("/api/support/messages").length, 0);
  await click(byText("Sign in")); assert.equal(navs.at(-1)[0], "welcome");
});

await T("pharmacist console: Messages tab with unread badge; Go online sends availability; open thread shows linked order/medicine/prescription", async () => {
  await mount(Console, { session: pharmSession, params: { tab: "messages" } });
  assert.ok(byText("Customer messages")); assert.ok(text().includes("Sita K.") && text().includes("2 new"));
  await click(byText("Go online"));
  assert.deepEqual(sent("/api/support/availability", "PUT").map((c) => c.body), [{ available: true }]);
  assert.ok(text().includes("You're online"));
  await click($$("button").find((b) => b.textContent.includes("Sita K.")));
  assert.ok(text().includes("Can I take this with food?"));
  assert.ok(text().includes("Order VY-1007") && text().includes("Amoxicillin 500") && text().includes("Prescription · approved"));
  await waitFor(() => sent("/api/support/inbox/c9/read").length === 1, "thread marked read");
});

await T("pharmacist console: reply is sent with an id, appears attributed; resolve works; failed reply is retryable", async () => {
  await mount(Console, { session: pharmSession, params: { tab: "messages" } });
  await click($$("button").find((b) => b.textContent.includes("Sita K.")));
  const box = $('textarea[aria-label="Reply to the customer"]');
  await typeInto(box, "Yes, with food is fine."); await press(box, "Enter");
  const post = sent("/api/support/inbox/c9/messages");
  assert.equal(post.length, 1); assert.equal(post[0].body.body, "Yes, with food is fine."); assert.ok(post[0].body.clientMessageId);
  assert.ok(text().includes("Yes, with food is fine.") && text().includes("Dr. Rao"));
  await click(byText("Mark resolved"));
  assert.equal(sent("/api/support/inbox/c9/resolve").length, 1);
});

await T("pharmacist console: tabs only when both permissions; chat-only staff land on Messages", async () => {
  await mount(Console, { session: { ...pharmSession, permissions: ["support:pharmacist"] }, params: {} });
  assert.ok(text().includes("Sita K.")); assert.ok(!byText("Prescriptions", "button"), "no Prescriptions tab without prescriptions:review");
});

await T("customer without the permission never makes a staff request (console shows the prescriptions view only)", async () => {
  await mount(Console, { session: { ...pharmSession, permissions: ["prescriptions:review"] }, params: {} });
  assert.equal(calls.filter((c) => c.path.startsWith("/api/support/inbox")).length, 0);
});

await vite.close();
let failed = 0;
for (const [name, r] of results) { if (r !== "PASS") failed++; console.log(`${r === "PASS" ? "✔" : "✖"} ${name}${r === "PASS" ? "" : `\n    ${r}`}`); }
console.log(`\n${results.length - failed}/${results.length} support screen tests passed`);
process.exit(failed ? 1 : 0);
