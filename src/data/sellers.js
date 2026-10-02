/* ==========================================================================
   MARKETPLACE SELLERS
   Vyra Retail is the first-party seller (owns the physical stores,
   handles medicines directly — 0% commission, always active). Everyone else
   is a third-party seller who lists products under their own brand(s) and
   gets paid out after commission.

   A product's seller is derived from its brand via BRAND_SELLER, so the
   existing 32-product catalogue needed no changes to join the marketplace.
   ========================================================================== */

export const SELLERS = [
  {
    id: "vyra-retail", name: "Vyra Retail", firstParty: true,
    status: "active", commissionRate: 0, rating: 4.8, reviews: 12400,
    joinedAt: "2024-01-01", payoutMethod: "N/A — first-party", contactEmail: "ops@vyra.com",
    brands: ["gsk", "cipla", "sunpharma", "healthvit", "drtrust", "mothercare"],
  },
  {
    id: "fresh-grocers", name: "Fresh Grocers Co.", firstParty: false,
    status: "active", commissionRate: 8, rating: 4.6, reviews: 2140,
    joinedAt: "2025-09-12", payoutMethod: "Bank transfer •••• 4410", contactEmail: "partners@freshgrocers.example",
    brands: ["freshfields", "dailybrew"],
  },
  {
    id: "auralux-beauty", name: "AuraLux Beauty", firstParty: false,
    status: "active", commissionRate: 15, rating: 4.7, reviews: 3810,
    joinedAt: "2025-11-03", payoutMethod: "Bank transfer •••• 2207", contactEmail: "hello@auralux.example",
    brands: ["auralux"],
  },
  {
    id: "novatech-official", name: "NovaTech Official Store", firstParty: false,
    status: "active", commissionRate: 10, rating: 4.5, reviews: 5290,
    joinedAt: "2025-06-21", payoutMethod: "Bank transfer •••• 8834", contactEmail: "store@novatech.example",
    brands: ["novatech"],
  },
  {
    id: "homecraft-living", name: "HomeCraft Living", firstParty: false,
    status: "active", commissionRate: 12, rating: 4.4, reviews: 980,
    joinedAt: "2026-02-14", payoutMethod: "Bank transfer •••• 1190", contactEmail: "sell@homecraft.example",
    brands: ["homecraft"],
  },
  {
    id: "inkwell-stationery", name: "Inkwell Stationery", firstParty: false,
    status: "active", commissionRate: 14, rating: 4.6, reviews: 640,
    joinedAt: "2026-04-30", payoutMethod: "Bank transfer •••• 5567", contactEmail: "orders@inkwell.example",
    brands: ["inkwell"],
  },
  {
    id: "pawsome-pets", name: "Pawsome Pets", firstParty: false,
    status: "active", commissionRate: 13, rating: 4.5, reviews: 1120,
    joinedAt: "2026-01-08", payoutMethod: "Bank transfer •••• 3321", contactEmail: "team@pawsome.example",
    brands: ["pawsome"],
  },
  {
    id: "urbanthread-apparel", name: "UrbanThread Apparel", firstParty: false,
    status: "active", commissionRate: 18, rating: 4.3, reviews: 2670,
    joinedAt: "2025-08-19", payoutMethod: "Bank transfer •••• 7742", contactEmail: "wholesale@urbanthread.example",
    brands: ["urbanthread"],
  },
  {
    id: "northwind-outdoors", name: "Northwind Outdoors", firstParty: false,
    status: "pending", commissionRate: 15, rating: null, reviews: 0,
    joinedAt: "2026-09-10", payoutMethod: "Not yet set up", contactEmail: "apply@northwind.example",
    brands: [],
  },
];

const BRAND_SELLER = SELLERS.reduce((map, s) => {
  s.brands.forEach((b) => { map[b] = s.id; });
  return map;
}, {});

export const sellerById = (id, list = SELLERS) => list.find((s) => s.id === id) || null;
export const sellerForBrand = (brandId) => BRAND_SELLER[brandId] || "vyra-retail";
/** Products created directly under a newly-approved shop carry their own
    sellerId; the older catalogue attributes sellers via brand instead. */
export const sellerForProduct = (product) => product?.sellerId || sellerForBrand(product?.brandId);
export const brandsForSeller = (sellerId) => Object.entries(BRAND_SELLER).filter(([, s]) => s === sellerId).map(([b]) => b);
