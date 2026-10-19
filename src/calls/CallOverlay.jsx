import React, { useEffect, useRef } from "react";
import { useC } from "../store/AppContext.jsx";
import { TONE } from "../theme.js";
import { Phone, PhoneOff, Mic, MicOff, AlertTriangle, MessageCircle } from "../components/shared/Icon.jsx";
import { useCalls } from "./CallsProvider.jsx";

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const STATUS = {
  preparing: "Waiting for microphone permission…",
  calling: "Calling…",
  ringing: "Ringing…",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Poor connection — reconnecting…",
};

function RoundButton({ label, onClick, bg, color = "#fff", children, size = 64, pressed, autoFocus }) {
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <div className="flex flex-col items-center gap-2">
      <button ref={ref} type="button" onClick={onClick} aria-label={label} aria-pressed={pressed}
        className="rounded-full inline-flex items-center justify-center transition-transform active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
        style={{ width: size, height: size, background: bg, color }}>
        {children}
      </button>
      <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,.85)" }} aria-hidden="true">{label}</span>
    </div>
  );
}

function Shell({ children, label }) {
  const C = useC();
  return (
    <div className="fixed inset-0 z-[100] flex items-stretch md:items-center justify-center" role="dialog" aria-modal="true" aria-label={label}
      style={{ background: "rgba(6,20,28,.72)" }}>
      <style>{`@keyframes vyra-ring{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.9);opacity:0}}@media (prefers-reduced-motion:reduce){.vyra-ring{animation:none!important}}`}</style>
      <div className="w-full md:w-[380px] md:rounded-3xl flex flex-col items-center justify-between text-center px-6 py-10 md:py-9 md:max-h-[640px]"
        style={{ background: `linear-gradient(180deg, ${C.navy} 0%, #0a2230 100%)`, color: "#fff", paddingTop: "max(2.5rem, env(safe-area-inset-top))", paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>
        {children}
      </div>
    </div>
  );
}

function Identity({ name, status, sub, pulse }) {
  const C = useC();
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-3 mt-6">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {pulse && <span className="vyra-ring absolute inset-0 rounded-full" style={{ background: C.primary, animation: "vyra-ring 1.8s ease-out infinite" }} />}
        <span className="relative w-24 h-24 rounded-full inline-flex items-center justify-center text-4xl font-extrabold" style={{ background: C.primary, color: "#fff" }}>{initial}</span>
      </div>
      <h2 className="text-2xl font-extrabold leading-tight break-words max-w-[300px]">{name || "Vaspoor Call"}</h2>
      <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,.8)" }} role="status" aria-live="polite">{status}</p>
      {sub && <p className="text-xs max-w-[280px]" style={{ color: "rgba(255,255,255,.65)" }}>{sub}</p>}
    </div>
  );
}

