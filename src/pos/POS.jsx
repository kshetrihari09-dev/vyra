import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Badge, Divider, InlineNotice, Sheet } from "../components/shared/ui.jsx";
import { QuickCreateProduct } from "../admin/QuickCreateProduct.jsx";
import { WorkspaceSwitcher } from "../workspaces/WorkspaceSwitcher.jsx";
import { ScanLine, Plus, Minus, Trash2, User, AlertTriangle, Loader2, RotateCcw, Percent } from "../components/shared/Icon.jsx";
import { STORES } from "../data/stores.js";
import { brandById } from "../data/brands.js";
import { searchCatalog } from "../utils/search.js";
import { sellableBatches, sellableQty, batchStatus, stockFor } from "../utils/inventory.js";
import { hasModule as hasModuleCat } from "../data/categories.js";
import { priceOf } from "../utils/pricing.js";
import { fmt } from "../utils/format.js";
import { inventoryApi } from "../services/api/inventoryApi.js";
import { productsApi, searchApi } from "../services/api/productsApi.js";
import { addLine, applyStock, buildSaleRequest, cashChange, lineKey, newRequestId, parseDiscount, previewTotals, removeLine, setLineQty, stepLine, MAX_CASHIER_DISCOUNT_PERCENT } from "./posCart.js";
import { describeLookupError, describePosError } from "./posErrors.js";
import { OPS } from "./posTheme.js";
import { QtyInput } from "./QtyInput.jsx";
import { VariantSheet } from "./VariantSheet.jsx";
import { PaymentSheet } from "./PaymentSheet.jsx";
import { ReceiptSheet } from "./ReceiptSheet.jsx";

const WALK_IN = "Walk-in customer";
const CODE_LIKE = /^[A-Za-z0-9][A-Za-z0-9._/-]{3,}$/; // what a scanned barcode / SKU / product code looks like: no spaces
const isEditable = (el) => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

/** Point of Sale.  Product search / barcode → cart → customer → discount → payment → complete → receipt.
    The browser only ever says WHAT is sold; the server prices it, checks stock under a row lock, applies the discount rules, takes the
    payment and records everything in one transaction (see backend/src/services/purchasing.service.js). Nothing here is trusted for money. */
