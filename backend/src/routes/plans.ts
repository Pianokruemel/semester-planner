import { parseAppointments } from "@semester-planner/shared/appointmentParser";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { appointmentFingerprint, appointmentTimePlaceKey, plannedAppointmentsFromCatalog } from "../lib/catalogSync";
import { requirementsForProgram } from "../lib/curriculum";
import { dateFromYmd } from "../lib/dates";
import { findProgrammeMatchesForCourseNumber, serializeProgrammeMatch } from "../lib/moduleHandbooks";
import { prisma } from "../lib/prisma";
import { serializePlan } from "../lib/serialization";
import { generateUniqueShareToken } from "../lib/shareToken";
import { HttpError } from "../middleware/errorHandler";

const uuidSchema = z.string().uuid();
const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const colorTagSchema = z.string().regex(/^chip-[1-8]$/);
const shareTokenSchema = z.string().regex(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);

const includePlan = {
  categories: true,
  courses: {
    include: {
      category: true,
      appointments: true,
      exam: true,
      catalogCourse: {
        include: {
          appointments: true
        }
      }
    }
  }
} satisfies Prisma.PlanInclude;

const planCreateSchema = z.object({
  preferred_study_program_key: z.string().trim().min(1)
});

const planPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    preferred_study_program_key: z.string().trim().min(1).optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Mindestens ein Feld ist erforderlich."
  });

const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  color: hexColorSchema,
  position: z.number().int().optional()
});

const categoryPatchSchema = categoryCreateSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: "Mindestens ein Feld ist erforderlich."
});

const manualCourseSchema = z.object({
  name: z.string().trim().min(1),
  abbreviation: z.string().trim().min(1).max(32),
  cp: z.number().int().positive(),
  category_id: uuidSchema,
  course_number: z.string().trim().min(1).nullable().optional(),
  instructor: z.string().trim().min(1).nullable().optional(),
  color_tag: colorTagSchema.nullable().optional(),
  appointments_raw: z.string().default("")
});

const coursePatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    abbreviation: z.string().trim().min(1).max(32).optional(),
    cp: z.number().int().positive().optional(),
    category_id: uuidSchema.optional(),
    course_number: z.string().trim().min(1).nullable().optional(),
    instructor: z.string().trim().min(1).nullable().optional(),
    color_tag: colorTagSchema.nullable().optional(),
    is_active: z.boolean().optional(),
    appointments_raw: z.string().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Mindestens ein Feld ist erforderlich."
  });

const catalogImportSchema = z.object({
  catalog_course_id: uuidSchema,
  category_id: uuidSchema.nullable().optional(),
  abbreviation: z.string().trim().min(1).max(32).optional(),
  cp_override: z.number().int().positive().optional(),
  color_tag: colorTagSchema.nullable().optional(),
  selected_subgroup_key: z.string().trim().min(1).nullable().optional()
});

const examSchema = z.object({
  date: dateSchema,
  time_from: timeSchema,
  time_to: timeSchema
});

