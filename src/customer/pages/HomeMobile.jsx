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
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_SCENES.length), 6000);
    return () => clearInterval(t);
  }, []);
  const stores = STORES.length;
  const blurb = productCount > 0
    ? `${productCount} products from ${stores} nearby store${stores === 1 ? "" : "s"}, with pharmacist-checked medicines.`
    : `Products from ${stores} nearby store${stores === 1 ? "" : "s"}, with pharmacist-checked medicines.`;
  return (
    <section aria-label="Featured" className="vyra-hero relative overflow-hidden rounded-[22px] pl-4 pr-3 pt-4 pb-4"
      style={{ background: `linear-gradient(125deg, ${C.primary} 0%, ${C.primaryDark} 100%)`, boxShadow: "0 12px 26px -14px rgba(6,63,80,.5)" }}>
      <div aria-hidden="true" className="absolute pointer-events-none -right-10 -top-16 w-60 h-60 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,.24) 0%, rgba(255,255,255,0) 68%)" }} />
      <div aria-hidden="true" className="absolute pointer-events-none -left-14 -bottom-20 w-44 h-44 rounded-full" style={{ border: "1px solid rgba(255,255,255,.14)" }} />
      <div className="relative z-10 flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 h-[22px] rounded-full text-[10.5px] font-bold tracking-wide" style={{ background: "rgba(255,255,255,.18)", color: "#fff", border: "1px solid rgba(255,255,255,.28)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true" /> Fresh Deals for You
          </span>
          <h1 className="text-white font-extrabold text-[19px] min-[380px]:text-[21px] leading-[1.18] tracking-tight mt-2">
            Groceries, beauty, tech &amp; medicine <span className="text-white/75">in one place.</span>
          </h1>
          <p className="text-white/85 text-[12px] leading-snug mt-1.5 line-clamp-3">{blurb}</p>
          <button type="button" onClick={() => nav("categories")}
            className="vyra-hero-cta mt-3 inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-white font-extrabold text-[13.5px]"
            style={{ color: C.primaryDark, boxShadow: "0 6px 14px rgba(0,0,0,.14)" }}>
            Shop Now <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="shrink-0 self-end w-[31%] min-w-[92px] max-w-[148px] -mb-1 -mr-1" aria-hidden="true">
          <div key={idx} className="vyra-settle drop-shadow-[0_10px_12px_rgba(0,0,0,.18)]"><Scene /></div>
        </div>
      </div>
      <div className="relative z-10 flex items-center justify-center -mb-1.5 mt-1" role="group" aria-label="Choose slide">
        {HERO_SCENES.map((_, i) => (
          <button key={i} type="button" aria-label={`Show slide ${i + 1} of ${HERO_SCENES.length}`} aria-current={i === idx} onClick={() => setIdx(i)} className="p-2">
            <span className="block h-1.5 rounded-full transition-all duration-300" style={{ width: i === idx ? 18 : 6, background: i === idx ? "#fff" : "rgba(255,255,255,.5)" }} />
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
          <div className="mscroll">
            {tops.map((c) => <CategoryCard key={c.id} category={c} variant="chip" onSelect={(id) => nav("category", { categoryId: id })} />)}
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
