import React from "react";
import { useC } from "../../store/AppContext.jsx";
import { Check } from "./Icon.jsx";

/** Clickable step indicator — a completed step can always be revisited without
    losing entered data, since the wizard keeps one object across all steps. */
export function Stepper({ steps, activeIndex, furthestIndex, onSelect }) {
  const C = useC();
  return (
    <div className="flex items-center overflow-x-auto no-scrollbar px-1 pb-1">
      {steps.map((label, i) => {
        const done = i < activeIndex || i < furthestIndex;
        const active = i === activeIndex;
        const reachable = i <= Math.max(furthestIndex, activeIndex);
        return (
          <React.Fragment key={label}>
            <button onClick={() => reachable && onSelect(i)} disabled={!reachable}
              className="flex flex-col items-center gap-1 shrink-0 px-1" aria-current={active ? "step" : undefined}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: active ? C.primary : done ? C.mint : C.white,
                  color: active ? "#fff" : done ? C.primary : C.muted,
                  border: `1.5px solid ${active ? C.primary : done ? C.primary : C.border}`,
                }}>
                {done && !active ? <Check size={14} /> : i + 1}
              </span>
              <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: active ? C.navy : C.muted }}>{label}</span>
            </button>
            {i < steps.length - 1 && <span className="w-6 md:w-10 h-[2px] mx-0.5 mb-4 rounded shrink-0" style={{ background: i < Math.max(furthestIndex, activeIndex) ? C.primary : C.border }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
