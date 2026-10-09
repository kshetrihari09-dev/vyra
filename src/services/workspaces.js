/* Workspaces — "which parts of Vyra may this account use, and where should it land?"

   Pure functions only (no React, no storage, no network), so every rule is unit-tested in workspaces.test.js.
   It reads the SAME session the app already has (roles, permissions, shopOwnerSellerId) and the SAME access helpers
   (services/access.js) — it adds no second permission system. Everything here decides what to SHOW or where to GO;
   the API still re-checks roles and permissions on every request, so none of this grants access.

   Workspaces:   customer · shop · pos · pharmacy · delivery · admin
   Decision order after sign-in (resolveDestination):
     1. a valid, authorised deep link the user was heading to     (?next=…)
     2. an active task                                             (a rider's in-flight delivery)
     3. the last-used screen/workspace, if still authorised        (per-user, see lastWorkspace.js)
     4. the primary workspace                                      (admin, or the only business workspace the account has)
     5. otherwise the lightweight workspace chooser                (/workspaces)
   The result is never /welcome, so a sign-in can never bounce back to the login page. */

import { areaOf, matchLocation } from "./router.js";
import { hasPermission, isAdmin, isRider, canUseRiderApp } from "./access.js";

export const CUSTOMER = "customer";
export const SHOP = "shop";
export const POS = "pos";
export const PHARMACY = "pharmacy";
export const DELIVERY = "delivery";
export const ADMIN = "admin";

export const WORKSPACES = Object.freeze({
  [ADMIN]: { id: ADMIN, label: "Admin", sub: "Catalogue, orders, sellers and reports", icon: "ShieldCheck", home: { view: "admin", params: {} } },
  [SHOP]: { id: SHOP, label: "Shop", sub: "Products, orders, inventory and payouts", icon: "Store", home: { view: "shopDashboard", params: {} } },
  [POS]: { id: POS, label: "Point of Sale", sub: "In-store checkout", icon: "ScanLine", home: { view: "pos", params: {} } },
  [PHARMACY]: { id: PHARMACY, label: "Pharmacy", sub: "Verify prescriptions", icon: "Stethoscope", home: { view: "pharmacy", params: {} } },
  [DELIVERY]: { id: DELIVERY, label: "Delivery", sub: "Your runs and handovers", icon: "Bike", home: { view: "delivery", params: {} } },
  [CUSTOMER]: { id: CUSTOMER, label: "Customer", sub: "Shop and track your orders", icon: "ShoppingCart", home: { view: "home", params: {} } },
});

/** Display / priority order. Customer is always last: it is the base everyone has, never the reason to show a chooser. */
export const WORKSPACE_ORDER = Object.freeze([ADMIN, SHOP, POS, PHARMACY, DELIVERY, CUSTOMER]);

/**
 * The workspaces this account may use right now, in display order. `principal` is a session, or anything with the same
 * fields ({signedIn, roles, permissions, shopOwnerSellerId}); `ownsShop` lets the caller supply derived ownership.
 * Each rule mirrors a permission the backend enforces (see backend/src/config/permissions.js).
 */
export function availableWorkspaces(principal, { ownsShop } = {}) {
  if (!principal?.signedIn) return [CUSTOMER]; // guests: the storefront only
  const owns = ownsShop ?? !!principal.shopOwnerSellerId;
  const out = [];
  if (isAdmin(principal)) out.push(ADMIN);
  // A shop whose application is still pending has a seller row but no `seller:manage_own` yet: it is not a workspace until approved.
  if (isAdmin(principal) || (owns && hasPermission(principal, "seller:manage_own"))) out.push(SHOP);
  if (hasPermission(principal, "pos:sell")) out.push(POS);
  if (hasPermission(principal, "prescriptions:review")) out.push(PHARMACY);
  // Needs the rider ROLE too: an administrator holds every permission (including delivery:rider) but is not a rider.
  if (isRider(principal) && canUseRiderApp(principal)) out.push(DELIVERY);
  out.push(CUSTOMER);
  return out;
}

/**
 * The one workspace that is the obvious home, or null when it is genuinely ambiguous.
 * An administrator's other workspaces (shop preview, POS, pharmacy) are views onto what an admin already runs, so ADMIN wins.
 * Otherwise a single business workspace wins, and no business workspace means customer.
 * Two or more independent ones (e.g. shop owner + rider) is the case the chooser exists for.
 */
export function primaryWorkspace(available) {
  if (available.includes(ADMIN)) return ADMIN;
  const business = available.filter((w) => w !== CUSTOMER);
  if (business.length === 0) return CUSTOMER;
  return business.length === 1 ? business[0] : null;
}

// ---------------------------------------------------------------- views → workspaces
const SINGLE = { admin: ADMIN, pos: POS, pharmacy: PHARMACY, delivery: DELIVERY, deliveryRun: DELIVERY };
/** Views that belong to no workspace (sign-in, onboarding, the chooser itself). */
const NEUTRAL = new Set(["welcome", "workspaces", "shopOnboarding", "shopStatus"]);

/** Which workspace a view lives in, or null for views that belong to none. */
export function workspaceOfView(view) {
  if (NEUTRAL.has(view)) return null;
  if (SINGLE[view]) return SINGLE[view];
  return areaOf(view) === "shop" ? SHOP : CUSTOMER; // shop-area views are the seller dashboard; every other view is the storefront
}

/** May this account open this view? (A UI check — the API and the screens' own gates still decide.) */
export function canOpenView(view, available) {
  if (view === "welcome") return false;
  const ws = workspaceOfView(view);
  return ws === null ? true : available.includes(ws);
}

