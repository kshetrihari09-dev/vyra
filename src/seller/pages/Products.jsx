import React, { useMemo, useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useShop } from "../hooks/useShopData.js";
import { useS } from "../components/tokens.js";
import { Btn, ConfirmModal, DataTable, EmptyBlock, IconBtn, Modal, PageHeader, Pagination, Panel, Pill, SearchField, Select, Tabs, Thumb, useTable } from "../components/kit.jsx";
import ProductForm from "../components/ProductForm.jsx";
import { productStatus, totalStock, discountPct } from "../../services/sellerAnalytics.js";
import { resolveCategory } from "../../data/categories.js";
import { brandById } from "../../data/brands.js";
import { priceOf } from "../../utils/pricing.js";
import { fmt } from "../../utils/format.js";

export default function Products({ nav, params }) {
  const s = useS();
  const { seller, listings, categories } = useShop();
  const { orders, dispatch, toast, catalog } = useApp();
  const [q, setQ] = useState(params.q || "");
  const [tab, setTab] = useState("all");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState(params.new ? "new" : null); // "new" | product | null
  const [removing, setRemoving] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const canWrite = seller.status === "active";

  const soldIds = useMemo(() => new Set(orders.flatMap((o) => o.items.map((i) => i.productId))), [orders]);
  const all = useMemo(() => listings.map((p) => {
    const qty = totalStock(p);
    return { p, id: p.id, name: p.name, qty, status: productStatus(p, qty), price: priceOf(p).price, root: resolveCategory(p.categoryId, categories)?.root, updated: p.updatedAt || p.createdAt };
  }), [listings, categories]);

  const counts = useMemo(() => {
    const c = { all: all.length, active: 0, low: 0, out: 0, inactive: 0, review: 0 };
    all.forEach((r) => { c[r.status.key] += 1; });
    return c;
  }, [all]);
  const roots = useMemo(() => [...new Map(all.filter((r) => r.root).map((r) => [r.root.id, r.root])).values()], [all]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((r) => (tab === "all" || r.status.key === tab) && (cat === "all" || r.root?.id === cat)
      && (!t || r.name.toLowerCase().includes(t) || (r.p.sku || "").toLowerCase().includes(t) || (r.p.barcode || "").includes(t)));
  }, [all, q, tab, cat]);

  const table = useTable(filtered, {
    initialSort: { key: "updated", dir: "desc" }, pageSize: 10,
    sortAccessors: { name: (r) => r.name.toLowerCase(), price: (r) => r.price, qty: (r) => r.qty, updated: (r) => new Date(r.updated).getTime() },
  });

  const toggle = async (r) => {
    const next = r.p.status === "active" ? "inactive" : "active";
    try {
      await catalog.updateProduct({ ...r.p, status: next });
      dispatch({ type: "AUDIT", entry: { actor: `${seller.name} (seller)`, action: next === "active" ? "Product activated" : "Product deactivated", detail: r.name } });
      toast(next === "active" ? `${r.name} is live` : `${r.name} deactivated`);
    } catch (err) {
      toast(err.message || "Couldn't change that product", "danger");
    }
  };
  const askDelete = (r) => (soldIds.has(r.id) ? setBlocked(r) : setRemoving(r));
  const doDelete = async () => {
    try {
      await catalog.removeProduct(removing.id);
      dispatch({ type: "AUDIT", entry: { actor: `${seller.name} (seller)`, action: "Product deleted", detail: removing.name } });
      toast("Product deleted");
    } catch (err) {
      toast(err.message || "Couldn't delete that product", "danger");
    }
  };

  const actions = (r) => (
    <div className="flex items-center gap-1 justify-end">
      <Btn size="sm" icon="Pencil" onClick={() => setEditing(r.p)} disabled={!canWrite}>Edit</Btn>
      {r.status.key !== "review" && <Btn size="sm" icon={r.p.status === "active" ? "Ban" : "Eye"} onClick={() => toggle(r)} disabled={!canWrite}>{r.p.status === "active" ? "Deactivate" : "Activate"}</Btn>}
      <IconBtn icon="Trash2" label={`Delete ${r.name}`} onClick={() => askDelete(r)} tone="#E0546A" />
    </div>
  );

  const columns = [
    { key: "name", label: "Product", sortable: true, mobile: "title", render: (r) => (
      <div className="flex items-center gap-3 min-w-0"><Thumb product={r.p} size={40} />
        <div className="min-w-0"><p className="font-medium truncate max-w-[280px]">{r.name}</p><p className="text-xs truncate" style={{ color: s.muted }}>{brandById(r.p.brandId).name} · {r.root?.name || "Uncategorised"}</p></div></div>) },
    { key: "sku", label: "SKU", render: (r) => <span className="tnum" style={{ color: s.muted }}>{r.p.sku}</span> },
    { key: "price", label: "Price", sortable: true, align: "right", render: (r) => {
      const d = discountPct(r.p); return <div><p className="font-medium">{fmt(r.price)}</p>{d > 0 && <p className="text-xs" style={{ color: s.muted }}><s>{fmt(priceOf(r.p).mrp)}</s> · {d}% off</p>}</div>; } },
    { key: "qty", label: "Stock", sortable: true, align: "right", render: (r) => <span className="font-medium">{r.qty}</span> },
    { key: "status", label: "Status", mobile: "aside", render: (r) => <Pill tone={r.status.tone}>{r.status.label}</Pill> },
    { key: "actions", label: "", align: "right", mobile: "footer", render: actions },
  ];

  return (
    <div>
      <PageHeader title="Products" description="Everything you sell, with price, stock and status in one place."
        actions={<Btn variant="primary" icon="Plus" onClick={() => setEditing("new")} disabled={!canWrite}>Add product</Btn>} />
      <Panel padded={false}>
        <div className="px-4 pt-1">
          <Tabs value={tab} onChange={(t) => { setTab(t); table.setPage(1); }} items={[
            { id: "all", label: "All", count: counts.all }, { id: "active", label: "Active", count: counts.active },
            { id: "low", label: "Low stock", count: counts.low }, { id: "out", label: "Out of stock", count: counts.out },
            { id: "inactive", label: "Inactive", count: counts.inactive }, ...(counts.review ? [{ id: "review", label: "In review", count: counts.review }] : []),
          ]} />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 p-4">
          <SearchField className="flex-1" value={q} onChange={(v) => { setQ(v); table.setPage(1); }} placeholder="Search by name, SKU or barcode" />
          <Select value={cat} onChange={(e) => { setCat(e.target.value); table.setPage(1); }} aria-label="Filter by category" className="sm:!w-52">
            <option value="all">All categories</option>{roots.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={`${table.sort?.key}:${table.sort?.dir}`} onChange={(e) => { const [key, dir] = e.target.value.split(":"); table.setSort({ key, dir }); }} aria-label="Sort products" className="sm:!w-48 md:hidden">
            <option value="updated:desc">Recently updated</option><option value="name:asc">Name A–Z</option><option value="price:asc">Price: low to high</option><option value="qty:asc">Stock: low to high</option>
          </Select>
        </div>
        <DataTable columns={columns} rows={table.visible} rowKey={(r) => r.id} sort={table.sort} onSort={table.toggleSort}
          empty={<EmptyBlock icon="Package" title={listings.length ? "No products match" : "No products yet"}
            message={listings.length ? "Try a different search or filter." : "Add your first product to start selling on Vyra."}
            action={!listings.length && canWrite ? <Btn variant="primary" icon="Plus" onClick={() => setEditing("new")}>Add product</Btn> : null} />} />
        <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPage={table.setPage} />
      </Panel>

      <ProductForm open={!!editing} product={editing === "new" ? null : editing} seller={seller} onClose={() => setEditing(null)}
        onOpenInventory={(p) => { setEditing(null); nav("shopInventory", { q: p.sku }); }} />
      <ConfirmModal open={!!removing} danger title="Delete this product?" confirmLabel="Delete product" onClose={() => setRemoving(null)} onConfirm={doDelete}
        message={removing ? `${removing.name} will be removed from your catalogue. This can't be undone.` : ""} />
      <Modal open={!!blocked} onClose={() => setBlocked(null)} title="This product has order history" size={420}
        footer={<><Btn onClick={() => setBlocked(null)}>Close</Btn>{blocked?.p.status === "active" && <Btn variant="primary" onClick={() => { toggle(blocked); setBlocked(null); }}>Deactivate instead</Btn>}</>}>
        <p className="text-sm leading-relaxed" style={{ color: "#4A5F6B" }}>{blocked?.name} appears in past orders, so deleting it would break those records. Deactivate it to hide it from customers while keeping your history intact.</p>
      </Modal>
    </div>
  );
}
