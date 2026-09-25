import React, { useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Badge, PillButton } from "../components/shared/ui.jsx";
import { ORDER_STAGES, STATUS_STYLE, stageIndex } from "../customer/components/OrderTimeline.jsx";
import { ChevronRight } from "../components/shared/Icon.jsx";
import { storeById } from "../data/stores.js";
import { fmt, dateTimeLabel } from "../utils/format.js";

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

  const advance = async (o) => {
    const next = ORDER_STAGES[stageIndex(o.status) + 1];
    if (!next) return;
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
          const next = ORDER_STAGES[stageIndex(o.status) + 1];
          const live = !["delivered", "cancelled", "returned"].includes(o.status);
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
              {live && next && (
                <button onClick={() => advance(o)} disabled={busyId === o.id} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0" style={{ background: C.mint, color: C.primary, opacity: busyId === o.id ? 0.6 : 1 }}>
                  {busyId === o.id ? "…" : `→ ${next.label}`}
                </button>
              )}
              <ChevronRight size={16} style={{ color: C.muted }} className="shrink-0 hidden md:block" />
            </div>
          );
        })}
        {rows.length === 0 && <p className="p-6 text-center text-sm" style={{ color: C.muted }}>No orders in this view.</p>}
      </div>
    </div>
  );
}
