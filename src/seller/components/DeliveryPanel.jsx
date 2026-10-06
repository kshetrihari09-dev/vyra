import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useS } from "./tokens.js";
import { Btn, Panel, Pill } from "./kit.jsx";
import { Icon } from "../../components/shared/Icon.jsx";
import { useLiveTracking } from "../../tracking/useLiveTracking.js";
import { etaHeadline } from "../../tracking/format.js";
import { deliveryApi } from "../../services/api/deliveryApi.js";
import { timeLabel } from "../../utils/format.js";

/** Statuses during which delivery progress is worth watching live (packed → out for delivery). Final orders just show the result. */
const WATCH = ["packed", "assigned", "out_for_delivery"];

/**
 * Delivery progress for ONE of the shop's orders, live (the same stream the customer uses, but the server gives a shop a
 * narrower view: stage, partner name and ETA — never the partner's position, phone or the customer's pin).
 * The shop can also nudge on-duty partners to collect a packed order.
 */
export default function DeliveryPanel({ row }) {
  const s = useS();
  const { toast, commerce } = useApp();
  const order = row.order;
  const { tracking: t, mode } = useLiveTracking(order.id, { enabled: WATCH.includes(order.status) });
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(null);
  const lastStatus = useRef(order.status);

  // The server moved the order on (a partner picked it up, it was delivered…): refresh the cached order so the rest of the console follows.
  useEffect(() => {
    if (t && t.orderStatus !== lastStatus.current) { lastStatus.current = t.orderStatus; commerce.refreshOrder(order.id).catch(() => {}); }
  }, [t?.orderStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const rider = t?.delivery?.rider ?? null;
  const stage = t?.stage ?? order.delivery?.stage;
  const canRequest = row.soleSeller && order.status === "packed" && !rider;

  const request = async () => {
    if (asking) return;
    setAsking(true);
    try {
      const res = await deliveryApi.requestDelivery(order.id);
      setAsked(res.notified);
      toast(res.notified ? `Notified ${res.notified} delivery partner${res.notified === 1 ? "" : "s"}` : "No delivery partners are on duty right now");
    } catch (err) { toast(err.message || "Couldn't request a delivery partner", "danger"); }
    finally { setAsking(false); }
  };

  if (!stage) return null;
  const headline = t && !t.final ? etaHeadline(t.eta) : null;
  const live = mode === "live";

  return (
    <Panel title="Delivery progress" subtitle={WATCH.includes(order.status) ? undefined : "Final status"}
      actions={WATCH.includes(order.status) && <Pill tone={live ? "ok" : "neutral"} dot={live}>{live ? "Live" : mode === "polling" ? "Updating" : "Connecting"}</Pill>}>
      <p className="text-sm font-semibold" style={{ color: s.text }}>{stage.label}</p>
      <p className="text-xs mt-0.5" style={{ color: s.muted }}>{stage.detail}</p>
      {headline && <p className="text-xs mt-2 inline-flex items-center gap-1.5" style={{ color: s.muted }}><Icon name="Clock" size={12} /> {headline} · by {timeLabel(t.eta.at)}</p>}

      {t?.steps && stage.index >= 0 && (
        <ol className="mt-4 space-y-2" aria-label="Delivery steps">
          {t.steps.map((st) => (
            <li key={st.id} className="flex items-center gap-2.5" aria-current={st.state === "current" ? "step" : undefined}>
              <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center" style={{ background: st.state === "upcoming" ? "transparent" : s.accent, border: `2px solid ${st.state === "upcoming" ? s.line : s.accent}` }}>
                {st.state === "done" && <Icon name="Check" size={10} color="#fff" />}
              </span>
              <span className="text-[13px]" style={{ color: st.state === "upcoming" ? s.muted : s.text, fontWeight: st.state === "current" ? 600 : 400 }}>{st.label}</span>
            </li>
          ))}
        </ol>
      )}

      {rider && (
        <div className="mt-4 pt-3 flex items-center gap-2.5" style={{ borderTop: `1px solid ${s.lineSoft}` }}>
          <Icon name="Bike" size={15} style={{ color: s.muted }} />
          <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: s.text }}>{rider.name}</p>{rider.vehicle && <p className="text-xs truncate" style={{ color: s.muted }}>{rider.vehicle}</p>}</div>
        </div>
      )}

      {canRequest && (
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${s.lineSoft}` }}>
          <Btn variant="primary" onClick={request} disabled={asking} icon="Bike">{asking ? "Requesting…" : asked != null ? "Request again" : "Request delivery"}</Btn>
          <p className="text-xs mt-2" style={{ color: s.muted }}>Notifies delivery partners who are on duty. Packed orders also appear in their queue, and dispatch can assign one directly.</p>
        </div>
      )}
    </Panel>
  );
}
