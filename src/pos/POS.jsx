import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { PillButton, Badge, Divider, InlineNotice, Sheet } from "../components/shared/ui.jsx";
import { QuickCreateProduct } from "../admin/QuickCreateProduct.jsx";
import { ScanLine, Plus, Minus, Trash2, User, AlertTriangle } from "../components/shared/Icon.jsx";
import { STORES } from "../data/stores.js";
import { brandById } from "../data/brands.js";
import { searchCatalog } from "../utils/search.js";
import { sellableBatches, sellableQty, batchStatus } from "../utils/inventory.js";
import { hasModule as hasModuleCat } from "../data/categories.js";
import { priceOf } from "../utils/pricing.js";
import { fmt } from "../utils/format.js";

/* Compact, professional palette for the POS/ERP screens — distinct from the
   four playful storefront themes, matching the "enterprise" brief. */
const OPS = { ink: "#1C2B33", sub: "#5B6B74", line: "#E2E8ED", surface: "#FFFFFF", bg: "#F4F6F8", blue: "#2B6CB0", blueBg: "#EAF1FA", danger: "#C6394A", dangerBg: "#FBEAED", warn: "#B5790A", warnBg: "#FCF1DE", ok: "#1B7A56", okBg: "#E7F5EF" };
const round = (n) => Math.round(n * 100) / 100;

