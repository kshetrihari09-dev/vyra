import { useCallback, useEffect, useRef, useState } from "react";
import { readEventStream } from "../tracking/sse.js";
import { isBadReference, lastSeq, mergeMessages, newClientId, stripRefs } from "./supportLogic.js";

const POLL_MS = 5_000;            // fallback refresh while the live stream is down
const IDLE_POLL_MS = 15_000;      // no conversation yet: only presence can change
const FIRST_EVENT_MS = 10_000;    // the server sends a snapshot immediately; silence = a proxy is buffering the stream
const IDLE_MS = 50_000;           // server pings every 20 s; 50 s of nothing = dead connection
const BUFFERED_RETRY_MS = 60_000;
const NO_ACCESS = new Set([401, 403, 404]);

/**
 * One message thread (the customer's chat, or a pharmacist viewing a customer) with:
 *  - history loaded from the API (survives refresh),
 *  - live updates over Server-Sent Events, quietly falling back to polling when the stream is blocked/buffered/dropped
 *    (the same strategy as order tracking),
 *  - optimistic sends that are idempotent: a retry reuses the SAME clientMessageId, so a double tap or flaky network can't duplicate.
 *
 * `api` = { load(), history(beforeSeq), streamPath(afterSeq, conversation) → path | null, send(body, clientMessageId, refs) }
 * `mode`: "connecting" | "live" | "polling" | "closed"
 */
