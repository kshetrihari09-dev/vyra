import React from "react";
import { Sheet, Badge, InlineNotice } from "../components/shared/ui.jsx";
import { AlertTriangle } from "../components/shared/Icon.jsx";
import { stockFor } from "../utils/inventory.js";
import { priceOf } from "../utils/pricing.js";
import { fmt } from "../utils/format.js";
import { OPS } from "./posTheme.js";

/** A product with variants (sizes, packs…) is sold by variant: stock and price live on each one. */
export function VariantSheet({ product, store, onPick, onClose }) {
  const variants = product.variants || [];
  const anyStock = variants.some((v) => stockFor(product, v.id, store) > 0);
  return (
    <Sheet open onClose={onClose} title={`Choose an option — ${product.name}`}>
      <div className="space-y-2">
        {variants.map((v) => {
          const qty = stockFor(product, v.id, store); const { price } = priceOf(product, v.id);
          return (
            <button key={v.id} disabled={qty <= 0} onClick={() => onPick(v.id)} className="w-full text-left rounded-lg p-3 flex items-center gap-3 disabled:opacity-45"
              style={{ background: OPS.surface, border: `1.5px solid ${OPS.line}` }}>
              <div className="flex-1 min-w-0"><p className="text-sm font-bold" style={{ color: OPS.ink }}>{v.label}</p></div>
              <span className="text-sm font-bold" style={{ color: OPS.ink }}>{fmt(price)}</span>
              <Badge tone={qty === 0 ? "danger" : qty <= 10 ? "warn" : "ok"}>{qty === 0 ? "Out" : `${qty} left`}</Badge>
            </button>
          );
        })}
        {!anyStock && <InlineNotice tone="danger" icon={AlertTriangle}>None of the options is in stock at this store.</InlineNotice>}
      </div>
    </Sheet>
  );
}
