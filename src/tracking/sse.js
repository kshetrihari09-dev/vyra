import { ApiError, streamRequest } from "../services/api/client.js";

/**
 * Incremental Server-Sent-Events parser. Feed it decoded text in any chunking; it calls onEvent(event, data) per complete
 * event. Comment lines (": ping" heartbeats) are ignored; multi-line `data:` is joined; CRLF is tolerated.
 */
export function createSseParser(onEvent) {
  let buf = "";
  return (text) => {
    buf += text.replace(/\r\n/g, "\n");
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message"; const data = [];
      for (const line of block.split("\n")) {
        if (!line || line.startsWith(":")) continue;
        const c = line.indexOf(":");
        const field = c < 0 ? line : line.slice(0, c);
        const value = c < 0 ? "" : line.slice(c + 1).replace(/^ /, "");
        if (field === "event") event = value; else if (field === "data") data.push(value);
      }
      if (!data.length) continue;
      let parsed = null;
      try { parsed = JSON.parse(data.join("\n")); } catch { continue; } // a malformed event is dropped, never thrown into the stream loop
      onEvent(event, parsed);
    }
  };
}

/**
 * Reads one tracking stream until it ends. Resolves when the server closes it (normally: final state or token lifetime);
 * rejects with ApiError for a non-stream answer (404 no access, 401, 5xx) or a network failure. `onActivity` fires on every
 * chunk — including heartbeats — so the caller can run an idle watchdog.
 */
export async function readTrackingStream(orderId, { signal, onEvent, onActivity }) {
  const res = await streamRequest(`/orders/${encodeURIComponent(orderId)}/tracking/stream`, { signal });
  if (!res.ok || !(res.headers.get("content-type") || "").includes("text/event-stream")) {
    let json = null; try { json = await res.json(); } catch { /* not JSON — e.g. an HTML page from a proxy */ }
    throw new ApiError(res.status, json?.code || "STREAM_UNAVAILABLE", json?.message || `Live updates are unavailable (${res.status})`);
  }
  const parse = createSseParser(onEvent);
  const reader = res.body.getReader(); const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    onActivity?.();
    parse(dec.decode(value, { stream: true }));
  }
}
