import React, { useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useShop } from "../hooks/useShopData.js";
import { Btn, ConfirmModal } from "./kit.jsx";
import { canCancel, canReturn, nextSellerStep } from "../../services/orderStatus.js";

/* Fulfilment controls for one order. A shop can only move an order it fully
   owns: when a basket spans several sellers the status is shared, so those
   orders are read-only here rather than letting one shop change another's. */
export default function OrderActions({ row, size = "sm", showView, onView }) {
  const { seller } = useShop();
  const { dispatch, toast } = useApp();
  const [dialog, setDialog] = useState(null);
  const { order } = row;
  const editable = row.soleSeller && seller.status === "active";
  const step = nextSellerStep(order.status);
  const audit = (action) => dispatch({ type: "AUDIT", entry: { actor: `${seller.name} (seller)`, action, detail: order.number } });

  const advance = () => {
    dispatch({ type: "ORDER_ADVANCE", id: order.id, status: step.to, patch: {} });
    audit(`Order → ${step.label}`);
    toast(`${order.number}: ${step.label.toLowerCase()}`);
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5 justify-end">
        {showView && <Btn size={size} onClick={onView}>View</Btn>}
        {editable && step && <Btn size={size} variant="primary" onClick={advance}>{step.label}</Btn>}
        {editable && canCancel(order.status) && <Btn size={size} variant="danger" onClick={() => setDialog("cancel")}>Cancel</Btn>}
        {editable && canReturn(order.status) && <Btn size={size} onClick={() => setDialog("return")}>Mark returned</Btn>}
      </div>

      <ConfirmModal open={dialog === "cancel"} danger title={`Cancel ${order.number}?`} confirmLabel="Cancel order" onClose={() => setDialog(null)}
        message="The customer is notified and any prepaid amount is refunded. This can't be undone."
        onConfirm={() => { dispatch({ type: "ORDER_CANCEL", id: order.id }); audit("Order cancelled"); toast(`${order.number} cancelled`); }} />
      <ConfirmModal open={dialog === "return"} title={`Mark ${order.number} as returned?`} confirmLabel="Mark returned" onClose={() => setDialog(null)}
        message="Use this once the goods are back with you. The order stops counting toward your sales and payouts."
        onConfirm={() => { dispatch({ type: "ORDER_ADVANCE", id: order.id, status: "returned", patch: { returnedAt: new Date().toISOString() } }); audit("Order returned"); toast(`${order.number} marked returned`); }} />
    </div>
  );
}
