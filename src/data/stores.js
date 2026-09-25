/* Company -> Store -> (Categories, Products, Inventory, Orders).
   Store-level stock lives on products keyed by these ids. */
export const COMPANY = { id: "vyra", name: "Vyra Retail Ltd." };

export const STORES = [
  {
    id: "store-01", name: "Vyra Central", code: "CEN",
    address: "12 Harbour Street, Central District", city: "Metro City",
    distanceKm: 1.2, etaMinutes: 18, open: true, hours: "7:00 AM – 11:00 PM",
    phone: "+1 555 0142", pharmacistOnDuty: true, otpRequired: true,
  },
  {
    id: "store-02", name: "Vyra Riverside", code: "RIV",
    address: "88 Riverside Walk, North Quarter", city: "Metro City",
    distanceKm: 4.6, etaMinutes: 35, open: true, hours: "8:00 AM – 10:00 PM",
    phone: "+1 555 0177", pharmacistOnDuty: false, otpRequired: true,
  },
];
export const storeById = (id) => STORES.find((s) => s.id === id) || STORES[0];

export const DELIVERY_OPTIONS = [
  { id: "express", label: "Express", detail: "Delivered in 15–30 min", fee: 2.99, eta: "30 min" },
  { id: "standard", label: "Standard", detail: "Delivered in 2–4 hours", fee: 0, eta: "4 hours", freeAbove: 25 },
  { id: "slot", label: "Scheduled Slot", detail: "Pick a 2-hour window", fee: 1.49, eta: "Your slot", slots: ["Today 6–8 PM", "Tomorrow 8–10 AM", "Tomorrow 12–2 PM", "Tomorrow 6–8 PM"] },
];

/* Payment methods are configuration, not code. */
export const PAYMENT_METHODS = [
  { id: "card", label: "Card", detail: "Visa •••• 4242", icon: "CreditCard", enabled: true },
  { id: "upi", label: "UPI / Wallet", detail: "Pay from any UPI app", icon: "Smartphone", enabled: true },
  { id: "netbanking", label: "Net Banking", detail: "All major banks", icon: "Landmark", enabled: true },
  { id: "cod", label: "Cash on Delivery", detail: "Pay the rider on arrival", icon: "Banknote", enabled: true },
];

export const ROLES = [
  { id: "owner", label: "Owner", permissions: ["*"] },
  { id: "admin", label: "Administrator", permissions: ["catalog", "orders", "inventory", "promotions", "customers", "reports", "settings"] },
  { id: "pharmacist", label: "Pharmacist", permissions: ["prescriptions", "orders:view", "inventory:batch"] },
  { id: "inventory", label: "Inventory Manager", permissions: ["inventory", "catalog:stock"] },
  { id: "orders", label: "Order Manager", permissions: ["orders", "customers:view"] },
  { id: "delivery", label: "Delivery Staff", permissions: ["delivery", "orders:assigned"] },
  { id: "support", label: "Customer Support", permissions: ["orders:view", "customers:view", "refunds"] },
];