export default function POS({ nav }) {
  const { products, storeId, session, dispatch, toast, catalog } = useApp();
  const [store, setStore] = useState(storeId);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [cart, setCartState] = useState([]);
  const [discountType, setDiscountType] = useState("percent");
  const [discountRaw, setDiscountRaw] = useState("");
  const [customerName, setCustomerName] = useState(WALK_IN);
  const [payment, setPayment] = useState("cash");
  const [received, setReceived] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(null);          // null | "lookup" | "sale"   — one loader at a time
  const [notice, setNotice] = useState(null);      // { tone, text }
  const [payError, setPayError] = useState(null);
  const [pending, setPending] = useState(null);    // an attempt whose outcome is unknown (connection lost): { body, message }
  const [receipt, setReceipt] = useState(null);
  const [remote, setRemote] = useState({ q: "", items: [], loading: false });
  const [batchPick, setBatchPick] = useState(null);
  const [variantPick, setVariantPick] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const inputRef = useRef(null);
  const customerRef = useRef(null);
  const cartRef = useRef([]);          // the latest cart, readable synchronously (rapid scans must not see a stale one)
  const submitting = useRef(false);    // synchronous double-submit guard: two clicks in the same tick can't both pass
  const requestId = useRef(null);      // the id of the CURRENT sale attempt; kept across retries, replaced only after a definite outcome
  const searchSeq = useRef(0);
  const locked = busy === "sale" || !!pending;

  const setCart = useCallback((next) => { cartRef.current = next; setCartState(next); }, []);
  const flash = useCallback((tone, text) => setNotice({ tone, text }), []);
  useEffect(() => { if (!notice || notice.tone === "danger") return undefined; const t = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(t); }, [notice]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // ------------------------------------------------------------------ search: instant from what's cached, then the server (debounced)
  const q = query.trim();
  const local = useMemo(() => searchCatalog(q, products, { limit: 20 }), [q, products]);
  useEffect(() => {
    if (q.length < 2) { setRemote({ q, items: [], loading: false }); return undefined; }
    const seq = ++searchSeq.current;
    setRemote((r) => ({ ...r, q, loading: true }));
    const t = setTimeout(async () => {
      try { const res = await productsApi.list({ q, pageSize: 12 }); if (seq === searchSeq.current) setRemote({ q, items: res.items || [], loading: false }); }
      catch { if (seq === searchSeq.current) setRemote({ q, items: [], loading: false, failed: true }); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const results = useMemo(() => {
    const byId = new Map(local.results.map((p) => [p.id, p]));
    if (remote.q === q) for (const p of remote.items) byId.set(p.id, p); // the server's copy is the fresher one (stock, price)
    return [...byId.values()].slice(0, 20);
  }, [local, remote, q]);
  const exact = local.exact || (remote.q === q ? remote.items.find((p) => [p.barcode, p.sku, p.id].some((c) => c && String(c).toLowerCase() === q.toLowerCase())) : null);
  const showCreate = q.length > 1 && results.length === 0 && !remote.loading && !busy;

  // ------------------------------------------------------------------ cart
  const lineFor = useCallback((product, variantId, batch) => {
    const variant = variantId ? product.variants?.find((v) => v.id === variantId) : null;
    return {
      productId: product.id, variantId, batch: batch?.batch || null, name: product.name, label: variant?.label || null, unit: product.unit, sku: product.sku,
      unitPrice: priceOf(product, variantId).price, taxPercent: product.tax || 0,
      cap: batch ? batch.qty : variantId ? stockFor(product, variantId, store) : sellableQty(product, store),
    };
  }, [store]);

  const addToCart = useCallback((product, variantId = null, batch = null) => {
    if (locked) return;
    const r = addLine(cartRef.current, lineFor(product, variantId, batch));
    setCart(r.cart);
    if (r.result === "out") flash("danger", `${product.name} is out of stock at this store.`);
    else if (r.result === "limit") flash("warn", `Only ${r.qty} ${r.qty === 1 ? "unit" : "units"} of ${product.name} available.`);
    else flash("ok", r.result === "added" ? `Added ${product.name}` : `${product.name} × ${r.qty}`);
    setQuery(""); setHighlight(0);
    inputRef.current?.focus();
  }, [locked, lineFor, setCart, flash]);

  const handleSelect = useCallback((product) => {
    if (locked) return;
    const needsBatch = hasModuleCat(product.categoryId, "batch") && product.batches?.length > 0;
    if (needsBatch) {
      const sellable = sellableBatches(product);
      if (sellable.length === 0) { flash("danger", `${product.name} has no non-expired stock.`); return; }
      if (sellable.length === 1) { addToCart(product, null, sellable[0]); return; }
      setBatchPick(product); return;
    }
    if (product.variants?.length) { setVariantPick(product); return; }
    addToCart(product, null, null);
  }, [locked, addToCart, flash]);

  /** Enter in the search box. A barcode scanner types the code and presses Enter: the box is cleared at once, so the NEXT scan starts clean
      even while this lookup is still in flight. */
  const onEnter = async () => {
    const code = query.trim();
    if (!code || locked) return;
    if (exact) { handleSelect(exact); return; }
    const picked = results[highlight];
    if (CODE_LIKE.test(code)) {
      setQuery(""); setHighlight(0); setBusy("lookup");
      try { const p = await searchApi.lookup(code); handleSelect(p); }
      catch (err) {
        if (err?.status === 404 && picked) handleSelect(picked);                 // it was a word, not a code: take the highlighted match
        else { flash("danger", describeLookupError(err, code)); setQuery(code); inputRef.current?.select(); }
      } finally { setBusy(null); }
      return;
    }
    if (picked) handleSelect(picked);
    else if (showCreate) setCreateOpen(true);
    else flash("danger", `Product not found for “${code}”.`);
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); onEnter(); }
    else if (e.key === "Escape") { setQuery(""); setNotice(null); }
  };

  const step = useCallback((key, d) => { const r = stepLine(cartRef.current, key, d); if (r.result === "limit") flash("warn", `Only ${r.qty} available.`); setCart(r.cart); }, [setCart, flash]);
  const commitQty = useCallback((key, raw) => {
    const r = setLineQty(cartRef.current, key, raw);
    if (r.result === "limit") flash("warn", `Only ${r.qty} available.`);
    if (r.result === "invalid") flash("danger", "Enter a quantity of 1 or more.");
    setCart(r.cart); return r.result;
  }, [setCart, flash]);
  const dropLine = useCallback((key) => setCart(removeLine(cartRef.current, key)), [setCart]);

  const { discount, error: discountParseError } = useMemo(() => parseDiscount(discountType, discountRaw), [discountType, discountRaw]);
  const totals = useMemo(() => previewTotals(cart, discount), [cart, discount]);
  const discountError = discountParseError || totals.error;
  const overCashierCap = discountType === "percent" && discount && discount.value > MAX_CASHIER_DISCOUNT_PERCENT;

  // ------------------------------------------------------------------ re-sync lines with fresh server data (after a refusal, or a sale)
  const refreshProducts = useCallback(async (ids) => {
    const fresh = (await Promise.allSettled([...new Set(ids)].map((id) => productsApi.get(id)))).filter((r) => r.status === "fulfilled").map((r) => r.value);
    if (!fresh.length) return;
    catalog?.cacheProducts?.(fresh);
    setCart(cartRef.current.map((l) => {
      const p = fresh.find((x) => x.id === l.productId); if (!p) return l;
      const cap = l.variantId ? stockFor(p, l.variantId, store) : sellableQty(p, store);
      return { ...l, unitPrice: priceOf(p, l.variantId).price, taxPercent: p.tax || 0, cap, qty: Math.min(l.qty, Math.max(cap, 0)) };
    }).filter((l) => l.qty > 0));
  }, [catalog, store, setCart]);

  // ------------------------------------------------------------------ complete sale
  const finish = useCallback((sale) => {
    setReceipt(sale); setPending(null); setPayOpen(false); setPayError(null); setNotice(null);
    requestId.current = null;
    const ids = cartRef.current.map((l) => l.productId);
    setCart([]); setDiscountRaw(""); setReceived(""); setCustomerName(WALK_IN);
    dispatch({ type: "AUDIT", entry: { actor: session.user.name, action: "POS sale completed", detail: `${sale.number} · ${fmt(sale.totals.total)}` } });
    toast(`Sale completed · Invoice #${sale.number}`);
    refreshProducts(ids); // the stock that just left; best-effort, the next search shows server numbers anyway
  }, [setCart, dispatch, session.user.name, toast, refreshProducts]);

  const submit = useCallback(async ({ retry = false } = {}) => {
    if (submitting.current) return;                         // 1) synchronous guard — a second click in the same tick stops here
    if (!retry) {
      if (!cartRef.current.length) return;
      if (discountError) { flash("danger", discountError); return; }
      if (payment === "cash" && !cashChange(totals.total, received).ok) { setPayError("Payment amount is insufficient."); setPayOpen(true); return; }
    }
    submitting.current = true; setBusy("sale"); setPayError(null); setNotice(null);
    // 2) the request id: made once per attempt and REUSED for every retry of it, so the server can recognise a repeat and answer with the original sale.
    const body = retry && pending ? pending.body
      : buildSaleRequest({ store, cart: cartRef.current, discount, customerName, payment, received: payment === "cash" ? cashChange(totals.total, received).received : null, expectedTotal: totals.total, idempotencyKey: (requestId.current ||= newRequestId()) });
    try {
      finish(await inventoryApi.posSale(body));
    } catch (err) {
      const d = describePosError(err);
      if (d.indeterminate) {
        setPending({ body, message: d.message }); setPayOpen(false);   // keep the id and the exact request; the cart stays; only a safe retry or a status check can follow
      } else {
        requestId.current = null;                                      // definitely not recorded → the next attempt is a fresh sale
        setPayError(d.message);
        if (!payOpen) flash("danger", d.message);
        if (d.kind === "stock" && err.details?.productId) {
          const key = lineKey(err.details.productId, err.details.variantId, null);
          setCart(applyStock(cartRef.current, cartRef.current.find((l) => l.productId === err.details.productId && (l.variantId || null) === (err.details.variantId || null))?.key ?? key, err.details.available));
          refreshProducts([err.details.productId]);
        } else if (d.kind === "price") refreshProducts(cartRef.current.map((l) => l.productId));
        else if (d.kind === "auth") setPayOpen(false);
      }
    } finally { submitting.current = false; setBusy(null); }
  }, [discountError, payment, totals.total, received, pending, store, discount, customerName, payOpen, finish, flash, setCart, refreshProducts]);

  /** Connection dropped mid-sale: ask the server whether that attempt was recorded (by its request id) instead of guessing. */
  const checkStatus = async () => {
    if (!pending || submitting.current) return;
    submitting.current = true; setBusy("sale");
    try { finish(await inventoryApi.posSaleByKey(pending.body.idempotencyKey)); }
    catch (err) {
      if (err?.status === 404) { setPending(null); requestId.current = null; flash("info", "That sale was not recorded. Your cart is unchanged — you can edit it and try again."); }
      else flash("danger", describePosError(err).kind === "network" ? "Still can't reach the server. Check the connection and try again." : "Couldn't check the sale status. Please try again.");
    } finally { submitting.current = false; setBusy(null); }
  };
  useEffect(() => {
    if (!pending) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };   // a sale of unknown outcome is on screen: don't let the page be closed by accident
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  // ------------------------------------------------------------------ keyboard: F2 search · F4 customer · F8 payment · F9 complete · scanner capture
  const kb = useRef({});
  kb.current = { cartLen: cart.length, locked, modal: payOpen || !!batchPick || !!variantPick || !!receipt || createOpen, cashOk: payment !== "cash" || cashChange(totals.total, received).ok, submit, setPayOpen };
  useEffect(() => {
    const onKey = (e) => {
      const s = kb.current;
      if (e.key === "F2") { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); return; }
      if (e.key === "F4") { e.preventDefault(); customerRef.current?.focus(); customerRef.current?.select(); return; }
      if (e.key === "F8") { e.preventDefault(); if (s.cartLen && !s.locked) s.setPayOpen(true); return; }
      if (e.key === "F9") { e.preventDefault(); if (s.cartLen && !s.locked) { if (s.cashOk) s.submit(); else s.setPayOpen(true); } return; }
      // A scanner "types" into whatever has focus. If the cashier clicked a button or the page, hand the keystrokes to the search box so the
      // first digit isn't lost — they never have to click the box between scans.
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !s.modal && !isEditable(e.target) && !s.locked) inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, []);

  const storeName = STORES.find((s) => s.id === store)?.name;
  const cartCount = cart.reduce((n, l) => n + l.qty, 0);

  return (
    <div style={{ background: OPS.bg, minHeight: "100vh" }}>
      <div className="px-4 md:px-6 py-4 pb-28 md:pb-4">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="min-w-0">
            <h1 className="font-bold text-lg" style={{ color: OPS.ink }}>Point of Sale</h1>
            <p className="text-xs truncate" style={{ color: OPS.sub }}>{storeName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select value={store} onChange={(e) => setStore(e.target.value)} disabled={cart.length > 0 || locked} title={cart.length ? "Finish or clear the sale to change store" : undefined} aria-label="Store"
              className="text-xs font-semibold rounded-lg px-2.5 h-9 outline-none disabled:opacity-60" style={{ background: OPS.surface, border: `1px solid ${OPS.line}`, color: OPS.ink }}>
              {STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <WorkspaceSwitcher nav={nav} view="pos" compact />
            <button onClick={() => nav("profile")} className="text-xs font-semibold rounded-lg px-3 h-9" style={{ background: OPS.surface, border: `1px solid ${OPS.line}`, color: OPS.sub }}>Exit POS</button>
          </div>
        </div>

        {pending && (
          <div className="mb-4 rounded-lg p-3" role="alert" style={{ background: OPS.warnBg, border: `1px solid ${OPS.warn}` }}>
            <p className="text-sm font-bold" style={{ color: OPS.warn }}>Sale not confirmed</p>
            <p className="text-sm mt-0.5" style={{ color: OPS.ink }}>{pending.message}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => submit({ retry: true })} disabled={busy === "sale"} className="px-4 h-9 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50" style={{ background: OPS.blue, color: "#fff" }}>
                {busy === "sale" ? <><Loader2 size={14} className="animate-spin" /> Retrying…</> : <><RotateCcw size={14} /> Retry sale</>}
              </button>
              <button onClick={checkStatus} disabled={busy === "sale"} className="px-4 h-9 rounded-lg text-sm font-bold disabled:opacity-50" style={{ background: OPS.surface, color: OPS.blue, border: `1.5px solid ${OPS.blue}` }}>Check if it was recorded</button>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_380px] gap-4">
          <div>
            <div className="relative">
              <div className="flex items-center gap-2 rounded-lg px-3 h-12" style={{ background: OPS.surface, border: `1.5px solid ${OPS.blue}`, opacity: locked ? 0.6 : 1 }}>
                {busy === "lookup" ? <Loader2 size={17} className="animate-spin" style={{ color: OPS.blue }} /> : <ScanLine size={17} style={{ color: OPS.blue }} />}
                <input ref={inputRef} value={query} disabled={locked} onChange={(e) => { setQuery(e.target.value); setHighlight(0); }} onKeyDown={onKeyDown} autoComplete="off" spellCheck={false}
                  placeholder="Scan barcode or search name / SKU — Enter to add  (F2)"
                  className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: OPS.ink }} aria-label="Scan or search product" />
                {query && <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="text-xs font-bold" style={{ color: OPS.sub }}>Esc</button>}
              </div>

              <div aria-live="polite" className="min-h-[22px] mt-1.5 text-xs font-semibold" style={{ color: notice?.tone === "danger" ? OPS.danger : notice?.tone === "warn" ? OPS.warn : notice?.tone === "ok" ? OPS.ok : OPS.sub }}>
                {busy === "lookup" ? "Looking up…" : notice?.text}
              </div>

              {q && (
                <div className="absolute left-0 right-0 top-[52px] rounded-lg overflow-hidden z-20 max-h-80 overflow-y-auto" style={{ background: OPS.surface, border: `1px solid ${OPS.line}`, boxShadow: "0 8px 24px rgba(28,43,51,.12)" }}>
                  {remote.loading && results.length === 0 ? (
                    <p className="px-4 py-3 text-sm flex items-center gap-2" style={{ color: OPS.sub }}><Loader2 size={14} className="animate-spin" /> Searching…</p>
                  ) : results.length === 0 ? (
                    showCreate ? (
                      <button onClick={() => setCreateOpen(true)} className="w-full text-left px-4 py-3 flex items-center gap-2.5" style={{ color: OPS.blue }}>
                        <Plus size={15} /> <span className="text-sm font-bold">No product found — create “{q}”</span>
                      </button>
                    ) : <p className="px-4 py-3 text-sm" style={{ color: OPS.sub }}>{remote.failed ? "Search is unavailable right now — check the connection." : `No products found for “${q}”.`}</p>
                  ) : (
                    <>
                      {results.map((p, i) => <ResultRow key={p.id} p={p} store={store} active={i === highlight} first={i === 0} onPick={handleSelect} onHover={() => setHighlight(i)} />)}
                      {remote.loading && <p className="px-4 py-2 text-[11px] flex items-center gap-2" style={{ color: OPS.sub, borderTop: `1px solid ${OPS.line}` }}><Loader2 size={11} className="animate-spin" /> Searching…</p>}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 rounded-lg overflow-hidden" style={{ background: OPS.surface, border: `1px solid ${OPS.line}` }}>
              <div className="hidden md:flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide" style={{ background: OPS.bg, color: OPS.sub, borderBottom: `1px solid ${OPS.line}` }}>
                <span className="flex-1">Product</span><span className="w-20 text-right">Rate</span><span className="w-32 text-center">Qty</span><span className="w-24 text-right">Total</span><span className="w-8" />
              </div>
              {cart.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <ScanLine size={26} style={{ color: OPS.sub, margin: "0 auto 8px" }} />
                  <p className="text-sm font-semibold" style={{ color: OPS.ink }}>The sale is empty</p>
                  <p className="text-xs mt-1" style={{ color: OPS.sub }}>Scan a barcode or search a product to start. Scanning the same item again adds one more.</p>
                </div>
              ) : cart.map((l, i) => <CartRow key={l.key} line={l} first={i === 0} locked={locked} onStep={step} onCommit={commitQty} onRemove={dropLine} />)}
            </div>
          </div>

          <div className="rounded-lg p-4" style={{ background: OPS.surface, border: `1px solid ${OPS.line}`, height: "fit-content" }}>
            <label className="text-[11px] font-bold uppercase tracking-wide mb-2 block" style={{ color: OPS.sub }} htmlFor="pos-customer">Customer (optional)  ·  F4</label>
            <div className="flex items-center gap-2 rounded-lg px-3 h-10 mb-4" style={{ background: OPS.bg, border: `1px solid ${OPS.line}` }}>
              <User size={14} style={{ color: OPS.sub }} />
              <input id="pos-customer" ref={customerRef} value={customerName} disabled={locked} maxLength={100} onChange={(e) => setCustomerName(e.target.value)} onFocus={(e) => e.target.select()}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); inputRef.current?.focus(); } }}
                className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: OPS.ink }} />
              {customerName !== WALK_IN && <button onClick={() => setCustomerName(WALK_IN)} className="text-[11px] font-bold shrink-0" style={{ color: OPS.blue }}>Walk-in</button>}
            </div>

            <label className="text-[11px] font-bold uppercase tracking-wide mb-2 block" style={{ color: OPS.sub }} htmlFor="pos-discount">Discount</label>
            <div className="flex gap-2 mb-1">
              <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: `1px solid ${OPS.line}` }}>
                {[{ id: "percent", label: "%" }, { id: "fixed", label: "Amt" }].map((t) => (
                  <button key={t.id} onClick={() => setDiscountType(t.id)} disabled={locked} aria-pressed={discountType === t.id} className="px-3 h-10 text-xs font-bold"
                    style={{ background: discountType === t.id ? OPS.blueBg : OPS.surface, color: discountType === t.id ? OPS.blue : OPS.sub }}>{t.label}</button>
                ))}
              </div>
              <div className="flex-1 flex items-center gap-2 rounded-lg px-3 h-10" style={{ background: OPS.bg, border: `1px solid ${discountError ? OPS.danger : OPS.line}` }}>
                <Percent size={13} style={{ color: OPS.sub }} />
                <input id="pos-discount" value={discountRaw} disabled={locked || cart.length === 0} inputMode="decimal" autoComplete="off" placeholder={discountType === "percent" ? "0" : "0.00"}
                  onChange={(e) => setDiscountRaw(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 10))}
                  className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: OPS.ink }} />
              </div>
            </div>
            <p className="text-[11px] min-h-[16px] mb-3" role={discountError ? "alert" : undefined} style={{ color: discountError ? OPS.danger : overCashierCap ? OPS.warn : OPS.sub }}>
              {discountError || (overCashierCap ? `Above ${MAX_CASHIER_DISCOUNT_PERCENT}% needs manager approval — the server will decide.` : "")}
            </p>

            <Divider />
            <div className="py-3 space-y-1.5" aria-live="polite">
              <Row label={`Subtotal (${cartCount} ${cartCount === 1 ? "item" : "items"})`} value={fmt(totals.subtotal)} />
              {totals.discount > 0 && <Row label="Discount" value={`−${fmt(totals.discount)}`} tone={OPS.ok} />}
              {totals.tax > 0 && <Row label="Tax" value={fmt(totals.tax)} />}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-sm" style={{ color: OPS.ink }}>Total</span>
                <span className="font-extrabold text-xl" style={{ color: OPS.ink }}>{fmt(totals.total)}</span>
              </div>
            </div>
            <button onClick={() => setPayOpen(true)} disabled={!cart.length || locked || !!discountError}
              className="w-full rounded-lg py-3 font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2" style={{ background: OPS.blue, color: "#fff" }}>
              {busy === "sale" ? <><Loader2 size={15} className="animate-spin" /> Completing sale…</> : <>Payment · {fmt(totals.total)}</>}
            </button>
            <p className="text-[11px] text-center mt-2" style={{ color: OPS.sub }}>F2 search · F4 customer · F8 payment · F9 complete</p>
            {cart.length > 0 && !locked && <button onClick={() => { setCart([]); setDiscountRaw(""); requestId.current = null; inputRef.current?.focus(); }} className="w-full text-xs font-bold mt-3" style={{ color: OPS.danger }}>Clear sale</button>}
          </div>
        </div>
      </div>

      {/* phone / tablet: the total and the Pay button stay within thumb reach */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 px-4 py-3 flex items-center gap-3" style={{ background: OPS.surface, borderTop: `1px solid ${OPS.line}`, boxShadow: "0 -4px 16px rgba(28,43,51,.08)" }}>
        <div className="flex-1 min-w-0"><p className="text-[11px]" style={{ color: OPS.sub }}>{cartCount} {cartCount === 1 ? "item" : "items"}</p><p className="font-extrabold text-lg leading-tight" style={{ color: OPS.ink }}>{fmt(totals.total)}</p></div>
        <button onClick={() => setPayOpen(true)} disabled={!cart.length || locked || !!discountError} className="px-6 h-11 rounded-lg font-bold text-sm disabled:opacity-40" style={{ background: OPS.blue, color: "#fff" }}>Pay</button>
      </div>

      <PaymentSheet open={payOpen} total={totals.total} payment={payment} setPayment={setPayment} received={received} setReceived={(v) => { setReceived(v); setPayError(null); }}
        busy={busy === "sale"} error={payError} onConfirm={() => submit()} onClose={() => setPayOpen(false)} />
      {receipt && <ReceiptSheet sale={receipt} onClose={() => { setReceipt(null); setTimeout(() => inputRef.current?.focus(), 50); }} />}
      {batchPick && <BatchPickSheet product={batchPick} onClose={() => setBatchPick(null)} onPick={(batch) => { addToCart(batchPick, null, batch); setBatchPick(null); }} />}
      {variantPick && <VariantSheet product={variantPick} store={store} onClose={() => setVariantPick(null)} onPick={(variantId) => { addToCart(variantPick, variantId, null); setVariantPick(null); }} />}
      <QuickCreateProduct open={createOpen} onClose={() => setCreateOpen(false)} initialName={query.trim()} onCreated={(p) => handleSelect(p)} />
    </div>
  );
}

