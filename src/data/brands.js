export const BRANDS = [
  { id: "gsk", name: "GSK", tint: "#E7F0FC", fg: "#2B6CB0" },
  { id: "cipla", name: "Cipla", tint: "#E9FAF6", fg: "#0FAF8F" },
  { id: "sunpharma", name: "Sun Pharma", tint: "#FCEAEC", fg: "#D9524A" },
  { id: "healthvit", name: "HealthVit", tint: "#FCF3E3", fg: "#E0A427" },
  { id: "drtrust", name: "Dr. Trust", tint: "#F1ECFC", fg: "#7C5CD6" },
  { id: "mothercare", name: "Mothercare", tint: "#F1ECFC", fg: "#7C5CD6" },
  { id: "freshfields", name: "FreshFields", tint: "#E9FAF6", fg: "#128C6C" },
  { id: "dailybrew", name: "Daily Brew", tint: "#F3EDE6", fg: "#8A6A44" },
  { id: "auralux", name: "AuraLux", tint: "#FDECE6", fg: "#D65D46" },
  { id: "novatech", name: "NovaTech", tint: "#E7F0FC", fg: "#1E5FA8" },
  { id: "homecraft", name: "HomeCraft", tint: "#EFF3F5", fg: "#4A5F6B" },
  { id: "inkwell", name: "Inkwell", tint: "#E7F0FC", fg: "#2B6CB0" },
  { id: "pawsome", name: "Pawsome", tint: "#FCF3E3", fg: "#C98A2E" },
  { id: "urbanthread", name: "UrbanThread", tint: "#EFEDF7", fg: "#5C46B0" },
  { id: "himalaya", name: "Himalaya Wellness", tint: "#E9F7EE", fg: "#2F7A4D" },
];
/* Brands a seller types in themselves have no registry entry; derive a readable name from the slug. */
const nameFromSlug = (id) => String(id || "").split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
export const brandByName = (name) => BRANDS.find((b) => b.name.toLowerCase() === String(name || "").trim().toLowerCase()) || null;
export const slugifyBrand = (name) => String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const brandById = (id) => BRANDS.find((b) => b.id === id) || { id, name: nameFromSlug(id), tint: "#EFF3F5", fg: "#4A5F6B" };
