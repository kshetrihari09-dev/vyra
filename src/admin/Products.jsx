import React, { useMemo, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { PillButton, Badge, Sheet, Divider } from "../components/shared/ui.jsx";
import { ProductArt } from "../components/shared/ProductArt.jsx";
import { Search, Pencil, Plus } from "../components/shared/Icon.jsx";
import { QuickCreateProduct } from "./QuickCreateProduct.jsx";
import { resolveCategory, categoryPath } from "../data/categories.js";
import { brandById } from "../data/brands.js";
import { stockFor } from "../utils/inventory.js";
import { fmt } from "../utils/format.js";
import { TONE } from "../theme.js";

/** Product management. Editing writes to the same store the storefront reads. */
export default function AdminProducts() {
  const { products, categories, storeId, catalog, toast } = useApp();
  const C = useC();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const term = q.toLowerCase().trim();
    return products.filter((p) => !term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
  }, [products, q]);

  const [saving, setSaving] = useState(false);

  /* The server validates, versions and audits the change (price changes are audited separately); the cache is
     updated from its response. Failures (duplicate SKU, bad attribute, stale edit) surface the server's message. */
  const save = async () => {
    setSaving(true);
    try {
      await catalog.updateProduct(editing);
      setEditing(null);
      toast("Product saved");
    } catch (err) {
      toast(err.message || "Couldn't save the product", "danger");
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, type = "text") => (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
      <input type={type} value={editing[key] ?? ""} onChange={(e) => setEditing({ ...editing, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
        className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2 rounded-full px-4 h-11 mb-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <Search size={16} style={{ color: C.muted }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU"
          className="flex-1 bg-transparent outline-none text-sm" style={{ color: C.navy }} />
        <span className="text-xs" style={{ color: C.muted }}>{rows.length}</span>
        <PillButton size="sm" onClick={() => setCreating(true)}><Plus size={13} /> New</PillButton>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        {rows.map((p, i) => {
          const cat = resolveCategory(p.categoryId, categories);
          const qty = stockFor(p, null, storeId);
          return (
            <div key={p.id} className="flex items-center gap-3 p-3" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <span className="w-11 h-11 rounded-xl overflow-hidden shrink-0"><ProductArt product={p} size={30} rounded={false} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: C.navy }}>{p.name}</p>
                <p className="text-[11px] truncate" style={{ color: C.muted }}>
                  {p.sku} · {brandById(p.brandId).name} · {categoryPath(p.categoryId, categories).map((c) => c.name).join(" / ")}
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-sm font-bold" style={{ color: C.navy }}>{fmt(p.salePrice ?? p.price)}</p>
                <p className="text-[11px]" style={{ color: qty <= 10 ? TONE.warn : C.muted }}>{qty} in stock</p>
              </div>
              <button aria-label={`Edit ${p.name}`} onClick={() => setEditing({ ...p })} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                <Pencil size={14} style={{ color: C.primary }} />
              </button>
            </div>
          );
        })}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit product"
        footer={<PillButton full onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</PillButton>}>
        {editing && (
          <div className="space-y-3">
            {field("name", "Name")}
            <div className="grid grid-cols-2 gap-3">
              {field("price", "MRP", "number")}
              {field("salePrice", "Sale price", "number")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("sku", "SKU")}
              {field("barcode", "Barcode")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("moq", "Min. order qty", "number")}
              {field("maxQty", "Max per order", "number")}
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Description</label>
              <textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full mt-1 rounded-xl p-3 text-sm outline-none resize-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
            </div>
            <Divider />
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
              Category attributes · {resolveCategory(editing.categoryId, categories)?.name}
            </p>
            {(resolveCategory(editing.categoryId, categories)?.attributes || []).map((a) => (
              <div key={a.key}>
                <label className="text-[11px] font-semibold" style={{ color: C.muted }}>{a.label}</label>
                <input value={editing.attributes?.[a.key] ?? ""}
                  onChange={(e) => setEditing({ ...editing, attributes: { ...editing.attributes, [a.key]: e.target.value } })}
                  className="w-full mt-1 rounded-xl px-3 h-10 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
              </div>
            ))}
          </div>
        )}
      </Sheet>
      <QuickCreateProduct open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