function normalizeCourseNumber(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function nextColorTag(planId: string): Promise<string> {
  const count = await prisma.plannedCourse.count({ where: { planId } });
  return `chip-${(count % 8) + 1}`;
}

function appointmentCreateMany(rawText: string) {
  return parseAppointments(rawText).map((appointment, index) => ({
    date: dateFromYmd(appointment.date),
    timeFrom: appointment.time_from,
    timeTo: appointment.time_to,
    room: appointment.room,
    type: appointment.type,
    position: index
  }));
}

type PlannedAppointmentCreateInput = {
  date: Date;
  timeFrom: string;
  timeTo: string;
  room: string;
  type: string;
  position: number;
};

type CatalogSubgroup = {
  key: string;
  title: string;
  appointments: Array<{
    date: string;
    time_from: string;
    time_to: string;
    room: string;
    type?: string;
    position?: number;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCatalogSubgroups(detailsJson: Prisma.JsonValue | null): CatalogSubgroup[] {
  if (!isRecord(detailsJson) || !Array.isArray(detailsJson.small_groups)) {
    return [];
  }

  return detailsJson.small_groups.flatMap((entry): CatalogSubgroup[] => {
    if (!isRecord(entry) || typeof entry.title !== "string") {
      return [];
    }

    const key = typeof entry.key === "string" && entry.key.trim() ? entry.key.trim() : entry.title;
    const appointments = Array.isArray(entry.appointments)
      ? entry.appointments.flatMap((appointment): CatalogSubgroup["appointments"] => {
          if (!isRecord(appointment)) {
            return [];
          }

          if (
            typeof appointment.date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(appointment.date) ||
            typeof appointment.time_from !== "string" ||
            !/^\d{2}:\d{2}$/.test(appointment.time_from) ||
            typeof appointment.time_to !== "string" ||
            !/^\d{2}:\d{2}$/.test(appointment.time_to) ||
            typeof appointment.room !== "string"
          ) {
            return [];
          }

          const type = typeof appointment.type === "string" && appointment.type.trim() ? appointment.type : "Uebung";
          const normalized = {
            date: appointment.date,
            time_from: appointment.time_from,
            time_to: appointment.time_to,
            room: appointment.room,
            type
          };

          return typeof appointment.position === "number" ? [{ ...normalized, position: appointment.position }] : [normalized];
        })
      : [];

    return [{ key, title: entry.title, appointments }];
  });
}

function selectedCatalogAppointmentData(
  catalogCourse: Prisma.CatalogCourseGetPayload<{ include: { appointments: true } }>,
  selectedSubgroupKey: string | null | undefined
): { appointments: PlannedAppointmentCreateInput[]; subgroupTitle: string | null } {
  const baseAppointments = plannedAppointmentsFromCatalog(catalogCourse.appointments);
  const key = selectedSubgroupKey?.trim();
  if (!key) {
    return { appointments: baseAppointments, subgroupTitle: null };
  }

  const subgroup = normalizeCatalogSubgroups(catalogCourse.detailsJson).find((entry) => entry.key === key);
  if (!subgroup) {
    throw new HttpError(400, "Ausgewählte Übungsgruppe nicht gefunden.");
  }

  const baseAppointmentKeys = new Set(baseAppointments.map(appointmentTimePlaceKey));
  const subgroupAppointments = subgroup.appointments
    .slice()
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0) || left.date.localeCompare(right.date))
    .flatMap((appointment) => {
      const type = appointment.type ?? "Uebung";
      const candidate = {
        date: dateFromYmd(appointment.date),
        timeFrom: appointment.time_from,
        timeTo: appointment.time_to,
        room: appointment.room,
        type,
        position: 0
      };
      return baseAppointmentKeys.has(appointmentTimePlaceKey(candidate)) ? [] : [candidate];
    })
    .map((appointment, index) => {
      return {
        ...appointment,
        position: baseAppointments.length + index
      };
    });

  return {
    appointments: [...baseAppointments, ...subgroupAppointments],
    subgroupTitle: subgroup.title
  };
}

async function autoLinkExamFromCatalog(
  courseId: string,
  catalogCourseId: string,
  options: { overwrite: boolean }
): Promise<void> {
  const latestDocument = await prisma.catalogExamPlanDocument.findFirst({
    where: { parseStatus: "parsed" },
    orderBy: [{ semesterIndex: "desc" }, { fetchedAt: "desc" }],
    select: { id: true }
  });
  if (!latestDocument) {
    return;
  }

  const matches = await prisma.catalogExamCourseMatch.findMany({
    where: { catalogCourseId, candidate: { documentId: latestDocument.id } },
    include: { candidate: { select: { date: true, timeFrom: true, timeTo: true } } }
  });
  const onlyMatch = matches.length === 1 ? matches[0] : null;
  if (!onlyMatch) {
    return;
  }

  const candidate = onlyMatch.candidate;
  if (options.overwrite) {
    await prisma.plannedExam.upsert({
      where: { courseId },
      create: { courseId, date: candidate.date, timeFrom: candidate.timeFrom, timeTo: candidate.timeTo },
      update: { date: candidate.date, timeFrom: candidate.timeFrom, timeTo: candidate.timeTo }
    });
    return;
  }

  const existing = await prisma.plannedExam.findUnique({ where: { courseId }, select: { id: true } });
  if (existing) {
    return;
  }
  await prisma.plannedExam.create({
    data: { courseId, date: candidate.date, timeFrom: candidate.timeFrom, timeTo: candidate.timeTo }
  });
}

async function fetchPlan(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: includePlan
  });

  if (!plan) {
    throw new HttpError(404, "Plan nicht gefunden.");
  }

  return plan;
}

