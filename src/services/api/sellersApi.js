import { api } from "./client.js";

/** Server seller DTO -> the shape the existing seller/admin screens already use (data/sellers.js). */
export const sellerFromApi = (s) => ({
  id: s.id, name: s.name, firstParty: !!s.firstParty, status: s.status, commissionRate: s.commissionRate,
  rating: s.rating, reviews: s.reviewsCount, joinedAt: (s.joinedAt || "").slice(0, 10),
  payoutMethod: s.payoutMethodLabel || "Not yet set up", contactEmail: s.contactEmail || "", brands: [],
});

/** Server payout DTO -> the local shape Payouts.jsx renders ({ id, sellerId, amount, at, method, status }). */
export const payoutFromApi = (p) => ({ id: p.id, sellerId: p.sellerId, amount: p.amount, at: p.paidAt || p.createdAt, method: p.methodLabel, status: p.status });

export const sellersApi = {
  list: async (params = {}) => (await api.get("/sellers", { pageSize: 100, ...params })).sellers.map(sellerFromApi),
  mine: async () => { const { seller } = await api.get("/sellers/mine"); return seller ? sellerFromApi(seller) : null; },
  setStatus: async (id, status) => sellerFromApi((await api.post(`/sellers/${id}/status`, { status })).seller),
  balance: async (id) => (await api.get(`/sellers/${id}/balance`)).availableBalance,
  settlement: async (id) => api.get(`/sellers/${id}/settlement`),

  payouts: async (sellerId) => (await api.get(`/sellers/${sellerId}/payouts`)).payouts.map(payoutFromApi),
  allPayouts: async (params = {}) => (await api.get("/payouts", params)).payouts.map(payoutFromApi),
  requestPayout: async (sellerId, { amount, note } = {}) => payoutFromApi((await api.post(`/sellers/${sellerId}/payouts`, { amount, note })).payout),
  decidePayout: async (id, { decision, note }) => payoutFromApi((await api.post(`/payouts/${id}/decide`, { decision, note })).payout),
};
