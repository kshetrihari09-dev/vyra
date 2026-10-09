import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN, SHOP, POS, PHARMACY, DELIVERY, CUSTOMER, availableWorkspaces, primaryWorkspace, workspaceOfView, canOpenView,
  rememberable, validLast, parseNext, requiresSignIn, resolveDestination, needsActiveLookup, LAST_TTL_MS, WORKSPACES,
} from "./workspaces.js";
import { createLastStore } from "./lastWorkspace.js";
import { resolvePostLogin } from "./postLogin.js";
import { matchLocation, fromLocation, toPath, ROUTES } from "./router.js";
import { inFlightDelivery } from "../delivery/runFlow.js";

// ---- personas: the same shape the app's session has (roles/permissions come from the real role table in backend/src/config/permissions.js)
const base = { signedIn: true, roles: ["customer"], permissions: [], isStaff: false, shopOwnerSellerId: null };
const ALL = ["catalog:write", "inventory:read", "orders:read_all", "seller:manage_own", "pos:sell", "prescriptions:review", "delivery:manage", "delivery:rider", "reports:read", "users:manage"];
const P = {
  guest: { signedIn: false, roles: [], permissions: [], shopOwnerSellerId: null },
  customer: { ...base, user: { uuid: "u-cust" } },
  shop: { ...base, roles: ["seller"], isStaff: false, permissions: ["seller:manage_own", "catalog:write_own", "payouts:request"], shopOwnerSellerId: "s1", user: { uuid: "u-shop" } },
  pendingShop: { ...base, shopOwnerSellerId: "s2", user: { uuid: "u-pend" } }, // owns a seller row, not approved: no seller role yet
  rider: { ...base, roles: ["delivery"], isStaff: true, permissions: ["delivery:rider"], user: { uuid: "u-rider" } },
  riderShop: { ...base, roles: ["delivery", "seller"], isStaff: true, permissions: ["delivery:rider", "seller:manage_own", "catalog:write_own", "payouts:request"], shopOwnerSellerId: "s1", user: { uuid: "u-rs" } },
  admin: { ...base, roles: ["admin"], isStaff: true, permissions: ALL, user: { uuid: "u-admin" } },
  pharmacist: { ...base, roles: ["pharmacist"], isStaff: true, permissions: ["prescriptions:review", "prescriptions:read_all", "orders:read_all", "inventory:read", "pos:sell"], user: { uuid: "u-ph" } },
  warehouse: { ...base, roles: ["warehouse"], isStaff: true, permissions: ["inventory:read", "inventory:adjust", "orders:read_all"], user: { uuid: "u-wh" } },
};
const go = (who, extra = {}) => resolveDestination({ principal: P[who], userId: P[who].user?.uuid, ...extra });
const rec = (userId, workspace, view, params = {}, at = Date.now()) => ({ v: 1, userId, workspace, route: { view, params }, at });

// ---------------------------------------------------------------- who has which workspace
test("workspaces follow real permissions, not 'is staff'", () => {
  assert.deepEqual(availableWorkspaces(P.guest), [CUSTOMER]);
  assert.deepEqual(availableWorkspaces(P.customer), [CUSTOMER]);
  assert.deepEqual(availableWorkspaces(P.shop), [SHOP, CUSTOMER]);
  assert.deepEqual(availableWorkspaces(P.rider), [DELIVERY, CUSTOMER]);
  assert.deepEqual(availableWorkspaces(P.pharmacist), [POS, PHARMACY, CUSTOMER]);
  assert.deepEqual(availableWorkspaces(P.riderShop), [SHOP, DELIVERY, CUSTOMER]);
  assert.deepEqual(availableWorkspaces(P.warehouse), [CUSTOMER]); // staff, but nothing of theirs has a workspace of its own
});
test("an administrator has admin/shop/pos/pharmacy but is NOT a rider despite holding delivery:rider", () => {
  assert.deepEqual(availableWorkspaces(P.admin), [ADMIN, SHOP, POS, PHARMACY, CUSTOMER]);
});
test("a shop that is still pending approval is not a workspace yet", () => {
  assert.deepEqual(availableWorkspaces(P.pendingShop), [CUSTOMER]);
});
test("derived shop ownership (ownsShop) still needs the seller permission", () => {
  assert.deepEqual(availableWorkspaces({ ...P.customer, permissions: ["seller:manage_own"] }, { ownsShop: true }), [SHOP, CUSTOMER]);
  assert.deepEqual(availableWorkspaces(P.customer, { ownsShop: true }), [CUSTOMER]);
});

