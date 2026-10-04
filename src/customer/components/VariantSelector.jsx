import React, { useMemo } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { stockFor } from "../../utils/inventory.js";
import { priceOf } from "../../utils/pricing.js";
import { fmt } from "../../utils/format.js";

/**
 * Renders one row of choices per option key present on the variants
 * (size, colour, storage, weight, flavour, pack size...). Nothing is hardcoded — the keys
 * come from the data, so a new category's variants render themselves.
 * Each choice is a selectable card: label, selling price, MRP (struck through) and discount.
 */
export function VariantSelector({ product, selectedId, onSelect }) {
  const { storeId } = useApp();
  const C = useC();
  const variants = product.variants || [];

  const optionKeys = useMemo(() => {
    const keys = new Set();
    variants.forEach((v) => Object.keys(v.options || {}).forEach((k) => keys.add(k)));
    return [...keys].filter((k) => k !== "color" || variants.some((v) => !String(v.options.color).startsWith("#")));
  }, [variants]);

  if (!variants.length) return null;

  /* Single option key -> "Select Size". Multiple keys -> a generic prompt. */
  const single = optionKeys.length <= 1;
  const label = (k) => ({ size: "Size", color: "Colour", storage: "Storage", weight: "Weight", flavour: "Flavour", fragrance: "Fragrance", packSize: "Pack", capacity: "Capacity", shade: "Shade" }[k] || k);

  return (
    <div role="radiogroup" aria-label="Choose an option">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-bold" style={{ color: C.navy }}>
          {single && optionKeys[0] ? `Select ${label(optionKeys[0])}` : "Choose an option"}
        </span>
        <span className="text-[11px]" style={{ color: C.muted }}>{variants.length} available</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const qty = stockFor(product, v.id, storeId);
          const out = qty <= 0;
          const active = v.id === selectedId;
          const swatch = v.options?.color?.startsWith?.("#") ? v.options.color : null;
          const { price, mrp, discountPct } = priceOf(product, v.id);
          return (
            <button key={v.id} type="button" role="radio" aria-checked={active} disabled={out}
              onClick={() => !out && onSelect(v.id)}
              className="pdp-opt relative text-left rounded-xl px-3.5 py-2 min-w-[92px] max-w-full"
              style={{ background: active ? undefined : C.white, color: C.navy, opacity: out ? 0.55 : 1, cursor: out ? "not-allowed" : "pointer" }}>
              <span className="flex items-center gap-1.5 text-[13px] font-bold" style={{ textDecoration: out ? "line-through" : "none" }}>
                {swatch && <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: swatch, border: "1px solid rgba(0,0,0,.12)" }} />}
                <span className="truncate">{v.label}</span>
              </span>
              <span className="flex items-baseline flex-wrap gap-x-1.5 mt-0.5">
                <span className="text-xs font-bold" style={{ color: active ? C.primary : C.navy }}>{fmt(price)}</span>
                {mrp > price && <span className="text-[10px] line-through" style={{ color: C.muted }}>{fmt(mrp)}</span>}
              </span>
              {out
                ? <span className="block text-[10px] font-semibold mt-0.5" style={{ color: C.muted }}>Out of stock</span>
                : discountPct > 0 && <span className="block text-[10px] font-bold mt-0.5" style={{ color: C.primary }}>{discountPct}% off</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
