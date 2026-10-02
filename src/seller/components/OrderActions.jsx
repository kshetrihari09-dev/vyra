import React, { useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useShop } from "../hooks/useShopData.js";
import { Btn, ConfirmModal } from "./kit.jsx";
import { canCancel, nextSellerAction } from "../../services/orderStatus.js";

/* Errors that mean "the order moved under you" (another tab, the customer, dispatch) — the cached copy is stale. */
const STALE = ["INVALID_TRANSITION", "TOO_LATE_TO_CANCEL", "ALREADY_FINAL", "PAYMENT_PENDING", "USE_DELIVERY_FLOW", "ORDER_NOT_FOUND"];

/* Fulfilment controls for one order. Every action goes to the backend, which decides whether it is allowed; this
   component only mirrors `order.actions` (next step / payment gate / cancellable) so a button that is guaranteed to
   be refused isn't offered. A shop can only move an order it fully owns: when a basket spans several sellers the
   status is shared, so those orders are read-only here rather than letting one shop change another's. */
export default function OrderActions({ row, size = "sm", showView, onView }) {
  const { seller } = useShop();
  const { commerce, toast } = useApp();
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const { order } = row;
  const editable = row.soleSeller && seller.status === "active";
  const step = nextSellerAction(order);

  /** Run a backend action; on failure show the server's message and re-sync the order if it has changed underneath us. */
  const run = async (fn, okMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast(okMessage);
    } catch (err) {
      toast(err.message || "Couldn't update the order", "danger");
      if (STALE.includes(err.code)) commerce.refreshOrder(order.id).catch(() => {});
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  const advance = () => run(() => commerce.advanceOrder(order.id, step.to), `${order.number}: ${step.label.toLowerCase()}`);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5 justify-end">
        {showView && <Btn size={size} onClick={onView}>View</Btn>}
        {editable && step && (
          <Btn size={size} variant="primary" disabled={busy || step.blocked} title={step.reason || undefined} onClick={advance}>{step.label}</Btn>
        )}
        {editable && canCancel(order) && <Btn size={size} variant="danger" disabled={busy} onClick={() => setDialog("cancel")}>Cancel</Btn>}
      </div>
      {editable && step?.blocked && <p className="text-[11px] mt-1 text-right" style={{ color: "#B45309" }}>Payment pending</p>}

      <ConfirmModal open={dialog === "cancel"} danger title={`Cancel ${order.number}?`} confirmLabel="Cancel order" onClose={() => setDialog(null)}
        message="The customer is notified, the reserved stock is released, and any amount they already paid is queued for refund. This can't be undone."
        onConfirm={() => run(() => commerce.cancelOrder(order.id), `${order.number} cancelled`)} />
    </div>
  );
}
