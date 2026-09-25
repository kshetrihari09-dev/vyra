import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { QuantityStepper } from "../../components/shared/ui.jsx";
import { Trash2, Bookmark } from "../../components/shared/Icon.jsx";
import { brandById } from "../../data/brands.js";
import { maxAddable, stockFor } from "../../utils/inventory.js";
import { fmt } from "../../utils/format.js";
import { TONE } from "../../theme.js";

export function CartItem({ line, onOpen, saved = false }) {
  const { dispatch, storeId, toast } = useApp();
  const C = useC();
  const { product, variant, qty, unitPrice, mrp } = line;
  const available = stockFor(product, line.variantId, storeId);
  const cap = maxAddable(product, line.variantId, storeId);
  const over = qty > available;

  return (
    <div className="rounded-2xl p-3 flex gap-3" style={{ background: C.white, border: `1px solid ${over ? TONE.danger : C.border}` }}>
      <button onClick={() => onOpen(product.id)} className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
        <ProductArt product={product} size={58} variantId={line.variantId} rounded={false} />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: brandById(product.brandId).fg }}>{brandById(product.brandId).name}</p>
        <button onClick={() => onOpen(product.id)} className="block text-left w-full">
          <p className="font-bold text-sm leading-snug line-clamp-2" style={{ color: C.navy }}>{product.name}</p>
        </button>
        {variant && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{variant.label}</p>}

        {over && <p className="text-[11px] font-bold mt-1" style={{ color: TONE.danger }}>
          {available === 0 ? "Out of stock at this store" : `Only ${available} left — reduce quantity`}
        </p>}

        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-sm" style={{ color: C.navy }}>{fmt(unitPrice * qty)}</span>
            {mrp > unitPrice && <span className="text-[11px] line-through" style={{ color: C.muted }}>{fmt(mrp * qty)}</span>}
          </div>
          {saved ? (
            <div className="flex gap-2">
              <button onClick={() => dispatch({ type: "CART_MOVE_BACK", key: line.key })}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold" style={{ background: C.mint, color: C.primary }}>Move to cart</button>
              <button aria-label="Remove" onClick={() => dispatch({ type: "SAVED_REMOVE", key: line.key })}
                className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: TONE.dangerBg }}>
                <Trash2 size={13} style={{ color: TONE.danger }} />
              </button>
            </div>
          ) : (
            <QuantityStepper qty={qty} min={0} max={Math.max(cap, 1)}
              onChange={(n) => {
                if (n === 0) { dispatch({ type: "CART_REMOVE", key: line.key }); toast("Removed from cart"); return; }
                if (n > cap) { toast(`Only ${cap} available`, "danger"); return; }
                dispatch({ type: "CART_SET_QTY", key: line.key, qty: n });
              }} size="sm" />
          )}
        </div>

        {!saved && (
          <div className="flex gap-3 mt-2">
            <button onClick={() => { dispatch({ type: "CART_SAVE_LATER", key: line.key }); toast("Saved for later"); }}
              className="text-[11px] font-bold flex items-center gap-1" style={{ color: C.primary }}>
              <Bookmark size={12} /> Save for later
            </button>
            <button onClick={() => { dispatch({ type: "CART_REMOVE", key: line.key }); toast("Removed from cart"); }}
              className="text-[11px] font-bold flex items-center gap-1" style={{ color: TONE.danger }}>
              <Trash2 size={12} /> Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
