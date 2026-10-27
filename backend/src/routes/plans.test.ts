import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma } from "../lib/prisma";
import { plansRouter } from "./plans";

const planId = "5b08ad70-77db-4bb2-8bb7-9320169ab81e";
const courseId = "c205f6b8-1802-4beb-bd91-d65845808440";
const catalogCourseId = "a5db5cf9-2279-4a58-85bf-66384827eb35";
const winter = "Wintersemester 2026/27";
const summer = "Sommersemester 2027";

function document(id: string, semesterKey = winter, fetchedAt = "2026-10-20T12:00:00Z", parseStatus = "parsed") {
  return {
    id,
    semesterKey,
    semesterIndex: semesterKey === winter ? 4053 : 4054,
    fileUrl: `https://example.test/${id}.xlsx`,
    fileLabel: `${semesterKey} exam plan`,
    contentHash: "a".repeat(64),
    fetchedAt: new Date(fetchedAt),
    parsedAt: parseStatus === "parsed" ? new Date(fetchedAt) : null,
    parseStatus
  };
}

function plannedCourse(id = courseId, catalogId = catalogCourseId, semesterKey = winter) {
  return {
    id,
    name: "Physical Attacks and Countermeasures",
    courseNumber: "20-00-1178",
    catalogCourseId: catalogId,
    catalogCourse: { semesterKey },
    exam: null
  };
}

function match(id: string, documentId: string, catalogId = catalogCourseId) {
  return {
    catalogCourseId: catalogId,
    matchReasons: ["course-number-brackets", "course-title-exact"],
    candidate: {
      id,
      documentId,
      date: new Date("2027-03-09T00:00:00Z"),
      timeFrom: "14:30",
      timeTo: "17:00",
      courseName: "Physical Attacks and Countermeasures (20-00-1178)",
      appointmentType: "Examen",
      lecturer: "Prof. Dr. Amir Moradi"
    }
  };
}

async function invoke(method: string, path: string, params: Record<string, string> = { planId }, body?: unknown) {
  const layer = plansRouter.stack.find((entry: any) => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer?.route);
  let response: any;
  const handler: any = layer.route.stack[0]!.handle;
  const res = { json(value: unknown) { response = value; }, status() { return res; } };
  await handler({ params, body }, res);
  return response;
}

const restoreMethods: Array<() => void> = [];
function stub(target: any, method: string, implementation: (...args: any[]) => any) {
  const original = target[method];
  const replacement = mock.fn(implementation);
  target[method] = replacement;
  restoreMethods.push(() => { target[method] = original; });
  return replacement;
}
afterEach(() => { restoreMethods.splice(0).reverse().forEach((restore) => restore()); });

