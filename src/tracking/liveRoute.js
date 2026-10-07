import { distanceKm } from "./format.js";

/**
 * When should the live road route be re-requested? Pure, so it can be unit-tested without a map.
 * Tuning (see LIVE_TRACKING.md): ~120 m of movement OR ~18 s while the rider is genuinely moving; a change of leg/destination
 * (pickup completed, new address, tracking start) is always immediate; a stale (not-updating) rider never triggers a request.
 */
export const ROUTE_MOVE_KM = 0.12;      // moved this far from the last request's origin → recalculate
export const ROUTE_REFRESH_MS = 18_000; // …or this long, if the rider has moved at all (not just GPS jitter)
export const ROUTE_JITTER_KM = 0.02;    // below ~20 m is treated as standing still
export const ROUTE_MIN_GAP_MS = 4_000;  // hard floor between two requests (rapid GPS bursts)
export const ROUTE_RETRY_MS = 20_000;   // after a failed request
export const ROUTE_KEEP_MS = 90_000;    // a previous route is kept this long if refreshes keep failing

/** Identifies what the live route leads to; when it changes the old line is no longer valid. */
export function legKey(phase, pickup, destination) {
  if (!destination) return "";
  const p = phase === "to_pickup" && pickup ? `${pickup.lat},${pickup.lng}>` : "";
  return `${phase === "to_pickup" && pickup ? "pickup" : "customer"}|${p}${destination.lat},${destination.lng}`;
}

/**
 * @param {{now:number, rider:{lat,lng}|null, key:string, stale:boolean,
 *          last:{at:number, from:{lat,lng}|null, key:string, failed:boolean}|null, inFlight?:boolean}} s
 * @returns {boolean}
 */
export function shouldRequestRoute({ now, rider, key, stale, last, inFlight = false }) {
  if (!rider || !key) return false;
  if (!last || last.key !== key) return true;              // tracking start, pickup completed, destination changed: immediately
  if (stale) return false;                                 // frozen GPS: never poll Directions from an unchanged point
  if (inFlight && now - last.at < ROUTE_REFRESH_MS) return false; // one request at a time unless it is clearly hung
  const gap = now - last.at;
  if (gap < ROUTE_MIN_GAP_MS) return false;
  const moved = last.from ? distanceKm(last.from, rider) : Infinity;
  if (last.failed) return gap >= ROUTE_RETRY_MS && moved >= 0;      // retry on the normal cadence
  if (moved >= ROUTE_MOVE_KM) return true;
  return gap >= ROUTE_REFRESH_MS && moved >= ROUTE_JITTER_KM;
}

/** Stale-response guard: only the newest request id may publish its result. */
export function createSequencer() {
  let latest = 0;
  return { next: () => ++latest, isLatest: (id) => id === latest, invalidate: () => { latest += 1; } };
}
