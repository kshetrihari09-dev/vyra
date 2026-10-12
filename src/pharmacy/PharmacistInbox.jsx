import React, { useCallback, useEffect, useRef, useState } from "react";
import { useC } from "../store/AppContext.jsx";
import { Page } from "../customer/layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Badge, InlineNotice, EmptyState, Spinner } from "../components/shared/ui.jsx";
import { WorkspaceSwitcher } from "../workspaces/WorkspaceSwitcher.jsx";
import { MessageCircle, Check, ArrowRight, AlertTriangle, ChevronLeft } from "../components/shared/Icon.jsx";
import { supportApi } from "../services/api/supportApi.js";
import { useSupportThread } from "../support/useSupportThread.js";
import { MAX_MESSAGE_CHARS } from "../support/supportLogic.js";
import { dateTimeLabel, relativeTime, timeLabel } from "../utils/format.js";
import { TONE } from "../theme.js";

const LIST_POLL_MS = 10_000;

export function ConsoleTabs({ section, onChange, unread }) {
  const C = useC();
  const tabs = [{ id: "rx", label: "Prescriptions" }, { id: "messages", label: "Customer messages", badge: unread }];
  return (
    <div className="px-4 md:px-0 mb-3" role="tablist" aria-label="Pharmacist console sections">
      <div className="inline-flex rounded-full p-1" style={{ background: C.mint }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={section === t.id} onClick={() => onChange(t.id)}
            className="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5" style={section === t.id ? { background: C.primary, color: "#fff" } : { color: C.primary }}>
            {t.label}{t.badge > 0 && <span className="px-1.5 rounded-full text-[10px]" style={{ background: TONE.danger, color: "#fff" }}>{t.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Availability is a heartbeat: while this page is open and "online" is on, we re-confirm every minute or so. Close the tab,
 * lose the connection or stop beating and the server drops you offline by itself — customers are never shown a stale "online".
 */
function AvailabilityBar() {
  const C = useC();
  const [state, setState] = useState({ loading: true, available: false, heartbeatSeconds: 60, error: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => { supportApi.availability().then((a) => setState({ loading: false, available: a.available, heartbeatSeconds: a.heartbeatSeconds, error: null })).catch((e) => setState((s) => ({ ...s, loading: false, error: e.message }))); }, []);

  useEffect(() => {
    if (!state.available) return undefined;
    const beat = () => supportApi.setAvailability(true).then(() => setState((s) => ({ ...s, error: null }))).catch((e) => setState((s) => ({ ...s, error: `Connection problem — customers may see you as offline. ${e.message}` })));
    const t = setInterval(beat, state.heartbeatSeconds * 1000);
    return () => clearInterval(t);
  }, [state.available, state.heartbeatSeconds]);

  const toggle = async () => {
    setBusy(true);
    try { const r = await supportApi.setAvailability(!state.available); setState((s) => ({ ...s, available: r.available, error: null })); }
    catch (e) { setState((s) => ({ ...s, error: e.message })); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl p-3 flex items-center gap-3 mb-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: state.available ? TONE.ok : "#9AAAB2" }} aria-hidden="true" />
      <div className="flex-1 min-w-0" role="status">
        <p className="text-sm font-bold" style={{ color: C.navy }}>{state.loading ? "Checking…" : state.available ? "You're online for customer chat" : "You're offline"}</p>
        <p className="text-xs" style={{ color: state.error ? TONE.danger : C.muted }}>{state.error || (state.available ? "You show as online only while this page stays open." : "Go online to receive live chats.")}</p>
      </div>
      <PillButton size="sm" variant={state.available ? "subtle" : "primary"} onClick={toggle} disabled={busy || state.loading}>{state.available ? "Go offline" : "Go online"}</PillButton>
    </div>
  );
}

export default function PharmacistInbox({ nav, sectionTabs, onUnread }) {
  const C = useC();
  const [status, setStatus] = useState("open");
  const [list, setList] = useState({ loading: true, error: null, conversations: [], unreadConversations: 0 });
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try { const r = await supportApi.inbox({ status }); setList({ loading: false, error: null, conversations: r.conversations, unreadConversations: r.unreadConversations }); onUnread?.(r.unreadConversations); }
    catch (e) { setList((l) => ({ ...l, loading: false, error: e.message })); }
  }, [status, onUnread]);

  useEffect(() => {
    setList((l) => ({ ...l, loading: true }));
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, LIST_POLL_MS);   // the list refreshes on its own; open threads are live
    return () => clearInterval(t);
  }, [load]);

  return (
    <Page>
      <PageHeader title="Pharmacist Console" subtitle="Answer customer questions" onBack={() => nav("profile")} right={<WorkspaceSwitcher nav={nav} view="pharmacy" compact />} />
      {sectionTabs}
      <div className="px-4 md:px-0">
        <AvailabilityBar />
        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
          <div className={selected ? "hidden md:block" : ""}>
            <div className="flex gap-2 mb-2" role="tablist" aria-label="Conversation status">
              {["open", "resolved"].map((s) => (
                <button key={s} role="tab" aria-selected={status === s} onClick={() => { setStatus(s); setSelected(null); }} className="px-3 py-1.5 rounded-full text-xs font-bold capitalize"
                  style={status === s ? { background: C.navy, color: "#fff" } : { background: C.white, color: C.navy, border: `1px solid ${C.border}` }}>{s}</button>
              ))}
            </div>
            {list.error && <InlineNotice tone="danger" icon={AlertTriangle}>{list.error}</InlineNotice>}
            {list.loading && <div className="flex justify-center py-10"><Spinner size={22} /></div>}
            {!list.loading && !list.error && list.conversations.length === 0 && <EmptyState icon={MessageCircle} title={status === "open" ? "No open conversations" : "Nothing resolved yet"} message="New customer questions appear here." />}
            <div className="space-y-2">
              {list.conversations.map((c) => (
                <button key={c.id} onClick={() => setSelected(c.id)} className="w-full text-left rounded-2xl p-3" aria-current={selected === c.id}
                  style={{ background: selected === c.id ? C.mint : C.white, border: `1px solid ${selected === c.id ? C.primary + "55" : C.border}` }}>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate flex-1" style={{ color: C.navy }}>{c.customerName}</p>
                    {c.unread > 0 && <Badge tone="danger">{c.unread} new</Badge>}
                    <span className="text-[10px]" style={{ color: C.muted }}>{relativeTime(c.lastMessageAt)}</span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: C.muted }}>{c.lastMessage.sender === "staff" ? "You: " : ""}{c.lastMessage.preview}</p>
                  {c.assignedTo && <p className="text-[10px] mt-1" style={{ color: C.muted }}>With {c.assignedTo.name}</p>}
                </button>
              ))}
            </div>
          </div>

          <div className={selected ? "" : "hidden md:block"}>
            {selected
              ? <Thread key={selected} id={selected} onBack={() => setSelected(null)} onChanged={load} />
              : <div className="hidden md:block"><EmptyState icon={MessageCircle} title="Select a conversation" message="Pick a customer on the left to read and reply." /></div>}
          </div>
        </div>
      </div>
    </Page>
  );
}

