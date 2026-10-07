import React, { useMemo, useState } from "react";
import { useC } from "../store/AppContext.jsx";
import { Page } from "../customer/layout/CustomerLayout.jsx";
import { PageHeader, PillButton, InlineNotice } from "../components/shared/ui.jsx";
import { Check, MapPin, Navigation, Package, Phone } from "../components/shared/Icon.jsx";
import { TrackingMap, MapUnavailable } from "../tracking/TrackingMap.jsx";
import { useGeocode } from "../tracking/useGeocode.js";
import { directionsUrl, distanceKm, formatKm } from "../tracking/format.js";
import { storeById } from "../data/stores.js";
import { timeLabel } from "../utils/format.js";
import { TONE } from "../theme.js";
import { RUN_STEPS, completedSteps, currentTarget, nextAction } from "./runFlow.js";

const hasPoint = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/**
 * The rider's active-delivery screen: map with the store, the customer and the rider's own position, the route to the next
 * stop, and ONE primary button for the next action. All state comes from the delivery the server returned; the actions go
 * through the same /rider/* endpoints as the list view.
 */
export default function ActiveDelivery({ d, pos, busy, locationIssue, onRetryLocation, onAction, onClose, onFail, onDecline }) {
  const C = useC();
  const [route, setRoute] = useState(null);
  const a = d.order.shipTo || {};
  const address = [a.line1, a.line2, a.city, a.zip].filter(Boolean).join(", ");
  const target = currentTarget(d);
  const store = storeById(d.order.storeId);

  const pickup = hasPoint(d.pickup) ? d.pickup : null;
  const guess = useGeocode(address, { enabled: !hasPoint(d.destination) && !!address, near: pickup });
  const destination = hasPoint(d.destination) ? d.destination : guess;
  const approximate = !hasPoint(d.destination) && !!guess;
  const me = hasPoint(pos) ? pos : null;

  const next = nextAction(d);
  const done = completedSteps(d);
  const dest = target === "store" ? pickup : destination;
  const straight = useMemo(() => (me && dest ? distanceKm(me, dest) : null), [me?.lat, me?.lng, dest?.lat, dest?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const distanceText = route?.distanceM != null ? formatKm(route.distanceM / 1000) : straight != null ? `${formatKm(straight)} away` : "";
  const driveMin = route?.durationS != null ? Math.max(1, Math.round(route.durationS / 60)) : null;

  const actions = (
    <div className="flex gap-2">
      {d.status === "assigned" && <PillButton variant="subtle" disabled={busy} onClick={onDecline}>Decline</PillButton>}
      {d.status === "accepted" && <PillButton variant="subtle" disabled={busy} onClick={onDecline}>Give back</PillButton>}
      {d.status === "picked_up" && <PillButton variant="subtle" disabled={busy} onClick={onFail}>Couldn't deliver</PillButton>}
      {next && (
        <PillButton className="flex-1" disabled={busy} onClick={() => onAction(next.id)} aria-label={next.label}>
          {busy ? "Please wait…" : <><Check size={15} aria-hidden="true" /> {next.label}</>}
        </PillButton>
      )}
    </div>
  );

  return (
    <Page wide>
      <PageHeader title={d.order.number} subtitle={target === "store" ? `Pick up from ${store?.name ?? "the store"}` : `Deliver to ${a.name || "the customer"}`} onBack={onClose} />
      <div className="md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] md:gap-6 md:items-start pb-28 md:pb-0">
        <div className="px-4 md:px-0 min-w-0 md:sticky md:top-20">
          {pickup || destination ? (
            <div className="relative rounded-3xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              <TrackingMap className="h-[44vh] min-h-[280px] md:h-[calc(100vh-190px)] md:min-h-[460px] md:max-h-[640px]"
                pickup={pickup} destination={destination} rider={me} phase={target === "store" ? "to_pickup" : "to_customer"} onRoute={setRoute} navigation />
              {approximate && <span className="absolute left-3 top-3 z-10 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white shadow" style={{ color: C.navy }}>Approximate delivery pin</span>}
            </div>
          ) : (
            <MapUnavailable className="rounded-3xl h-48" reason="This branch or address has no map location yet. Use the address below to navigate." />
          )}
        </div>

        <div className="px-4 md:px-0 mt-4 md:mt-0 space-y-3 min-w-0">
          {locationIssue && (
            <InlineNotice tone="warn" icon={MapPin}>
              {locationIssue === "denied"
                ? "Location is blocked, so the customer can't see you on the map. Allow location for this site in your browser settings, then tap Try again."
                : "Can't get a GPS fix right now. Make sure location services are on."}
              {" "}<button type="button" className="underline font-bold" onClick={onRetryLocation}>Try again</button>
            </InlineNotice>
          )}

          <div className="rounded-3xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>{target === "store" ? "Next stop · Store" : "Next stop · Customer"}</p>
            <p className="font-extrabold text-lg mt-0.5" style={{ color: C.navy }}>{target === "store" ? store?.name ?? "Store" : a.name || "Customer"}</p>
            {target === "customer" && address && <p className="text-sm mt-1" style={{ color: C.navy }}>{address}</p>}
            {target === "customer" && a.instructions && <p className="text-xs italic mt-1" style={{ color: C.muted }}>“{a.instructions}”</p>}
            {(distanceText || driveMin) && <p className="text-xs mt-2 font-semibold" style={{ color: C.primary }}>{[distanceText, driveMin ? `about ${driveMin} min by road` : ""].filter(Boolean).join(" · ")}</p>}
            {d.estimatedArrival && <p className="text-[11px] mt-1" style={{ color: C.muted }}>Customer expects delivery by {timeLabel(d.estimatedArrival)}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {dest && <a href={directionsUrl(dest, me)} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5" style={{ background: C.mint, color: C.primary }}><Navigation size={13} aria-hidden="true" /> Navigate</a>}
              {!dest && target === "customer" && address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5" style={{ background: C.mint, color: C.primary }}><Navigation size={13} aria-hidden="true" /> Navigate</a>}
              {a.phone && ["accepted", "picked_up"].includes(d.status) && <a href={`tel:${a.phone}`} aria-label={`Call ${a.name || "customer"}`} className="px-3.5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5" style={{ background: C.mint, color: C.primary }}><Phone size={13} aria-hidden="true" /> Call</a>}
            </div>
          </div>

          <div className="rounded-3xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <ol className="space-y-2.5" aria-label="Delivery steps">
              {RUN_STEPS.map((s, i) => {
                const isDone = i < done; const isNext = i === done && !!next;
                return (
                  <li key={s.id} className="flex items-center gap-3" aria-current={isNext ? "step" : undefined}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: isDone || isNext ? C.primary : C.white, border: `2px solid ${isDone || isNext ? C.primary : C.border}` }}>
                      {isDone ? <Check size={13} color="#fff" aria-hidden="true" /> : isNext ? <span className="w-2 h-2 rounded-full bg-white" /> : null}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: isDone || isNext ? C.navy : C.muted }}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="rounded-3xl p-3 flex items-center gap-2.5 text-xs" style={{ background: C.mint, color: C.navy }}>
            <Package size={14} style={{ color: C.primary }} aria-hidden="true" />
            <span>{d.order.itemCount} items · {d.order.collectCash ? "Collect cash on delivery" : "Prepaid"}{d.order.otpRequired ? " · ask for the customer's code at the door" : ""}</span>
          </div>

          <div className="hidden md:block">{actions}</div>
        </div>
      </div>

      <div className="md:hidden fixed left-0 right-0 bottom-[68px] z-30 px-3 py-2.5" style={{ background: C.white, borderTop: `1px solid ${C.border}` }}>{actions}</div>
    </Page>
  );
}
