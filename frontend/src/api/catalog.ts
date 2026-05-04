import { apiClient } from "./client";

export type CatalogProgrammeMatch = {
  program_key: string;
  program_label: string;
  po_label: string;
  cp: number | null;
  class_path: string[];
  module_number: string;
  module_title: string;
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

export async function fetchCatalogProgrammes(): Promise<CatalogStudyProgram[]> {
  const response = await apiClient.get<CatalogStudyProgram[]>("/catalog/programmes");
  return response.data;
}
