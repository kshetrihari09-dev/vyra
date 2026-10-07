import { distanceKm } from "./format.js";

/**
 * Pure helpers for the rider's navigation camera (heading-up map). No Mapbox, no DOM — unit-tested in navCamera.test.js.
 * Rotating the map is a purely local camera operation: nothing here (or in its caller) touches the route or the Directions API.
 */

export const NAV_ZOOM = 16;            // follow zoom: street level, enough road ahead to read the next turn
export const NAV_MIN_ZOOM = 14.5;      // recenter never leaves the rider zoomed out further than this
export const NAV_CAMERA_MS = 900;      // matches the rider marker's ease between fixes so the pin stays put on screen
export const NAV_TOP_PADDING = 0.4;    // share of the map height reserved above the rider ⇒ rider sits ~70 % of the way down

const MIN_MOVE_M = 8;                  // below this, movement is treated as GPS jitter (clamped up by poor accuracy)
const MAX_MOVE_M = 25;
const MAX_ACCURACY_M = 60;             // a fix this vague carries no usable direction
const MIN_SPEED_MS = 1.5;              // ~5 km/h: below this a browser's coords.heading is noise (or null)
const DEADBAND_DEG = 6;                // ignore heading wobble smaller than this: the map should not twitch on straight roads
const SMOOTHING = 0.6;                 // fraction of a heading change applied per fix (low-pass; turns still settle in 2–3 fixes)

/** Any angle → [0, 360). */
export const normalizeBearing = (deg) => ((deg % 360) + 360) % 360;

/** Signed shortest rotation from `from` to `to`, in (-180, 180]. 359→1 is +2, 5→355 is -10 — never the long way round. */
export function shortestDelta(from, to) {
  const d = normalizeBearing(to - from);
  return d > 180 ? d - 360 : d;
}

/**
 * A bearing to hand to Mapbox that continues from the map's CURRENT bearing by the shortest path (e.g. current 359, target 1 ⇒ 361),
 * so the map never spins back across the whole dial.
 */
export const continuousBearing = (current, target) => current + shortestDelta(current, target);

/** Initial great-circle bearing a→b in degrees clockwise from north, [0, 360). */
export function bearingBetween(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
  const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
  return normalizeBearing((Math.atan2(y, x) * 180) / Math.PI);
}

/** Mapbox camera padding that pushes the visual centre (where the rider is placed) toward the lower-middle of the screen. */
export const navPadding = (heightPx) => ({ top: Math.round(Math.max(0, heightPx || 0) * NAV_TOP_PADDING), bottom: 0, left: 0, right: 0 });

const finite = (n) => typeof n === "number" && Number.isFinite(n);

/**
 * Turns a stream of GPS fixes into a stable travel heading.
 *   fix = { lat, lng, accuracy?, heading?, speed? }   (heading/speed as in GeolocationCoordinates; null/NaN when unknown)
 * Rules:
 *  1. Poor-accuracy fixes are ignored.
 *  2. coords.heading is used when it is a real number AND the device reports meaningful speed.
 *  3. Otherwise the bearing is computed from the last STABLE position to this one — but only once the rider has moved further than
 *     the jitter threshold (8–25 m, scaled with the fix's accuracy). A stationary rider therefore never changes the heading.
 *  4. Changes under a few degrees are ignored and bigger ones are low-pass filtered, so the map follows turns without twitching.
 * `update` returns { heading: 0..360 | null (null = none established yet), changed: boolean }. The last stable heading is retained.
 */
export function createHeadingTracker() {
  let anchor = null;   // last stable position a bearing was measured from
  let lastFix = null;  // de-dupes re-delivery of the same fix (sync() can run for unrelated prop changes)
  let applied = null;  // current smoothed heading

  return {
    get heading() { return applied; },
    reset() { anchor = null; lastFix = null; applied = null; },
    update(fix) {
      const same = lastFix && fix && lastFix.lat === fix.lat && lastFix.lng === fix.lng && lastFix.heading === fix.heading;
      if (!fix || !finite(fix.lat) || !finite(fix.lng) || same) return { heading: applied, changed: false };
      lastFix = fix;
      if (finite(fix.accuracy) && fix.accuracy > MAX_ACCURACY_M) return { heading: applied, changed: false };

      const gps = finite(fix.heading) && finite(fix.speed) && fix.speed >= MIN_SPEED_MS;
      let raw = null;
      if (!anchor) {
        anchor = fix;
        if (gps) raw = normalizeBearing(fix.heading);
      } else if (gps) {
        raw = normalizeBearing(fix.heading);
        anchor = fix;
      } else {
        const minMove = Math.min(MAX_MOVE_M, Math.max(MIN_MOVE_M, finite(fix.accuracy) ? fix.accuracy * 0.5 : 0));
        if (distanceKm(anchor, fix) * 1000 >= minMove) { raw = bearingBetween(anchor, fix); anchor = fix; }
      }
      if (raw == null) return { heading: applied, changed: false };

      if (applied == null) { applied = raw; return { heading: applied, changed: true }; }
      const delta = shortestDelta(applied, raw);
      if (Math.abs(delta) < DEADBAND_DEG) return { heading: applied, changed: false };
      applied = normalizeBearing(applied + delta * SMOOTHING);
      return { heading: applied, changed: true };
    },
  };
}
