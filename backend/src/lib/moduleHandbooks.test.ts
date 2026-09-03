import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeBaseCourseNumber, normalizeCourseNumber } from "./moduleHandbooks";

describe("module handbook course number normalization", () => {
  it("normalizes numeric and alphanumeric department segments", () => {
    assert.equal(normalizeCourseNumber("20-00-0219-IV"), "20-00-0219-iv");
    assert.equal(normalizeCourseNumber("18 - AD - 2090 - VL2"), "18-ad-2090-vl2");
    assert.equal(normalizeBaseCourseNumber("18 - AD - 2090 - VL2"), "18-ad-2090");
    assert.equal(normalizeBaseCourseNumber("20-am-4000"), "20-am-4000");
  });
});
