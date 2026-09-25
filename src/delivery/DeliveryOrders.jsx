import React, { useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Page } from "../customer/layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Badge, EmptyState, InlineNotice } from "../components/shared/ui.jsx";
import { OtpSheet } from "../customer/pages/OrderDetails.jsx";
import { Bike, MapPin, Phone, ShieldCheck, Package } from "../components/shared/Icon.jsx";
import { ORDER_STAGES, STATUS_STYLE, stageIndex } from "../customer/components/OrderTimeline.jsx";
import { storeById } from "../data/stores.js";
import { fmt, timeLabel } from "../utils/format.js";

/** Delivery staff view: the runs assigned to them and the OTP handover. */
export default function DeliveryOrders({ nav }) {
  const { orders, addresses, dispatch, toast } = useApp();
  const C = useC();
  const [otpFor, setOtpFor] = useState(null);

  const runs = orders.filter((o) => ["packed", "assigned", "out_for_delivery"].includes(o.status));

  const advance = (o) => {
    const next = ORDER_STAGES[stageIndex(o.status) + 1];
    if (!next) return;
    if (next.id === "delivered" && o.otpRequired) { setOtpFor(o); return; }
    const patch = next.id === "assigned" ? { partner: { name: "You", phone: "+1 555 0231", vehicle: "Scooter · MC-4418" } } : {};
    dispatch({ type: "ORDER_ADVANCE", id: o.id, status: next.id, patch });
    toast(`${o.number} → ${next.label}`);
  };

  return (
    <Page>
      <PageHeader title="Delivery App" subtitle={`${runs.length} active run${runs.length === 1 ? "" : "s"}`} onBack={() => nav("profile")} />
      <div className="px-4 md:px-0 space-y-3">
        <InlineNotice tone="info" icon={ShieldCheck}>
          Collect the customer's 4-digit code at the door. An order can only be closed once the code matches.
        </InlineNotice>

        {runs.length === 0 ? (
          <EmptyState icon={Package} title="No active runs" message="Orders appear here once they're packed and assigned." />
        ) : runs.map((o) => {
          const address = addresses.find((a) => a.id === o.addressId) || o.shipTo;
          const next = ORDER_STAGES[stageIndex(o.status) + 1];
          const style = STATUS_STYLE[o.status];
          return (
            <div key={o.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                  <Bike size={17} style={{ color: C.primary }} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{ color: C.navy }}>{o.number}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>
                    {o.items.length} items · {fmt(o.totals.total)} · {o.paymentMethod === "cod" ? "Collect cash" : "Prepaid"}
                  </p>
                </div>
                <Badge tone={style.tone}>{style.label}</Badge>
              </div>

              <div className="rounded-xl p-3 space-y-2" style={{ background: C.bg }}>
                <div className="flex items-start gap-2">
                  <Package size={13} style={{ color: C.muted }} className="mt-0.5 shrink-0" />
                  <p className="text-xs" style={{ color: C.navy }}>Pick up from {storeById(o.storeId).name}</p>
                </div>
                {address && (
                  <div className="flex items-start gap-2">
                    <MapPin size={13} style={{ color: C.muted }} className="mt-0.5 shrink-0" />
                    <p className="text-xs" style={{ color: C.navy }}>
                      {address.line1}, {address.city} {address.zip}
                      {address.instructions && <span className="block italic mt-0.5" style={{ color: C.muted }}>“{address.instructions}”</span>}
                    </p>
                  </div>
                )}
                {o.eta && (
                  <div className="flex items-start gap-2">
                    <ShieldCheck size={13} style={{ color: C.muted }} className="mt-0.5 shrink-0" />
                    <p className="text-xs" style={{ color: C.navy }}>Due by {timeLabel(o.eta)}{o.otpRequired ? " · OTP required" : ""}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                {address && (
                  <a href={`tel:${address.phone}`} className="px-3 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5" style={{ background: C.mint, color: C.primary }}>
                    <Phone size={13} /> Call
                  </a>
                )}
                {next && (
                  <PillButton size="sm" className="flex-1" onClick={() => advance(o)}>
                    {next.id === "delivered" ? "Complete with OTP" : `Mark ${next.label.toLowerCase()}`}
                  </PillButton>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {otpFor && (
        <OtpSheet open={!!otpFor} onClose={() => setOtpFor(null)} order={otpFor}
          onVerified={() => {
            dispatch({ type: "ORDER_ADVANCE", id: otpFor.id, status: "delivered", patch: { deliveredAt: new Date().toISOString(), otp: null } });
            dispatch({ type: "AUDIT", entry: { actor: "Delivery staff", action: "Delivery verified", detail: `${otpFor.number} closed with OTP` } });
            setOtpFor(null);
            toast("Delivery completed");
          }} />
      )}
    </Page>
  );
}
