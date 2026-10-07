import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DELIVERY_OPTIONS } from "../data/stores.js";
import { baseFeeFor, distanceLabel, feeBasis, optionFee, scheduleNote } from "./deliveryFee.js";

const fmt = (n) => `Rs. ${n.toFixed(2)}`;
const express = DELIVERY_OPTIONS.find((o) => o.id === "express");
const standard = DELIVERY_OPTIONS.find((o) => o.id === "standard");

describe("delivery fee display", () => {
  it("option fee = base fee + the address's distance charge", () => {
    const d = { distanceFee: 1, deliverable: true };
    assert.equal(optionFee(express, d, 10), 3.99);
    assert.equal(optionFee(standard, d, 10), 1);
  });

  it("the free-delivery threshold waives only the BASE fee, never the distance charge", () => {
    const d = { distanceFee: 3.5, deliverable: true };
    assert.equal(baseFeeFor({ fee: 2, freeAbove: 25 }, 30), 0);
    assert.equal(optionFee({ fee: 2, freeAbove: 25 }, d, 30), 3.5);
    assert.equal(optionFee({ fee: 2, freeAbove: 25 }, d, 10), 5.5);
  });

  it("copes with a quote that has no distance charge yet (loading / out of range)", () => {
    assert.equal(optionFee(express, undefined, 10), 2.99);
    assert.equal(optionFee(express, { distanceFee: null }, 10), 2.99);
  });

  it("tells the shopper how the fee was worked out", () => {
    assert.deepEqual(feeBasis(null), { kind: "none" });
    assert.deepEqual(feeBasis({ deliverable: true, basis: "address_pin", distanceKm: 2.8, distanceFee: 1 }), { kind: "pin", km: 2.8, distanceFee: 1 });
    assert.equal(feeBasis({ deliverable: true, basis: "no_pin", distanceFee: 2 }).kind, "no_pin");
    assert.equal(feeBasis({ deliverable: true, basis: "branch_unlocated", distanceFee: 2 }).kind, "no_pin");
    assert.deepEqual(feeBasis({ deliverable: false, distanceKm: 35, maxKm: 15 }), { kind: "out_of_range", km: 35, maxKm: 15 });
    assert.equal(distanceLabel({ distanceKm: 2.8 }), "2.8 km");
    assert.equal(distanceLabel({ distanceKm: null }), null);
  });

  it("summarises the published schedule for the product page", () => {
    assert.equal(scheduleNote({ distance: { tiers: [{ fromKm: 0, toKm: 2, fee: 0 }, { fromKm: 2, toKm: 5, fee: 1 }] } }, fmt), "Free within 2 km · fee by distance beyond");
    assert.equal(scheduleNote({ distance: { tiers: [{ fromKm: 0, toKm: 3, fee: 1.5 }] } }, fmt), "Delivery from Rs. 1.50 · fee by distance");
    assert.equal(scheduleNote(null, fmt), null);
  });
});