// ---------------------------------------------------------------- default destinations (spec §3)
test("customer → Customer Home", () => assert.deepEqual([go("customer").view, go("customer").reason], ["home", "primary"]));
test("shop owner → shop dashboard, not the storefront", () => assert.equal(go("shop").view, "shopDashboard"));
test("admin → admin console", () => assert.equal(go("admin").view, "admin"));
test("rider → Delivery app, flagged to open the in-flight run once its own list loads", () => {
  const d = go("rider");
  assert.equal(d.view, "delivery"); assert.deepEqual(d.params, { resume: "active" });
});
test("rider with a known active delivery → that delivery", () => {
  const d = go("rider", { active: { id: "d-123" } });
  assert.deepEqual([d.view, d.params, d.reason], ["deliveryRun", { deliveryId: "d-123" }, "active-delivery"]);
});
test("an active delivery is ignored for an account that is not a rider", () => assert.equal(go("shop", { active: { id: "d-1" } }).view, "shopDashboard"));
test("two independent business workspaces and nothing remembered → the lightweight chooser", () => {
  assert.equal(go("riderShop").view, "workspaces");
  assert.equal(go("pharmacist").view, "workspaces");
});
test("single obvious workspace never shows the chooser", () => {
  for (const who of ["customer", "shop", "rider", "admin", "warehouse", "pendingShop"]) assert.notEqual(go(who).view, "workspaces", who);
});
test("primaryWorkspace: admin dominates, a lone business workspace wins, ambiguity is null", () => {
  assert.equal(primaryWorkspace([ADMIN, SHOP, POS, CUSTOMER]), ADMIN);
  assert.equal(primaryWorkspace([SHOP, CUSTOMER]), SHOP);
  assert.equal(primaryWorkspace([CUSTOMER]), CUSTOMER);
  assert.equal(primaryWorkspace([SHOP, DELIVERY, CUSTOMER]), null);
});

// ---------------------------------------------------------------- continue where you left off (spec §4, §15, §20)
test("Open POS → logout → login → POS", () => {
  const d = go("pharmacist", { last: rec("u-ph", POS, "pos") });
  assert.deepEqual([d.view, d.reason], ["pos", "last-used"]);
});
test("last screen inside a workspace is restored (shop → Orders)", () => {
  assert.equal(go("riderShop", { last: rec("u-rs", SHOP, "shopOrders") }).view, "shopOrders");
});
test("multi-role: last-used workspace opens when still authorised", () => {
  assert.equal(go("admin", { last: rec("u-admin", SHOP, "shopProducts") }).view, "shopProducts");
});
test("rider's last screen was an active delivery → that run (the Delivery app then verifies it is still active)", () => {
  const d = go("rider", { last: rec("u-rider", DELIVERY, "deliveryRun", { deliveryId: "d-9" }) });
  assert.deepEqual([d.view, d.params.deliveryId, d.reason], ["deliveryRun", "d-9", "last-used"]);
});
test("PERMISSION CHANGED: last workspace Admin, no longer an admin → never opens Admin, falls back safely", () => {
  const stale = rec("u-shop", ADMIN, "admin");
  const d = go("shop", { last: stale });
  assert.equal(d.view, "shopDashboard"); assert.equal(d.reason, "primary");
  assert.equal(go("customer", { last: rec("u-cust", SHOP, "shopOrders") }).view, "home"); // stored SHOP, current CUSTOMER only → customer home
});
test("stored route no longer valid but the workspace is → that workspace's own home", () => {
  const d = go("shop", { last: rec("u-shop", SHOP, "checkout") }); // a view that is never remembered/allowed
  assert.equal(d.view, "shopDashboard");
  const d2 = go("shop", { last: rec("u-shop", CUSTOMER, "shopOrders") }); // route belongs to a different workspace than recorded
  assert.equal(d2.view, "home");
});
test("SHARED DEVICE: another account's record is ignored", () => {
  const theirs = rec("u-admin", ADMIN, "admin");
  const d = resolveDestination({ principal: P.shop, userId: "u-shop", last: theirs });
  assert.equal(d.view, "shopDashboard");
  assert.equal(resolveDestination({ principal: P.pharmacist, userId: "u-ph", last: rec("u-someone-else", POS, "pos") }).view, "workspaces");
});
test("stale (older than the TTL) or future-dated records are ignored", () => {
  const now = Date.now();
  assert.equal(go("riderShop", { last: rec("u-rs", SHOP, "shopOrders", {}, now - LAST_TTL_MS - 1), now }).view, "workspaces");
  assert.equal(go("riderShop", { last: rec("u-rs", SHOP, "shopOrders", {}, now + 10 * 60_000), now }).view, "workspaces");
});
test("a record without a user id never matches", () => {
  assert.equal(validLast(rec("u-shop", SHOP, "shopOrders"), [SHOP, CUSTOMER], undefined), null);
});

