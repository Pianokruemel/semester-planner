import { parseAppointments } from "@semester-planner/shared/appointmentParser";
import {
  extractCourseNumbers,
  normalizeCourseTitle,
  stripBracketContents
} from "@semester-planner/shared/examWorkbook";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requirementsForProgram, serializeRequirement } from "../lib/curriculum";
import { dateFromYmd } from "../lib/dates";
import {
  findProgrammeMatchesForCourseNumber,
  findProgrammeMatchesForCourseNumbers,
  normalizeBaseCourseNumber,
  serializeProgrammeMatch
} from "../lib/moduleHandbooks";
import { prisma } from "../lib/prisma";
import { serializeCatalogCourse } from "../lib/serialization";
import { HttpError } from "../middleware/errorHandler";

const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const catalogAppointmentSchema = z.object({
  date: dateSchema,
  time_from: timeSchema,
  time_to: timeSchema,
  room: z.string(),
  type: z.string().min(1).max(32),
  position: z.number().int().min(0).optional()
});

const catalogCourseIngestSchema = z.object({
  semester_key: z.string().min(1),
  source: z.string().min(1).default("tucan"),
  source_key: z.string().min(1),
  source_url: z.string().url().nullable().optional(),
  title: z.string().min(1),
  course_number: z.string().nullable().optional(),
  abbreviation: z.string().nullable().optional(),
  cp: z.number().int().min(0).nullable().optional(),
  event_type: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  faculty: z.string().nullable().optional(),
  path: z.array(z.string()).default([]),
  instructors: z.array(z.string()).default([]),
  details_json: z.unknown().optional(),
  raw_appointment_text: z.string().nullable().optional(),
  appointments: z.array(catalogAppointmentSchema).optional()
});

const ingestSchema = z.object({
  scan_run_id: uuidSchema.optional(),
  semester_key: z.string().min(1),
  status: z.enum(["running", "completed", "failed"]).default("running"),
  courses_failed: z.number().int().min(0).default(0),
  error_text: z.string().nullable().optional(),
  courses: z.array(catalogCourseIngestSchema).default([])
});

const studyProgramSchema = z.object({
  program_key: z.string().trim().min(1),
  program_label: z.string().trim().min(1),
  page_url: z.string().url()
});

const moduleHandbookCourseSchema = z.object({
  module_number: z.string().trim().min(1),
  course_number: z.string().trim().min(1).nullable().optional(),
  module_title: z.string().trim().min(1),
  cp: z.number().int().min(0).nullable().optional(),
  class_path: z.array(z.string()).default([]),
  page_number: z.number().int().positive().nullable().optional()
});

const moduleHandbookDocumentSchema = z.object({
  program_key: z.string().trim().min(1),
  po_label: z.string().trim().min(1),
  pdf_url: z.string().url(),
  pdf_label: z.string().trim().min(1),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/i),
  etag: z.string().nullable().optional(),
  last_modified: z.string().nullable().optional(),
  fetch_status: z.string().trim().min(1).default("fetched"),
  parse_status: z.string().trim().min(1).default("parsed"),
  error_text: z.string().nullable().optional(),
  courses: z.array(moduleHandbookCourseSchema).default([])
});

const moduleHandbookIngestSchema = z.object({
  programmes: z.array(studyProgramSchema).default([]),
  documents: z.array(moduleHandbookDocumentSchema).default([])
});

const examPlanRowSchema = z.object({
  row_number: z.number().int().positive(),
  weekday: z.string().nullable().optional(),
  date: dateSchema.nullable().optional(),
  time_from: timeSchema.nullable().optional(),
  time_to: timeSchema.nullable().optional(),
  appointment_type: z.string().nullable().optional(),
  lecturer: z.string().nullable().optional(),
  course_name: z.string(),
  extracted_course_numbers: z.array(z.string()).default([]),
  parse_error: z.string().nullable().optional()
});

