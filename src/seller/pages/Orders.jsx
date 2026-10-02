import React, { useMemo, useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useShop } from "../hooks/useShopData.js";
import { useS } from "../components/tokens.js";
import { Btn, DataTable, EmptyBlock, KeyValue, Notice, PageHeader, Pagination, Panel, Pill, SearchField, Select, Tabs, Thumb, useTable } from "../components/kit.jsx";
import OrderActions from "../components/OrderActions.jsx";
import { Icon } from "../../components/shared/Icon.jsx";
import { PAYMENT_FILTERS, PAYMENT_LABELS, SELLER_STATUSES, isPrepaid, sellerStatusOf } from "../../services/orderStatus.js";
import { storeById } from "../../data/stores.js";
import { districtName, municipalityName, provinceName } from "../../data/locations.js";
import { dateLabel, dateTimeLabel, fmt } from "../../utils/format.js";

const OPEN = ["pending", "confirmed", "preparing", "ready"];
const RANGES = { all: null, today: 0, week: 7, month: 30 };

function OrderList({ nav, params }) {
  const s = useS();
  const { rows } = useShop();
  const [tab, setTab] = useState(params.status || "all");
  const [q, setQ] = useState("");
  const [pay, setPay] = useState("all");
  const [range, setRange] = useState("all");

  const counts = useMemo(() => {
    const c = { all: rows.length, open: rows.filter((r) => OPEN.includes(r.status.key)).length };
    SELLER_STATUSES.forEach((st) => { c[st.key] = rows.filter((r) => r.status.key === st.key).length; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const since = RANGES[range] == null ? null : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - RANGES[range]); return d; })();
    return rows.filter((r) => (tab === "all" || (tab === "open" ? OPEN.includes(r.status.key) : r.status.key === tab))
      && (pay === "all" || r.payment.label === pay) && (!since || new Date(r.placedAt) >= since)
      && (!t || r.number.toLowerCase().includes(t) || r.customer.name.toLowerCase().includes(t) || (r.customer.phone || "").replace(/\s/g, "").includes(t.replace(/\s/g, ""))));
  }, [rows, tab, q, pay, range]);

  const table = useTable(filtered, { initialSort: { key: "placedAt", dir: "desc" }, pageSize: 10, sortAccessors: { placedAt: (r) => new Date(r.placedAt).getTime(), customer: (r) => r.customer.name.toLowerCase(), number: (r) => r.number } });
  const open = (r) => nav("shopOrderDetails", { orderId: r.id });

  const columns = [
    { key: "number", label: "Order ID", sortable: true, mobile: "title", render: (r) => <div><p className="font-semibold tnum">{r.number}</p><p className="text-xs md:hidden" style={{ color: s.muted }}>{r.customer.name}</p></div> },
    { key: "customer", label: "Customer", sortable: true, mobile: "hide", render: (r) => r.customer.name },
    { key: "placedAt", label: "Date", sortable: true, render: (r) => <span style={{ color: s.muted }}>{dateTimeLabel(r.placedAt)}</span> },
    { key: "items", label: "Items", align: "right", render: (r) => r.units },
    { key: "subtotal", label: "Amount", align: "right", render: (r) => <span className="font-medium">{fmt(r.subtotal)}</span> },
    { key: "payment", label: "Payment", render: (r) => <Pill tone={r.payment.tone}>{r.payment.label}</Pill> },
    { key: "status", label: "Order status", mobile: "aside", render: (r) => <Pill tone={r.status.tone}>{r.status.label}</Pill> },
    { key: "delivery", label: "Delivery", render: (r) => <Pill tone={r.delivery.tone} dot={false}>{r.delivery.label}</Pill> },
    { key: "actions", label: "Actions", align: "right", mobile: "footer", render: (r) => <OrderActions row={r} showView onView={() => open(r)} /> },
  ];

  return (
    <div>
      <PageHeader title="Orders" description="Confirm, prepare and dispatch the orders customers place with you." />
      <Panel padded={false}>
        <div className="px-4 pt-1">
          <Tabs value={tab} onChange={(t) => { setTab(t); table.setPage(1); }} items={[
            { id: "all", label: "All", count: counts.all }, { id: "open", label: "Open", count: counts.open },
            ...SELLER_STATUSES.map((st) => ({ id: st.key, label: st.label, count: counts[st.key] })),
          ]} />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 p-4">
          <SearchField className="flex-1" value={q} onChange={(v) => { setQ(v); table.setPage(1); }} placeholder="Search by order number, customer or phone" />
          <Select value={pay} onChange={(e) => { setPay(e.target.value); table.setPage(1); }} aria-label="Filter by payment status" className="sm:!w-44">
            <option value="all">All payments</option>{PAYMENT_FILTERS.map((l) => <option key={l}>{l}</option>)}
          </Select>
          <Select value={range} onChange={(e) => { setRange(e.target.value); table.setPage(1); }} aria-label="Filter by date" className="sm:!w-40">
            <option value="all">All time</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option>
          </Select>
        </div>
        <DataTable columns={columns} rows={table.visible} rowKey={(r) => r.id} sort={table.sort} onSort={table.toggleSort} onRowClick={open}
          empty={<EmptyBlock icon="Receipt" title={rows.length ? "No orders match" : "No orders yet"} message={rows.length ? "Try a different status, search or date range." : "Orders containing your products will show up here."} />} />
        <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPage={table.setPage} />
      </Panel>
    </div>
  );
}