// ---------------------------------------------------------------- priority (spec §11)
test("deep link beats active task and last-used", () => {
  const d = go("riderShop", { next: "/shop/payouts", active: { id: "d-1" }, last: rec("u-rs", DELIVERY, "delivery") });
  assert.deepEqual([d.view, d.reason], ["shopPayouts", "deeplink"]);
});
test("active task beats last-used", () => {
  const d = go("riderShop", { active: { id: "d-1" }, last: rec("u-rs", SHOP, "shopOrders") });
  assert.deepEqual([d.view, d.reason], ["deliveryRun", "active-delivery"]);
});
test("deep link the account may not open is ignored → normal decision (never an access-denied page)", () => {
  assert.equal(go("customer", { next: "/shop/orders" }).view, "home");
  assert.equal(go("customer", { next: "/admin" }).view, "home");
  assert.equal(go("shop", { next: "/pos" }).view, "shopDashboard");
  assert.equal(go("rider", { next: "/admin" }).view, "delivery");
});
test("customer deep link survives (public storefront)", () => assert.equal(go("customer", { next: "/customer/orders/o-7" }).view, "orderDetails"));
test("admin deep link with a section and a rider's /delivery/:id", () => {
  assert.deepEqual(go("admin", { next: "/admin?section=orders" }).params, { section: "orders" });
  const d = go("rider", { next: "/delivery/d-5" });
  assert.deepEqual([d.view, d.params.deliveryId, d.reason], ["deliveryRun", "d-5", "deeplink"]);
});

// ---------------------------------------------------------------- deep-link input is untrusted
test("parseNext only accepts known in-app paths", () => {
  assert.equal(parseNext("/shop/orders").view, "shopOrders");
  for (const bad of ["//evil.com/x", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "/welcome", "/welcome?next=/pos", "/no/such/page", "/%E0%A4%A", "", null, undefined, 42, "/" + "a".repeat(400)]) {
    assert.equal(parseNext(bad), null, String(bad));
  }
});

// ---------------------------------------------------------------- what is (not) remembered (spec §5)
test("only meaningful workspace screens are remembered", () => {
  const avail = availableWorkspaces(P.admin);
  for (const v of ["welcome", "checkout", "orderConfirmed", "orderDetails", "trackOrder", "cart", "product", "search", "shopOrderDetails", "shopOnboarding", "shopStatus", "workspaces", "profile", "notifications"]) {
    assert.equal(rememberable(v, { orderId: "1" }, avail), null, v);
  }
  for (const v of ["home", "shopDashboard", "shopOrders", "pos", "pharmacy", "admin"]) assert.ok(rememberable(v, {}, avail), v);
  assert.equal(rememberable("delivery", {}, avail), null, "an admin is not a rider");
  assert.ok(rememberable("delivery", {}, availableWorkspaces(P.rider)));
});
test("params are stripped to the allowlist; a run is remembered only with its id", () => {
  const avail = availableWorkspaces(P.rider);
  assert.deepEqual(rememberable("delivery", { resume: "active", tab: "history", secret: "x" }, avail).route, { view: "delivery", params: {} });
  assert.deepEqual(rememberable("deliveryRun", { deliveryId: 123, other: "x" }, avail).route, { view: "deliveryRun", params: { deliveryId: "123" } });
  assert.equal(rememberable("deliveryRun", {}, avail), null);
});
test("a screen the account isn't authorised for is never remembered", () => {
  assert.equal(rememberable("admin", {}, availableWorkspaces(P.customer)), null);
  assert.equal(rememberable("pos", {}, availableWorkspaces(P.shop)), null);
});

