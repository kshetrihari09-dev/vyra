import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, InlineNotice } from "../../components/shared/ui.jsx";
import { Phone, Check, Clock, Copy } from "../../components/shared/Icon.jsx";
import { TrackingMap, MapUnavailable } from "../../tracking/TrackingMap.jsx";
import { useLiveTracking } from "../../tracking/useLiveTracking.js";
import { useGeocode } from "../../tracking/useGeocode.js";
import { agoText, etaHeadline, initials, STALE_AFTER_MS } from "../../tracking/format.js";
import { timeLabel } from "../../utils/format.js";
import { TONE } from "../../theme.js";

const hasPoint = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

function Avatar({ name, url, size = 48 }) {
  const C = useC();
  const [broken, setBroken] = useState(false);
  if (url && !broken) return <img src={url} alt={`${name}, your delivery partner`} width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  return <span aria-hidden="true" className="rounded-full flex items-center justify-center font-extrabold shrink-0" style={{ width: size, height: size, background: C.mint, color: C.primary }}>{initials(name)}</span>;
}

function Steps({ steps }) {
  const C = useC();
  return (
    <ol className="space-y-0" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = s.state === "done"; const cur = s.state === "current";
        return (
          <li key={s.id} className="flex gap-3" aria-current={cur ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: done || cur ? C.primary : C.white, border: `2px solid ${done || cur ? C.primary : C.border}`, boxShadow: cur ? `0 0 0 4px ${C.mint}` : "none" }}>
                {done ? <Check size={13} color="#fff" aria-hidden="true" /> : cur ? <span className="w-2 h-2 rounded-full bg-white" /> : null}
              </span>
              {i < steps.length - 1 && <span className="w-0.5 flex-1 min-h-[18px]" style={{ background: done ? C.primary : C.border }} />}
            </div>
            <div className="pb-3.5 -mt-0.5">
              <p className="text-sm font-bold" style={{ color: s.state === "upcoming" ? C.muted : C.navy }}>{s.label}</p>
              <span className="sr-only">{done ? "completed" : cur ? "current step" : "upcoming"}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function TrackOrder({ nav, params }) {
  const { myOrders, commerce } = useApp();
  const C = useC();
  const order = myOrders.find((o) => o.id === params.orderId);
  const { tracking: t, mode, error } = useLiveTracking(params.orderId);
  const [now, setNow] = useState(Date.now());
  const [route, setRoute] = useState(null);

  // Tick for "updated Ns ago" only while there is something live to age.
  useEffect(() => {
    if (mode !== "live" && mode !== "polling") return undefined;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [mode]);

  // Keep the cached order (status chips on lists, the handover code) in step with what the stream just told us.
  const lastStatus = useRef(null);
  useEffect(() => {
    if (!t) return;
    if (lastStatus.current && lastStatus.current !== t.orderStatus) commerce.refreshOrder(params.orderId).catch(() => {});
    lastStatus.current = t.orderStatus;
  }, [t?.orderStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const rider = t?.delivery?.rider ?? null;
  const loc = t?.delivery?.location ?? null;
  const stale = !!loc && now - new Date(loc.updatedAt).getTime() > STALE_AFTER_MS;
  const phase = t?.delivery?.status === "picked_up" ? "to_customer" : "to_pickup";
  const pickup = hasPoint(t?.pickup) ? t.pickup : null;

  // No saved pin on the address? Show an APPROXIMATE one, labelled as such — display only, never persisted.
  const pinMissing = !!t && !t.final && !hasPoint(t.destination);
  const addressText = order ? [order.shipTo?.line1, order.shipTo?.city].filter(Boolean).join(", ") : "";
  const guess = useGeocode(addressText, { enabled: pinMissing, near: pickup });
  const destination = hasPoint(t?.destination) ? t.destination : guess;
  const approximate = !hasPoint(t?.destination) && !!guess;

  const final = !!t?.final;
  const headline = !final && t ? etaHeadline(t.eta) : null;
  const showMap = !!t && !final && (!!pickup || !!destination);
  const photo = rider?.photoUrl;

  const live = useMemo(() => (loc ? { lat: loc.lat, lng: loc.lng } : null), [loc?.lat, loc?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => nav("orderDetails", { orderId: params.orderId });

  if (mode === "unavailable") {
    return (
      <Page><PageHeader title="Track order" onBack={() => nav("orders")} />
        <div className="px-4 md:px-0"><InlineNotice tone="warn">{error || "We couldn't find this order."}</InlineNotice>
          <PillButton className="mt-4" onClick={() => nav("orders")}>Back to my orders</PillButton></div>
      </Page>
    );
  }

  const badge = mode === "live" ? { text: "Live", color: TONE.ok } : mode === "polling" ? { text: "Updating every 10 s", color: TONE.warn } : mode === "connecting" ? { text: "Connecting…", color: C.muted } : null;

  return (
    <Page wide>
      <PageHeader title="Track order" subtitle={t?.orderNumber ? `Order ${t.orderNumber}` : undefined} onBack={back}
        right={!final && badge && (
          <span role="status" className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: C.white, border: `1px solid ${C.border}`, color: badge.color }}>
            <span className={`w-2 h-2 rounded-full ${mode === "live" ? "animate-pulse" : ""}`} style={{ background: badge.color }} aria-hidden="true" />{badge.text}
          </span>
        )} />

      {!t ? (
        <div className="px-4 md:px-0 space-y-3" aria-busy="true" aria-label="Loading tracking">
          <div className="rounded-3xl h-64 animate-pulse" style={{ background: C.mint }} />
          <div className="rounded-3xl h-32 animate-pulse" style={{ background: C.mint }} />
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] md:gap-6 md:items-start">
          {/* ---------------- map ---------------- */}
          <div className="px-4 md:px-0 md:sticky md:top-20 min-w-0">
            {showMap ? (
              <div className="relative rounded-3xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <TrackingMap className="h-[42vh] min-h-[280px] md:h-[calc(100vh-190px)] md:min-h-[460px] md:max-h-[640px]"
                  pickup={pickup} destination={destination} rider={live} phase={phase} staleRider={stale} onRoute={setRoute} />
                {approximate && <span className="absolute left-3 top-3 z-10 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white shadow" style={{ color: C.navy }}>Approximate delivery pin</span>}
                {!live && !final && <span className="absolute left-3 bottom-3 z-10 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white shadow" style={{ color: C.muted }}>Partner location appears once they accept</span>}
              </div>
            ) : (
              <MapUnavailable className="rounded-3xl h-48 md:h-64" reason={final ? "Live tracking has ended for this order." : "The map appears when your order has a pickup and delivery point."} />
            )}
          </div>

          {/* ---------------- status ---------------- */}
          <div className="px-4 md:px-0 mt-4 md:mt-0 space-y-3 min-w-0">
            {final ? (
              <InlineNotice tone={t.stage.id === "delivered" ? "ok" : "danger"}>
                <b>{t.stage.label}.</b> {t.stage.detail}. Live tracking has stopped.
              </InlineNotice>
            ) : (
              <div className="rounded-3xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>{t.stage.label}</p>
                {headline ? (
                  <p className="font-extrabold text-2xl mt-0.5" style={{ color: C.navy }}>{headline}</p>
                ) : (
                  <p className="font-extrabold text-xl mt-0.5" style={{ color: C.navy }}>{t.stage.detail}</p>
                )}
                {headline && (
                  <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: C.muted }}>
                    <Clock size={12} aria-hidden="true" /> by {timeLabel(t.eta.at)} · {t.eta.source === "route" ? "based on the live route" : "estimated"}
                  </p>
                )}
                {headline && <p className="text-sm mt-2" style={{ color: C.navy }}>{t.stage.detail}</p>}
                {route && phase === "to_customer" && <p className="text-xs mt-1" style={{ color: C.muted }}>{(route.distanceM / 1000).toFixed(1)} km to go</p>}
                {loc && (
                  <p className="text-[11px] mt-2" style={{ color: stale ? TONE.warn : C.muted }} aria-live="polite">
                    {stale ? "Location last updated " : "Location updated "}{agoText(loc.updatedAt, now)}{stale ? " — the partner may be in a low-signal area." : ""}
                  </p>
                )}
              </div>
            )}

            {rider && (
              <div className="rounded-3xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                <Avatar name={rider.name} url={photo} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate" style={{ color: C.navy }}>{rider.name}</p>
                  <p className="text-xs truncate" style={{ color: C.muted }}>Your delivery partner{rider.vehicle ? ` · ${rider.vehicle}` : ""}</p>
                </div>
                {rider.phone && (
                  <a href={`tel:${rider.phone}`} aria-label={`Call ${rider.name}`} className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: C.primary, color: "#fff" }}>
                    <Phone size={18} aria-hidden="true" />
                  </a>
                )}
              </div>
            )}

            {!final && order?.otpRequired && order?.otp && t.stage.index >= 2 && (
              <div className="rounded-3xl p-4 flex items-center gap-3" style={{ background: C.mint }}>
                <div className="flex-1">
                  <p className="text-xs font-bold" style={{ color: C.primary }}>Delivery code</p>
                  <p className="font-extrabold text-2xl tracking-[.3em]" style={{ color: C.navy }} aria-label={`Delivery code ${order.otp.split("").join(" ")}`}>{order.otp}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>Share it only when you have your order.</p>
                </div>
                <button type="button" aria-label="Copy delivery code" onClick={() => navigator.clipboard?.writeText(order.otp)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white"><Copy size={16} style={{ color: C.primary }} /></button>
              </div>
            )}

            {t.stage.index >= 0 && (
              <div className="rounded-3xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                <Steps steps={t.steps} />
              </div>
            )}

            {error && mode === "polling" && <InlineNotice tone="warn">Having trouble refreshing — we'll keep trying.</InlineNotice>}
            <PillButton variant="subtle" className="w-full" onClick={back}>View order details</PillButton>
          </div>
        </div>
      )}
    </Page>
  );
}