export default function POS({ nav }) {
  const { products, storeId, session, dispatch, toast } = useApp();
  const [store, setStore] = useState(storeId);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [cart, setCart] = useState([]); // [{key, productId, product, variantId, batch, qty, unitPrice}]
  const [batchPick, setBatchPick] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [payment, setPayment] = useState("cash_pos");
  const [customerName, setCustomerName] = useState("Walk-in customer");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const { exact, results } = useMemo(() => searchCatalog(query, products, { limit: 20 }), [query, products]);
  const showCreate = query.trim().length > 1 && results.length === 0;

  const addToCart = (product, variantId = null, batch = null) => {
    const available = batch ? batch.qty : sellableQty(product, store);
    if (available <= 0) { toast(`${product.name} has no sellable stock`, "danger"); return; }
    const key = `${product.id}:${variantId || "-"}:${batch?.batch || "-"}`;
    setCart((c) => {
      const existing = c.find((l) => l.key === key);
      if (existing) {
        if (existing.qty + 1 > available) { toast("No more stock in this batch", "danger"); return c; }
        return c.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      }
      const { price } = priceOf(product, variantId);
      return [...c, { key, productId: product.id, product, variantId, batch: batch?.batch || null, qty: 1, unitPrice: price }];
    });
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  };

  const handleSelect = (product) => {
    const needsBatch = hasModuleCat(product.categoryId, "batch") && product.batches?.length > 0;
    if (needsBatch) {
      const sellable = sellableBatches(product);
      if (sellable.length === 0) { toast(`${product.name} has no non-expired stock`, "danger"); return; }
      if (sellable.length === 1) { addToCart(product, null, sellable[0]); return; }
      setBatchPick(product);
      return;
    }
    if (product.variants?.length) { toast("This product has variants — sell it from Products, or add the base item here.", "danger"); }
    addToCart(product, null, null);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (exact) { handleSelect(exact); return; }
      if (results[highlight]) handleSelect(results[highlight]);
      else if (showCreate) setCreateOpen(true);
    } else if (e.key === "Escape") { setQuery(""); }
  };

  const setQty = (key, qty) => {
    setCart((c) => c.map((l) => {
      if (l.key !== key) return l;
      const cap = l.batch ? (products.find((p) => p.id === l.productId)?.batches?.find((b) => b.batch === l.batch)?.qty ?? 999) : sellableQty(l.product, store);
      return { ...l, qty: Math.max(0, Math.min(qty, cap)) };
    }).filter((l) => l.qty > 0));
  };
  const removeLine = (key) => setCart((c) => c.filter((l) => l.key !== key));

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const tax = cart.reduce((s, l) => s + l.unitPrice * l.qty * ((l.product.tax || 0) / 100), 0);
  const total = subtotal + tax;

  const completeSale = async () => {
    if (!cart.length || checkingOut) return;
    setCheckingOut(true);
    try {
      // The server always sells oldest-expiry-first for batch-tracked items — a cashier can see which batch a
      // sale would draw from (below), but can no longer hand-pick a different one; that keeps FEFO honest everywhere.
      const sale = await inventoryApi.posSale({
        branch: store, paymentMethod: payment, customerName,
        items: cart.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, qty: l.qty })),
      });
      dispatch({ type: "AUDIT", entry: { actor: session.user.name, action: "POS sale completed", detail: `${sale.number} · ${fmt(sale.totals.total)}` } });
      toast(`Sale ${sale.number} completed — ${fmt(sale.totals.total)}`);
      const ids = [...new Set(cart.map((l) => l.productId))];
      for (const id of ids) { try { catalog.cacheProducts([await productsApi.get(id)]); } catch { /* stale cache is fine */ } }
      setCart([]);
      setCustomerName("Walk-in customer");
      inputRef.current?.focus();
    } catch (err) {
      toast(err.message || "Couldn't complete the sale", "danger");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div style={{ background: OPS.bg, minHeight: "100vh" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-bold text-lg" style={{ color: OPS.ink }}>Point of Sale</h1>
            <p className="text-xs" style={{ color: OPS.sub }}>{STORES.find((s) => s.id === store)?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={store} onChange={(e) => setStore(e.target.value)}
              className="text-xs font-semibold rounded-lg px-2.5 h-9 outline-none" style={{ background: OPS.surface, border: `1px solid ${OPS.line}`, color: OPS.ink }}>
              {STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => nav("profile")} className="text-xs font-semibold rounded-lg px-3 h-9" style={{ background: OPS.surface, border: `1px solid ${OPS.line}`, color: OPS.sub }}>
              Exit POS
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_360px] gap-4">
          <div>
            <div className="relative">
              <div className="flex items-center gap-2 rounded-lg px-3 h-12" style={{ background: OPS.surface, border: `1.5px solid ${OPS.blue}` }}>
                <ScanLine size={17} style={{ color: OPS.blue }} />
                <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setHighlight(0); }} onKeyDown={onKeyDown}
                  placeholder="Scan barcode or search product — ↑↓ to navigate, Enter to add, Esc to clear"
                  className="flex-1 bg-transparent outline-none text-sm" style={{ color: OPS.ink }} aria-label="Scan or search product" />
                {query && <button onClick={() => setQuery("")} className="text-xs font-bold" style={{ color: OPS.sub }}>Esc</button>}
              </div>

              {query.trim() && (
                <div className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-20 max-h-80 overflow-y-auto"
                  style={{ background: OPS.surface, border: `1px solid ${OPS.line}`, boxShadow: "0 8px 24px rgba(28,43,51,.12)" }}>
                  {results.length === 0 ? (
                    showCreate ? (
                      <button onClick={() => setCreateOpen(true)} className="w-full text-left px-4 py-3 flex items-center gap-2.5" style={{ color: OPS.blue }}>
                        <Plus size={15} /> <span className="text-sm font-bold">Create New Product "{query.trim()}"</span>
                      </button>
                    ) : (
                      <p className="px-4 py-3 text-sm" style={{ color: OPS.sub }}>No matches for "{query}"</p>
                    )
                  ) : results.map((p, i) => {
                    const qty = sellableQty(p, store);
                    const needsBatch = hasModuleCat(p.categoryId, "batch") && p.batches?.length;
                    return (
                      <button key={p.id} onClick={() => handleSelect(p)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                        style={{ background: i === highlight ? OPS.blueBg : "transparent", borderTop: i ? `1px solid ${OPS.line}` : "none" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: OPS.ink }}>{p.name}</p>
                          <p className="text-[11px] truncate" style={{ color: OPS.sub }}>
                            {brandById(p.brandId).name} · {p.sku} · {p.barcode}{needsBatch ? " · batch-tracked" : ""}
                          </p>
                        </div>
                        <span className="text-sm font-bold shrink-0" style={{ color: OPS.ink }}>{fmt(priceOf(p).price)}</span>
                        <Badge tone={qty === 0 ? "danger" : qty <= 10 ? "warn" : "ok"}>{qty === 0 ? "Out" : `${qty} left`}</Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg overflow-hidden" style={{ background: OPS.surface, border: `1px solid ${OPS.line}` }}>
              <div className="hidden md:flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide" style={{ background: OPS.bg, color: OPS.sub, borderBottom: `1px solid ${OPS.line}` }}>
                <span className="flex-1">Product</span><span className="w-24">Batch</span><span className="w-20 text-right">Price</span><span className="w-28 text-center">Qty</span><span className="w-20 text-right">Total</span><span className="w-8" />
              </div>
              {cart.length === 0 ? (
                <p className="px-4 py-10 text-sm text-center" style={{ color: OPS.sub }}>Scan or search a product to start the sale.</p>
              ) : cart.map((l, i) => (
                <div key={l.key} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: i ? `1px solid ${OPS.line}` : "none" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: OPS.ink }}>{l.product.name}</p>
                    <p className="text-[11px] truncate" style={{ color: OPS.sub }}>{brandById(l.product.brandId).name}</p>
                  </div>
                  <span className="w-24 text-[11px] shrink-0" style={{ color: OPS.sub }}>{l.batch || "—"}</span>
                  <span className="w-20 text-sm text-right shrink-0" style={{ color: OPS.ink }}>{fmt(l.unitPrice)}</span>
                  <div className="w-28 flex items-center justify-center gap-1 shrink-0">
                    <button aria-label="Decrease" onClick={() => setQty(l.key, l.qty - 1)} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: OPS.bg }}><Minus size={12} /></button>
                    <input value={l.qty} onChange={(e) => setQty(l.key, Number(e.target.value.replace(/\D/g, "")) || 0)}
                      className="w-9 text-center text-sm font-bold outline-none rounded" style={{ background: OPS.bg, color: OPS.ink }} />
                    <button aria-label="Increase" onClick={() => setQty(l.key, l.qty + 1)} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: OPS.bg }}><Plus size={12} /></button>
                  </div>
                  <span className="w-20 text-sm font-bold text-right shrink-0" style={{ color: OPS.ink }}>{fmt(l.unitPrice * l.qty)}</span>
                  <button aria-label="Remove line" onClick={() => removeLine(l.key)} className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: OPS.dangerBg }}>
                    <Trash2 size={13} style={{ color: OPS.danger }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-4" style={{ background: OPS.surface, border: `1px solid ${OPS.line}`, height: "fit-content" }}>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: OPS.sub }}>Customer</p>
            <div className="flex items-center gap-2 rounded-lg px-3 h-10 mb-4" style={{ background: OPS.bg, border: `1px solid ${OPS.line}` }}>
              <User size={14} style={{ color: OPS.sub }} />
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm" style={{ color: OPS.ink }} />
            </div>

            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: OPS.sub }}>Payment method</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[{ id: "cash_pos", label: "Cash" }, { id: "card", label: "Card" }, { id: "upi", label: "UPI" }, { id: "cod", label: "Credit" }].map((m) => (
                <button key={m.id} onClick={() => setPayment(m.id)} className="text-xs font-bold rounded-lg py-2"
                  style={{ background: payment === m.id ? OPS.blueBg : OPS.bg, color: payment === m.id ? OPS.blue : OPS.sub, border: `1px solid ${payment === m.id ? OPS.blue : OPS.line}` }}>
                  {m.label}
                </button>
              ))}
            </div>

            <Divider />
            <div className="py-3 space-y-1.5">
              <Row label="Subtotal" value={fmt(subtotal)} />
              {tax > 0 && <Row label="Tax / VAT" value={fmt(tax)} />}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-sm" style={{ color: OPS.ink }}>Total</span>
                <span className="font-extrabold text-xl" style={{ color: OPS.ink }}>{fmt(total)}</span>
              </div>
            </div>
            <button onClick={completeSale} disabled={!cart.length || checkingOut}
              className="w-full rounded-lg py-3 font-bold text-sm disabled:opacity-40"
              style={{ background: OPS.blue, color: "#fff" }}>
              {checkingOut ? "Completing…" : `Complete Sale · ${fmt(total)}`}
            </button>
            <p className="text-[11px] text-center mt-2" style={{ color: OPS.sub }}>Enter after typing selects the top match</p>
          </div>
        </div>
      </div>

      {batchPick && (
        <BatchPickSheet product={batchPick} onClose={() => setBatchPick(null)}
          onPick={(batch) => { addToCart(batchPick, null, batch); setBatchPick(null); }} />
      )}
      <QuickCreateProduct open={createOpen} onClose={() => setCreateOpen(false)} initialName={query.trim()}
        onCreated={(p) => handleSelect(p)} />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: OPS.sub }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: OPS.ink }}>{value}</span>
    </div>
  );
}

