import React, { useMemo, useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useShop } from "../hooks/useShopData.js";
import { useS } from "../components/tokens.js";
import { Btn, DataTable, EmptyBlock, Field, Input, Metric, Modal, Notice, NumberInput, PageHeader, Pagination, Panel, Pill, SearchField, Select, Tabs, Thumb, useTable } from "../components/kit.jsx";
import { hasModule } from "../../data/categories.js";
import { STORES, storeById } from "../../data/stores.js";
import { CURRENCY, dateTimeLabel, fmt } from "../../utils/format.js";
import { inventoryApi } from "../../services/api/inventoryApi.js";
import { productsApi } from "../../services/api/productsApi.js";
import { TONE } from "../../theme.js";

const REASONS = {
  in: ["Purchase received", "Customer return", "Stock found in recount", "Other"],
  out: ["Damaged", "Expired", "Lost or stolen", "Used internally", "Other"],
  adjust: ["Stock count correction", "Damaged", "Expired", "Other"],
};
const MODE_TITLE = { in: "Stock in", out: "Stock out", adjust: "Adjust stock" };

function StockDialog({ target, mode, onClose }) {
  const s = useS();
  const { seller } = useShop();
  const { dispatch, toast, products, catalog } = useApp();
  const [saving, setSaving] = useState(false);
  const first = target ? STORES.find((st) => (target.byStore[st.id] || 0) > 0) || STORES[0] : STORES[0];
  const [storeId, setStoreId] = useState(first.id);
  const [qty, setQty] = useState(NaN);
  const [reason, setReason] = useState(REASONS[mode][0]);
  const [note, setNote] = useState("");
  const [cost, setCost] = useState(NaN);
  const [error, setError] = useState("");
  React.useEffect(() => { setStoreId(first.id); setQty(NaN); setReason(REASONS[mode][0]); setNote(""); setCost(NaN); setError(""); }, [target, mode]);
  if (!target) return null;

  const onHand = target.byStore[storeId] || 0;
  const delta = mode === "in" ? qty : mode === "out" ? -qty : qty - onHand;
  const after = Number.isFinite(delta) ? Math.max(onHand + delta, 0) : onHand;

  const submit = async () => {
    if (saving) return;
    if (!Number.isFinite(qty) || qty < 0 || (mode !== "adjust" && qty === 0) || !Number.isInteger(qty)) { setError(mode === "adjust" ? "Enter the counted quantity as a whole number." : "Enter a whole quantity greater than 0."); return; }
    if (mode === "out" && qty > onHand) { setError(`Only ${onHand} in stock at ${storeById(storeId).name}.`); return; }
    if (mode === "adjust" && delta === 0) { setError("The counted quantity matches what's recorded."); return; }
    // Save to the server first — a local-only change never reaches customers and is lost on refresh.
    setSaving(true);
    try {
      await inventoryApi.adjust({ productId: target.product.id, variantId: target.variant?.id || null, branch: storeId, delta, reason: note.trim() ? `${reason} — ${note.trim()}` : reason });
      try { catalog.cacheProducts([await productsApi.get(target.product.id)]); }
      catch { dispatch({ type: "STOCK_ADJUST", productId: target.product.id, variantId: target.variant?.id || null, storeId, delta, reason, user: `${seller.name} (seller)` }); }
    } catch (err) {
      setError(err.message || "Couldn't save the stock change");
      setSaving(false);
      return;
    }
    setSaving(false);
    if (mode === "in" && cost > 0) {
      const live = products.find((p) => p.id === target.product.id) || target.product;
      dispatch({ type: "PRODUCT_UPDATE", product: { ...live, costPrice: cost, updatedAt: new Date().toISOString() } });
    }
    dispatch({ type: "AUDIT", entry: { actor: `${seller.name} (seller)`, action: MODE_TITLE[mode], detail: `${target.name}: ${delta > 0 ? "+" : ""}${delta}` } });
    toast(`${MODE_TITLE[mode]} recorded — ${target.name} now ${after}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={MODE_TITLE[mode]} size={460}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn></>}>
      <div className="space-y-3.5">
        <div className="flex items-center gap-3"><Thumb product={target.product} size={40} /><div className="min-w-0"><p className="text-sm font-semibold truncate" style={{ color: s.text }}>{target.name}</p><p className="text-xs tnum" style={{ color: s.muted }}>{target.sku}</p></div></div>
        <Field label="Location" hint={`${onHand} in stock here`}>
          <Select value={storeId} onChange={(e) => { setStoreId(e.target.value); setError(""); }}>{STORES.map((st) => <option key={st.id} value={st.id}>{st.name} ({target.byStore[st.id] || 0})</option>)}</Select>
        </Field>
        <Field label={mode === "adjust" ? "Counted quantity" : "Quantity"} error={error}><NumberInput value={qty} onChange={(n) => { setQty(n); setError(""); }} error={error} autoFocus /></Field>
        {mode === "in" && <Field label="Purchase price per unit" hint="Optional — updates this product's purchase price"><NumberInput step="0.01" prefix={CURRENCY} value={cost} onChange={setCost} /></Field>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Reason"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS[mode].map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
        </div>
        <p className="text-sm tnum px-3 py-2" style={{ background: s.canvas, borderRadius: s.r, color: s.muted }}>
          Stock at this location: {onHand} <span className="mx-1">→</span> <span className="font-semibold" style={{ color: delta < 0 ? TONE.danger : s.text }}>{after}</span>
        </p>
      </div>
    </Modal>
  );
}

export default function Inventory({ params }) {
  const s = useS();
  const { seller, inventory, inventoryTotals, movements, categories } = useShop();
  const [tab, setTab] = useState(params.tab === "alerts" ? "alerts" : "levels");
  const [q, setQ] = useState(params.q || "");
  const [state, setState] = useState("all");
  const [dialog, setDialog] = useState(null); // { row, mode }
  const canWrite = seller.status === "active";
  const alerts = inventory.filter((r) => ["low", "out"].includes(r.status.key) && r.product.status !== "inactive");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return inventory.filter((r) => (state === "all" || r.status.key === state) && (!t || r.name.toLowerCase().includes(t) || (r.sku || "").toLowerCase().includes(t)));
  }, [inventory, q, state]);
  const table = useTable(filtered, { initialSort: { key: "qty", dir: "asc" }, pageSize: 10, sortAccessors: { name: (r) => r.name.toLowerCase(), value: (r) => r.value, updatedAt: (r) => (r.updatedAt ? new Date(r.updatedAt).getTime() : null) } });

  const batchTracked = (r) => hasModule(r.product.categoryId, "batch", categories);
  const rowActions = (r) => batchTracked(r)
    ? <span className="text-xs" style={{ color: s.muted }}>Batch-tracked</span>
    : (
      <div className="flex gap-1.5 justify-end">
        <Btn size="sm" icon="PackagePlus" disabled={!canWrite} onClick={() => setDialog({ row: r, mode: "in" })}>In</Btn>
        <Btn size="sm" icon="PackageMinus" disabled={!canWrite || r.qty === 0} onClick={() => setDialog({ row: r, mode: "out" })}>Out</Btn>
        <Btn size="sm" disabled={!canWrite} onClick={() => setDialog({ row: r, mode: "adjust" })}>Adjust</Btn>
      </div>
    );

  const columns = [
    { key: "name", label: "Product", sortable: true, mobile: "title", render: (r) => <div className="flex items-center gap-3 min-w-0"><Thumb product={r.product} size={36} /><div className="min-w-0"><p className="font-medium truncate max-w-[260px]">{r.name}</p><p className="text-xs tnum md:hidden" style={{ color: s.muted }}>{r.sku}</p></div></div> },
    { key: "sku", label: "SKU", mobile: "hide", render: (r) => <span className="tnum" style={{ color: s.muted }}>{r.sku}</span> },
    { key: "qty", label: "Current stock", sortable: true, align: "right", render: (r) => <span className="font-semibold">{r.qty}</span> },
    { key: "min", label: "Minimum", align: "right", render: (r) => r.min },
    { key: "cost", label: "Purchase price", align: "right", render: (r) => (r.cost != null ? fmt(r.cost) : <span style={{ color: s.faint }}>Not set</span>) },
    { key: "price", label: "Selling price", align: "right", render: (r) => fmt(r.price) },
    { key: "value", label: "Stock value", sortable: true, align: "right", render: (r) => <div><p className="font-medium">{fmt(r.value)}</p><p className="text-[11px]" style={{ color: s.muted }}>at {r.valueBasis}</p></div> },
    { key: "status", label: "Status", mobile: "aside", render: (r) => <Pill tone={r.status.tone}>{r.status.label}</Pill> },
    { key: "updatedAt", label: "Last updated", sortable: true, render: (r) => <span style={{ color: s.muted }}>{r.updatedAt ? dateTimeLabel(r.updatedAt) : "—"}</span> },
    { key: "actions", label: "", align: "right", mobile: "footer", render: rowActions },
  ];

  /* history */
  const [hq, setHq] = useState("");
  const labelOf = (m) => {
    const p = inventory.find((r) => r.product.id === m.productId && (r.variant?.id || null) === (m.variantId || null));
    return p?.name || m.productId;
  };
  const hist = useMemo(() => {
    const t = hq.trim().toLowerCase();
    return movements.map((m) => ({ ...m, label: labelOf(m) })).filter((m) => !t || m.label.toLowerCase().includes(t) || (m.reason || "").toLowerCase().includes(t));
  }, [movements, hq, inventory]);
  const htable = useTable(hist, { pageSize: 12 });
  const histCols = [
    { key: "label", label: "Product", mobile: "title", render: (m) => <span className="font-medium">{m.label}</span> },
    { key: "at", label: "When", render: (m) => <span style={{ color: s.muted }}>{dateTimeLabel(m.at)}</span> },
    { key: "delta", label: "Change", align: "right", mobile: "aside", render: (m) => <span className="font-semibold" style={{ color: m.delta < 0 ? TONE.danger : TONE.ok }}>{m.delta > 0 ? "+" : ""}{m.delta}</span> },
    { key: "newQty", label: "Stock after", align: "right", render: (m) => (m.newQty != null ? `${m.prevQty} → ${m.newQty}` : "—") },
    { key: "storeId", label: "Location", render: (m) => storeById(m.storeId).name },
    { key: "reason", label: "Reason", render: (m) => m.reason },
    { key: "user", label: "By", mobile: "hide", render: (m) => <span style={{ color: s.muted }}>{m.user}</span> },
  ];

  return (
    <div>
      <PageHeader title="Inventory" description="What you have on hand, what it's worth, and every change to it." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Metric label="Stock value at cost" icon="Wallet" value={fmt(inventoryTotals.atCost)} hint={inventoryTotals.missingCost ? `${inventoryTotals.missingCost} item(s) have no purchase price` : "All items costed"} />
        <Metric label="Stock value at retail" icon="Receipt" value={fmt(inventoryTotals.atRetail)} hint="At current selling prices" />
        <Metric label="Units in stock" icon="Warehouse" value={inventoryTotals.units} hint={`${inventory.length} SKUs`} />
        <Metric label="Needs restocking" icon="AlertTriangle" value={inventoryTotals.low + inventoryTotals.out} hint={`${inventoryTotals.out} out of stock`} tone={inventoryTotals.low + inventoryTotals.out ? TONE.danger : undefined} onClick={() => setTab("alerts")} />
      </div>

      <Panel padded={false}>
        <div className="px-4 pt-1">
          <Tabs value={tab} onChange={setTab} items={[{ id: "levels", label: "Stock levels", count: inventory.length }, { id: "history", label: "Movement history", count: movements.length }, { id: "alerts", label: "Low stock alerts", count: alerts.length }]} />
        </div>

        {tab === "levels" && (
          <>
            <div className="flex flex-col sm:flex-row gap-2 p-4">
              <SearchField className="flex-1" value={q} onChange={(v) => { setQ(v); table.setPage(1); }} placeholder="Search by product or SKU" />
              <Select value={state} onChange={(e) => { setState(e.target.value); table.setPage(1); }} aria-label="Filter by stock status" className="sm:!w-48">
                <option value="all">All statuses</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="active">Healthy</option><option value="inactive">Inactive</option>
              </Select>
            </div>
            <DataTable columns={columns} rows={table.visible} rowKey={(r) => r.key} sort={table.sort} onSort={table.toggleSort}
              empty={<EmptyBlock icon="Warehouse" title={inventory.length ? "No items match" : "No inventory yet"} message={inventory.length ? "Try a different search or status." : "Add products and their stock will be tracked here."} />} />
            <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPage={table.setPage} />
          </>
        )}

        {tab === "history" && (
          <>
            <div className="p-4"><SearchField value={hq} onChange={(v) => { setHq(v); htable.setPage(1); }} placeholder="Search by product or reason" /></div>
            <DataTable columns={histCols} rows={htable.visible} rowKey={(m) => m.id}
              empty={<EmptyBlock icon="History" title="No stock movements yet" message="Stock in, stock out and adjustments appear here with who made them and why." />} />
            <Pagination page={htable.page} pageSize={htable.pageSize} total={htable.total} onPage={htable.setPage} />
          </>
        )}

        {tab === "alerts" && (
          alerts.length === 0 ? <EmptyBlock icon="CheckCircle2" title="Nothing needs restocking" message="Items at or below their minimum stock level will be listed here." /> : (
            <ul>
              {alerts.sort((a, b) => a.qty - b.qty).map((r, i) => (
                <li key={r.key} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${s.lineSoft}` : "none" }}>
                  <Thumb product={r.product} size={40} />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-medium truncate" style={{ color: s.text }}>{r.name}</p>
                    <p className="text-xs tnum" style={{ color: s.muted }}>{r.qty} on hand · minimum {r.min} · short by {Math.max(r.min - r.qty, 0)}</p>
                  </div>
                  <Pill tone={r.status.tone}>{r.status.label}</Pill>
                  {!batchTracked(r) && <Btn size="sm" variant="primary" icon="PackagePlus" disabled={!canWrite} onClick={() => setDialog({ row: r, mode: "in" })}>Restock</Btn>}
                </li>
              ))}
            </ul>
          )
        )}
      </Panel>
      {!canWrite && <div className="mt-4"><Notice tone="warn">Stock changes are turned off while this shop isn't active.</Notice></div>}
      {dialog && <StockDialog target={dialog.row} mode={dialog.mode} onClose={() => setDialog(null)} />}
    </div>
  );
}