const examPlanIngestSchema = z.object({
  semester_key: z.string().trim().min(1),
  semester_index: z.number().int(),
  file_url: z.string().url(),
  file_label: z.string().trim().min(1),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/i),
  etag: z.string().nullable().optional(),
  last_modified: z.string().nullable().optional(),
  fetch_status: z.string().trim().min(1).default("fetched"),
  parse_status: z.string().trim().min(1).default("parsed"),
  error_text: z.string().nullable().optional(),
  rows: z.array(examPlanRowSchema).default([])
});

function requireScannerToken(req: { header(name: string): string | undefined }) {
  const expected = process.env.SCANNER_TOKEN;
  if (!expected) {
    throw new HttpError(403, "Scanner-Ingest ist nicht konfiguriert.");
  }

  const received = req.header("x-scanner-token") ?? "";
  if (received !== expected) {
    throw new HttpError(403, "Scanner-Token ungültig.");
  }
}

function courseCard(
  course: Awaited<ReturnType<typeof prisma.catalogCourse.findMany>>[number],
  programmes: ReturnType<typeof serializeProgrammeMatch>[] = []
) {
  return {
    id: course.id,
    semester_key: course.semesterKey,
    title: course.title,
    course_number: course.courseNumber,
    abbreviation: course.abbreviation,
    cp: course.cp,
    event_type: course.eventType,
    faculty: course.faculty,
    path: course.path,
    instructors: course.instructors,
    programmes,
    appointment_count: course.appointmentCount,
    first_date: course.firstDate?.toISOString().slice(0, 10) ?? null,
    last_date: course.lastDate?.toISOString().slice(0, 10) ?? null
  };
}

function appointmentsFromCourseInput(course: z.infer<typeof catalogCourseIngestSchema>) {
  const appointments =
    course.appointments ??
    (course.raw_appointment_text
      ? parseAppointments(course.raw_appointment_text).map((appointment, index) => ({
          date: appointment.date,
          time_from: appointment.time_from,
          time_to: appointment.time_to,
          room: appointment.room,
          type: appointment.type,
          position: index
        }))
      : []);

  return appointments.map((appointment, index) => ({
    date: dateFromYmd(appointment.date),
    timeFrom: appointment.time_from,
    timeTo: appointment.time_to,
    room: appointment.room,
    type: appointment.type,
    position: appointment.position ?? index
  }));
}

