import React from "react";
import { useC } from "../../store/AppContext.jsx";
import { Icon } from "../../components/shared/Icon.jsx";
import { timeLabel, dateLabel } from "../../utils/format.js";
import { TONE } from "../../theme.js";

/* The lifecycle vocabulary lives in services/orderStatus.js so the seller
   dashboard and delivery app share it; re-exported here for existing imports. */
import { ORDER_STAGES, STATUS_STYLE, stageIndex } from "../../services/orderStatus.js";
export { ORDER_STAGES, STATUS_STYLE, stageIndex };

export function OrderTimeline({ order }) {
  const C = useC();
  const cancelled = order.status === "cancelled";
  const returned = order.status === "returned";
  const current = stageIndex(order.status);
  const at = (id) => order.history?.find((h) => h.status === id)?.at;

  if (returned) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#EFF3F5" }}>
        <Icon name="RotateCcw" size={18} style={{ color: "#4A5F6B" }} />
        <div>
          <p className="font-bold text-sm" style={{ color: "#4A5F6B" }}>Order returned</p>
          <p className="text-xs" style={{ color: "#4A5F6B", opacity: 0.8 }}>Your refund is processed within 3–5 working days.</p>
        </div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: TONE.dangerBg }}>
        <Icon name="X" size={18} style={{ color: TONE.danger }} />
        <div>
          <p className="font-bold text-sm" style={{ color: TONE.danger }}>Order cancelled</p>
          <p className="text-xs" style={{ color: TONE.danger, opacity: 0.8 }}>Any payment is refunded within 3–5 working days.</p>
        </div>
      </div>
    );
  }

  return (
    <ol className="relative">
      {ORDER_STAGES.map((stage, i) => {
        const done = i <= current;
        const isCurrent = i === current;
        const stamp = at(stage.id);
        return (
          <li key={stage.id} className="flex gap-3 pb-5 last:pb-0 relative">
            {i < ORDER_STAGES.length - 1 && (
              <span className="absolute left-[15px] top-8 bottom-0 w-[2px] rounded" style={{ background: i < current ? C.primary : C.border }} />
            )}
            <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10"
              style={{ background: done ? C.primary : C.white, border: `2px solid ${done ? C.primary : C.border}` }}>
              <Icon name={stage.icon} size={14} style={{ color: done ? "#fff" : C.muted }} />
            </span>
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm" style={{ color: done ? C.navy : C.muted }}>{stage.label}</p>
                {isCurrent && order.status !== "delivered" && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: C.mint, color: C.primary }}>In progress</span>
                )}
              </div>
              {stamp && <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{dateLabel(stamp)} · {timeLabel(stamp)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
