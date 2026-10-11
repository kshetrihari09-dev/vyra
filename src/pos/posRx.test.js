import test from "node:test";
import assert from "node:assert/strict";
import { rxGate, rxLines, rxProductIds, coversAll, validatePaperRx, describeRx, todayISO, oldestIssueISO, isoDate, RX_MAX_AGE_DAYS } from "./posRx.js";
import { addLine, buildSaleRequest } from "./posCart.js";

const NOW = new Date(2026, 5, 15, 10, 0, 0); // local 15 Jun 2026
const base = { productId: "p", name: "X", unitPrice: 10, taxPercent: 0, cap: 5 };
const cartOf = (...lines) => lines.reduce((c, l) => addLine(c, { ...base, ...l }).cart, []);
const form = (over = {}) => ({ patientName: "Sita Rai", prescriberName: "Dr. A. Sharma", prescriberRegNo: "NMC-1", issuedOn: "2026-06-10", verified: true, ...over });

test("only flagged lines count as prescription lines; ids and names are de-duplicated", () => {
  const cart = cartOf({ productId: "amox", name: "Amoxicillin", rx: true }, { productId: "soap", name: "Soap" }, { productId: "amox", name: "Amoxicillin", rx: true, variantId: "v2" });
  assert.deepEqual(rxLines(cart).map((l) => l.productId), ["amox", "amox"]); assert.deepEqual(rxProductIds(cart), ["amox"]);
});

test("rxGate: an ordinary cart needs nothing", () => { const g = rxGate({ cart: cartOf({ productId: "soap" }), rx: null, canVerify: false }); assert.deepEqual([g.required, g.ready], [false, true]); });
test("rxGate: a plain cashier can't dispense it at all (only a pharmacist can verify)", () => {
  const g = rxGate({ cart: cartOf({ productId: "amox", name: "Amoxicillin", rx: true }), rx: { payload: {} }, canVerify: false });
  assert.deepEqual([g.required, g.ready, g.reason], [true, false, "pharmacist"]); assert.match(g.message, /pharmacist must verify.*Amoxicillin/);
});
test("rxGate: a pharmacist still has to record the prescription; once recorded the sale may proceed", () => {
  const cart = cartOf({ productId: "amox", name: "Amoxicillin", rx: true });
  assert.equal(rxGate({ cart, rx: null, canVerify: true }).reason, "missing");
  assert.equal(rxGate({ cart, rx: { payload: {} }, canVerify: true }).ready, true);
});

test("coversAll: every Rx medicine in the cart must be on the prescription", () => {
  assert.equal(coversAll(["a", "b", "c"], ["a", "b"]), true); assert.equal(coversAll(["a"], ["a", "b"]), false); assert.equal(coversAll(undefined, ["a"]), false); assert.equal(coversAll([], []), true);
});

test("paper form: a complete, recent prescription is accepted and shaped exactly like the API wants (explicit fields only)", () => {
  const r = validatePaperRx(form({ patientName: "  Sita   Rai ", notes: "  after food ", extra: "ignored" }), NOW);
  assert.ok(r.ok); assert.deepEqual(r.prescription, { source: "in_store", patientName: "Sita Rai", prescriberName: "Dr. A. Sharma", prescriberRegNo: "NMC-1", issuedOn: "2026-06-10", notes: "after food", verified: true });
  assert.ok(!("extra" in r.prescription));
});
test("paper form: optional fields are omitted when blank", () => { const p = validatePaperRx(form({ prescriberRegNo: " ", notes: "" }), NOW).prescription; assert.ok(!("prescriberRegNo" in p) && !("notes" in p)); });
test("paper form: each missing piece is reported against its own field", () => {
  const r = validatePaperRx({ patientName: "", prescriberName: " ", issuedOn: "", verified: false }, NOW);
  assert.equal(r.ok, false); assert.deepEqual(Object.keys(r.errors).sort(), ["issuedOn", "patientName", "prescriberName", "verified"]);
});
test("paper form: the pharmacist's confirmation must be exactly true", () => { for (const verified of [false, undefined, "true", 1, null]) assert.ok(validatePaperRx(form({ verified }), NOW).errors.verified, String(verified)); });
test("paper form: dates — malformed/impossible/future are refused; today and the oldest allowed day are fine; older is expired", () => {
  for (const issuedOn of ["", "yesterday", "2026-02-30", "2026-6-1", "2026-13-01"]) assert.ok(validatePaperRx(form({ issuedOn }), NOW).errors.issuedOn, issuedOn);
  assert.match(validatePaperRx(form({ issuedOn: "2026-06-16" }), NOW).errors.issuedOn, /future/);
  assert.ok(validatePaperRx(form({ issuedOn: todayISO(NOW) }), NOW).ok);
  assert.ok(validatePaperRx(form({ issuedOn: oldestIssueISO(NOW) }), NOW).ok);
  const tooOld = isoDate(new Date(NOW.getTime() - (RX_MAX_AGE_DAYS + 3) * 86_400_000)); assert.match(validatePaperRx(form({ issuedOn: tooOld }), NOW).errors.issuedOn, new RegExp(`older than ${RX_MAX_AGE_DAYS} days`));
});
test("the date helpers use the LOCAL calendar day (a prescription written today is 'today' for the cashier)", () => { assert.equal(todayISO(new Date(2026, 0, 1, 0, 5)), "2026-01-01"); assert.equal(todayISO(new Date(2026, 11, 31, 23, 55)), "2026-12-31"); });

test("describeRx shows who/when for paper and app prescriptions", () => {
  assert.deepEqual(describeRx({ payload: { source: "in_store" }, summary: { patientName: "Sita Rai", prescriberName: "Dr. A. Sharma", issuedOn: "2026-06-10", prescriberRegNo: "NMC-1" } }), { title: "Sita Rai · Dr. A. Sharma", detail: "Issued 2026-06-10 · Reg NMC-1" });
  assert.equal(describeRx({ payload: { source: "online" }, summary: { customerName: "Ram", approvedOn: "10 Jun" } }).title, "App prescription · Ram");
  assert.equal(describeRx(null), null);
});

test("the sale request carries the prescription only when there is one", () => {
  const cart = cartOf({ productId: "amox", rx: true }); const common = { store: "s", cart, payment: "upi", expectedTotal: 10, idempotencyKey: "k".repeat(20) };
  const p = validatePaperRx(form(), NOW).prescription;
  assert.deepEqual(buildSaleRequest({ ...common, prescription: p }).prescription, p);
  assert.ok(!("prescription" in buildSaleRequest({ ...common })));
});
