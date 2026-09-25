/* ==========================================================================
   CATEGORY REGISTRY
   Everything the customer UI renders about a category comes from here.
   An administrator can add a category (and its attribute schema) at runtime
   via Admin > Categories — no React component needs to change.

   Category shape:
     id, name, slug, description, icon (registry key), image (art shape),
     tint/fg (card colours), parent (null = top level), status, order,
     attributes[]  -> the dynamic spec schema for products in this category
     modules[]     -> optional behaviour flags ("prescription", "batch")
     unitLabel     -> default selling unit for products
   Subcategories inherit their parent's attributes unless they define their own.
   ========================================================================== */

const attr = (key, label, opts = {}) => ({
  key, label,
  type: opts.type || "text",
  options: opts.options || null,
  filterable: !!opts.filterable,
  highlight: !!opts.highlight, // shown as a chip near the title
});

export const CATEGORIES = [
  /* ----------------------------- GROCERY ----------------------------- */
  {
    id: "grocery", name: "Grocery", slug: "grocery", parent: null, order: 1, status: "active",
    icon: "ShoppingBasket", image: "bag", tint: "#E9F7EE", fg: "#128C6C", unitLabel: "pack",
    description: "Everyday staples, snacks and drinks delivered in minutes.",
    attributes: [
      attr("weight", "Net Weight", { filterable: false, highlight: true }),
      attr("packSize", "Pack Size"),
      attr("ingredients", "Ingredients"),
      attr("origin", "Country of Origin", { filterable: true }),
      attr("shelfLife", "Shelf Life"),
      attr("dietary", "Dietary", { type: "select", options: ["Veg", "Non-veg", "Vegan"], filterable: true, highlight: true }),
    ],
  },
  { id: "grocery-grains", name: "Rice & Grains", slug: "rice-grains", parent: "grocery", order: 1, status: "active", icon: "Wheat", image: "bag", tint: "#F5F0E3", fg: "#A9862F" },
  { id: "grocery-snacks", name: "Snacks", slug: "snacks", parent: "grocery", order: 2, status: "active", icon: "Cookie", image: "bag", tint: "#FCF3E3", fg: "#C98A2E" },
  { id: "grocery-beverages", name: "Beverages", slug: "beverages", parent: "grocery", order: 3, status: "active", icon: "CupSoda", image: "bottle", tint: "#E7F0FC", fg: "#2B6CB0" },
  { id: "grocery-dairy", name: "Dairy", slug: "dairy", parent: "grocery", order: 4, status: "active", icon: "Milk", image: "carton", tint: "#EEF4FA", fg: "#4A6B8A" },

  /* ------------------------ MEDICINES & HEALTHCARE ------------------- */
  {
    id: "health", name: "Medicines & Healthcare", slug: "medicines-healthcare", parent: null, order: 2, status: "active",
    icon: "Stethoscope", image: "medbox", tint: "#E9FAF6", fg: "#0FAF8F", unitLabel: "pack",
    description: "Prescription and over-the-counter medicines, vitamins and first aid.",
    modules: ["prescription", "batch"],
    attributes: [
      attr("genericName", "Generic Name", { filterable: true }),
      attr("strength", "Strength", { highlight: true }),
      attr("dosageForm", "Dosage Form", { type: "select", options: ["Tablet", "Capsule", "Syrup", "Cream", "Device"], filterable: true, highlight: true }),
      attr("manufacturer", "Manufacturer"),
      attr("prescription", "Prescription Required", { type: "select", options: ["Yes", "No"], filterable: true }),
      attr("storage", "Storage"),
    ],
  },
  { id: "health-medicines", name: "Medicines", slug: "medicines", parent: "health", order: 1, status: "active", icon: "Pill", image: "medbox", tint: "#E9FAF6", fg: "#0FAF8F", modules: ["prescription", "batch"] },
  { id: "health-vitamins", name: "Vitamins", slug: "vitamins", parent: "health", order: 2, status: "active", icon: "Leaf", image: "bottle", tint: "#FCF3E3", fg: "#E0A427", modules: ["batch"] },
  { id: "health-firstaid", name: "First Aid", slug: "first-aid", parent: "health", order: 3, status: "active", icon: "BriefcaseMedical", image: "medbox", tint: "#FCEAEC", fg: "#D9524A", modules: ["batch"] },
  { id: "health-devices", name: "Personal Health", slug: "personal-health", parent: "health", order: 4, status: "active", icon: "Activity", image: "device", tint: "#F1ECFC", fg: "#7C5CD6" },

  /* --------------------------- PERSONAL CARE ------------------------- */
  {
    id: "personal", name: "Personal Care", slug: "personal-care", parent: null, order: 3, status: "active",
    icon: "Sparkles", image: "bottle", tint: "#E9FAF6", fg: "#0FAF8F", unitLabel: "unit",
    description: "Daily care essentials for body, hair and oral health.",
    attributes: [
      attr("volume", "Volume / Weight", { highlight: true }),
      attr("skinType", "Suitable For", { type: "select", options: ["All", "Dry", "Oily", "Sensitive"], filterable: true }),
      attr("fragrance", "Fragrance"),
      attr("keyIngredients", "Key Ingredients"),
    ],
  },
  { id: "personal-bath", name: "Bath & Body", slug: "bath-body", parent: "personal", order: 1, status: "active", icon: "Droplets", image: "bottle", tint: "#E7F2FC", fg: "#1E88C7" },
  { id: "personal-oral", name: "Oral Care", slug: "oral-care", parent: "personal", order: 2, status: "active", icon: "Smile", image: "tube", tint: "#E9FAF6", fg: "#0FAF8F" },

  /* ------------------------------ BEAUTY ----------------------------- */
  {
    id: "beauty", name: "Beauty", slug: "beauty", parent: null, order: 4, status: "active",
    icon: "Gem", image: "cosmetic", tint: "#FDECE6", fg: "#D65D46", unitLabel: "unit",
    description: "Skin care, hair care and makeup from trusted brands.",
    attributes: [
      attr("shade", "Shade", { filterable: true, highlight: true }),
      attr("finish", "Finish", { type: "select", options: ["Matte", "Dewy", "Satin"], filterable: true }),
      attr("volume", "Volume"),
      attr("skinType", "Skin Type", { type: "select", options: ["All", "Dry", "Oily", "Combination"], filterable: true }),
      attr("crueltyFree", "Cruelty Free", { type: "select", options: ["Yes", "No"], filterable: true }),
    ],
  },
  { id: "beauty-skin", name: "Skin Care", slug: "skin-care", parent: "beauty", order: 1, status: "active", icon: "Sun", image: "cosmetic", tint: "#FDECE6", fg: "#D65D46" },
  { id: "beauty-hair", name: "Hair Care", slug: "hair-care", parent: "beauty", order: 2, status: "active", icon: "Wind", image: "bottle", tint: "#F1ECFC", fg: "#7C5CD6" },
  { id: "beauty-makeup", name: "Makeup", slug: "makeup", parent: "beauty", order: 3, status: "active", icon: "Brush", image: "cosmetic", tint: "#FCEAEC", fg: "#E0546A" },

  /* ----------------------------- BABY CARE --------------------------- */
  {
    id: "baby", name: "Baby Care", slug: "baby-care", parent: null, order: 5, status: "active",
    icon: "Baby", image: "tube", tint: "#F1ECFC", fg: "#7C5CD6", unitLabel: "pack",
    description: "Gentle, dermatologist-tested essentials for little ones.",
    attributes: [
      attr("ageGroup", "Age Group", { type: "select", options: ["0-6 months", "6-12 months", "1-3 years"], filterable: true, highlight: true }),
      attr("volume", "Size"),
      attr("dermatologistTested", "Dermatologist Tested", { type: "select", options: ["Yes", "No"], filterable: true }),
    ],
  },

  /* ----------------------------- HOUSEHOLD --------------------------- */
  {
    id: "household", name: "Household", slug: "household", parent: null, order: 6, status: "active",
    icon: "SprayCan", image: "bottle", tint: "#EFF3F5", fg: "#4A5F6B", unitLabel: "unit",
    description: "Cleaning, laundry and everyday home supplies.",
    attributes: [
      attr("volume", "Volume", { highlight: true }),
      attr("surface", "Suitable Surfaces"),
      attr("scent", "Scent", { filterable: true }),
    ],
  },

  /* -------------------------- HOME & KITCHEN ------------------------- */
  {
    id: "home", name: "Home & Kitchen", slug: "home-kitchen", parent: null, order: 7, status: "active",
    icon: "CookingPot", image: "box", tint: "#F3EDE6", fg: "#8A6A44", unitLabel: "piece",
    description: "Cookware, storage and everything that makes a house work.",
    attributes: [
      attr("material", "Material", { type: "select", options: ["Stainless Steel", "Glass", "Ceramic", "Plastic"], filterable: true, highlight: true }),
      attr("capacity", "Capacity", { filterable: true }),
      attr("dishwasherSafe", "Dishwasher Safe", { type: "select", options: ["Yes", "No"] }),
      attr("warranty", "Warranty"),
    ],
  },

  /* --------------------------- ELECTRONICS --------------------------- */
  {
    id: "electronics", name: "Electronics", slug: "electronics", parent: null, order: 8, status: "active",
    icon: "Smartphone", image: "device", tint: "#E7F0FC", fg: "#1E5FA8", unitLabel: "piece",
    description: "Audio, wearables and everyday tech with official warranty.",
    attributes: [
      attr("ram", "RAM", { filterable: true }),
      attr("storage", "Storage", { filterable: true, highlight: true }),
      attr("color", "Colour", { filterable: true }),
      attr("warranty", "Warranty", { highlight: true }),
      attr("model", "Model"),
      attr("power", "Battery / Power"),
    ],
  },

  /* ---------------------------- STATIONERY --------------------------- */
  {
    id: "stationery", name: "Stationery", slug: "stationery", parent: null, order: 9, status: "active",
    icon: "PenLine", image: "box", tint: "#E7F0FC", fg: "#2B6CB0", unitLabel: "pack",
    description: "Notebooks, pens and desk supplies for work and school.",
    attributes: [
      attr("pageCount", "Pages", { filterable: false }),
      attr("ruling", "Ruling", { type: "select", options: ["Ruled", "Plain", "Dotted", "Grid"], filterable: true, highlight: true }),
      attr("size", "Size", { filterable: true }),
      attr("material", "Material"),
    ],
  },

  /* ------------------------------ PET CARE --------------------------- */
  {
    id: "pet", name: "Pet Care", slug: "pet-care", parent: null, order: 10, status: "active",
    icon: "PawPrint", image: "bag", tint: "#FCF3E3", fg: "#C98A2E", unitLabel: "pack",
    description: "Food, treats and grooming for cats and dogs.",
    attributes: [
      attr("petType", "Pet Type", { type: "select", options: ["Dog", "Cat", "Bird"], filterable: true, highlight: true }),
      attr("lifeStage", "Life Stage", { type: "select", options: ["Puppy/Kitten", "Adult", "Senior"], filterable: true }),
      attr("weight", "Net Weight"),
      attr("flavour", "Flavour"),
    ],
  },

  /* ------------------------------ FASHION ---------------------------- */
  {
    id: "fashion", name: "Fashion", slug: "fashion", parent: null, order: 11, status: "active",
    icon: "Shirt", image: "apparel", tint: "#EFEDF7", fg: "#5C46B0", unitLabel: "piece",
    description: "Everyday wear with easy returns and true-to-size fits.",
    attributes: [
      attr("size", "Size", { type: "select", options: ["S", "M", "L", "XL"], filterable: true, highlight: true }),
      attr("color", "Colour", { filterable: true }),
      attr("material", "Material", { filterable: true }),
      attr("gender", "Gender", { type: "select", options: ["Men", "Women", "Unisex"], filterable: true }),
      attr("pattern", "Pattern"),
      attr("fit", "Fit"),
    ],
  },

  /* ---------------------------- ACCESSORIES -------------------------- */
  {
    id: "accessories", name: "Accessories", slug: "accessories", parent: null, order: 12, status: "active",
    icon: "Watch", image: "apparel", tint: "#F0EFEA", fg: "#7A6A4F", unitLabel: "piece",
    description: "Bags, watches and the small things that finish a look.",
    attributes: [
      attr("material", "Material", { filterable: true, highlight: true }),
      attr("color", "Colour", { filterable: true }),
      attr("dimensions", "Dimensions"),
      attr("warranty", "Warranty"),
    ],
  },
];

