import React, { useMemo, useRef } from "react";
import { Sheet } from "../components/shared/ui.jsx";
import { CheckCircle2, FileText } from "../components/shared/Icon.jsx";
import { COMPANY, STORES } from "../data/stores.js";
import { fmt } from "../utils/format.js";
import { receiptHtml, printReceipt } from "./receipt.js";
import { OPS } from "./posTheme.js";

/** Shown after every completed sale: the invoice number from the server, a preview of the receipt, and Print. The preview is an isolated
    iframe built from the same HTML that is printed, so the printout is exactly what the cashier sees. */
export function ReceiptSheet({ sale, onClose }) {
  const frame = useRef(null);
  const html = useMemo(() => {
    const store = STORES.find((s) => s.id === sale.storeId);
    return receiptHtml(sale, { name: COMPANY.name, address: store?.address, phone: store?.phone }, fmt);
  }, [sale]);
  return (
    <Sheet open onClose={onClose} title="Sale completed successfully"
      footer={(
        <div className="flex gap-2">
          <button onClick={() => printReceipt({ frame: frame.current })} className="flex-1 rounded-lg py-3 font-bold text-sm flex items-center justify-center gap-2" style={{ background: OPS.surface, color: OPS.blue, border: `1.5px solid ${OPS.blue}` }}>
            <FileText size={15} /> Print receipt
          </button>
          <button onClick={onClose} autoFocus className="flex-1 rounded-lg py-3 font-bold text-sm" style={{ background: OPS.blue, color: "#fff" }}>New sale</button>
        </div>
      )}>
      <div className="flex items-center gap-3 mb-4 rounded-lg p-3" style={{ background: OPS.okBg }}>
        <CheckCircle2 size={22} style={{ color: OPS.ok }} />
        <div><p className="font-bold text-sm" style={{ color: OPS.ok }}>Invoice #{sale.number}</p><p className="text-xs" style={{ color: OPS.sub }}>Total {fmt(sale.totals.total)}{sale.payment.method === "cash" && sale.payment.change > 0 ? ` · Change ${fmt(sale.payment.change)}` : ""}</p></div>
      </div>
      <iframe ref={frame} title={`Receipt ${sale.number}`} srcDoc={html} sandbox="allow-same-origin allow-modals" className="w-full rounded-lg bg-white" style={{ height: 380, border: `1px solid ${OPS.line}` }} />
    </Sheet>
  );
}