function Timeline({ order }) {
  const s = useS();
  const events = order.history.map((h) => ({ ...h, meta: sellerStatusOf(h.status) }))
    .filter((e, i, a) => i === 0 || e.meta.key !== a[i - 1].meta.key || e.status !== a[i - 1].status);
  return (
    <ol>
      {events.map((e, i) => (
        <li key={`${e.status}-${i}`} className="flex gap-3 pb-4 last:pb-0 relative">
          {i < events.length - 1 && <span className="absolute left-[7px] top-4 bottom-0 w-px" style={{ background: s.line }} />}
          <span className="w-[15px] h-[15px] rounded-full mt-0.5 shrink-0 z-10" style={{ background: i === events.length - 1 ? s.accent : "#fff", border: `2px solid ${i === events.length - 1 ? s.accent : s.line}` }} />
          <div><p className="text-sm font-medium" style={{ color: s.text }}>{e.status === "assigned" ? "Rider assigned" : e.meta.label}</p><p className="text-xs" style={{ color: s.muted }}>{dateTimeLabel(e.at)}</p></div>
        </li>
      ))}
    </ol>
  );
}

const placeLine = (a) => (a.provinceId && a.districtId && a.municipalityId
  ? `${municipalityName(a.districtId, a.municipalityId)}, Ward ${a.ward} · ${districtName(a.provinceId, a.districtId)}, ${provinceName(a.provinceId)}`
  : `${a.city || ""} ${a.zip || ""}`.trim());