const ResultRow = memo(function ResultRow({ p, store, active, first, onPick, onHover }) {
  const variants = p.variants?.length || 0;
  const qty = variants ? stockFor(p, null, store) : sellableQty(p, store);
  const needsBatch = hasModuleCat(p.categoryId, "batch") && p.batches?.length;
  const from = variants ? Math.min(...p.variants.map((v) => priceOf(p, v.id).price)) : priceOf(p).price;
  return (
    <button onClick={() => onPick(p)} onMouseEnter={onHover} className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
      style={{ background: active ? OPS.blueBg : "transparent", borderTop: first ? "none" : `1px solid ${OPS.line}`, opacity: qty === 0 ? 0.65 : 1 }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: OPS.ink }}>{p.name}</p>
        <p className="text-[11px] truncate" style={{ color: OPS.sub }}>{brandById(p.brandId).name} · {p.sku}{p.barcode ? ` · ${p.barcode}` : ""} · per {p.unit || "unit"}{needsBatch ? " · batch-tracked" : ""}{variants ? ` · ${variants} options` : ""}</p>
      </div>
      <span className="text-sm font-bold shrink-0" style={{ color: OPS.ink }}>{variants ? "from " : ""}{fmt(from)}</span>
      <Badge tone={qty === 0 ? "danger" : qty <= 10 ? "warn" : "ok"}>{qty === 0 ? "Out" : `${qty} ${p.unit || ""} left`.trim()}</Badge>
    </button>
  );
});

