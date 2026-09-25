import React, { memo, useMemo } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { Badge, FavoriteButton, Rating } from "../../components/shared/ui.jsx";
import { Plus, ShieldCheck } from "../../components/shared/Icon.jsx";
import { brandById } from "../../data/brands.js";
import { resolveCategory } from "../../data/categories.js";
import { priceOf, defaultVariantId } from "../../utils/pricing.js";
import { stockState } from "../../utils/inventory.js";
import { fmt } from "../../utils/format.js";
import { TONE } from "../../theme.js";

/**
 * One card for every category. Nothing here is medicine-specific: the
 * highlight chip is whichever attribute the product's category marked as
 * `highlight`, so a T-shirt shows "M" where a medicine shows "500 mg".
 */
export const ProductCard = memo(function ProductCard({ product, onOpen, wide = false }) {
  const { storeId, wishlist, commerce, toast, session } = useApp();
  const C = useC();
  const brand = brandById(product.brandId);
  const { price, mrp, discountPct } = priceOf(product);
  const stock = stockState(product, null, storeId);
  const isFav = wishlist.includes(product.id);
  const rx = !!product.flags?.prescriptionRequired;

  const highlight = useMemo(() => {
    const cat = resolveCategory(product.categoryId);
    const key = (cat?.attributes || []).find((a) => a.highlight && product.attributes?.[a.key] && product.attributes[a.key] !== "—");
    if (key) return product.attributes[key.key];
    return product.variants?.length ? `${product.variants.length} options` : product.unit;
  }, [product]);

  const add = (e) => {
    e.stopPropagation();
    if (stock.level === "out") return;
    if (product.variants?.length) { onOpen(product.id); return; } // must choose a variant first
    dispatch({ type: "CART_ADD", productId: product.id, variantId: null, qty: product.moq || 1 });
    toast(`${product.name} added to cart`);
  };

  return (
    <div onClick={() => onOpen(product.id)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(product.id)}
      className={`relative rounded-2xl overflow-hidden flex cursor-pointer transition-shadow hover:shadow-[0_6px_24px_rgba(6,63,80,.10)] ${wide ? "flex-row gap-3 p-3" : "flex-col"}`}
      style={{ background: C.white, border: `1px solid ${C.border}` }}>

      <div className={`relative shrink-0 ${wide ? "w-24 h-24 rounded-xl overflow-hidden" : "w-full"}`} style={{ height: wide ? 96 : 116 }}>
        <ProductArt product={product} size={wide ? 72 : 92} rounded={false} />
        {!wide && <FavoriteButton active={isFav} onClick={() => {
          if (!session.signedIn) { toast("Sign in to save favorites"); return; }
          commerce.toggleWishlist(product.id).catch((err) => toast(err.message || "Couldn't update favorites", "danger"));
        }} size={30} />}
        {discountPct > 0 && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold" style={{ background: TONE.danger, color: "#fff" }}>
            {discountPct}% OFF
          </span>
        )}
      </div>

      <div className={`flex-1 min-w-0 flex flex-col ${wide ? "" : "p-3 pt-2.5"}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: brand.fg }}>{brand.name}</span>
          {rx && <ShieldCheck size={11} style={{ color: TONE.info }} />}
        </div>

        <p className="font-bold text-[13px] md:text-sm leading-snug line-clamp-2" style={{ color: C.navy }}>{product.name}</p>

        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-[11px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: C.mint, color: C.primary }}>{highlight}</span>
          <Rating value={product.rating} reviews={wide ? product.reviews : null} size={11} />
        </div>

        {wide && <p className="text-xs mt-1.5 line-clamp-2 hidden md:block" style={{ color: C.muted }}>{product.description}</p>}

        <div className="mt-auto pt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-extrabold text-[15px]" style={{ color: C.navy }}>{fmt(price)}</span>
              {mrp > price && <span className="text-[11px] line-through" style={{ color: C.muted }}>{fmt(mrp)}</span>}
            </div>
            <span className="text-[10px] font-bold" style={{ color: stock.level === "out" ? TONE.danger : stock.level === "low" ? TONE.warn : TONE.ok }}>
              {stock.label}
            </span>
          </div>
          <button aria-label={`Add ${product.name} to cart`} onClick={add} disabled={stock.level === "out"}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-90 disabled:opacity-40"
            style={{ background: stock.level === "out" ? "#E7ECEE" : C.primary }}>
            <Plus size={17} color="#fff" />
          </button>
        </div>
      </div>

      {wide && (
        <div className="absolute top-3 right-3">
          <FavoriteButton active={isFav} onClick={() => {
          if (!session.signedIn) { toast("Sign in to save favorites"); return; }
          commerce.toggleWishlist(product.id).catch((err) => toast(err.message || "Couldn't update favorites", "danger"));
        }} floating={false} size={28} />
        </div>
      )}
    </div>
  );
});

export function ProductGrid({ products, onOpen, cols = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" }) {
  return (
    <div className={`grid ${cols} gap-3 md:gap-4`}>
      {products.map((p) => <ProductCard key={p.id} product={p} onOpen={onOpen} />)}
    </div>
  );
}

export function ProductRail({ products, onOpen }) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-0 pb-1">
      {products.map((p) => (
        <div key={p.id} className="w-[152px] md:w-[196px] shrink-0">
          <ProductCard product={p} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}
