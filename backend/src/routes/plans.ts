import { parseAppointments } from "@semester-planner/shared/appointmentParser";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { appointmentFingerprint, appointmentTimePlaceKey, plannedAppointmentsFromCatalog } from "../lib/catalogSync";
import { dateFromYmd } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { serializePlan } from "../lib/serialization";
import { HttpError } from "../middleware/errorHandler";

const uuidSchema = z.string().uuid();
const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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

const planPatchSchema = z.object({
  name: z.string().trim().min(1).max(200)
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
  category_id: uuidSchema.nullable().optional(),
  course_number: z.string().trim().min(1).nullable().optional(),
  appointments_raw: z.string().default("")
});

const coursePatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    abbreviation: z.string().trim().min(1).max(32).optional(),
    cp: z.number().int().positive().optional(),
    category_id: uuidSchema.nullable().optional(),
    course_number: z.string().trim().min(1).nullable().optional(),
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

async function ensureCategory(planId: string, categoryId: string | null | undefined) {
  if (!categoryId) {
    return;
  }

  const category = await prisma.planCategory.findFirst({ where: { id: categoryId, planId }, select: { id: true } });
  if (!category) {
    throw new HttpError(400, "Kategorie nicht gefunden.");
  }
}

function handlePrismaConstraint(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new HttpError(409, "Datensatz existiert bereits.");
  }

  throw error;
}

export const plansRouter = Router();

plansRouter.post("/", async (_req, res) => {
  const plan = await prisma.plan.create({
    data: {},
    include: includePlan
  });

  res.status(201).json(serializePlan(plan));
});

plansRouter.get("/:planId", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  res.json(serializePlan(await fetchPlan(planId)));
});

plansRouter.patch("/:planId", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const payload = planPatchSchema.parse(req.body);

  let plan;
  try {
    plan = await prisma.plan.update({
      where: { id: planId },
      data: { name: payload.name },
      include: includePlan
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
  await ensureCategory(planId, categoryId);

  try {
    const data: Prisma.PlanCategoryUpdateInput = {};
    if (payload.name !== undefined) {
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
  await ensureCategory(planId, categoryId);

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

plansRouter.post("/:planId/courses", async (req, res) => {
  const planId = uuidSchema.parse(req.params.planId);
  const payload = manualCourseSchema.parse(req.body);
  await ensurePlan(planId);
  await ensureCategory(planId, payload.category_id);

  const appointments = appointmentCreateMany(payload.appointments_raw);
  await prisma.plannedCourse.create({
    data: {
      planId,
      name: payload.name,
      abbreviation: payload.abbreviation,
      cp: payload.cp,
      categoryId: payload.category_id ?? null,
      courseNumber: normalizeCourseNumber(payload.course_number),
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
  await ensurePlan(planId);
  await ensureCategory(planId, payload.category_id);

  const catalogCourse = await prisma.catalogCourse.findUnique({
    where: { id: payload.catalog_course_id },
    include: { appointments: true }
  });

  if (!catalogCourse) {
    throw new HttpError(404, "Katalogkurs nicht gefunden.");
  }

  const selected = selectedCatalogAppointmentData(catalogCourse, payload.selected_subgroup_key);
  const plannedCourse = await prisma.plannedCourse.create({
    data: {
      planId,
      catalogCourseId: catalogCourse.id,
      catalogSyncedAt: new Date(),
      catalogLastScannedAtAtSync: catalogCourse.lastScannedAt,
      catalogAppointmentsFingerprint: appointmentFingerprint(selected.appointments),
      catalogSubgroupKey: payload.selected_subgroup_key ?? null,
      catalogSubgroupTitle: selected.subgroupTitle,
      categoryId: payload.category_id ?? null,
      name: catalogCourse.title,
      abbreviation: payload.abbreviation ?? catalogCourse.abbreviation ?? catalogCourse.courseNumber ?? catalogCourse.title.slice(0, 32),
      cp: payload.cp_override ?? (catalogCourse.cp && catalogCourse.cp > 0 ? catalogCourse.cp : 6),
      courseNumber: catalogCourse.courseNumber,
      appointments: {
        createMany: {
          data: selected.appointments
        }
      }
    }
  });

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
