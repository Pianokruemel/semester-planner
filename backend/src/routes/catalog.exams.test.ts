import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import type { CatalogCourse, CatalogExamCandidate, CatalogExamCourseMatch, CatalogExamPlanDocument } from "@prisma/client";
import express from "express";
import { prisma } from "../lib/prisma";
import { errorHandler } from "../middleware/errorHandler";
import { catalogRouter } from "./catalog";

const now = new Date("2026-10-27T12:00:00.000Z");
const course: CatalogCourse = {
  id: "a5db5cf9-2279-4a58-85bf-66384827eb35",
  semesterKey: "Wintersemester 2026/27",
  source: "tucan",
  sourceKey: "physical-attacks",
  sourceUrl: "https://example.test/course",
  title: "Physical Attacks and Countermeasures",
  courseNumber: "20-00-1178",
  abbreviation: "PAC",
  cp: 6,
  eventType: "Vorlesung",
  language: "Englisch",
  faculty: "Informatik",
  path: ["FB20 - Informatik"],
  instructors: ["Prof. Dr. Amir Moradi"],
  detailsJson: { description: "Course details" },
  rawAppointmentText: null,
  firstDate: null,
  lastDate: null,
  appointmentCount: 0,
  lastScannedAt: now,
  createdAt: now,
  updatedAt: now
};
const document: CatalogExamPlanDocument = {
  id: "2d3500ef-5053-4716-b3ca-a5e4c6aa23a2",
  semesterKey: course.semesterKey,
  semesterIndex: 4053,
  fileUrl: "https://example.test/winter-exams.xlsx",
  fileLabel: "Prüfungsplan Wintersemester 2026/27",
  contentHash: "a".repeat(64),
  etag: null,
  lastModified: null,
  fetchStatus: "fetched",
  parseStatus: "parsed",
  errorText: null,
  rowCount: 335,
  validRowCount: 1,
  matchedRowCount: 1,
  unmatchedRowCount: 0,
  fetchedAt: now,
  parsedAt: now,
  createdAt: now,
  updatedAt: now
};
const candidate: CatalogExamCandidate = {
  id: "da6858fe-b74a-4e2e-a13a-ac5384cb3629",
  documentId: document.id,
  rowNumber: 335,
  weekday: "Di",
  date: new Date("2027-03-09T00:00:00.000Z"),
  timeFrom: "14:30",
  timeTo: "17:00",
  appointmentType: "Examen",
  lecturer: "Prof. Dr. Amir Moradi",
  courseName: "Physical Attacks and Countermeasures (20-00-1178)",
  normalizedCourseTitle: "physical attacks and countermeasures 20 00 1178",
  extractedCourseNumbers: ["20-00-1178"],
  rowHash: "b".repeat(64),
  createdAt: now
};
const match: CatalogExamCourseMatch & { candidate: CatalogExamCandidate } = {
  id: "40969509-2341-4efc-8434-dc7314d61ee9",
  candidateId: candidate.id,
  catalogCourseId: course.id,
  matchReasons: ["course-number-brackets", "course-title-exact"],
  createdAt: now,
  candidate
};
const expectedSource = {
  document_id: document.id,
  semester_key: document.semesterKey,
  file_url: document.fileUrl,
  file_label: document.fileLabel
};
const expectedCandidate = {
  candidate_id: candidate.id,
  date: "2027-03-09",
  time_from: "14:30",
  time_to: "17:00",
  exam_title: candidate.courseName,
  appointment_type: "Examen",
  lecturer: "Prof. Dr. Amir Moradi",
  match_reasons: ["course-number-brackets", "course-title-exact"]
};

const restorations: Array<() => void> = [];
function stubMethod(target: any, key: string, implementation: (...args: any[]) => any) {
  const original = target[key];
  const replacement = mock.fn(implementation);
  target[key] = replacement;
  restorations.push(() => { target[key] = original; });
  return replacement;
}

