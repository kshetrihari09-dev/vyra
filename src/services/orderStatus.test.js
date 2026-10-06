import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PAYMENT_FILTERS, canCancel, deliveryStatusOf, isPaymentCleared, nextSellerAction, paymentStatusOf } from "./orderStatus.js";
import { sellerSlice } from "../utils/sellerOrders.js";

const order = (o) => ({ id: "o1", status: "placed", paymentMethod: "cod", paymentStatus: "pending", items: [], ...o });

describe("payment display follows the backend paymentStatus, never the chosen method", () => {
  it("COD pending: cash is due, not paid", () => {
    const p = paymentStatusOf(order({}));
    assert.equal(p.label, "Cash due");
    assert.equal(p.amountLabel, "Amount due");
    assert.equal(p.paid, false);
  });
  it("prepaid pending is NOT shown as paid", () => {
    for (const m of ["card", "upi", "netbanking"]) {
      const p = paymentStatusOf(order({ paymentMethod: m, paymentStatus: "pending" }));
      assert.equal(p.label, "Payment pending", m);
      assert.equal(p.amountLabel, "Amount");
      assert.equal(p.paid, false);
    }
  });
  it("a missing status is treated as pending, never as paid", () => {
    assert.equal(paymentStatusOf(order({ paymentMethod: "card", paymentStatus: undefined })).label, "Payment pending");
  });
  it("prepaid captured: Paid + 'Amount paid'", () => {
    const p = paymentStatusOf(order({ paymentMethod: "card", paymentStatus: "paid", status: "preparing" }));
    assert.deepEqual([p.label, p.amountLabel, p.paid], ["Paid", "Amount paid", true]);
  });
  it("COD collected on delivery: Paid (cash)", () => {
    assert.equal(paymentStatusOf(order({ paymentStatus: "paid", status: "delivered" })).label, "Paid (cash)");
  });
  it("cancelled orders: unpaid → not collected; paid → refund pending until the refund completes; refunded → Refunded", () => {
    assert.equal(paymentStatusOf(order({ paymentMethod: "card", status: "cancelled", paymentStatus: "not_collected" })).label, "Not collected");
    assert.equal(paymentStatusOf(order({ paymentMethod: "card", status: "cancelled", paymentStatus: "paid" })).label, "Refund pending");
    assert.equal(paymentStatusOf(order({ paymentMethod: "card", status: "cancelled", paymentStatus: "refunded" })).label, "Refunded");
  });
  it("every label it can produce is offered by the seller's payment filter", () => {
    const cases = [{}, { paymentMethod: "card" }, { paymentMethod: "card", paymentStatus: "paid" }, { paymentStatus: "paid" }, { paymentStatus: "refunded" },
      { paymentStatus: "not_collected" }, { paymentMethod: "card", paymentStatus: "paid", status: "cancelled" }];
    for (const c of cases) assert.ok(PAYMENT_FILTERS.includes(paymentStatusOf(order(c)).label), JSON.stringify(c));
  });
});

