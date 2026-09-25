/* Seed applications so the admin queue and the "my application" screens have
   something real to show on first load — one mid-review, one rejected. */
export const SEED_SHOP_APPLICATIONS = [
  {
    id: "app-2001", status: "under_review", createdAt: "2026-09-12T10:00:00", submittedAt: "2026-09-12T11:30:00",
    owner: { name: "Sabina Karki", mobile: "9812345678", email: "sabina.karki@example.com", mobileVerified: true },
    shop: {
      name: "Karki General Store", shopType: "general", contact: "9812345678", email: "karkigeneral@example.com",
      logo: null, banner: null, description: "A neighbourhood general store stocking groceries, snacks and daily essentials.",
      address: "Ward 4, New Road", provinceId: "bagmati", districtId: "kathmandu", municipalityId: "ktm-metro", ward: "4", landmark: "Near Basantapur", lat: null, lng: null,
    },
    pharmacy: null,
    documents: [
      { id: "d1", type: "business_reg", fileName: "business_registration.pdf", uploadedAt: "2026-09-12T10:20:00", verificationStatus: "verified" },
      { id: "d2", type: "pan_vat", fileName: "pan_certificate.pdf", uploadedAt: "2026-09-12T10:22:00", verificationStatus: "pending" },
      { id: "d3", type: "owner_id", fileName: "citizenship.jpg", uploadedAt: "2026-09-12T10:25:00", verificationStatus: "pending" },
    ],
    operations: {
      hours: { Mon: { open: "09:00", close: "20:00", closed: false }, Tue: { open: "09:00", close: "20:00", closed: false }, Wed: { open: "09:00", close: "20:00", closed: false }, Thu: { open: "09:00", close: "20:00", closed: false }, Fri: { open: "09:00", close: "20:00", closed: false }, Sat: { open: "09:00", close: "20:00", closed: false }, Sun: { open: "", close: "", closed: true } },
      deliveryAvailable: true, pickupAvailable: true, deliveryRadiusKm: 5, deliveryFee: 1.5, freeDeliveryAbove: 20, minOrderAmount: 3, prepTimeMinutes: 20,
    },
    settlement: { accountHolder: "Sabina Karki", bankName: "Global IME Bank", accountNumber: "0123456789012", branch: "New Road", walletProvider: "eSewa", walletNumber: "9812345678" },
    history: [
      { status: "draft", at: "2026-09-11T09:00:00", actor: "Sabina Karki", note: "Application started" },
      { status: "submitted", at: "2026-09-12T11:30:00", actor: "Sabina Karki", note: "Submitted for review" },
      { status: "under_review", at: "2026-09-12T11:31:00", actor: "System", note: "Queued for admin review" },
    ],
    sellerId: null, needsCorrection: false, rejectionReason: null,
  },
  {
    id: "app-2002", status: "rejected", createdAt: "2026-09-05T08:00:00", submittedAt: "2026-09-05T09:00:00",
    owner: { name: "Rajesh Thapa", mobile: "9865012345", email: "rajesh.thapa@example.com", mobileVerified: true },
    shop: {
      name: "Thapa Pharmacy", shopType: "pharmacy", contact: "9865012345", email: "thapapharmacy@example.com",
      logo: null, banner: null, description: "Community pharmacy serving the Pokhara lakeside area.",
      address: "Lakeside Road, Ward 6", provinceId: "gandaki", districtId: "kaski", municipalityId: "pokhara-metro", ward: "6", landmark: "Opposite Fewa Lake", lat: null, lng: null,
    },
    pharmacy: {
      licenseNumber: "PH-2021-0456", licenseIssueDate: "2021-03-01", licenseExpiryDate: "2026-03-01",
      pharmacistName: "Rajesh Thapa", pharmacistRegNumber: "NP-PHM-8890",
    },
    documents: [
      { id: "d1", type: "business_reg", fileName: "business_registration.pdf", uploadedAt: "2026-09-05T08:10:00", verificationStatus: "verified" },
      { id: "d2", type: "pan_vat", fileName: "pan_certificate.pdf", uploadedAt: "2026-09-05T08:12:00", verificationStatus: "verified" },
      { id: "d3", type: "owner_id", fileName: "citizenship.jpg", uploadedAt: "2026-09-05T08:14:00", verificationStatus: "verified" },
      { id: "d4", type: "pharmacy_license", fileName: "pharmacy_license.pdf", uploadedAt: "2026-09-05T08:16:00", verificationStatus: "rejected", rejectionReason: "Document is expired — license shown expired on 2026-03-01. Please upload a renewed license." },
    ],
    operations: {
      hours: { Mon: { open: "08:00", close: "21:00", closed: false }, Tue: { open: "08:00", close: "21:00", closed: false }, Wed: { open: "08:00", close: "21:00", closed: false }, Thu: { open: "08:00", close: "21:00", closed: false }, Fri: { open: "08:00", close: "21:00", closed: false }, Sat: { open: "08:00", close: "21:00", closed: false }, Sun: { open: "10:00", close: "18:00", closed: false } },
      deliveryAvailable: true, pickupAvailable: true, deliveryRadiusKm: 8, deliveryFee: 2, freeDeliveryAbove: 25, minOrderAmount: 5, prepTimeMinutes: 30,
    },
    settlement: { accountHolder: "Rajesh Thapa", bankName: "Nabil Bank", accountNumber: "9988776655443", branch: "Pokhara Lakeside", walletProvider: "Khalti", walletNumber: "9865012345" },
    history: [
      { status: "draft", at: "2026-09-04T09:00:00", actor: "Rajesh Thapa", note: "Application started" },
      { status: "submitted", at: "2026-09-05T09:00:00", actor: "Rajesh Thapa", note: "Submitted for review" },
      { status: "under_review", at: "2026-09-05T09:05:00", actor: "System", note: "Queued for admin review" },
      { status: "rejected", at: "2026-09-06T14:20:00", actor: "Admin", note: "Pharmacy license document is expired. Please renew and resubmit." },
    ],
    sellerId: null, needsCorrection: true, rejectionReason: "Pharmacy license document is expired. Please renew and resubmit.",
  },
];