function Thread({ id, onBack, onChanged }) {
  const C = useC();
  const api = useRef({
    load: () => supportApi.inboxThread(id),
    history: (before) => supportApi.inboxHistory(id, before),
    streamPath: (after) => `/support/inbox/${id}/stream?after=${after}`,
    send: (body, clientMessageId) => supportApi.reply(id, { body, clientMessageId }),
  }).current;
  const { messages, conversation, hasMore, loading, error, mode, send, retrySend, loadEarlier, refresh } = useSupportThread(`inbox-${id}`, { enabled: true, api, selfRole: "staff" });
  const [text, setText] = useState(""); const [sending, setSending] = useState(false); const [acting, setActing] = useState(false);
  const scroller = useRef(null);

  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);
  const unread = conversation?.unread ?? 0;
  useEffect(() => {   // reading the thread marks it read for the whole pharmacy team
    if (!unread || document.hidden) return;
    supportApi.inboxRead(id).then(() => { refresh(); onChanged?.(); }).catch(() => {});
  }, [unread, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const body = text.trim(); if (!body || sending) return;
    setSending(true); setText("");
    await send(body); setSending(false); onChanged?.();
  };
  const setResolved = async (resolved) => {
    setActing(true);
    try { await (resolved ? supportApi.resolve(id) : supportApi.reopen(id)); refresh(); onChanged?.(); } finally { setActing(false); }
  };
  const resolved = conversation?.status === "resolved";
  const linked = [...new Map(messages.flatMap((m) => [m.refs?.order && [`o${m.refs.order.id}`, `Order ${m.refs.order.number}`], m.refs?.product && [`p${m.refs.product.id}`, m.refs.product.name], m.refs?.prescription && [`r${m.refs.prescription.id}`, `Prescription · ${m.refs.prescription.status}`]].filter(Boolean))).values()];

  return (
    <div className="rounded-2xl p-3 flex flex-col" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={onBack} aria-label="Back to conversations" className="md:hidden w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.mint }}><ChevronLeft size={16} style={{ color: C.navy }} /></button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: C.navy }}>{conversation?.customerName || "Customer"}</p>
          <p className="text-[11px]" style={{ color: C.muted }}>{resolved ? `Resolved ${conversation?.resolvedAt ? dateTimeLabel(conversation.resolvedAt) : ""}` : "Open"}{mode === "polling" ? " · live updates paused" : ""}</p>
        </div>
        <PillButton size="sm" variant={resolved ? "subtle" : "ghost"} onClick={() => setResolved(!resolved)} disabled={acting || loading}>{resolved ? "Reopen" : <><Check size={13} /> Mark resolved</>}</PillButton>
      </div>
      {linked.length > 0 && <div className="flex flex-wrap gap-1.5 mb-2">{linked.map((l) => <Badge key={l} tone="info">{l}</Badge>)}</div>}
      {error && <InlineNotice tone="danger" icon={AlertTriangle}>{error}</InlineNotice>}

      <div ref={scroller} role="log" aria-live="polite" aria-label="Conversation" className="space-y-2 overflow-y-auto rounded-xl p-2" style={{ background: C.bg, minHeight: 220, maxHeight: "48vh" }}>
        {loading && <div className="flex justify-center py-8"><Spinner size={20} /></div>}
        {hasMore && <button onClick={loadEarlier} className="block mx-auto text-xs font-bold underline" style={{ color: C.primary }}>Load earlier messages</button>}
        {messages.map((m) => {
          const mine = m.sender === "staff"; const failed = m.localState === "failed";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                <p className={`text-[11px] font-bold mb-0.5 ${mine ? "text-right" : ""}`} style={{ color: C.muted }}>{mine ? (m.senderName || "You") : m.senderName}{m.via === "form" ? " · via email form" : ""}</p>
                <div className="rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words" style={mine ? { background: failed ? TONE.dangerBg : C.primary, color: failed ? TONE.danger : "#fff", opacity: m.localState === "sending" ? 0.7 : 1 } : { background: C.white, color: C.navy, border: `1px solid ${C.border}` }}>{m.body}</div>
                <p className={`text-[10px] mt-0.5 ${mine ? "text-right" : ""}`} style={{ color: failed ? TONE.danger : C.muted }}>
                  {m.localState === "sending" ? "Sending…" : failed ? <>Not sent · <button className="font-bold underline" onClick={() => retrySend(m.id)}>Retry</button></> : timeLabel(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-end gap-2 mt-2">
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE_CHARS))} rows={2} aria-label="Reply to the customer" placeholder="Write a reply…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          className="flex-1 rounded-2xl p-3 text-sm outline-none resize-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
        <button onClick={submit} disabled={!text.trim() || sending} aria-label="Send reply" className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50" style={{ background: C.primary, color: "#fff" }}><ArrowRight size={18} /></button>
      </div>
      <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>Replies are attributed to you by name. Don't paste more patient detail than needed.</p>
    </div>
  );
}
