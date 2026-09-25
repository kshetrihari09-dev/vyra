import React, { useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useShop } from "../hooks/useShopData.js";
import { useS } from "./tokens.js";
import { Btn, ConfirmModal, Field, Input, Modal } from "./kit.jsx";
import { canCancel, canReturn, nextSellerStep } from "../../services/orderStatus.js";

/* Fulfilment controls for one order. A shop can only move an order it fully
   owns: when a basket spans several sellers the status is shared, so those
   orders are read-only here rather than letting one shop change another's. */
export default function OrderActions({ row, size = "sm", showView, onView }) {
  const s = useS();
  const { seller } = useShop();
  const { dispatch, toast } = useApp();
  const [dialog, setDialog] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const { order } = row;
  const editable = row.soleSeller && seller.status === "active";
  const step = nextSellerStep(order.status);
  const audit = (action) => dispatch({ type: "AUDIT", entry: { actor: `${seller.name} (seller)`, action, detail: order.number } });

  const advance = () => {
    if (step.to === "delivered" && order.otpRequired && order.otp) { setCode(""); setError(""); setDialog("otp"); return; }
    const patch = step.to === "out_for_delivery"
      ? { partner: order.partner || { name: `${seller.name} delivery`, phone: seller.contactPhone || "", vehicle: "Shop delivery" } }
      : step.to === "delivered" ? { deliveredAt: new Date().toISOString() } : {};
    dispatch({ type: "ORDER_ADVANCE", id: order.id, status: step.to, patch });
    audit(`Order → ${step.label}`);
    toast(`${order.number}: ${step.label.toLowerCase()}`);
  };

  const verify = () => {
    if (code.trim() !== order.otp) { setError("That code doesn't match. Ask the customer to read it again."); return; }
    dispatch({ type: "ORDER_ADVANCE", id: order.id, status: "delivered", patch: { deliveredAt: new Date().toISOString(), otp: null } });
    audit("Order delivered (code verified)");
    toast(`${order.number} delivered`);
    setDialog(null);
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
      <Modal open={dialog === "otp"} onClose={() => setDialog(null)} title="Confirm delivery" size={400}
        footer={<><Btn onClick={() => setDialog(null)}>Cancel</Btn><Btn variant="primary" onClick={verify} disabled={code.length !== 4}>Confirm delivery</Btn></>}>
        <p className="text-sm mb-3" style={{ color: s.muted }}>Ask the customer for the 4-digit code shown in their app. The order is only marked delivered when it matches.</p>
        <Field label="Delivery code" error={error}>
          <Input value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} inputMode="numeric" placeholder="0000" error={error} autoFocus />
        </Field>
        <p className="text-[11px] mt-3" style={{ color: s.faint }}>Demo hint: the code for this order is {order.otp}.</p>
      </Modal>
    </div>
  );
}
