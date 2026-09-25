import React, { useEffect, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { PillButton, Badge, Sheet, Divider, InlineNotice, EmptyState } from "../components/shared/ui.jsx";
import { Plus, Trash2, PackageCheck, Truck } from "../components/shared/Icon.jsx";
import { fmt, dateTimeLabel } from "../utils/format.js";
import { inventoryApi } from "../services/api/inventoryApi.js";
import { productsApi } from "../services/api/productsApi.js";

/** Purchase Order → Goods Received → batch + expiry captured → stock updated.
    Nothing here duplicates inventory records; receiving a PO appends a new
    batch and a stock movement, it never rewrites existing stock blindly. */
export default function AdminPurchases() {
  const { products, storeId, catalog, toast } = useApp();
  const C = useC();
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const [receiving, setReceiving] = useState(null);
  const [busy, setBusy] = useState(false);
  const supplierById = (id) => suppliers.find((s) => s.id === id) || null;

  const reload = async () => {
    const [s, po] = await Promise.all([inventoryApi.suppliers(), inventoryApi.purchaseOrders()]);
    setSuppliers(s); setPurchaseOrders(po);
  };
  useEffect(() => { reload().catch((err) => toast(err.message || "Couldn't load purchasing data", "danger")).finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const blankPO = () => ({
    supplierId: suppliers[0]?.id, invoiceNumber: "", lines: [{ productId: products[0].id, qty: 1, purchasePrice: 0 }],
  });

  const createPO = async () => {
    if (!creating.lines.length) { toast("Add at least one line", "danger"); return; }
    setBusy(true);
    try {
      const po = await inventoryApi.createPurchaseOrder({ supplierId: creating.supplierId, branch: storeId, invoiceNumber: creating.invoiceNumber || undefined, lines: creating.lines });
      setPurchaseOrders((list) => [po, ...list]);
      setCreating(null);
      toast(`${po.number} created`);
    } catch (err) {
      toast(err.message || "Couldn't create the purchase order", "danger");
    } finally {
      setBusy(false);
    }
  };

  const receivePO = async (po, lines) => {
    setBusy(true);
    try {
      const updated = await inventoryApi.receivePurchaseOrder(po.id, lines.map((l) => ({ productId: l.productId, qty: l.qty, purchasePrice: l.purchasePrice, batch: l.batch, expiry: l.expiry })));
      setPurchaseOrders((list) => list.map((x) => (x.id === po.id ? updated : x)));
      for (const l of lines) {
        try { catalog.cacheProducts([await productsApi.get(l.productId)]); } catch { /* stale cache is fine */ }
      }
      setReceiving(null);
      toast(`${po.number} received into stock`);
    } catch (err) {
      toast(err.message || "Couldn't receive this order", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: C.muted }}>{purchaseOrders.length} purchase orders · {suppliers.length} suppliers</p>
        <PillButton size="sm" onClick={() => setCreating(blankPO())} disabled={loading || !suppliers.length}><Plus size={14} /> New purchase order</PillButton>
      </div>

      <div className="rounded-2xl overflow-hidden mb-5" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <p className="px-4 pt-4 pb-2 font-extrabold text-sm" style={{ color: C.navy }}>Suppliers</p>
        {suppliers.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}><Truck size={15} style={{ color: C.primary }} /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: C.navy }}>{s.name}</p>
              <p className="text-[11px] truncate" style={{ color: C.muted }}>{s.contact} · {s.phone} · {s.terms}</p>
            </div>
          </div>
        ))}
      </div>

      {purchaseOrders.length === 0 ? (
        <EmptyState icon={PackageCheck} title="No purchase orders yet" message="Create one to bring supplier stock into inventory." />
      ) : (
        <div className="space-y-3">
          {purchaseOrders.map((po) => (
            <div key={po.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-sm" style={{ color: C.navy }}>{po.number}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>{supplierById(po.supplierId)?.name} · {dateTimeLabel(po.createdAt)}</p>
                </div>
                <Badge tone={po.status === "received" ? "ok" : "warn"}>{po.status === "received" ? "Received" : "Ordered"}</Badge>
              </div>
              {po.lines.map((l, i) => {
                const p = products.find((x) => x.id === l.productId);
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5 text-sm" style={{ color: C.navy }}>
                    <span className="flex-1 truncate">{p?.name || l.productId}</span>
                    <span style={{ color: C.muted }}>×{l.qty}</span>
                    <span className="font-semibold">{fmt(l.purchasePrice)}</span>
                    {l.batch && <Badge tone="neutral">{l.batch}</Badge>}
                  </div>
                );
              })}
              {po.status !== "received" && (
                <PillButton size="sm" full className="mt-2" onClick={() => setReceiving(po)}><PackageCheck size={14} /> Receive goods</PillButton>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create PO */}
      <Sheet open={!!creating} onClose={() => setCreating(null)} title="New purchase order"
        footer={<PillButton full onClick={createPO} disabled={busy}>{busy ? "Creating…" : "Create order"}</PillButton>}>
        {creating && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Supplier</label>
              <select value={creating.supplierId} onChange={(e) => setCreating({ ...creating, supplierId: e.target.value })}
                className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Invoice number</label>
              <input value={creating.invoiceNumber} onChange={(e) => setCreating({ ...creating, invoiceNumber: e.target.value })}
                className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
            </div>
            <Divider />
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Line items</p>
            {creating.lines.map((line, i) => (
              <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <select value={line.productId} onChange={(e) => setCreating({ ...creating, lines: creating.lines.map((l, j) => j === i ? { ...l, productId: e.target.value } : l) })}
                  className="w-full rounded-lg px-3 h-10 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Qty" value={line.qty} onChange={(e) => setCreating({ ...creating, lines: creating.lines.map((l, j) => j === i ? { ...l, qty: Number(e.target.value) } : l) })}
                    className="rounded-lg px-3 h-10 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
                  <input type="number" placeholder="Purchase price" value={line.purchasePrice} onChange={(e) => setCreating({ ...creating, lines: creating.lines.map((l, j) => j === i ? { ...l, purchasePrice: Number(e.target.value) } : l) })}
                    className="rounded-lg px-3 h-10 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
                </div>
                {creating.lines.length > 1 && (
                  <button onClick={() => setCreating({ ...creating, lines: creating.lines.filter((_, j) => j !== i) })} className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#E0546A" }}>
                    <Trash2 size={11} /> Remove line
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setCreating({ ...creating, lines: [...creating.lines, { productId: products[0].id, qty: 1, purchasePrice: 0 }] })}
              className="text-xs font-bold flex items-center gap-1.5" style={{ color: C.primary }}>
              <Plus size={13} /> Add line
            </button>
          </div>
        )}
      </Sheet>

      {/* Receive goods */}
      {receiving && (
        <ReceiveSheet po={receiving} products={products} onClose={() => setReceiving(null)} onReceive={(lines) => receivePO(receiving, lines)} />
      )}
    </div>
  );
}

function ReceiveSheet({ po, products, onClose, onReceive }) {
  const C = useC();
  const [lines, setLines] = useState(po.lines.map((l) => ({ ...l, batch: l.batch || `B-${Math.floor(Math.random() * 9000) + 1000}`, expiry: l.expiry || new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10) })));

  return (
    <Sheet open onClose={onClose} title={`Receive ${po.number}`}
      footer={<PillButton full onClick={() => onReceive(lines)}><PackageCheck size={15} /> Confirm goods received</PillButton>}>
      <InlineNotice tone="info">Enter the batch number and expiry date printed on the delivered stock for each line.</InlineNotice>
      <div className="space-y-3 mt-4">
        {lines.map((l, i) => {
          const p = products.find((x) => x.id === l.productId);
          return (
            <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
              <p className="text-sm font-bold" style={{ color: C.navy }}>{p?.name} · qty {l.qty}</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={l.batch} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, batch: e.target.value } : x))} placeholder="Batch number"
                  className="rounded-lg px-3 h-10 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
                <input type="date" value={l.expiry} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, expiry: e.target.value } : x))}
                  className="rounded-lg px-3 h-10 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