// ---------------------------------------------------------------- what is worth remembering
/* Allowlist: view → the params that may be stored with it. Anything not listed is never remembered — sign-in and registration,
   checkout and payment confirmations, order/product detail pages (they expire), error and access-denied screens, one-time links. */
const REMEMBER = Object.freeze({
  home: [],
  shopDashboard: [], shopProducts: [], shopInventory: [], shopOrders: [], shopCustomers: [], shopSales: [], shopOffers: [], shopPayouts: [], shopReports: [], shopSettings: [],
  pos: [], pharmacy: [], admin: [], delivery: [],
  deliveryRun: ["deliveryId"],
});
export const isRememberable = (view) => Object.prototype.hasOwnProperty.call(REMEMBER, view);

/** Reduce a route to what may be stored (known params only, plain strings). */
function cleanRoute(view, params = {}) {
  const keep = {};
  for (const k of REMEMBER[view] || []) if (params[k] != null && typeof params[k] !== "object") keep[k] = String(params[k]).slice(0, 80);
  return { view, params: keep };
}

/**
 * The record to store for "continue where you left off", or null when this screen isn't a meaningful workspace destination
 * or the account isn't authorised for it.
 */
export function rememberable(view, params, available) {
  if (!isRememberable(view) || !canOpenView(view, available)) return null;
  if (view === "deliveryRun" && !params?.deliveryId) return null;
  return { workspace: workspaceOfView(view), route: cleanRoute(view, params) };
}

export const LAST_TTL_MS = 60 * 24 * 60 * 60 * 1000; // a screen not used for two months is no longer "where you left off"

/** A stored record → the route to open, only if it is for THIS user, fresh, allowlisted and still authorised; otherwise null. */
export function validLast(last, available, userId, now = Date.now()) {
  if (!last || !userId || last.userId !== userId) return null;                  // never trust another account's record
  if (!(now - last.at < LAST_TTL_MS) || last.at > now + 60_000) return null;     // stale (or clock-skewed into the future)
  if (!available.includes(last.workspace)) return null;                          // permission was removed since: ignore it
  const r = last.route;
  if (r && isRememberable(r.view) && workspaceOfView(r.view) === last.workspace && canOpenView(r.view, available)
      && !(r.view === "deliveryRun" && !r.params?.deliveryId)) return { ...cleanRoute(r.view, r.params), workspace: last.workspace };
  return { ...WORKSPACES[last.workspace].home, workspace: last.workspace };      // the exact screen is gone: that workspace's own home
}

// ---------------------------------------------------------------- deep links
/**
 * `next` comes from a URL (/welcome?next=/shop/orders), so it is untrusted input. It is only ever parsed through the app's own
 * route table — never navigated to as a URL — which also means it can't be an open redirect. Unknown paths, protocol-relative
 * strings and the login page itself are rejected.
 */
export function parseNext(next) {
  if (typeof next !== "string" || next.length > 300 || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  const q = next.indexOf("?");
  const route = matchLocation(q < 0 ? next : next.slice(0, q), q < 0 ? "" : next.slice(q));
  return route && route.view !== "welcome" ? route : null;
}

/** Views that need a signed-in account to be meaningful. A signed-out visitor is sent to sign in (and brought back), not shown a "restricted" page.
    /admin is excluded on purpose: it has its own sign-in front door (AdminGate). */
export function requiresSignIn(view) {
  if (view === "welcome" || view === "shopOnboarding" || view === "shopStatus") return false;
  const ws = workspaceOfView(view);
  return ws !== CUSTOMER && ws !== ADMIN; // shop, pos, pharmacy, delivery, and the /workspaces chooser
}

// ---------------------------------------------------------------- the decision
/**
 * ONE decision for "where does this signed-in account go now?". Pure and synchronous.
 *   principal  the session
 *   userId     session.user.uuid (a stored record for any other id is ignored — shared devices)
 *   ownsShop   optional derived shop ownership
 *   next       the deep link the user was heading to (raw string from the URL), if any
 *   last       the stored record for this user, if any
 *   active     a rider's in-flight delivery ({id}) when the caller already knows it
 * → { view, params, reason: "deeplink" | "active-delivery" | "last-used" | "primary" | "choose" }
 */
export function resolveDestination({ principal, userId, ownsShop, next = null, last = null, active = null, now = Date.now() }) {
  const available = availableWorkspaces(principal, { ownsShop });

  const deep = parseNext(next);
  if (deep && canOpenView(deep.view, available)) return { ...deep, reason: "deeplink" };

  if (active?.id && available.includes(DELIVERY)) return { view: "deliveryRun", params: { deliveryId: String(active.id) }, reason: "active-delivery" };

  const l = validLast(last, available, userId, now);
  if (l) return { view: l.view, params: withResume(l.view, l.params), reason: "last-used" };

  const primary = primaryWorkspace(available);
  if (primary) { const h = WORKSPACES[primary].home; return { view: h.view, params: withResume(h.view, h.params), reason: "primary" }; }

  return { view: "workspaces", params: {}, reason: "choose" };
}

/** Landing on the Delivery app (rather than a specific run) opens the rider's in-flight delivery if there is one — the app loads its own runs, so this costs no request. */
const withResume = (view, params) => (view === "delivery" ? { ...params, resume: "active" } : params);

/** True when the account could be sent to the rider's active delivery but the app can't know that without asking the server (rider + other workspaces). */
export const needsActiveLookup = (available) => available.includes(DELIVERY) && primaryWorkspace(available) !== DELIVERY;
