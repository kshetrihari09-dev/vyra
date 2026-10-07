import { api } from "./client.js";

/** Server-priced cart preview: current prices, live stock, and coupon validity — never trust the client's own math. */
export const cartApi = {
  price: (lines, { couponCode, deliveryOptionId = "standard", branch, addressId } = {}) =>
    api.post("/cart/price", {
      items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, qty: l.qty })),
      couponCode: couponCode || undefined, deliveryOptionId, branch,
      addressId: addressId || undefined, // lets the server include the distance charge (own addresses only)
    }),
};
