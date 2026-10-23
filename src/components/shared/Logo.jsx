import React from "react";
import { useC } from "../../store/AppContext.jsx";
import { Icon } from "./Icon.jsx";

export function Logo({ size = "md", withTagline = true, hideTextBelow = false }) {
  const C = useC();
  const big = size === "lg";
  const sm = size === "sm"; // compact: used by the mobile home header
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-2xl flex items-center justify-center shrink-0"
        style={{ width: big ? 48 : sm ? 32 : 36, height: big ? 48 : sm ? 32 : 36, background: C.primary }}>
        <Icon name="ShoppingBasket" size={big ? 24 : sm ? 16 : 18} color="#fff" />
      </div>
      <div className={`leading-none${hideTextBelow ? " hidden min-[340px]:block" : ""}`}>
        <p className="font-extrabold tracking-tight" style={{ color: C.navy, fontSize: big ? 24 : sm ? 17 : 18 }}>
          Vas<span style={{ color: C.primary }}>poor</span>
        </p>
        {withTagline && <p className="text-[10px] mt-1" style={{ color: C.muted }}>Everything you need, delivered</p>}
      </div>
    </div>
  );
}
