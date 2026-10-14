import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../store/AppContext.jsx";
import { hasPermission } from "../services/access.js";
import { callsApi, CALLS_STREAM_PATH } from "../services/api/callsApi.js";
import { readEventStream } from "../tracking/sse.js";
import { createCallPeer, CallError } from "./peer.js";
import { createRingtone } from "./ringtone.js";
import CallOverlay from "./CallOverlay.jsx";

/**
 * Vyra Call — one provider for the whole app, so a call survives page navigation and a shop hears incoming calls anywhere
 * in its dashboard. Two roles share this code and the server tells them apart from the signed-in account, never from here:
 *   • customer: startCall(shop) from the shop's "Call" button  → caller (makes the WebRTC offer)
 *   • shop owner, inside /shop/*: heartbeats availability, listens for calls → callee (answers)
 * Signaling goes over the app's authenticated SSE stream (server → browser) and plain POSTs (browser → server).
 */
const Ctx = createContext(null);
export const useCalls = () => useContext(Ctx);

const PING_MS = 15_000;
const PRESENCE_MS = 20_000;
const FINAL = new Set(["completed", "declined", "missed", "cancelled", "failed"]);
const PREF_KEY = "vyra.calls.accepting";
const readAccepting = () => { try { return localStorage.getItem(PREF_KEY) !== "0"; } catch { return true; } };

export const apiMessage = (err) => {
  switch (err?.code) {
    case "NETWORK_ERROR": return "Can't reach the server. Check your connection and try again.";
    case "RATE_LIMITED": return "Too many call attempts. Please wait a few minutes and try again.";
    case "ALREADY_IN_CALL": return "You already have a call in progress.";
    case "CALLS_DISABLED": return err.message;
    case "CANNOT_CALL_OWN_SHOP": return "You can't call your own shop.";
    default: return err?.message || "Something went wrong with the call.";
  }
};

const OUTCOME_TEXT = {
  declined: "The shop couldn't take your call right now.",
  missed: "The shop didn't answer.",
  cancelled: "Call cancelled.",
  failed: "The call couldn't be connected. Check your internet connection and try again.",
  completed: "Call ended.",
  busy: "The shop is on another call. Please try again in a few minutes.",
  unavailable: "The shop isn't available for calls right now.",
  error: "The call couldn't start.",
};

