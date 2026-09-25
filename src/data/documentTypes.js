/* Business document checklist for shop registration. Pharmacy-only document
   types are hidden entirely unless the shop being registered is a pharmacy. */
export const DOCUMENT_TYPES = [
  { id: "business_reg", label: "Business Registration Certificate", required: true },
  { id: "pan_vat", label: "PAN / VAT Certificate", required: true },
  { id: "shop_license", label: "Shop License", required: false },
  { id: "owner_id", label: "Owner Identification Document", required: true },
  { id: "other", label: "Other Supporting Document", required: false },
];
export const MAX_UPLOAD_MB = 5;
export const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
