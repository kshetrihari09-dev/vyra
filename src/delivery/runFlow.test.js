import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completedSteps, currentTarget, nextAction, sharesLocation } from "./runFlow.js";

describe("rider run flow", () => {
  const at = (status, extra = {}) => ({ status, arrivedPickupAt: null, startedAt: null, ...extra });
  it("walks Accept → Arrived at pickup → Picked up → Start delivery → Delivered", () => {
    const seq = [at("assigned"), at("accepted"), at("accepted", { arrivedPickupAt: "t" }), at("picked_up"), at("picked_up", { startedAt: "t" })];
    assert.deepEqual(seq.map((d) => nextAction(d).id), ["accept", "arrived", "pickup", "start", "complete"]);
    assert.deepEqual(seq.map(completedSteps), [0, 1, 2, 3, 4]);
  });
  it("finished or cancelled runs have no next action", () => {
    for (const s of ["delivered", "failed", "cancelled"]) assert.equal(nextAction(at(s)), null);
    assert.equal(completedSteps(at("delivered")), 5);
  });
  it("heads to the store until pickup, then to the customer", () => {
    assert.equal(currentTarget(at("accepted")), "store");
    assert.equal(currentTarget(at("picked_up")), "customer");
  });
  it("shares location only once accepted, and never after it ends", () => {
    assert.deepEqual(["assigned", "accepted", "picked_up", "delivered", "failed", "cancelled"].map((s) => sharesLocation(at(s))), [false, true, true, false, false, false]);
  });
});
