import React from "react";
import { useC } from "../../store/AppContext.jsx";
import { MapPin, Pencil, Trash2, Check } from "../../components/shared/Icon.jsx";
import { TONE } from "../../theme.js";
import { provinceName, districtName, municipalityName } from "../../data/locations.js";

export function AddressCard({ address, selectable, selected, onSelect, onEdit, onRemove, onMakeDefault }) {
  const C = useC();
  const hasNepalFields = address.provinceId && address.districtId && address.municipalityId;
  const locationLine = hasNepalFields
    ? `${municipalityName(address.districtId, address.municipalityId)}, Ward ${address.ward} · ${districtName(address.provinceId, address.districtId)}, ${provinceName(address.provinceId)}`
    : `${address.city || ""} ${address.zip || ""}`.trim();
  return (
    <div onClick={selectable ? () => onSelect(address.id) : undefined}
      className={`rounded-2xl p-4 flex gap-3 ${selectable ? "cursor-pointer" : ""}`}
      style={{ background: C.white, border: `1.5px solid ${selected ? C.primary : C.border}` }}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
        <MapPin size={17} style={{ color: C.primary }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm" style={{ color: C.navy }}>{address.label}</span>
          {address.isDefault && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: C.mint, color: C.primary }}>Default</span>}
        </div>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>
          {address.name} · {address.line1}{address.line2 ? `, ${address.line2}` : ""}{locationLine ? `, ${locationLine}` : ""}
        </p>
        {address.landmark && <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>Landmark: {address.landmark}</p>}
        <p className="text-xs mt-0.5" style={{ color: C.muted }}>{address.phone}</p>
        {address.instructions && <p className="text-[11px] mt-1 italic" style={{ color: C.muted }}>“{address.instructions}”</p>}

        {(onEdit || onRemove || onMakeDefault) && (
          <div className="flex gap-3 mt-2.5">
            {onEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(address); }} className="text-[11px] font-bold flex items-center gap-1" style={{ color: C.primary }}><Pencil size={11} /> Edit</button>}
            {onMakeDefault && !address.isDefault && <button onClick={(e) => { e.stopPropagation(); onMakeDefault(address.id); }} className="text-[11px] font-bold" style={{ color: C.primary }}>Set default</button>}
            {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(address.id); }} className="text-[11px] font-bold flex items-center gap-1" style={{ color: TONE.danger }}><Trash2 size={11} /> Remove</button>}
          </div>
        )}
      </div>
      {selectable && (
        <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center self-center"
          style={{ background: selected ? C.primary : "transparent", border: `2px solid ${selected ? C.primary : C.border}` }}>
          {selected && <Check size={11} color="#fff" />}
        </span>
      )}
    </div>
  );
}
