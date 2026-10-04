import React, { memo } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { FavoriteButton } from "../../components/shared/ui.jsx";
import { Clock } from "../../components/shared/Icon.jsx";
import { brandById } from "../../data/brands.js";
import { storeById } from "../../data/stores.js";
import { priceOf, defaultVariantId } from "../../utils/pricing.js";
import { stockState } from "../../utils/inventory.js";
import { fmt } from "../../utils/format.js";
import { TONE } from "../../theme.js";

/**
 * Compact, image-first grocery-style card used by every product surface (home rails, category/search
 * grids, offers, wishlist, cart suggestions). Presentation only — pricing, stock, wishlist and cart all
 * go through the same utilities / store actions as before.
 *
 * Hierarchy: image (discount badge top-left, "Ad" top-right) → delivery time → name → size → price / ADD.
 * `wide` is kept for API compatibility but the compact layout is used everywhere.
 */
export const ProductCard = memo(function ProductCard({ product, onOpen }) {
  const { storeId, wishlist, commerce, toast, session, dispatch } = useApp();
  const C = useC();
  const brand = brandById(product.brandId);
  const { price, mrp, discountPct } = priceOf(product);
  const stock = stockState(product, null, storeId);
  const out = stock.level === "out";
  const isFav = wishlist.includes(product.id);
  const variantCount = product.variants?.length || 0;

  /* Only flagged products show "Ad" — no ad data exists unless the product carries one of these markers. */
  const isAd = !!(product.sponsored || product.isAd || product.flags?.sponsored || (product.tags || []).some((t) => t === "ad" || t === "sponsored"));

  /* Delivery time comes from the selected store's existing ETA; nothing is shown if it's unknown. */
  const eta = storeById(storeId)?.etaMinutes;

  /* Size: the category's weight/size attribute, else the unit. Never invented. */
  const size = [product.attributes?.weight, product.attributes?.volume, product.attributes?.size, product.attributes?.strength, product.attributes?.packSize]
    .find((v) => v && v !== "—") || product.unit || "";

  /* Don't repeat the brand when the product name already starts with it. */
  const showBrand = brand?.name && !String(product.name).toLowerCase().startsWith(brand.name.toLowerCase());
  const title = showBrand ? `${brand.name} ${product.name}` : product.name;

  const add = (e) => {
    e.stopPropagation();
    if (out) return;
    if (variantCount) { onOpen(product.id); return; } // must choose a variant first (existing detail-page flow)
    dispatch({ type: "CART_ADD", productId: product.id, variantId: defaultVariantId(product), qty: product.moq || 1 });
    toast(`${product.name} added to cart`);
  };

  return (
    <div onClick={() => onOpen(product.id)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(product.id)}
      className="vcard relative flex flex-col h-full min-w-0 cursor-pointer overflow-hidden"
      style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12 }}>

      <div className="vcard-img relative w-full" style={{ aspectRatio: "1 / 1", background: "#F6F8F8", borderRadius: "11px 11px 0 0", overflow: "hidden" }}>
        <div className="vcard-img-inner w-full h-full">
          <ProductArt product={product} size={84} rounded={false} bg="#F6F8F8" />
        </div>
        {discountPct > 0 && (
          <span className="absolute top-0 left-1.5 flex flex-col items-center justify-center leading-none font-extrabold text-white px-1.5 pt-1 pb-1.5"
            style={{ background: C.primary, fontSize: 10, borderRadius: "0 0 6px 6px", minWidth: 28 }}>
            <span>{discountPct}%</span><span style={{ fontSize: 8 }}>OFF</span>
          </span>
        )}
        {isAd && (
          <span className="absolute top-1.5 right-1.5 px-1 rounded font-semibold" style={{ fontSize: 9, background: "rgba(255,255,255,.85)", color: C.muted }}>Ad</span>
        )}
        <div className="absolute bottom-1.5 right-1.5">
          <FavoriteButton floating={false} active={isFav} size={26} onClick={() => {
            if (!session.signedIn) { toast("Sign in to save favorites"); return; }
            commerce.toggleWishlist(product.id).catch((err) => toast(err.message || "Couldn't update favorites", "danger"));
          }} />
        </div>
        {out && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ background: "rgba(255,255,255,.7)", color: TONE.danger }}>Out of stock</span>}
      </div>

      <div className="flex-1 flex flex-col min-w-0 px-2 pt-1.5 pb-2">
        {eta ? (
          <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wide" style={{ fontSize: 9, color: C.muted }}>
            <Clock size={10} /> {eta} mins
          </span>
        ) : <span style={{ height: 11 }} />}

        <p className="font-semibold leading-snug line-clamp-2 mt-0.5" style={{ color: C.navy, fontSize: 12.5, minHeight: "2.7em" }}>{title}</p>
        <p className="truncate mt-0.5" style={{ color: C.muted, fontSize: 11 }}>{size}</p>

        <div className="mt-auto pt-2 flex items-end justify-between gap-1.5">
          <div className="min-w-0">
            <div className="font-extrabold whitespace-nowrap" style={{ color: C.navy, fontSize: 13 }}>{fmt(price)}</div>
            {mrp > price && <div className="line-through whitespace-nowrap" style={{ color: C.muted, fontSize: 10.5 }}>{fmt(mrp)}</div>}
          </div>
          <button aria-label={variantCount ? `Choose options for ${product.name}` : `Add ${product.name} to cart`}
            onClick={add} disabled={out}
            className="vcard-add shrink-0 flex flex-col items-center justify-center font-extrabold leading-none transition-colors active:scale-95 disabled:opacity-40"
            style={{ border: `1.5px solid ${out ? C.border : C.primary}`, color: out ? C.muted : C.primary, borderRadius: 8, minWidth: 54, minHeight: 32, padding: "5px 8px", fontSize: 12, background: C.white }}>
            ADD
            {variantCount > 0 && <span className="font-semibold mt-0.5" style={{ fontSize: 8.5 }}>{variantCount} option{variantCount > 1 ? "s" : ""}</span>}
          </button>
        </div>
      </div>
    </div>
  );
});

/** Dense responsive grid: 2 cols on phones, auto-fills to 5–6+ on desktop (see .vgrid in index.css). */
export function ProductGrid({ products, onOpen }) {
  return (
    <div className="vgrid">
      {products.map((p) => <ProductCard key={p.id} product={p} onOpen={onOpen} />)}
    </div>
  );
}

/** Home-style row: horizontally scrollable (2 visible) on phones; one full-width row of 3–6 cards on larger screens. */
export function ProductRail({ products, onOpen }) {
  return (
    <div className="vrail px-4 md:px-0">
      {products.map((p) => <ProductCard key={p.id} product={p} onOpen={onOpen} />)}
    </div>
  );
}
