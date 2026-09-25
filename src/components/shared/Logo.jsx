import React from "react";
import { useC } from "../../store/AppContext.jsx";
import { Icon } from "./Icon.jsx";

export function Logo({ size = "md", withTagline = true }) {
  const C = useC();
  const big = size === "lg";
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-2xl flex items-center justify-center shrink-0"
        style={{ width: big ? 48 : 36, height: big ? 48 : 36, background: C.primary }}>
        <Icon name="ShoppingBasket" size={big ? 24 : 18} color="#fff" />
      </div>
      <div className="leading-none">
        <p className="font-extrabold tracking-tight" style={{ color: C.navy, fontSize: big ? 24 : 18 }}>
          Vy<span style={{ color: C.primary }}>ra</span>
        </p>
        {withTagline && <p className="text-[10px] mt-1" style={{ color: C.muted }}>Everything you need, delivered</p>}
      </div>
    </div>
  );
}
