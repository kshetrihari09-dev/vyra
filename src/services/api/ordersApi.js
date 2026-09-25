import { api } from "./client.js";

export const ordersApi = {
  list: async (params = {}) => (await api.get("/orders", params)).orders,
  get: async (id) => (await api.get(`/orders/${id}`)).order,
  create: async ({ items, addressId, paymentMethod, deliveryOptionId, slot, couponCode, notes, instructions, branch }) =>
    (await api.post("/orders", {
      items: items.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, qty: l.qty })),
      addressId, paymentMethod, deliveryOptionId, slot: slot || undefined, couponCode: couponCode || undefined, notes: notes || undefined, instructions: instructions || undefined, branch,
    })).order,
  advance: async (id, status, partner) => (await api.post(`/orders/${id}/status`, { status, partner })).order,
  cancel: async (id, reason) => (await api.post(`/orders/${id}/cancel`, { reason: reason || undefined })).order,
};