async function ensurePlan(planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true } });
  if (!plan) {
    throw new HttpError(404, "Plan nicht gefunden.");
  }
}

async function ensureStudyProgram(programKey: string | null | undefined) {
  if (!programKey) {
    return null;
  }

  const program = await prisma.catalogStudyProgram.findUnique({
    where: { key: programKey },
    select: { key: true, label: true }
  });
  if (!program) {
    throw new HttpError(400, "Studiengang nicht gefunden.");
  }

  return program;
}

async function ensureCategory(planId: string, categoryId: string | null | undefined) {
  if (!categoryId) {
    return;
  }

  const category = await prisma.planCategory.findFirst({ where: { id: categoryId, planId }, select: { id: true } });
  if (!category) {
    throw new HttpError(400, "Kategorie nicht gefunden.");
  }
}

async function syncCurriculumCategories(tx: Prisma.TransactionClient, planId: string, programKey: string) {
  for (const requirement of requirementsForProgram(programKey)) {
    const existingByKey = await tx.planCategory.findFirst({
      where: { planId, curriculumCategoryKey: requirement.key },
      select: { id: true }
    });

    if (existingByKey) {
      await tx.planCategory.update({
        where: { id: existingByKey.id },
        data: {
          name: requirement.name,
          color: requirement.color,
          position: requirement.position,
          source: "curriculum",
          requiredCpMin: requirement.requiredCpMin,
          requiredCpMax: requirement.requiredCpMax
        }
      });
      continue;
    }

    const existingByName = await tx.planCategory.findFirst({
      where: { planId, name: requirement.name },
      select: { id: true }
    });

    if (existingByName) {
      await tx.planCategory.update({
        where: { id: existingByName.id },
        data: {
          color: requirement.color,
          position: requirement.position,
          source: "curriculum",
          curriculumCategoryKey: requirement.key,
          requiredCpMin: requirement.requiredCpMin,
          requiredCpMax: requirement.requiredCpMax
        }
      });
      continue;
    }

    await tx.planCategory.create({
      data: {
        planId,
        name: requirement.name,
        color: requirement.color,
        position: requirement.position,
        source: "curriculum",
        curriculumCategoryKey: requirement.key,
        requiredCpMin: requirement.requiredCpMin,
        requiredCpMax: requirement.requiredCpMax
      }
    });
  }
}

function handlePrismaConstraint(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new HttpError(409, "Datensatz existiert bereits.");
  }

  throw error;
}

export const plansRouter = Router();

plansRouter.post("/", async (req, res) => {
  const payload = planCreateSchema.parse(req.body ?? {});
  await ensureStudyProgram(payload.preferred_study_program_key);
  const shareToken = await generateUniqueShareToken();
  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.plan.create({
      data: {
        preferredStudyProgramKey: payload.preferred_study_program_key,
        shareToken
      },
      select: { id: true }
    });

    await syncCurriculumCategories(tx, created.id, payload.preferred_study_program_key);

    return tx.plan.findUniqueOrThrow({
      where: { id: created.id },
      include: includePlan
    });
  });

  res.status(201).json(serializePlan(plan));
});

plansRouter.get("/by-token/:token", async (req, res) => {
  const token = shareTokenSchema.parse(req.params.token);
  const plan = await prisma.plan.findUnique({ where: { shareToken: token }, include: includePlan });
  if (!plan) {
    throw new HttpError(404, "Plan nicht gefunden.");
  }
  res.json(serializePlan(plan));
});

plansRouter.post("/:planId/rotate-token", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  await ensurePlan(planId);
  const shareToken = await generateUniqueShareToken();
  await prisma.plan.update({ where: { id: planId }, data: { shareToken } });
  res.json(serializePlan(await fetchPlan(planId)));
});

