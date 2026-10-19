/**
 * The WebRTC half of Vaspoor Call, with no React in it: microphone, RTCPeerConnection, ICE candidate buffering, ICE restart and
 * cleanup. The caller (customer) makes the offer; the callee (shop) answers. Signaling messages travel through `onSignal`
 * (the server relays them) — this module never talks to the network itself, which also makes it testable with fakes.
 *
 * Everything it opens (mic tracks, the peer connection, timers) is released by close(), which is safe to call more than once.
 */
export const MIC_ERRORS = {
  INSECURE_CONTEXT: "Calls need a secure (https) connection.",
  UNSUPPORTED: "This browser can't make voice calls. Try the latest Chrome, Edge, Firefox or Safari.",
  MIC_DENIED: "Microphone access is blocked. Allow the microphone for this site in your browser's address-bar settings, then try again.",
  NO_MIC: "No microphone was found. Connect one and try again.",
  MIC_BUSY: "Your microphone is being used by another app. Close it and try again.",
  MIC_ERROR: "Couldn't start your microphone. Check it's connected and try again.",
};

export class CallError extends Error {
  constructor(code, message) { super(message || MIC_ERRORS[code] || code); this.name = "CallError"; this.code = code; }
}

const DISCONNECT_GRACE_MS = 6_000; // a brief wifi/cell blip heals itself; past this we restart ICE
const MAX_ICE_RESTARTS = 3;

export function createCallPeer({ role, iceServers: initialIce = [], onSignal, onState, onRemoteStream, deps = {} }) {
  const RTCPeer = deps.RTCPeerConnection ?? globalThis.RTCPeerConnection;
  const nav = deps.navigator ?? globalThis.navigator;
  const secure = deps.isSecureContext ?? globalThis.isSecureContext ?? true;
  const setT = deps.setTimeout ?? globalThis.setTimeout.bind(globalThis);
  const clearT = deps.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);

  let iceServers = initialIce; // can be supplied after creation, so the mic prompt and the ICE-server fetch run in parallel
  let pc = null; let stream = null; let closed = false; let muted = false;
  let remoteSet = false; const pending = []; let restarts = 0; let graceTimer = null; let lastState = "new";

  const emit = (state) => { if (state !== lastState && !closed) { lastState = state; onState?.(state); } };

  /** Asks for the microphone. Throws CallError with a code the UI turns into a helpful message. */
  async function acquireMic() {
    if (!secure) throw new CallError("INSECURE_CONTEXT");
    if (!RTCPeer || !nav?.mediaDevices?.getUserMedia) throw new CallError("UNSUPPORTED");
    try {
      stream = await nav.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    } catch (err) {
      const n = err?.name;
      if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError") throw new CallError("MIC_DENIED");
      if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") throw new CallError("NO_MIC");
      if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") throw new CallError("MIC_BUSY");
      throw new CallError("MIC_ERROR");
    }
    if (closed) { stopStream(); throw new CallError("MIC_ERROR", "Call ended"); }
    stream.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    return stream;
  }

  function stopStream() { stream?.getTracks().forEach((t) => { try { t.stop(); } catch { /* already stopped */ } }); stream = null; }

  /** Creates the peer connection (after the mic is allowed). Idempotent. */
  function connect() {
    if (pc || closed) return;
    if (!stream) throw new CallError("MIC_ERROR", "Microphone isn't ready");
    pc = new RTCPeer({ iceServers, bundlePolicy: "max-bundle" });
    stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => {
      if (closed) return;
      // `null` means gathering finished — sent as the standard empty "end-of-candidates" marker.
      onSignal("ice", e.candidate ? (e.candidate.toJSON ? e.candidate.toJSON() : { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex }) : { candidate: "", sdpMid: null, sdpMLineIndex: null });
    };
    pc.ontrack = (e) => { if (!closed) onRemoteStream?.(e.streams?.[0] ?? new MediaStream([e.track])); };
    pc.onconnectionstatechange = () => {
      if (closed || !pc) return;
      const st = pc.connectionState;
      if (st === "connected") { clearT(graceTimer); graceTimer = null; restarts = 0; emit("connected"); }
      else if (st === "disconnected") { emit("reconnecting"); armGrace(); }
      else if (st === "failed") { clearT(graceTimer); graceTimer = null; recover(); }
      else if (st === "connecting") { if (lastState !== "reconnecting") emit("connecting"); }
    };
  }

  function armGrace() {
    clearT(graceTimer);
    graceTimer = setT(() => { graceTimer = null; if (!closed && pc && pc.connectionState !== "connected") recover(); }, DISCONNECT_GRACE_MS);
  }

  /** Only the caller restarts ICE (it owns the offer); the callee simply answers the new offer. Gives up after a few tries. */
  async function recover() {
    if (closed || !pc) return;
    if (role !== "caller" || restarts >= MAX_ICE_RESTARTS) { emit("failed"); return; }
    restarts += 1; emit("reconnecting");
    try { await makeOffer({ iceRestart: true }); armGrace(); } catch { emit("failed"); }
  }

  async function makeOffer({ iceRestart = false } = {}) {
    if (role !== "caller") throw new CallError("ROLE", "Only the caller makes the offer");
    connect();
    const offer = await pc.createOffer({ iceRestart });
    if (closed) return;
    await pc.setLocalDescription(offer);
    onSignal("offer", { type: "offer", sdp: pc.localDescription.sdp });
  }

  async function flush() {
    remoteSet = true;
    while (pending.length) { const c = pending.shift(); try { await pc.addIceCandidate(c); } catch { /* a stale candidate from before a restart — harmless */ } }
  }

  async function handleOffer(desc) {
    if (role !== "callee") return;
    connect();
    await pc.setRemoteDescription({ type: "offer", sdp: desc.sdp });
    await flush();
    const answer = await pc.createAnswer();
    if (closed) return;
    await pc.setLocalDescription(answer);
    onSignal("answer", { type: "answer", sdp: pc.localDescription.sdp });
  }

  async function handleAnswer(desc) {
    if (role !== "caller" || !pc || pc.signalingState !== "have-local-offer") return; // a duplicate / out-of-order answer is ignored
    await pc.setRemoteDescription({ type: "answer", sdp: desc.sdp });
    await flush();
  }

  async function handleIce(c) {
    if (closed || !c) return;
    if (!pc || !remoteSet) { pending.push(c.candidate === "" ? { candidate: "", sdpMid: c.sdpMid ?? null, sdpMLineIndex: c.sdpMLineIndex ?? null } : c); return; }
    try { await pc.addIceCandidate(c); } catch { /* ignore: candidate for a superseded negotiation */ }
  }

  function setMuted(next) {
    muted = !!next;
    stream?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    return muted;
  }

  function close() {
    if (closed) return;
    closed = true;
    clearT(graceTimer); graceTimer = null;
    if (pc) {
      pc.onicecandidate = null; pc.ontrack = null; pc.onconnectionstatechange = null;
      try { pc.getSenders?.().forEach((s) => { try { s.track && (s.track.enabled = false); } catch { /* ignore */ } }); } catch { /* ignore */ }
      try { pc.close(); } catch { /* already closed */ }
      pc = null;
    }
    stopStream();
    pending.length = 0;
  }

  return {
    setIceServers(list) { if (!pc) iceServers = list; },
    acquireMic, connect, makeOffer, handleOffer, handleAnswer, handleIce, setMuted, close,
    get muted() { return muted; },
    get closed() { return closed; },
    get state() { return lastState; },
    /** Test/diagnostics hook: current RTCPeerConnection (null before connect / after close). */
    get connection() { return pc; },
  };
}