export default function CallOverlay({ nav }) {
  const { ui, incoming, muted, seconds, audioBlocked, enableAudio, accept, decline, hangUp, toggleMute, dismiss, startCall, desk } = useCalls();

  // ---- shop: a call is ringing
  if (incoming && !ui) {
    return (
      <Shell label="Incoming Vaspoor Call">
        <Identity name={incoming.peerName} status="Incoming Vaspoor Call" sub="A customer is calling your shop." pulse />
        <div className="w-full">
          {incoming.micError && <p className="mb-4 text-xs rounded-xl px-3 py-2 inline-flex items-start gap-2 text-left" style={{ background: TONE.dangerBg, color: TONE.danger }}><AlertTriangle size={14} className="mt-0.5 shrink-0" /><span>{incoming.micError}</span></p>}
          <div className="flex items-center justify-center gap-14">
            <RoundButton label="Decline" onClick={decline} bg={TONE.danger}><PhoneOff size={26} /></RoundButton>
            <RoundButton label="Accept" onClick={accept} bg="#1FA971" autoFocus><Phone size={26} /></RoundButton>
          </div>
        </div>
      </Shell>
    );
  }
  if (!ui) return null;

  // ---- finished / failed
  if (ui.phase === "ended") {
    const bad = ["failed", "error", "unavailable", "busy", "missed", "declined"].includes(ui.outcome);
    const again = ui.role === "customer" && ui.sellerId && ["missed", "declined", "busy", "failed", "cancelled", "error"].includes(ui.outcome);
    if (ui.autoDismiss) {
      return (
        <div className="fixed left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3 text-sm" role="status" style={{ top: "max(1rem, env(safe-area-inset-top))", background: "#fff", color: TONE.ink, border: `1px solid ${TONE.warn}` }}>
          <PhoneOff size={16} style={{ color: TONE.warn }} /><span>{ui.message}</span>
          <button type="button" onClick={dismiss} className="text-xs font-semibold underline">Dismiss</button>
        </div>
      );
    }
    return (
      <Shell label="Call ended">
        <Identity name={ui.peerName} status={ui.outcome === "completed" ? "Call ended" : ui.outcome === "cancelled" ? "Call cancelled" : "Call unavailable"} />
        <div className="w-full space-y-4">
          <p className="text-sm rounded-2xl px-4 py-3 text-left" style={{ background: bad ? "rgba(224,84,106,.18)" : "rgba(255,255,255,.1)", color: "#fff" }}>
            {ui.message}{ui.durationSeconds != null && ui.outcome === "completed" ? ` Duration ${fmt(ui.durationSeconds)}.` : ""}
          </p>
          <div className="flex flex-col gap-2.5">
            {again && <button type="button" onClick={() => startCall({ sellerId: ui.sellerId, shopName: ui.peerName })} className="w-full rounded-full py-3 text-sm font-bold inline-flex items-center justify-center gap-2" style={{ background: "#1FA971", color: "#fff" }}><Phone size={16} /> Call again</button>}
            {ui.role === "customer" && bad && nav && <button type="button" onClick={() => { dismiss(); nav("support"); }} className="w-full rounded-full py-3 text-sm font-semibold inline-flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}><MessageCircle size={16} /> Message support instead</button>}
            <button type="button" onClick={dismiss} autoFocus className="w-full rounded-full py-3 text-sm font-semibold" style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}>Close</button>
          </div>
        </div>
      </Shell>
    );
  }

  // ---- in progress (preparing → calling → ringing → connecting → connected)
  const live = ui.phase === "connected" || ui.phase === "reconnecting";
  const status = live ? `${ui.phase === "reconnecting" ? "Reconnecting… " : ""}${fmt(seconds)}` : STATUS[ui.phase] || "Connecting…";
  return (
    <Shell label={`Vaspoor Call with ${ui.peerName || "shop"}`}>
      <Identity name={ui.peerName} status={status} pulse={!live}
        sub={ui.phase === "reconnecting" ? "Your connection is unstable. We're trying to restore the call." : ui.phase === "preparing" ? "Please choose Allow when your browser asks to use the microphone." : desk?.error && ui.role === "shop" ? desk.error : null} />
      <div className="w-full space-y-5">
        {audioBlocked && <button type="button" onClick={enableAudio} className="w-full rounded-full py-2.5 text-sm font-semibold" style={{ background: TONE.warnBg, color: "#7a5300" }}>Tap to turn on call sound</button>}
        <div className="flex items-center justify-center gap-10">
          {live && <RoundButton label={muted ? "Unmute" : "Mute"} pressed={muted} onClick={toggleMute} bg={muted ? "#fff" : "rgba(255,255,255,.16)"} color={muted ? TONE.ink : "#fff"}>{muted ? <MicOff size={24} /> : <Mic size={24} />}</RoundButton>}
          <RoundButton label={live || ui.phase === "connecting" ? "End call" : "Cancel"} onClick={hangUp} bg={TONE.danger} autoFocus><PhoneOff size={26} /></RoundButton>
        </div>
      </div>
    </Shell>
  );
}
