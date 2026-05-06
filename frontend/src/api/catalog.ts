import { apiClient } from "./client";

export type CatalogProgrammeMatch = {
  program_key: string;
  program_label: string;
  po_label: string;
  cp: number | null;
  class_path: string[];
  category_key: string | null;
  category_name: string | null;
  category_required_cp_min: number | null;
  category_required_cp_max: number | null;
  module_number: string;
  module_title: string;
};

export type CatalogCurriculumCategory = {
  category_key: string;
  name: string;
  required_cp_min: number | null;
  required_cp_max: number | null;
  color: string;
  position: number;
};

export type CatalogCurriculumRequirementGroup = {
  group_key: string;
  name: string;
  required_cp_min: number | null;
  required_cp_max: number | null;
  position: number;
  category_keys: string[];
};

export type CatalogCourseCard = {
  id: string;
  semester_key: string;
  title: string;
  course_number: string | null;
  abbreviation: string | null;
  cp: number | null;
  event_type: string | null;
  faculty: string | null;
  path: string[];
  instructors: string[];
  programmes: CatalogProgrammeMatch[];
  appointment_count: number;
  first_date: string | null;
  last_date: string | null;
};

export type CatalogCourseDetail = CatalogCourseCard & {
  source_url: string | null;
  language: string | null;
  details_json: unknown;
  raw_appointment_text: string | null;
  appointments: Array<{
    id: string;
    date: string;
    time_from: string;
    time_to: string;
    room: string;
    type: string;
  }>;
};

export type CatalogStudyProgram = {
  program_key: string;
  program_label: string;
  page_url: string;
  curriculum_categories: CatalogCurriculumCategory[];
  curriculum_requirement_groups: CatalogCurriculumRequirementGroup[];
  latest_document: {
    po_label: string;
    pdf_url: string;
    pdf_label: string;
    content_hash: string;
    fetch_status: string;
    parse_status: string;
    fetched_at: string;
    parsed_at: string | null;
  } | null;
};

export type CatalogSmallGroupAppointment = {
  date: string;
  time_from: string;
  time_to: string;
  room: string;
  type: string;
  position?: number;
};

export type CatalogSmallGroup = {
  key: string;
  title: string;
  instructors: string[];
  schedule: string;
  appointments: CatalogSmallGroupAppointment[];
  appointment_instructors: Array<{ position: number; instructors: string[] }>;
};

export async function searchCatalogCourses(params: {
  q?: string;
  semester?: string;
  faculty?: string;
  limit?: number;
  page?: number;
}): Promise<{ items: CatalogCourseCard[]; page: number; limit: number; has_more: boolean }> {
  const response = await apiClient.get("/catalog/courses", { params });
  return response.data;
}

export async function fetchCatalogCourse(id: string): Promise<CatalogCourseDetail> {
  const response = await apiClient.get<CatalogCourseDetail>(`/catalog/courses/${encodeURIComponent(id)}`);
  return response.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractSmallGroups(detailsJson: unknown): CatalogSmallGroup[] {
  if (!isRecord(detailsJson) || !Array.isArray(detailsJson.small_groups)) return [];
  return detailsJson.small_groups.flatMap((entry): CatalogSmallGroup[] => {
    if (!isRecord(entry) || typeof entry.title !== "string") return [];
    const key = typeof entry.key === "string" && entry.key.trim() ? entry.key.trim() : entry.title;
    const instructors = Array.isArray(entry.instructors)
      ? entry.instructors.filter((v): v is string => typeof v === "string")
      : [];
    const schedule = typeof entry.schedule === "string" ? entry.schedule : "";
    const appointments = Array.isArray(entry.appointments)
      ? entry.appointments.flatMap((a): CatalogSmallGroupAppointment[] => {
          if (
            !isRecord(a) ||
            typeof a.date !== "string" ||
            typeof a.time_from !== "string" ||
            typeof a.time_to !== "string" ||
            typeof a.room !== "string"
          )
            return [];
          return [
            {
              date: a.date,
              time_from: a.time_from,
              time_to: a.time_to,
              room: a.room,
              type: typeof a.type === "string" && a.type.trim() ? a.type : "Uebung",
              position: typeof a.position === "number" ? a.position : undefined
            }
          ];
        })
      : [];
    const appointmentInstructors = Array.isArray(entry.appointment_instructors)
      ? entry.appointment_instructors.flatMap((row): Array<{ position: number; instructors: string[] }> => {
          if (!isRecord(row) || typeof row.position !== "number" || !Array.isArray(row.instructors)) return [];
          return [
            {
              position: row.position,
              instructors: row.instructors.filter((v): v is string => typeof v === "string")
            }
          ];
        })
      : [];
    return [{ key, title: entry.title, instructors, schedule, appointments, appointment_instructors: appointmentInstructors }];
  });
}

export async function fetchCatalogProgrammes(): Promise<CatalogStudyProgram[]> {
  const response = await apiClient.get<CatalogStudyProgram[]>("/catalog/programmes");
  return response.data;
}