describe("plan exam candidates", () => {
  function fixtures(courses: ReturnType<typeof plannedCourse>[], documents: ReturnType<typeof document>[], matches: ReturnType<typeof match>[]) {
    stub(prisma.plan, "findUnique", async () => ({ id: planId }));
    stub(prisma.plannedCourse, "findMany", async () => courses);
    const documentQuery = stub(prisma.catalogExamPlanDocument, "findMany", async (args: any) => {
      assert.deepEqual(args.where, { semesterKey: { in: [...new Set(courses.map((course) => course.catalogCourse.semesterKey))] }, parseStatus: "parsed" });
      assert.deepEqual(args.orderBy, [{ fetchedAt: "desc" }, { id: "desc" }]);
      return documents
        .filter((entry) => args.where.semesterKey.in.includes(entry.semesterKey) && entry.parseStatus === args.where.parseStatus)
        .sort((left, right) => right.fetchedAt.getTime() - left.fetchedAt.getTime());
    });
    const matchQuery = stub(prisma.catalogExamCourseMatch, "findMany", async (args: any) => matches.filter((entry) =>
      args.where.OR.some((condition: any) => condition.catalogCourseId === entry.catalogCourseId && condition.candidate.documentId === entry.candidate.documentId)
    ));
    return { documentQuery, matchQuery };
  }

  it("uses the linked course semester and latest successful workbook, retaining every candidate", async () => {
    fixtures([plannedCourse()], [
      document("winter-old", winter, "2026-10-01T12:00:00Z"),
      document("winter-current"),
      document("winter-failed", winter, "2026-10-25T12:00:00Z", "failed"),
      document("summer-newer", summer, "2026-10-26T12:00:00Z")
    ], [
      match("old", "winter-old"),
      match("first", "winter-current"),
      match("second", "winter-current"),
      match("wrong-semester", "summer-newer")
    ]);

    const response = await invoke("get", "/:planId/exam-candidates");
    assert.equal(response.source.document_id, "winter-current");
    assert.equal(response.source.semester_key, winter);
    assert.equal(response.items.length, 1);
    assert.deepEqual(response.items[0].source, response.source);
    assert.deepEqual(response.items[0].candidates.map((entry: any) => entry.candidate_id), ["first", "second"]);
    assert.deepEqual(response.items[0].candidates[0], {
      candidate_id: "first",
      date: "2027-03-09",
      time_from: "14:30",
      time_to: "17:00",
      exam_title: "Physical Attacks and Countermeasures (20-00-1178)",
      appointment_type: "Examen",
      lecturer: "Prof. Dr. Amir Moradi",
      match_reasons: ["course-number-brackets", "course-title-exact"]
    });
  });

  it("uses each course's own workbook for a plan spanning semesters", async () => {
    fixtures([plannedCourse(), plannedCourse("summer-course", "summer-catalog-course", summer)], [
      document("winter-document"),
      document("summer-document", summer)
    ], [
      match("winter-exam", "winter-document"),
      match("summer-exam", "summer-document", "summer-catalog-course"),
      match("cross-semester", "summer-document")
    ]);

    const response = await invoke("get", "/:planId/exam-candidates");
    assert.equal(response.source, null);
    assert.deepEqual(response.items.map((entry: any) => [entry.source.semester_key, entry.candidates.map((candidate: any) => candidate.candidate_id)]), [
      [winter, ["winter-exam"]],
      [summer, ["summer-exam"]]
    ]);
  });

  it("returns no source or items when only another semester has a parsed workbook", async () => {
    const { matchQuery } = fixtures([plannedCourse()], [document("summer-document", summer)], [match("exam", "summer-document")]);
    assert.deepEqual(await invoke("get", "/:planId/exam-candidates"), { source: null, items: [] });
    assert.equal(matchQuery.mock.callCount(), 0);
  });

  it("returns the selected source and no items when the workbook has no course matches", async () => {
    fixtures([plannedCourse()], [document("winter-document")], []);
    const response = await invoke("get", "/:planId/exam-candidates");
    assert.equal(response.source.document_id, "winter-document");
    assert.deepEqual(response.items, []);
  });

  it("does not select a global workbook when the plan has no linked catalog courses", async () => {
    fixtures([], [document("winter-document")], []);
    assert.deepEqual(await invoke("get", "/:planId/exam-candidates"), { source: null, items: [] });
  });
});

