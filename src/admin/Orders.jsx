import React, { useEffect, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Badge, PillButton, Sheet } from "../components/shared/ui.jsx";
import { deliveryApi } from "../services/api/deliveryApi.js";
import { ORDER_STAGES, STATUS_STYLE, stageIndex } from "../customer/components/OrderTimeline.jsx";
import { ChevronRight } from "../components/shared/Icon.jsx";
import { storeById } from "../data/stores.js";
import { fmt, dateTimeLabel } from "../utils/format.js";
import { isPaymentCleared, paymentStatusOf } from "../services/orderStatus.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
  { id: "returned", label: "Returned" },
];

export default function AdminOrders({ nav }) {
  const { orders, commerce, dispatch, toast, session } = useApp();
  const C = useC();
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const rows = orders.filter((o) =>
    filter === "all" ? true :
    filter === "open" ? !["delivered", "cancelled", "returned"].includes(o.status) : o.status === filter);

  /* Dispatch (Phase 7): from "packed" an order is handed to a rider. Needs delivery:manage; everyone else just sees status. */
  const canDispatch = session.permissions?.includes("delivery:manage");
  const [riders, setRiders] = useState([]);
  const [active, setActive] = useState([]);     // live deliveries, to know who holds which order
  const [assigning, setAssigning] = useState(null);
  const refreshDispatch = () => Promise.all([deliveryApi.riders(), deliveryApi.active()]).then(([r, a]) => { setRiders(r); setActive(a); }).catch(() => {});
  useEffect(() => { if (canDispatch) refreshDispatch(); }, [canDispatch]); // eslint-disable-line react-hooks/exhaustive-deps
  const deliveryOf = (o) => active.find((d) => d.orderId === o.id);

  const dispatchAction = async (fn, message, orderId) => {
    setBusyId(orderId);
    try { await fn(); toast(message); await Promise.all([commerce.refreshOrder(orderId), refreshDispatch()]); setAssigning(null); }
    catch (err) { toast(err.message || "Couldn't update the delivery", "danger"); refreshDispatch(); }
    finally { setBusyId(null); }
  };

  const advance = async (o) => {
    const next = ORDER_STAGES[stageIndex(o.status) + 1];
    if (!next || stageIndex(next.id) > stageIndex("packed")) return;
    setBusyId(o.id);
    try {
      await commerce.advanceOrder(o.id, next.id);
      dispatch({ type: "AUDIT", entry: { actor: session.user.name, action: "Order status changed", detail: `${o.number} → ${next.label}` } });
      toast(`${o.number} → ${next.label}`);
    } catch (err) {
      toast(err.message || "Couldn't update the order", "danger");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className="px-3.5 py-2 rounded-full text-xs font-bold"
            style={{ background: filter === f.id ? C.primary : C.white, color: filter === f.id ? "#fff" : C.navy, border: `1px solid ${filter === f.id ? C.primary : C.border}` }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        {rows.map((o, i) => {
          const style = STATUS_STYLE[o.status];
          const next = stageIndex(o.status) < stageIndex("packed") ? ORDER_STAGES[stageIndex(o.status) + 1] : null; // beyond "packed" the delivery module moves it
          const del = deliveryOf(o);
          const live = !["delivered", "cancelled", "returned"].includes(o.status);
          const pay = paymentStatusOf(o);
          const gated = !!next && !!o.actions?.blocked && o.actions.next === next.id; // prepaid + unpaid: the backend refuses packing
          return (
            <div key={o.id} className="flex items-center gap-3 p-3.5" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <button onClick={() => nav("orderDetails", { orderId: o.id })} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold" style={{ color: C.navy }}>{o.number}</p>
                <p className="text-[11px]" style={{ color: C.muted }}>
                  {dateTimeLabel(o.placedAt)} · {o.items.length} items · {storeById(o.storeId).code}
                </p>
              </button>
              <span className="text-sm font-bold shrink-0" style={{ color: C.navy }}>{fmt(o.totals.total)}</span>
              <Badge tone={style.tone}>{style.label}</Badge>
              <Badge tone={pay.tone}>{pay.label}</Badge>
              {live && next && (
                <button onClick={() => advance(o)} disabled={busyId === o.id || gated} title={gated ? "Payment pending — can't be packed until the payment is confirmed" : undefined}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0" style={{ background: C.mint, color: C.primary, opacity: busyId === o.id || gated ? 0.5 : 1 }}>
                  {busyId === o.id ? "…" : gated ? "Awaiting payment" : `→ ${next.label}`}
                </button>
              )}
              {canDispatch && o.status === "packed" && isPaymentCleared(o) && (
                <button onClick={() => setAssigning(o)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0" style={{ background: C.primary, color: "#fff" }}>Assign rider</button>
              )}
              {canDispatch && del && ["assigned", "accepted"].includes(del.status) && (
                <button onClick={() => setAssigning(o)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0" style={{ background: C.mint, color: C.primary }}>{del.riderName} · change</button>
              )}
              {canDispatch && del?.status === "picked_up" && <span className="text-[11px] font-bold shrink-0" style={{ color: C.muted }}>{del.riderName} · on the road</span>}
              <ChevronRight size={16} style={{ color: C.muted }} className="shrink-0 hidden md:block" />
            </div>
          );
        })}
        {rows.length === 0 && <p className="p-6 text-center text-sm" style={{ color: C.muted }}>No orders in this view.</p>}
      </div>

      <Sheet open={!!assigning} onClose={() => setAssigning(null)} title={assigning ? `Rider for ${assigning.number}` : ""}>
        {assigning && (() => {
          const del = deliveryOf(assigning);
          const usable = riders.filter((r) => r.status === "active" && r.id !== del?.riderId);
          return (
            <div className="space-y-2">
              {usable.length === 0 && <p className="text-sm" style={{ color: C.muted }}>No active riders. Add one from Users (they need the Delivery role and a rider profile).</p>}
              {usable.map((r) => (
                <button key={r.id} disabled={busyId === assigning.id}
                  onClick={() => dispatchAction(() => (del ? deliveryApi.reassign(del.id, r.id) : deliveryApi.assign(assigning.id, r.id)), `${assigning.number} → ${r.name}`, assigning.id)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                  <span className="flex-1"><span className="block text-sm font-bold" style={{ color: C.navy }}>{r.name}</span>
                    <span className="block text-[11px]" style={{ color: C.muted }}>{r.vehicle} · {r.activeCount} active{r.isAvailable ? "" : " · off duty"}</span></span>
                </button>
              ))}
              {del && ["assigned", "accepted"].includes(del.status) && (
                <PillButton full variant="subtle" onClick={() => dispatchAction(() => deliveryApi.unassign(del.id), `${assigning.number} back in the queue`, assigning.id)}>Take off {del.riderName} (back to packed)</PillButton>
              )}
              {del?.order?.otpRequired && (
                <PillButton full variant="subtle" onClick={() => dispatchAction(() => deliveryApi.resetOtp(assigning.id), "Handover code reset — the customer sees a new one", assigning.id)}>Reset handover code (after a lockout)</PillButton>
              )}
            </div>
          );
        })()}
      </Sheet>
    </div>
  );
}
