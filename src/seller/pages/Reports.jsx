import React, { useMemo, useState } from "react";
import { useShop } from "../hooks/useShopData.js";
import { useApp } from "../../store/AppContext.jsx";
import { useS } from "../components/tokens.js";
import { Btn, DataTable, EmptyBlock, Metric, PageHeader, Panel, Select, Thumb } from "../components/kit.jsx";
import { BarList, TrendChart } from "../components/charts.jsx";
import { categoryPerformance, paymentSplit, salesSeries, topProducts } from "../../services/sellerAnalytics.js";
import { PAYMENT_LABELS } from "../../services/orderStatus.js";
import { downloadCsv } from "../../services/csv.js";
import { fmt } from "../../utils/format.js";

const PERIODS = { 30: "Last 30 days", 90: "Last 90 days", all: "All time" };
const money = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`);

export default function Reports() {
  const s = useS();
  const { seller, rows, categories, inventory, inventoryTotals } = useShop();
  const { toast } = useApp();
  const [period, setPeriod] = useState("30");
  const since = period === "all" ? null : new Date(Date.now() - Number(period) * 864e5);

  const top = useMemo(() => topProducts(rows, 10, since), [rows, period]);
  const cats = useMemo(() => categoryPerformance(rows, categories, since), [rows, categories, period]);
  const pay = useMemo(() => paymentSplit(rows, since), [rows, period]);
  const monthly = useMemo(() => salesSeries(rows, "month", 6), [rows]);
  const revenue = top.length ? cats.reduce((a, c) => a + c.revenue, 0) : 0;
  const stockTop = [...inventory].sort((a, b) => b.value - a.value).slice(0, 5);

  const exportProducts = () => {
    downloadCsv(`${seller.id}-top-products.csv`, [
      { label: "Product", value: (r) => r.product.name }, { label: "SKU", value: (r) => r.product.sku }, { label: "Units sold", value: (r) => r.units }, { label: "Revenue", value: (r) => r.revenue.toFixed(2) },
    ], topProducts(rows, 1000, since));
    toast("Top products exported");
  };
  const exportOrders = () => {
    downloadCsv(`${seller.id}-orders.csv`, [
      { label: "Order", value: (r) => r.number }, { label: "Date", value: (r) => r.placedAt }, { label: "Customer", value: (r) => r.customer.name },
      { label: "Items", value: (r) => r.units }, { label: "Amount", value: (r) => r.subtotal.toFixed(2) }, { label: "Payment", value: (r) => r.payment.label }, { label: "Status", value: (r) => r.status.label },
    ], rows.filter((r) => !since || new Date(r.placedAt) >= since));
    toast("Orders exported");
  };

  const columns = [
    { key: "rank", label: "#", width: 40, mobile: "hide", render: (r) => <span style={{ color: s.faint }}>{r.rank}</span> },
    { key: "name", label: "Product", mobile: "title", render: (r) => <div className="flex items-center gap-3 min-w-0"><Thumb product={r.product} size={32} /><span className="font-medium truncate">{r.product.name}</span></div> },
    { key: "units", label: "Units sold", align: "right", render: (r) => r.units },
    { key: "share", label: "Share of revenue", align: "right", render: (r) => `${revenue ? Math.round((r.revenue / revenue) * 100) : 0}%` },
    { key: "revenue", label: "Revenue", align: "right", mobile: "aside", render: (r) => <span className="font-semibold">{fmt(r.revenue)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Reports" description="Which products, categories and payment methods drive your business."
        actions={<><Select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Report period" className="!w-40">{Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select><Btn icon="Download" onClick={exportOrders}>Export orders</Btn></>} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Panel className="xl:col-span-2" title="Revenue trend" subtitle="Monthly revenue, last 6 months">
          {monthly.some((m) => m.revenue) ? <TrendChart data={monthly.map((m) => ({ label: m.label, value: m.revenue }))} format={money} ariaLabel="Monthly revenue" /> : <EmptyBlock icon="TrendingUp" title="No revenue yet" />}
        </Panel>
        <Panel title="Inventory value" subtitle="What's on your shelves right now">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Metric label="At cost" value={fmt(inventoryTotals.atCost)} hint={inventoryTotals.missingCost ? `${inventoryTotals.missingCost} uncosted` : "Fully costed"} />
            <Metric label="At retail" value={fmt(inventoryTotals.atRetail)} hint={`${inventoryTotals.units} units`} />
          </div>
          <BarList items={stockTop.map((r) => ({ key: r.key, label: r.name, value: r.value, display: fmt(r.value), sub: `${r.qty} × ${fmt(r.cost ?? r.price)} at ${r.valueBasis}` }))} empty="No stock on hand." />
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel className="xl:col-span-2" title="Top selling products" subtitle={PERIODS[period]} padded={false} actions={<Btn size="sm" icon="Download" onClick={exportProducts}>Export</Btn>}>
          <DataTable columns={columns} rows={top.map((t, i) => ({ ...t, rank: i + 1 }))} rowKey={(r) => r.product.id} empty={<EmptyBlock icon="Package" title="No sales in this period" />} />
        </Panel>
        <div className="space-y-4 min-w-0">
          <Panel title="Category performance" subtitle="Revenue by category"><BarList items={cats.map((c) => ({ key: c.id, label: c.name, value: c.revenue, display: fmt(c.revenue), sub: `${c.units} units · ${c.orders} orders` }))} /></Panel>
          <Panel title="Payment methods" subtitle="How customers paid"><BarList items={pay.map((p) => ({ key: p.method, label: PAYMENT_LABELS[p.method] || p.method, value: p.revenue, display: fmt(p.revenue), sub: `${p.orders} orders` }))} /></Panel>
        </div>
      </div>
    </div>
  );
}
