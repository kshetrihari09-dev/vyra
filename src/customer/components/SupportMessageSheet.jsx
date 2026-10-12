import React, { useEffect, useRef, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Sheet, PillButton, InlineNotice } from "../../components/shared/ui.jsx";
import { Check, AlertTriangle, Mail } from "../../components/shared/Icon.jsx";
import { supportApi } from "../../services/api/supportApi.js";
import { MAX_MESSAGE_CHARS, formErrorMessage, isBadReference, isUuid, mailtoHref, newClientId, stripRefs } from "../../support/supportLogic.js";

/**
 * The "message a pharmacist / contact support" form. It never says "sent" on its own: success is shown only when the
 * server confirms the email was accepted by the configured provider. On failure the text is kept and Retry re-sends with
 * the SAME request id, so a retry can never create a duplicate.
 */
export default function SupportMessageSheet({ open, onClose, topic, title, contact, refs = {}, onOpenChat, onSignIn }) {
  const C = useC();
  const { session, myOrders, products } = useApp();
  const pharmacist = topic === "pharmacist";
  const capability = contact ? (pharmacist ? contact.email.pharmacy : contact.email.general) : null;

  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState(refs.orderId || "");
  const [phase, setPhase] = useState("idle");            // idle | sending | sent | failed
  const [error, setError] = useState(null);
  const requestId = useRef(newClientId());               // one id per draft: reused by every retry of it
  const inFlight = useRef(false);

  useEffect(() => { if (open) { setPhase("idle"); setError(null); setOrderId(refs.orderId || ""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const orders = (myOrders || []).filter((o) => isUuid(o.id)).slice(0, 15);
  const product = refs.productId ? (products || []).find((p) => p.id === refs.productId) : null;
  const trimmed = message.trim();
  const mailto = mailtoHref(capability?.address, { subject: title, body: trimmed });

  const submit = async () => {
    if (!trimmed || inFlight.current || !capability?.canSend) return;
    inFlight.current = true; setPhase("sending"); setError(null);
    const payload = {
      topic, body: trimmed, clientRequestId: requestId.current,
      orderId: isUuid(orderId) ? orderId : undefined,
      productId: pharmacist && refs.productId ? refs.productId : undefined,
      prescriptionId: pharmacist && isUuid(refs.prescriptionId) ? refs.prescriptionId : undefined,
    };
    try {
      try { await supportApi.submitForm(payload); }
      catch (err) { if (!isBadReference(err)) throw err; await supportApi.submitForm(stripRefs(payload)); }   // a stale link shouldn't block the message
      setPhase("sent"); setMessage(""); requestId.current = newClientId();
    } catch (err) {
      setPhase("failed"); setError(formErrorMessage(err));
    } finally { inFlight.current = false; }
  };

  const footer = !session.signedIn || phase === "sent" || !capability?.canSend ? null : (
    <PillButton full onClick={submit} disabled={!trimmed || phase === "sending"}>
      {phase === "sending" ? "Sending…" : phase === "failed" ? "Retry sending" : "Send by email"}
    </PillButton>
  );

  return (
    <Sheet open={open} onClose={phase === "sending" ? () => {} : onClose} title={title} footer={footer}>
      {pharmacist && (
        <InlineNotice tone="warn" icon={AlertTriangle}>
          Pharmacists answer questions about dosage, interactions and substitutions — this is <b>not an emergency service</b> and isn't a substitute for seeing your doctor. In a medical emergency, contact local emergency services.
        </InlineNotice>
      )}

      {!session.signedIn ? (
        <div className="mt-4 text-center space-y-3">
          <p className="text-sm" style={{ color: C.muted }}>Sign in so we can link your message to your account and send you the reply.</p>
          <PillButton onClick={onSignIn}>Sign in</PillButton>
        </div>
      ) : !contact ? (
        <p className="text-sm mt-4" style={{ color: C.muted }}>Loading…</p>
      ) : !capability?.canSend ? (
        <div className="mt-4 space-y-3">
          <InlineNotice tone="warn" icon={AlertTriangle}>Sending email from the app isn't available right now{capability?.address ? "" : " — no support email address is set up yet"}.</InlineNotice>
          {mailto && <a href={mailto} className="inline-flex items-center gap-2 text-sm font-bold underline" style={{ color: C.primary }}><Mail size={15} /> Open my email app instead</a>}
          {pharmacist && <PillButton variant="subtle" onClick={onOpenChat}>Try live chat</PillButton>}
        </div>
      ) : phase === "sent" ? (
        <div className="mt-4 text-center space-y-3" role="status">
          <span className="w-12 h-12 rounded-full inline-flex items-center justify-center" style={{ background: C.mint }}><Check size={22} style={{ color: C.primary }} /></span>
          <p className="font-bold" style={{ color: C.navy }}>Your message was delivered to {pharmacist ? "the pharmacy" : "our support team"} by email.</p>
          <p className="text-sm" style={{ color: C.muted }}>
            {pharmacist ? "A pharmacist will reply when available — we can't promise a time. Replies appear in Live chat, and you'll get a notification." : "We'll reply to the email address on your account."}
          </p>
          <div className="flex gap-2 justify-center">
            {pharmacist && <PillButton variant="subtle" onClick={onOpenChat}>Open conversation</PillButton>}
            <PillButton onClick={onClose}>Done</PillButton>
          </div>
        </div>
      ) : (
        <>
          {(refs.orderId || product || refs.prescriptionId) && (
            <p className="text-xs mt-3" style={{ color: C.muted }}>
              {[product && `About ${product.name}`, refs.prescriptionId && "Linked to your prescription"].filter(Boolean).join(" · ")}
            </p>
          )}
          {orders.length > 0 && (
            <label className="block mt-3">
              <span className="text-xs font-bold" style={{ color: C.navy }}>Related order (optional)</span>
              <select value={orderId} onChange={(e) => setOrderId(e.target.value)} disabled={phase === "sending"} className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
                <option value="">None</option>
                {orders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
              </select>
            </label>
          )}
          {/* editing after a failure is a NEW request: reusing the old id would resend the OLD stored text */}
          <textarea value={message} onChange={(e) => { setMessage(e.target.value.slice(0, MAX_MESSAGE_CHARS)); if (phase === "failed") { setPhase("idle"); requestId.current = newClientId(); } }} rows={5} disabled={phase === "sending"} aria-label="Your message"
            placeholder={pharmacist ? "Describe your question — include the medicine name and dose. Please don't share more personal details than needed." : "Tell us what happened…"}
            className="w-full mt-3 rounded-2xl p-3 text-sm outline-none resize-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
          <p className="text-[11px] text-right" style={{ color: C.muted }}>{message.length}/{MAX_MESSAGE_CHARS}</p>
          {phase === "failed" && (
            <div className="mt-2 space-y-2" role="alert">
              <InlineNotice tone="danger" icon={AlertTriangle}>{error}</InlineNotice>
              {mailto && <a href={mailto} className="inline-flex items-center gap-2 text-xs font-bold underline" style={{ color: C.primary }}><Mail size={13} /> Or send it from my email app</a>}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