const CartRow = memo(function CartRow({ line: l, first, locked, onStep, onCommit, onRemove }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: first ? "none" : `1px solid ${OPS.line}` }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: OPS.ink }}>{l.name}{l.label ? ` — ${l.label}` : ""}</p>
        <p className="text-[11px] truncate" style={{ color: OPS.sub }}>{fmt(l.unitPrice)}{l.unit ? ` / ${l.unit}` : ""}{l.batch ? ` · batch ${l.batch}` : ""}{l.qty >= l.cap ? " · max in stock" : ""}</p>
      </div>
      <span className="hidden md:block w-20 text-sm text-right shrink-0" style={{ color: OPS.ink }}>{fmt(l.unitPrice)}</span>
      <div className="md:w-32 flex items-center justify-center gap-1 shrink-0">
        <button aria-label={`Decrease ${l.name}`} disabled={locked} onClick={() => onStep(l.key, -1)} className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-40" style={{ background: OPS.bg }}><Minus size={12} /></button>
        <QtyInput value={l.qty} disabled={locked} label={`Quantity of ${l.name}`} onCommit={(raw) => onCommit(l.key, raw)} />
        <button aria-label={`Increase ${l.name}`} disabled={locked || l.qty >= l.cap} onClick={() => onStep(l.key, +1)} className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-40" style={{ background: OPS.bg }}><Plus size={12} /></button>
      </div>
      <span className="w-20 md:w-24 text-sm font-bold text-right shrink-0" style={{ color: OPS.ink }}>{fmt(l.unitPrice * l.qty)}</span>
      <button aria-label={`Remove ${l.name}`} disabled={locked} onClick={() => onRemove(l.key)} className="w-8 h-8 rounded flex items-center justify-center shrink-0 disabled:opacity-40" style={{ background: OPS.dangerBg }}><Trash2 size={13} style={{ color: OPS.danger }} /></button>
    </div>
  );
});

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: OPS.sub }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: tone || OPS.ink }}>{value}</span>
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
