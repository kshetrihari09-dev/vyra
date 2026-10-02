/* Order lifecycle vocabulary shared by the customer tracker, the delivery
   app and the seller dashboard. The customer sees the full delivery timeline;
   a seller works with a shorter set of fulfilment stages that map onto it. */

export const ORDER_STAGES = [
  { id: "placed", label: "Order Placed", icon: "ClipboardList" },
  { id: "confirmed", label: "Confirmed", icon: "CheckCircle2" },
  { id: "preparing", label: "Preparing", icon: "Package" },
  { id: "packed", label: "Packed", icon: "PackageCheck" },
  { id: "assigned", label: "Assigned to Delivery", icon: "Bike" },
  { id: "out_for_delivery", label: "Out for Delivery", icon: "Truck" },
  { id: "delivered", label: "Delivered", icon: "Check" },
];

export const stageIndex = (status) => ORDER_STAGES.findIndex((s) => s.id === status);

export const STATUS_STYLE = {
  placed: { label: "Placed", tone: "info" },
  confirmed: { label: "Confirmed", tone: "info" },
  preparing: { label: "Preparing", tone: "warn" },
  packed: { label: "Packed", tone: "warn" },
  assigned: { label: "Rider assigned", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "info" },
  delivered: { label: "Delivered", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "danger" },
  returned: { label: "Returned", tone: "neutral" },
};

/* ------------------------------ seller view ------------------------------ */
/* key = what the seller sees; internal = the order.status it writes. */
export const SELLER_STATUSES = [
  { key: "pending", label: "Pending", internal: "placed", tone: "warn" },
  { key: "confirmed", label: "Confirmed", internal: "confirmed", tone: "info" },
  { key: "preparing", label: "Preparing", internal: "preparing", tone: "info" },
  { key: "ready", label: "Ready for delivery", internal: "packed", tone: "info" },
  { key: "out", label: "Out for delivery", internal: "out_for_delivery", tone: "info" },
  { key: "delivered", label: "Delivered", internal: "delivered", tone: "ok" },
  { key: "cancelled", label: "Cancelled", internal: "cancelled", tone: "danger" },
  { key: "returned", label: "Returned", internal: "returned", tone: "neutral" },
];

const INTERNAL_TO_KEY = { placed: "pending", confirmed: "confirmed", preparing: "preparing", packed: "ready", assigned: "ready", out_for_delivery: "out", delivered: "delivered", cancelled: "cancelled", returned: "returned" };
export const sellerStatusOf = (status) => SELLER_STATUSES.find((s) => s.key === (INTERNAL_TO_KEY[status] || "pending"));

/** Next forward step a seller can take, and the extra exits from each stage. */
/* A shop takes an order as far as "ready for delivery". From there it belongs to the delivery module (Phase 7):
   a rider picks it up and completes it with the customer's code, so there is no seller "out"/"delivered" step. */
const FORWARD = {
  pending: { to: "confirmed", label: "Confirm order" },
  confirmed: { to: "preparing", label: "Start preparing" },
  preparing: { to: "packed", label: "Mark ready for delivery" },
};
export const nextSellerStep = (status) => FORWARD[sellerStatusOf(status).key] || null;

/** Money is a separate axis from fulfilment. A non-COD order is "prepaid"; it is only paid once the backend says so. */
export const isPrepaid = (order) => !!order?.paymentMethod && order.paymentMethod !== "cod";
export const isPaymentCleared = (order) => !isPrepaid(order) || order.paymentStatus === "paid";

/** The next step a shop can take on this order, and whether the backend's payment gate currently blocks it. The backend
 *  sends `order.actions` (see domain/orderRules.js) — that is preferred; the local rule is only a fallback for an order
 *  object that doesn't carry it. The server re-checks everything either way. */
export function nextSellerAction(order) {
  const step = nextSellerStep(order.status);
  if (!step) return null;
  const blocked = order.actions ? !!order.actions.blocked && order.actions.next === step.to : step.to === "packed" && !isPaymentCleared(order);
  return { ...step, blocked, reason: blocked ? "Payment pending — packing and dispatch unlock once the payment is confirmed." : null };
}

/* Cancelling is only possible before "packed" — exactly what the backend allows (TOO_LATE_TO_CANCEL from "packed" on).
   Accepts an order (uses the server's own `actions.canCancel` when present) or a bare status string. */
const CANCELLABLE = ["placed", "confirmed", "preparing"];
export const canCancel = (orderOrStatus) => {
  if (orderOrStatus && typeof orderOrStatus === "object") {
    return typeof orderOrStatus.actions?.canCancel === "boolean" ? orderOrStatus.actions.canCancel : CANCELLABLE.includes(orderOrStatus.status);
  }
  return CANCELLABLE.includes(orderOrStatus);
};
export const canReturn = (status) => sellerStatusOf(status).key === "delivered";
export const isOpenOrder = (status) => ["pending", "confirmed", "preparing", "ready"].includes(sellerStatusOf(status).key);
export const isRevenueOrder = (status) => !["cancelled", "returned"].includes(status);

/* ------------------------- derived payment / delivery ------------------------ */
/** Payment display state — the backend's `paymentStatus` is the single source of truth ("pending" | "paid" | "refunded" |
 *  "not_collected"). Choosing a prepaid method never shows "Paid"; a missing status is treated as pending, never as paid. */
export function paymentStatusOf(order) {
  const prepaid = isPrepaid(order);
  const state = order.paymentStatus || "pending";
  const base = { prepaid, state, paid: state === "paid" };
  if (state === "refunded") return { ...base, label: "Refunded", tone: "neutral", amountLabel: "Amount refunded" };
  if (state === "not_collected") return { ...base, label: "Not collected", tone: "neutral", amountLabel: "Amount" };
  if (state === "paid") {
    // A cancelled order whose captured payment hasn't been refunded yet.
    if (order.status === "cancelled") return { ...base, label: "Refund pending", tone: "warn", amountLabel: "Amount paid" };
    return { ...base, label: prepaid ? "Paid" : "Paid (cash)", tone: "ok", amountLabel: "Amount paid" };
  }
  if (order.status === "cancelled") return { ...base, label: "Not collected", tone: "neutral", amountLabel: "Amount" };
  return prepaid
    ? { ...base, label: "Payment pending", tone: "warn", amountLabel: "Amount" }
    : { ...base, label: "Cash due", tone: "warn", amountLabel: "Amount due" };
}

/** Labels the seller's payment filter offers (kept next to paymentStatusOf so they can't drift apart). */
export const PAYMENT_FILTERS = ["Paid", "Payment pending", "Cash due", "Paid (cash)", "Refund pending", "Refunded", "Not collected"];

export function deliveryStatusOf(order) {
  switch (sellerStatusOf(order.status).key) {
    case "pending": case "confirmed": case "preparing": return { label: "Not dispatched", tone: "neutral" };
    case "ready": return { label: "Awaiting pickup", tone: "info" };
    case "out": return { label: "In transit", tone: "info" };
    case "delivered": return { label: "Delivered", tone: "ok" };
    case "returned": return { label: "Returned", tone: "neutral" };
    default: return { label: "—", tone: "neutral" };
  }
}

export const PAYMENT_LABELS = { card: "Card", upi: "UPI / wallet", netbanking: "Net banking", cod: "Cash on delivery" };
