import { useEffect, useState } from "react";
import { deliveryApi } from "../services/api/deliveryApi.js";

let cached = null;      // the schedule is public and static: fetch it once per page load
let inflight = null;

/** The published delivery fee schedule (base fees + distance tiers), or null until/unless it loads. Never blocks the UI. */
export function useDeliveryPricing() {
  const [pricing, setPricing] = useState(cached);
  useEffect(() => {
    if (cached) return undefined;
    let alive = true;
    inflight ??= deliveryApi.pricing().then((p) => { cached = p; return p; }).catch(() => { inflight = null; return null; });
    inflight.then((p) => { if (alive && p) setPricing(p); });
    return () => { alive = false; };
  }, []);
  return pricing;
}
