import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applicationView, buildApplicationBody, requiredDocuments, validateApplication } from "./riderApplication.js";

const file = (name) => ({ fileName: name, fileUrl: "data:image/png;base64,AAAA" });
const motor = (over = {}) => ({ phone: "9801234567", vehicleType: "Bike", vehicleNumber: "BA 12 PA 1234", licenseNumber: "01-06-123", files: { driving_license: file("l.png"), vehicle_registration: file("b.png") }, ...over });

describe("rider application form", () => {
  it("a complete motorised application has no errors", () => assert.deepEqual(validateApplication(motor()), {}));
  it("asks for the licence, bluebook, number and phone — each with its own message", () => {
    const e = validateApplication(motor({ phone: "12345", licenseNumber: "", vehicleNumber: "", files: {} }));
    assert.deepEqual(Object.keys(e).sort(), ["driving_license", "licenseNumber", "phone", "vehicleNumber", "vehicle_registration"]);
  });
  it("a bicycle courier needs an ID, not a licence or bluebook", () => {
    assert.deepEqual(requiredDocuments("Bicycle").map((d) => d.type), ["citizen_id"]);
    assert.deepEqual(validateApplication({ phone: "9801234567", vehicleType: "Bicycle", files: { citizen_id: file("id.png") } }), {});
    assert.deepEqual(Object.keys(validateApplication({ phone: "9801234567", vehicleType: "Bicycle", files: {} })), ["citizen_id"]);
  });
  it("builds the request body from data URLs and never includes a userId", () => {
    const body = buildApplicationBody(motor());
    assert.equal(body.documents.length, 2);
    assert.deepEqual(body.documents[0], { type: "driving_license", fileName: "l.png", mimeType: "image/png", dataBase64: "data:image/png;base64,AAAA" });
    assert.ok(!("userId" in body));
    assert.equal(body.licenseNumber, "01-06-123");
  });
  it("drops uploads left over from a different vehicle choice", () => {
    const body = buildApplicationBody({ ...motor({ vehicleType: "Bicycle" }), files: { ...motor().files, citizen_id: file("id.png") } });
    assert.deepEqual(body.documents.map((d) => d.type), ["citizen_id"]);
    assert.equal(body.licenseNumber, undefined);
  });
  it("maps an application to the screen the applicant should see", () => {
    assert.equal(applicationView(null), "form");
    assert.equal(applicationView({ status: "under_review" }), "review");
    assert.equal(applicationView({ status: "approved" }), "approved");
    assert.equal(applicationView({ status: "rejected", needsCorrection: true }), "fix");
    assert.equal(applicationView({ status: "rejected", needsCorrection: false }), "declined");
  });
});
