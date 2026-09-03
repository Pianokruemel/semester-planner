import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findDefaultCatalogSemester, moduleHandbookIngestSchema } from "./catalog";

const handbookDocument = {
  program_key: "msc-it-security",
  po_label: "PO 2025",
  pdf_url: "https://example.test/module-handbook.pdf",
  pdf_label: "Module handbook",
  content_hash: "a".repeat(64),
  fetch_status: "fetched",
  parse_status: "parsed",
  courses: [
    {
      module_number: "20-00-0001",
      course_number: "20-00-0001",
      module_title: "Example module",
      cp: 6,
      class_path: ["Electives"],
      page_number: 12
    }
  ]
};

describe("catalog semester selection", () => {
  it("uses the newest non-empty completed scan without considering a newer incomplete or empty scan", async () => {
    const queries: unknown[] = [];
    const semester = await findDefaultCatalogSemester(async (args) => {
      queries.push(args);
      return { semesterKey: "2025-winter" };
    });

    assert.equal(semester, "2025-winter");
    assert.deepEqual(queries, [
      {
        where: { status: "completed", coursesSeen: { gt: 0 } },
        orderBy: { startedAt: "desc" },
        select: { semesterKey: true }
      }
    ]);
  });

  it("falls back to the newest scan until the first non-empty scan completes", async () => {
    const queries: unknown[] = [];
    const semester = await findDefaultCatalogSemester(async (args) => {
      queries.push(args);
      return queries.length === 1 ? null : { semesterKey: "2026-summer" };
    });

    assert.equal(semester, "2026-summer");
    assert.deepEqual(queries[1], {
      orderBy: { startedAt: "desc" },
      select: { semesterKey: true }
    });
  });

  it("uses no semester filter when a fresh database has no scans", async () => {
    const semester = await findDefaultCatalogSemester(async () => null);

    assert.equal(semester, "");
  });
});

describe("module handbook ingest validation", () => {
  it("rejects parsed documents with no courses before replacement", () => {
    const result = moduleHandbookIngestSchema.safeParse({
      documents: [{ ...handbookDocument, courses: [] }]
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.deepEqual(result.error.issues[0]?.path, ["documents", 0, "courses"]);
    }
  });

  it("accepts parsed documents with courses and failed documents without courses", () => {
    assert.equal(moduleHandbookIngestSchema.safeParse({ documents: [handbookDocument] }).success, true);
    assert.equal(
      moduleHandbookIngestSchema.safeParse({
        documents: [{ ...handbookDocument, parse_status: "failed", courses: [] }]
      }).success,
      true
    );
  });
});
