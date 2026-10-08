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
const DEADBAND_SLOW_DEG = 9;           // …and a wider one when crawling, where GPS direction is least trustworthy
const SMOOTHING = 0.6;                 // default fraction of a heading change applied per fix when speed is unknown (see adaptive alpha below)

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
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Direction of the ROAD ahead of the rider, from the live route geometry already in memory (no API call).
 *   coords = GeoJSON-order [[lng, lat], …]; rider = {lat, lng}.
 * Projects the rider onto the nearest route segment; if they are within `maxOffM` of it (i.e. actually on the route), returns the bearing from
 * that point to the point `lookAheadM` further along the route. That is far steadier than a 1 Hz GPS heading (especially at low speed and on
 * curves) and turns the map slightly before a corner, like a navigation app. Returns null when off-route, at the route's end, or with no route.
 * @returns {{heading:number, offM:number}|null}
 */
export function routeHeading(coords, rider, { maxOffM = 30, lookAheadM = 30 } = {}) {
  if (!Array.isArray(coords) || coords.length < 2 || !rider || !finite(rider.lat) || !finite(rider.lng)) return null;
  const kx = 111_320 * Math.cos((rider.lat * Math.PI) / 180);
  const ky = 110_574;
  const pts = coords.map(([lng, lat]) => [(lng - rider.lng) * kx, (lat - rider.lat) * ky]); // metres east/north of the rider (rider = origin)
  let best = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]; const dx = pts[i + 1][0] - ax; const dy = pts[i + 1][1] - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : clamp(-(ax * dx + ay * dy) / len2, 0, 1);
    const px = ax + t * dx; const py = ay + t * dy; const d = Math.hypot(px, py);
    if (!best || d < best.d) best = { i, d, px, py };
  }
  if (!best || best.d > maxOffM) return null;
  let remain = lookAheadM; let cx = best.px; let cy = best.py; let target = null;
  for (let j = best.i + 1; j < pts.length && remain > 0; j++) {
    const [bx, by] = pts[j]; const seg = Math.hypot(bx - cx, by - cy);
    if (seg >= remain) { const f = remain / seg; target = [cx + (bx - cx) * f, cy + (by - cy) * f]; remain = 0; break; }
    remain -= seg; cx = bx; cy = by; target = [bx, by];
  }
  if (!target) return null;
  const dx = target[0] - best.px; const dy = target[1] - best.py;
  if (Math.hypot(dx, dy) < 3) return null; // too short to give a direction (rider is at the very end of the route)
  return { heading: normalizeBearing((Math.atan2(dx, dy) * 180) / Math.PI), offM: best.d };
}

const ROUTE_AGREE_DEG = 70; // device/movement direction within this of the road ⇒ the rider is following it, so use the road's cleaner direction

/**
 * Turns a stream of GPS fixes into a stable travel heading.
 *   fix   = { lat, lng, accuracy?, heading?, speed? }   (heading/speed as in GeolocationCoordinates; null/NaN when unknown)
 *   route = routeHeading(...) result for this fix, or null/undefined
 * Rules:
 *  1. Poor-accuracy fixes are ignored.
 *  2. coords.heading is used when it is a real number AND the device reports meaningful speed.
 *  3. Otherwise the bearing is computed from the last STABLE position to this one — but only once the rider has moved further than
 *     the jitter threshold (8–25 m, scaled with the fix's accuracy). A stationary rider therefore never changes the heading.
 *  4. Road fusion: if that direction agrees with the road ahead (within 70°) the road's direction is used instead — smoother, and right on
 *     curves. If it disagrees (U-turn, shortcut, riding off the route) the rider's actual direction wins. With no heading at all yet,
 *     the road ahead gives the initial heading so the map starts facing the way the route goes rather than north.
 *  5. Changes under a few degrees are ignored; bigger ones are low-pass filtered — gently when slow, quickly for a real turn.
 * `update` returns { heading: 0..360 | null (null = none established yet), changed: boolean }. The last stable heading is retained.
 */
export function createHeadingTracker() {
  let anchor = null;   // last stable position a bearing was measured from
  let lastFix = null;  // de-dupes re-delivery of the same fix (sync() can run for unrelated prop changes)
  let applied = null;  // current smoothed heading

  return {
    get heading() { return applied; },
    reset() { anchor = null; lastFix = null; applied = null; },
    update(fix, route = null) {
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

      if (route && finite(route.heading)) {
        if (raw == null) { if (applied == null) raw = route.heading; }                         // nothing else known yet: face the road ahead
        else if (Math.abs(shortestDelta(raw, route.heading)) <= ROUTE_AGREE_DEG) raw = route.heading; // following the road: use its direction
      }
      if (raw == null) return { heading: applied, changed: false };

      if (applied == null) { applied = raw; return { heading: applied, changed: true }; }
      const delta = shortestDelta(applied, raw);
      const speed = finite(fix.speed) ? fix.speed : null;
      if (Math.abs(delta) < (speed != null && speed < 3 ? DEADBAND_SLOW_DEG : DEADBAND_DEG)) return { heading: applied, changed: false };
      let alpha = speed == null ? SMOOTHING : clamp(0.35 + speed * 0.04, 0.35, 0.8); // 0 m/s → 0.35 … 11 m/s+ → 0.8
      if (Math.abs(delta) > 50) alpha = Math.max(alpha, 0.85);                           // a real turn: do not lag behind it
      applied = normalizeBearing(applied + delta * alpha);
      return { heading: applied, changed: true };
    },
  };
}