describe("catalog exam auto-linking", () => {
  function refreshFixtures(matches: ReturnType<typeof match>[], existingExam: { id: string } | null = null) {
    stub(prisma.plannedCourse, "findFirst", async () => ({
      id: courseId,
      catalogCourseId,
      catalogSubgroupKey: null,
      catalogCourse: { id: catalogCourseId, semesterKey: winter, appointments: [], lastScannedAt: new Date() }
    }));
    stub(prisma, "$transaction", async (callback: any) => callback({
      plannedAppointment: { deleteMany: async () => ({ count: 0 }) },
      plannedCourse: { update: async () => ({ id: courseId }) }
    }));
    const documentQuery = stub(prisma.catalogExamPlanDocument, "findFirst", async (args: any) => {
      assert.deepEqual(args, {
        where: { semesterKey: winter, parseStatus: "parsed" },
        orderBy: [{ fetchedAt: "desc" }, { id: "desc" }],
        select: { id: true }
      });
      return { id: "winter-document" };
    });
    stub(prisma.catalogExamCourseMatch, "findMany", async (args: any) => {
      assert.deepEqual(args.where, { catalogCourseId, candidate: { documentId: "winter-document" } });
      return matches;
    });
    stub(prisma.plannedExam, "findUnique", async () => existingExam);
    const createExam = stub(prisma.plannedExam, "create", async () => ({}));
    const upsertExam = stub(prisma.plannedExam, "upsert", async () => ({}));
    stub(prisma.plan, "findUnique", async () => ({
      id: planId, name: "Plan", shareToken: null, preferredStudyProgramKey: null, categories: [], courses: []
    }));
    return { documentQuery, createExam, upsertExam };
  }

  it("links the sole candidate from the course's semester when refreshing", async () => {
    const { createExam } = refreshFixtures([match("exam", "winter-document")]);
    await invoke("post", "/:planId/courses/:courseId/refresh-catalog", { planId, courseId });
    assert.deepEqual(createExam.mock.calls[0]?.arguments[0], {
      data: { courseId, date: new Date("2027-03-09T00:00:00Z"), timeFrom: "14:30", timeTo: "17:00" }
    });
  });

  it("links the sole candidate from the imported course's semester", async () => {
    const { upsertExam } = refreshFixtures([match("exam", "winter-document")]);
    stub(prisma.plan, "findUnique", async (args: any) => args.select
      ? { id: planId, preferredStudyProgramKey: "msc-it-security" }
      : { id: planId, name: "Plan", shareToken: null, preferredStudyProgramKey: null, categories: [], courses: [] });
    stub(prisma.catalogCourse, "findUnique", async () => ({
      id: catalogCourseId, semesterKey: winter, title: "Physical Attacks and Countermeasures", courseNumber: "20-00-1178",
      appointments: [], instructors: [], lastScannedAt: new Date()
    }));
    stub(prisma.catalogStudyProgram, "findUnique", async () => ({ key: "msc-it-security", label: "IT Security" }));
    stub(prisma.moduleHandbookCourse, "findMany", async () => []);
    stub(prisma.planCategory, "findFirst", async () => ({ id: "category" }));
    stub(prisma.plannedCourse, "count", async () => 0);
    stub(prisma.plannedCourse, "create", async () => ({ id: courseId }));

    await invoke("post", "/:planId/courses/import-catalog", { planId }, {
      catalog_course_id: catalogCourseId,
      category_id: "ab036c08-05ce-4a40-a238-aa7468be5fb5",
      cp_override: 6
    });
    assert.deepEqual(upsertExam.mock.calls[0]?.arguments[0], {
      where: { courseId },
      create: { courseId, date: new Date("2027-03-09T00:00:00Z"), timeFrom: "14:30", timeTo: "17:00" },
      update: { date: new Date("2027-03-09T00:00:00Z"), timeFrom: "14:30", timeTo: "17:00" }
    });
  });

  it("does not choose among multiple candidates", async () => {
    const { createExam, upsertExam } = refreshFixtures([match("first", "winter-document"), match("second", "winter-document")]);
    await invoke("post", "/:planId/courses/:courseId/refresh-catalog", { planId, courseId });
    assert.equal(createExam.mock.callCount(), 0);
    assert.equal(upsertExam.mock.callCount(), 0);
  });

  it("preserves an existing exam when refreshing", async () => {
    const { createExam, upsertExam } = refreshFixtures([match("exam", "winter-document")], { id: "manual-exam" });
    await invoke("post", "/:planId/courses/:courseId/refresh-catalog", { planId, courseId });
    assert.equal(createExam.mock.callCount(), 0);
    assert.equal(upsertExam.mock.callCount(), 0);
  });

  it("does not auto-link when the course semester has no parsed workbook", async () => {
    const { createExam, upsertExam } = refreshFixtures([]);
    stub(prisma.catalogExamPlanDocument, "findFirst", async () => null);
    const matches = stub(prisma.catalogExamCourseMatch, "findMany", async () => []);
    await invoke("post", "/:planId/courses/:courseId/refresh-catalog", { planId, courseId });
    assert.equal(matches.mock.callCount(), 0);
    assert.equal(createExam.mock.callCount(), 0);
    assert.equal(upsertExam.mock.callCount(), 0);
  });
});