async function findInstructorMatchIds(q: string, semester: string, faculty: string): Promise<string[]> {
  if (!q) {
    return [];
  }

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM catalog_courses
    WHERE array_to_string(instructors, ' ') ILIKE ${`%${q}%`}
      AND (${semester} = '' OR semester_key = ${semester})
      AND (${faculty} = '' OR faculty = ${faculty})
  `;

  return rows.map((row) => row.id);
}

type ExamPlanRowInput = z.infer<typeof examPlanRowSchema>;

type ExamCatalogCourse = Awaited<ReturnType<typeof prisma.catalogCourse.findMany>>[number];

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeExamCourseNumber(value: string | null | undefined): string | null {
  return normalizeBaseCourseNumber(value);
}

function addToIndex<T>(index: Map<string, T[]>, key: string | null | undefined, value: T) {
  if (!key) {
    return;
  }

  const entries = index.get(key) ?? [];
  entries.push(value);
  index.set(key, entries);
}

function buildExamCourseIndexes(courses: ExamCatalogCourse[]) {
  const byCourseNumber = new Map<string, ExamCatalogCourse[]>();
  const byTitle = new Map<string, ExamCatalogCourse[]>();

  for (const course of courses) {
    addToIndex(byCourseNumber, normalizeExamCourseNumber(course.courseNumber), course);
    addToIndex(byTitle, normalizeCourseTitle(course.title), course);
  }

  return { byCourseNumber, byTitle };
}

function matchExamRowToCatalogCourses(
  row: ExamPlanRowInput,
  indexes: ReturnType<typeof buildExamCourseIndexes>
): Array<{ catalogCourseId: string; matchReasons: string[] }> {
  const matches = new Map<string, { catalogCourseId: string; matchReasons: Set<string> }>();

  function add(course: ExamCatalogCourse, reason: string) {
    const existing = matches.get(course.id);
    if (existing) {
      existing.matchReasons.add(reason);
      return;
    }

    matches.set(course.id, { catalogCourseId: course.id, matchReasons: new Set([reason]) });
  }

  const bracketNumbers = row.extracted_course_numbers.map(normalizeExamCourseNumber).filter((entry): entry is string => Boolean(entry));
  for (const courseNumber of bracketNumbers) {
    for (const course of indexes.byCourseNumber.get(courseNumber) ?? []) {
      add(course, "course-number-brackets");
    }
  }

  const titleNumbers = extractCourseNumbers(row.course_name).map(normalizeExamCourseNumber).filter((entry): entry is string => Boolean(entry));
  for (const courseNumber of titleNumbers) {
    for (const course of indexes.byCourseNumber.get(courseNumber) ?? []) {
      add(course, bracketNumbers.includes(courseNumber) ? "course-number-brackets" : "course-number-title");
    }
  }

  const normalizedTitle = normalizeCourseTitle(row.course_name);
  for (const course of indexes.byTitle.get(normalizedTitle) ?? []) {
    add(course, "course-title-exact");
  }

  const normalizedTitleWithoutBrackets = normalizeCourseTitle(stripBracketContents(row.course_name));
  if (normalizedTitleWithoutBrackets !== normalizedTitle) {
    for (const course of indexes.byTitle.get(normalizedTitleWithoutBrackets) ?? []) {
      add(course, "course-title-exact");
    }
  }

  return [...matches.values()].map((entry) => ({
    catalogCourseId: entry.catalogCourseId,
    matchReasons: ["course-number-brackets", "course-number-title", "course-title-exact"].filter((reason) =>
      entry.matchReasons.has(reason)
    )
  }));
}

function examRowHash(row: ExamPlanRowInput): string {
  return sha256Text(
    JSON.stringify({
      row_number: row.row_number,
      date: row.date,
      time_from: row.time_from,
      time_to: row.time_to,
      course_name: row.course_name,
      appointment_type: row.appointment_type ?? null,
      lecturer: row.lecturer ?? null
    })
  );
}

export const catalogRouter = Router();

catalogRouter.get("/health", async (_req, res) => {
  const latestScan = await prisma.catalogScanRun.findFirst({ orderBy: { startedAt: "desc" } });
  const courseWhere: Prisma.CatalogCourseWhereInput = latestScan ? { semesterKey: latestScan.semesterKey } : {};
  const appointmentWhere: Prisma.CatalogAppointmentWhereInput = latestScan ? { course: { semesterKey: latestScan.semesterKey } } : {};
  const [courseCount, appointmentCount] = await Promise.all([
    prisma.catalogCourse.count({ where: courseWhere }),
    prisma.catalogAppointment.count({ where: appointmentWhere })
  ]);

  res.json({
    latest_scan_status: latestScan?.status ?? null,
    latest_scan_time: latestScan?.finishedAt?.toISOString() ?? latestScan?.startedAt.toISOString() ?? null,
    latest_semester_key: latestScan?.semesterKey ?? null,
    course_count: courseCount,
    appointment_count: appointmentCount
  });
});

catalogRouter.get("/semesters", async (_req, res) => {
  const grouped = await prisma.catalogCourse.groupBy({
    by: ["semesterKey"],
    _count: { _all: true },
    orderBy: { semesterKey: "desc" }
  });

  res.json(grouped.map((entry) => ({ semester_key: entry.semesterKey, course_count: entry._count._all })));
});

catalogRouter.get("/programmes", async (_req, res) => {
  const programmes = await prisma.catalogStudyProgram.findMany({
    orderBy: [{ label: "asc" }],
    select: {
      key: true,
      label: true,
      pageUrl: true,
      documents: {
        orderBy: [{ fetchedAt: "desc" }],
        take: 1,
        select: {
          poLabel: true,
          pdfUrl: true,
          pdfLabel: true,
          contentHash: true,
          fetchStatus: true,
          parseStatus: true,
          fetchedAt: true,
          parsedAt: true
        }
      }
    }
  });

  res.json(
    programmes.map((program) => ({
      program_key: program.key,
      program_label: program.label,
      page_url: program.pageUrl,
      curriculum_categories: requirementsForProgram(program.key).map(serializeRequirement),
      latest_document: program.documents[0]
        ? {
            po_label: program.documents[0].poLabel,
            pdf_url: program.documents[0].pdfUrl,
            pdf_label: program.documents[0].pdfLabel,
            content_hash: program.documents[0].contentHash,
            fetch_status: program.documents[0].fetchStatus,
            parse_status: program.documents[0].parseStatus,
            fetched_at: program.documents[0].fetchedAt.toISOString(),
            parsed_at: program.documents[0].parsedAt?.toISOString() ?? null
          }
        : null
    }))
  );
});

catalogRouter.get("/courses", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const requestedSemester = typeof req.query.semester === "string" ? req.query.semester.trim() : "";
  const faculty = typeof req.query.faculty === "string" ? req.query.faculty.trim() : "";
  const limit = Math.min(Math.max(Number(req.query.limit ?? 25) || 25, 1), 100);
  const page = Math.max(Number(req.query.page ?? 1) || 1, 1);
  const latestScan = requestedSemester ? null : await prisma.catalogScanRun.findFirst({ orderBy: { startedAt: "desc" } });
  const semester = requestedSemester || latestScan?.semesterKey || "";
  const instructorMatchIds = await findInstructorMatchIds(q, semester, faculty);
  const where: Prisma.CatalogCourseWhereInput = {
    ...(semester ? { semesterKey: semester } : {}),
    ...(faculty ? { faculty } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { courseNumber: { contains: q, mode: "insensitive" } },
            { abbreviation: { contains: q, mode: "insensitive" } },
            { faculty: { contains: q, mode: "insensitive" } },
            ...(instructorMatchIds.length > 0 ? [{ id: { in: instructorMatchIds } }] : [])
          ]
        }
      : {})
  };

  const courses = await prisma.catalogCourse.findMany({
    where,
    orderBy: [{ semesterKey: "desc" }, { title: "asc" }],
    skip: (page - 1) * limit,
    take: limit + 1
  });
  const matchesByNumber = await findProgrammeMatchesForCourseNumbers(courses.slice(0, limit).map((course) => course.courseNumber));

  res.json({
    items: courses.slice(0, limit).map((course) => {
      const normalized = normalizeBaseCourseNumber(course.courseNumber);
      const programmes = normalized ? (matchesByNumber.get(normalized) ?? []).map(serializeProgrammeMatch) : [];
      return courseCard(course, programmes);
    }),
    page,
    limit,
    has_more: courses.length > limit
  });
});

catalogRouter.get("/courses/:id", async (req, res) => {
  const id = uuidSchema.parse(req.params.id);
  const course = await prisma.catalogCourse.findUnique({
    where: { id },
    include: { appointments: { orderBy: [{ position: "asc" }, { date: "asc" }] } }
  });

  if (!course) {
    throw new HttpError(404, "Katalogkurs nicht gefunden.");
  }

  const programmes = (await findProgrammeMatchesForCourseNumber(course.courseNumber)).map(serializeProgrammeMatch);
  res.json(serializeCatalogCourse({ ...course, programmes }));
});

catalogRouter.get("/internal/module-handbooks/status", async (req, res) => {
  requireScannerToken(req);
  const programKey = typeof req.query.program_key === "string" ? req.query.program_key.trim() : "";
  const poLabel = typeof req.query.po_label === "string" ? req.query.po_label.trim() : "";
  const pdfUrl = typeof req.query.pdf_url === "string" ? req.query.pdf_url.trim() : "";

  if (!programKey || !poLabel || !pdfUrl) {
    throw new HttpError(400, "program_key, po_label und pdf_url sind erforderlich.");
  }

  const document = await prisma.moduleHandbookDocument.findUnique({
    where: {
      programKey_poLabel_pdfUrl: {
        programKey,
        poLabel,
        pdfUrl
      }
    },
    select: {
      contentHash: true,
      etag: true,
      lastModified: true,
      fetchStatus: true,
      parseStatus: true
    }
  });

  res.json(
    document
      ? {
          content_hash: document.contentHash,
          etag: document.etag,
          last_modified: document.lastModified,
          fetch_status: document.fetchStatus,
          parse_status: document.parseStatus
        }
      : null
  );
});

catalogRouter.post("/internal/module-handbooks", async (req, res) => {
  requireScannerToken(req);
  const payload = moduleHandbookIngestSchema.parse(req.body);

  const result = await prisma.$transaction(async (tx) => {
    for (const program of payload.programmes) {
      await tx.catalogStudyProgram.upsert({
        where: { key: program.program_key },
        create: {
          key: program.program_key,
          label: program.program_label,
          pageUrl: program.page_url
        },
        update: {
          label: program.program_label,
          pageUrl: program.page_url
        }
      });
    }

    let documentsSeen = 0;
    let coursesReplaced = 0;
    for (const document of payload.documents) {
      documentsSeen += 1;
      const parsedAtUpdate = document.parse_status === "parsed" ? { parsedAt: new Date() } : {};
      const saved = await tx.moduleHandbookDocument.upsert({
        where: {
          programKey_poLabel_pdfUrl: {
            programKey: document.program_key,
            poLabel: document.po_label,
            pdfUrl: document.pdf_url
          }
        },
        create: {
          programKey: document.program_key,
          poLabel: document.po_label,
          pdfUrl: document.pdf_url,
          pdfLabel: document.pdf_label,
          contentHash: document.content_hash.toLowerCase(),
          etag: document.etag ?? null,
          lastModified: document.last_modified ?? null,
          fetchStatus: document.fetch_status,
          parseStatus: document.parse_status,
          errorText: document.error_text ?? null,
          fetchedAt: new Date(),
          parsedAt: document.parse_status === "parsed" ? new Date() : null
        },
        update: {
          pdfLabel: document.pdf_label,
          contentHash: document.content_hash.toLowerCase(),
          etag: document.etag ?? null,
          lastModified: document.last_modified ?? null,
          fetchStatus: document.fetch_status,
          parseStatus: document.parse_status,
          errorText: document.error_text ?? null,
          fetchedAt: new Date(),
          ...parsedAtUpdate
        },
        select: { id: true }
      });

      if (document.parse_status === "parsed") {
        await tx.moduleHandbookCourse.deleteMany({ where: { documentId: saved.id } });
        if (document.courses.length > 0) {
          await tx.moduleHandbookCourse.createMany({
            data: document.courses.map((course) => ({
              documentId: saved.id,
              programKey: document.program_key,
              poLabel: document.po_label,
              moduleNumber: normalizeBaseCourseNumber(course.module_number) ?? course.module_number,
              courseNumber: course.course_number ?? null,
              normalizedCourseNumber: normalizeBaseCourseNumber(course.course_number),
              moduleTitle: course.module_title,
              cp: course.cp && course.cp > 0 ? course.cp : null,
              classPath: course.class_path,
              pageNumber: course.page_number ?? null
            }))
          });
          coursesReplaced += document.courses.length;
        }
      }
    }

    return { programmes_seen: payload.programmes.length, documents_seen: documentsSeen, courses_replaced: coursesReplaced };
  });

  res.json(result);
});

catalogRouter.get("/internal/exam-plans/status", async (req, res) => {
  requireScannerToken(req);
  const semesterKey = typeof req.query.semester_key === "string" ? req.query.semester_key.trim() : "";
  const fileUrl = typeof req.query.file_url === "string" ? req.query.file_url.trim() : "";

  if (!semesterKey || !fileUrl) {
    throw new HttpError(400, "semester_key und file_url sind erforderlich.");
  }

  const document = await prisma.catalogExamPlanDocument.findUnique({
    where: {
      semesterKey_fileUrl: {
        semesterKey,
        fileUrl
      }
    },
    select: {
      contentHash: true,
      etag: true,
      lastModified: true,
      fetchStatus: true,
      parseStatus: true
    }
  });

  res.json(
    document
      ? {
          content_hash: document.contentHash,
          etag: document.etag,
          last_modified: document.lastModified,
          fetch_status: document.fetchStatus,
          parse_status: document.parseStatus
        }
      : null
  );
});

catalogRouter.post("/internal/exam-plans", async (req, res) => {
  requireScannerToken(req);
  const payload = examPlanIngestSchema.parse(req.body);
  const validRows = payload.rows.filter(
    (row) => !row.parse_error && row.date && row.time_from && row.time_to && row.course_name.trim().length > 0
  );

  const catalogCourses = await prisma.catalogCourse.findMany({
    where: { semesterKey: payload.semester_key }
  });
  const indexes = buildExamCourseIndexes(catalogCourses);
  const rowsWithMatches = validRows.map((row) => ({
    row,
    matches: matchExamRowToCatalogCourses(row, indexes)
  }));
  const matchedRows = rowsWithMatches.filter((entry) => entry.matches.length > 0);

  const result = await prisma.$transaction(async (tx) => {
    const parsedAtUpdate = payload.parse_status === "parsed" ? { parsedAt: new Date() } : {};
    const document = await tx.catalogExamPlanDocument.upsert({
      where: {
        semesterKey_fileUrl: {
          semesterKey: payload.semester_key,
          fileUrl: payload.file_url
        }
      },
      create: {
        semesterKey: payload.semester_key,
        semesterIndex: payload.semester_index,
        fileUrl: payload.file_url,
        fileLabel: payload.file_label,
        contentHash: payload.content_hash.toLowerCase(),
        etag: payload.etag ?? null,
        lastModified: payload.last_modified ?? null,
        fetchStatus: payload.fetch_status,
        parseStatus: payload.parse_status,
        errorText: payload.error_text ?? null,
        rowCount: payload.rows.length,
        validRowCount: validRows.length,
        matchedRowCount: matchedRows.length,
        unmatchedRowCount: validRows.length - matchedRows.length,
        fetchedAt: new Date(),
        parsedAt: payload.parse_status === "parsed" ? new Date() : null
      },
      update: {
        semesterIndex: payload.semester_index,
        fileLabel: payload.file_label,
        contentHash: payload.content_hash.toLowerCase(),
        etag: payload.etag ?? null,
        lastModified: payload.last_modified ?? null,
        fetchStatus: payload.fetch_status,
        parseStatus: payload.parse_status,
        errorText: payload.error_text ?? null,
        rowCount: payload.rows.length,
        validRowCount: validRows.length,
        matchedRowCount: matchedRows.length,
        unmatchedRowCount: validRows.length - matchedRows.length,
        fetchedAt: new Date(),
        ...parsedAtUpdate
      },
      select: { id: true }
    });

    if (payload.parse_status === "parsed") {
      await tx.catalogExamCandidate.deleteMany({ where: { documentId: document.id } });
      for (const entry of matchedRows) {
        const row = entry.row;
        await tx.catalogExamCandidate.create({
          data: {
            documentId: document.id,
            rowNumber: row.row_number,
            weekday: row.weekday ?? null,
            date: dateFromYmd(row.date as string),
            timeFrom: row.time_from as string,
            timeTo: row.time_to as string,
            appointmentType: row.appointment_type ?? null,
            lecturer: row.lecturer ?? null,
            courseName: row.course_name,
            normalizedCourseTitle: normalizeCourseTitle(row.course_name),
            extractedCourseNumbers: row.extracted_course_numbers.map((entry) => entry.trim()).filter(Boolean),
            rowHash: examRowHash(row),
            matches: {
              createMany: {
                data: entry.matches.map((match) => ({
                  catalogCourseId: match.catalogCourseId,
                  matchReasons: match.matchReasons
                })),
                skipDuplicates: true
              }
            }
          }
        });
      }
    }

    return {
      document_id: document.id,
      rows_seen: payload.rows.length,
      valid_rows: validRows.length,
      matched_rows: matchedRows.length,
      unmatched_rows: validRows.length - matchedRows.length,
      candidates_replaced: matchedRows.length,
      matches_created: matchedRows.reduce((sum, entry) => sum + entry.matches.length, 0)
    };
  });

  res.json(result);
});

catalogRouter.post("/internal/ingest", async (req, res) => {
  requireScannerToken(req);
  const payload = ingestSchema.parse(req.body);

  let coursesCreated = 0;
  let coursesUpdated = 0;

  const scanRun = await prisma.$transaction(async (tx) => {
      const run = payload.scan_run_id
        ? await tx.catalogScanRun.update({
            where: { id: payload.scan_run_id },
            data: {
              status: payload.status,
              finishedAt: payload.status === "running" ? null : new Date(),
              coursesSeen: { increment: payload.courses.length },
              coursesFailed: { increment: payload.courses_failed },
              ...(payload.error_text !== undefined ? { errorText: payload.error_text } : {})
            }
          })
      : await tx.catalogScanRun.create({
          data: {
            semesterKey: payload.semester_key,
            status: payload.status,
            finishedAt: payload.status === "running" ? null : new Date(),
            coursesSeen: payload.courses.length,
            coursesFailed: payload.courses_failed,
            errorText: payload.error_text ?? null
          }
        });

    for (const course of payload.courses) {
      const appointments = appointmentsFromCourseInput(course);
      const dates = appointments.map((appointment) => appointment.date.getTime()).sort((left, right) => left - right);
      const existing = await tx.catalogCourse.findUnique({
        where: {
          semesterKey_source_sourceKey: {
            semesterKey: course.semester_key,
            source: course.source,
            sourceKey: course.source_key
          }
        },
        select: { id: true }
      });

      const saved = await tx.catalogCourse.upsert({
        where: {
          semesterKey_source_sourceKey: {
            semesterKey: course.semester_key,
            source: course.source,
            sourceKey: course.source_key
          }
        },
        create: {
          semesterKey: course.semester_key,
          source: course.source,
          sourceKey: course.source_key,
          sourceUrl: course.source_url ?? null,
          title: course.title,
          courseNumber: course.course_number ?? null,
          abbreviation: course.abbreviation ?? null,
          cp: course.cp && course.cp > 0 ? course.cp : null,
          eventType: course.event_type ?? null,
          language: course.language ?? null,
          faculty: course.faculty ?? null,
          path: course.path,
          instructors: course.instructors,
          detailsJson: (course.details_json ?? {}) as Prisma.InputJsonValue,
          rawAppointmentText: course.raw_appointment_text ?? null,
          firstDate: dates[0] ? new Date(dates[0]) : null,
          lastDate: dates[dates.length - 1] ? new Date(dates[dates.length - 1] as number) : null,
          appointmentCount: appointments.length,
          lastScannedAt: new Date()
        },
        update: {
          sourceUrl: course.source_url ?? null,
          title: course.title,
          courseNumber: course.course_number ?? null,
          abbreviation: course.abbreviation ?? null,
          cp: course.cp && course.cp > 0 ? course.cp : null,
          eventType: course.event_type ?? null,
          language: course.language ?? null,
          faculty: course.faculty ?? null,
          path: course.path,
          instructors: course.instructors,
          detailsJson: (course.details_json ?? {}) as Prisma.InputJsonValue,
          rawAppointmentText: course.raw_appointment_text ?? null,
          firstDate: dates[0] ? new Date(dates[0]) : null,
          lastDate: dates[dates.length - 1] ? new Date(dates[dates.length - 1] as number) : null,
          appointmentCount: appointments.length,
          lastScannedAt: new Date()
        }
      });

      if (existing) {
        coursesUpdated += 1;
      } else {
        coursesCreated += 1;
      }

      await tx.catalogAppointment.deleteMany({ where: { courseId: saved.id } });
      if (appointments.length > 0) {
        await tx.catalogAppointment.createMany({
          data: appointments.map((appointment) => ({ ...appointment, courseId: saved.id })),
          skipDuplicates: true
        });
      }
    }

    return tx.catalogScanRun.update({
      where: { id: run.id },
      data: {
        coursesCreated: { increment: coursesCreated },
        coursesUpdated: { increment: coursesUpdated }
      }
    });
  });

  res.json({
    scan_run_id: scanRun.id,
    courses_seen: payload.courses.length,
    courses_created: coursesCreated,
    courses_updated: coursesUpdated,
    courses_failed: payload.courses_failed,
    appointments_seen: payload.courses.reduce((sum, course) => sum + appointmentsFromCourseInput(course).length, 0)
  });
});
