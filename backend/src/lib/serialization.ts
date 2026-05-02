import { CatalogAppointment, CatalogCourse, PlanCategory, PlannedAppointment, PlannedCourse, PlannedExam, Prisma } from "@prisma/client";
import { appointmentFingerprint, appointmentTimePlaceKey, plannedAppointmentsFromCatalog } from "./catalogSync";
import { dateFromYmd, ymdFromDate } from "./dates";

type PlannedCourseWithRelations = PlannedCourse & {
  category: PlanCategory | null;
  appointments: PlannedAppointment[];
  exam: PlannedExam | null;
  catalogCourse:
    | (CatalogCourse & {
        appointments: CatalogAppointment[];
      })
    | null;
};

type PlanWithRelations = {
  id: string;
  name: string;
  categories: PlanCategory[];
  courses: PlannedCourseWithRelations[];
};

export function serializeAppointment(appointment: PlannedAppointment | CatalogAppointment) {
  return {
    id: appointment.id,
    date: ymdFromDate(appointment.date),
    time_from: appointment.timeFrom,
    time_to: appointment.timeTo,
    room: appointment.room,
    type: appointment.type,
    position: appointment.position
  };
}

export function serializeExam(exam: PlannedExam | null) {
  if (!exam) {
    return null;
  }

  return {
    id: exam.id,
    date: ymdFromDate(exam.date),
    time_from: exam.timeFrom,
    time_to: exam.timeTo
  };
}

export function serializeCategory(category: PlanCategory, courseCount = 0) {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    position: category.position,
    _count: {
      courses: courseCount
    }
  };
}

export function serializePlannedCourse(course: PlannedCourseWithRelations) {
  const catalogSync = catalogSyncStatus(course);

  return {
    id: course.id,
    catalog_course_id: course.catalogCourseId,
    catalog_status: catalogSync.status,
    catalog_synced_at: course.catalogSyncedAt?.toISOString() ?? null,
    catalog_last_scanned_at: course.catalogCourse?.lastScannedAt.toISOString() ?? null,
    catalog_last_scanned_at_at_sync: course.catalogLastScannedAtAtSync?.toISOString() ?? null,
    catalog_has_update: catalogSync.hasUpdate,
    catalog_is_modified: catalogSync.isModified,
    catalog_subgroup_key: course.catalogSubgroupKey,
    catalog_subgroup_title: course.catalogSubgroupTitle,
    name: course.name,
    abbreviation: course.abbreviation,
    cp: course.cp,
    category_id: course.categoryId,
    course_number: course.courseNumber,
    is_active: course.isActive,
    category: course.category
      ? {
          id: course.category.id,
          name: course.category.name,
          color: course.category.color
        }
      : null,
    exam: serializeExam(course.exam),
    appointments: course.appointments
      .slice()
      .sort((left, right) => left.position - right.position || left.date.getTime() - right.date.getTime())
      .map(serializeAppointment)
  };
}

function catalogSyncStatus(course: PlannedCourseWithRelations) {
  if (!course.catalogCourseId) {
    return { status: "manual" as const, hasUpdate: false, isModified: false };
  }

  if (!course.catalogCourse) {
    return { status: "missing" as const, hasUpdate: false, isModified: false };
  }

  const plannedFingerprint = appointmentFingerprint(course.appointments);
  const syncedFingerprint = course.catalogAppointmentsFingerprint;
  const currentCatalogFingerprint = appointmentFingerprint(catalogAppointmentsForSync(course.catalogCourse, course.catalogSubgroupKey));
  const isModified = Boolean(syncedFingerprint && plannedFingerprint !== syncedFingerprint);
  const hasUpdate = syncedFingerprint ? currentCatalogFingerprint !== syncedFingerprint : plannedFingerprint !== currentCatalogFingerprint;

  if (isModified) {
    return { status: "modified" as const, hasUpdate, isModified };
  }

  return {
    status: hasUpdate ? ("outdated" as const) : ("current" as const),
    hasUpdate,
    isModified
  };
}

function catalogAppointmentsForSync(
  catalogCourse: CatalogCourse & { appointments: CatalogAppointment[] },
  subgroupKey: string | null
) {
  const baseAppointments = plannedAppointmentsFromCatalog(catalogCourse.appointments);
  if (!subgroupKey) {
    return baseAppointments;
  }

  const subgroup = normalizeCatalogSubgroups(catalogCourse.detailsJson).find((entry) => entry.key === subgroupKey);
  if (!subgroup) {
    return baseAppointments;
  }

  const baseAppointmentKeys = new Set(baseAppointments.map(appointmentTimePlaceKey));
  const subgroupAppointments = subgroup.appointments
    .flatMap((appointment) => {
      const candidate = {
        date: dateFromYmd(appointment.date),
        timeFrom: appointment.time_from,
        timeTo: appointment.time_to,
        room: appointment.room,
        type: appointment.type ?? "Uebung",
        position: 0
      };

      return baseAppointmentKeys.has(appointmentTimePlaceKey(candidate)) ? [] : [candidate];
    })
    .map((appointment, index) => ({
      ...appointment,
      position: baseAppointments.length + index
    }));

  return [...baseAppointments, ...subgroupAppointments];
}

function normalizeCatalogSubgroups(detailsJson: Prisma.JsonValue | null) {
  if (!isRecord(detailsJson) || !Array.isArray(detailsJson.small_groups)) {
    return [];
  }

  return detailsJson.small_groups.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.title !== "string") {
      return [];
    }

    const key = typeof entry.key === "string" && entry.key.trim() ? entry.key.trim() : entry.title;
    const appointments = Array.isArray(entry.appointments)
      ? entry.appointments.flatMap((appointment) => {
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

          return [
            {
              date: appointment.date,
              time_from: appointment.time_from,
              time_to: appointment.time_to,
              room: appointment.room,
              type: typeof appointment.type === "string" && appointment.type.trim() ? appointment.type : "Uebung"
            }
          ];
        })
      : [];

    return [{ key, appointments }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function serializePlan(plan: PlanWithRelations) {
  const courseCounts = new Map<string, number>();
  for (const course of plan.courses) {
    if (course.categoryId) {
      courseCounts.set(course.categoryId, (courseCounts.get(course.categoryId) ?? 0) + 1);
    }
  }

  return {
    id: plan.id,
    name: plan.name,
    categories: plan.categories
      .slice()
      .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name, "de"))
      .map((category) => serializeCategory(category, courseCounts.get(category.id) ?? 0)),
    courses: plan.courses
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name, "de"))
      .map(serializePlannedCourse)
  };
}

export function serializeCatalogCourse(
  course: CatalogCourse & {
    appointments?: CatalogAppointment[];
  }
) {
  return {
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
    raw_appointment_text: course.rawAppointmentText,
    first_date: course.firstDate ? ymdFromDate(course.firstDate) : null,
    last_date: course.lastDate ? ymdFromDate(course.lastDate) : null,
    appointment_count: course.appointmentCount,
    last_scanned_at: course.lastScannedAt.toISOString(),
    appointments: course.appointments?.map(serializeAppointment) ?? undefined
  };
}
