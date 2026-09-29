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
export const canCancel = (status) => ["pending", "confirmed", "preparing", "ready"].includes(sellerStatusOf(status).key);
export const canReturn = (status) => sellerStatusOf(status).key === "delivered";
export const isOpenOrder = (status) => ["pending", "confirmed", "preparing", "ready"].includes(sellerStatusOf(status).key);
export const isRevenueOrder = (status) => !["cancelled", "returned"].includes(status);

/* ------------------------- derived payment / delivery ------------------------ */
export function paymentStatusOf(order) {
  const prepaid = order.paymentMethod && order.paymentMethod !== "cod";
  if (order.status === "cancelled") return prepaid ? { label: "Refunded", tone: "neutral" } : { label: "Not collected", tone: "neutral" };
  if (order.status === "returned") return { label: "Refunded", tone: "neutral" };
  if (prepaid) return { label: "Paid", tone: "ok" };
  return order.status === "delivered" ? { label: "Paid (cash)", tone: "ok" } : { label: "Cash due", tone: "warn" };
}

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
