import { api } from "./client.js";

export const wishlistApi = {
  list: async () => (await api.get("/wishlist")).productIds,
  toggle: async (productId) => api.post(`/wishlist/${encodeURIComponent(productId)}/toggle`, {}),
};
