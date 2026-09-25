import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PillButton, Divider } from "../../components/shared/ui.jsx";
import { CheckCircle2, Truck, ShieldCheck, Clock } from "../../components/shared/Icon.jsx";
import { storeById } from "../../data/stores.js";
import { fmt, timeLabel } from "../../utils/format.js";

export default function OrderConfirmed({ nav, params }) {
  const { myOrders: orders } = useApp();
  const C = useC();
  const order = orders.find((o) => o.id === params.orderId) || orders[0];
  if (!order) return null;
  const store = storeById(order.storeId);

  return (
    <Page>
      <div className="px-4 md:px-0 flex flex-col items-center text-center pt-8">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: C.mint }}>
          <CheckCircle2 size={38} style={{ color: C.primary }} />
        </div>
        <h1 className="font-extrabold text-2xl" style={{ color: C.navy }}>Order confirmed</h1>
        <p className="text-sm mt-2 max-w-sm" style={{ color: C.muted }}>
          {store.name} is preparing {order.number}. We'll notify you at every step.
        </p>

        <div className="w-full max-w-md rounded-2xl p-4 mt-6 text-left" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: C.muted }}>Order number</span>
            <span className="font-extrabold text-sm" style={{ color: C.navy }}>{order.number}</span>
          </div>
          <Divider className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: C.muted }}>Amount paid</span>
            <span className="font-extrabold text-sm" style={{ color: C.navy }}>{fmt(order.totals.total)}</span>
          </div>
          <Divider className="my-3" />
          <div className="flex items-start gap-2.5">
            <Clock size={16} style={{ color: C.primary }} className="mt-0.5" />
            <div>
              <p className="text-sm font-bold" style={{ color: C.navy }}>Arriving by {timeLabel(order.eta)}</p>
              <p className="text-xs" style={{ color: C.muted }}>{order.slot || "We'll text you when the rider sets off"}</p>
            </div>
          </div>
          {order.otpRequired && (
            <>
              <Divider className="my-3" />
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={16} style={{ color: C.primary }} className="mt-0.5" />
                <div>
                  <p className="text-sm font-bold" style={{ color: C.navy }}>Delivery code {order.otp}</p>
                  <p className="text-xs" style={{ color: C.muted }}>Share it with the rider at handover.</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-full max-w-md flex gap-3 mt-6">
          <PillButton variant="outline" className="flex-1" onClick={() => nav("home")}>Keep shopping</PillButton>
          <PillButton className="flex-1" onClick={() => nav("orderDetails", { orderId: order.id })}>
            <Truck size={15} /> Track order
          </PillButton>
        </div>
      </div>
    </Page>
  );
}
