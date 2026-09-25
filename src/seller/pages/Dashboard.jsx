import React, { useMemo, useState } from "react";
import { useShop } from "../hooks/useShopData.js";
import { useS } from "../components/tokens.js";
import { Btn, DataTable, EmptyBlock, Metric, PageHeader, Panel, Pill, Segmented, Thumb } from "../components/kit.jsx";
import { BarList, TrendChart } from "../components/charts.jsx";
import { Icon } from "../../components/shared/Icon.jsx";
import { dashboardKpis, pipelineCounts, salesSeries, periodTotals, topProducts } from "../../services/sellerAnalytics.js";
import { SELLER_STATUSES } from "../../services/orderStatus.js";
import { dateTimeLabel, fmt } from "../../utils/format.js";

const pctChange = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

export default function Dashboard({ nav }) {
  const s = useS();
  const { seller, rows, listings, available, inventory, inventoryTotals, customers } = useShop();
  const [days, setDays] = useState(14);
  const now = new Date();

  const kpi = useMemo(() => dashboardKpis(rows, now), [rows]);
  const pipeline = useMemo(() => pipelineCounts(rows), [rows]);
  const series = useMemo(() => salesSeries(rows, "day", days, now), [rows, days]);
  const totals = periodTotals(series);
  const since = new Date(now.getTime() - 30 * 864e5);
  const top = useMemo(() => topProducts(rows, 5, since), [rows]);
  const lowRows = inventory.filter((r) => ["low", "out"].includes(r.status.key) && r.product.status === "active").sort((a, b) => a.qty - b.qty).slice(0, 6);
  const activeCount = listings.filter((p) => p.status === "active").length;

  const columns = [
    { key: "number", label: "Order", mobile: "title", render: (r) => <div><p className="font-medium">{r.number}</p><p className="text-xs" style={{ color: s.muted }}>{r.customer.name}</p></div> },
    { key: "placedAt", label: "Placed", render: (r) => <span style={{ color: s.muted }}>{dateTimeLabel(r.placedAt)}</span> },
    { key: "subtotal", label: "Amount", align: "right", render: (r) => <span className="font-medium">{fmt(r.subtotal)}</span> },
    { key: "status", label: "Status", mobile: "aside", render: (r) => <Pill tone={r.status.tone}>{r.status.label}</Pill> },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description={`How ${seller.name} is doing today`}
        actions={<><Btn icon="Receipt" onClick={() => nav("shopOrders")}>View orders</Btn><Btn variant="primary" icon="Plus" onClick={() => nav("shopProducts", { new: "1" })}>Add product</Btn></>} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-3 mb-4">
        <Metric label="Today's sales" icon="TrendingUp" value={fmt(kpi.todaySales)} delta={pctChange(kpi.todaySales, kpi.yesterdaySales)} hint={kpi.yesterdaySales ? `vs ${fmt(kpi.yesterdaySales)} yesterday` : "No sales yesterday"} onClick={() => nav("shopSales")} />
        <Metric label="Today's orders" icon="Receipt" value={kpi.todayOrders} delta={pctChange(kpi.todayOrders, kpi.yesterdayOrders)} hint={`${kpi.yesterdayOrders} yesterday`} onClick={() => nav("shopOrders")} />
        <Metric label="Pending orders" icon="Clock" value={kpi.pending} hint={kpi.pendingNew ? `${kpi.pendingNew} not yet confirmed` : "Awaiting fulfilment"} tone={kpi.pending ? "#C98A0B" : undefined} onClick={() => nav("shopOrders", { status: "open" })} />
        <Metric label="Products" icon="Package" value={listings.length} hint={`${activeCount} active`} onClick={() => nav("shopProducts")} />
        <Metric label="Low stock" icon="AlertTriangle" value={inventoryTotals.low + inventoryTotals.out} hint={`${inventoryTotals.out} out of stock`} tone={inventoryTotals.low + inventoryTotals.out ? "#E0546A" : undefined} onClick={() => nav("shopInventory", { tab: "alerts" })} />
        <Metric label="Customers" icon="Users" value={customers.length} hint="Have ordered from you" onClick={() => nav("shopCustomers")} />
        <Metric label="Pending payouts" icon="Wallet" value={fmt(available)} hint="Available to withdraw" onClick={() => nav("shopPayouts")} />
      </div>

      {/* The shop-floor view: where every open order currently sits. */}
      <Panel title="Order pipeline" subtitle="Open orders by stage — select one to see them" className="mb-4">
        <ol className="grid grid-cols-5 gap-0">
          {pipeline.map((st, i) => {
            const meta = SELLER_STATUSES.find((x) => x.key === st.key);
            return (
              <li key={st.key} className="relative">
                {i < pipeline.length - 1 && <span aria-hidden className="absolute top-[19px] left-1/2 w-full h-px" style={{ background: s.line }} />}
                <button type="button" onClick={() => nav("shopOrders", { status: st.key })} className="relative w-full flex flex-col items-center gap-1.5 px-1 py-1 hover:opacity-80">
                  <span className="tnum w-10 h-10 inline-flex items-center justify-center text-base font-semibold"
                    style={{ borderRadius: 10, background: st.count ? s.accent : "#fff", color: st.count ? "#fff" : s.faint, border: `1px solid ${st.count ? s.accent : s.line}` }}>{st.count}</span>
                  <span className="text-[11px] sm:text-xs font-medium text-center leading-tight" style={{ color: st.count ? s.text : s.muted }}>{meta.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Panel className="xl:col-span-2" title="Sales summary"
          subtitle={`${fmt(totals.revenue)} from ${totals.orders} orders in the last ${days} days`}
          actions={<Segmented label="Period" value={days} onChange={setDays} options={[{ id: 7, label: "7 days" }, { id: 14, label: "14 days" }, { id: 30, label: "30 days" }]} />}>
          {totals.orders === 0 ? <EmptyBlock icon="TrendingUp" title="No sales in this period" message="Sales appear here as orders come in." />
            : <TrendChart data={series.map((b) => ({ label: b.label, value: b.revenue }))} format={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`)} ariaLabel="Daily sales" />}
        </Panel>
        <Panel title="Top selling products" subtitle="By revenue, last 30 days" actions={<Btn size="sm" variant="ghost" onClick={() => nav("shopReports")}>All</Btn>}>
          <BarList items={top.map((t) => ({ key: t.product.id, label: t.product.name, lead: <Thumb product={t.product} size={24} />, value: t.revenue, display: fmt(t.revenue), sub: `${t.units} sold` }))} empty="No sales in the last 30 days." />
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel className="xl:col-span-2" title="Recent orders" padded={false} actions={<Btn size="sm" variant="ghost" onClick={() => nav("shopOrders")}>View all</Btn>}>
          <DataTable columns={columns} rows={rows.slice(0, 6)} rowKey={(r) => r.id} onRowClick={(r) => nav("shopOrderDetails", { orderId: r.id })}
            empty={<EmptyBlock icon="Receipt" title="No orders yet" message="Orders containing your products will appear here." />} />
        </Panel>
        <Panel title="Low stock alerts" subtitle="Items at or below their minimum" padded={false}
          actions={<Btn size="sm" variant="ghost" onClick={() => nav("shopInventory")}>Inventory</Btn>}>
          {lowRows.length === 0 ? <EmptyBlock icon="Warehouse" title="Stock levels look healthy" message="Items running low will be listed here." /> : (
            <ul>
              {lowRows.map((r, i) => (
                <li key={r.key} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${s.lineSoft}` : "none" }}>
                  <Thumb product={r.product} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate" style={{ color: s.text }}>{r.name}</p>
                    <p className="text-xs tnum" style={{ color: s.muted }}>{r.qty} left · minimum {r.min}</p>
                  </div>
                  <Pill tone={r.status.tone}>{r.status.label}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
