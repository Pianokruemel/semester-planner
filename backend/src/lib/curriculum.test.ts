import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findRequirementForClassPath,
  requirementGroupsForProgram,
  requirementsForProgram
} from "./curriculum";

describe("IT Security curriculum", () => {
  it("exposes precise categories and aggregate requirement groups", () => {
    const requirements = requirementsForProgram("msc-it-security");
    assert.deepEqual(
      requirements.map((requirement) => requirement.key),
      [
        "cryptography-foundations",
        "systems-communication-security",
        "software-application-security",
        "complementary-topics",
        "practical-labs",
        "seminars",
        "teaching-internship",
        "general-education",
        "master-thesis"
      ]
    );

    assert.deepEqual(requirementGroupsForProgram("msc-it-security"), [
      {
        key: "elective-areas",
        name: "Elective Areas",
        requiredCpMin: 59,
        requiredCpMax: 76,
        position: 0,
        categoryKeys: [
          "cryptography-foundations",
          "systems-communication-security",
          "software-application-security",
          "complementary-topics"
        ]
      },
      {
        key: "study-related",
        name: "Studienbegleitende Leistungen",
        requiredCpMin: 9,
        requiredCpMax: 15,
        position: 1,
        categoryKeys: ["practical-labs", "seminars", "teaching-internship"]
      }
    ]);
  });

  it("maps IT Security handbook paths to precise categories", () => {
    assert.equal(
      findRequirementForClassPath("msc-it-security", ["Wahlbereich Systems and Communication Security"])?.key,
      "systems-communication-security"
    );
    assert.equal(
      findRequirementForClassPath("msc-it-security", ["Wahlbereich Software and Application Security"])?.key,
      "software-application-security"
    );
    assert.equal(
      findRequirementForClassPath("msc-it-security", [
        "Wahlbereich Studienbegleitende Leistungen",
        "Praktika, Projektpraktika und ähnliche Veranstaltungen"
      ])?.key,
      "practical-labs"
    );
    assert.equal(
      findRequirementForClassPath("msc-it-security", ["Wahlbereich Studienbegleitende Leistungen", "Seminare"])?.key,
      "seminars"
    );
  });
});
