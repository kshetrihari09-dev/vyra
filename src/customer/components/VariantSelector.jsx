import React, { useMemo } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { stockFor } from "../../utils/inventory.js";
import { fmt } from "../../utils/format.js";

/**
 * Renders one row of choices per option key present on the variants
 * (size, colour, storage, weight, flavour...). Nothing is hardcoded — the keys
 * come from the data, so a new category's variants render themselves.
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

  /* Single option key -> chips. Multiple keys -> labelled combination list. */
  const single = optionKeys.length <= 1;
  const label = (k) => ({ size: "Size", color: "Colour", storage: "Storage", weight: "Weight", flavour: "Flavour", fragrance: "Fragrance", packSize: "Pack", capacity: "Capacity", shade: "Shade" }[k] || k);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>
          {single && optionKeys[0] ? label(optionKeys[0]) : "Choose an option"}
        </span>
        <span className="text-[11px]" style={{ color: C.muted }}>{variants.length} available</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const qty = stockFor(product, v.id, storeId);
          const out = qty <= 0;
          const active = v.id === selectedId;
          const swatch = v.options?.color?.startsWith?.("#") ? v.options.color : null;
          return (
            <button key={v.id} onClick={() => !out && onSelect(v.id)} disabled={out}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors relative"
              style={{
                background: active ? C.mint : C.white,
                border: `1.5px solid ${active ? C.primary : C.border}`,
                color: out ? C.muted : C.navy,
                opacity: out ? 0.55 : 1,
                textDecoration: out ? "line-through" : "none",
              }}>
              {swatch && <span className="w-3.5 h-3.5 rounded-full" style={{ background: swatch, border: "1px solid rgba(0,0,0,.12)" }} />}
              <span>{v.label}</span>
              <span className="font-semibold" style={{ color: C.muted }}>{fmt(v.salePrice ?? v.price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
