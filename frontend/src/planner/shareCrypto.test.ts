import { describe, expect, it } from "vitest";
import { normalizePlannerSnapshot, plannerSnapshotVersion } from "../api/types";
import { decryptPlannerSnapshot, encryptPlannerSnapshot, generateShareCode } from "./shareCrypto";

describe("share snapshot compatibility", () => {
  it("normalizes legacy course snapshots without exam fields", () => {
    const normalized = normalizePlannerSnapshot({
      export_version: "2.0",
      settings: {},
      categories: [],
      courses: [
        {
          id: "course-1",
          name: "IT-Sicherheit",
          abbreviation: "ITS",
          cp: 6,
          category_id: null,
          is_active: true,
          appointments: []
        }
      ]
    });

    expect(normalized.export_version).toBe(plannerSnapshotVersion);
    expect(normalized.courses[0]?.course_number).toBeNull();
    expect(normalized.courses[0]?.exam).toBeNull();
  });

  it("accepts legacy payload versions during decryption", async () => {
    const code = generateShareCode();
    const payload = await encryptPlannerSnapshot(
      {
        export_version: plannerSnapshotVersion,
        settings: {},
        categories: [],
        courses: [
          {
            id: "course-1",
            name: "IT-Sicherheit",
            abbreviation: "ITS",
            cp: 6,
            category_id: null,
            course_number: "20-00-1234",
            is_active: true,
            exam: {
              date: "2026-07-10",
              time_from: "10:00",
              time_to: "12:00"
            },
            appointments: []
          }
        ]
      },
      code,
      null
    );

    const decrypted = await decryptPlannerSnapshot(
      {
        id: "share-1",
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        payload_version: "2.0",
        crypto_version: payload.crypto_version,
        parent_snapshot_id: null,
        created_at: "2026-04-24T00:00:00.000Z",
        expires_at: null
      },
      code
    );

    expect(decrypted.courses[0]?.course_number).toBe("20-00-1234");
    expect(decrypted.courses[0]?.exam).toEqual({
      date: "2026-07-10",
      time_from: "10:00",
      time_to: "12:00"
    });
  });

  it("rejects unknown payload versions", async () => {
    const code = generateShareCode();
    const payload = await encryptPlannerSnapshot(
      {
        export_version: plannerSnapshotVersion,
        settings: {},
        categories: [],
        courses: []
      },
      code,
      null
    );

    await expect(
      decryptPlannerSnapshot(
        {
          id: "share-2",
          ciphertext: payload.ciphertext,
          nonce: payload.nonce,
          payload_version: "9.9",
          crypto_version: payload.crypto_version,
          parent_snapshot_id: null,
          created_at: "2026-04-24T00:00:00.000Z",
          expires_at: null
        },
        code
      )
    ).rejects.toThrow("Unbekannte Snapshot-Version.");
  });
});