export function useSupportThread(key, { enabled = true, api, selfRole = "customer" }) {
  const [state, setState] = useState({ loading: true, error: null, conversation: null, presence: null, messages: [], hasMore: false, mode: "connecting" });
  const apiRef = useRef(api); apiRef.current = api;
  const seqRef = useRef(0);
  const messagesRef = useRef([]);
  const refreshRef = useRef(() => {});
  const convRef = useRef(null);

  messagesRef.current = state.messages;   // always the rendered list (incl. unsent/failed local messages) so Retry can find them

  const patch = useCallback((p) => setState((s) => ({ ...s, ...p })), []);
  const absorb = useCallback((snap) => {
    if (snap.conversation) convRef.current = snap.conversation;
    setState((s) => {
      const messages = snap.messages?.length ? mergeMessages(s.messages, snap.messages) : s.messages;
      messagesRef.current = messages; seqRef.current = lastSeq(messages);
      return { ...s, messages, conversation: snap.conversation ?? s.conversation, presence: snap.presence ?? s.presence, hasMore: snap.hasMore ?? s.hasMore, error: null };
    });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    messagesRef.current = []; seqRef.current = 0; convRef.current = null;
    setState({ loading: true, error: null, conversation: null, presence: null, messages: [], hasMore: false, mode: "connecting" });
    let disposed = false; let finished = false; let pollTimer = null; let retry = 0;
    const root = new AbortController();
    const live = () => !disposed && !finished;

    const load = async () => {
      try { const snap = await apiRef.current.load(); if (live()) { absorb(snap); patch({ loading: false }); } return snap; }
      catch (err) {
        if (!live()) return null;
        if (NO_ACCESS.has(err?.status) && err.status !== 404) { finished = true; patch({ loading: false, error: err.message, mode: "closed" }); root.abort(); }
        else patch({ loading: false, error: err?.message || "Couldn't load messages" });
        return null;
      }
    };
    refreshRef.current = load;

    const startPolling = (ms) => {
      if (pollTimer || !live()) return;
      pollTimer = setInterval(() => { if (!document.hidden) load(); }, ms);
    };
    const stopPolling = () => { clearInterval(pollTimer); pollTimer = null; };
    const sleep = (ms) => new Promise((resolve) => { const t = setTimeout(resolve, ms); root.signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true }); });

    (async () => {
      const first = await load();
      if (!live()) return;
      const hasThread = !!first?.conversation;
      if (!hasThread) { patch({ mode: "polling" }); startPolling(IDLE_POLL_MS); }   // presence only; the stream starts once a thread exists

      while (live()) {
        const path = apiRef.current.streamPath?.(seqRef.current, convRef.current);
        if (!path) { await sleep(1000); continue; }   // no thread yet (the customer's first message creates it)
        stopPolling();
        const attempt = new AbortController();
        const onRootAbort = () => attempt.abort();
        root.signal.addEventListener("abort", onRootAbort, { once: true });
        let gotEvent = false; let why = null; let idleTimer = null;
        const firstTimer = setTimeout(() => { why = "buffered"; attempt.abort(); }, FIRST_EVENT_MS);
        const bump = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { why = "idle"; attempt.abort(); }, IDLE_MS); };
        try {
          await readEventStream(path, {
            signal: attempt.signal, onActivity: bump,
            onEvent: (event, data) => {
              if (event === "support") { if (!gotEvent) { gotEvent = true; clearTimeout(firstTimer); retry = 0; } patch({ mode: "live" }); absorb(data); }
              else if (event === "gone") { finished = true; patch({ mode: "closed" }); }
              else if (event === "error") { why = "refused"; attempt.abort(); }
            },
          });
        } catch (err) {
          if (!live()) break;
          if (err?.name !== "AbortError" && NO_ACCESS.has(err?.status) && err.status !== 404) { finished = true; patch({ mode: "closed", error: err.message }); break; }
        } finally {
          clearTimeout(firstTimer); clearTimeout(idleTimer); root.signal.removeEventListener("abort", onRootAbort);
        }
        if (!live()) break;
        if (gotEvent && !why) { await sleep(500); continue; }          // clean scheduled close (token lifetime): reconnect at once
        patch({ mode: "polling" }); startPolling(POLL_MS); load();
        await sleep(why === "buffered" ? BUFFERED_RETRY_MS : Math.min(2000 * 2 ** retry, 30_000));
        retry += 1;
      }
    })();

    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { disposed = true; stopPolling(); root.abort(); document.removeEventListener("visibilitychange", onVisible); };
  }, [key, enabled, absorb, patch]);

  /** Optimistic send. Returns after the server answers; the placeholder is replaced by the stored message, or marked failed (kept, retryable). */
  const deliver = useCallback(async (local, refs) => {
    const { clientMessageId, body } = local;
    setState((s) => ({ ...s, messages: mergeMessages(s.messages.filter((m) => m.id !== local.id), [{ ...local, localState: "sending", error: null }]) }));
    const attemptSend = (r) => apiRef.current.send(body, clientMessageId, r);
    try {
      let out;
      try { out = await attemptSend(refs); }
      catch (err) { if (!isBadReference(err) || !refs) throw err; out = await attemptSend(undefined); }   // the message is fine; only the link was bad
      absorb({ messages: [out.message], presence: out.presence });
      refreshRef.current();                                           // picks up the conversation record (and starts the stream on the first message)
      return true;
    } catch (err) {
      setState((s) => ({ ...s, messages: s.messages.map((m) => (m.id === local.id ? { ...m, localState: "failed", error: err?.message || "Not sent" } : m)) }));
      return false;
    }
  }, [absorb]);

  const send = useCallback((body, refs) => {
    const clientMessageId = newClientId();
    return deliver({ id: `local-${clientMessageId}`, clientMessageId, sender: selfRole, body, createdAt: new Date().toISOString(), refs: {} }, refs);
  }, [deliver, selfRole]);

  const retrySend = useCallback((localId, refs) => {
    const local = messagesRef.current.find((m) => m.id === localId);
    return local ? deliver(local, refs) : Promise.resolve(false);
  }, [deliver]);

  const loadEarlier = useCallback(async () => {
    const before = messagesRef.current.find((m) => m.seq)?.seq;
    if (!before) return;
    try { const page = await apiRef.current.history(before); absorb({ messages: page.messages, hasMore: page.hasMore }); }
    catch (err) { patch({ error: err?.message || "Couldn't load earlier messages" }); }
  }, [absorb, patch]);

  return { ...state, send, retrySend, loadEarlier, refresh: () => refreshRef.current(), stripRefs };
}
