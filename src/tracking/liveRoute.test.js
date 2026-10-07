import test from "node:test";
import assert from "node:assert/strict";
import { shouldRequestRoute, legKey, createSequencer, ROUTE_REFRESH_MS, ROUTE_RETRY_MS } from "./liveRoute.js";

const dest = { lat: 27.7, lng: 85.3 };
const pickup = { lat: 27.71, lng: 85.31 };
const at = (dLat) => ({ lat: 27.72 + dLat, lng: 85.32 });
const key = legKey("to_customer", pickup, dest);
const base = { at: 1_000_000, from: at(0), key, failed: false };

test("first fix (tracking start) requests immediately", () => {
  assert.equal(shouldRequestRoute({ now: 1, rider: at(0), key, stale: false, last: null }), true);
});
test("20 m of movement shortly after does not request", () => {
  assert.equal(shouldRequestRoute({ now: base.at + 8000, rider: at(0.0002), key, stale: false, last: base }), false);
});
test("~150 m of movement requests", () => {
  assert.equal(shouldRequestRoute({ now: base.at + 8000, rider: at(0.00135), key, stale: false, last: base }), true);
});
test("time-based refresh only while actually moving", () => {
  const t = base.at + ROUTE_REFRESH_MS + 1;
  assert.equal(shouldRequestRoute({ now: t, rider: at(0.00005), key, stale: false, last: base }), false); // jitter
  assert.equal(shouldRequestRoute({ now: t, rider: at(0.0004), key, stale: false, last: base }), true);   // ~45 m
});
test("pickup completed changes the leg and requests at once", () => {
  const k2 = legKey("to_pickup", pickup, dest);
  assert.notEqual(k2, key);
  assert.equal(shouldRequestRoute({ now: base.at + 100, rider: at(0), key: k2, stale: false, last: { ...base, key } }), true);
});
test("destination change requests at once", () => {
  const k2 = legKey("to_customer", pickup, { lat: 27.8, lng: 85.4 });
  assert.equal(shouldRequestRoute({ now: base.at + 100, rider: at(0), key: k2, stale: false, last: base }), true);
});
test("stale rider never requests (same leg)", () => {
  assert.equal(shouldRequestRoute({ now: base.at + 120_000, rider: at(0.01), key, stale: true, last: base }), false);
});
test("burst of GPS fixes respects the minimum gap", () => {
  assert.equal(shouldRequestRoute({ now: base.at + 1000, rider: at(0.01), key, stale: false, last: base }), false);
});
test("failed request retries only after the retry delay", () => {
  const failed = { ...base, failed: true };
  assert.equal(shouldRequestRoute({ now: base.at + 6000, rider: at(0), key, stale: false, last: failed }), false);
  assert.equal(shouldRequestRoute({ now: base.at + ROUTE_RETRY_MS, rider: at(0), key, stale: false, last: failed }), true);
});
test("no rider or destination: nothing to route", () => {
  assert.equal(shouldRequestRoute({ now: 1, rider: null, key, stale: false, last: null }), false);
  assert.equal(legKey("to_customer", pickup, null), "");
});
test("sequencer: an older response can never overwrite a newer one", () => {
  const s = createSequencer(); const a = s.next(); const b = s.next();
  assert.equal(s.isLatest(a), false); assert.equal(s.isLatest(b), true);
  s.invalidate(); assert.equal(s.isLatest(b), false);
});
