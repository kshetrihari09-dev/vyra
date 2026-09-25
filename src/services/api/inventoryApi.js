import { api } from "./client.js";

export const inventoryApi = {
  adjust: (body) => api.post("/inventory/adjust", body),
  transfer: (body) => api.post("/inventory/transfer", body),
  movements: async (params = {}) => (await api.get("/inventory/movements", params)).movements,
  lowStock: async (params = {}) => (await api.get("/inventory/low-stock", params)).items,

  suppliers: async () => (await api.get("/suppliers")).suppliers,
  purchaseOrders: async (params = {}) => (await api.get("/purchase-orders", params)).purchaseOrders,
  createPurchaseOrder: async (body) => (await api.post("/purchase-orders", body)).purchaseOrder,
  receivePurchaseOrder: async (id, lines) => (await api.post(`/purchase-orders/${id}/receive`, { lines })).purchaseOrder,

  posSale: async (body) => (await api.post("/pos/sale", body)).sale,
};