/* ----------------------------- SELECTORS ------------------------------ */
export const catById = (id, list = CATEGORIES) => list.find((c) => c.id === id) || null;
export const topCategories = (list = CATEGORIES) =>
  list.filter((c) => !c.parent && c.status === "active").sort((a, b) => a.order - b.order);
export const childrenOf = (id, list = CATEGORIES) =>
  list.filter((c) => c.parent === id && c.status === "active").sort((a, b) => a.order - b.order);

/** Walks up the tree so a subcategory inherits its parent's schema + modules. */
export const resolveCategory = (id, list = CATEGORIES) => {
  const self = catById(id, list);
  if (!self) return null;
  const parent = self.parent ? catById(self.parent, list) : null;
  return {
    ...self,
    root: parent || self,
    attributes: self.attributes || parent?.attributes || [],
    modules: self.modules || parent?.modules || [],
    unitLabel: self.unitLabel || parent?.unitLabel || "unit",
  };
};
export const categoryPath = (id, list = CATEGORIES) => {
  const self = catById(id, list);
  if (!self) return [];
  return self.parent ? [catById(self.parent, list), self].filter(Boolean) : [self];
};
/** All descendant ids including itself — used for "show everything under Grocery". */
export const categoryTreeIds = (id, list = CATEGORIES) => [id, ...list.filter((c) => c.parent === id).map((c) => c.id)];
export const hasModule = (categoryId, mod, list = CATEGORIES) =>
  (resolveCategory(categoryId, list)?.modules || []).includes(mod);
