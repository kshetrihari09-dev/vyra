/**
 * The rider's five actions, in order:
 *   Accept → Arrived at pickup → Picked up → Start delivery → Delivered
 * Derived from the delivery the SERVER returned (status + two timestamps) — nothing is remembered on the client, so a reload
 * or a second device always shows the right next button. The server enforces the same order; this only keeps the UI honest.
 */
export const RUN_STEPS = Object.freeze([
  { id: "accept", label: "Accept" },
  { id: "arrived", label: "Arrived at pickup" },
  { id: "pickup", label: "Picked up" },
  { id: "start", label: "Start delivery" },
  { id: "complete", label: "Delivered" },
]);

/** How many of the five are done (0–5). */
export function completedSteps(d) {
  switch (d?.status) {
    case "assigned": return 0;
    case "accepted": return d.arrivedPickupAt ? 2 : 1;
    case "picked_up": return d.startedAt ? 4 : 3;
    case "delivered": return 5;
    default: return 0;
  }
}

/** The one action the rider should take now, or null when there is none (finished runs). */
export const nextAction = (d) => (["assigned", "accepted", "picked_up"].includes(d?.status) ? RUN_STEPS[completedSteps(d)] : null);

/** Where the rider is heading right now. */
export const currentTarget = (d) => (d?.status === "picked_up" ? "customer" : "store");

/** The device may share its position only for these states — mirrors the server's rule. */
export const sharesLocation = (d) => d?.status === "accepted" || d?.status === "picked_up";

/**
 * The delivery a rider should be dropped straight into after signing in: one they have accepted and not finished
 * (accepted or picked up). A parcel already collected outranks one still on its way to pickup. A run only *assigned* (not yet
 * accepted) is a decision for the rider, not work in progress, so it never auto-opens. Returns null when nothing is in flight.
 */
export function inFlightDelivery(deliveries) {
  const list = (Array.isArray(deliveries) ? deliveries : []).filter(sharesLocation);
  return list.find((d) => d.status === "picked_up") || list[0] || null;
}
