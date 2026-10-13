/** A soft two-tone ring for the shop's incoming-call screen (Web Audio; silently does nothing if the browser blocks audio). */
export function createRingtone() {
  let ctx = null; let timer = null;
  const beep = (freq, at, len) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + len);
    o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + len + 0.05);
  };
  const cycle = () => { try { beep(660, 0, 0.35); beep(880, 0.4, 0.35); } catch { /* ignore */ } };
  return {
    start() {
      if (timer) return;
      try {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return;
        ctx = new AC(); ctx.resume?.().catch(() => {});
        cycle(); timer = setInterval(cycle, 2200);
        globalThis.navigator?.vibrate?.([300, 150, 300]);
      } catch { /* blocked */ }
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      try { ctx?.close(); } catch { /* ignore */ }
      ctx = null;
      globalThis.navigator?.vibrate?.(0);
    },
  };
}
