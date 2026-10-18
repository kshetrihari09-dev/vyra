import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeAccuracy, inNepal, locateAccurately } from "./geo.js";
import { geocodeUrl, parsePlaces } from "./places.js";

/** A fake navigator.geolocation we can feed fixes into. */
function fakeGeo() {
  const g = { watchers: new Map(), n: 0, opts: null, cleared: [] };
  g.watchPosition = (ok, err, opts) => { const id = ++g.n; g.watchers.set(id, { ok, err }); g.opts = opts; return id; };
  g.clearWatch = (id) => { g.cleared.push(id); g.watchers.delete(id); };
  g.fix = (lat, lng, accuracy) => [...g.watchers.values()].forEach((w) => w.ok({ coords: { latitude: lat, longitude: lng, accuracy } }));
  g.fail = (code) => [...g.watchers.values()].forEach((w) => w.err({ code }));
  return g;
}
const fakeTimers = () => { const t = { fns: [], setTimeout: (fn) => { t.fns.push(fn); return t.fns.length; }, clearTimeout: () => {} }; return t; };

describe("locateAccurately", () => {
  it("always asks for a fresh high-accuracy fix (never a cached one)", async () => {
    const g = fakeGeo(); const { promise } = locateAccurately({ geolocation: g, timers: fakeTimers() });
    assert.equal(g.opts.maximumAge, 0); assert.equal(g.opts.enableHighAccuracy, true);
    g.fix(27.7, 85.3, 10); await promise;
  });
  it("keeps refining past a coarse first fix and resolves as soon as one is good enough", async () => {
    const g = fakeGeo(); const seen = [];
    const { promise } = locateAccurately({ geolocation: g, timers: fakeTimers(), onProgress: (b) => seen.push(b.accuracy) });
    g.fix(27.70, 85.30, 900);   // coarse network guess
    g.fix(27.71, 85.31, 400);
    g.fix(27.7105, 85.3102, 600); // worse — ignored
    assert.equal(g.watchers.size, 1, "still watching");
    g.fix(27.7102, 85.3101, 18);
    const best = await promise;
    assert.deepEqual([best.lat, best.lng, best.accuracy], [27.7102, 85.3101, 18]);
    assert.deepEqual(seen, [900, 400, 18]);
    assert.equal(g.watchers.size, 0, "the watcher is always cleared");
  });
  it("at the time limit it settles for the best fix it has", async () => {
    const g = fakeGeo(); const t = fakeTimers(); const { promise } = locateAccurately({ geolocation: g, timers: t });
    g.fix(27.7, 85.3, 300); g.fix(27.71, 85.31, 120); t.fns[0]();
    assert.equal((await promise).accuracy, 120); assert.equal(g.watchers.size, 0);
  });
  it("reports permission denial immediately, and a timeout with no fix as a clear error", async () => {
    const g = fakeGeo(); const { promise } = locateAccurately({ geolocation: g, timers: fakeTimers() });
    g.fail(1); await assert.rejects(promise, (e) => e.code === 1 && /blocked/.test(e.message));
    const g2 = fakeGeo(); const t = fakeTimers(); const p2 = locateAccurately({ geolocation: g2, timers: t }).promise; t.fns[0]();
    await assert.rejects(p2, /Couldn't get your location/);
    await assert.rejects(locateAccurately({ geolocation: null }).promise, (e) => e.code === 0);
  });
  it("can be cancelled", async () => {
    const g = fakeGeo(); const { promise, cancel } = locateAccurately({ geolocation: g, timers: fakeTimers() });
    cancel(); await assert.rejects(promise, (e) => e.code === -1); assert.equal(g.watchers.size, 0);
  });
});

describe("accuracy wording and sanity checks", () => {
  it("describeAccuracy", () => {
    assert.deepEqual(describeAccuracy(12.4), { label: "±12 m", level: "good" });
    assert.equal(describeAccuracy(80).level, "fair"); assert.equal(describeAccuracy(450).level, "poor");
    assert.equal(describeAccuracy(2400).label, "±2.4 km"); assert.equal(describeAccuracy(undefined).level, "unknown");
  });
  it("inNepal catches pins that can't be right", () => {
    assert.equal(inNepal({ lat: 27.7172, lng: 85.324 }), true);   // Kathmandu
    assert.equal(inNepal({ lat: 27.6866, lng: 83.4323 }), true);  // Butwal
    assert.equal(inNepal({ lat: 0, lng: 0 }), false);             // GPS "null island"
    assert.equal(inNepal({ lat: 28.6139, lng: 77.209 }), false);  // Delhi
    assert.equal(inNepal(null), false); assert.equal(inNepal({ lat: NaN, lng: 85 }), false);
  });
});

describe("place search", () => {
  it("is limited to Nepal, biased near the user, and autocompletes only when asked", () => {
    const u = new URL(geocodeUrl("Traffic Chowk", { token: "pk.x", near: { lat: 27.68, lng: 83.43 }, limit: 5, autocomplete: true }));
    assert.equal(u.searchParams.get("country"), "np"); assert.equal(u.searchParams.get("proximity"), "83.43,27.68");
    assert.equal(u.searchParams.get("limit"), "5"); assert.equal(u.searchParams.get("autocomplete"), "true");
    assert.equal(new URL(geocodeUrl("x", { token: "pk.x" })).searchParams.get("autocomplete"), "false");
    assert.equal(decodeURIComponent(u.pathname).endsWith("/Traffic Chowk.json"), true);
  });
  it("parsePlaces keeps usable results and drops the rest", () => {
    const out = parsePlaces({ features: [{ id: "a", place_name: "Butwal, Lumbini, Nepal", center: [83.43, 27.68] }, { id: "b", center: [] }, { id: "c", text: "No coords" }, { id: "d", text: "Short", center: [85.3, 27.7] }] });
    assert.deepEqual(out.map((p) => [p.id, p.name]), [["a", "Butwal, Lumbini, Nepal"], ["d", "Short"]]);
    assert.deepEqual(parsePlaces(null), []);
  });
});
