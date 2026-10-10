/* Turns whatever went wrong into something a cashier can act on — never a raw backend message, never silence.
   `indeterminate` is the important flag: after a network failure or a 5xx we do NOT know whether the sale was recorded, so the till must
   retry with the SAME request id (safe) or ask the server, never "start over" with a new one (which could double-charge). */

const ACTIONABLE = {
  INSUFFICIENT_STOCK: null,                                   // the server's message already names the product and the real quantity
  PRICE_CHANGED: "Prices changed since this sale was built. The total has been updated — please review it and try again.",
  INSUFFICIENT_PAYMENT: "Payment amount is insufficient.",
  DISCOUNT_TOO_LARGE: "The discount can't be more than the sale amount.",
  INVALID_DISCOUNT: "That discount isn't valid.",
  DISCOUNT_NOT_ALLOWED: null,                                 // "Discounts above 20% need a manager."
  VARIANT_REQUIRED: null,                                     // "Choose a size/variant of …"
  PRODUCT_NOT_FOUND: "Product not found.",
  PRODUCT_UNAVAILABLE: null,                                  // "<name> isn't available for sale."
  BRANCH_NOT_FOUND: "That store isn't available. Pick another store.",
  INVALID_PAYMENT_METHOD: "That payment method isn't available at the till.",
  IDEMPOTENCY_KEY_REUSED: "This sale could not be matched to its earlier attempt. Please rebuild the sale.",
  VALIDATION_ERROR: "Some sale details are invalid. Please check the cart and try again.",
};

export const isIndeterminate = (err) => !err || err.status === 0 || err.status >= 500 || err.code === "NETWORK_ERROR";

/** → { message, kind, indeterminate, details } */
export function describePosError(err) {
  const code = err?.code;
  if (code === "NETWORK_ERROR" || err?.status === 0) {
    return { kind: "network", indeterminate: true, message: "Connection lost. The sale may or may not have gone through — retrying is safe and will not create a second sale." };
  }
  if (err?.status === 401) return { kind: "auth", indeterminate: false, message: "Your session has ended. Please sign in again — your cart is still here." };
  if (err?.status === 403 && !(code in ACTIONABLE)) return { kind: "forbidden", indeterminate: false, message: "You don't have permission to do that." };
  if (err?.status >= 500) {
    return { kind: "server", indeterminate: true, message: "Unable to complete the sale right now. We couldn't confirm whether it was recorded — retrying is safe and will not create a second sale." };
  }
  if (code in ACTIONABLE) {
    const kind = code === "INSUFFICIENT_STOCK" ? "stock" : code === "PRICE_CHANGED" ? "price" : code === "INSUFFICIENT_PAYMENT" ? "payment" : "rejected";
    return { kind, indeterminate: false, message: ACTIONABLE[code] ?? err.message ?? "Unable to complete the sale.", details: err.details };
  }
  if (err?.status === 429) return { kind: "busy", indeterminate: false, message: "Too many requests. Wait a moment and try again." };
  return { kind: "rejected", indeterminate: false, message: "Unable to complete the sale. Please check the details and try again." };
}

/** For search / barcode lookups (read-only, so always safe to just try again). */
export function describeLookupError(err, code) {
  if (err?.status === 404 || err?.code === "PRODUCT_NOT_FOUND") return `Product not found${code ? ` for “${code}”` : ""}.`;
  if (err?.code === "NETWORK_ERROR" || err?.status === 0) return "Network connection lost. Check your connection and scan again.";
  if (err?.status === 401) return "Your session has ended. Please sign in again.";
  return "Couldn't look that up. Please try again.";
}
