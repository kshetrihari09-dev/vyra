import React, { useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { PillButton, Sheet, InlineNotice } from "../components/shared/ui.jsx";
import { resolveCategory } from "../data/categories.js";
import { brandById, BRANDS } from "../data/brands.js";
import { STORES } from "../data/stores.js";

/**
 * "+ Create New Product" — opens when a POS/admin search finds nothing.
 * Never creates a duplicate: the caller is expected to have already
 * confirmed no equivalent product exists before offering this.
 */
export function QuickCreateProduct({ open, onClose, initialName = "", onCreated }) {
  const { categories, products, catalog, toast } = useApp();
  const C = useC();
  const leaves = categories.filter((c) => c.parent);
  const [draft, setDraft] = useState(() => blank(initialName, leaves[0]?.id || categories[0].id));
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (open) setDraft(blank(initialName, leaves[0]?.id || categories[0].id));
    // eslint-disable-next-line
  }, [open, initialName]);

  function blank(name, categoryId) {
    return {
      name,
      categoryId, brandId: BRANDS[0].id, description: "",
      price: 0, salePrice: 0, tax: 0, sku: `SKU-${Math.floor(Math.random() * 90000) + 10000}`,
      barcode: "", unit: "piece", moq: 1, maxQty: 10, rating: 0, reviews: 0, sold: 0,
      createdAt: new Date().toISOString().slice(0, 10), status: "active", deliveryAvailable: true,
      tags: [], attributes: {}, stock: { [STORES[0].id]: 0 },
    };
  }

  const dupe = products.find((p) => p.name.trim().toLowerCase() === draft.name.trim().toLowerCase());

  const create = async () => {
    if (!draft.name.trim()) { toast("Enter a product name", "danger"); return; }
    if (dupe) { toast(`"${dupe.name}" already exists — edit that instead`, "danger"); return; }
    setBusy(true);
    try {
      // The server assigns the id/slug, validates the SKU/barcode and records the opening stock (needs inventory:adjust).
      const openingStock = Object.fromEntries(Object.entries(draft.stock || {}).filter(([, q]) => q > 0));
      const saved = await catalog.createProduct(draft, Object.keys(openingStock).length ? { openingStock } : undefined);
      toast(`${saved.name} created`);
      onCreated?.(saved);
      onClose();
    } catch (err) {
      toast(err.message || "Couldn't create the product", "danger");
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, type = "text") => (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
      <input type={type} value={draft[key] ?? ""} onChange={(e) => setDraft({ ...draft, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
        className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Create new product" footer={<PillButton full onClick={create} disabled={busy}>{busy ? "Creating…" : "Create product"}</PillButton>}>
      <div className="space-y-3">
        {dupe && <InlineNotice tone="warn">A product named "{dupe.name}" already exists. Edit it instead of creating a duplicate.</InlineNotice>}
        {field("name", "Product name")}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Category</label>
          <select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
            className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
            {leaves.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Brand / Manufacturer</label>
          <select value={draft.brandId} onChange={(e) => setDraft({ ...draft, brandId: e.target.value })}
            className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
            {BRANDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("price", "MRP", "number")}
          {field("salePrice", "Selling price", "number")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("sku", "SKU")}
          {field("barcode", "Barcode")}
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Starting stock</label>
          <input type="number" value={draft.stock?.[STORES[0].id] ?? 0}
            onChange={(e) => setDraft({ ...draft, stock: { ...draft.stock, [STORES[0].id]: Number(e.target.value) } })}
            className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
        </div>
        {(resolveCategory(draft.categoryId, categories)?.attributes || []).slice(0, 4).map((a) => (
          <div key={a.key}>
            <label className="text-[11px] font-semibold" style={{ color: C.muted }}>{a.label}</label>
            <input value={draft.attributes?.[a.key] ?? ""} onChange={(e) => setDraft({ ...draft, attributes: { ...draft.attributes, [a.key]: e.target.value } })}
              className="w-full mt-1 rounded-xl px-3 h-10 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
          </div>
        ))}
      </div>
    </Sheet>
  );
}
