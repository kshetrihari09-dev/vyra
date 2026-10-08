import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBearing, shortestDelta, continuousBearing, bearingBetween, createHeadingTracker, navPadding, routeHeading } from "./navCamera.js";

const near = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const P = { lat: 27.7, lng: 85.3 };
// ~1 m of latitude / longitude at this latitude
const M_LAT = 1 / 111_195;
const M_LNG = 1 / (111_195 * Math.cos((27.7 * Math.PI) / 180));
const at = (northM, eastM, extra = {}) => ({ lat: P.lat + northM * M_LAT, lng: P.lng + eastM * M_LNG, accuracy: 5, ...extra });

test("normalizeBearing wraps into [0,360)", () => {
  assert.equal(normalizeBearing(-10), 350);
  assert.equal(normalizeBearing(370), 10);
  assert.equal(normalizeBearing(360), 0);
});

test("359° → 1° rotates +2°, not -358°", () => {
  assert.equal(shortestDelta(359, 1), 2);
  assert.equal(continuousBearing(359, 1), 361);
});
test("5° → 355° rotates -10°, not +350°", () => {
  assert.equal(shortestDelta(5, 355), -10);
  assert.equal(continuousBearing(5, 355), -5);
});
test("works from a Mapbox-style negative current bearing", () => {
  assert.equal(continuousBearing(-179, 179), -181); // 2° the short way
});

test("bearingBetween: N, E, S, W", () => {
  near(bearingBetween(P, at(100, 0)), 0);
  near(bearingBetween(P, at(0, 100)), 90);
  near(bearingBetween(P, at(-100, 0)), 180);
  near(bearingBetween(P, at(0, -100)), 270);
});

test("navPadding puts the rider in the lower-middle", () => {
  assert.deepEqual(navPadding(500), { top: 200, bottom: 0, left: 0, right: 0 });
  assert.equal(navPadding(undefined).top, 0);
});

test("moving straight: heading is computed from the previous → current position", () => {
  const t = createHeadingTracker();
  assert.equal(t.update(at(0, 0)).heading, null); // first fix: nothing to measure yet
  const r = t.update(at(30, 0));
  assert.equal(r.changed, true);
  near(r.heading, 0);
});

test("stationary / jitter under the threshold keeps the last stable heading", () => {
  const t = createHeadingTracker();
  t.update(at(0, 0)); t.update(at(30, 0));      // heading north
  const before = t.heading;
  for (const [n, e] of [[31, 3], [29, -3], [32, 2], [30, 4], [28, -2]]) { // wanders a few metres around the stop
    const r = t.update(at(n, e));
    assert.equal(r.changed, false);
    assert.equal(r.heading, before);
  }
});

test("poor accuracy widens the jitter threshold", () => {
  const t = createHeadingTracker();
  t.update(at(0, 0, { accuracy: 40 })); // threshold = 20 m
  assert.equal(t.update(at(15, 0, { accuracy: 40 })).changed, false);
  assert.equal(t.update(at(30, 0, { accuracy: 40 })).changed, true);
});

test("a fix with unusable accuracy is ignored", () => {
  const t = createHeadingTracker();
  t.update(at(0, 0)); t.update(at(30, 0));
  assert.equal(t.update(at(60, 80, { accuracy: 200 })).changed, false);
});

test("GPS heading is used when speed is meaningful; ignored when stopped or NaN", () => {
  const t = createHeadingTracker();
  const r = t.update(at(0, 0, { heading: 90, speed: 6 }));
  assert.equal(r.changed, true); near(r.heading, 90);
  const stopped = t.update(at(0.5, 0, { heading: 270, speed: 0 }));
  assert.equal(stopped.changed, false); near(stopped.heading, 90);
  const nan = t.update(at(1, 0, { heading: NaN, speed: NaN }));
  assert.equal(nan.changed, false);
});

test("right turn: heading eases from north toward east over a few fixes, never overshooting", () => {
  const t = createHeadingTracker();
  t.update(at(0, 0, { heading: 0, speed: 8 }));
  const seen = [];
  for (let i = 0; i < 6; i++) seen.push(t.update(at(i, i, { heading: 90, speed: 8 })).heading);
  assert.ok(seen[0] > 0 && seen[0] < 90, "first step is partial");
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1] && seen[i] <= 90);
  near(seen.at(-1), 90, 8);
});

test("small heading wobble is ignored (deadband)", () => {
  const t = createHeadingTracker();
  t.update(at(0, 0, { heading: 100, speed: 8 }));
  assert.equal(t.update(at(5, 5, { heading: 104, speed: 8 })).changed, false);
});

