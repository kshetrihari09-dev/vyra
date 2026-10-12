import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useC } from "../../store/AppContext.jsx";
import { Sheet, InlineNotice, PillButton, Spinner } from "../../components/shared/ui.jsx";
import { Stethoscope, ArrowRight, Check, Clock, AlertTriangle, Mail } from "../../components/shared/Icon.jsx";
import { supportApi } from "../../services/api/supportApi.js";
import { useSupportThread } from "../../support/useSupportThread.js";
import { MAX_MESSAGE_CHARS } from "../../support/supportLogic.js";
import { timeLabel, dateLabel } from "../../utils/format.js";
import { TONE } from "../../theme.js";

const customerApi = {
  load: () => supportApi.chat(),
  history: (before) => supportApi.history(before),
  streamPath: (after, conversation) => (conversation ? `/support/chat/stream?after=${after}` : null),
  send: (body, clientMessageId, refs) => supportApi.send({ body, clientMessageId, ...(refs || {}) }),
};

/** Live chat with a real pharmacist. Nothing here is simulated: every pharmacist message was written by a signed-in pharmacist. */
export default function PharmacistChat({ open, onClose, refs, onEmail }) {
  const C = useC();
  const thread = useSupportThread("customer-chat", { enabled: open, api: customerApi });
  const { messages, conversation, presence, hasMore, loading, error, mode, send, retrySend, loadEarlier } = thread;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const refsPending = useRef(refs);                 // the product/order/prescription this chat was opened about: attached to the FIRST message only
  const scroller = useRef(null); const stick = useRef(true);

  useEffect(() => { refsPending.current = refs; }, [refs, open]);

  const online = !!presence?.available;
  const pharmacist = conversation?.assignedPharmacist || presence?.pharmacists?.[0]?.name || null;
  const resolved = conversation?.status === "resolved";

  // Keep the newest message in view unless the person has scrolled up to read history.
  useLayoutEffect(() => { const el = scroller.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [messages.length, open]);
  const onScroll = () => { const el = scroller.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };

  // Opening the chat (or a pharmacist reply arriving while it is open and visible) marks the thread read.
  const unread = conversation?.unread ?? 0;
  useEffect(() => {
    if (!open || !unread || document.hidden) return;
    supportApi.markRead().then(() => thread.refresh()).catch(() => {});
  }, [open, unread, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const body = text.trim();
    if (!body || sending || !online) return;
    setSending(true); stick.current = true;
    const attach = refsPending.current;
    setText("");
    const ok = await send(body, attach);
    if (ok) refsPending.current = undefined;
    setSending(false);
  };
  const onKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } };

  const days = useMemo(() => messages.map((m, i) => ({ m, newDay: i === 0 || dateLabel(messages[i - 1].createdAt) !== dateLabel(m.createdAt) })), [messages]);
  const statusDot = online ? TONE.ok : "#9AAAB2";

  return (
    <Sheet open={open} onClose={onClose} title="Pharmacist chat"
      footer={(
        <div>
          <div className="flex items-end gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE_CHARS))} onKeyDown={onKeyDown} rows={2}
              disabled={!online} aria-label="Message to the pharmacist" maxLength={MAX_MESSAGE_CHARS}
              placeholder={online ? "Write a message — include the medicine name and dose" : "No pharmacist is online — email one instead"}
              className="flex-1 rounded-2xl p-3 text-sm outline-none resize-none disabled:opacity-60"
              style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
            <button onClick={submit} disabled={!online || sending || !text.trim()} aria-label="Send message"
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50" style={{ background: C.primary, color: "#fff" }}>
              {sending ? <Spinner size={16} /> : <ArrowRight size={18} />}
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: C.muted }}>Replies are written by pharmacists, never automated. Enter sends · Shift+Enter for a new line.</p>
        </div>
      )}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.mint }}><Stethoscope size={18} style={{ color: C.primary }} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate" style={{ color: C.navy }}>{pharmacist || "Vyra pharmacists"}</p>
            <p className="text-xs flex items-center gap-1.5" style={{ color: C.muted }} role="status">
              <span className="w-2 h-2 rounded-full" style={{ background: statusDot }} aria-hidden="true" />
              {loading ? "Checking…" : online ? "Online now" : "Offline"}
              {mode === "polling" && !loading && <span>· live updates paused, refreshing every few seconds</span>}
              {mode === "connecting" && !loading && <span>· connecting…</span>}
            </p>
          </div>
        </div>

        <InlineNotice tone="warn" icon={AlertTriangle}>
          This chat is <b>not an emergency service</b> and a pharmacist can't promise an immediate reply. In a medical emergency, contact your local emergency services right away.
        </InlineNotice>

        {!loading && !online && (
          <div className="rounded-2xl p-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="text-sm font-semibold" style={{ color: C.navy }}>No pharmacist is online right now.</p>
            <p className="text-xs mt-0.5 mb-2" style={{ color: C.muted }}>You can still read this conversation. To reach someone, send an email message — a pharmacist will see it in their inbox.</p>
            <PillButton size="sm" onClick={onEmail}><Mail size={14} /> Email a pharmacist</PillButton>
          </div>
        )}
        {resolved && <InlineNotice tone="info" icon={Check}>A pharmacist marked this conversation as resolved. Sending a new message will reopen it.</InlineNotice>}
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}

        <div ref={scroller} onScroll={onScroll} role="log" aria-live="polite" aria-label="Conversation with the pharmacist"
          className="rounded-2xl p-3 space-y-2 overflow-y-auto" style={{ background: C.white, border: `1px solid ${C.border}`, minHeight: 180, maxHeight: "38vh" }}>
          {loading && <div className="flex justify-center py-8"><Spinner size={22} /></div>}
          {!loading && hasMore && <button onClick={loadEarlier} className="block mx-auto text-xs font-bold underline" style={{ color: C.primary }}>Load earlier messages</button>}
          {!loading && messages.length === 0 && <p className="text-sm text-center py-8" style={{ color: C.muted }}>No messages yet. {online ? "Say hello — a pharmacist is online." : ""}</p>}
          {days.map(({ m, newDay }) => (
            <React.Fragment key={m.id}>
              {newDay && <p className="text-center text-[10px] font-bold uppercase tracking-wide pt-1" style={{ color: C.muted }}>{dateLabel(m.createdAt)}</p>}
              <Bubble m={m} C={C} onRetry={() => retrySend(m.id)} />
            </React.Fragment>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function Bubble({ m, C, onRetry }) {
  const mine = m.sender === "customer";
  const failed = m.localState === "failed"; const pending = m.localState === "sending";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%]">
        {!mine && <p className="text-[11px] font-bold mb-0.5" style={{ color: C.muted }}>{m.senderName || "Pharmacist"}</p>}
        <div className="rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words"
          style={mine ? { background: failed ? TONE.dangerBg : C.primary, color: failed ? TONE.danger : "#fff", opacity: pending ? 0.7 : 1 } : { background: C.mint, color: C.navy }}>
          {m.body}
        </div>
        <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${mine ? "justify-end" : ""}`} style={{ color: failed ? TONE.danger : C.muted }}>
          {pending && <><Clock size={10} /> Sending…</>}
          {failed && <>Not sent · <button onClick={onRetry} className="font-bold underline">Retry</button></>}
          {!pending && !failed && <>{timeLabel(m.createdAt)}{m.via === "form" && " · sent by email"}{m.email?.status === "failed" && " · email not delivered"}</>}
        </p>
        {(m.refs?.order || m.refs?.product || m.refs?.prescription) && (
          <p className={`text-[10px] ${mine ? "text-right" : ""}`} style={{ color: C.muted }}>
            {[m.refs.order && `Order ${m.refs.order.number}`, m.refs.product && m.refs.product.name, m.refs.prescription && "Prescription attached"].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
