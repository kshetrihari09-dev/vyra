import { districtsFor, municipalitiesFor, wardCountFor } from "../data/locations.js";

const ward = (w) => (/^\d{1,2}$/.test(String(w ?? "").trim()) ? Number(w) : null);

/**
 * Applies what the server found for a map pin (province / district / municipality, from /api/geo/locate) to the address form.
 * Only the four location fields change — the person's name, street, phone etc. are never touched. The pin is the person's latest
 * statement of where they are, so it replaces earlier dropdown choices; they can still change every field afterwards.
 *
 * The WARD can't be read from the map (no ward boundaries), so it's kept only if it's still valid for the new municipality
 * (e.g. ward 4 stays when the pin moves within the same municipality) and otherwise cleared for the person to choose.
 *
 * → { value, status: { kind, text, needWard } }   kind: "ok" | "area" | "approximate" | "outside" | "unmatched"
 */
export function applyLocation(value, loc) {
  if (!loc || loc.inNepal === false) {
    return { value, status: { kind: "outside", text: "This pin is outside Nepal. Move it to your delivery location.", needWard: false } };
  }
  const provinceId = loc.province?.id; const districtId = loc.district?.id; const municipalityId = loc.municipality?.id;
  // The ids must exist in the form's own lists, otherwise the dropdown would show a blank for a value we set.
  const knownDistrict = districtsFor(provinceId).some((d) => d.id === districtId);
  if (!provinceId || !knownDistrict) {
    return { value, status: { kind: "unmatched", text: "We couldn't match this pin to an area. Please choose your province, district and municipality.", needWard: false } };
  }
  const knownMuni = !!municipalityId && municipalitiesFor(districtId).some((m) => m.id === municipalityId);
  const next = { ...value, provinceId, districtId, municipalityId: knownMuni ? municipalityId : "" };

  if (!knownMuni) {
    next.ward = "";
    const where = loc.area ? ` (${loc.area.name})` : "";
    return { value: next, status: { kind: "area", text: `Province and district filled from your pin. This spot is outside any municipality${where}, so please choose the nearest municipality.`, needWard: false } };
  }
  const wards = wardCountFor(districtId, municipalityId);
  const keep = ward(value.ward);
  const stillValid = keep !== null && keep >= 1 && (wards == null || keep <= wards);
  next.ward = stillValid ? String(keep) : "";
  const path = `${loc.province.name} › ${loc.district.name} › ${loc.municipality.name}`;
  const wardNote = next.ward ? `Ward ${next.ward} kept.` : wards ? `Choose your ward (1–${wards}) — it can't be read from the map.` : "Enter your ward number — it can't be read from the map.";
  return { value: next, status: { kind: loc.approximate ? "approximate" : "ok", text: `Filled from your pin: ${path}. ${wardNote}${loc.approximate ? " (This pin is right on a border — double-check the municipality.)" : ""}`, needWard: !next.ward } };
}
