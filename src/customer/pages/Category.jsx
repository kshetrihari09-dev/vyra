import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader } from "../../components/shared/ui.jsx";
import { ProductBrowser } from "../components/ProductBrowser.jsx";
import { CategoryCard } from "../components/CategoryCard.jsx";
import { ChevronRight } from "../../components/shared/Icon.jsx";
import { resolveCategory, childrenOf, categoryPath } from "../../data/categories.js";

export default function Category({ nav, params }) {
  const { categories } = useApp();
  const C = useC();
  const category = resolveCategory(params.categoryId, categories);
  const path = categoryPath(params.categoryId, categories);
  // The sub-navigation strip belongs to the top-level department, so it stays visible (with the current choice
  // highlighted) while a subcategory is open instead of disappearing.
  const strip = category?.root || category;
  const siblings = strip ? childrenOf(strip.id, categories) : [];

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

      {siblings.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 md:px-0 mb-4" role="group" aria-label="Subcategories">
          <CategoryCard category={{ ...strip, id: strip.id, name: "All", icon: "LayoutGrid", tint: C.mint, fg: C.primary }} variant="pill"
            active={params.categoryId === strip.id} onSelect={() => nav("category", { categoryId: strip.id })} />
          {siblings.map((s) => (
            <CategoryCard key={s.id} category={s} variant="pill" count={s.productCount}
              active={params.categoryId === s.id} onSelect={(id) => nav("category", { categoryId: id })} />
          ))}
        </div>
      )}

      <ProductBrowser categoryId={params.categoryId} onOpen={(id) => nav("product", { productId: id })}
        emptyTitle={`Nothing in ${category.name} matches`} />
    </Page>
  );
}
