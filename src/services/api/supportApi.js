import { api } from "./client.js";

/** Pharmacist support. Customer calls never carry a conversation id (the server looks the thread up by the signed-in user). */
export const supportApi = {
  // customer
  contact: (branchId) => api.get("/support/contact", { branchId }),
  chat: () => api.get("/support/chat"),
  history: (before) => api.get("/support/chat/messages", { before }),
  send: ({ body, clientMessageId, orderId, productId, prescriptionId }) =>
    api.post("/support/chat/messages", { body, clientMessageId, orderId, productId, prescriptionId }),
  markRead: () => api.post("/support/chat/read"),
  submitForm: ({ topic, body, clientRequestId, orderId, productId, prescriptionId }) =>
    api.post("/support/messages", { topic, body, clientRequestId, orderId, productId, prescriptionId }),
  // pharmacist
  availability: () => api.get("/support/availability"),
  setAvailability: (available) => api.put("/support/availability", { available }),
  inbox: ({ status = "open", page = 1 } = {}) => api.get("/support/inbox", { status, page }),
  inboxThread: async (id) => ({ ...(await api.get(`/support/inbox/${id}`)), ...(await api.get(`/support/inbox/${id}/messages`)) }),
  inboxHistory: (id, before) => api.get(`/support/inbox/${id}/messages`, { before }),
  reply: (id, { body, clientMessageId }) => api.post(`/support/inbox/${id}/messages`, { body, clientMessageId }),
  inboxRead: (id) => api.post(`/support/inbox/${id}/read`),
  resolve: (id) => api.post(`/support/inbox/${id}/resolve`),
  reopen: (id) => api.post(`/support/inbox/${id}/reopen`),
};
