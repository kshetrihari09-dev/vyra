import React, { useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Sheet, InlineNotice } from "../../components/shared/ui.jsx";
import { Icon, ChevronRight, MessageCircle, Phone, Mail, Stethoscope } from "../../components/shared/Icon.jsx";
import { storeById } from "../../data/stores.js";

const TOPICS = [
  { id: "order", label: "Order support", sub: "Late, missing or wrong items", icon: "Package" },
  { id: "payment", label: "Payment support", sub: "Charges, refunds and receipts", icon: "CreditCard" },
  { id: "delivery", label: "Delivery support", sub: "Address, rider or OTP problems", icon: "Truck" },
  { id: "product", label: "Product question", sub: "Specs, usage and availability", icon: "Info" },
  { id: "return", label: "Return or refund", sub: "Start a return within 7 days", icon: "RotateCcw" },
  { id: "contact", label: "Contact support", sub: "Chat, phone or email", icon: "Headphones" },
];

export default function Support({ nav, params }) {
  const { myOrders: orders, storeId, toast } = useApp();
  const C = useC();
  const [topic, setTopic] = useState(params.topic || null);
  const [message, setMessage] = useState("");
  const store = storeById(storeId);
  const order = params.orderId ? orders.find((o) => o.id === params.orderId) : null;

  return (
    <Page>
      <PageHeader title="Help & Support" subtitle={order ? `About ${order.number}` : "We usually reply in a few minutes"} onBack={() => nav("profile")} />

      <div className="px-4 md:px-0 space-y-4">
        {/* Pharmacist is a separate, healthcare-only channel */}
        <button onClick={() => setTopic("pharmacist")} className="w-full rounded-2xl p-4 flex items-center gap-3 text-left" style={{ background: C.navy }}>
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.16)" }}>
            <Stethoscope size={19} color="#fff" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-bold text-sm text-white">Talk to a Pharmacist</span>
            <span className="block text-xs text-white/70">
              {store.pharmacistOnDuty ? "On duty now at " + store.name : "Available 8 AM – 10 PM"}
            </span>
          </span>
          <ChevronRight size={18} color="#fff" />
        </button>

        <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          {TOPICS.map((t, i) => (
            <button key={t.id} onClick={() => setTopic(t.id)} className="w-full flex items-center gap-3 p-4 text-left" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                <Icon name={t.icon} size={17} style={{ color: C.primary }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-sm" style={{ color: C.navy }}>{t.label}</span>
                <span className="block text-xs truncate" style={{ color: C.muted }}>{t.sub}</span>
              </span>
              <ChevronRight size={17} style={{ color: C.muted }} />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: MessageCircle, label: "Live chat", detail: "Avg. 2 min" },
            { icon: Phone, label: "Call us", detail: store.phone },
            { icon: Mail, label: "Email", detail: "24 hours" },
          ].map((c) => (
            <button key={c.label} onClick={() => toast(`${c.label} would open here`)} className="rounded-2xl p-3 text-center" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <c.icon size={18} style={{ color: C.primary }} className="mx-auto mb-1.5" />
              <p className="text-xs font-bold" style={{ color: C.navy }}>{c.label}</p>
              <p className="text-[10px]" style={{ color: C.muted }}>{c.detail}</p>
            </button>
          ))}
        </div>
      </div>

      <Sheet open={!!topic} onClose={() => setTopic(null)}
        title={topic === "pharmacist" ? "Talk to a Pharmacist" : TOPICS.find((t) => t.id === topic)?.label || "Support"}
        footer={<PillButton full onClick={() => { setTopic(null); setMessage(""); toast("Message sent — we'll reply shortly"); }} disabled={!message.trim()}>Send message</PillButton>}>
        {topic === "pharmacist" && (
          <InlineNotice tone="info" icon={Stethoscope}>
            Licensed pharmacists answer questions about dosage, interactions and substitutions. This isn't a substitute for seeing your doctor.
          </InlineNotice>
        )}
        {order && <p className="text-sm mt-3" style={{ color: C.muted }}>Linked to order {order.number}.</p>}
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
          placeholder={topic === "pharmacist" ? "Describe your question — include the medicine name and dose." : "Tell us what happened…"}
          className="w-full mt-4 rounded-2xl p-3 text-sm outline-none resize-none"
          style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
      </Sheet>
    </Page>
  );
}
