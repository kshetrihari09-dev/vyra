import React, { useEffect, useRef } from "react";
import { Sheet } from "../components/shared/ui.jsx";
import { Banknote, CreditCard, Smartphone, Loader2 } from "../components/shared/Icon.jsx";
import { fmt } from "../utils/format.js";
import { cashChange, quickTenders } from "./posCart.js";
import { OPS } from "./posTheme.js";

const METHODS = [{ id: "cash", label: "Cash", icon: Banknote }, { id: "card", label: "Card", icon: CreditCard }, { id: "upi", label: "UPI", icon: Smartphone }];

/** Take payment. Cash shows what was handed over and the change due (or exactly how short it is); card/UPI are charged the exact total.
    The Complete button is disabled while the sale is being submitted, so it cannot be pressed twice. */
export function PaymentSheet({ open, total, payment, setPayment, received, setReceived, busy, error, onConfirm, onClose }) {
  const cashRef = useRef(null);
  useEffect(() => { if (open && payment === "cash") setTimeout(() => cashRef.current?.focus(), 30); }, [open, payment]);
  const cash = cashChange(total, received);
  const canPay = !busy && (payment !== "cash" || cash.ok);
  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title="Payment"
      footer={(
        <button onClick={onConfirm} disabled={!canPay} className="w-full rounded-lg py-3 font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2" style={{ background: OPS.blue, color: "#fff" }}>
          {busy ? <><Loader2 size={15} className="animate-spin" /> Completing sale…</> : `Complete sale · ${fmt(total)}`}
        </button>
      )}>
      <div className="text-center mb-4">
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: OPS.sub }}>Amount due</p>
        <p className="font-extrabold text-3xl" style={{ color: OPS.ink }}>{fmt(total)}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {METHODS.map((m) => (
          <button key={m.id} onClick={() => setPayment(m.id)} disabled={busy} className="rounded-lg py-2.5 flex flex-col items-center gap-1 text-xs font-bold"
            style={{ background: payment === m.id ? OPS.blueBg : OPS.surface, color: payment === m.id ? OPS.blue : OPS.sub, border: `1.5px solid ${payment === m.id ? OPS.blue : OPS.line}` }}>
            <m.icon size={16} /> {m.label}
          </button>
        ))}
      </div>

      {payment === "cash" ? (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: OPS.sub }} htmlFor="pos-received">Cash received</label>
          <input id="pos-received" ref={cashRef} value={received} inputMode="decimal" disabled={busy} autoComplete="off"
            onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 12))}
            onKeyDown={(e) => { if (e.key === "Enter" && canPay) { e.preventDefault(); onConfirm(); } }}
            className="w-full mt-1 rounded-lg px-3 h-12 text-xl font-bold outline-none" style={{ background: OPS.surface, border: `1.5px solid ${OPS.blue}`, color: OPS.ink }} placeholder="0.00" />
          <div className="flex flex-wrap gap-2 mt-2">
            {quickTenders(total).map((v, i) => (
              <button key={v} onClick={() => setReceived(String(v))} disabled={busy} className="px-3 h-8 rounded-full text-xs font-bold" style={{ background: OPS.bg, color: OPS.ink, border: `1px solid ${OPS.line}` }}>
                {i === 0 ? "Exact" : fmt(v)}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg p-3 flex items-center justify-between" role="status" aria-live="polite"
            style={{ background: received === "" ? OPS.bg : cash.ok ? OPS.okBg : OPS.dangerBg }}>
            {received === "" || cash.received == null ? <span className="text-sm" style={{ color: OPS.sub }}>Enter the amount received</span>
              : cash.ok ? (<><span className="text-sm font-bold" style={{ color: OPS.ok }}>Change to give</span><span className="font-extrabold text-2xl" style={{ color: OPS.ok }}>{fmt(cash.change)}</span></>)
              : (<><span className="text-sm font-bold" style={{ color: OPS.danger }}>Payment amount is insufficient — short by</span><span className="font-extrabold text-lg" style={{ color: OPS.danger }}>{fmt(cash.short)}</span></>)}
          </div>
        </div>
      ) : (
        <p className="text-sm text-center" style={{ color: OPS.sub }}>{payment === "card" ? "Charge the card" : "Collect the UPI payment"} for the exact amount, then complete the sale.</p>
      )}
      {error && <p className="mt-3 text-sm font-semibold" role="alert" style={{ color: OPS.danger }}>{error}</p>}
    </Sheet>
  );
}
