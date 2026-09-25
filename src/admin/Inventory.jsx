import React, { useEffect, useMemo, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Badge, PillButton, InlineNotice, Divider, Sheet } from "../components/shared/ui.jsx";
import { Search, Plus, Minus, AlertTriangle, Clock, ArrowRight, History } from "../components/shared/Icon.jsx";
import { STORES } from "../data/stores.js";
import { inventoryRows, LOW_STOCK, fefoBatches, daysToExpiry, batchStatus, expiringSoon, expiredBatches } from "../utils/inventory.js";
import { hasModule } from "../data/categories.js";
import { fmt, dateTimeLabel, timeAgo } from "../utils/format.js";
import { inventoryApi } from "../services/api/inventoryApi.js";
import { productsApi } from "../services/api/productsApi.js";
import { TONE } from "../theme.js";

const REASONS = ["Manual adjustment", "Damaged", "Expired", "Returned by customer", "Stock count correction"];

/** Generic inventory: quantity, reserved, available, threshold, per store.
    Batch and expiry only appear for categories carrying the "batch" module.
    Every adjustment is reason-coded and written to the movement ledger. */
export default function AdminInventory() {
  const { products, categories, storeId, cart, catalog, toast } = useApp();
  const C = useC();
  const [store, setStore] = useState(storeId);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("stock");
  const [adjusting, setAdjusting] = useState(null);
  const [transferring, setTransferring] = useState(null);

  const reservedFor = (productId, variantId) =>
    cart.filter((l) => l.productId === productId && l.variantId === (variantId || null)).reduce((s, l) => s + l.qty, 0);

  const rows = useMemo(() => {
    const term = q.toLowerCase().trim();
    return inventoryRows(store, products).filter((r) => !term || r.label.toLowerCase().includes(term) || r.sku.toLowerCase().includes(term));
  }, [products, store, q]);

  const lowRows = rows.filter((r) => r.onHand <= LOW_STOCK);
  const expiringProducts = products.filter((p) => expiringSoon(p, 90).length > 0);
  const expiredProducts = products.filter((p) => expiredBatches(p).length > 0);

  const refreshProduct = async (id) => { try { catalog.cacheProducts([await productsApi.get(id)]); } catch { /* stale cache is fine, the next full reload fixes it */ } };

  const adjust = async (row, delta, reason) => {
    try {
      await inventoryApi.adjust({ productId: row.product.id, variantId: row.variant?.id || null, branch: store, delta, reason });
      await refreshProduct(row.product.id);
      setAdjusting(null);
      toast(`${row.label} ${delta > 0 ? "+" : ""}${delta}`);
    } catch (err) {
      toast(err.message || "Couldn't adjust stock", "danger");
    }
  };

  const transfer = async (row, toStoreId, qty) => {
    try {
      await inventoryApi.transfer({ productId: row.product.id, variantId: row.variant?.id || null, fromBranch: store, toBranch: toStoreId, qty });
      await refreshProduct(row.product.id);
      setTransferring(null);
      toast(`Transferred ${qty} units to ${STORES.find((s) => s.id === toStoreId)?.name}`);
    } catch (err) {
      toast(err.message || "Couldn't transfer stock", "danger");
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {STORES.map((s) => (
          <button key={s.id} onClick={() => setStore(s.id)} className="shrink-0 px-3.5 py-2 rounded-full text-xs font-bold"
            style={{ background: store === s.id ? C.primary : C.white, color: store === s.id ? "#fff" : C.navy, border: `1px solid ${store === s.id ? C.primary : C.border}` }}>
            {s.name}
          </button>
        ))}
        <div className="ml-auto flex gap-2 shrink-0">
          {[["stock", "Stock"], ["batches", "Batches & expiry"], ["movements", "Movements"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="px-3.5 py-2 rounded-full text-xs font-bold"
              style={{ background: tab === id ? C.navy : C.white, color: tab === id ? "#fff" : C.navy, border: `1px solid ${tab === id ? C.navy : C.border}` }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {lowRows.length > 0 && tab === "stock" && (
        <InlineNotice tone="warn" icon={AlertTriangle}>
          {lowRows.length} SKU{lowRows.length > 1 ? "s are" : " is"} at or below the low-stock threshold of {LOW_STOCK}.
        </InlineNotice>
      )}
      {expiredProducts.length > 0 && tab !== "movements" && (
        <InlineNotice tone="danger" icon={AlertTriangle}>
          {expiredProducts.length} product{expiredProducts.length > 1 ? "s have" : " has"} expired batches still on the shelf — these are automatically excluded from sale (POS and FEFO allocation), but should be written off.
        </InlineNotice>
      )}

      {tab === "stock" && (
        <>
          <div className="flex items-center gap-2 rounded-full px-4 h-11 my-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <Search size={16} style={{ color: C.muted }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU or product"
              className="flex-1 bg-transparent outline-none text-sm" style={{ color: C.navy }} />
            <span className="text-xs" style={{ color: C.muted }}>{rows.length}</span>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <div className="hidden md:flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ background: C.bg, color: C.muted }}>
              <span className="flex-1">Product</span><span className="w-20 text-right">On hand</span>
              <span className="w-20 text-right">Reserved</span><span className="w-20 text-right">Available</span><span className="w-40" />
            </div>
            {rows.map((r, i) => {
              const reserved = reservedFor(r.product.id, r.variant?.id);
              const available = Math.max(r.onHand - reserved, 0);
              return (
                <div key={r.sku + i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: C.navy }}>{r.label}</p>
                    <p className="text-[11px]" style={{ color: C.muted }}>{r.sku}</p>
                  </div>
                  <span className="w-20 text-right text-sm font-bold" style={{ color: r.onHand <= LOW_STOCK ? TONE.warn : C.navy }}>{r.onHand}</span>
                  <span className="w-20 text-right text-sm hidden md:block" style={{ color: C.muted }}>{reserved}</span>
                  <span className="w-20 text-right text-sm hidden md:block font-semibold" style={{ color: available === 0 ? TONE.danger : C.navy }}>{available}</span>
                  <div className="w-40 flex items-center justify-end gap-1.5 shrink-0">
                    <button aria-label="Decrease stock" onClick={() => setAdjusting({ row: r, delta: -1 })} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                      <Minus size={13} style={{ color: C.navy }} />
                    </button>
                    <button aria-label="Increase stock" onClick={() => setAdjusting({ row: r, delta: 1 })} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.mint }}>
                      <Plus size={13} style={{ color: C.primary }} />
                    </button>
                    <button onClick={() => setTransferring(r)} className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1" style={{ background: C.navy, color: "#fff" }}>
                      <ArrowRight size={10} /> Transfer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "batches" && (
        <div className="space-y-3 mt-4">
          <InlineNotice tone="info" icon={Clock}>
            Batch tracking applies only to categories that declare the batch module. Dispensing and POS sales follow First Expiry First Out, and expired batches are never allocated.
          </InlineNotice>
          {products.filter((p) => hasModule(p.categoryId, "batch", categories) && fefoBatches(p).length).map((p) => (
            <div key={p.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-sm" style={{ color: C.navy }}>{p.name}</p>
                <Badge tone={expiredBatches(p).length ? "danger" : expiringSoon(p, 90).length ? "warn" : "ok"}>{fefoBatches(p).length} batches</Badge>
              </div>
              {fefoBatches(p).map((b, i) => {
                const status = batchStatus(b.expiry);
                return (
                  <div key={b.batch} className="flex items-center gap-3 py-2" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: status.level === "expired" ? TONE.dangerBg : i === 0 ? C.primary : C.mint, color: status.level === "expired" ? TONE.danger : i === 0 ? "#fff" : C.primary }}>
                      {status.level === "expired" ? "×" : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: C.navy }}>Batch {b.batch}</p>
                      <p className="text-[11px]" style={{ color: C.muted }}>Expires {b.expiry} · cost {fmt(b.cost)}</p>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: C.navy }}>{b.qty} units</span>
                    <Badge tone={status.level === "expired" ? "danger" : status.level === "expiring" ? "warn" : "ok"}>{status.label}</Badge>
                  </div>
                );
              })}
              {fefoBatches(p)[0] && daysToExpiry(fefoBatches(p)[0].expiry) >= 0 && (
                <p className="text-[11px] mt-2" style={{ color: C.muted }}>Next dispensed: batch {fefoBatches(p).find((b) => daysToExpiry(b.expiry) >= 0)?.batch} (earliest non-expired).</p>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "movements" && <MovementsLog store={store} products={products} />}

      <Sheet open={!!adjusting} onClose={() => setAdjusting(null)} title="Adjust stock"
        footer={null}>
        {adjusting && (
          <div className="space-y-2">
            <p className="text-sm mb-3" style={{ color: C.muted }}>
              {adjusting.row.label}: {adjusting.delta > 0 ? "add" : "remove"} 1 unit. Choose a reason:
            </p>
            {REASONS.map((r) => (
              <button key={r} onClick={() => adjust(adjusting.row, adjusting.delta, r)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: C.bg, color: C.navy, border: `1px solid ${C.border}` }}>
                {r}
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={!!transferring} onClose={() => setTransferring(null)} title="Transfer stock">
        {transferring && <TransferForm row={transferring} store={store} onTransfer={(to, qty) => transfer(transferring, to, qty)} />}
      </Sheet>
    </div>
  );
}

function TransferForm({ row, store, onTransfer }) {
  const C = useC();
  const [to, setTo] = useState(STORES.find((s) => s.id !== store)?.id);
  const [qty, setQty] = useState(1);
  const max = row.onHand;
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: C.muted }}>Move stock of <span className="font-bold" style={{ color: C.navy }}>{row.label}</span> between stores. Nothing is duplicated — the source store's count decreases by the same amount.</p>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Destination store</label>
        <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
          {STORES.filter((s) => s.id !== store).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Quantity (max {max})</label>
        <input type="number" min={1} max={max} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(max, Number(e.target.value))))}
          className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
      </div>
      <PillButton full onClick={() => onTransfer(to, qty)} disabled={max === 0}>Transfer {qty} units</PillButton>
    </div>
  );
}

function MovementsLog({ store, products }) {
  const C = useC();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    inventoryApi.movements({ branch: store, limit: 60 }).then((m) => { if (alive) setRows(m); }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [store]);
  if (loading) return <p className="text-sm mt-4" style={{ color: C.muted }}>Loading…</p>;
  if (!rows.length) return <p className="text-sm mt-4" style={{ color: C.muted }}>No stock movements recorded yet at this store.</p>;
  return (
    <div className="rounded-2xl overflow-hidden mt-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <History size={15} style={{ color: C.primary }} />
        <p className="font-extrabold text-sm" style={{ color: C.navy }}>Stock movement history</p>
      </div>
      {rows.map((m, i) => {
        const p = products.find((x) => x.id === m.productId);
        return (
          <div key={m.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <span className="font-bold text-sm shrink-0" style={{ color: m.delta > 0 ? TONE.ok : TONE.danger }}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{p?.name || m.productId}{m.batch ? ` · batch ${m.batch}` : ""}</p>
              <p className="text-[11px] truncate" style={{ color: C.muted }}>{m.reason} · {timeAgo(m.at)}</p>
            </div>
            {m.prevQty != null && <span className="text-[11px] shrink-0" style={{ color: C.muted }}>{m.prevQty} → {m.newQty}</span>}
          </div>
        );
      })}
    </div>
  );
}