// ---------------------------------------------------------------- authorisation helpers (spec §10)
test("customer cannot open admin / shop / pos / delivery; shop owner can open shop", () => {
  const c = availableWorkspaces(P.customer);
  for (const v of ["admin", "shopDashboard", "shopOrders", "pos", "pharmacy", "delivery", "deliveryRun"]) assert.equal(canOpenView(v, c), false, v);
  assert.equal(canOpenView("home", c), true);
  assert.equal(canOpenView("shopOrders", availableWorkspaces(P.shop)), true);
  assert.equal(canOpenView("welcome", c), false);
});
test("workspaceOfView covers every route in the table", () => {
  for (const r of ROUTES) {
    const ws = workspaceOfView(r.view);
    assert.ok(ws === null || WORKSPACES[ws], `${r.view} → ${ws}`);
  }
  assert.equal(workspaceOfView("shopOrderDetails"), SHOP);
  assert.equal(workspaceOfView("deliveryRun"), DELIVERY);
  assert.equal(workspaceOfView("orderDetails"), CUSTOMER);
});
test("signed-out visitors are sent to sign in for private workspaces only", () => {
  for (const v of ["shopOrders", "shopDashboard", "pos", "pharmacy", "delivery", "deliveryRun", "workspaces"]) assert.equal(requiresSignIn(v), true, v);
  for (const v of ["home", "product", "cart", "welcome", "admin", "shopOnboarding", "shopStatus"]) assert.equal(requiresSignIn(v), false, v);
});

// ---------------------------------------------------------------- loops (spec §13)
test("the decision NEVER returns the login page and always lands somewhere the account may open", () => {
  const nexts = [null, "/shop/orders", "/admin", "/pos", "/delivery/d-1", "/welcome", "/customer/cart", "//x", "/nope"];
  const lasts = (id) => [null, rec(id, ADMIN, "admin"), rec(id, SHOP, "shopOrders"), rec(id, DELIVERY, "deliveryRun", { deliveryId: "d" }), rec(id, POS, "pos"), rec(id, CUSTOMER, "home"), rec(id, SHOP, "welcome")];
  for (const who of Object.keys(P).filter((k) => k !== "guest")) {
    for (const next of nexts) for (const last of lasts(P[who].user.uuid)) for (const active of [null, { id: "d-1" }]) {
      const d = go(who, { next, last, active });
      assert.notEqual(d.view, "welcome", `${who}`);
      assert.ok(d.view === "workspaces" || canOpenView(d.view, availableWorkspaces(P[who])), `${who} → ${d.view}`);
    }
  }
});
test("feeding the destination back into the resolver as a deep link is stable (no ping-pong)", () => {
  for (const who of ["customer", "shop", "rider", "admin"]) {
    const d = go(who);
    const again = go(who, { next: toPath(d.view, d.params) });
    assert.equal(again.view, d.view, who);
  }
});

// ---------------------------------------------------------------- the one optional lookup (spec §17)
test("needsActiveLookup only for a rider who also has other workspaces", () => {
  assert.equal(needsActiveLookup(availableWorkspaces(P.rider)), false);
  assert.equal(needsActiveLookup(availableWorkspaces(P.riderShop)), true);
  assert.equal(needsActiveLookup(availableWorkspaces(P.shop)), false);
  assert.equal(needsActiveLookup(availableWorkspaces(P.admin)), false);
});
test("resolvePostLogin: rider-only, shop-only, customer and admin make NO request", async () => {
  let calls = 0; const lookupActive = async () => { calls++; return { id: "d-1" }; };
  for (const who of ["rider", "shop", "customer", "admin"]) await resolvePostLogin({ session: P[who], lookupActive });
  assert.equal(calls, 0);
});
test("resolvePostLogin: a valid deep link makes no request either", async () => {
  let calls = 0;
  const d = await resolvePostLogin({ session: P.riderShop, next: "/shop/orders", lookupActive: async () => { calls++; return { id: "d" }; } });
  assert.equal(calls, 0); assert.equal(d.view, "shopOrders");
});
test("resolvePostLogin: rider + shop does one lookup and an active delivery wins over last-used", async () => {
  let calls = 0;
  const d = await resolvePostLogin({ session: P.riderShop, last: rec("u-rs", SHOP, "shopOrders"), lookupActive: async () => { calls++; return { id: "d-77" }; } });
  assert.equal(calls, 1);
  assert.deepEqual([d.view, d.params.deliveryId, d.reason], ["deliveryRun", "d-77", "active-delivery"]);
});
test("resolvePostLogin: no active delivery → last-used", async () => {
  const d = await resolvePostLogin({ session: P.riderShop, last: rec("u-rs", SHOP, "shopOrders"), lookupActive: async () => null });
  assert.deepEqual([d.view, d.reason], ["shopOrders", "last-used"]);
});
test("resolvePostLogin: a failing or hanging lookup never blocks sign-in", async () => {
  const failed = await resolvePostLogin({ session: P.riderShop, last: rec("u-rs", SHOP, "shopOrders"), lookupActive: async () => { throw new Error("offline"); } });
  assert.equal(failed.view, "shopOrders");
  const t0 = Date.now();
  const hung = await resolvePostLogin({ session: P.riderShop, lookupActive: () => new Promise(() => {}), timeoutMs: 30 });
  assert.equal(hung.view, "workspaces"); assert.ok(Date.now() - t0 < 1000);
});