plansRouter.get("/:planId", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const plan = await fetchPlan(planId);
  if (!plan.shareToken) {
    const shareToken = await generateUniqueShareToken();
    await prisma.plan.update({ where: { id: planId }, data: { shareToken } });
    plan.shareToken = shareToken;
  }
  res.json(serializePlan(plan));
});

plansRouter.patch("/:planId", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const payload = planPatchSchema.parse(req.body);
  await ensureStudyProgram(payload.preferred_study_program_key);

  let plan;
  try {
    const data: Prisma.PlanUncheckedUpdateInput = {};
    if (payload.name !== undefined) {
      data.name = payload.name;
    }
    if (payload.preferred_study_program_key !== undefined) {
      const courseCount = await prisma.plannedCourse.count({ where: { planId } });
      if (courseCount > 0) {
        throw new HttpError(409, "Studiengang kann nicht geändert werden, nachdem Kurse angelegt wurden.");
      }
      data.preferredStudyProgramKey = payload.preferred_study_program_key;
    }

    plan = await prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id: planId },
        data
      });

      if (payload.preferred_study_program_key) {
        await syncCurriculumCategories(tx, planId, payload.preferred_study_program_key);
      }

      return tx.plan.findUniqueOrThrow({
        where: { id: planId },
        include: includePlan
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new HttpError(404, "Plan nicht gefunden.");
    }

    throw error;
  }

  res.json(serializePlan(plan));
});

plansRouter.get("/:planId/categories", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  res.json(serializePlan(await fetchPlan(planId)).categories);
});

plansRouter.post("/:planId/categories", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const payload = categoryCreateSchema.parse(req.body);
  await ensurePlan(planId);

  try {
    await prisma.planCategory.create({
      data: {
        planId,
        name: payload.name,
        color: payload.color,
        position: payload.position ?? 0
      }
    });
  } catch (error) {
    handlePrismaConstraint(error);
  }

  res.status(201).json(serializePlan(await fetchPlan(planId)));
});

plansRouter.patch("/:planId/categories/:categoryId", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const categoryId = uuidSchema.parse(req.params.categoryId);
  const payload = categoryPatchSchema.parse(req.body);
  const existing = await prisma.planCategory.findFirst({ where: { id: categoryId, planId }, select: { id: true, source: true } });
  if (!existing) {
    throw new HttpError(400, "Kategorie nicht gefunden.");
  }

  try {
    const data: Prisma.PlanCategoryUpdateInput = {};
    if (payload.name !== undefined && existing.source !== "curriculum") {
      data.name = payload.name;
    }
    if (payload.color !== undefined) {
      data.color = payload.color;
    }
    if (payload.position !== undefined) {
      data.position = payload.position;
    }

    await prisma.planCategory.update({
      where: { id: categoryId },
      data
    });
  } catch (error) {
    handlePrismaConstraint(error);
  }

  res.json(serializePlan(await fetchPlan(planId)));
});

plansRouter.delete("/:planId/categories/:categoryId", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const categoryId = uuidSchema.parse(req.params.categoryId);
  const category = await prisma.planCategory.findFirst({ where: { id: categoryId, planId }, select: { id: true, source: true } });
  if (!category) {
    throw new HttpError(400, "Kategorie nicht gefunden.");
  }
  if (category.source === "curriculum") {
    throw new HttpError(409, "Curriculum-Kategorien können nicht gelöscht werden.");
  }

  await prisma.$transaction([
    prisma.plannedCourse.updateMany({ where: { planId, categoryId }, data: { categoryId: null } }),
    prisma.planCategory.delete({ where: { id: categoryId } })
  ]);

  res.json(serializePlan(await fetchPlan(planId)));
});

plansRouter.get("/:planId/courses", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  res.json(serializePlan(await fetchPlan(planId)).courses);
});

