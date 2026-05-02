export type AppointmentType = "Vorlesung" | "Uebung";

export type SnapshotCategory = {
  id: string;
  name: string;
  color: string;
};

export type SnapshotAppointment = {
  date: string;
  time_from: string;
  time_to: string;
  room: string;
  type: AppointmentType;
};

export type SnapshotExam = {
  date: string;
  time_from: string;
  time_to: string;
};

export type CatalogSyncStatus = "manual" | "current" | "outdated" | "modified" | "missing";

export type SnapshotCourse = {
  id: string;
  catalog_course_id: string | null;
  catalog_status: CatalogSyncStatus;
  catalog_synced_at: string | null;
  catalog_last_scanned_at: string | null;
  catalog_last_scanned_at_at_sync: string | null;
  catalog_has_update: boolean;
  catalog_is_modified: boolean;
  catalog_subgroup_key: string | null;
  catalog_subgroup_title: string | null;
  name: string;
  abbreviation: string;
  cp: number;
  category_id: string | null;
  course_number: string | null;
  is_active: boolean;
  exam: SnapshotExam | null;
  appointments: SnapshotAppointment[];
};

export type PlannerSnapshot = {
  export_version: typeof plannerSnapshotVersion;
  settings: Record<string, never>;
  categories: SnapshotCategory[];
  courses: SnapshotCourse[];
};

export type PlannerAppointment = {
  id: string;
  courseId: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  room: string;
  type: AppointmentType;
};

export type PlannerExam = {
  date: string;
  timeFrom: string;
  timeTo: string;
};

export type PlannerCourse = {
  id: string;
  catalogCourseId: string | null;
  catalogStatus: CatalogSyncStatus;
  catalogSyncedAt: string | null;
  catalogLastScannedAt: string | null;
  catalogLastScannedAtAtSync: string | null;
  catalogHasUpdate: boolean;
  catalogIsModified: boolean;
  catalogSubgroupKey?: string | null;
  catalogSubgroupTitle?: string | null;
  name: string;
  abbreviation: string;
  cp: number;
  categoryId: string | null;
  courseNumber: string | null;
  isActive: boolean;
  category: SnapshotCategory | null;
  exam: PlannerExam | null;
  appointments: PlannerAppointment[];
};

export type PlannerCategory = SnapshotCategory & {
  _count?: {
    courses: number;
  };
};

export type UiPreferences = {
  dark_mode: boolean;
  show_full_name: boolean;
  active_filters: {
    cp: number[];
    hideTypes: AppointmentType[];
    showRoom: boolean;
    showType: boolean;
    showTime: boolean;
    showTotalCp: boolean;
  };
};

export type Settings = UiPreferences;

export type UiPreferencesPatch = {
  dark_mode?: boolean;
  show_full_name?: boolean;
  active_filters?: Partial<UiPreferences["active_filters"]>;
};

export type SettingsPatch = UiPreferencesPatch;

export const plannerSnapshotVersion = "3.0";

export const defaultUiPreferences: UiPreferences = {
  dark_mode: false,
  show_full_name: false,
  active_filters: {
    cp: [],
    hideTypes: [],
    showRoom: true,
    showType: true,
    showTime: true,
    showTotalCp: true
  }
};

export const defaultSettings = defaultUiPreferences;

export function formatAppointmentType(type: AppointmentType): string {
  return type === "Uebung" ? "Übung" : "Vorlesung";
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCategory(input: unknown, index: number): SnapshotCategory {
  if (!isRecord(input)) {
    throw new Error(`Kategorie ${index + 1} ist ungültig.`);
  }

  if (typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new Error(`Kategorie ${index + 1} hat keine gültige ID.`);
  }

  if (typeof input.name !== "string" || input.name.trim().length === 0) {
    throw new Error(`Kategorie ${index + 1} hat keinen gültigen Namen.`);
  }

  if (typeof input.color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(input.color)) {
    throw new Error(`Kategorie ${index + 1} hat keine gültige Farbe.`);
  }

  return {
    id: input.id,
    name: input.name.trim(),
    color: input.color
  };
}

function normalizeAppointment(input: unknown, index: number): SnapshotAppointment {
  if (!isRecord(input)) {
    throw new Error(`Termin ${index + 1} ist ungültig.`);
  }

  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error(`Termin ${index + 1} hat kein gültiges Datum.`);
  }

  if (typeof input.time_from !== "string" || !/^\d{2}:\d{2}$/.test(input.time_from)) {
    throw new Error(`Termin ${index + 1} hat keine gültige Startzeit.`);
  }

  if (typeof input.time_to !== "string" || !/^\d{2}:\d{2}$/.test(input.time_to)) {
    throw new Error(`Termin ${index + 1} hat keine gültige Endzeit.`);
  }

  if (typeof input.room !== "string") {
    throw new Error(`Termin ${index + 1} hat keinen gültigen Raum.`);
  }

  if (input.type !== "Vorlesung" && input.type !== "Uebung") {
    throw new Error(`Termin ${index + 1} hat keinen gültigen Typ.`);
  }

  return {
    date: input.date,
    time_from: input.time_from,
    time_to: input.time_to,
    room: input.room.trim(),
    type: input.type
  };
}

