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

  /** One sale. `body.idempotencyKey` makes it safe to send twice: the server returns the SAME sale (HTTP 200) instead of creating another. */
  posSale: async (body) => (await api.post("/pos/sale", body)).sale,
  /** "Did my request go through?" — after a dropped connection, ask by the request id instead of guessing. 404 = it was not recorded. */
  posSaleByKey: async (key) => (await api.get(`/pos/sales/by-key/${encodeURIComponent(key)}`)).sale,
  posSaleById: async (id) => (await api.get(`/pos/sales/${encodeURIComponent(id)}`)).sale,
  posSales: async (params = {}) => (await api.get("/pos/sales", params)).sales,
};