plansRouter.get("/:planId/exam-candidates", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  await ensurePlan(planId);

  const plannedCourses = await prisma.plannedCourse.findMany({
    where: { planId, catalogCourseId: { not: null } },
    select: {
      id: true,
      name: true,
      courseNumber: true,
      catalogCourseId: true,
      exam: true
    },
    orderBy: [{ name: "asc" }]
  });
  const catalogCourseIds = plannedCourses.flatMap((course) => (course.catalogCourseId ? [course.catalogCourseId] : []));
  const latestDocument = await prisma.catalogExamPlanDocument.findFirst({
    where: { parseStatus: "parsed" },
    orderBy: [{ semesterIndex: "desc" }, { fetchedAt: "desc" }]
  });
  const source = latestDocument
    ? {
        document_id: latestDocument.id,
        semester_key: latestDocument.semesterKey,
        semester_index: latestDocument.semesterIndex,
        file_url: latestDocument.fileUrl,
        file_label: latestDocument.fileLabel,
        content_hash: latestDocument.contentHash,
        fetched_at: latestDocument.fetchedAt.toISOString(),
        parsed_at: latestDocument.parsedAt?.toISOString() ?? null
      }
    : null;

  if (!latestDocument || catalogCourseIds.length === 0) {
    res.json({ source, items: [] });
    return;
  }

  const matches = await prisma.catalogExamCourseMatch.findMany({
    where: {
      catalogCourseId: { in: catalogCourseIds },
      candidate: { documentId: latestDocument.id }
    },
    include: {
      candidate: true
    },
    orderBy: [{ candidate: { date: "asc" } }, { candidate: { timeFrom: "asc" } }]
  });
  const matchesByCatalogCourseId = new Map<string, typeof matches>();
  for (const match of matches) {
    const entries = matchesByCatalogCourseId.get(match.catalogCourseId) ?? [];
    entries.push(match);
    matchesByCatalogCourseId.set(match.catalogCourseId, entries);
  }

  res.json({
    source,
    items: plannedCourses.flatMap((course) => {
      if (!course.catalogCourseId) {
        return [];
      }

      const entries = matchesByCatalogCourseId.get(course.catalogCourseId) ?? [];
      if (entries.length === 0) {
        return [];
      }

      return [
        {
          course_id: course.id,
          catalog_course_id: course.catalogCourseId,
          course_name: course.name,
          course_number: course.courseNumber,
          has_existing_exam: Boolean(course.exam),
          candidates: entries.map((entry) => ({
            candidate_id: entry.candidate.id,
            date: entry.candidate.date.toISOString().slice(0, 10),
            time_from: entry.candidate.timeFrom,
            time_to: entry.candidate.timeTo,
            exam_title: entry.candidate.courseName,
            appointment_type: entry.candidate.appointmentType,
            lecturer: entry.candidate.lecturer,
            match_reasons: entry.matchReasons
          }))
        }
      ];
    })
  });
});

plansRouter.post("/:planId/courses", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const payload = manualCourseSchema.parse(req.body);
  await ensurePlan(planId);
  await ensureCategory(planId, payload.category_id);

  const appointments = appointmentCreateMany(payload.appointments_raw);
  const colorTag = payload.color_tag ?? (await nextColorTag(planId));
  await prisma.plannedCourse.create({
    data: {
      planId,
      name: payload.name,
      abbreviation: payload.abbreviation,
      cp: payload.cp,
      categoryId: payload.category_id ?? null,
      courseNumber: normalizeCourseNumber(payload.course_number),
      instructor: normalizeOptionalText(payload.instructor),
      colorTag,
      appointments: {
        createMany: {
          data: appointments
        }
      }
    }
  });

  res.status(201).json(serializePlan(await fetchPlan(planId)));
});

