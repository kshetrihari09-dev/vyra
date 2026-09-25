import React, { useMemo } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Badge, Divider } from "../components/shared/ui.jsx";
import { categoryPath } from "../data/categories.js";
import { productById } from "../data/products.js";
import { fmt } from "../utils/format.js";

export default function AdminReports() {
  const { orders, products, categories } = useApp();
  const C = useC();

  const byCategory = useMemo(() => {
    const totals = {};
    orders.filter((o) => !["cancelled", "returned"].includes(o.status)).forEach((o) =>
      o.items.forEach((it) => {
        const p = productById(it.productId, products);
        if (!p) return;
        const root = categoryPath(p.categoryId, categories)[0];
        if (!root) return;
        totals[root.name] = (totals[root.name] || 0) + it.unitPrice * it.qty;
      }));
    const max = Math.max(1, ...Object.values(totals));
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, pct: (value / max) * 100 }));
  }, [orders, products, categories]);

  const topProducts = useMemo(() => [...products].sort((a, b) => b.sold - a.sold).slice(0, 6), [products]);
  const revenue = orders.filter((o) => !["cancelled", "returned"].includes(o.status)).reduce((s, o) => s + o.totals.total, 0);
  const aov = orders.length ? revenue / orders.length : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Revenue", value: fmt(revenue) },
          { label: "Orders", value: orders.length },
          { label: "Avg. order", value: fmt(aov) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="font-extrabold text-lg" style={{ color: C.navy }}>{s.value}</p>
            <p className="text-[11px]" style={{ color: C.muted }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <p className="font-extrabold text-sm mb-3" style={{ color: C.navy }}>Revenue by department</p>
        {byCategory.length === 0 ? <p className="text-sm" style={{ color: C.muted }}>No sales yet.</p> : byCategory.map((r) => (
          <div key={r.name} className="mb-3 last:mb-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: C.navy }}>{r.name}</span>
              <span className="text-xs font-bold" style={{ color: C.navy }}>{fmt(r.value)}</span>
            </div>
            <span className="block h-2 rounded-full overflow-hidden" style={{ background: C.bg }}>
              <span className="block h-full rounded-full" style={{ width: `${r.pct}%`, background: C.primary }} />
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <p className="font-extrabold text-sm mb-3" style={{ color: C.navy }}>Best selling products</p>
        {topProducts.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 py-2" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: C.mint, color: C.primary }}>{i + 1}</span>
            <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: C.navy }}>{p.name}</span>
            <Badge tone="neutral">{p.sold.toLocaleString()} sold</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
