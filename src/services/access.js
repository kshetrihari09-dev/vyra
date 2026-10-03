/* Role resolution — one place that answers "who is this, and which shell may
   they see?". It reads the existing session and shop-application state; it
   does not add a second auth system.

     customer   → /customer/*
     shop owner → /customer/* and /shop/* (their own shop only)
     staff      → the demo/reviewer identity: may preview any shop */

import { areaOf } from "./router.js";

export function approvedApplication(session, shopApplications = []) {
  const phone = session?.user?.phone;
  if (!phone) return null;
  return shopApplications.find((a) => a.status === "approved" && a.sellerId && a.owner?.mobile === phone) || null;
}

/** The seller record this session owns, if any. Derived, so signing in again
    after approval still finds the shop. */
export function ownedSellerId(session, shopApplications) {
  return session?.shopOwnerSellerId || approvedApplication(session, shopApplications)?.sellerId || null;
}

/** Admin console access: signed in AND holding the "admin" role (assigned only in the database).
    UI gate only — the API re-checks permissions from the database on every request. */
export const isAdmin = (session) => !!session?.signedIn && (session.roles || []).includes("admin");

/** Permission checks read the session's permission list (loaded from the API). UI gates only — the API re-checks everything. */
export const hasPermission = (session, perm) => !!session?.signedIn && (session.permissions || []).includes(perm);

/** The rider/delivery app is for people holding `delivery:rider` — NOT merely any staff member. */
export const canUseRiderApp = (session) => hasPermission(session, "delivery:rider");

/** Already a rider = holds the `delivery` role. Not the same as having the permission: an administrator holds every permission
    but is not a rider, and should still be offered "Become a rider". */
export const isRider = (session) => !!session?.signedIn && (session.roles || []).includes("delivery");

/** Dispatch & rider management (the admin console's Riders section and the assign sheet). */
export const canManageDelivery = (session) => hasPermission(session, "delivery:manage");

export function roleOf(session, shopApplications) {
  if (ownedSellerId(session, shopApplications)) return "shop_owner";
  if (session?.isStaff) return "staff";
  return "customer";
}

/** Which shop the dashboard shows. Shop owners are locked to their own shop;
    staff can preview any (existing demo behaviour). */
export function resolveSeller({ session, shopApplications, sellers, currentSellerId }) {
  const owned = ownedSellerId(session, shopApplications);
  if (owned) {
    const seller = sellers.find((s) => s.id === owned);
    return seller ? { seller, locked: true } : null;
  }
  if (session?.isStaff) {
    const seller = sellers.find((s) => s.id === currentSellerId) || sellers[0];
    return seller ? { seller, locked: false } : null;
  }
  return null;
}

/** Route guard. Returns { ok: true } or { ok: false, reason }. */
export function checkAccess(view, session, shopApplications, sellers, currentSellerId) {
  if (areaOf(view) !== "shop") return { ok: true };
  const resolved = resolveSeller({ session, shopApplications, sellers, currentSellerId });
  return resolved ? { ok: true } : { ok: false, reason: "not_shop_owner" };
}
