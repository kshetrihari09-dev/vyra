import React, { useEffect, useMemo, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { SectionHeader, PillButton, Badge } from "../../components/shared/ui.jsx";
import { HERO_SCENES, FloatingLeaves } from "../components/HeroScene.jsx";
import { CategoryCard } from "../components/CategoryCard.jsx";
import { ProductRail, ProductCard } from "../components/ProductCard.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { Icon, ArrowRight, Clock, Percent, Tag, Truck, ShieldCheck, Headphones, MapPin, Star } from "../../components/shared/Icon.jsx";
import { topCategories, categoryTreeIds } from "../../data/categories.js";
import { BRANDS } from "../../data/brands.js";
import { STORES } from "../../data/stores.js";
import { productById } from "../../data/products.js";
import { sortProducts } from "../../utils/search.js";
import { priceOf } from "../../utils/pricing.js";
import { stockFor } from "../../utils/inventory.js";
import { fmt } from "../../utils/format.js";
import { TONE } from "../../theme.js";

/* Hero banner. Background is the active theme's gradient (primary -> primaryDark) — unchanged from before, so all four
   themes (teal / ocean / coral / violet) keep their colour. Slider state lives here so timer ticks don't re-render Home. */
const TRUST = [
  { icon: Star, label: "Quality Products" },
  { icon: ShieldCheck, label: "Trusted Sellers" },
  { icon: Truck, label: "Fast Delivery" },
];
function HeroBanner({ nav }) {
  const C = useC();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const Scene = HERO_SCENES[idx];

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (paused || reduce) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_SCENES.length), 6000);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div className="vyra-hero rounded-[28px] overflow-hidden relative flex items-center gap-2 px-5 py-6 md:px-10 md:py-8 md:min-h-[300px]"
      role="region" aria-roledescription="carousel" aria-label="Featured"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      style={{ background: `linear-gradient(120deg, ${C.primary} 0%, ${C.primaryDark} 100%)`, boxShadow: "0 12px 30px -14px rgba(6,63,80,.45)" }}>
      {/* depth: soft glow behind the artwork, faint rings, fine dot texture (white tints only) */}
      <div aria-hidden="true" className="absolute pointer-events-none -right-16 -top-24 w-[420px] h-[420px] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 68%)" }} />
      <div aria-hidden="true" className="absolute pointer-events-none -left-24 -bottom-32 w-72 h-72 rounded-full" style={{ border: "1px solid rgba(255,255,255,.14)" }} />
      <div aria-hidden="true" className="absolute pointer-events-none -left-10 -bottom-20 w-52 h-52 rounded-full" style={{ border: "1px solid rgba(255,255,255,.10)" }} />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.10) 1px, transparent 1.2px)", backgroundSize: "18px 18px", maskImage: "linear-gradient(90deg, #000, transparent 60%)", WebkitMaskImage: "linear-gradient(90deg, #000, transparent 60%)" }} />
      <FloatingLeaves />

      <div className="flex-1 min-w-0 relative z-10 max-w-[560px]">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] md:text-xs font-bold tracking-wide mb-3"
          style={{ background: "rgba(255,255,255,.18)", color: "#fff", border: "1px solid rgba(255,255,255,.28)", backdropFilter: "blur(6px)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true" /> Fresh Deals for You
        </span>
        <h1 className="text-white font-extrabold text-[22px] leading-[1.18] md:text-[40px] md:leading-[1.1] tracking-tight">
          Groceries, beauty, tech and medicine <span className="text-white/75">— all in one place.</span>
        </h1>
        <p className="text-white/85 text-[12.5px] md:text-[15px] leading-relaxed mt-2.5 max-w-md">
          Thousands of products from {STORES.length} nearby stores, with pharmacist-checked medicines when you need them.
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3.5 list-none p-0">
          {TRUST.map((t) => (
            <li key={t.label} className="flex items-center gap-1.5 text-[11.5px] md:text-[13px] font-semibold text-white">
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.2)" }}>
                <t.icon size={11} aria-hidden="true" />
              </span>
              {t.label}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 mt-5">
          <button type="button" onClick={() => nav("categories")}
            className="vyra-hero-cta inline-flex items-center gap-2 h-11 md:h-12 px-6 md:px-7 rounded-full bg-white font-extrabold text-sm md:text-[15px]"
            style={{ color: C.primaryDark, boxShadow: "0 6px 16px rgba(0,0,0,.14)" }}>
            Shop Now <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => nav("offers")} className="text-[13px] font-bold text-white/90 underline underline-offset-4 decoration-white/40 hover:decoration-white">
            See offers
          </button>
        </div>
      </div>

      <div className="hidden sm:block relative z-10 shrink-0 w-[240px] md:w-[360px] self-center" aria-live="off">
        <div key={idx} className="vyra-settle drop-shadow-[0_14px_18px_rgba(0,0,0,.18)]"><Scene /></div>
      </div>

      <div className="absolute z-20 bottom-2.5 right-3 md:bottom-4 md:right-6 flex items-center" role="group" aria-label="Choose slide">
        {HERO_SCENES.map((_, i) => (
          <button key={i} type="button" aria-label={`Show slide ${i + 1} of ${HERO_SCENES.length}`} aria-current={i === idx} onClick={() => setIdx(i)} className="p-1.5">
            <span className="block h-2 rounded-full transition-all duration-300" style={{ width: i === idx ? 22 : 8, background: i === idx ? "#fff" : "rgba(255,255,255,.45)" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

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
        <HeroBanner nav={nav} />

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
