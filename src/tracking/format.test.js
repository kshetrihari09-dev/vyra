import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agoText, directionsUrl, distanceKm, etaHeadline, formatKm, initials } from "./format.js";

describe("tracking formatters", () => {
  it("etaHeadline speaks in minutes from the server's number, and says 'now' at the end", () => {
    const at = "2026-10-05T10:00:00Z";
    assert.equal(etaHeadline(null), null);
    assert.equal(etaHeadline({ at, minutes: 12 }), "Arriving in 12 min");
    assert.equal(etaHeadline({ at, minutes: 1 }), "Arriving now");
    assert.equal(etaHeadline({ at, minutes: 0 }), "Arriving now");
    assert.equal(etaHeadline({ at, minutes: 75 }), "Arriving in 1 h 15 min");
    assert.match(etaHeadline({ at, minutes: null }), /^Arriving by /);
  });

  it("agoText ages a position update", () => {
    const now = new Date("2026-10-05T10:05:00Z").getTime();
    assert.equal(agoText("2026-10-05T10:04:55Z", now), "just now");
    assert.equal(agoText("2026-10-05T10:04:20Z", now), "40 s ago");
    assert.equal(agoText("2026-10-05T10:01:00Z", now), "4 min ago");
    assert.equal(agoText(null, now), "");
  });

  it("distance and its label", () => {
    const d = distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    assert.ok(Math.abs(d - 111.19) < 0.1);
    assert.equal(distanceKm(null, { lat: 0, lng: 0 }), null);
    assert.equal(formatKm(0.456), "460 m");
    assert.equal(formatKm(2.34), "2.3 km");
  });

  it("initials and a directions link that hands off to the user's own maps app", () => {
    assert.equal(initials("Daniel R."), "DR");
    assert.equal(initials(""), "?");
    assert.equal(directionsUrl({ lat: 27.7, lng: 85.3 }), "https://www.google.com/maps/dir/?api=1&destination=27.7,85.3&travelmode=driving");
    assert.match(directionsUrl({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }), /origin=3,4/);
  });
});