plansRouter.post("/:planId/courses/import-catalog", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const payload = catalogImportSchema.parse(req.body);
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, preferredStudyProgramKey: true } });
  if (!plan) {
    throw new HttpError(404, "Plan nicht gefunden.");
  }
  if (!plan.preferredStudyProgramKey) {
    throw new HttpError(409, "Bitte zuerst einen Studiengang auswählen.");
  }
  await ensureCategory(planId, payload.category_id);

  const catalogCourse = await prisma.catalogCourse.findUnique({
    where: { id: payload.catalog_course_id },
    include: { appointments: true }
  });

  if (!catalogCourse) {
    throw new HttpError(404, "Katalogkurs nicht gefunden.");
  }

  const selectedProgramKey = plan.preferredStudyProgramKey;
  const selectedProgram = await ensureStudyProgram(selectedProgramKey);
  const programmeMatches = (await findProgrammeMatchesForCourseNumber(catalogCourse.courseNumber)).map(serializeProgrammeMatch);
  const selectedProgrammeMatch = selectedProgramKey
    ? programmeMatches.find((entry) => entry.program_key === selectedProgramKey) ?? null
    : null;
  const selectedProgrammeCp = selectedProgrammeMatch?.cp && selectedProgrammeMatch.cp > 0 ? selectedProgrammeMatch.cp : null;
  const cp = selectedProgrammeCp ?? payload.cp_override;
  if (!cp) {
    throw new HttpError(400, "CP-Angabe ist für den Import erforderlich.");
  }
  let categoryId = payload.category_id ?? null;
  if (selectedProgrammeMatch?.category_key) {
    categoryId =
      (
        await prisma.planCategory.findFirst({
          where: { planId, curriculumCategoryKey: selectedProgrammeMatch.category_key },
          select: { id: true }
        })
      )?.id ?? categoryId;
  }
  if (!categoryId) {
    throw new HttpError(400, "Kategorie ist für den Import erforderlich.");
  }

  const selected = selectedCatalogAppointmentData(catalogCourse, payload.selected_subgroup_key);
  const colorTag = payload.color_tag ?? (await nextColorTag(planId));
  const plannedCourse = await prisma.plannedCourse.create({
    data: {
      planId,
      catalogCourseId: catalogCourse.id,
      catalogSyncedAt: new Date(),
      catalogLastScannedAtAtSync: catalogCourse.lastScannedAt,
      catalogAppointmentsFingerprint: appointmentFingerprint(selected.appointments),
      catalogSubgroupKey: payload.selected_subgroup_key ?? null,
      catalogSubgroupTitle: selected.subgroupTitle,
      catalogProgramKey: selectedProgram?.key ?? selectedProgrammeMatch?.program_key ?? null,
      catalogProgramLabel: selectedProgram?.label ?? selectedProgrammeMatch?.program_label ?? null,
      catalogProgramPoLabel: selectedProgrammeMatch?.po_label ?? null,
      catalogProgramClassPath: selectedProgrammeMatch?.class_path ?? [],
      catalogProgramModuleNumber: selectedProgrammeMatch?.module_number ?? null,
      catalogProgramModuleTitle: selectedProgrammeMatch?.module_title ?? null,
      categoryId,
      name: catalogCourse.title,
      abbreviation: payload.abbreviation ?? catalogCourse.abbreviation ?? catalogCourse.courseNumber ?? catalogCourse.title.slice(0, 32),
      cp,
      courseNumber: catalogCourse.courseNumber,
      instructor: catalogCourse.instructors[0] ?? null,
      colorTag,
      appointments: {
        createMany: {
          data: selected.appointments
        }
      }
    }
  });

  await autoLinkExamFromCatalog(plannedCourse.id, catalogCourse.id, { overwrite: true });

  res.status(201).json({
    plan: serializePlan(await fetchPlan(planId)),
    course_id: plannedCourse.id
  });
});

plansRouter.post("/:planId/courses/:courseId/refresh-catalog", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const courseId = uuidSchema.parse(req.params.courseId);

  const existing = await prisma.plannedCourse.findFirst({
    where: { id: courseId, planId },
    include: {
      catalogCourse: {
        include: {
          appointments: true
        }
      }
    }
  });

  if (!existing) {
    throw new HttpError(404, "Kurs nicht gefunden.");
  }

  if (!existing.catalogCourseId) {
    throw new HttpError(400, "Dieser Kurs ist nicht mit dem Katalog verknüpft.");
  }

  if (!existing.catalogCourse) {
    throw new HttpError(409, "Der verknüpfte Katalogkurs ist nicht mehr verfügbar.");
  }

  const catalogCourse = existing.catalogCourse;
  const selected = selectedCatalogAppointmentData(catalogCourse, existing.catalogSubgroupKey);

  await prisma.$transaction(async (tx) => {
    await tx.plannedAppointment.deleteMany({ where: { courseId } });
    if (selected.appointments.length > 0) {
      await tx.plannedAppointment.createMany({
        data: selected.appointments.map((appointment) => ({ ...appointment, courseId }))
      });
    }

    await tx.plannedCourse.update({
      where: { id: courseId },
      data: {
        catalogSyncedAt: new Date(),
        catalogLastScannedAtAtSync: catalogCourse.lastScannedAt,
        catalogAppointmentsFingerprint: appointmentFingerprint(selected.appointments),
        catalogSubgroupTitle: selected.subgroupTitle
      }
    });
  });

  await autoLinkExamFromCatalog(courseId, catalogCourse.id, { overwrite: false });

  res.json(serializePlan(await fetchPlan(planId)));
});

