/* Duplicate-check registry for the new Customer / Shop-Owner registration
   flows. These are separate from the legacy demo seed customer (whose
   phone/email use a different, pre-existing format) so old data is never
   invalidated — this registry only governs NEW self-registrations. */
export const REGISTERED_MOBILES = ["9841234567"]; // pretend an existing customer already holds this number
export const REGISTERED_EMAILS = ["existing.customer@example.com"];
