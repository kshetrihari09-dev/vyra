import React from "react";
import { useC } from "../../store/AppContext.jsx";
import { resolveCategory } from "../../data/categories.js";

/**
 * Specification table driven entirely by the category's attribute schema.
 * A grocery item shows Net Weight / Origin; an electronic shows RAM / Warranty.
 * No component knows which is which.
 */
export function AttributeTable({ product }) {
  const C = useC();
  const cat = resolveCategory(product.categoryId);
  const rows = (cat?.attributes || [])
    .map((a) => ({ label: a.label, value: product.attributes?.[a.key] }))
    .filter((r) => r.value && r.value !== "—");

  if (!rows.length) return null;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-start gap-4 px-4 py-3 text-sm"
          style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
          <span className="w-1/2 md:w-1/3 shrink-0" style={{ color: C.muted }}>{r.label}</span>
          <span className="flex-1 font-semibold" style={{ color: C.navy }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Highlight chips shown near the product title. */
export function AttributeChips({ product }) {
  const C = useC();
  const cat = resolveCategory(product.categoryId);
  const chips = (cat?.attributes || [])
    .filter((a) => a.highlight && product.attributes?.[a.key] && product.attributes[a.key] !== "—")
    .map((a) => product.attributes[a.key]);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c} className="px-2 py-1 rounded-lg text-[11px] font-bold" style={{ background: C.mint, color: C.primary }}>{c}</span>
      ))}
    </div>
  );
}
