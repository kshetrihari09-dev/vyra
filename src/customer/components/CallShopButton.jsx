import React, { useCallback, useEffect, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Phone, MessageCircle } from "../../components/shared/Icon.jsx";
import { callsApi } from "../../services/api/callsApi.js";
import { useCalls } from "../../calls/CallsProvider.jsx";
import { TONE } from "../../theme.js";

const LABEL = {
  online: { text: "Online now", color: TONE.ok },
  busy: { text: "On another call", color: "#9A6B0B" },
  paused: { text: "Not taking calls right now", color: "#71838C" },
  offline: { text: "Offline", color: "#71838C" },
  unavailable: { text: "Calls unavailable", color: "#71838C" },
};

/** "Call shop" for one Vyra Shop. Shows the shop's REAL availability (from its live heartbeat); customers only. */
export default function CallShopButton({ sellerId, shopName, nav }) {
  const C = useC();
  const { session } = useApp();
  const calls = useCalls();
  const [st, setSt] = useState(null);
  const eligible = !!session?.signedIn && !session.isStaff && session.shopOwnerSellerId !== sellerId && !!sellerId;

  const load = useCallback(() => callsApi.shopStatus(sellerId).then(setSt).catch(() => setSt({ state: "unavailable", callable: false, failed: true })), [sellerId]);
  useEffect(() => {
    if (!eligible) return undefined;
    load(); const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [eligible, load]);

  if (!eligible || !calls) return null;
  // Always show the row to a signed-in customer, with the real reason when calling isn't possible (never a silently missing button).
  const reason = !st ? "Checking availability…"
    : st.failed ? "Couldn't check availability. Is the server updated with Vyra Call?"
    : st.state === "unavailable" && st.callsEnabled === false ? (st.message || "Vyra Call is switched off on this server.")
    : st.state === "unavailable" ? (st.message || "This shop can't take calls.")
    : null;
  const label = reason ? { text: reason, color: "#71838C" } : (LABEL[st.state] || LABEL.offline);
  const can = !!st?.callable && !calls.inCall;
  return (
    <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: C.navy }}>Talk to {shopName}</p>
          <p className="text-xs flex items-center gap-1.5" style={{ color: label.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: label.color }} aria-hidden="true" />{label.text}
          </p>
        </div>
        <button type="button" disabled={!can} onClick={() => calls.startCall({ sellerId, shopName })}
          className="rounded-full font-semibold text-sm px-4 py-2.5 inline-flex items-center gap-2 shrink-0"
          style={{ background: can ? C.primary : "#C9D4D8", color: "#fff", opacity: can ? 1 : 0.7, cursor: can ? "pointer" : "not-allowed" }}>
          <Phone size={15} /> Vyra Call
        </button>
      </div>
      {st && !st.callable && st.state !== "unavailable" && nav && (
        <button type="button" onClick={() => nav("support")} className="mt-2 text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: C.primary }}>
          <MessageCircle size={13} /> Message support instead
        </button>
      )}
      <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>Free voice call over the internet. Calls aren't recorded.</p>
    </div>
  );
}
