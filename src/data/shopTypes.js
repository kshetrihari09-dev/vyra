/* Shop types drive which registration fields appear — pharmacy-specific
   fields (license, pharmacist details) only ever show when shopType is
   "pharmacy". Everything else gets the general shop flow. */
export const SHOP_TYPES = [
  { id: "pharmacy", label: "Pharmacy", icon: "Stethoscope", isPharmacy: true },
  { id: "grocery", label: "Grocery", icon: "ShoppingBasket" },
  { id: "general", label: "General Store", icon: "Store" },
  { id: "beauty", label: "Beauty", icon: "Gem" },
  { id: "electronics", label: "Electronics", icon: "Smartphone" },
  { id: "fashion", label: "Fashion", icon: "Shirt" },
  { id: "restaurant", label: "Restaurant / Food", icon: "CookingPot" },
  { id: "medical_equipment", label: "Medical Equipment", icon: "BriefcaseMedical" },
  { id: "other", label: "Other", icon: "Boxes" },
];
export const shopTypeById = (id) => SHOP_TYPES.find((t) => t.id === id) || null;
export const isPharmacyType = (id) => !!shopTypeById(id)?.isPharmacy;
