/* Pure helpers for the pharmacist-support screens (no React, no network) so the rules are unit-tested. */

export const MAX_MESSAGE_CHARS = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => UUID.test(String(v ?? ""));

export const newClientId = () => (globalThis.crypto?.randomUUID?.() ?? "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16)));

/** A `tel:` link only for something that really looks like a phone number; otherwise null (the Call action is then disabled). */
export function telHref(tel) {
  const digits = String(tel ?? "").replace(/[\s().-]/g, "");
  return /^\+?[0-9]{7,15}$/.test(digits) ? `tel:${digits}` : null;
}

/** mailto: fallback for when the in-app form can't deliver. null without a plausible address. */
export function mailtoHref(address, { subject, body } = {}) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(address ?? ""))) return null;
  const qs = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(String(body).slice(0, 1500))}`].filter(Boolean).join("&");
  return `mailto:${address}${qs ? `?${qs}` : ""}`;
}

/** Server messages replace the local (optimistic) copy that carries the same clientMessageId; everything is de-duplicated by id and kept in order. */
export function mergeMessages(existing, incoming) {
  const byId = new Map();
  const serverClientIds = new Set(incoming.map((m) => m.clientMessageId).filter(Boolean));
  for (const m of existing) {
    if (m.localState && serverClientIds.has(m.clientMessageId)) continue;   // confirmed by the server: drop the placeholder
    byId.set(m.id, m);
  }
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => {
    const as = a.seq ?? Infinity; const bs = b.seq ?? Infinity;      // unsent local messages sit at the end
    return as !== bs ? as - bs : new Date(a.createdAt) - new Date(b.createdAt);
  });
}

export const lastSeq = (messages) => messages.reduce((n, m) => (m.seq ? Math.max(n, m.seq) : n), 0);

/** True when the newest message came from the other side and hasn't been marked read — drives "mark as read". */
export const hasUnreadFromStaff = (conversation) => (conversation?.unread ?? 0) > 0;

/** What the contact card says about live chat — one place so every screen shows the same truth. */
export function chatAvailability({ signedIn, contact, error }) {
  if (error) return { tone: "muted", label: "Availability unavailable" };
  if (!contact) return { tone: "muted", label: "Checking availability…" };
  if (!signedIn) return { tone: "muted", label: "Sign in to chat" };
  return contact.chat.available ? { tone: "ok", label: "Pharmacist online" } : { tone: "muted", label: "No pharmacist online" };
}

/** Errors that mean "the order/product/prescription we tried to link isn't valid" — the message itself is fine, so resend without the link. */
export const isBadReference = (err) => ["ORDER_NOT_FOUND", "PRODUCT_NOT_FOUND", "PRESCRIPTION_NOT_FOUND"].includes(err?.code) || (err?.status === 400 && Object.keys(err?.fieldErrors || {}).some((k) => /Id$/.test(k)));

export const stripRefs = ({ orderId, productId, prescriptionId, ...rest }) => rest; // eslint-disable-line no-unused-vars

/** Customer-facing wording for a failed email submission. Never says "sent". */
export function formErrorMessage(err) {
  switch (err?.code) {
    case "EMAIL_NOT_CONFIGURED": return "Email isn't available right now. Please use live chat or call instead.";
    case "EMAIL_DELIVERY_FAILED": return "We couldn't send your message by email just now. Your text is still here — please try again.";
    case "SUBMISSION_IN_PROGRESS": return "Your message is still being sent. Wait a moment, then press Retry.";
    case "RATE_LIMITED": return "You've sent several messages in a short time. Please wait a little before sending another.";
    case "NETWORK_ERROR": return "Can't reach the server. Your text is kept — check your connection and retry.";
    case "UNAUTHENTICATED": case "INVALID_TOKEN": return "Your session expired. Sign in again — your text will still be here.";
    default: return err?.message || "Something went wrong. Please try again.";
  }
}
