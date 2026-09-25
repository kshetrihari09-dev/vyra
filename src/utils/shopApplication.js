import { DOCUMENT_TYPES } from "../data/documentTypes.js";
import { isPharmacyType } from "../data/shopTypes.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function blankApplication(owner) {
  const now = new Date().toISOString();
  const hours = {};
  DAYS.forEach((d) => { hours[d] = { open: "09:00", close: "20:00", closed: d === "Sun" }; });
  return {
    id: `app-${Date.now()}`, status: "draft", createdAt: now, submittedAt: null,
    owner: { name: owner?.name || "", mobile: owner?.phone || "", email: owner?.email || "", mobileVerified: !!owner?.name },
    shop: { name: "", shopType: "", contact: owner?.phone || "", email: "", logo: null, banner: null, description: "", address: "", provinceId: "", districtId: "", municipalityId: "", ward: "", landmark: "", lat: null, lng: null },
    pharmacy: null,
    documents: [],
    operations: { hours, deliveryAvailable: true, pickupAvailable: true, deliveryRadiusKm: 5, deliveryFee: 1.5, freeDeliveryAbove: 20, minOrderAmount: 3, prepTimeMinutes: 20 },
    settlement: { accountHolder: "", bankName: "", accountNumber: "", branch: "", walletProvider: "", walletNumber: "" },
    history: [{ status: "draft", at: now, actor: owner?.name || "Guest", note: "Application started" }],
    sellerId: null, needsCorrection: false, rejectionReason: null,
  };
}

export const DAY_LABELS = DAYS;

/** Replaces (or removes, if meta is null) the document of a given type. */
export function upsertDocument(app, type, meta) {
  const without = app.documents.filter((d) => d.type !== type);
  if (!meta) return without;
  return [...without, { id: `${type}-${Date.now()}`, type, ...meta }];
}

export function requiredDocsComplete(app) {
  return DOCUMENT_TYPES.filter((d) => d.required).every((d) => app.documents.some((x) => x.type === d.id));
}

export function stepComplete(app, stepId) {
  switch (stepId) {
    case "owner": return !!app.owner.name.trim() && !!app.owner.mobile && app.owner.mobileVerified;
    case "shop": return !!(app.shop.name.trim() && app.shop.shopType && app.shop.contact && app.shop.address.trim() && app.shop.provinceId && app.shop.districtId && app.shop.municipalityId && app.shop.ward);
    case "business":
      if (!isPharmacyType(app.shop.shopType)) return true;
      return !!(app.pharmacy?.licenseNumber && app.pharmacy?.licenseExpiryDate && app.documents.some((d) => d.type === "pharmacy_license"));
    case "documents": return requiredDocsComplete(app);
    case "operations": return app.operations.deliveryAvailable || app.operations.pickupAvailable;
    case "settlement": return !!(app.settlement.accountHolder && (app.settlement.accountNumber || app.settlement.walletNumber));
    default: return false;
  }
}

export function applicationChecklist(app) {
  const base = ["owner", "shop", "business", "documents", "operations", "settlement"].map((id) => ({ id, done: stepComplete(app, id) }));
  base.push({ id: "verification", done: app.status === "approved", pending: ["submitted", "under_review"].includes(app.status) });
  return base;
}

export const canSubmit = (app) => ["owner", "shop", "business", "documents", "operations", "settlement"].every((id) => stepComplete(app, id));