function normalizeNullableText(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const normalized = input.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCatalogStatus(input: unknown, catalogCourseId: string | null): CatalogSyncStatus {
  if (input === "current" || input === "outdated" || input === "modified" || input === "missing") {
    return input;
  }

  return catalogCourseId ? "outdated" : "manual";
}

function normalizeExam(input: unknown, index: number): SnapshotExam | null {
  if (input == null) {
    return null;
  }

  if (!isRecord(input)) {
    throw new Error(`Prüfung ${index + 1} ist ungültig.`);
  }

  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error(`Prüfung ${index + 1} hat kein gültiges Datum.`);
  }

  if (typeof input.time_from !== "string" || !/^\d{2}:\d{2}$/.test(input.time_from)) {
    throw new Error(`Prüfung ${index + 1} hat keine gültige Startzeit.`);
  }

  if (typeof input.time_to !== "string" || !/^\d{2}:\d{2}$/.test(input.time_to)) {
    throw new Error(`Prüfung ${index + 1} hat keine gültige Endzeit.`);
  }

  return {
    date: input.date,
    time_from: input.time_from,
    time_to: input.time_to
  };
}

function normalizeCourse(input: unknown, index: number, categoryIds: Set<string>): SnapshotCourse {
  if (!isRecord(input)) {
    throw new Error(`Kurs ${index + 1} ist ungültig.`);
  }

  if (typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new Error(`Kurs ${index + 1} hat keine gültige ID.`);
  }

  if (typeof input.name !== "string" || input.name.trim().length === 0) {
    throw new Error(`Kurs ${index + 1} hat keinen gültigen Namen.`);
  }

  if (typeof input.abbreviation !== "string" || input.abbreviation.trim().length === 0) {
    throw new Error(`Kurs ${index + 1} hat keine gültige Abkürzung.`);
  }

  const cp = Number(input.cp);
  if (!Number.isInteger(cp) || cp <= 0) {
    throw new Error(`Kurs ${index + 1} hat keine gültigen CP.`);
  }

  const categoryId = typeof input.category_id === "string" && categoryIds.has(input.category_id) ? input.category_id : null;
  const catalogCourseId = normalizeNullableText(input.catalog_course_id);
  const catalogStatus = normalizeCatalogStatus(input.catalog_status, catalogCourseId);
  const courseNumber = normalizeNullableText(input.course_number);
  const exam = normalizeExam(input.exam, index);
  const appointments = Array.isArray(input.appointments)
    ? input.appointments.map((appointment, appointmentIndex) => normalizeAppointment(appointment, appointmentIndex))
    : [];

  return {
    id: input.id,
    catalog_course_id: catalogCourseId,
    catalog_status: catalogStatus,
    catalog_synced_at: normalizeNullableText(input.catalog_synced_at),
    catalog_last_scanned_at: normalizeNullableText(input.catalog_last_scanned_at),
    catalog_last_scanned_at_at_sync: normalizeNullableText(input.catalog_last_scanned_at_at_sync),
    catalog_has_update: input.catalog_has_update === true,
    catalog_is_modified: input.catalog_is_modified === true || catalogStatus === "modified",
    catalog_subgroup_key: normalizeNullableText(input.catalog_subgroup_key),
    catalog_subgroup_title: normalizeNullableText(input.catalog_subgroup_title),
    name: input.name.trim(),
    abbreviation: input.abbreviation.trim(),
    cp,
    category_id: categoryId,
    course_number: courseNumber,
    is_active: input.is_active !== false,
    exam,
    appointments
  };
}

export function normalizePlannerSnapshot(input: unknown): PlannerSnapshot {
  const source = isRecord(input) ? input : {};
  const categories = Array.isArray(source.categories)
    ? source.categories.map((category, index) => normalizeCategory(category, index))
    : [];
  const categoryIds = new Set(categories.map((category) => category.id));
  const courses = Array.isArray(source.courses)
    ? source.courses.map((course, index) => normalizeCourse(course, index, categoryIds))
    : [];

  return {
    export_version: plannerSnapshotVersion,
    settings: {},
    categories,
    courses
  };
}

export function normalizeUiPreferences(input: unknown): UiPreferences {
  const source = isRecord(input) ? input : {};
  const rawFilters = isRecord(source.active_filters) ? source.active_filters : {};

  return {
    dark_mode: source.dark_mode === true,
    show_full_name: source.show_full_name === true,
    active_filters: {
      cp: Array.isArray(rawFilters.cp)
        ? rawFilters.cp.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
        : defaultUiPreferences.active_filters.cp,
      hideTypes: Array.isArray(rawFilters.hideTypes)
        ? rawFilters.hideTypes.filter(
            (value): value is AppointmentType => value === "Vorlesung" || value === "Uebung"
          )
        : defaultUiPreferences.active_filters.hideTypes,
      showRoom:
        typeof rawFilters.showRoom === "boolean"
          ? rawFilters.showRoom
          : defaultUiPreferences.active_filters.showRoom,
      showType:
        typeof rawFilters.showType === "boolean"
          ? rawFilters.showType
          : defaultUiPreferences.active_filters.showType,
      showTime:
        typeof rawFilters.showTime === "boolean"
          ? rawFilters.showTime
          : defaultUiPreferences.active_filters.showTime,
      showTotalCp:
        typeof rawFilters.showTotalCp === "boolean"
          ? rawFilters.showTotalCp
          : defaultUiPreferences.active_filters.showTotalCp
    }
  };
}

export function mergeUiPreferencesPatch(current: UiPreferences, patch: UiPreferencesPatch): UiPreferences {
  return normalizeUiPreferences({
    ...current,
    ...patch,
    active_filters: {
      ...current.active_filters,
      ...(patch.active_filters ?? {})
    }
  });
}

export function createAppointmentId(courseId: string, appointment: SnapshotAppointment, index: number): string {
  return [courseId, appointment.date, appointment.time_from, appointment.time_to, index].join(":");
}
