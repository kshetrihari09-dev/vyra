import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CallError, createCallPeer } from "./peer.js";

/* Fakes: just enough of getUserMedia / RTCPeerConnection to drive the real peer logic. */
const track = () => ({ enabled: true, stopped: false, stop() { this.stopped = true; } });
const mediaStream = () => { const t = track(); return { t, getTracks: () => [t], getAudioTracks: () => [t] }; };

function fakeEnv({ gum } = {}) {
  const log = { pcs: [], timers: [], signals: [], states: [] };
  class FakePC {
    constructor(cfg) { this.cfg = cfg; this.signalingState = "stable"; this.connectionState = "new"; this.added = []; this.candidates = []; this.closed = false; this.offers = []; log.pcs.push(this); }
    addTrack(t) { this.added.push(t); }
    async createOffer(o) { this.offers.push(o); return { type: "offer", sdp: `offer-${this.offers.length}${o?.iceRestart ? "-restart" : ""}` }; }
    async createAnswer() { return { type: "answer", sdp: "answer-1" }; }
    async setLocalDescription(d) { this.localDescription = d; this.signalingState = d.type === "offer" ? "have-local-offer" : "stable"; }
    async setRemoteDescription(d) { this.remoteDescription = d; this.signalingState = "stable"; this.remoteSetAt = this.candidates.length; }
    async addIceCandidate(c) { this.candidates.push(c); }
    getSenders() { return []; }
    close() { this.closed = true; }
    set(state) { this.connectionState = state; this.onconnectionstatechange?.(); }
  }
  const stream = mediaStream();
  const deps = {
    RTCPeerConnection: FakePC, isSecureContext: true,
    navigator: { mediaDevices: { getUserMedia: gum ?? (async () => stream) } },
    setTimeout: (fn, ms) => { const id = log.timers.length + 1; log.timers.push({ id, fn, ms, live: true }); return id; },
    clearTimeout: (id) => { const t = log.timers.find((x) => x.id === id); if (t) t.live = false; },
  };
  const make = (role) => createCallPeer({ role, iceServers: [{ urls: ["stun:x"] }], deps, onSignal: (k, p) => log.signals.push([k, p]), onState: (s) => log.states.push(s), onRemoteStream: () => {} });
  const fire = () => { const t = log.timers.filter((x) => x.live).at(-1); t.live = false; return t.fn(); };
  return { log, deps, stream, make, fire };
}

describe("microphone errors map to helpful codes", () => {
  const codes = async (gum, extra = {}) => { const e = fakeEnv({ gum }); Object.assign(e.deps, extra); try { await e.make("caller").acquireMic(); } catch (err) { return err; } return null; };
  it("denied / none / busy / other", async () => {
    assert.equal((await codes(async () => { throw Object.assign(new Error(), { name: "NotAllowedError" }); })).code, "MIC_DENIED");
    assert.equal((await codes(async () => { throw Object.assign(new Error(), { name: "NotFoundError" }); })).code, "NO_MIC");
    assert.equal((await codes(async () => { throw Object.assign(new Error(), { name: "NotReadableError" }); })).code, "MIC_BUSY");
    assert.equal((await codes(async () => { throw new Error("boom"); })).code, "MIC_ERROR");
  });
  it("an insecure page or a browser without WebRTC fails before asking for anything", async () => {
    assert.equal((await codes(undefined, { isSecureContext: false })).code, "INSECURE_CONTEXT");
    assert.equal((await codes(undefined, { RTCPeerConnection: undefined })).code, "UNSUPPORTED");
    assert.ok((await codes(undefined, { isSecureContext: false })) instanceof CallError);
  });
});

describe("caller (customer) side", () => {
  it("acquires the mic, offers, and relays ICE (including end-of-candidates)", async () => {
    const e = fakeEnv(); const p = e.make("caller");
    await p.acquireMic(); await p.makeOffer();
    const pc = e.log.pcs[0];
    assert.deepEqual(e.log.signals[0], ["offer", { type: "offer", sdp: "offer-1" }]);
    assert.equal(pc.added.length, 1, "mic track is sent");
    pc.onicecandidate({ candidate: { toJSON: () => ({ candidate: "c1", sdpMid: "0", sdpMLineIndex: 0 }) } });
    pc.onicecandidate({ candidate: null });
    assert.deepEqual(e.log.signals.slice(1).map((s) => s[1].candidate), ["c1", ""]);
  });
  it("buffers ICE that arrives before the answer, then applies it in order", async () => {
    const e = fakeEnv(); const p = e.make("caller"); await p.acquireMic(); await p.makeOffer();
    await p.handleIce({ candidate: "early", sdpMid: "0", sdpMLineIndex: 0 });
    assert.equal(e.log.pcs[0].candidates.length, 0);
    await p.handleAnswer({ type: "answer", sdp: "a" });
    assert.equal(e.log.pcs[0].candidates.length, 1);
    await p.handleIce({ candidate: "late", sdpMid: "0", sdpMLineIndex: 0 });
    assert.deepEqual(e.log.pcs[0].candidates.map((c) => c.candidate), ["early", "late"]);
  });
  it("ignores an answer it isn't waiting for", async () => {
    const e = fakeEnv(); const p = e.make("caller"); await p.acquireMic(); await p.makeOffer();
    await p.handleAnswer({ type: "answer", sdp: "a" }); // moves to stable
    await p.handleAnswer({ type: "answer", sdp: "dup" });
    assert.equal(e.log.pcs[0].remoteDescription.sdp, "a");
  });
  it("a callee-only action is refused for the caller", async () => {
    const e = fakeEnv(); const p = e.make("caller"); await p.acquireMic();
    await p.handleOffer({ type: "offer", sdp: "x" });
    assert.equal(e.log.pcs.length, 0);
  });
});