test("heading crossing 359° → 1° takes the short way", () => {
  const t = createHeadingTracker();
  t.update(at(0, 0, { heading: 355, speed: 8 }));
  const r = t.update(at(5, 5, { heading: 15, speed: 8 })); // 20° to the right across north
  assert.equal(r.changed, true);
  const step = shortestDelta(355, r.heading);
  assert.ok(step > 0 && step <= 20, `stepped ${step}° clockwise`);
});

test("the same fix delivered twice is processed once", () => {
  const t = createHeadingTracker();
  const f = at(0, 0, { heading: 45, speed: 8 });
  t.update(f);
  const h = t.heading;
  assert.equal(t.update({ ...f }).changed, false);
  assert.equal(t.heading, h);
});

// ---- road-aware heading -----------------------------------------------------------------------------------------------------------
const coord = (northM, eastM) => { const p = at(northM, eastM); return [p.lng, p.lat]; }; // GeoJSON order
const NORTH_ROAD = [coord(-50, 0), coord(0, 0), coord(200, 0)];

test("routeHeading: rider on a north-going road ⇒ 0°", () => {
  near(routeHeading(NORTH_ROAD, at(20, 0)).heading, 0);
  near(routeHeading(NORTH_ROAD, at(20, 12)).heading, 0); // 12 m beside the centreline still counts as on the road
});
test("routeHeading: far from the route, no route, or at its end ⇒ null", () => {
  assert.equal(routeHeading(NORTH_ROAD, at(20, 90)), null);
  assert.equal(routeHeading(null, at(0, 0)), null);
  assert.equal(routeHeading([coord(0, 0)], at(0, 0)), null);
  assert.equal(routeHeading(NORTH_ROAD, at(200, 0)), null);
});
test("routeHeading: looks slightly ahead, so it begins to turn into an upcoming corner", () => {
  const corner = [coord(0, 0), coord(20, 0), coord(20, 200)]; // north 20 m, then east
  const h = routeHeading(corner, at(5, 0), { lookAheadM: 30 }).heading;
  assert.ok(h > 20 && h < 90, `${h}° is between north and east`);
  near(routeHeading(corner, at(20, 40)).heading, 90);
});
test("routeHeading: a route that starts behind the rider is fine (rider is mid-route)", () => {
  near(routeHeading([coord(-300, 0), coord(300, 0)], at(100, 0)).heading, 0);
});

test("fusion: no GPS heading yet ⇒ the road ahead gives the initial heading; standing still never changes it afterwards", () => {
  const t = createHeadingTracker();
  const r = t.update(at(0, 0), { heading: 40, offM: 2 });
  assert.equal(r.changed, true); near(r.heading, 40);
  assert.equal(t.update(at(1, 1), { heading: 200, offM: 2 }).changed, false); // jitter: road says something else, rider has not moved
});
test("fusion: a wobbly GPS heading on a curve snaps to the road's direction", () => {
  const t = createHeadingTracker();
  const r = t.update(at(0, 0, { heading: 25, speed: 8 }), { heading: 0, offM: 3 });
  near(r.heading, 0);
});
test("fusion: riding against the road (U-turn / wrong way) trusts the rider's own direction", () => {
  const t = createHeadingTracker();
  t.update(at(0, 0, { heading: 0, speed: 8 }), { heading: 0, offM: 3 });
  let h; for (let i = 0; i < 4; i++) h = t.update(at(-i, 0, { heading: 180, speed: 8 }), { heading: 0, offM: 3 }).heading;
  near(h, 180, 15);
});
test("fusion: computed movement bearing also snaps to the road when it agrees", () => {
  const t = createHeadingTracker();
  t.update(at(0, 0), null);
  const r = t.update(at(30, 6), { heading: 0, offM: 3 }); // moved ~11° off north, road says 0
  near(r.heading, 0);
});

test("a real turn is followed quickly; the same fix at a crawl is damped", () => {
  const fast = createHeadingTracker(); fast.update(at(0, 0, { heading: 0, speed: 8 }));
  const slow = createHeadingTracker(); slow.update(at(0, 0, { heading: 0, speed: 2 }));
  const f = fast.update(at(5, 5, { heading: 90, speed: 8 })).heading;
  const w = slow.update(at(5, 5, { heading: 40, speed: 2 }));
  assert.ok(f >= 70, `fast turn reached ${f}°`);
  assert.ok(w.heading > 0 && w.heading < 25, `crawl step ${w.heading}° is well short of the 40° turn`);
});
test("crawling: small direction changes are ignored (wider deadband)", () => {
  const t = createHeadingTracker(); t.update(at(0, 0, { heading: 100, speed: 2 }));
  assert.equal(t.update(at(2, 2, { heading: 107, speed: 2 })).changed, false);
});
