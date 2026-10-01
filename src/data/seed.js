/* Seed state: a returning customer with history, so Buy Again / Reorder /
   order tracking / notifications all have something real to show. */
export const CUSTOMER = {
  id: "cus-1001", name: "Alex Morgan", email: "alex.morgan@example.com",
  phone: "+1 555 0190", emailVerified: true, phoneVerified: true,
  memberSince: "2025-08-04", orderCount: 14,
};

export const ADDRESSES = [
  { id: "addr-1", label: "Home", name: "Alex Morgan", line1: "24 Maple Court, Apt 3B", line2: "Central District", city: "Metro City", zip: "10245", phone: "+1 555 0190", isDefault: true, instructions: "Leave with the concierge if I don't answer." },
  { id: "addr-2", label: "Work", name: "Alex Morgan", line1: "Novatech Tower, Level 8", line2: "41 Commerce Road", city: "Metro City", zip: "10118", phone: "+1 555 0190", isDefault: false, instructions: "" },
];

export const CARDS = [
  { id: "card-1", brand: "Visa", last4: "4242", expiry: "08/29", isDefault: true },
  { id: "card-2", brand: "Mastercard", last4: "8810", expiry: "02/28", isDefault: false },
];

export const SEED_ORDERS = [
  {
    customer: { id: CUSTOMER.id, name: CUSTOMER.name, phone: CUSTOMER.phone, email: CUSTOMER.email },
    id: "ord-3081", number: "PN-3081", placedAt: "2026-09-15T18:20:00", storeId: "store-01",
    status: "out_for_delivery", items: [
      { productId: "masala-chips", variantId: null, qty: 3, unitPrice: 1.65 },
      { productId: "cold-brew-coffee", variantId: "cb-o", qty: 1, unitPrice: 7.2 },
      { productId: "greek-yogurt", variantId: null, qty: 2, unitPrice: 2.99 },
    ],
    addressId: "addr-1", paymentMethod: "card", deliveryOption: "express",
    totals: { subtotal: 18.13, discount: 1.81, deliveryFee: 2.99, tax: 0.91, total: 20.22 },
    otp: "4827", otpRequired: true, partner: { name: "Daniel R.", phone: "+1 555 0231", vehicle: "Scooter · MC-4418" },
    eta: "2026-09-16T10:35:00", history: [
      { status: "placed", at: "2026-09-15T18:20:00" }, { status: "confirmed", at: "2026-09-15T18:22:00" },
      { status: "preparing", at: "2026-09-15T18:31:00" }, { status: "packed", at: "2026-09-15T18:52:00" },
      { status: "assigned", at: "2026-09-16T09:58:00" }, { status: "out_for_delivery", at: "2026-09-16T10:12:00" },
    ],
  },
  {
    customer: { id: CUSTOMER.id, name: CUSTOMER.name, phone: CUSTOMER.phone, email: CUSTOMER.email },
    id: "ord-2977", number: "PN-2977", placedAt: "2026-09-02T11:05:00", storeId: "store-01",
    status: "delivered", items: [
      { productId: "paracetamol-500", variantId: null, qty: 2, unitPrice: 2.5 },
      { productId: "vitamin-c-1000", variantId: "vc30", qty: 1, unitPrice: 12.0 },
      { productId: "toothpaste-gel", variantId: null, qty: 1, unitPrice: 4.4 },
    ],
    addressId: "addr-1", paymentMethod: "upi", deliveryOption: "standard",
    totals: { subtotal: 21.4, discount: 2.14, deliveryFee: 0, tax: 1.07, total: 20.33 },
    otp: null, otpRequired: true, deliveredAt: "2026-09-02T14:40:00",
    partner: { name: "Priya S.", phone: "+1 555 0288", vehicle: "Bike · MC-2210" },
    history: [
      { status: "placed", at: "2026-09-02T11:05:00" }, { status: "confirmed", at: "2026-09-02T11:07:00" },
      { status: "preparing", at: "2026-09-02T11:40:00" }, { status: "packed", at: "2026-09-02T12:15:00" },
      { status: "assigned", at: "2026-09-02T13:20:00" }, { status: "out_for_delivery", at: "2026-09-02T13:55:00" },
      { status: "delivered", at: "2026-09-02T14:40:00" },
    ],
  },
  {
    customer: { id: CUSTOMER.id, name: CUSTOMER.name, phone: CUSTOMER.phone, email: CUSTOMER.email },
    id: "ord-2810", number: "PN-2810", placedAt: "2026-08-19T09:14:00", storeId: "store-02",
    status: "delivered", items: [
      { productId: "cotton-tshirt", variantId: "ts-m-b", qty: 1, unitPrice: 19.6 },
      { productId: "canvas-tote", variantId: null, qty: 1, unitPrice: 24.0 },
    ],
    addressId: "addr-2", paymentMethod: "card", deliveryOption: "standard",
    totals: { subtotal: 43.6, discount: 4.36, deliveryFee: 0, tax: 2.18, total: 41.42 },
    otp: null, otpRequired: false, deliveredAt: "2026-08-19T16:02:00",
    partner: { name: "Marco T.", phone: "+1 555 0302", vehicle: "Van · MV-7781" },
    history: [
      { status: "placed", at: "2026-08-19T09:14:00" }, { status: "confirmed", at: "2026-08-19T09:16:00" },
      { status: "preparing", at: "2026-08-19T10:02:00" }, { status: "packed", at: "2026-08-19T11:30:00" },
      { status: "assigned", at: "2026-08-19T13:10:00" }, { status: "out_for_delivery", at: "2026-08-19T14:25:00" },
      { status: "delivered", at: "2026-08-19T16:02:00" },
    ],
  },
];

export const SEED_NOTIFICATIONS = [
  { id: "n1", kind: "delivery", title: "Out for delivery", message: "Order PN-3081 is on its way. Share OTP 4827 with the rider.", time: "12 min ago", unread: true },
  { id: "n2", kind: "price", title: "Price drop", message: "Vitamin C Glow Serum is now 25% off — down to Rs. 25.50.", time: "2 hours ago", unread: true },
  { id: "n3", kind: "stock", title: "Back in stock", message: "Body Wash · Lavender is available again at Riverside.", time: "Yesterday", unread: false },
  { id: "n4", kind: "prescription", title: "Prescription verified", message: "Your prescription for Amoxicillin 500mg was approved by the pharmacist.", time: "2 days ago", unread: false },
  { id: "n5", kind: "promo", title: "Flash deals are live", message: "Up to 35% off across Grocery, Beauty and Electronics until midnight.", time: "3 days ago", unread: false },
];

export const SEED_PRESCRIPTIONS = [
  { id: "rx-401", customer: "Alex Morgan", uploadedAt: "2026-09-14T10:02:00", fileName: "prescription-sept.jpg", status: "approved", items: ["amoxicillin-500"], pharmacist: "Dr. N. Rao", notes: "Valid, 5-day course. Dispense 1 strip." },
  { id: "rx-388", customer: "Jordan Lee", uploadedAt: "2026-09-16T08:41:00", fileName: "rx-scan-0916.pdf", status: "pending", items: ["amoxicillin-500"], pharmacist: null, notes: "" },
];

export const POPULAR_SEARCHES = ["Cold brew", "Vitamin C", "T-shirt", "Baby wipes", "Earbuds", "Olive oil", "Paracetamol"];
