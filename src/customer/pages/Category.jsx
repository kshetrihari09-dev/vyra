import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader } from "../../components/shared/ui.jsx";
import { ProductBrowser } from "../components/ProductBrowser.jsx";
import { Icon, ChevronRight } from "../../components/shared/Icon.jsx";
import { resolveCategory, childrenOf, categoryPath } from "../../data/categories.js";

export default function Category({ nav, params }) {
  const { categories } = useApp();
  const C = useC();
  const category = resolveCategory(params.categoryId, categories);
  const subs = childrenOf(params.categoryId, categories);
  const path = categoryPath(params.categoryId, categories);

  if (!category) return <Page><PageHeader title="Category not found" onBack={() => nav("categories")} /></Page>;

  return (
    <Page wide>
      <div className="px-4 md:px-0">
        <nav className="flex items-center gap-1 text-[11px] mb-2 flex-wrap" style={{ color: C.muted }}>
          <button onClick={() => nav("categories")} className="font-semibold">All categories</button>
          {path.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <ChevronRight size={11} />
              <button onClick={() => nav("category", { categoryId: p.id })} className="font-semibold" style={{ color: p.id === params.categoryId ? C.primary : C.muted }}>{p.name}</button>
            </span>
          ))}
        </nav>
      </div>

      <PageHeader title={category.name} subtitle={category.description || `${category.productCount ?? 0} products`} onBack={() => nav("categories")} />

      {subs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 md:px-0 mb-4">
          <button onClick={() => nav("category", { categoryId: category.id })}
            className="shrink-0 px-3.5 py-2 rounded-full text-xs font-bold" style={{ background: C.primary, color: "#fff" }}>All</button>
          {subs.map((s) => (
            <button key={s.id} onClick={() => nav("category", { categoryId: s.id })}
              className="shrink-0 px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5"
              style={{ background: C.white, color: C.navy, border: `1px solid ${C.border}` }}>
              <Icon name={s.icon} size={13} style={{ color: s.fg }} /> {s.name}
            </button>
          ))}
        </div>
      )}

      <ProductBrowser categoryId={params.categoryId} onOpen={(id) => nav("product", { productId: id })}
        emptyTitle={`Nothing in ${category.name} matches`} />
    </Page>
  );
}
