import React, { memo } from "react";
import { useC } from "../../store/AppContext.jsx";
import { Icon } from "../../components/shared/Icon.jsx";
import { CategoryArt } from "../../components/shared/ProductArt.jsx";

/** Tile used on Home ("Shop by Category") and the Categories page. */
export const CategoryCard = memo(function CategoryCard({ category, onSelect, variant = "tile", count }) {
  const C = useC();
  if (variant === "chip") {
    return (
      <button onClick={() => onSelect(category.id)} className="flex flex-col items-center gap-2 shrink-0 w-[74px]">
        <span className="w-[62px] h-[62px] rounded-2xl flex items-center justify-center" style={{ background: category.tint }}>
          <Icon name={category.icon} size={24} style={{ color: category.fg }} />
        </span>
        <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: C.navy }}>{category.name}</span>
      </button>
    );
  }
  return (
    <button onClick={() => onSelect(category.id)}
      className="rounded-2xl p-3 md:p-4 flex items-center gap-3 text-left w-full transition-shadow hover:shadow-[0_6px_20px_rgba(6,63,80,.08)]"
      style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <span className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ background: category.tint }}>
        <CategoryArt category={category} size={38} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-sm truncate" style={{ color: C.navy }}>{category.name}</span>
        <span className="block text-xs truncate mt-0.5" style={{ color: C.muted }}>
          {count != null ? `${count} item${count === 1 ? "" : "s"}` : category.description}
        </span>
      </span>
    </button>
  );
});
