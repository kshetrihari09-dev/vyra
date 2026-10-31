import React, { memo } from "react";
import { useC } from "../../store/AppContext.jsx";
import { Icon } from "../../components/shared/Icon.jsx";

/**
 * Compact category button used by Home ("Shop by Category"), the Categories page and the Category sub-navigation.
 *
 * Variants (all share one look: small tinted icon badge · name · optional count):
 *   "tile" (default) — fills its grid cell (desktop / tablet Home grid)
 *   "chip"           — content-sized, for the phone's two-row scroller
 *   "pill"           — slim rounded pill for sub-navigation strips
 *
 * `active` marks the currently selected category (aria-current + filled badge + highlighted border).
 * `count` is optional; omit it (undefined/null) to hide the product count.
 * Colours come from the category (tint / fg) and the active theme; hover/active styling lives in index.css (.vcat).
 */
const BADGE = { tile: 40, chip: 32, pill: 24 };   // icon badge box, px
const GLYPH = { tile: 22, chip: 18, pill: 14 };   // lucide icon size, px — 24–32px badge keeps the glyph small and consistent

export const CategoryCard = memo(function CategoryCard({ category, onSelect, variant = "tile", count, active = false }) {
  const C = useC();
  const hasCount = count != null;
  const countText = hasCount ? `${count} item${count === 1 ? "" : "s"}` : null;
  const box = BADGE[variant] || BADGE.tile;

  const vars = {
    "--vcat-tint": category.tint || C.mint,
    "--vcat-fg": category.fg || C.primary,
    "--vcat-bg": C.white,
    "--vcat-border": C.border,
    "--vcat-text": C.navy,
    "--vcat-muted": C.muted,
  };

  const badge = (
    <span className="vcat-ico shrink-0 flex items-center justify-center" style={{ width: box, height: box, borderRadius: variant === "pill" ? 999 : 12 }}>
      <Icon name={category.icon} size={GLYPH[variant] || GLYPH.tile} strokeWidth={1.9} aria-hidden="true" />
    </span>
  );

  if (variant === "pill") {
    return (
      <button type="button" onClick={() => onSelect(category.id)} aria-current={active ? "true" : undefined}
        className="vcat vcat-pill shrink-0" style={vars}>
        {badge}
        <span className="vcat-name">{category.name}</span>
        {hasCount && <span className="vcat-count">{count}</span>}
      </button>
    );
  }

  return (
    <button type="button" onClick={() => onSelect(category.id)} aria-current={active ? "true" : undefined}
      aria-label={countText ? `${category.name}, ${countText}` : undefined}
      className={`vcat ${variant === "chip" ? "vcat-chip shrink-0" : "vcat-tile w-full"}`} style={vars}>
      {badge}
      <span className="min-w-0 flex-1 text-left">
        <span className="vcat-name block">{category.name}</span>
        {countText && <span className="vcat-count block">{countText}</span>}
      </span>
    </button>
  );
});
