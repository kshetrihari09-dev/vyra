import { api } from "./client.js";

/** Phase 7. /rider/* is the rider app, /delivery/* is dispatch, /orders/:id/tracking is the customer's live view. */
export const deliveryApi = {
  // ---- rider
  me: async () => (await api.get("/rider/me")).rider,
  setAvailability: async (available) => (await api.put("/rider/me/availability", { available })).rider,
  mine: async (scope = "active") => (await api.get("/rider/deliveries", { scope })).deliveries,
  available: async () => (await api.get("/rider/available-orders")).orders,
  claim: async (orderId) => (await api.post(`/rider/orders/${orderId}/claim`)).delivery,
  accept: async (id) => (await api.post(`/rider/deliveries/${id}/accept`)).delivery,
  decline: async (id, reason) => (await api.post(`/rider/deliveries/${id}/decline`, { reason: reason || undefined })).delivery,
  /** Rider is at the store. Status stays "accepted"; the customer's stage detail changes. */
  arrived: async (id) => (await api.post(`/rider/deliveries/${id}/arrived`)).delivery,
  /** After pickup: heading to the customer now. */
  start: async (id) => (await api.post(`/rider/deliveries/${id}/start`)).delivery,
  pickup: async (id) => (await api.post(`/rider/deliveries/${id}/pickup`)).delivery,
  sendLocation: (id, { lat, lng, accuracy }) => api.post(`/rider/deliveries/${id}/location`, { lat, lng, accuracy: accuracy ?? undefined }),
  /** The code is checked by the server; the rider never has it. Wrong-code errors carry the attempts left in `message`. */
  deliver: async (id, { otp, cashCollected }) => (await api.post(`/rider/deliveries/${id}/deliver`, { otp: otp || undefined, cashCollected })).delivery,
  fail: async (id, { reason, note }) => (await api.post(`/rider/deliveries/${id}/fail`, { reason, note: note || undefined })).delivery,

  // ---- dispatch (delivery:manage)
  riders: async () => (await api.get("/delivery/riders")).riders,
  createRider: async (body) => (await api.post("/delivery/riders", body)).rider,
  updateRider: async (id, body) => (await api.put(`/delivery/riders/${id}`, body)).rider,
  /** Existing ACTIVE accounts, for the Add Rider picker. Riders are ordinary users + the delivery role — never a second account. */
  findUsers: async (q) => (await api.get("/admin/users", { q: q || undefined, status: "active", pageSize: 8 })).items,
  active: async () => (await api.get("/delivery/active")).deliveries,
  assign: async (orderId, riderId) => (await api.post(`/delivery/orders/${orderId}/assign`, { riderId })).delivery,
  reassign: async (deliveryId, riderId) => (await api.post(`/delivery/deliveries/${deliveryId}/reassign`, { riderId })).delivery,
  unassign: async (deliveryId, reason) => (await api.post(`/delivery/deliveries/${deliveryId}/unassign`, { reason: reason || undefined })).delivery,
  resetOtp: (orderId) => api.post(`/delivery/orders/${orderId}/reset-otp`),

  /** The published fee schedule (public): base fees per option + the distance tiers. */
  pricing: async () => api.get("/delivery/pricing"),

  // ---- a shop asks on-duty riders to collect its packed order
  requestDelivery: (orderId) => api.post(`/orders/${orderId}/request-delivery`),
  setBranchLocation: async (branchId, { lat, lng }) => (await api.put(`/delivery/branches/${branchId}/location`, { lat, lng })).branch,

  // ---- customer / dispatch / the order's shop
  tracking: async (orderId) => (await api.get(`/orders/${orderId}/tracking`)).tracking,
};

export const VEHICLE_TYPES = ["Bike", "Scooter", "Motorbike", "Bicycle", "Car", "Van"];

/** The `vehicle` column is one text field, written "Type · Number". */
export const composeVehicle = (type, number) => [type?.trim(), number?.trim()].filter(Boolean).join(" · ");

export const FAILURE_REASONS = [
  { id: "customer_unreachable", label: "Customer unreachable" },
  { id: "wrong_address", label: "Wrong or unfindable address" },
  { id: "customer_refused", label: "Customer refused the order" },
  { id: "unsafe_location", label: "Unsafe location" },
  { id: "other", label: "Other" },
];
