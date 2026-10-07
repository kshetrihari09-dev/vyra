/**
 * Display helpers for the distance-based delivery charge. The SERVER decides every fee (backend domain/deliveryPricing.js);
 * these functions only format what it returned, and show the other options' fees next to the selected one.
 *
 *   fee = option base fee (free above the option's threshold)  +  distance charge for the address
 */
const round2 = (n) => Math.round(n * 100) / 100;

export const baseFeeFor = (option, taxable) => (option.freeAbove && taxable >= option.freeAbove ? 0 : option.fee);

/** Total fee for ANY option at this address (the server returned the distance charge for the selected one; it is the same for all). */
export const optionFee = (option, delivery, taxable) => round2(baseFeeFor(option, taxable) + (delivery?.distanceFee ?? 0));

/** "2.8 km" — or null when the distance couldn't be known. */
export const distanceLabel = (delivery) => (delivery?.distanceKm == null ? null : `${delivery.distanceKm} km`);

/**
 * What the shopper should be told about how the fee was worked out.
 * kind: "pin" (exact), "no_pin" (estimate — nudge to add a pin), "out_of_range" (blocked), "none" (nothing to say yet)
 */
export function feeBasis(delivery) {
  if (!delivery) return { kind: "none" };
  if (!delivery.deliverable) return { kind: "out_of_range", km: delivery.distanceKm, maxKm: delivery.maxKm };
  if (delivery.basis === "address_pin") return { kind: "pin", km: delivery.distanceKm, distanceFee: delivery.distanceFee };
  return { kind: "no_pin", distanceFee: delivery.distanceFee };
}

/** One line for the product page, from the published schedule: "Free within 2 km · fee by distance beyond". */
export function scheduleNote(pricing, fmt) {
  const tiers = pricing?.distance?.tiers;
  if (!tiers?.length) return null;
  const first = tiers[0];
  return first.fee === 0
    ? `Free within ${first.toKm} km · fee by distance beyond`
    : `Delivery from ${fmt(first.fee)} · fee by distance`;
}