export function CallsProvider({ area, nav, children }) {
  const { session } = useApp();
  const signedIn = !!session?.signedIn;
  const isShopOwner = signedIn && !!session.shopOwnerSellerId && hasPermission(session, "seller:manage_own");
  const shopDesk = isShopOwner && area === "shop"; // incoming calls are answered from the shop dashboard

  const [ui, setUi] = useState(null);           // the call this tab is handling (or just ended): { role, phase, id, peerName, ... }
  const [incoming, setIncoming] = useState(null); // a ringing call addressed to my shop that I haven't answered yet
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [accepting, setAcceptingState] = useState(readAccepting);
  const [desk, setDesk] = useState({ online: false, error: null, live: false });
  const [audioBlocked, setAudioBlocked] = useState(false);

  const r = useRef({ peer: null, id: null, role: null, cursor: 0, last: null, chain: Promise.resolve(), offerSent: false, connectedAt: null, orphans: new Set(), reported: false, token: 0 });
  const audioRef = useRef(null);
  const ringtone = useMemo(() => createRingtone(), []);
  const uiRef = useRef(ui); uiRef.current = ui;
  const signedInRef = useRef(signedIn); signedInRef.current = signedIn; // after sign-out there is no token, so cleanup must not call the API

  /* ------------------------------------------------------------------ teardown */
  const release = useCallback(() => {
    const s = r.current;
    s.peer?.close(); s.peer = null; s.id = null; s.role = null; s.offerSent = false; s.connectedAt = null; s.reported = false;
    if (audioRef.current) { audioRef.current.srcObject = null; }
    setMuted(false); setSeconds(0); setAudioBlocked(false);
  }, []);

  const finish = useCallback((outcome, message) => {
    const s = r.current; const dur = s.connectedAt ? Math.round((Date.now() - s.connectedAt) / 1000) : null;
    release();
    setIncoming(null);
    setUi((u) => ({ ...(u || {}), phase: "ended", outcome, message: message || OUTCOME_TEXT[outcome] || OUTCOME_TEXT.completed, durationSeconds: dur ?? u?.durationSeconds ?? null }));
  }, [release]);

  const outcomeFromServer = (call) => {
    if (call.status === "cancelled" && call.endReason === "peer_lost") return ["failed", "The other side lost connection."];
    if (call.status === "cancelled" && call.role === "shop") return ["cancelled", "The customer cancelled the call."];
    if (call.status === "completed" && call.endReason === "peer_lost") return ["completed", "Call ended — the other side lost connection."];
    if (call.status === "failed" && call.endReason === "connect_timeout") return ["failed", "The call couldn't be connected. Check your internet connection and try again."];
    return [call.status, null];
  };

  /* ------------------------------------------------------------------ signaling out */
  const sendSignal = useCallback((kind, payload) => {
    const id = r.current.id; if (!id) return;
    callsApi.signal(id, kind, payload).catch(() => { /* a lost ICE candidate is tolerable; a lost offer/answer ends in a timeout the user sees */ });
  }, []);

  const makePeer = useCallback(async (role, iceServers) => {
    const peer = createCallPeer({
      role: role === "customer" ? "caller" : "callee", iceServers,
      onSignal: sendSignal,
      onRemoteStream: (stream) => {
        const el = audioRef.current; if (!el) return;
        el.srcObject = stream;
        el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
      },
      onState: (st) => {
        const s = r.current; if (!s.peer || s.peer !== peer) return;
        if (st === "connected") {
          if (!s.connectedAt) { s.connectedAt = Date.now(); }
          setUi((u) => u && ({ ...u, phase: "connected" }));
          if (!s.reported) { s.reported = true; const id = s.id; const tryReport = (n) => callsApi.connected(id).catch(() => { if (n > 0 && r.current.id === id) setTimeout(() => tryReport(n - 1), 1500); }); tryReport(3); }
        } else if (st === "reconnecting") setUi((u) => u && ({ ...u, phase: "reconnecting" }));
        else if (st === "connecting") setUi((u) => (u && u.phase !== "connected" ? { ...u, phase: "connecting" } : u));
        else if (st === "failed") { const id = s.id; if (id) callsApi.end(id, "failed").catch(() => {}); finish("failed", "The connection was lost and couldn't be restored."); }
      },
    });
    return peer;
  }, [finish, sendSignal]);

  /* ------------------------------------------------------------------ signaling in (stream snapshots) */
  const applySnapshot = useCallback((snap) => {
    const s = r.current; s.last = snap;
    const mine = s.id ? snap.calls.find((c) => c.id === s.id) : null;

    if (s.id && mine) {
      if (FINAL.has(mine.status)) { const [o, m] = outcomeFromServer(mine); finish(o, m); return; }
      setUi((u) => u && ({ ...u, call: mine }));
      if (s.role === "customer" && mine.status === "connecting" && !s.offerSent && s.peer) {
        s.offerSent = true;
        s.chain = s.chain.then(() => s.peer?.makeOffer()).catch(() => { if (r.current.id) { callsApi.end(r.current.id, "failed").catch(() => {}); finish("failed"); } });
      }
      if (mine.status === "connecting" || mine.status === "active") setUi((u) => (u && (u.phase === "ringing" || u.phase === "calling") ? { ...u, phase: "connecting" } : u));
      for (const sig of snap.signals.filter((x) => x.callId === s.id)) {
        s.chain = s.chain.then(async () => {
          const p = s.peer; if (!p) return;
          if (sig.kind === "offer") await p.handleOffer(sig.payload);
          else if (sig.kind === "answer") await p.handleAnswer(sig.payload);
          else if (sig.kind === "ice") await p.handleIce(sig.payload);
        }).catch(() => {});
      }
      return;
    }
    if (s.id && !mine) return; // the call isn't in this snapshot yet / any more — the ping will tell us

    // Calls this tab isn't handling:
    const busyLocal = !!(s.id || s.peer); // a call this tab is placing/answering right now is never an orphan or a new incoming call
    const ringing = snap.calls.find((c) => c.role === "shop" && c.status === "ringing");
    if (ringing && !busyLocal) setIncoming((cur) => (cur?.id === ringing.id ? cur : ringing));
    else if (!ringing) setIncoming((cur) => {
      if (!cur) return cur;
      const gone = snap.calls.find((c) => c.id === cur.id);
      if (gone && gone.status === "missed") setUi({ role: "shop", phase: "ended", outcome: "missed", message: `Missed call from ${cur.peerName}.`, peerName: cur.peerName, autoDismiss: true });
      else if (gone && gone.status === "cancelled") setUi({ role: "shop", phase: "ended", outcome: "cancelled", message: `${cur.peerName} cancelled the call.`, peerName: cur.peerName, autoDismiss: true });
      return null;
    });
    // An open call this tab has no connection for (the page was reloaded or another tab owns it): end it so nobody is left hanging.
    if (!busyLocal) for (const c of snap.calls) {
      if ((c.status === "connecting" || c.status === "active" || (c.role === "customer" && c.status === "ringing")) && !s.orphans.has(c.id)) {
        s.orphans.add(c.id); callsApi.end(c.id, "failed").catch(() => {});
      }
    }
  }, [finish]);

  /* ------------------------------------------------------------------ the stream */
  const streamWanted = shopDesk || (!!ui && ui.phase !== "ended" && !!signedIn) || !!incoming;
  useEffect(() => {
    if (!streamWanted || !signedIn) return undefined;
    let stopped = false; let conn = null;
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    (async () => {
      let backoff = 1000;
      while (!stopped) {
        conn = new AbortController(); let last = Date.now();
        const watchdog = setInterval(() => { if (Date.now() - last > 45_000) conn.abort(); }, 5_000);
        try {
          await readEventStream(`${CALLS_STREAM_PATH}?after=${r.current.cursor}`, {
            signal: conn.signal, onActivity: () => { last = Date.now(); },
            onEvent: (event, data) => {
              if (event === "calls") { r.current.cursor = Math.max(r.current.cursor, data.cursor || 0); setDesk((d) => (d.live ? d : { ...d, live: true })); applySnapshot(data); }
              else if (event === "error" && data?.message) setDesk((d) => ({ ...d, error: data.message }));
            },
          });
          backoff = 1000;
        } catch (err) {
          if (stopped) break;
          setDesk((d) => ({ ...d, live: false }));
          if (err?.status === 403 || err?.status === 404) backoff = 30_000;
        } finally { clearInterval(watchdog); }
        if (stopped) break;
        setDesk((d) => ({ ...d, live: false }));
        await sleep(backoff); backoff = Math.min(backoff * 2, 15_000);
      }
    })();
    return () => { stopped = true; conn?.abort(); setDesk((d) => ({ ...d, live: false })); };
  }, [streamWanted, signedIn, applySnapshot]);

  /* ------------------------------------------------------------------ liveness: ping while in a call, tick the timer */
  const activeId = ui && ui.phase !== "ended" ? ui.id : null;
  useEffect(() => {
    if (!activeId) return undefined;
    const t = setInterval(() => {
      callsApi.ping(activeId).then((c) => { if (c && FINAL.has(c.status) && r.current.id === activeId) { const [o, m] = outcomeFromServer(c); finish(o, m); } }).catch(() => {});
    }, PING_MS);
    callsApi.ping(activeId).catch(() => {});
    return () => clearInterval(t);
  }, [activeId, finish]);
  useEffect(() => {
    if (!ui || (ui.phase !== "connected" && ui.phase !== "reconnecting")) return undefined;
    const t = setInterval(() => setSeconds(r.current.connectedAt ? Math.floor((Date.now() - r.current.connectedAt) / 1000) : 0), 1000);
    return () => clearInterval(t);
  }, [ui?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------------------------------------------ shop availability heartbeat (real: stops when the dashboard closes) */
  useEffect(() => {
    if (!shopDesk) { setDesk((d) => ({ ...d, online: false })); return undefined; }
    let stopped = false;
    const beat = () => callsApi.setPresence(accepting)
      .then(() => !stopped && setDesk((d) => ({ ...d, online: true, error: null })))
      .catch((e) => !stopped && setDesk((d) => ({ ...d, online: false, error: e.code === "CALLS_DISABLED" ? e.message : e.status === 0 ? "Offline — customers can't reach you until your connection returns." : e.message })));
    beat(); const t = setInterval(beat, PRESENCE_MS);
    // A tab coming back to the foreground re-announces immediately (background tabs throttle timers).
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [shopDesk, accepting]);
  // Going offline is done ONLY when leaving the shop dashboard (or signing out) — never as part of the heartbeat's own re-runs,
  // where a "go offline" request could arrive after the next "go online" one and wipe it.
  useEffect(() => {
    if (!shopDesk) return undefined;
    return () => { if (signedInRef.current) callsApi.clearPresence().catch(() => {}); };
  }, [shopDesk]);
  const setAccepting = useCallback((v) => { setAcceptingState(v); try { localStorage.setItem(PREF_KEY, v ? "1" : "0"); } catch { /* storage blocked: preference lasts this tab */ } }, []);

  /* ------------------------------------------------------------------ ringing sound for the shop */
  useEffect(() => { if (incoming && !ui) ringtone.start(); else ringtone.stop(); return () => ringtone.stop(); }, [incoming, ui, ringtone]);
  useEffect(() => {
    if (!incoming || ui) return undefined;
    const prev = document.title; document.title = `📞 Incoming call · ${incoming.peerName}`;
    return () => { document.title = prev; };
  }, [incoming, ui]);

  /* ------------------------------------------------------------------ actions */
  const setErrorUi = (role, outcome, message, peerName) => setUi({ role, phase: "ended", outcome, message, peerName });

  const startCall = useCallback(async ({ sellerId, shopName }) => {
    const s = r.current;
    if (s.id || s.peer || (uiRef.current && uiRef.current.phase !== "ended")) return;
    const token = ++s.token;                            // hanging up / dismissing while a step below is pending invalidates this attempt
    const cancelled = () => token !== s.token;
    setUi({ role: "customer", phase: "preparing", peerName: shopName, sellerId });
    let peer = null;
    try {
      const ice = await callsApi.ice();                 // nothing rings yet; also tells us early if calling is switched off
      if (cancelled()) return;
      peer = await makePeer("customer", ice.iceServers);
      await peer.acquireMic();                          // ask for the mic BEFORE ringing anyone
      if (cancelled()) { peer.close(); return; }
    } catch (err) {
      peer?.close();
      if (cancelled()) return;
      return setErrorUi("customer", "error", err instanceof CallError ? err.message : apiMessage(err), shopName);
    }
    s.peer = peer; s.role = "customer"; s.offerSent = false;
    setUi({ role: "customer", phase: "calling", peerName: shopName, sellerId });
    try {
      const call = await callsApi.start({ sellerId, clientCallId: crypto.randomUUID() });
      if (cancelled()) { callsApi.end(call.id).catch(() => {}); return; } // cancelled while the request was in flight: don't leave it ringing
      s.id = call.id; s.orphans.add(call.id);
      setUi({ role: "customer", phase: "ringing", id: call.id, call, peerName: call.peerName || shopName, sellerId });
      if (s.last) applySnapshot(s.last);
    } catch (err) {
      s.peer?.close(); s.peer = null; s.role = null;
      if (cancelled()) return;
      const code = err?.code;
      if (code === "SHOP_BUSY") return setErrorUi("customer", "busy", OUTCOME_TEXT.busy, shopName);
      if (code === "SHOP_OFFLINE" || code === "SHOP_UNAVAILABLE" || code === "CALLS_DISABLED") return setErrorUi("customer", "unavailable", err.message || OUTCOME_TEXT.unavailable, shopName);
      return setErrorUi("customer", "error", apiMessage(err), shopName);
    }
  }, [applySnapshot, makePeer]);

  const accept = useCallback(async () => {
    const call = incoming; const s = r.current;
    if (!call || s.id) return;
    setUi({ role: "shop", phase: "preparing", id: call.id, call, peerName: call.peerName });
    let peer = null;
    try {
      const ice = await callsApi.ice();
      peer = await makePeer("shop", ice.iceServers);
      await peer.acquireMic();
    } catch (err) {
      peer?.close();
      setUi(null); // back to the ringing screen — they can still decline, or fix the mic and answer
      setDesk((d) => ({ ...d, error: err instanceof CallError ? err.message : apiMessage(err) }));
      setIncoming({ ...call, micError: err instanceof CallError ? err.message : apiMessage(err) });
      return;
    }
    s.peer = peer; s.id = call.id; s.role = "shop"; s.orphans.add(call.id);
    try {
      const done = await callsApi.accept(call.id);
      setIncoming(null);
      setUi({ role: "shop", phase: "connecting", id: call.id, call: done, peerName: call.peerName });
      if (s.last) applySnapshot(s.last);
    } catch (err) {
      release(); setIncoming(null);
      setErrorUi("shop", err.code === "CALL_MISSED" ? "missed" : "cancelled", err.code === "CALL_MISSED" ? `Missed call from ${call.peerName}.` : "This call is no longer available.", call.peerName);
    }
  }, [incoming, makePeer, applySnapshot, release]);

  const decline = useCallback(async () => {
    const call = incoming; if (!call) return;
    setIncoming(null);
    try { await callsApi.decline(call.id); } catch { /* already ended */ }
  }, [incoming]);

  const hangUp = useCallback(async () => {
    const id = r.current.id; const role = r.current.role; const phase = uiRef.current?.phase;
    if (!id) { r.current.token += 1; r.current.peer?.close(); release(); setUi(null); return; }
    const wasRinging = phase === "ringing" || phase === "calling";
    try { await callsApi.end(id, "hangup"); } catch { /* the server's liveness job closes it if this didn't land */ }
    finish(wasRinging && role === "customer" ? "cancelled" : "completed", wasRinging && role === "customer" ? "Call cancelled." : "Call ended.");
  }, [finish, release]);

  const toggleMute = useCallback(() => { const p = r.current.peer; if (p) setMuted(p.setMuted(!p.muted)); }, []);
  const dismiss = useCallback(() => { r.current.token += 1; r.current.orphans.clear(); setUi(null); }, []);
  const enableAudio = useCallback(() => { audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => {}); }, []);

  /* A shop owner's "missed call" notices fade on their own. */
  useEffect(() => { if (ui?.phase === "ended" && ui.autoDismiss) { const t = setTimeout(() => setUi(null), 8000); return () => clearTimeout(t); } return undefined; }, [ui]);

  /* Signing out, or the provider going away, never leaves a microphone open. */
  useEffect(() => { if (!signedIn) { release(); setUi(null); setIncoming(null); } }, [signedIn, release]);
  useEffect(() => () => { const id = r.current.id; if (id && signedInRef.current) callsApi.end(id).catch(() => {}); r.current.peer?.close(); ringtone.stop(); }, [ringtone]);

  const value = useMemo(() => ({
    ui, incoming, muted, seconds, accepting, setAccepting, desk, audioBlocked, enableAudio,
    inCall: !!ui && ui.phase !== "ended", startCall, accept, decline, hangUp, toggleMute, dismiss,
  }), [ui, incoming, muted, seconds, accepting, setAccepting, desk, audioBlocked, enableAudio, startCall, accept, decline, hangUp, toggleMute, dismiss]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* The remote voice plays through this element; it has no controls and is never visible. */}
      <audio ref={audioRef} autoPlay playsInline aria-hidden="true" />
      <CallOverlay nav={nav} />
    </Ctx.Provider>
  );
}
