import React, { useEffect, useMemo, useState } from "react";
import { useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { HERO_SCENES } from "../components/HeroScene.jsx";
import { CategoryCard } from "../components/CategoryCard.jsx";
import { ProductCard } from "../components/ProductCard.jsx";
import { ArrowRight, ChevronRight, Headphones, Percent, ShieldCheck, Truck } from "../../components/shared/Icon.jsx";
import { BRANDS } from "../../data/brands.js";
import { STORES } from "../../data/stores.js";
import { priceOf } from "../../utils/pricing.js";

/**
 * Phone home screen (rendered only below 768 px — see Home.jsx; tablet and desktop use the original layout).
 * Presentation only: every product, price, discount, stock level, wishlist state and cart action comes from the same data and
 * handlers as before (useHomeData + ProductCard). Nothing here is mock data.
 */

/* ------------------------------------------------------------------------------------------------ hero */
function MobileHero({ nav, productCount }) {
  const C = useC();
  const [idx, setIdx] = useState(0);
  const Scene = HERO_SCENES[idx];

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_SCENES.length), 6500);
    return () => clearInterval(t);
  }, []);

  const stores = STORES.length;
  const blurb = productCount > 0
    ? `${productCount.toLocaleString()} products · ${stores} nearby stores`
    : `${stores} nearby stores · pharmacist-checked medicines`;

  return (
    <section
      aria-label="Featured"
      className="vyra-hero relative isolate overflow-hidden rounded-[26px] min-h-[218px] px-4 pt-4 pb-4"
      style={{
        background: `linear-gradient(125deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
        boxShadow: "0 12px 28px -16px rgba(6,63,80,.58)"
      }}
    >
      {/* Decorative depth */}
      <div aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,.25), transparent 68%)" }} />
      <div aria-hidden="true" className="absolute -right-10 bottom-[-92px] h-56 w-56 rounded-full border border-white/15 pointer-events-none" />
      <div aria-hidden="true" className="absolute left-0 top-0 h-full w-full pointer-events-none"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.12) .8px, transparent 1px)", backgroundSize: "17px 17px", maskImage: "linear-gradient(90deg, #000, transparent 82%)" }} />

      <div className="relative z-10 max-w-[78%]">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white"
          style={{ background: "rgba(255,255,255,.17)", border: "1px solid rgba(255,255,255,.25)" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          YOUR EVERYDAY MARKETPLACE
        </span>

        <h1 className="mt-3 text-[23px] min-[380px]:text-[25px] leading-[1.08] tracking-tight font-black text-white">
          Everything you need,
          <span className="block text-white/75">all in one place.</span>
        </h1>

        <p className="mt-2 max-w-[245px] text-[11.5px] leading-relaxed text-white/85">
          Groceries, beauty, tech and trusted pharmacy essentials.
        </p>

        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-white/85">
          <span className="inline-block h-1 w-1 rounded-full bg-white/80" />
          {blurb}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => nav("categories")}
            className="vyra-hero-cta inline-flex h-10 items-center gap-2 rounded-full bg-white px-4.5 text-[12.5px] font-extrabold active:scale-[.97] transition-transform"
            style={{ color: C.primaryDark, boxShadow: "0 5px 14px rgba(0,0,0,.16)" }}>
            Explore products <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => nav("offers")}
            className="text-[11.5px] font-bold text-white underline decoration-white/45 underline-offset-4">
            View offers
          </button>
        </div>
      </div>

      {/* Illustration */}
      <div className="pointer-events-none absolute z-[1] right-[-5px] bottom-[23px] w-[39%] max-w-[150px] opacity-95"
        aria-hidden="true">
        <div key={idx} className="vyra-settle drop-shadow-[0_12px_14px_rgba(0,0,0,.22)]">
          <Scene />
        </div>
      </div>

      <div className="absolute z-20 bottom-2 right-3 flex items-center rounded-full px-1 py-0.5"
        style={{ background: "rgba(0,0,0,.12)" }} role="group" aria-label="Choose featured slide">
        {HERO_SCENES.map((_, i) => (
          <button key={i} type="button" aria-label={`Show slide ${i + 1} of ${HERO_SCENES.length}`}
            aria-current={i === idx} onClick={() => setIdx(i)} className="p-1.5">
            <span className="block h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === idx ? 17 : 6, background: i === idx ? "#fff" : "rgba(255,255,255,.55)" }} />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ trust cards */
const PERKS = [
  { icon: Truck, title: "Free Delivery" },
  { icon: ShieldCheck, title: "Verified Sellers" },
  { icon: Percent, title: "Daily Deals" },
  { icon: Headphones, title: "24/7 Support" },
];
function PerkCards() {
  const C = useC();
  return (
    <ul className="grid grid-cols-4 gap-1.5 mt-2.5 list-none p-0 m-0">
      {PERKS.map((f) => (
        <li key={f.title} className="rounded-2xl px-1 py-2 flex flex-col items-center gap-1 text-center min-w-0"
          style={{ background: C.white, border: `1px solid ${C.border}`, boxShadow: "0 4px 10px -8px rgba(6,63,80,.25)" }}>
          <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.mint }}><f.icon size={16} style={{ color: C.primary }} aria-hidden="true" /></span>
          <span className="text-[11px] font-bold leading-[1.15] w-full break-words" style={{ color: C.navy }}>{f.title}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------------ section building blocks */
function Heading({ title, sub, onViewAll, actionLabel = "View all", light, icon: Ico }) {
  const C = useC();
  return (
    <div className="flex items-center justify-between gap-2 px-4 mb-1.5">
      <div className="min-w-0">
        <h2 className="font-extrabold text-[16px] leading-tight truncate flex items-center gap-1.5" style={{ color: light ? "#fff" : C.navy }}>
          {Ico && <Ico size={16} aria-hidden="true" />}{title}
        </h2>
        {sub && <p className="text-[11.5px] leading-tight mt-0.5 truncate" style={{ color: light ? "rgba(255,255,255,.8)" : C.muted }}>{sub}</p>}
      </div>
      {onViewAll && (
        <button type="button" onClick={onViewAll} className="shrink-0 -mr-1 px-1 h-8 flex items-center gap-0.5 text-[12.5px] font-bold" style={{ color: light ? "#fff" : C.primary }}>
          {actionLabel} <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Horizontal, snap-scrolling row of identical product cards. */
function ProductRow({ products, open }) {
  return (
    <div className="mscroll mrail">
      {products.map((p) => <ProductCard key={p.id} product={p} onOpen={open} variant="m" />)}
    </div>
  );
}

function Rail({ title, sub, items, open, onViewAll, defer = true, actionLabel }) {
  if (!items?.length) return null;
  return (
    <section className={`mb-4 ${defer ? "mdefer" : ""}`}>
      <Heading title={title} sub={sub} onViewAll={onViewAll} actionLabel={actionLabel} />
      <ProductRow products={items} open={open} />
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ page */
export default function MobileHome({ nav, data }) {
  const C = useC();
  const { store, tops, sections, recommended, buyAgain, viewed, productCount } = data;
  const open = (id) => nav("product", { productId: id });
  const search = (sort) => () => nav("search", sort ? { sort } : {});

  // "Up to N% off" is computed from the flash products actually shown, not hard-coded.
  const topDiscount = useMemo(() => sections.flash.reduce((m, p) => Math.max(m, priceOf(p).discountPct || 0), 0), [sections.flash]);

  return (
    <Page className="!pt-2.5">
      <div className="px-4 mb-4">
        <MobileHero nav={nav} productCount={productCount} />
        <PerkCards />
      </div>

      {tops.length > 0 && (
        <section className="mb-4">
          <Heading title="Shop by Category" onViewAll={() => nav("categories")} />
          <div className="vcat-rail">
            {tops.map((c) => <CategoryCard key={c.id} category={c} variant="chip" count={c.productCount} onSelect={(id) => nav("category", { categoryId: id })} />)}
          </div>
        </section>
      )}

      {sections.flash.length > 0 && (
        <section className="mb-4 py-3" style={{ background: `linear-gradient(180deg, ${C.mint} 0%, ${C.bg} 100%)` }}>
          <Heading title="Flash Deals" icon={Percent} sub={topDiscount > 0 ? `Up to ${topDiscount}% off` : undefined} onViewAll={() => nav("offers")} />
          <ProductRow products={sections.flash} open={open} />
        </section>
      )}

      <Rail title="Best Sellers" items={sections.best} open={open} onViewAll={search("bestselling")} defer={false} />
      <Rail title="New Arrivals" items={sections.fresh} open={open} onViewAll={search("newest")} />
      <Rail title="Recommended For You" sub="Based on what you've bought and viewed" items={recommended} open={open} onViewAll={search()} />
      <Rail title="Popular Products" items={sections.popular} open={open} onViewAll={search("bestselling")} />
      <Rail title="Products Near You" sub={store ? `In stock at ${store.name} · ${store.distanceKm} km away` : undefined} items={sections.near} open={open} onViewAll={search()} />

      <section className="mb-4 mdefer">
        <Heading title="Brands" />
        <div className="mscroll">
          {BRANDS.map((b) => (
            <button key={b.id} type="button" onClick={() => nav("search", { brandId: b.id })}
              className="mchip shrink-0 w-[92px] rounded-2xl py-2.5 px-2 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-[15px]" style={{ background: b.tint, color: b.fg }}>{b.name.slice(0, 2).toUpperCase()}</span>
              <span className="text-[11px] font-bold text-center leading-tight w-full line-clamp-2 break-words" style={{ color: C.navy }}>{b.name}</span>
            </button>
          ))}
        </div>
      </section>

      <Rail title="Recently Viewed" items={viewed} open={open} />
      <Rail title="Buy Again" sub="From your past orders" items={buyAgain} open={open} onViewAll={() => nav("orders")} actionLabel="Your orders" />

      {productCount === 0 && (
        <p className="mx-4 rounded-2xl p-4 text-center text-sm" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.muted }}>
          No products are available right now. Please check back soon.
        </p>
      )}
    </Page>
  );
}
