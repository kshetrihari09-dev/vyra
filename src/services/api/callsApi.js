import { api } from "./client.js";

/** Vaspoor Call. Which side of a call you are is decided by the server from your session — nothing here says "I am the shop". */
export const callsApi = {
  ice: () => api.get("/calls/ice"),
  shopStatus: (sellerId) => api.get(`/shops/${encodeURIComponent(sellerId)}/call-status`),
  start: ({ sellerId, clientCallId }) => api.post("/calls", { sellerId, clientCallId }),
  get: (id) => api.get(`/calls/${id}`),
  accept: (id) => api.post(`/calls/${id}/accept`),
  decline: (id) => api.post(`/calls/${id}/decline`),
  end: (id, reason = "hangup") => api.post(`/calls/${id}/end`, { reason }),
  connected: (id) => api.post(`/calls/${id}/connected`),
  ping: (id) => api.post(`/calls/${id}/ping`),
  signal: (id, kind, payload) => api.post(`/calls/${id}/signal`, { kind, payload }),
  // shop console
  setPresence: (accepting) => api.put("/shop/call-presence", { accepting }),
  clearPresence: () => api.delete("/shop/call-presence"),
  history: ({ page = 1, pageSize = 25, missedOnly = false } = {}) => api.get("/shop/calls", { page, pageSize, missedOnly: missedOnly ? "true" : "false" }),
};
export const CALLS_STREAM_PATH = "/calls/stream";
