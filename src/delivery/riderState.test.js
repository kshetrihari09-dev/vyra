import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canOfferAssignment, capacityLine, isStranded, stateMeta, unavailableReason, vehicleLine } from "./riderState.js";

const rider = (over = {}) => ({ id: "r1", state: "available", status: "active", authorized: true, activeCount: 2, capacity: 5, vehicleType: "Bike", vehicleNumber: "BA 12 PA 1234", ...over });

describe("rider state presentation", () => {
  it("labels all six states distinctly", () => {
    const labels = ["available", "at_capacity", "off_duty", "inactive", "suspended", "not_authorized"].map((state) => stateMeta({ state }).label);
    assert.deepEqual(labels, ["Available", "At capacity", "Off duty", "Inactive", "Suspended", "Not authorized"]);
    assert.equal(new Set(labels).size, 6);
  });
  it("formats capacity and vehicle the way the dispatcher reads them", () => {
    assert.equal(capacityLine(rider()), "2 / 5 active deliveries");
    assert.equal(vehicleLine(rider()), "Bike · BA 12 PA 1234");
    assert.equal(vehicleLine(rider({ vehicleType: "Scooter", vehicleNumber: null })), "Scooter");
    assert.equal(vehicleLine({ vehicle: "Legacy text" }), "Legacy text");
    assert.equal(vehicleLine({}), "No vehicle on file");
  });
  it("only an available rider can be offered a delivery, and every other state explains itself", () => {
    assert.equal(canOfferAssignment(rider()), true);
    for (const state of ["at_capacity", "off_duty", "inactive", "suspended", "not_authorized"]) {
      assert.equal(canOfferAssignment(rider({ state })), false, state);
      assert.ok(unavailableReason(rider({ state })).length > 0, state);
    }
    assert.equal(canOfferAssignment(null), false);
  });
  it("recognises a picked-up parcel held by a rider who can no longer operate", () => {
    const d = { status: "picked_up", riderId: "r1" };
    assert.equal(isStranded(d, [rider()]), false);
    assert.equal(isStranded(d, [rider({ authorized: false, state: "not_authorized" })]), true);
    assert.equal(isStranded(d, [rider({ state: "suspended", authorized: false })]), true);
    assert.equal(isStranded({ status: "assigned", riderId: "r1" }, [rider({ authorized: false })]), false, "only after pickup");
    assert.equal(isStranded(d, []), false);
  });
});