plansRouter.patch("/:planId/courses/:courseId", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const courseId = uuidSchema.parse(req.params.courseId);
  const payload = coursePatchSchema.parse(req.body);
  await ensureCategory(planId, payload.category_id);

  const existing = await prisma.plannedCourse.findFirst({ where: { id: courseId, planId }, select: { id: true } });
  if (!existing) {
    throw new HttpError(404, "Kurs nicht gefunden.");
  }

  await prisma.$transaction(async (tx) => {
    const data: Prisma.PlannedCourseUncheckedUpdateInput = {};
    if (payload.name !== undefined) {
      data.name = payload.name;
    }
    if (payload.abbreviation !== undefined) {
      data.abbreviation = payload.abbreviation;
    }
    if (payload.cp !== undefined) {
      data.cp = payload.cp;
    }
    if (payload.category_id !== undefined) {
      data.categoryId = payload.category_id;
    }
    if (payload.course_number !== undefined) {
      data.courseNumber = normalizeCourseNumber(payload.course_number);
    }
    if (payload.instructor !== undefined) {
      data.instructor = normalizeOptionalText(payload.instructor);
    }
    if (payload.color_tag !== undefined) {
      data.colorTag = payload.color_tag;
    }
    if (payload.is_active !== undefined) {
      data.isActive = payload.is_active;
    }

    await tx.plannedCourse.update({
      where: { id: courseId },
      data
    });

    if (payload.appointments_raw !== undefined) {
      await tx.plannedAppointment.deleteMany({ where: { courseId } });
      const appointments = appointmentCreateMany(payload.appointments_raw);
      if (appointments.length > 0) {
        await tx.plannedAppointment.createMany({
          data: appointments.map((appointment) => ({ ...appointment, courseId }))
        });
      }
    }
  });

  res.json(serializePlan(await fetchPlan(planId)));
});

plansRouter.delete("/:planId/courses/:courseId", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const courseId = uuidSchema.parse(req.params.courseId);
  const deleted = await prisma.plannedCourse.deleteMany({ where: { id: courseId, planId } });
  if (deleted.count === 0) {
    throw new HttpError(404, "Kurs nicht gefunden.");
  }

  res.json(serializePlan(await fetchPlan(planId)));
});

plansRouter.put("/:planId/courses/:courseId/exam", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const courseId = uuidSchema.parse(req.params.courseId);
  const payload = examSchema.parse(req.body);
  const existing = await prisma.plannedCourse.findFirst({ where: { id: courseId, planId }, select: { id: true } });
  if (!existing) {
    throw new HttpError(404, "Kurs nicht gefunden.");
  }

  await prisma.plannedExam.upsert({
    where: { courseId },
    create: {
      courseId,
      date: dateFromYmd(payload.date),
      timeFrom: payload.time_from,
      timeTo: payload.time_to
    },
    update: {
      date: dateFromYmd(payload.date),
      timeFrom: payload.time_from,
      timeTo: payload.time_to
    }
  });

  res.json(serializePlan(await fetchPlan(planId)));
});

plansRouter.delete("/:planId/courses/:courseId/exam", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const courseId = uuidSchema.parse(req.params.courseId);
  const existing = await prisma.plannedCourse.findFirst({ where: { id: courseId, planId }, select: { id: true } });
  if (!existing) {
    throw new HttpError(404, "Kurs nicht gefunden.");
  }

  await prisma.plannedExam.deleteMany({ where: { courseId } });
  res.json(serializePlan(await fetchPlan(planId)));
});
