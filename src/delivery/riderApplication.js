/* Pure helpers for the rider application form. The server validates all of this again; this only keeps the form honest
   and turns it into the request body. */

export const MOBILE_RE = /^9[678]\d{8}$/;
export const isBicycle = (vehicleType) => vehicleType === "Bicycle";

/** Which uploads the form needs for this vehicle: a motorised rider needs licence + bluebook; a bicycle courier needs an ID. */
export const requiredDocuments = (vehicleType) => (isBicycle(vehicleType)
  ? [{ type: "citizen_id", label: "Government ID (citizenship)" }]
  : [{ type: "driving_license", label: "Driving licence" }, { type: "vehicle_registration", label: "Vehicle registration (bluebook)" }]);

/** form = { phone, vehicleType, vehicleNumber, licenseNumber, files: { [docType]: { fileName, fileUrl } } } → { field: message } */
export function validateApplication(form) {
  const errors = {};
  if (!MOBILE_RE.test((form.phone || "").trim())) errors.phone = "Enter a valid mobile number (98XXXXXXXX)";
  if (!isBicycle(form.vehicleType)) {
    if (!(form.licenseNumber || "").trim()) errors.licenseNumber = "Enter your driving licence number";
    if (!(form.vehicleNumber || "").trim()) errors.vehicleNumber = "Enter your vehicle number";
  }
  for (const d of requiredDocuments(form.vehicleType)) if (!form.files?.[d.type]?.fileUrl) errors[d.type] = `Upload your ${d.label.toLowerCase()}`;
  return errors;
}

const mimeOf = (dataUrl) => /^data:([^;]+);base64,/.exec(dataUrl || "")?.[1];

/** Only the documents this vehicle needs (plus an optional ID) are sent; a leftover upload from a previous vehicle choice is dropped. */
export function buildApplicationBody(form) {
  const bicycle = isBicycle(form.vehicleType);
  const types = [...requiredDocuments(form.vehicleType).map((d) => d.type), ...(bicycle ? [] : ["citizen_id"])];
  const documents = types.filter((t) => form.files?.[t]?.fileUrl)
    .map((t) => ({ type: t, fileName: form.files[t].fileName, mimeType: mimeOf(form.files[t].fileUrl), dataBase64: form.files[t].fileUrl }));
  return {
    phone: form.phone.trim(), vehicleType: form.vehicleType,
    vehicleNumber: form.vehicleNumber?.trim() || undefined,
    licenseNumber: bicycle ? undefined : form.licenseNumber.trim(),
    documents,
  };
}

/** What the applicant sees for their newest application. */
export function applicationView(app) {
  if (!app) return "form";
  if (app.status === "under_review") return "review";
  if (app.status === "approved") return "approved";
  return app.needsCorrection ? "fix" : "declined";
}
