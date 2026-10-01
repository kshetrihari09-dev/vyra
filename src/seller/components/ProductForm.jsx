import React, { useMemo, useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useS } from "./tokens.js";
import { Btn, Drawer, Field, Input, NumberInput, Notice, Segmented, Select, Textarea } from "./kit.jsx";
import { productImageUrl } from "../../services/api/client.js";
import ImageUploader from "./ImageUploader.jsx";
import { BRANDS, brandById, brandByName, slugifyBrand } from "../../data/brands.js";
import { STORES } from "../../data/stores.js";
import { childrenOf, resolveCategory } from "../../data/categories.js";
import { totalStock } from "../../services/sellerAnalytics.js";
import { fmt } from "../../utils/format.js";
import { TONE } from "../../theme.js";

const UNITS = ["piece", "pack", "box", "bottle", "bag", "tub", "pair", "set", "dozen", "kg", "g", "litre", "ml"];
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const genSku = () => `SKU-${Math.floor(Math.random() * 90000) + 10000}`;

function Section({ title, hint, children }) {
  const s = useS();
  return (
    <section className="py-5 first:pt-0" style={{ borderTop: "1px solid " + s.lineSoft }}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold" style={{ color: s.text }}>{title}</h3>
        {hint && <p className="text-xs mt-0.5" style={{ color: s.muted }}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const blank = (seller, categories) => {
  const leaf = categories.find((c) => childrenOf(c.id, categories).length === 0) || categories[0];
  return {
    id: `${seller.id}-${Date.now()}`, sellerId: seller.id, name: "", slug: "", categoryId: leaf?.id, brandId: "",
    description: "", price: NaN, salePrice: NaN, costPrice: NaN, tax: seller.settings?.tax?.defaultRate ?? 0, sku: genSku(), barcode: "", unit: "piece",
    moq: 1, maxQty: 10, minStock: 10, rating: 0, reviews: 0, sold: 0, createdAt: new Date().toISOString().slice(0, 10),
    status: "pending_review", deliveryAvailable: true, tags: [], attributes: {}, images: [], stock: {},
  };
};

export default function ProductForm({ open, product, seller, onClose, onOpenInventory }) {
  const { categories, products, dispatch, toast, catalog } = useApp();
  const s = useS();
  const isNew = !product;
  // The API sends photos as { key } objects; the uploader works with plain URLs/data URLs, so convert here and back on save.
  const start = useMemo(() => (product ? { ...product, images: (product.images || []).map((i) => (typeof i === "string" ? i : productImageUrl(i.key))) } : blank(seller, categories)), [product, seller, categories, open]);
  const [f, setF] = useState(start);
  const [brandName, setBrandName] = useState(product ? brandById(product.brandId).name : "");
  const [opening, setOpening] = useState(0);
  const [errors, setErrors] = useState({});
  React.useEffect(() => { setF(start); setBrandName(product ? brandById(product.brandId).name : ""); setOpening(0); setErrors({}); }, [start]);

  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const leaves = categories.filter((c) => childrenOf(c.id, categories).length === 0 && c.status === "active");
  const attrs = resolveCategory(f.categoryId, categories)?.attributes || [];
  const hasVariants = !!f.variants?.length;
  const disc = f.price > 0 && f.salePrice > 0 ? Math.max(round(((f.price - f.salePrice) / f.price) * 100, 1), 0) : 0;
  const margin = f.costPrice > 0 && f.salePrice > 0 ? round(((f.salePrice - f.costPrice) / f.salePrice) * 100, 1) : null;
  const inReview = f.status === "pending_review";

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = "Enter a product name.";
    if (!f.categoryId) e.categoryId = "Choose a category.";
    if (!brandName.trim()) e.brand = "Enter the brand.";
    if (!f.sku.trim()) e.sku = "Enter a SKU.";
    else if (products.some((p) => p.id !== f.id && (p.sku || "").toLowerCase() === f.sku.trim().toLowerCase())) e.sku = "Another product already uses this SKU.";
    if (hasVariants) {
      if (f.variants.some((v) => !(v.price > 0) || !(v.salePrice > 0) || v.salePrice > v.price)) e.variants = "Each variant needs a selling price that isn't above its MRP.";
    } else {
      if (!(f.price > 0)) e.price = "Enter the MRP.";
      if (!(f.salePrice > 0)) e.salePrice = "Enter the selling price.";
      else if (f.salePrice > f.price) e.salePrice = "Selling price can't be above the MRP.";
    }
    if (Number.isFinite(f.costPrice) && f.costPrice < 0) e.costPrice = "Purchase price can't be negative.";
    if (!(f.tax >= 0 && f.tax <= 100)) e.tax = "Tax must be between 0 and 100.";
    if (!(f.minStock >= 0)) e.minStock = "Enter 0 or more.";
    if (isNew && !hasVariants && !(opening >= 0)) e.opening = "Enter 0 or more.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!validate()) { toast("Fix the highlighted fields", "danger"); return; }
    const existingBrandId = brandByName(brandName)?.id;
    const next = {
      ...f, name: f.name.trim(), slug: slugify(f.name), brandId: existingBrandId, brandName: brandName.trim(), sku: f.sku.trim(), barcode: (f.barcode || "").trim(),
      costPrice: Number.isFinite(f.costPrice) && f.costPrice > 0 ? f.costPrice : undefined,
      updatedAt: new Date().toISOString(),
    };
    if (hasVariants) { next.price = Math.min(...f.variants.map((v) => v.price)); next.salePrice = Math.min(...f.variants.map((v) => v.salePrice)); }
    setSaving(true);
    try {
      if (isNew) {
        // The server pins sellerId to this shop and forces status to pending_review whatever we send —
        // a seller can't list something live, or under someone else's name, from here or anywhere else.
        // Opening stock travels WITH the create request, so the server records it once, in the same transaction as the
        // product. (It used to be added to the local cache afterwards, which the next fetch silently threw away.) Whole
        // units only: stock is an integer, so a fraction is rounded exactly as it was before.
        const openingQty = !hasVariants ? Math.round(opening) : 0;
        await catalog.createProduct(next, { ...(openingQty > 0 ? { openingStock: { [STORES[0].id]: openingQty } } : {}), images: f.images });
        toast("Submitted for review — it goes live once approved");
      } else {
        await catalog.updateProduct(next, { images: f.images });
        toast("Product updated");
      }
      dispatch({ type: "AUDIT", entry: { actor: `${seller.name} (seller)`, action: isNew ? "Product submitted" : "Product updated", detail: next.name } });
      onClose();
    } catch (e2) {
      toast(e2.message || "Couldn't save that product", "danger");
    } finally {
      setSaving(false);
    }
  };

  const err = (k) => errors[k];
  return (
    <Drawer open={open} onClose={onClose} width={640} title={isNew ? "Add product" : "Edit product"} subtitle={isNew ? "New products are reviewed before customers can see them." : f.sku}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : isNew ? "Submit for review" : "Save changes"}</Btn></>}>
      <Section title="Basic information">
        <div className="space-y-3">
          <Field label="Product name" error={err("name")}><Input value={f.name} onChange={(e) => set({ name: e.target.value })} error={err("name")} placeholder="e.g. Cold brew coffee concentrate" /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Category" error={err("categoryId")}>
              <Select value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value, attributes: {} })}>
                {leaves.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Brand" error={err("brand")} hint="Pick an existing brand or type your own.">
              <Input list="seller-brands" value={brandName} onChange={(e) => setBrandName(e.target.value)} error={err("brand")} placeholder="Brand name" />
              <datalist id="seller-brands">{BRANDS.map((b) => <option key={b.id} value={b.name} />)}</datalist>
            </Field>
          </div>
          <Field label="Description"><Textarea rows={4} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="What it is, what it's made of, how to use it" /></Field>
        </div>
      </Section>

      <Section title="Images"><ImageUploader images={f.images} onChange={(images) => set({ images })} /></Section>

      <Section title="Identifiers">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="SKU" error={err("sku")}><Input value={f.sku} onChange={(e) => set({ sku: e.target.value })} error={err("sku")} /></Field>
          <Field label="Barcode"><Input value={f.barcode || ""} onChange={(e) => set({ barcode: e.target.value })} inputMode="numeric" placeholder="Optional" /></Field>
          <Field label="Unit"><Select value={f.unit} onChange={(e) => set({ unit: e.target.value })}>{[...new Set([...UNITS, f.unit])].map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
        </div>
      </Section>

      <Section title="Pricing" hint={hasVariants ? "This product has variants, so prices are set per variant." : undefined}>
        {hasVariants ? (
          <div className="space-y-2">
            {f.variants.map((v, i) => (
              <div key={v.id} className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-end">
                <Field label={i === 0 ? "Variant" : undefined}><div className="h-9 flex items-center text-sm truncate" style={{ color: s.text }}>{v.label}<span className="ml-2 text-xs" style={{ color: s.muted }}>{v.sku}</span></div></Field>
                <Field label={i === 0 ? "MRP" : undefined}><NumberInput step="0.01" prefix="$" value={v.price} onChange={(n) => set({ variants: f.variants.map((x, j) => (j === i ? { ...x, price: n } : x)) })} /></Field>
                <Field label={i === 0 ? "Selling price" : undefined}><NumberInput step="0.01" prefix="$" value={v.salePrice} onChange={(n) => set({ variants: f.variants.map((x, j) => (j === i ? { ...x, salePrice: n } : x)) })} /></Field>
              </div>
            ))}
            {err("variants") && <p className="text-xs font-medium" style={{ color: TONE.danger }}>{err("variants")}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Purchase price" error={err("costPrice")} hint="Your cost per unit"><NumberInput step="0.01" prefix="$" value={f.costPrice} onChange={(n) => set({ costPrice: n })} error={err("costPrice")} /></Field>
            <Field label="MRP" error={err("price")}><NumberInput step="0.01" prefix="$" value={f.price} onChange={(n) => set({ price: n })} error={err("price")} /></Field>
            <Field label="Selling price" error={err("salePrice")}><NumberInput step="0.01" prefix="$" value={f.salePrice} onChange={(n) => set({ salePrice: n })} error={err("salePrice")} /></Field>
            <Field label="Discount" hint="Sets the selling price"><NumberInput step="0.1" suffix="%" value={disc} onChange={(n) => Number.isFinite(n) && f.price > 0 && set({ salePrice: round(f.price * (1 - Math.min(Math.max(n, 0), 100) / 100)) })} /></Field>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <Field label="Tax" error={err("tax")}><NumberInput step="0.1" suffix="%" value={f.tax} onChange={(n) => set({ tax: n })} error={err("tax")} /></Field>
          {margin != null && <div className="sm:col-span-3 flex items-end"><p className="text-sm pb-2" style={{ color: s.muted }}>Margin <span className="font-semibold tnum" style={{ color: margin >= 0 ? TONE.ok : TONE.danger }}>{margin}%</span> · {fmt(f.salePrice - f.costPrice)} per unit</p></div>}
        </div>
      </Section>

      <Section title="Stock">
        {isNew ? (
          <div className="grid grid-cols-2 gap-3">
            {hasVariants ? <div className="col-span-2"><Notice tone="info">Variant stock is managed per variant in Inventory after the product is created.</Notice></div> :
              <Field label="Opening stock" error={err("opening")} hint={`At ${STORES[0].name}`}><NumberInput value={opening} onChange={setOpening} error={err("opening")} /></Field>}
            <Field label="Minimum stock level" error={err("minStock")} hint="Alerts start at or below this"><NumberInput value={f.minStock} onChange={(n) => set({ minStock: n })} error={err("minStock")} /></Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Current stock" hint="Changes are recorded in the inventory history"><div className="h-9 flex items-center gap-3"><span className="tnum text-sm font-semibold" style={{ color: s.text }}>{totalStock(f)} in stock</span>{onOpenInventory && <Btn size="sm" onClick={() => onOpenInventory(f)}>Adjust stock</Btn>}</div></Field>
            <Field label="Minimum stock level" error={err("minStock")} hint="Alerts start at or below this"><NumberInput value={f.minStock} onChange={(n) => set({ minStock: n })} error={err("minStock")} /></Field>
          </div>
        )}
      </Section>

      <Section title="Status">
        {inReview ? <Notice tone="info">This product is in review. Once approved it goes live automatically.</Notice> : (
          <div className="space-y-2">
            <Segmented label="Product status" value={f.status} onChange={(v) => set({ status: v })} options={[{ id: "active", label: "Active" }, { id: "inactive", label: "Inactive" }]} />
            <p className="text-xs" style={{ color: s.muted }}>Inactive products are hidden from customers. Low stock and Out of stock are set automatically from your stock levels.</p>
          </div>
        )}
      </Section>

      {attrs.length > 0 && (
        <Section title="Specifications" hint={`Details shoppers see for ${resolveCategory(f.categoryId, categories)?.name}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attrs.map((a) => (
              <Field key={a.key} label={a.label}>
                {a.options?.length ? (
                  <Select value={f.attributes?.[a.key] ?? ""} onChange={(e) => set({ attributes: { ...f.attributes, [a.key]: e.target.value } })}>
                    <option value="">—</option>{a.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                ) : <Input value={f.attributes?.[a.key] ?? ""} onChange={(e) => set({ attributes: { ...f.attributes, [a.key]: e.target.value } })} />}
              </Field>
            ))}
          </div>
        </Section>
      )}
    </Drawer>
  );
}