describe("seller actions mirror the backend rules", () => {
  it("cancel is offered only before packed (what the backend supports)", () => {
    for (const s of ["placed", "confirmed", "preparing"]) assert.equal(canCancel(order({ status: s })), true, s);
    for (const s of ["packed", "assigned", "out_for_delivery", "delivered", "cancelled", "returned"]) assert.equal(canCancel(order({ status: s })), false, s);
    assert.equal(canCancel("packed"), false);
    assert.equal(canCancel("preparing"), true);
  });
  it("the server's actions.canCancel wins over the local rule", () => {
    assert.equal(canCancel(order({ status: "preparing", actions: { canCancel: false } })), false);
  });
  it("the seller flow is confirm → prepare → pack, and packing is blocked while a prepaid order is unpaid", () => {
    assert.equal(nextSellerAction(order({ status: "placed" })).to, "confirmed");
    assert.equal(nextSellerAction(order({ status: "confirmed" })).to, "preparing");
    const cod = nextSellerAction(order({ status: "preparing" }));
    assert.deepEqual([cod.to, cod.blocked], ["packed", false]);
    const prepaid = nextSellerAction(order({ status: "preparing", paymentMethod: "card" }));
    assert.equal(prepaid.blocked, true);
    assert.match(prepaid.reason, /Payment pending/);
    assert.equal(nextSellerAction(order({ status: "preparing", paymentMethod: "card", paymentStatus: "paid" })).blocked, false);
    // earlier steps are never blocked by payment
    assert.equal(nextSellerAction(order({ status: "confirmed", paymentMethod: "card" })).blocked, false);
  });
  it("the backend's actions flag is preferred for the gate", () => {
    const o = order({ status: "preparing", paymentMethod: "card", actions: { next: "packed", blocked: "PAYMENT_PENDING", canCancel: true } });
    assert.equal(nextSellerAction(o).blocked, true);
    assert.equal(nextSellerAction({ ...o, actions: { next: "packed", blocked: null, canCancel: true } }).blocked, false);
  });
  it("no seller step from packed on — the delivery module owns it", () => {
    for (const s of ["packed", "assigned", "out_for_delivery", "delivered", "cancelled", "returned"]) assert.equal(nextSellerAction(order({ status: s })), null, s);
  });
  it("isPaymentCleared: COD always, prepaid only when paid", () => {
    assert.equal(isPaymentCleared(order({})), true);
    assert.equal(isPaymentCleared(order({ paymentMethod: "card" })), false);
    assert.equal(isPaymentCleared(order({ paymentMethod: "card", paymentStatus: "paid" })), true);
  });
});

describe("shared baskets: sole-seller comes from the server's sellerView", () => {
  const products = [{ id: "p1", sellerId: "s1" }];
  const base = { items: [{ productId: "p1", qty: 2, unitPrice: 5 }] };
  it("trusts sellerView.soleSeller — the server already trimmed the lines to this shop, so counting lines would always say 'sole'", () => {
    assert.equal(sellerSlice(order({ ...base, sellerView: { soleSeller: false } }), products, "s1").soleSeller, false);
    assert.equal(sellerSlice(order({ ...base, sellerView: { soleSeller: true } }), products, "s1").soleSeller, true);
  });
  it("falls back to comparing lines when the order has no sellerView (buyer / staff copies)", () => {
    assert.equal(sellerSlice(order(base), products, "s1").soleSeller, true);
    const mixed = order({ items: [...base.items, { productId: "p2", qty: 1, unitPrice: 3 }] });
    assert.equal(sellerSlice(mixed, [...products, { id: "p2", sellerId: "s2" }], "s1").soleSeller, false);
  });
  it("a shop with no line in the order gets no slice", () => {
    assert.equal(sellerSlice(order(base), products, "s9"), null);
  });
});

describe("seller delivery status follows the server's derived delivery stage", () => {
  const o = (status, stage) => ({ status, delivery: stage ? { stage: { id: stage } } : undefined });
  it("is unchanged where no partner is involved", () => {
    assert.equal(deliveryStatusOf(o("preparing")).label, "Not dispatched");
    assert.equal(deliveryStatusOf(o("packed", "preparing")).label, "Awaiting pickup");
    assert.equal(deliveryStatusOf(o("delivered", "delivered")).label, "Delivered");
  });
  it("names each step once a partner is assigned", () => {
    assert.equal(deliveryStatusOf(o("assigned", "partner_assigned")).label, "Partner assigned");
    assert.equal(deliveryStatusOf(o("out_for_delivery", "picked_up")).label, "Picked up");
    assert.equal(deliveryStatusOf(o("out_for_delivery", "on_the_way")).label, "On the way");
  });
  it("falls back to the old wording for an order object that carries no stage", () => {
    assert.equal(deliveryStatusOf(o("out_for_delivery")).label, "In transit");
  });
});
