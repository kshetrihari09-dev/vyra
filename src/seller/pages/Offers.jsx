import React, { useMemo, useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useShop } from "../hooks/useShopData.js";
import { useS } from "../components/tokens.js";
import { Btn, DataTable, EmptyBlock, Field, Metric, Notice, NumberInput, PageHeader, Pagination, Panel, Pill, SearchField, Thumb, useTable } from "../components/kit.jsx";
import { resolveCategory } from "../../data/categories.js";
import { priceOf } from "../../utils/pricing.js";
import { discountPct } from "../../services/sellerAnalytics.js";
import { fmt } from "../../utils/format.js";

const round = (n) => Math.round(n * 100) / 100;

function withDiscount(p, d) {
  const f = 1 - d / 100;
  const next = { ...p, salePrice: round(p.price * f), updatedAt: new Date().toISOString() };
  if (p.variants?.length) next.variants = p.variants.map((v) => ({ ...v, salePrice: round(v.price * f) }));
  return next;
}

export default function Offers() {
  const s = useS();
  const { seller, listings, categories } = useShop();
  const { dispatch, toast } = useApp();
  const [picked, setPicked] = useState(new Set());
  const [pct, setPct] = useState(10);
  const [q, setQ] = useState("");
  const canWrite = seller.status === "active";

  const rows = useMemo(() => listings.filter((p) => p.status !== "pending_review").map((p) => ({ id: p.id, p, name: p.name, disc: discountPct(p), price: priceOf(p).price, mrp: priceOf(p).mrp })), [listings]);
  const filtered = useMemo(() => rows.filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  const table = useTable(filtered, { initialSort: { key: "disc", dir: "desc" }, pageSize: 10, sortAccessors: { name: (r) => r.name.toLowerCase() } });
  const onSale = rows.filter((r) => r.disc > 0).length;

  const toggle = (id) => setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const apply = (d) => {
    const targets = rows.filter((r) => picked.has(r.id));
    targets.forEach((r) => dispatch({ type: "PRODUCT_UPDATE", product: withDiscount(r.p, d) }));
    dispatch({ type: "AUDIT", entry: { actor: `${seller.name} (seller)`, action: d > 0 ? "Discount applied" : "Discount removed", detail: `${targets.length} product(s)${d > 0 ? ` · ${d}% off` : ""}` } });
    toast(d > 0 ? `${d}% off applied to ${targets.length} product(s)` : `Discount removed from ${targets.length} product(s)`);
    setPicked(new Set());
  };

  const pageAll = table.visible.length > 0 && table.visible.every((r) => picked.has(r.id));
  const columns = [
    { key: "pick", label: "", width: 36, mobile: "hide", render: (r) => <input type="checkbox" aria-label={`Select ${r.name}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /> },
    { key: "name", label: "Product", sortable: true, mobile: "title", render: (r) => <label className="flex items-center gap-3 min-w-0 cursor-pointer"><input type="checkbox" className="md:hidden" checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} /><Thumb product={r.p} size={36} /><span className="font-medium truncate max-w-[280px]">{r.name}</span></label> },
    { key: "mrp", label: "MRP", align: "right", render: (r) => fmt(r.mrp) },
    { key: "price", label: "Selling price", align: "right", render: (r) => <span className="font-medium">{fmt(r.price)}</span> },
    { key: "disc", label: "Discount", sortable: true, align: "right", mobile: "aside", render: (r) => (r.disc > 0 ? <Pill tone="ok">{r.disc}% off</Pill> : <span style={{ color: s.faint }}>None</span>) },
  ];

  return (
    <div>
      <PageHeader title="Offers" description="Discount your products." />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Metric label="Products on offer" icon="Megaphone" value={onSale} hint={`of ${rows.length} live or paused`} />
        <Metric label="Deepest discount" icon="TrendingUp" value={`${Math.max(...rows.map((r) => r.disc), 0)}%`} hint="Off MRP" />
      </div>

      <Panel title="Product discounts" subtitle="Changes update the selling price customers see straight away" padded={false}
        actions={<div className="flex items-center gap-2">
          <div className="w-28"><NumberInput value={pct} suffix="%" onChange={setPct} aria-label="Discount percentage" /></div>
          <Btn variant="primary" disabled={!canWrite || picked.size === 0 || !(pct > 0 && pct <= 90)} onClick={() => apply(pct)}>Apply{picked.size ? ` to ${picked.size}` : ""}</Btn>
          <Btn disabled={!canWrite || picked.size === 0} onClick={() => apply(0)}>Remove</Btn>
        </div>}>
        <div className="p-4 flex flex-col sm:flex-row gap-2 sm:items-center">
          <SearchField className="flex-1" value={q} onChange={(v) => { setQ(v); table.setPage(1); }} placeholder="Search your products" />
          <Btn size="sm" onClick={() => setPicked(pageAll ? new Set() : new Set(table.visible.map((r) => r.id)))}>{pageAll ? "Clear selection" : "Select this page"}</Btn>
        </div>
        <DataTable columns={columns} rows={table.visible} rowKey={(r) => r.id} sort={table.sort} onSort={table.toggleSort} empty={<EmptyBlock icon="Megaphone" title="No products to discount" message="Add products first, then run offers on them." />} />
        <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPage={table.setPage} />
      </Panel>
    </div>
  );
}
