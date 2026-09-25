import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader } from "../../components/shared/ui.jsx";
import { CategoryCard } from "../components/CategoryCard.jsx";
import { Icon, ChevronRight } from "../../components/shared/Icon.jsx";
import { topCategories, childrenOf, categoryTreeIds } from "../../data/categories.js";

export default function Categories({ nav }) {
  const { categories, products } = useApp();
  const C = useC();
  const tops = topCategories(categories);

  return (
    <Page wide>
      <PageHeader title="All Categories" subtitle={`${tops.length} departments · ${tops.reduce((n, c) => n + (c.productCount ?? 0), 0)} products`} />
      <div className="px-4 md:px-0 space-y-4">
        {tops.map((cat) => {
          const subs = childrenOf(cat.id, categories);
          const count = cat.productCount ?? 0; // whole subtree, counted by the API
          return (
            <section key={cat.id} className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <button onClick={() => nav("category", { categoryId: cat.id })} className="w-full flex items-center gap-3 p-4 text-left">
                <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: cat.tint }}>
                  <Icon name={cat.icon} size={22} style={{ color: cat.fg }} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm" style={{ color: C.navy }}>{cat.name}</span>
                  <span className="block text-xs truncate mt-0.5" style={{ color: C.muted }}>{count} products · {cat.description}</span>
                </span>
                <ChevronRight size={18} style={{ color: C.muted }} />
              </button>
              {subs.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-4">
                  {subs.map((s) => (
                    <button key={s.id} onClick={() => nav("category", { categoryId: s.id })}
                      className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                      style={{ background: s.tint, color: s.fg }}>
                      <Icon name={s.icon} size={13} /> {s.name}
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Page>
  );
}
