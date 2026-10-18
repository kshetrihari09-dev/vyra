/**
 * Location accuracy helpers (no React, no network) — the browser's FIRST fix is often a coarse Wi-Fi/cell guess hundreds of metres
 * off, so a delivery pin taken from it can land on the wrong street. These helpers wait for a better fix, report how good it is,
 * and flag pins that are clearly wrong.
 */
export const GOOD_ENOUGH_M = 25;        // stop waiting once a fix is this accurate
export const FAIR_M = 100;              // beyond this, tell the person to adjust the pin by hand
export const MAX_WAIT_MS = 15_000;      // give up refining after this long and use the best fix so far
export const MAX_RIDER_FIX_M = 150;     // riders' fixes worse than this aren't sent (the server drops them too)

/** Rough bounding box of Nepal — a pin outside it is almost certainly a mistake (GPS 0,0, a VPN/geo-IP guess, a wrong tap). */
const NEPAL = { minLat: 26.3, maxLat: 30.5, minLng: 80.0, maxLng: 88.3 };
export const inNepal = (p) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  && p.lat >= NEPAL.minLat && p.lat <= NEPAL.maxLat && p.lng >= NEPAL.minLng && p.lng <= NEPAL.maxLng;

/** "±12 m" plus how much to trust it. */
export function describeAccuracy(m) {
  if (!Number.isFinite(m)) return { label: "", level: "unknown" };
  const rounded = Math.max(1, Math.round(m));
  const label = rounded >= 1000 ? `±${(rounded / 1000).toFixed(1)} km` : `±${rounded} m`;
  return { label, level: m <= GOOD_ENOUGH_M * 1.5 ? "good" : m <= FAIR_M ? "fair" : "poor" };
}

const ERR = {
  1: "Location permission is blocked. Allow it in your browser settings, or drop the pin on the map instead.",
  0: "This device can't share its location.",
};
const failure = (code) => Object.assign(new Error(ERR[code] ?? "Couldn't get your location. Try again, or drop the pin on the map."), { code });

/**
 * Watches the position for a few seconds and resolves with the MOST ACCURATE fix, stopping early once one is good enough.
 * Always fresh (`maximumAge: 0`) — a cached fix from 30 s ago, possibly from another street, is never reused.
 * `onProgress(best)` reports each improvement so the UI can say "Improving accuracy… ±40 m".
 * Returns `{ promise, cancel }`; the watcher is always cleared.
 */
export function locateAccurately({ geolocation = globalThis.navigator?.geolocation, goodEnough = GOOD_ENOUGH_M, maxWaitMs = MAX_WAIT_MS, onProgress, timers = { setTimeout, clearTimeout } } = {}) {
  let cancel = () => {};
  const promise = new Promise((resolve, reject) => {
    if (!geolocation) { reject(failure(0)); return; }
    let best = null; let watchId = null; let timer = null; let done = false; let lastErr = null;
    const finish = (fn) => { if (done) return; done = true; timers.clearTimeout(timer); if (watchId != null) geolocation.clearWatch(watchId); fn(); };
    cancel = () => finish(() => reject(Object.assign(new Error("Cancelled"), { code: -1 })));
    timer = timers.setTimeout(() => finish(() => (best ? resolve(best) : reject(failure(lastErr ?? 3)))), maxWaitMs);
    watchId = geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : Infinity };
        if (!best || fix.accuracy < best.accuracy) { best = fix; onProgress?.(best); }
        if (best.accuracy <= goodEnough) finish(() => resolve(best));
      },
      (err) => { lastErr = err?.code ?? 2; if (err?.code === 1) finish(() => reject(failure(1))); }, // permission denied: stop at once
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs });
  });
  return { promise, cancel: () => cancel() };
}
