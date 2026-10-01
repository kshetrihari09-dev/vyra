import React, { useMemo, useState } from "react";
import { useShop } from "../hooks/useShopData.js";
import { useS } from "../components/tokens.js";
import { DataTable, EmptyBlock, Metric, PageHeader, Panel, Segmented } from "../components/kit.jsx";
import { TrendChart } from "../components/charts.jsx";
import { periodTotals, salesSeries } from "../../services/sellerAnalytics.js";
import { fmt, fmtCompact } from "../../utils/format.js";

const GRAN = {
  day: { count: 30, label: "Daily", span: "last 30 days", unit: "day" },
  week: { count: 12, label: "Weekly", span: "last 12 weeks", unit: "week" },
  month: { count: 6, label: "Monthly", span: "last 6 months", unit: "month" },
};
const pct = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
const money = fmtCompact;

export default function Sales() {
  const s = useS();
  const { rows } = useShop();
  const [g, setG] = useState("day");
  const cfg = GRAN[g];

  const all = useMemo(() => salesSeries(rows, g, cfg.count * 2), [rows, g]);
  const cur = all.slice(cfg.count), prev = all.slice(0, cfg.count);
  const t = periodTotals(cur), p = periodTotals(prev);
  const hasData = t.orders > 0;

  const columns = [
    { key: "label", label: cfg.unit[0].toUpperCase() + cfg.unit.slice(1), mobile: "title", render: (b) => <span className="font-medium">{b.label}</span> },
    { key: "orders", label: "Orders", align: "right", render: (b) => b.orders },
    { key: "units", label: "Units", align: "right", render: (b) => b.units },
    { key: "aov", label: "Avg. order", align: "right", render: (b) => (b.orders ? fmt(b.aov) : "—") },
    { key: "cancelled", label: "Cancelled / returned", align: "right", render: (b) => b.cancelled },
    { key: "revenue", label: "Revenue", align: "right", mobile: "aside", render: (b) => <span className="font-semibold">{fmt(b.revenue)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Sales" description={`Revenue and order volume over the ${cfg.span}, compared with the period before.`}
        actions={<Segmented label="Granularity" value={g} onChange={setG} options={Object.entries(GRAN).map(([id, v]) => ({ id, label: v.label }))} />} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Metric label="Revenue" icon="TrendingUp" value={fmt(t.revenue)} delta={pct(t.revenue, p.revenue)} hint="vs previous period" />
        <Metric label="Orders" icon="Receipt" value={t.orders} delta={pct(t.orders, p.orders)} hint={`${t.cancelled} cancelled or returned`} />
        <Metric label="Average order value" icon="Wallet" value={fmt(t.aov)} delta={pct(t.aov, p.aov)} hint="Your items only" />
        <Metric label="Units sold" icon="Package" value={t.units} delta={pct(t.units, p.units)} hint="vs previous period" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Panel className="xl:col-span-2" title="Revenue trend" subtitle={`${cfg.label} revenue, ${cfg.span}`}>
          {hasData ? <TrendChart data={cur.map((b) => ({ label: b.label, value: b.revenue }))} format={money} ariaLabel="Revenue trend" /> : <EmptyBlock icon="TrendingUp" title="No sales in this period" message="Revenue will chart here as orders come in." />}
        </Panel>
        <Panel title="Orders" subtitle={`${cfg.label} order count`}>
          {hasData ? <TrendChart type="bar" height={220} data={cur.map((b) => ({ label: b.label, value: b.orders }))} format={(v) => String(Math.round(v))} ariaLabel="Orders" /> : <EmptyBlock icon="Receipt" title="No orders in this period" />}
        </Panel>
      </div>
      <Panel title={`${cfg.label} breakdown`} subtitle="Cancelled and returned orders aren't counted as revenue" padded={false}>
        <DataTable columns={columns} rows={[...cur].reverse()} rowKey={(b) => b.start.toISOString()} />
      </Panel>
    </div>
  );
}