function OrderDetail({ nav, orderId }) {
  const s = useS();
  const { rows } = useShop();
  const { addresses } = useApp();
  const row = rows.find((r) => r.id === orderId);
  const back = <button type="button" onClick={() => nav("shopOrders")} className="inline-flex items-center gap-1 text-sm font-medium mb-2 hover:underline" style={{ color: s.muted }}><Icon name="ChevronLeft" size={15} /> Orders</button>;
  if (!row) return <div><PageHeader title="Order not found" back={back} /><Panel><EmptyBlock icon="Receipt" title="This order isn't in your shop" message="It may belong to another seller, or the link is out of date." action={<Btn onClick={() => nav("shopOrders")}>Back to orders</Btn>} /></Panel></div>;

  const { order } = row;
  const ship = order.shipTo || addresses.find((a) => a.id === order.addressId);
  const store = storeById(order.storeId);

  return (
    <div>
      <PageHeader back={back} title={<span className="inline-flex items-center gap-3 flex-wrap tnum">{order.number}<Pill tone={row.status.tone}>{row.status.label}</Pill></span>}
        description={`Placed ${dateTimeLabel(order.placedAt)}`} actions={<OrderActions row={row} size="md" />} />
      {row.soleSeller && isPrepaid(order) && !row.payment.paid && order.status !== "cancelled" && <div className="mb-4"><Notice tone="warn">Payment pending. You can confirm and prepare this order, but packing and dispatch unlock once the payment is confirmed.</Notice></div>}
      {!row.soleSeller && <div className="mb-4"><Notice tone="info">This order also contains items from other sellers. You can see your items and their total; the order status is coordinated by Vyra, so it can't be changed here.</Notice></div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4 min-w-0">
          <Panel title="Items" subtitle={`${row.units} unit(s) from your shop`} padded={false}>
            <DataTable rowKey={(i) => `${i.productId}-${i.variantId}`} rows={row.items} columns={[
              { key: "name", label: "Product", mobile: "title", render: (i) => <div className="flex items-center gap-3 min-w-0"><Thumb product={i.product} size={40} /><div className="min-w-0"><p className="font-medium truncate">{i.product.name}</p><p className="text-xs tnum" style={{ color: s.muted }}>{i.variantId ? i.product.variants?.find((v) => v.id === i.variantId)?.label : i.product.sku}</p></div></div> },
              { key: "unitPrice", label: "Unit price", align: "right", render: (i) => fmt(i.unitPrice) },
              { key: "qty", label: "Qty", align: "right", render: (i) => i.qty },
              { key: "total", label: "Total", align: "right", mobile: "aside", render: (i) => <span className="font-medium">{fmt(i.unitPrice * i.qty)}</span> },
            ]} />
            <div className="px-4 py-3 flex justify-end" style={{ borderTop: `1px solid ${s.lineSoft}` }}>
              <div className="w-56 text-sm space-y-1.5"><div className="flex justify-between font-semibold" style={{ color: s.text }}><span>Your items</span><span className="tnum">{fmt(row.subtotal)}</span></div></div>
            </div>
          </Panel>
          <Panel title="Order history"><Timeline order={order} /></Panel>
        </div>

        <div className="space-y-4 min-w-0">
          <Panel title="Customer">
            <p className="text-sm font-semibold" style={{ color: s.text }}>{row.customer.name}</p>
            {row.customer.phone ? <a href={`tel:${row.customer.phone.replace(/\s/g, "")}`} className="text-sm inline-flex items-center gap-1.5 mt-1 hover:underline" style={{ color: s.accent }}><Icon name="Phone" size={13} />{row.customer.phone}</a> : <p className="text-sm mt-1" style={{ color: s.muted }}>No phone on file</p>}
          </Panel>
          <Panel title="Delivery">
            {ship ? <address className="not-italic text-sm leading-relaxed" style={{ color: s.text }}>{ship.line1}{ship.line2 ? `, ${ship.line2}` : ""}<br />{placeLine(ship)}{ship.landmark ? <span className="block text-xs mt-1" style={{ color: s.muted }}>Landmark: {ship.landmark}</span> : null}{ship.instructions ? <span className="block mt-2 text-xs" style={{ color: s.muted }}>Note: {ship.instructions}</span> : null}</address> : <p className="text-sm" style={{ color: s.muted }}>Counter sale — no delivery address.</p>}
            <div className="mt-3"><KeyValue rows={[["Delivery status", <Pill tone={row.delivery.tone} dot={false}>{row.delivery.label}</Pill>], ["Method", order.deliveryOption === "slot" ? `Scheduled${order.slot ? ` · ${order.slot}` : ""}` : order.deliveryOption === "express" ? "Express" : "Standard"], order.partner?.name && ["Courier", order.partner.name], ["Dispatched from", store?.name]]} /></div>
            {(order.instructions || order.notes) && <p className="text-xs mt-2" style={{ color: s.muted }}>Customer note: {order.instructions || order.notes}</p>}
          </Panel>
          <Panel title="Payment">
            <KeyValue rows={[["Method", PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || "—"], ["Payment status", <Pill tone={row.payment.tone}>{row.payment.label}</Pill>], ["Order status", <Pill tone={row.status.tone}>{row.status.label}</Pill>], [`${row.payment.amountLabel}${row.soleSeller ? "" : " (your items)"}`, fmt(row.soleSeller ? order.totals.total : row.subtotal)]]} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default function Orders({ nav, params }) {
  return params.orderId ? <OrderDetail nav={nav} orderId={params.orderId} /> : <OrderList nav={nav} params={params} />;
}
