import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISTRICTS, MUNICIPALITIES, PROVINCES, municipalityName, provinceName, wardCountFor, wardOptions } from "../data/locations.js";
import { applyLocation } from "./addressFromPin.js";

const butwal = { inNepal: true, approximate: false, province: { id: "lumbini", name: "Lumbini Province" }, district: { id: "rupandehi", name: "Rupandehi" }, municipality: { id: "butwal-sub", name: "Butwal Sub-Metropolitan City", wards: 19 } };
const base = { name: "Sita", line1: "Main Rd", phone: "9812345678", provinceId: "", districtId: "", municipalityId: "", ward: "" };

describe("location data", () => {
  it("covers all of Nepal: 7 provinces, 77 districts, 753 local levels", () => {
    assert.equal(PROVINCES.length, 7);
    assert.equal(Object.values(DISTRICTS).flat().length, 77);
    assert.equal(Object.values(MUNICIPALITIES).flat().length, 753);
  });
  it("every district belongs to a listed province and every municipality to a listed district", () => {
    const dIds = new Set(Object.values(DISTRICTS).flat().map((d) => d.id));
    assert.ok(Object.keys(DISTRICTS).every((p) => PROVINCES.some((x) => x.id === p)));
    assert.ok(Object.keys(MUNICIPALITIES).every((d) => dIds.has(d)));
    const ids = Object.values(MUNICIPALITIES).flat().map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length, "municipality ids are unique");
  });
  it("ids used by existing saved addresses still resolve to the same names", () => {
    assert.equal(municipalityName("rupandehi", "butwal-sub"), "Butwal Sub-Metropolitan City");
    assert.equal(municipalityName("kathmandu", "ktm-metro"), "Kathmandu Metropolitan City");
    assert.equal(municipalityName("kaski", "pokhara-metro"), "Pokhara Metropolitan City");
    assert.equal(municipalityName("kathmandu", "budhanilkantha"), "Budhanilkantha Municipality");
    assert.equal(provinceName("lumbini"), "Lumbini Province");
  });
  it("ward counts are the real ones for well-known places", () => {
    assert.equal(wardCountFor("kathmandu", "ktm-metro"), 32); assert.equal(wardCountFor("rupandehi", "butwal-sub"), 19);
    assert.deepEqual(wardOptions("rupandehi", "siddharthanagar").length, 13); assert.deepEqual(wardOptions("x", "y"), []);
  });
});

describe("applyLocation (pin -> address form)", () => {
  it("fills province, district and municipality, and leaves everything else alone", () => {
    const { value, status } = applyLocation(base, butwal);
    assert.deepEqual([value.provinceId, value.districtId, value.municipalityId], ["lumbini", "rupandehi", "butwal-sub"]);
    assert.deepEqual([value.name, value.line1, value.phone], ["Sita", "Main Rd", "9812345678"]);
    assert.equal(status.kind, "ok"); assert.equal(status.needWard, true); assert.match(status.text, /Choose your ward \(1–19\)/);
  });
  it("keeps a ward that is still valid, drops one that isn't, and never invents one", () => {
    assert.equal(applyLocation({ ...base, ward: "4" }, butwal).value.ward, "4");
    assert.equal(applyLocation({ ...base, ward: "25" }, butwal).value.ward, "", "ward 25 doesn't exist in a 19-ward municipality");
    assert.equal(applyLocation({ ...base, ward: "abc" }, butwal).value.ward, "");
    assert.equal(applyLocation({ ...base, ward: "0" }, butwal).value.ward, "");
    assert.equal(applyLocation(base, butwal).value.ward, "");
  });
  it("replaces earlier dropdown choices when the pin says otherwise (the pin is the latest statement of where they are)", () => {
    const { value } = applyLocation({ ...base, provinceId: "koshi", districtId: "morang", municipalityId: "biratnagar-metro", ward: "3" }, butwal);
    assert.deepEqual([value.provinceId, value.districtId, value.municipalityId, value.ward], ["lumbini", "rupandehi", "butwal-sub", "3"]);
  });
  it("a pin outside Nepal changes nothing and says so", () => {
    const start = { ...base, provinceId: "koshi" };
    const { value, status } = applyLocation(start, { inNepal: false });
    assert.equal(value, start); assert.equal(status.kind, "outside");
  });
  it("a pin in a national park fills province + district, clears the municipality and asks for the nearest one", () => {
    const { value, status } = applyLocation({ ...base, municipalityId: "x", ward: "2" }, { inNepal: true, province: { id: "bagmati", name: "Bagmati Province" }, district: { id: "chitwan", name: "Chitwan" }, municipality: null, area: { name: "Chitawan National Park", type: "National Park" } });
    assert.deepEqual([value.provinceId, value.districtId, value.municipalityId, value.ward], ["bagmati", "chitwan", "", ""]);
    assert.equal(status.kind, "area"); assert.match(status.text, /Chitawan National Park/);
  });
  it("a municipality with an unknown ward count accepts any plausible ward number", () => {
    const loc = { ...butwal, municipality: { id: "ramgram-mun", name: "Ramgram Municipality", wards: null }, district: { id: "nawalparasi-west", name: "Nawalparasi West" }, province: { id: "lumbini", name: "Lumbini Province" } };
    const r = applyLocation({ ...base, ward: "30" }, loc);
    assert.equal(r.value.municipalityId, "ramgram-mun"); assert.equal(r.value.ward, "30");
  });
  it("never sets ids the form's dropdowns don't contain", () => {
    const { value, status } = applyLocation(base, { ...butwal, district: { id: "atlantis", name: "Atlantis" } });
    assert.equal(value, base); assert.equal(status.kind, "unmatched");
  });
  it("flags a pin right on a border so the person double-checks", () => {
    assert.match(applyLocation(base, { ...butwal, approximate: true }).status.text, /border/);
  });
});