describe("callee (shop) side", () => {
  it("answers an offer, flushing ICE that arrived first", async () => {
    const e = fakeEnv(); const p = e.make("callee"); await p.acquireMic();
    await p.handleIce({ candidate: "first", sdpMid: "0", sdpMLineIndex: 0 });
    await p.handleOffer({ type: "offer", sdp: "o" });
    const pc = e.log.pcs[0];
    assert.equal(pc.remoteDescription.sdp, "o");
    assert.equal(pc.candidates[0].candidate, "first");
    assert.deepEqual(e.log.signals.at(-1), ["answer", { type: "answer", sdp: "answer-1" }]);
  });
  it("can't make an offer", async () => {
    const e = fakeEnv(); const p = e.make("callee"); await p.acquireMic();
    await assert.rejects(() => p.makeOffer(), /Only the caller/);
  });
});

describe("mute", () => {
  it("toggles the outgoing track without tearing the call down, and survives being set before connect", async () => {
    const e = fakeEnv(); const p = e.make("caller");
    p.setMuted(true); await p.acquireMic();
    assert.equal(e.stream.t.enabled, false, "mute chosen before the mic arrived still applies");
    p.setMuted(false); assert.equal(e.stream.t.enabled, true);
    assert.equal(p.muted, false);
  });
});

describe("network recovery", () => {
  it("connected is reported; a blip shows 'reconnecting' and the caller restarts ICE after the grace period", async () => {
    const e = fakeEnv(); const p = e.make("caller"); await p.acquireMic(); await p.makeOffer();
    const pc = e.log.pcs[0];
    pc.set("connected"); pc.set("disconnected");
    assert.deepEqual(e.log.states, ["connected", "reconnecting"]);
    e.fire(); await new Promise((r) => setImmediate(r)); // grace period elapsed, still not connected; let the async restart finish
    assert.equal(pc.offers.at(-1).iceRestart, true);
    assert.equal(e.log.signals.at(-1)[1].sdp, "offer-2-restart");
    pc.set("connected");
    assert.equal(e.log.states.at(-1), "connected");
  });
  it("healing before the grace period cancels the restart", async () => {
    const e = fakeEnv(); const p = e.make("caller"); await p.acquireMic(); await p.makeOffer();
    const pc = e.log.pcs[0]; pc.set("disconnected"); pc.set("connected");
    assert.equal(e.log.timers.some((t) => t.live), false);
    assert.equal(pc.offers.length, 1);
  });
  it("the callee never restarts (it answers) and reports failure", async () => {
    const e = fakeEnv(); const p = e.make("callee"); await p.acquireMic(); await p.handleOffer({ type: "offer", sdp: "o" });
    e.log.pcs[0].set("failed");
    await Promise.resolve();
    assert.equal(e.log.states.at(-1), "failed"); assert.equal(e.log.pcs[0].offers.length, 0);
  });
  it("the caller gives up after repeated failures", async () => {
    const e = fakeEnv(); const p = e.make("caller"); await p.acquireMic(); await p.makeOffer();
    const pc = e.log.pcs[0];
    for (let i = 0; i < 3; i += 1) { pc.set("failed"); await Promise.resolve(); await Promise.resolve(); assert.equal(e.log.states.at(-1), "reconnecting"); }
    pc.set("failed"); await Promise.resolve();
    assert.equal(e.log.states.at(-1), "failed");
  });
});

describe("cleanup", () => {
  it("close() stops the mic, closes the connection, cancels timers, detaches handlers — and is idempotent", async () => {
    const e = fakeEnv(); const p = e.make("caller"); await p.acquireMic(); await p.makeOffer();
    const pc = e.log.pcs[0]; pc.set("disconnected");
    p.close(); p.close();
    assert.equal(e.stream.t.stopped, true); assert.equal(pc.closed, true);
    assert.equal(pc.onicecandidate, null); assert.equal(pc.onconnectionstatechange, null);
    assert.equal(e.log.timers.some((t) => t.live), false);
    const n = e.log.signals.length; await p.handleIce({ candidate: "x" }); assert.equal(e.log.signals.length, n);
    assert.equal(p.connection, null);
  });
  it("a mic that is granted after the call was already closed is released immediately", async () => {
    let release; const gate = new Promise((r) => { release = r; });
    const env = fakeEnv({ gum: async () => { await gate; return env.stream; } });
    const p = env.make("caller"); const pending = p.acquireMic();
    p.close(); release();
    await assert.rejects(pending);
    assert.equal(env.stream.t.stopped, true);
  });
});
