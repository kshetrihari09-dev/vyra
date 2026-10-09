/* Pure rules for what the delivery map should FRAME and how (no Mapbox, no DOM) — unit-tested in framing.test.js.

   Why this exists: the first view of the map is decided by a handful of coordinates and a padding. Three things can quietly make that view
   wrong, and each is guarded here:
     1. A bad coordinate. Mapbox coerces with Number(), so null silently becomes 0 (a pin on "Null Island", dragging the bounds out to a
        world-scale zoom where nothing is visible) and undefined/NaN throws. cleanPoint() lets only real coordinates through.
     2. Padding larger than the container. fitBounds() then silently does nothing and the camera stays wherever it was. clampPadding() keeps
        the padded area positive.
     3. Not knowing why a view is wide. estimateFitZoom() lets the map say "these points are 3,000 km apart" instead of just looking blank.
   Nothing here invents or moves a location: it only decides which REAL points to frame. */

import { distanceKm } from "./format.js";

export const FIT_PADDING = Object.freeze({ top: 70, bottom: 70, left: 50, right: 50 });
export const FIT_MAX_ZOOM = 16;
export const SINGLE_POINT_ZOOM = 15;
export const WORLD_ZOOM = 8; // a fit below this is wider than a metro area: street detail cannot be visible

/**
 * A coordinate pair that is safe to hand to Mapbox, or null. Keeps any extra fields (heading, speed, accuracy, name…).
 * Rejects null/""/NaN/out-of-range, and exactly (0,0): that is the "no fix yet" sentinel, never a real pickup, address or rider.
 */
export function cleanPoint(p) {
  if (!p || p.lat == null || p.lng == null || p.lat === "" || p.lng === "") return null;
  const lat = Number(p.lat); const lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { ...p, lat, lng };
}

/** GeoJSON-order [[lng, lat], …] with anything malformed removed (a route is only used for framing, never altered). */
export const cleanCoords = (coords) => (Array.isArray(coords)
  ? coords.filter((c) => Array.isArray(c) && cleanPoint({ lng: c[0], lat: c[1] }) !== null).map((c) => [Number(c[0]), Number(c[1])])
  : []);

/**
 * Keep the padded (usable) area at least `minShare` of each dimension, scaling the padding on that axis down proportionally if needed.
 * With the default 70/70/50/50 padding a 280 px-high map keeps 140 px; a short landscape phone (e.g. 180 px) would keep -40 px and fitBounds would no-op.
 * An unknown size (0 / not laid out yet) returns the padding unchanged.
 */
export function clampPadding({ width, height }, padding = FIT_PADDING, minShare = 0.4) {
  const axis = (a, b, size) => {
    if (!(size > 0)) return [a, b];
    const max = size * (1 - minShare);
    return a + b <= max ? [a, b] : [Math.floor((a / (a + b)) * max), Math.floor((b / (a + b)) * max)];
  };
  const [top, bottom] = axis(padding.top, padding.bottom, height);
  const [left, right] = axis(padding.left, padding.right, width);
  return { top, bottom, left, right };
}

/** Largest distance between any two points, km (0 for fewer than two). Inputs are the handful of map points, so O(n²) is fine. */
export function spanKm(points) {
  let max = 0;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) max = Math.max(max, distanceKm(points[i], points[j]) || 0);
  return max;
}

const mercY = (lat) => { const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };

/**
 * The zoom a Web-Mercator map (512 px tiles, as Mapbox GL) needs to fit these points in `size` after `padding`, capped at `maxZoom`.
 * An estimate for diagnostics and tests — the map itself still uses fitBounds. null when there is nothing to fit.
 */
export function estimateFitZoom(points, { width, height }, padding = FIT_PADDING, maxZoom = FIT_MAX_ZOOM) {
  if (points.length < 2 || !(width > 0) || !(height > 0)) return null;
  const lngs = points.map((p) => p.lng); const ys = points.map((p) => mercY(p.lat));
  const fx = (Math.max(...lngs) - Math.min(...lngs)) / 360; const fy = Math.max(...ys) - Math.min(...ys);
  const availW = Math.max(1, width - padding.left - padding.right); const availH = Math.max(1, height - padding.top - padding.bottom);
  const z = (avail, f) => (f > 0 ? Math.log2(avail / (512 * f)) : Infinity);
  const zoom = Math.min(z(availW, fx), z(availH, fy), maxZoom);
  return Math.max(0, Number.isFinite(zoom) ? zoom : maxZoom);
}

/**
 * Where a NEW map should open, given the real points it has: the very first frame is already correct instead of opening at a guessed zoom
 * and correcting itself after "load".  → { bounds: [[w,s],[e,n]], padding? } | { center: [lng,lat], zoom }
 * Falls back to `fallbackCenter` (no points yet) at a neighbourhood zoom.
 */
export function initialView(points, size, fallbackCenter, fallbackZoom = 13) {
  if (points.length === 0) return { center: [fallbackCenter.lng, fallbackCenter.lat], zoom: fallbackZoom };
  const w = Math.min(...points.map((p) => p.lng)); const e = Math.max(...points.map((p) => p.lng));
  const s = Math.min(...points.map((p) => p.lat)); const n = Math.max(...points.map((p) => p.lat));
  if (points.length === 1 || (w === e && s === n)) return { center: [points[0].lng, points[0].lat], zoom: SINGLE_POINT_ZOOM };
  return { bounds: [[w, s], [e, n]], padding: clampPadding(size) };
}
