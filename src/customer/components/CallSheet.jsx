import React, { useState } from "react";
import { useC } from "../../store/AppContext.jsx";
import { Sheet, PillButton, InlineNotice } from "../../components/shared/ui.jsx";
import { Phone, Copy, Check, AlertTriangle } from "../../components/shared/Icon.jsx";
import { telHref } from "../../support/supportLogic.js";

/** Desktop alternative to a tap-to-call link: shows the real configured number with Copy, plus an "open in phone app" link. */
export default function CallSheet({ open, onClose, phone }) {
  const C = useC();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const href = telHref(phone?.tel);

  const copy = async () => {
    try { await navigator.clipboard.writeText(phone.display); setCopied(true); setCopyFailed(false); setTimeout(() => setCopied(false), 2500); }
    catch { setCopyFailed(true); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Call the pharmacy">
      {!phone || !href ? (
        <InlineNotice tone="warn" icon={AlertTriangle}>Calling isn't available right now — no phone number is configured. Please use live chat or email instead.</InlineNotice>
      ) : (
        <div className="space-y-4">
          <div className="text-center rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>{phone.label}</p>
            <p className="text-2xl font-extrabold mt-1 select-all" style={{ color: C.navy }}>{phone.display}</p>
            {phone.source === "branch" && <p className="text-xs mt-1" style={{ color: C.muted }}>This is the store's line — ask for the pharmacist.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <PillButton variant="subtle" full onClick={copy}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy number</>}</PillButton>
            <a href={href} className="rounded-full font-semibold inline-flex items-center justify-center gap-2 px-5 py-3 text-sm" style={{ background: C.primary, color: "#fff" }}>
              <Phone size={15} /> Open in phone app
            </a>
          </div>
          {copyFailed && <p className="text-xs" style={{ color: C.muted }}>Couldn't copy automatically — select the number above and copy it.</p>}
          <InlineNotice tone="warn" icon={AlertTriangle}>Not an emergency line. In a medical emergency contact your local emergency services.</InlineNotice>
        </div>
      )}
    </Sheet>
  );
}
