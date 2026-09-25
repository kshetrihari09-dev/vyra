import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Badge } from "../../components/shared/ui.jsx";
import { Icon, CreditCard, Plus, Trash2 } from "../../components/shared/Icon.jsx";
import { PAYMENT_METHODS } from "../../data/stores.js";
import { TONE } from "../../theme.js";

export default function PaymentMethods({ nav }) {
  const { cards, toast } = useApp();
  const C = useC();
  return (
    <Page>
      <PageHeader title="Payment Methods" onBack={() => nav("profile")} />
      <div className="px-4 md:px-0 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>Saved cards</p>
        {cards.map((card) => (
          <div key={card.id} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
              <CreditCard size={18} style={{ color: C.primary }} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm" style={{ color: C.navy }}>{card.brand} •••• {card.last4}</p>
                {card.isDefault && <Badge tone="mint">Default</Badge>}
              </div>
              <p className="text-xs" style={{ color: C.muted }}>Expires {card.expiry}</p>
            </div>
            <button aria-label="Remove card" onClick={() => toast("Card removed")} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: TONE.dangerBg }}>
              <Trash2 size={14} style={{ color: TONE.danger }} />
            </button>
          </div>
        ))}
        <PillButton variant="outline" full onClick={() => toast("Card form would open here")}><Plus size={15} /> Add new card</PillButton>

        <p className="text-xs font-bold uppercase tracking-wide pt-3" style={{ color: C.muted }}>Other methods</p>
        {PAYMENT_METHODS.filter((m) => m.id !== "card").map((m) => (
          <div key={m.id} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
              <Icon name={m.icon} size={18} style={{ color: C.primary }} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: C.navy }}>{m.label}</p>
              <p className="text-xs" style={{ color: C.muted }}>{m.detail}</p>
            </div>
            <Badge tone={m.enabled ? "ok" : "neutral"}>{m.enabled ? "Enabled" : "Off"}</Badge>
          </div>
        ))}
      </div>
    </Page>
  );
}
