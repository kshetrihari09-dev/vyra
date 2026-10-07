import { stockFor, maxAddable } from "./inventory.js";
import { hasModule } from "../data/categories.js";

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
export const isPhone = (v) => /^[+\d][\d\s-]{7,16}$/.test(String(v || "").trim());
/** "+977 98-1234 5678" → "9812345678" (same rule as the server's normalizePhone). */
export const normalizePhone = (v) => { let d = String(v || "").replace(/\D/g, ""); if (d.length === 13 && d.startsWith("977")) d = d.slice(3); return d; };
export const isOtp = (v) => /^\d{4}$/.test(String(v || "").trim());

/** Nepal mobile numbers: 10 digits starting 96/97/98 (covers all major carriers). */
export const isNepalMobile = (v) => /^9[678]\d{8}$/.test(String(v || "").trim());

export function passwordStrength(pw) {
  const errors = [];
  if (!pw || pw.length < 8) errors.push("at least 8 characters");
  if (!/[A-Za-z]/.test(pw || "")) errors.push("at least one letter");
  if (!/[0-9]/.test(pw || "")) errors.push("at least one number");
  return { ok: errors.length === 0, errors };
}

/**
 * Shared by Customer Registration and the Shop Owner step — one account
 * validation function, not two parallel ones, since both create the same
 * kind of user record.
 */
export function validateAccountFields({ name, mobile, email, password, confirmPassword }, registry = { mobiles: [], emails: [] }) {
  const errors = {};
  if (!name?.trim()) errors.name = "Enter your full name";
  if (!isNepalMobile(mobile)) errors.mobile = "Enter a valid mobile number (98XXXXXXXX)";
  else if (registry.mobiles.includes(mobile)) errors.mobile = "This mobile number is already registered";
  if (email?.trim()) {
    if (!isEmail(email)) errors.email = "Enter a valid email address";
    else if (registry.emails.includes(email.trim().toLowerCase())) errors.email = "This email is already registered";
  }
  const strength = passwordStrength(password);
  if (!strength.ok) errors.password = `Password needs ${strength.errors.join(", ")}`;
  if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match";
  return { ok: Object.keys(errors).length === 0, errors };
}

/** License expiry status for the pharmacy step — same day-math as batch expiry elsewhere. */
export function licenseStatus(expiryDate) {
  if (!expiryDate) return null;
  const days = Math.round((new Date(expiryDate) - new Date()) / 864e5);
  if (days < 0) return { level: "expired", label: `Expired ${Math.abs(days)} days ago`, days };
  if (days <= 30) return { level: "expiring", label: `Expires in ${days} days`, days };
  return { level: "ok", label: `Valid for ${days} more days`, days };
}

/** Masks all but the last 4 digits of a bank/wallet account number for display. */
export const maskAccountNumber = (num) => {
  const s = String(num || "");
  return s.length <= 4 ? s : "•".repeat(s.length - 4) + s.slice(-4);
};

export function validateAddress(a, { requireNepal = false } = {}) {
  const errors = {};
  if (!a.name?.trim()) errors.name = "Enter a name";
  if (!a.line1?.trim()) errors.line1 = "Enter a street address";
  if (requireNepal) {
    if (!a.provinceId) errors.provinceId = "Select a province";
    if (!a.districtId) errors.districtId = "Select a district";
    if (!a.municipalityId) errors.municipalityId = "Select a municipality";
    if (!a.ward?.trim()) errors.ward = "Enter a ward number";
  } else {
    if (!a.city?.trim()) errors.city = "Enter a city";
    if (!a.zip?.trim()) errors.zip = "Enter a postcode";
  }
  if (requireNepal) { if (!/^9[678]\d{8}$/.test(normalizePhone(a.phone))) errors.phone = "Enter a valid mobile number (98XXXXXXXX)"; }
  else if (!isPhone(a.phone)) errors.phone = "Enter a valid phone number";
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Blocks checkout when a line is unavailable, over stock, or needs an unverified prescription. */
export function validateCart(lines, storeId, { prescriptionStatus = "none" } = {}) {
  const issues = [];
  for (const l of lines) {
    const available = stockFor(l.product, l.variantId, storeId);
    if (available <= 0) issues.push({ key: l.key, type: "out", message: `${l.product.name} is out of stock at this store.` });
    else if (l.qty > available) issues.push({ key: l.key, type: "over", message: `Only ${available} of ${l.product.name} left — reduce the quantity.`, max: available });
    const max = maxAddable(l.product, l.variantId, storeId);
    if (l.qty > (l.product.maxQty || 99)) issues.push({ key: l.key, type: "limit", message: `Limit ${l.product.maxQty} per order for ${l.product.name}.`, max });
    if (l.qty < (l.product.moq || 1)) issues.push({ key: l.key, type: "moq", message: `Minimum ${l.product.moq} for ${l.product.name}.` });
  }
  const rxLines = lines.filter((l) => l.product.flags?.prescriptionRequired && hasModule(l.product.categoryId, "prescription"));
  if (rxLines.length && prescriptionStatus !== "approved") {
    issues.push({
      key: "prescription", type: "prescription",
      message: prescriptionStatus === "pending"
        ? "A pharmacist is still reviewing your prescription."
        : `${rxLines.length} item${rxLines.length > 1 ? "s" : ""} need a valid prescription before checkout.`,
    });
  }
  return { ok: issues.length === 0, issues, requiresPrescription: rxLines.length > 0, rxLines };
}
