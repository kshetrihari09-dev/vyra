/* How a rider is shown to staff. The STATE comes from the server (`rider.state`, computed from the same rules the
   backend enforces on assignment); this file only turns it into words and a colour. It never decides who may be
   assigned — the server re-validates every assignment — it only keeps the button honest. */

export const STATE_META = {
  available: { label: "Available", tone: "ok" },
  at_capacity: { label: "At capacity", tone: "warn" },
  off_duty: { label: "Off duty", tone: "info" },
  inactive: { label: "Inactive", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
  not_authorized: { label: "Not authorized", tone: "danger" },
};

export const stateMeta = (rider) => STATE_META[rider?.state] || { label: "Unknown", tone: "info" };

/** "2 / 5 active deliveries" */
export const capacityLine = (r) => `${r?.activeCount ?? 0} / ${r?.capacity ?? "?"} active deliveries`;

/** "Bike · BA 12 PA 1234" — either half may be missing. */
export const vehicleLine = (r) => [r?.vehicleType, r?.vehicleNumber].filter(Boolean).join(" · ") || r?.vehicle || "No vehicle on file";

/** Whether the UI should offer this rider for a new delivery. A hint only; the API decides. */
export const canOfferAssignment = (rider) => !!rider && rider.state === "available";

/** Why the button is disabled, in words. */
export const unavailableReason = (rider) => {
  switch (rider?.state) {
    case "at_capacity": return `Already has ${rider.capacity} active deliveries`;
    case "off_duty": return "Off duty — not taking deliveries";
    case "inactive": return "Rider profile or account is inactive";
    case "suspended": return "Account is suspended";
    case "not_authorized": return "No longer authorized for delivery";
    default: return "";
  }
};

/** A parcel the rider already collected, held by someone who can no longer operate — dispatch may recover it. */
export const isStranded = (delivery, riders) => {
  if (delivery?.status !== "picked_up") return false;
  const rider = riders.find((r) => r.id === delivery.riderId);
  return !!rider && !rider.authorized; // `authorized` = the server's full check: active user + role + permission + active profile
};
