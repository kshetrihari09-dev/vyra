import { api } from "./client.js";

export const paymentsApi = {
  forOrder: async (orderId) => (await api.get(`/orders/${orderId}/payment`)).payments,
  confirmManual: async (paymentId) => api.post(`/payments/${paymentId}/confirm-manual`),

  requestRefund: async (orderId, { amount, reason }) => (await api.post(`/orders/${orderId}/refund-request`, { amount: amount || undefined, reason })).refund,
  listRefunds: async (params = {}) => (await api.get("/refunds", params)).refunds,
  decideRefund: async (id, { decision, note }) => (await api.post(`/refunds/${id}/decide`, { decision, note: note || undefined })).refund,
};
