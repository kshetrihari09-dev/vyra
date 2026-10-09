/* The single post-login decision, with the one optional server lookup it can need.

   Almost everything is decided from the session the login response already returned (roles, permissions, shop) plus the stored
   "last screen" — no request. The ONLY lookup is for an account that is a rider AND has other workspaces: the rider's in-flight
   delivery can't be known otherwise, and a delivery in progress outranks "last used". A rider-only account needs no lookup — it lands
   in the Delivery app, which loads its own runs anyway and opens the in-flight one (see DeliveryOrders). The lookup is bounded
   (LOOKUP_TIMEOUT_MS) and any failure just means "no active delivery known", never a blocked sign-in. */

import { availableWorkspaces, needsActiveLookup, parseNext, canOpenView, resolveDestination } from "./workspaces.js";

export const LOOKUP_TIMEOUT_MS = 2000;

const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve(null), ms));

/**
 * @param {object} args
 * @param {object} args.session      the signed-in session
 * @param {boolean} [args.ownsShop]
 * @param {string|null} args.next    raw ?next= value
 * @param {object|null} args.last    stored record for this account
 * @param {() => Promise<{id:string}|null>} [args.lookupActive]  returns the rider's in-flight delivery, or null
 * @returns {Promise<{view:string, params:object, reason:string}>}
 */
export async function resolvePostLogin({ session, ownsShop, next = null, last = null, lookupActive, timeoutMs = LOOKUP_TIMEOUT_MS }) {
  const base = { principal: session, userId: session?.user?.uuid, ownsShop, next, last };
  const first = resolveDestination(base);
  if (first.reason === "deeplink" || !lookupActive) return first;

  const available = availableWorkspaces(session, { ownsShop });
  if (!needsActiveLookup(available)) return first;

  let active = null;
  try { active = await Promise.race([lookupActive(), timeout(timeoutMs)]); } catch { active = null; }
  return active?.id ? resolveDestination({ ...base, active }) : first;
}

export { parseNext, canOpenView };
