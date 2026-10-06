import { useEffect, useState } from "react";
import { deliveryApi } from "../services/api/deliveryApi.js";
import { readTrackingStream } from "./sse.js";

const POLL_MS = 10_000;          // fallback refresh while the stream is down
const FIRST_EVENT_MS = 10_000;   // the server sends a snapshot immediately; silence this long = a proxy is buffering the stream
const IDLE_MS = 50_000;          // the server pings every 20 s; 50 s of nothing = a dead connection
const BUFFERED_RETRY_MS = 60_000;
const NO_ACCESS = new Set([401, 403, 404]);

/**
 * Live tracking for one order: the server pushes a fresh snapshot whenever anything changes (Server-Sent Events), and when
 * the stream can't be used — blocked or buffered by a proxy, dropped on a flaky mobile network, too many open tabs — it quietly
 * falls back to polling every 10 s while retrying the stream with backoff. The screen never has to be refreshed either way.
 *
 * It stops by itself when the order reaches a final state (delivered / cancelled / returned), so nothing keeps running afterwards.
 *
 * @returns {{ tracking: object|null, mode: "idle"|"connecting"|"live"|"polling"|"ended"|"unavailable", error: string|null }}
 */
export function useLiveTracking(orderId, { enabled = true } = {}) {
  const [state, setState] = useState({ tracking: null, mode: "connecting", error: null });

  useEffect(() => {
    if (!enabled || !orderId) { setState({ tracking: null, mode: "idle", error: null }); return undefined; }
    setState({ tracking: null, mode: "connecting", error: null });

    let disposed = false;      // the component went away
    let finished = false;      // the order is final, or access is gone: nothing more to do
    let pollTimer = null;
    let retry = 0;
    const root = new AbortController();
    const set = (patch) => { if (!disposed) setState((s) => ({ ...s, ...patch })); };

    const stopPolling = () => { clearInterval(pollTimer); pollTimer = null; };
    const end = (mode, error = null) => { set({ mode, error }); finished = true; stopPolling(); root.abort(); };
    const apply = (tracking) => { set({ tracking, error: null }); if (tracking?.final) end("ended"); };

    const poll = async () => {
      if (finished || disposed || document.hidden) return;
      try { apply(await deliveryApi.tracking(orderId)); }
      catch (err) { if (NO_ACCESS.has(err?.status)) end("unavailable", err.message); else set({ error: err?.message || "Couldn't refresh" }); }
    };
    const startPolling = () => {
      if (pollTimer || finished || disposed) return;
      set({ mode: "polling" });
      poll();
      pollTimer = setInterval(poll, POLL_MS);
    };

    const sleep = (ms) => new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      root.signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
    });

    (async () => {
      while (!finished && !disposed) {
        const attempt = new AbortController();
        const onRootAbort = () => attempt.abort();
        root.signal.addEventListener("abort", onRootAbort, { once: true });
        let gotEvent = false; let why = null; let streamRefused = false;
        let idleTimer = null;
        const firstTimer = setTimeout(() => { why = "buffered"; attempt.abort(); }, FIRST_EVENT_MS);
        const bump = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { why = "idle"; attempt.abort(); }, IDLE_MS); };
        try {
          await readTrackingStream(orderId, {
            signal: attempt.signal, onActivity: bump,
            onEvent: (event, data) => {
              if (event === "tracking") {
                if (!gotEvent) { gotEvent = true; clearTimeout(firstTimer); retry = 0; stopPolling(); }
                set({ mode: "live" });
                apply(data);
              } else if (event === "gone") {
                end("unavailable", "This order isn't available to you.");
              } else if (event === "error") {           // e.g. TOO_MANY_STREAMS — don't hammer the server; polling carries on
                streamRefused = true; set({ error: data?.message || null });
              }                                         // "expired": the stream ended on schedule — just reconnect (token refresh is automatic)
            },
          });
        } catch (err) {
          if (finished || disposed) break;
          if (err?.name !== "AbortError" && NO_ACCESS.has(err?.status)) { end("unavailable", err.message); break; }
          // anything else (network, 5xx, buffered, idle): fall through to the fallback below
        } finally {
          clearTimeout(firstTimer); clearTimeout(idleTimer);
          root.signal.removeEventListener("abort", onRootAbort);
        }
        if (finished || disposed) break;
        if (streamRefused) { startPolling(); break; }
        if (gotEvent && !why) { await sleep(500); continue; }          // a clean, scheduled close: reconnect straight away
        startPolling();
        await sleep(why === "buffered" ? BUFFERED_RETRY_MS : Math.min(2000 * 2 ** retry, 30_000));
        retry += 1;
      }
    })();

    const onVisible = () => { if (!document.hidden && pollTimer) poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { disposed = true; stopPolling(); root.abort(); document.removeEventListener("visibilitychange", onVisible); };
  }, [orderId, enabled]);

  return state;
}
