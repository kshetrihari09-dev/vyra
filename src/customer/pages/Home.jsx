import React, { useMemo } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { SectionHeader, PillButton, Badge } from "../../components/shared/ui.jsx";
import HeroArt from "../components/HeroArt.jsx";
import { CategoryCard } from "../components/CategoryCard.jsx";
import { ProductRail, ProductCard } from "../components/ProductCard.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { Icon, ArrowRight, Clock, Percent, Tag, Truck, ShieldCheck, Headphones, MapPin } from "../../components/shared/Icon.jsx";
import { topCategories, categoryTreeIds } from "../../data/categories.js";
import { BRANDS } from "../../data/brands.js";
import { STORES } from "../../data/stores.js";
import { productById } from "../../data/products.js";
import { sortProducts } from "../../utils/search.js";
import { priceOf } from "../../utils/pricing.js";
import { stockFor } from "../../utils/inventory.js";
import { fmt } from "../../utils/format.js";
import { TONE } from "../../theme.js";

export default function Home({ nav }) {
  const { products, activeProducts, categories, storeId, myOrders: orders, recentlyViewed, toast } = useApp();
  const C = useC();
  const store = STORES.find((s) => s.id === storeId);

  const tops = useMemo(() => topCategories(categories), [categories]);
  const byTag = (tag) => activeProducts.filter((p) => (p.tags || []).includes(tag));

  const sections = useMemo(() => ({
    popular: byTag("popular").slice(0, 10),
    flash: byTag("flash").slice(0, 10),
    best: sortProducts(activeProducts, "bestselling").slice(0, 10),
    fresh: sortProducts(activeProducts, "newest").slice(0, 10),
    near: byTag("near").filter((p) => stockFor(p, null, storeId) > 0).slice(0, 10),
  }), [activeProducts, storeId]);

  /* "Recommended" is derived from what the customer has actually bought and
     viewed — same categories, excluding things already seen. */
  const recommended = useMemo(() => {
    const seen = new Set(recentlyViewed);
    const affinity = new Set();
    orders.slice(0, 3).forEach((o) => o.items.forEach((i) => {
      const p = productById(i.productId, products);
      if (p) affinity.add(p.categoryId);
    }));
    recentlyViewed.forEach((id) => { const p = productById(id, products); if (p) affinity.add(p.categoryId); });
    const roots = [...affinity].flatMap((id) => categoryTreeIds(id, categories));
    return activeProducts.filter((p) => roots.includes(p.categoryId) && !seen.has(p.id)).sort((a, b) => b.rating - a.rating).slice(0, 10);
  }, [orders, recentlyViewed, activeProducts, categories]);

  const buyAgain = useMemo(() => {
    const ids = [];
    orders.forEach((o) => o.items.forEach((i) => { if (!ids.includes(i.productId)) ids.push(i.productId); }));
    return ids.map((id) => productById(id, products)).filter(Boolean).slice(0, 10);
  }, [orders, products]);

  const viewed = recentlyViewed.map((id) => productById(id, products)).filter(Boolean);
  const open = (id) => nav("product", { productId: id });

  return (
    <Page wide>
      {/* 1 — Promotional banner */}
      <section className="px-4 md:px-0 mb-6">
        <div className="rounded-3xl overflow-hidden relative flex items-center gap-4 p-5 md:p-8"
          style={{ background: `linear-gradient(120deg, ${C.primary} 0%, ${C.primaryDark} 100%)` }}>
          <div className="flex-1 min-w-0 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mb-2.5"
              style={{ background: "rgba(255,255,255,.22)", color: "#fff" }}>
              <Clock size={11} /> Delivery in {store.etaMinutes} minutes
            </span>
            <h1 className="text-white font-extrabold text-xl md:text-4xl leading-tight">
              Groceries, beauty, tech<br className="hidden md:block" /> and medicine — one basket.
            </h1>
            <p className="text-white/85 text-xs md:text-base mt-2 max-w-lg">
              Thousands of products from {STORES.length} nearby stores, with pharmacist-checked medicines when you need them.
            </p>
            <div className="flex gap-2 mt-4">
              <PillButton variant="subtle" onClick={() => nav("categories")}>Start shopping <ArrowRight size={15} /></PillButton>
              <button onClick={() => nav("offers")} className="px-4 py-3 rounded-full text-sm font-bold" style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}>
                See offers
              </button>
            </div>
          </div>
          <div className="hidden sm:block shrink-0 w-44 md:w-80">
            <HeroArt />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3">
          {[
            { icon: Truck, title: "Free delivery", sub: "On orders over Rs. 25" },
            { icon: ShieldCheck, title: "Verified sellers", sub: "Licensed pharmacy" },
            { icon: Percent, title: "Daily deals", sub: "Up to 35% off" },
            { icon: Headphones, title: "24/7 support", sub: "Chat or call" },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl p-3 flex items-center gap-2.5" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                <f.icon size={16} style={{ color: C.primary }} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold truncate" style={{ color: C.navy }}>{f.title}</span>
                <span className="block text-[11px] truncate" style={{ color: C.muted }}>{f.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 2 — Shop by Category */}
      <section className="mb-5">
        <SectionHeader title="Shop by Category" subtitle="Every aisle, one app" onViewAll={() => nav("categories")} />
        <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-0 md:hidden">
          {tops.map((c) => <CategoryCard key={c.id} category={c} variant="chip" onSelect={(id) => nav("category", { categoryId: id })} />)}
        </div>
        <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 gap-3">
          {tops.map((c) => (
            <CategoryCard key={c.id} category={c} onSelect={(id) => nav("category", { categoryId: id })}
              count={c.productCount ?? 0} />
          ))}
        </div>
      </section>

      {/* 3 — Popular Products */}
      <Rail title="Popular Products" subtitle="What everyone's buying right now" items={sections.popular} nav={nav} open={open} sort="bestselling" />

      {/* 4 — Flash Deals */}
      <section className="mb-5">
        <div className="mx-4 md:mx-0 rounded-3xl p-4 md:p-5" style={{ background: C.navy }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-extrabold text-[17px] md:text-xl flex items-center gap-2">
                <Percent size={18} /> Flash Deals
              </h2>
              <p className="text-white/70 text-xs mt-0.5">Ends at midnight · up to 35% off</p>
            </div>
            <button onClick={() => nav("offers")} className="text-xs font-bold px-3 py-2 rounded-full" style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}>
              View all
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {sections.flash.map((p) => {
              const { price, mrp, discountPct } = priceOf(p);
              return (
                <button key={p.id} onClick={() => open(p.id)} className="w-[138px] shrink-0 rounded-2xl p-2.5 text-left" style={{ background: C.white }}>
                  <div className="h-20 rounded-xl overflow-hidden mb-2"><ProductArt product={p} size={64} rounded={false} /></div>
                  <p className="text-[12px] font-bold line-clamp-2 leading-snug" style={{ color: C.navy }}>{p.name}</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="font-extrabold text-sm" style={{ color: TONE.danger }}>{fmt(price)}</span>
                    <span className="text-[10px] line-through" style={{ color: C.muted }}>{fmt(mrp)}</span>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: C.primary }}>{discountPct}% off</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5 / 6 / 7 — Best Sellers, New Arrivals, Recommended */}
      <Rail title="Best Sellers" subtitle="Top sellers across every category" items={sections.best} nav={nav} open={open} sort="bestselling" />
      <Rail title="New Arrivals" subtitle="Just landed this month" items={sections.fresh} nav={nav} open={open} sort="newest" />
      {recommended.length > 0 && <Rail title="Recommended For You" subtitle="Based on what you've bought and viewed" items={recommended} nav={nav} open={open} />}

      {/* 8 — Products Near You */}
      {sections.near.length > 0 && (
        <section className="mb-5">
          <SectionHeader title="Products Near You"
            subtitle={`In stock at ${store.name} · ${store.distanceKm} km away`}
            onViewAll={() => nav("search")} />
          <ProductRail products={sections.near} onOpen={open} />
        </section>
      )}

      {/* 9 — Brands */}
      <section className="mb-5">
        <SectionHeader title="Brands" subtitle="Shop your favourites" />
        <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-0">
          {BRANDS.map((b) => (
            <button key={b.id} onClick={() => nav("search", { brandId: b.id })}
              className="shrink-0 w-[112px] rounded-2xl p-3 flex flex-col items-center gap-2"
              style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base" style={{ background: b.tint, color: b.fg }}>
                {b.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[11px] font-bold text-center leading-tight" style={{ color: C.navy }}>{b.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 10 / 11 — Recently Viewed, Buy Again */}
      {viewed.length > 0 && <Rail title="Recently Viewed" items={viewed} nav={nav} open={open} />}
      {buyAgain.length > 0 && (
        <section className="mb-5">
          <SectionHeader title="Buy Again" subtitle="From your past orders" onViewAll={() => nav("orders")} actionLabel="Your orders" />
          <ProductRail products={buyAgain} onOpen={open} />
        </section>
      )}

    </Page>
  );
}

function Rail({ title, subtitle, items, open, nav, sort }) {
  if (!items?.length) return null;
  return (
    <section className="mb-5">
      <SectionHeader title={title} subtitle={subtitle} onViewAll={() => nav("search", sort ? { sort } : {})} />
      <ProductRail products={items} onOpen={open} />
    </section>
  );
}