// ---------------------------------------------------------------- storage (spec §15, §16)
const fakeStorage = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
test("store: write → read round trip, keyed per account", () => {
  const st = fakeStorage(); const store = createLastStore(st);
  store.write("u1", { workspace: SHOP, route: { view: "shopOrders", params: {} } });
  assert.equal(store.read("u1").route.view, "shopOrders");
  assert.equal(store.read("u2"), null, "another account sees nothing");
  assert.deepEqual([...st.m.keys()], ["vyra:last:u1"]);
});
test("store: a record planted under another account's key is rejected (userId inside must match)", () => {
  const st = fakeStorage(); const store = createLastStore(st);
  st.setItem("vyra:last:u2", JSON.stringify({ v: 1, userId: "u1", workspace: ADMIN, route: { view: "admin", params: {} }, at: Date.now() }));
  assert.equal(store.read("u2"), null);
});
test("store: stores only a workspace name and a route — no tokens or personal data", () => {
  const st = fakeStorage(); createLastStore(st).write("u1", { workspace: DELIVERY, route: { view: "deliveryRun", params: { deliveryId: "d1" } } });
  assert.deepEqual(Object.keys(JSON.parse(st.m.get("vyra:last:u1"))).sort(), ["at", "route", "userId", "v", "workspace"]);
});
test("store: skips redundant writes, forgets on request, survives corrupt data and broken storage", () => {
  const st = fakeStorage(); let writes = 0; const orig = st.setItem; st.setItem = (k, v) => { writes++; orig(k, v); };
  const store = createLastStore(st); const e = { workspace: POS, route: { view: "pos", params: {} } };
  store.write("u1", e); store.write("u1", e); assert.equal(writes, 1);
  store.forget("u1"); assert.equal(store.read("u1"), null);
  st.setItem("vyra:last:u1", "{not json"); assert.equal(store.read("u1"), null);
  st.setItem("vyra:last:u1", JSON.stringify({ v: 99, userId: "u1" })); assert.equal(store.read("u1"), null);
  const broken = createLastStore({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("x"); } });
  assert.equal(broken.read("u1"), null); broken.write("u1", e); broken.forget("u1"); // none of these throw
  assert.equal(createLastStore(null).read("u1"), null);
});

// ---------------------------------------------------------------- router additions
test("router: /workspaces and /delivery/:deliveryId resolve and round-trip", () => {
  assert.deepEqual(matchLocation("/workspaces"), { view: "workspaces", params: {} });
  assert.deepEqual(matchLocation("/delivery/d-1"), { view: "deliveryRun", params: { deliveryId: "d-1" } });
  assert.equal(toPath("deliveryRun", { deliveryId: "d-1" }), "/delivery/d-1");
  assert.equal(toPath("delivery", { resume: "active" }), "/delivery?resume=active");
  assert.deepEqual(matchLocation("/welcome", "?next=%2Fpos"), { view: "welcome", params: { next: "/pos" } });
});
test("router: matchLocation is strict (null) while fromLocation keeps its home fallback; existing URLs unchanged", () => {
  assert.equal(matchLocation("/nope/x"), null);
  assert.equal(matchLocation("/"), null);
  assert.deepEqual(fromLocation("/nope/x"), { view: "home", params: {} });
  assert.equal(fromLocation("/pos").view, "pos");
  assert.equal(fromLocation("/admin", "?section=orders").params.section, "orders");
  assert.equal(fromLocation("/shop/orders/9").view, "shopOrderDetails");
  assert.equal(fromLocation("/seller").view, "shopDashboard");
  assert.equal(fromLocation("/customer/orders/9/track").view, "trackOrder");
});

// ---------------------------------------------------------------- rider in-flight rule
test("inFlightDelivery: accepted/picked-up only; collected parcels first; assigned never auto-opens", () => {
  assert.equal(inFlightDelivery([]), null);
  assert.equal(inFlightDelivery(null), null);
  assert.equal(inFlightDelivery([{ id: "a", status: "assigned" }]), null);
  assert.equal(inFlightDelivery([{ id: "a", status: "accepted" }, { id: "b", status: "picked_up" }]).id, "b");
  assert.equal(inFlightDelivery([{ id: "a", status: "assigned" }, { id: "c", status: "accepted" }]).id, "c");
});
