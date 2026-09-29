import { api, request } from "./client.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Server application DTO -> the UI's application shape (utils/shopApplication.js blankApplication). */
export function applicationFromApi(a) {
  const history = [{ status: "submitted", at: a.submittedAt, actor: "Applicant", note: "Submitted for review" }];
  if (a.decidedAt) history.push({ status: a.status, at: a.decidedAt, actor: "Vyra admin", note: a.rejectionReason || (a.status === "approved" ? "Application approved" : "") });
  return {
    id: a.id, fromServer: true, status: a.status, submittedAt: a.submittedAt, createdAt: a.submittedAt,
    needsCorrection: a.needsCorrection, rejectionReason: a.rejectionReason, sellerId: a.sellerId, userId: a.userId,
    owner: { name: a.ownerName || "", mobile: a.shopContact, email: a.ownerEmail || a.shopEmail || "", mobileVerified: true },
    shop: {
      name: a.shopName, shopType: a.shopType, contact: a.shopContact, email: a.shopEmail || "", logo: null, banner: null, description: a.shopDescription || "",
      address: a.address.line, provinceId: a.address.provinceId, districtId: a.address.districtId, municipalityId: a.address.municipalityId,
      ward: a.address.ward, landmark: a.address.landmark || "", lat: a.address.lat, lng: a.address.lng,
    },
    pharmacy: a.pharmacy ? {
      licenseNumber: a.pharmacy.licenseNumber, licenseIssueDate: a.pharmacy.licenseIssued, licenseExpiryDate: a.pharmacy.licenseExpires,
      pharmacistName: a.pharmacy.pharmacistName, pharmacistRegNumber: a.pharmacy.pharmacistRegNumber,
    } : null,
    documents: a.documents.map((d) => ({ id: d.id, type: d.type, fileName: d.fileName, mimeType: d.mimeType, fileUrl: d.fileUrl, sizeBytes: d.sizeBytes, verificationStatus: d.verificationStatus, rejectionReason: d.rejectionReason })),
    operations: a.operations,
    settlement: { accountHolder: a.settlement.accountHolder, bankName: a.settlement.bankName || "", branch: a.settlement.branch || "", walletProvider: a.settlement.walletProvider || "", accountNumber: a.settlement.accountNumber || "", walletNumber: a.settlement.walletNumber || "" },
    history,
  };
}

/** UI application shape -> POST body. Documents that already live on the server (no data URL) are omitted. */
export function applicationToApi(app) {
  const num = (v) => (v === "" || v == null ? undefined : Number(v));
  const ops = app.operations || {};
  const hours = {};
  DAYS.forEach((d) => { if (ops.hours?.[d]) hours[d] = ops.hours[d]; });
  const s = app.settlement || {};
  return {
    shopName: app.shop.name, shopType: app.shop.shopType, shopContact: app.shop.contact, shopEmail: app.shop.email || undefined,
    shopDescription: app.shop.description || undefined,
    address: { line: app.shop.address, provinceId: app.shop.provinceId, districtId: app.shop.districtId, municipalityId: app.shop.municipalityId, ward: String(app.shop.ward), landmark: app.shop.landmark || undefined, lat: num(app.shop.lat), lng: num(app.shop.lng) },
    pharmacy: app.pharmacy ? {
      licenseNumber: app.pharmacy.licenseNumber, licenseIssued: app.pharmacy.licenseIssueDate || app.pharmacy.licenseExpiryDate, licenseExpires: app.pharmacy.licenseExpiryDate,
      pharmacistName: app.pharmacy.pharmacistName, pharmacistRegNumber: app.pharmacy.pharmacistRegNumber,
    } : undefined,
    operations: { hours, deliveryAvailable: !!ops.deliveryAvailable, pickupAvailable: !!ops.pickupAvailable, deliveryRadiusKm: num(ops.deliveryRadiusKm), deliveryFee: num(ops.deliveryFee), freeDeliveryAbove: num(ops.freeDeliveryAbove), minOrderAmount: num(ops.minOrderAmount), prepTimeMinutes: num(ops.prepTimeMinutes) },
    settlement: { accountHolder: s.accountHolder, bankName: s.bankName || undefined, branch: s.branch || undefined, walletProvider: s.walletProvider || undefined, accountNumber: s.accountNumber || undefined, walletNumber: s.walletNumber || undefined },
    documents: (app.documents || []).filter((d) => typeof d.fileUrl === "string" && d.fileUrl.startsWith("data:"))
      .map((d) => ({ type: d.type, fileName: d.fileName, mimeType: d.mimeType || /^data:([^;]+)/.exec(d.fileUrl)?.[1], dataBase64: d.fileUrl })),
  };
}

export const shopApplicationsApi = {
  list: async () => (await api.get("/seller-applications")).applications.map(applicationFromApi),
  submit: async (app) => applicationFromApi((await api.post("/seller-applications", applicationToApi(app))).application),
  resubmit: async (app) => applicationFromApi((await api.post(`/seller-applications/${app.id}/resubmit`, applicationToApi(app))).application),
  decide: async (id, { decision, reason, commissionRate }) => applicationFromApi((await api.post(`/seller-applications/${id}/decide`, { decision, reason: reason || undefined, commissionRate })).application),
  verifyDocument: async (appId, docId, { status, reason }) => (await api.post(`/seller-applications/${appId}/documents/${docId}/verify`, { status, reason: reason || undefined })).document,
  /** The file route is bearer-authenticated like every other call, so a plain <img src> can't load it — same
      blob-URL approach as prescriptions. The caller revokes the URL. */
  async fetchDocumentBlobUrl(appId, docId) {
    const res = await request(`/seller-applications/${appId}/documents/${docId}/file`, { raw: true });
    return URL.createObjectURL(await res.blob());
  },
};
