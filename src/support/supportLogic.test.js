import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chatAvailability, formErrorMessage, isBadReference, isUuid, lastSeq, mailtoHref, mergeMessages, stripRefs, telHref } from "./supportLogic.js";

describe("telHref", () => {
  it("only produces a tel: link for something that is a phone number", () => {
    assert.equal(telHref("+977 9812-345678"), "tel:+9779812345678");
    assert.equal(telHref("(01) 555-0100"), "tel:015550100");
    for (const bad of [null, undefined, "", "call us", "12", "+1 555 01 ext 4", "javascript:alert(1)"]) assert.equal(telHref(bad), null, String(bad));
  });
});

describe("mailtoHref", () => {
  it("builds an encoded mailto only for a plausible address", () => {
    assert.equal(mailtoHref("a@b.co", { subject: "Hi there", body: "x&y" }), "mailto:a@b.co?subject=Hi%20there&body=x%26y");
    assert.equal(mailtoHref("nope"), null); assert.equal(mailtoHref(null), null);
  });
});

describe("mergeMessages", () => {
  const m = (id, seq, extra = {}) => ({ id, seq, createdAt: `2026-01-01T00:00:${String(seq ?? 59).padStart(2, "0")}Z`, ...extra });
  it("dedupes by id, orders by seq, keeps unsent local messages last", () => {
    const merged = mergeMessages([m("a", 1), m("local-x", null, { localState: "sending", clientMessageId: "x" })], [m("b", 2), m("a", 1)]);
    assert.deepEqual(merged.map((x) => x.id), ["a", "b", "local-x"]);
  });
  it("replaces the optimistic copy once the server confirms the same clientMessageId (no double bubble)", () => {
    const merged = mergeMessages([m("local-x", null, { localState: "sending", clientMessageId: "x" })], [m("srv1", 5, { clientMessageId: "x" })]);
    assert.deepEqual(merged.map((x) => x.id), ["srv1"]);
  });
  it("lastSeq ignores unsent messages", () => assert.equal(lastSeq([m("a", 3), m("l", null)]), 3));
});

describe("chatAvailability tells the truth", () => {
  const contact = (available) => ({ chat: { available } });
  it("covers every state", () => {
    assert.equal(chatAvailability({ signedIn: true, contact: contact(true) }).label, "Pharmacist online");
    assert.equal(chatAvailability({ signedIn: true, contact: contact(false) }).label, "No pharmacist online");
    assert.equal(chatAvailability({ signedIn: false, contact: contact(true) }).label, "Sign in to chat");
    assert.equal(chatAvailability({ signedIn: true, contact: null }).label, "Checking availability…");
    assert.equal(chatAvailability({ signedIn: true, contact: null, error: true }).label, "Availability unavailable");
  });
  it("never reports online while unknown or failed", () => {
    assert.notEqual(chatAvailability({ signedIn: true, contact: null }).tone, "ok");
    assert.notEqual(chatAvailability({ signedIn: true, contact: contact(true), error: true }).tone, "ok");
  });
});

describe("error handling helpers", () => {
  it("recognises a bad link (not a bad message)", () => {
    assert.equal(isBadReference({ code: "ORDER_NOT_FOUND" }), true);
    assert.equal(isBadReference({ status: 400, fieldErrors: { orderId: "Invalid id" } }), true);
    assert.equal(isBadReference({ status: 400, fieldErrors: { body: "Write a message first" } }), false);
    assert.equal(isBadReference({ code: "RATE_LIMITED" }), false);
  });
  it("stripRefs removes only the links", () => assert.deepEqual(stripRefs({ body: "x", orderId: "o", productId: "p", prescriptionId: "r" }), { body: "x" }));
  it("failure wording never says 'sent' or 'delivered'", () => {
    for (const code of ["EMAIL_NOT_CONFIGURED", "EMAIL_DELIVERY_FAILED", "SUBMISSION_IN_PROGRESS", "RATE_LIMITED", "NETWORK_ERROR", "INVALID_TOKEN", "WHATEVER"]) {
      assert.doesNotMatch(formErrorMessage({ code, message: "oops" }), /\b(was sent|delivered|success)/i, code);
    }
  });
  it("isUuid", () => { assert.equal(isUuid("123e4567-e89b-42d3-a456-426614174000"), true); assert.equal(isUuid("legacy-1"), false); });
});
