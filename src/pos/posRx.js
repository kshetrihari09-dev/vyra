/* Prescription rules for the till — pure, unit-tested in posRx.test.js.

   The storefront refuses a prescription-required medicine without an approved prescription; the till now enforces the same rule, and the SERVER is
   the authority (backend/src/services/purchasing.service.js + domain/posPrescription.js). Everything here only decides what the screen asks for and
   when it lets the cashier proceed, so a sale isn't sent just to be refused. The limits below mirror config/pos.js RX_MAX_AGE_DAYS. */

export const RX_MAX_AGE_DAYS = 180;
const DAY = 86_400_000;
const pad = (n) => String(n).padStart(2, "0");
/** Local calendar date as YYYY-MM-DD (what a <input type="date"> uses), not UTC — a prescription written "today" must be today for the cashier. */
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = (now = new Date()) => isoDate(now);
export const oldestIssueISO = (now = new Date()) => isoDate(new Date(now.getTime() - RX_MAX_AGE_DAYS * DAY));

/** Lines in the cart that need a prescription (flagged when added, from the product's own `flags.prescriptionRequired`). */
export const rxLines = (cart) => cart.filter((l) => l.rx);
export const rxProductIds = (cart) => [...new Set(rxLines(cart).map((l) => l.productId))];
export const rxProductNames = (cart) => [...new Set(rxLines(cart).map((l) => l.name))];

/**
 * Can this sale proceed as far as prescriptions go?
 * → { required, ready, reason: null | "pharmacist" | "missing", message }
 *   pharmacist — the signed-in user can't verify prescriptions (only prescriptions:review can), so they cannot dispense it
 *   missing    — a pharmacist hasn't recorded the prescription yet
 */
export function rxGate({ cart, rx, canVerify }) {
  const names = rxProductNames(cart);
  if (!names.length) return { required: false, ready: true, reason: null, message: "" };
  if (!canVerify) return { required: true, ready: false, reason: "pharmacist", message: `A pharmacist must verify the prescription for ${names.join(", ")}.` };
  if (!rx) return { required: true, ready: false, reason: "missing", message: `A prescription is required for ${names.join(", ")}.` };
  return { required: true, ready: true, reason: null, message: "" };
}

/** An online prescription must cover EVERY prescription medicine in the cart (adding another Rx item later can invalidate it). */
export const coversAll = (coveredIds, neededIds) => { const c = new Set(coveredIds || []); return neededIds.every((id) => c.has(id)); };

/**
 * The paper-prescription form → { ok, errors, prescription }. `prescription` is exactly what the API takes (explicit fields only).
 * Mirrors the server's rules so the cashier is told what's wrong before anything is sent.
 */
export function validatePaperRx(form, now = new Date()) {
  const errors = {};
  const patientName = String(form?.patientName ?? "").trim().replace(/\s+/g, " ");
  const prescriberName = String(form?.prescriberName ?? "").trim().replace(/\s+/g, " ");
  if (!patientName) errors.patientName = "Enter the patient's name from the prescription.";
  if (!prescriberName) errors.prescriberName = "Enter the prescriber's name.";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(form?.issuedOn ?? ""));
  const issued = m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  if (!issued || issued.getDate() !== +m[3]) errors.issuedOn = "Enter the date the prescription was issued.";
  else if (isoDate(issued) > todayISO(now)) errors.issuedOn = "The prescription date can't be in the future.";
  else if (isoDate(issued) < oldestIssueISO(now)) errors.issuedOn = `This prescription is older than ${RX_MAX_AGE_DAYS} days and can't be dispensed against.`;
  if (form?.verified !== true) errors.verified = "Confirm that you have checked the original prescription.";
  if (Object.keys(errors).length) return { ok: false, errors, prescription: null };
  const regNo = String(form.prescriberRegNo ?? "").trim();
  const notes = String(form.notes ?? "").trim();
  return {
    ok: true, errors: {},
    prescription: {
      source: "in_store", patientName: patientName.slice(0, 100), prescriberName: prescriberName.slice(0, 100),
      ...(regNo ? { prescriberRegNo: regNo.slice(0, 40) } : {}), issuedOn: form.issuedOn, ...(notes ? { notes: notes.slice(0, 300) } : {}), verified: true,
    },
  };
}

/** What the cashier sees once a prescription is attached. rx = { payload, summary } as built by the sheet. */
export function describeRx(rx) {
  if (!rx) return null;
  const s = rx.summary;
  return rx.payload.source === "online"
    ? { title: `App prescription · ${s.customerName || "customer"}`, detail: `Approved ${s.approvedOn || ""}`.trim() }
    : { title: `${s.patientName} · Dr. ${String(s.prescriberName).replace(/^dr\.?\s+/i, "")}`, detail: `Issued ${s.issuedOn}${s.prescriberRegNo ? ` · Reg ${s.prescriberRegNo}` : ""}` };
}
