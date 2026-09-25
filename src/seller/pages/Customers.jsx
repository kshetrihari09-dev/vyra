import React, { useMemo, useState } from "react";
import { useShop } from "../hooks/useShopData.js";
import { useS } from "../components/tokens.js";
import { DataTable, Drawer, EmptyBlock, KeyValue, Metric, PageHeader, Pagination, Panel, Pill, SearchField, Select, useTable } from "../components/kit.jsx";
import { dateLabel, dateTimeLabel, fmt } from "../../utils/format.js";

const STATUS_TONE = { New: "info", Active: "ok", Inactive: "neutral" };

function Avatar({ name }) {
  const s = useS();
  return <span className="w-8 h-8 inline-flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: s.accentSoft, color: s.accent, borderRadius: 999 }}>{name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>;
}

export default function Customers({ nav, params }) {
  const s = useS();
  const { customers } = useShop();
  const [q, setQ] = useState(params.q || "");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return customers.filter((c) => (status === "all" || c.status === status) && (!t || c.name.toLowerCase().includes(t) || (c.phone || "").replace(/\s/g, "").includes(t.replace(/\s/g, "")) || (c.email || "").toLowerCase().includes(t)));
  }, [customers, q, status]);
  const table = useTable(filtered, { initialSort: { key: "spend", dir: "desc" }, pageSize: 10, sortAccessors: { name: (c) => c.name.toLowerCase(), last: (c) => new Date(c.last).getTime() } });

  const columns = [
    { key: "name", label: "Customer", sortable: true, mobile: "title", render: (c) => <div className="flex items-center gap-3 min-w-0"><Avatar name={c.name} /><span className="font-medium truncate">{c.name}</span></div> },
    { key: "phone", label: "Phone", render: (c) => <span className="tnum" style={{ color: s.muted }}>{c.phone || "—"}</span> },
    { key: "email", label: "Email", render: (c) => <span className="truncate block max-w-[200px]" style={{ color: s.muted }}>{c.email || "—"}</span> },
    { key: "orders", label: "Total orders", sortable: true, align: "right", render: (c) => c.orders },
    { key: "spend", label: "Total spending", sortable: true, align: "right", render: (c) => <span className="font-medium">{fmt(c.spend)}</span> },
    { key: "last", label: "Last order", sortable: true, render: (c) => <span style={{ color: s.muted }}>{dateLabel(c.last)}</span> },
    { key: "status", label: "Status", mobile: "aside", render: (c) => <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill> },
  ];

  const active = customers.filter((c) => c.status === "Active" || c.status === "New").length;
  const repeat = customers.filter((c) => c.orders > 1).length;

  return (
    <div>
      <PageHeader title="Customers" description="People who have ordered from your shop. You only see what you need to fulfil their orders." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Metric label="Customers" icon="Users" value={customers.length} hint="All time" />
        <Metric label="Active" icon="CheckCircle2" value={active} hint="Ordered in the last 30 days" />
        <Metric label="Repeat customers" icon="RotateCcw" value={repeat} hint={customers.length ? `${Math.round((repeat / customers.length) * 100)}% of customers` : "—"} />
        <Metric label="Avg. lifetime spend" icon="Wallet" value={fmt(customers.length ? customers.reduce((a, c) => a + c.spend, 0) / customers.length : 0)} hint="Per customer" />
      </div>
      <Panel padded={false}>
        <div className="flex flex-col sm:flex-row gap-2 p-4">
          <SearchField className="flex-1" value={q} onChange={(v) => { setQ(v); table.setPage(1); }} placeholder="Search by name, phone or email" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); table.setPage(1); }} aria-label="Filter by status" className="sm:!w-44">
            <option value="all">All statuses</option><option>New</option><option>Active</option><option>Inactive</option>
          </Select>
        </div>
        <DataTable columns={columns} rows={table.visible} rowKey={(c) => c.id} sort={table.sort} onSort={table.toggleSort} onRowClick={setSelected}
          empty={<EmptyBlock icon="Users" title={customers.length ? "No customers match" : "No customers yet"} message={customers.length ? "Try a different search or status." : "Customers appear here after their first order."} />} />
        <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPage={table.setPage} />
      </Panel>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name} subtitle="Order history with your shop" width={520}>
        {selected && (
          <div>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[["Orders", selected.orders], ["Spent", fmt(selected.spend)], ["Average", fmt(selected.orders ? selected.spend / Math.max(selected.rows.filter((r) => !["cancelled", "returned"].includes(r.order.status)).length, 1) : 0)]].map(([k, v]) => (
                <div key={k} className="p-3" style={{ background: s.canvas, borderRadius: s.r }}><p className="text-xs" style={{ color: s.muted }}>{k}</p><p className="text-base font-semibold tnum mt-0.5" style={{ color: s.text }}>{v}</p></div>
              ))}
            </div>
            <KeyValue rows={[["Phone", selected.phone || "—"], ["Email", selected.email || "—"], ["Status", <Pill tone={STATUS_TONE[selected.status]}>{selected.status}</Pill>], ["Last order", dateTimeLabel(selected.last)]]} />
            <h3 className="text-sm font-semibold mt-6 mb-2" style={{ color: s.text }}>Orders</h3>
            <ul style={{ border: `1px solid ${s.line}`, borderRadius: s.rPanel }}>
              {selected.rows.map((r, i) => (
                <li key={r.id}>
                  <button type="button" onClick={() => { setSelected(null); nav("shopOrderDetails", { orderId: r.id }); }} className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-black/[.02]" style={{ borderTop: i ? `1px solid ${s.lineSoft}` : "none" }}>
                    <span className="min-w-0"><span className="block text-sm font-medium tnum" style={{ color: s.text }}>{r.number}</span><span className="block text-xs" style={{ color: s.muted }}>{dateLabel(r.placedAt)} · {r.units} item(s)</span></span>
                    <span className="flex items-center gap-3 shrink-0"><span className="text-sm font-medium tnum">{fmt(r.subtotal)}</span><Pill tone={r.status.tone}>{r.status.label}</Pill></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Drawer>
    </div>
  );
}