function BatchPickSheet({ product, onClose, onPick }) {
  const batches = sellableBatches(product);
  return (
    <Sheet open onClose={onClose} title={`Choose a batch — ${product.name}`}>
      <p className="text-sm mb-4" style={{ color: "#5B6B74" }}>Earliest expiry is suggested first (FEFO). Expired batches are hidden and cannot be sold.</p>
      <div className="space-y-2">
        {batches.map((b, i) => {
          const status = batchStatus(b.expiry);
          return (
            <button key={b.batch} onClick={() => onPick(b)} className="w-full text-left rounded-lg p-3 flex items-center gap-3"
              style={{ background: i === 0 ? OPS.blueBg : OPS.surface, border: `1.5px solid ${i === 0 ? OPS.blue : OPS.line}` }}>
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: i === 0 ? OPS.blue : OPS.bg, color: i === 0 ? "#fff" : OPS.sub }}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: OPS.ink }}>Batch {b.batch}</p>
                <p className="text-[11px]" style={{ color: OPS.sub }}>MRP {fmt(product.price)} · Selling {fmt(product.salePrice ?? product.price)} · {b.qty} available</p>
              </div>
              <Badge tone={status.level === "expiring" ? "warn" : "ok"}>{status.label}</Badge>
              {i === 0 && <Badge tone="mint">Suggested</Badge>}
            </button>
          );
        })}
        {batches.length === 0 && (
          <InlineNotice tone="danger" icon={AlertTriangle}>All batches of this product are expired. It cannot be sold until restocked.</InlineNotice>
        )}
      </div>
    </Sheet>
  );
}
