import React, { useMemo } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Badge } from "../components/shared/ui.jsx";
import { fmt, dateLabel } from "../utils/format.js";
import { customerOf } from "../services/sellerAnalytics.js";

/* Derived from real orders (every order carries a customer snapshot), so the
   list and the figures always agree with the Orders screen. */
export default function AdminCustomers() {
  const { orders } = useApp();
  const C = useC();
  const customers = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      const c = customerOf(o);
      if (c.id === "walk-in") return;
      const m = map.get(c.id) || { ...c, orders: 0, spend: 0, last: o.placedAt };
      if (o.status !== "cancelled") { m.orders += 1; if (o.status !== "returned") m.spend += o.totals.total; }
      if (new Date(o.placedAt) > new Date(m.last)) m.last = o.placedAt;
      map.set(c.id, m);
    });
    return [...map.values()].sort((a, b) => b.spend - a.spend);
  }, [orders]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      {customers.map((c, i) => (
        <div key={c.id} className="flex items-center gap-3 p-4" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0" style={{ background: C.mint, color: C.primary }}>
            {c.name.split(" ").map((n) => n[0]).join("")}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: C.navy }}>{c.name}</p>
            <p className="text-[11px] truncate" style={{ color: C.muted }}>{c.email || c.phone} · last order {dateLabel(c.last)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold" style={{ color: C.navy }}>{fmt(c.spend)}</p>
            <p className="text-[11px]" style={{ color: C.muted }}>{c.orders} orders</p>
          </div>
        </div>
      ))}
    </div>
  );
}