describe("public catalog exam contract", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/catalog", catalogRouter);
    app.use(errorHandler);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}/api/catalog`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    stubMethod(prisma.catalogCourse, "findUnique", async () => ({ ...course, appointments: [] }));
    stubMethod(prisma.moduleHandbookCourse, "findMany", async () => []);
    stubMethod(prisma.catalogExamPlanDocument, "findFirst", async () => document);
    stubMethod(prisma.catalogExamCourseMatch, "findMany", async () => [match]);
  });

  afterEach(() => {
    for (const restore of restorations.splice(0).reverse()) restore();
  });

  async function getCourse(): Promise<any> {
    const response = await fetch(`${baseUrl}/courses/${course.id}`);
    assert.equal(response.status, 200);
    return response.json();
  }

  it("adds the exact Physical Attacks exam and preserves every existing response field", async () => {
    assert.deepEqual(await getCourse(), {
      id: course.id,
      semester_key: course.semesterKey,
      source: course.source,
      source_key: course.sourceKey,
      source_url: course.sourceUrl,
      title: course.title,
      course_number: course.courseNumber,
      abbreviation: course.abbreviation,
      cp: course.cp,
      event_type: course.eventType,
      language: course.language,
      faculty: course.faculty,
      path: course.path,
      instructors: course.instructors,
      details_json: course.detailsJson,
      raw_appointment_text: null,
      first_date: null,
      last_date: null,
      appointment_count: 0,
      programmes: [],
      last_scanned_at: now.toISOString(),
      appointments: [],
      exam_source: expectedSource,
      exam_candidates: [expectedCandidate]
    });
  });

  it("keeps multiple candidates explicit and ordinary appointments unchanged", async () => {
    stubMethod(prisma.catalogCourse, "findUnique", async () => ({
      ...course,
      appointmentCount: 1,
      appointments: [{
        id: "lecture-id", courseId: course.id, date: now, timeFrom: "10:00", timeTo: "11:30",
        room: "S2/02", type: "Vorlesung", position: 0
      }]
    }));
    stubMethod(prisma.catalogExamCourseMatch, "findMany", async () => [
      match,
      { ...match, candidate: { ...candidate, id: "ea8a18f7-24d7-4efb-8b21-c34302fffd4b", timeFrom: "18:00", timeTo: "20:00" } }
    ]);

    const body = await getCourse();
    assert.deepEqual(body.exam_candidates, [expectedCandidate, { ...expectedCandidate,
      candidate_id: "ea8a18f7-24d7-4efb-8b21-c34302fffd4b", time_from: "18:00", time_to: "20:00"
    }]);
    assert.equal(body.appointment_count, 1);
    assert.deepEqual(body.appointments, [{
      id: "lecture-id", date: "2026-10-27", time_from: "10:00", time_to: "11:30",
      room: "S2/02", type: "Vorlesung", position: 0
    }]);
  });

  it("returns null and an empty array when no parsed document exists", async () => {
    stubMethod(prisma.catalogExamPlanDocument, "findFirst", async () => null);
    const matches = stubMethod(prisma.catalogExamCourseMatch, "findMany", async () => []);
    const body = await getCourse();
    assert.equal(body.exam_source, null);
    assert.deepEqual(body.exam_candidates, []);
    assert.equal(matches.mock.callCount(), 0);
  });

  it("retains source metadata when the course has no matches in the selected document", async () => {
    stubMethod(prisma.catalogExamCourseMatch, "findMany", async () => []);
    const body = await getCourse();
    assert.deepEqual(body.exam_source, expectedSource);
    assert.deepEqual(body.exam_candidates, []);
  });

  it("selects the latest parsed document within the course semester and scopes matches to it", async () => {
    const documents = [
      { ...document, id: "new-semester", semesterKey: "Sommersemester 2027", semesterIndex: 4054,
        fetchedAt: new Date("2027-03-01") },
      { ...document, id: "failed-winter", parseStatus: "failed", fetchedAt: new Date("2026-10-28") },
      document,
      { ...document, id: "older-winter", fetchedAt: new Date("2026-10-01") }
    ];
    const lookup = stubMethod(prisma.catalogExamPlanDocument, "findFirst", async ({ where, orderBy }) => {
      assert.deepEqual(where, { semesterKey: course.semesterKey, parseStatus: "parsed" });
      assert.deepEqual(orderBy, [{ fetchedAt: "desc" }, { id: "desc" }]);
      return documents.filter((entry) => entry.semesterKey === where.semesterKey && entry.parseStatus === where.parseStatus)
        .sort((left, right) => right.fetchedAt.getTime() - left.fetchedAt.getTime())[0] ?? null;
    });
    stubMethod(prisma.catalogExamCourseMatch, "findMany", async ({ where }) => {
      assert.deepEqual(where, { catalogCourseId: course.id, candidate: { documentId: document.id } });
      return [match];
    });

    const body = await getCourse();
    assert.equal(lookup.mock.callCount(), 1);
    assert.deepEqual(body.exam_source, expectedSource);
    assert.deepEqual(body.exam_candidates, [expectedCandidate]);
  });

  it("rematches row 335 against new catalog courses when the same workbook is ingested again", async () => {
    const courses: CatalogCourse[] = [];
    let matches: typeof match[] = [];
    const previousToken = process.env.SCANNER_TOKEN;
    process.env.SCANNER_TOKEN = "test-exam-scanner";
    stubMethod(prisma, "$transaction", async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
    stubMethod(prisma.catalogCourse, "findMany", async ({ where }) => {
      assert.deepEqual(where, { semesterKey: course.semesterKey });
      return courses;
    });
    stubMethod(prisma.catalogExamPlanDocument, "upsert", async () => ({ id: document.id }));
    stubMethod(prisma.catalogExamCandidate, "deleteMany", async () => {
      matches = [];
      return { count: 0 };
    });
    stubMethod(prisma.catalogExamCandidate, "create", async ({ data }) => {
      matches.push(...data.matches.createMany.data.map((entry: { catalogCourseId: string; matchReasons: string[] }) => ({
        ...match, ...entry, candidate: { ...candidate, ...data, id: candidate.id }
      })));
      return candidate;
    });
    stubMethod(prisma.catalogExamCourseMatch, "findMany", async () => matches);
    const payload = {
      semester_key: document.semesterKey, semester_index: document.semesterIndex,
      file_url: document.fileUrl, file_label: document.fileLabel, content_hash: document.contentHash,
      rows: [{ row_number: 335, weekday: "Di", date: "2027-03-09", time_from: "14:30", time_to: "17:00",
        appointment_type: "Examen", lecturer: "Prof. Dr. Amir Moradi", course_name: candidate.courseName,
        extracted_course_numbers: ["20-00-1178"] }]
    };
    async function ingest(): Promise<any> {
      const response = await fetch(`${baseUrl}/internal/exam-plans`, {
        method: "POST", headers: { "content-type": "application/json", "x-scanner-token": "test-exam-scanner" },
        body: JSON.stringify(payload)
      });
      assert.equal(response.status, 200);
      return response.json();
    }
    try {
      assert.equal((await ingest()).matched_rows, 0);
      courses.push(course);
      assert.equal((await ingest()).matched_rows, 1);
      assert.deepEqual((await getCourse()).exam_candidates, [expectedCandidate]);
    } finally {
      if (previousToken === undefined) delete process.env.SCANNER_TOKEN;
      else process.env.SCANNER_TOKEN = previousToken;
    }
  });
});
