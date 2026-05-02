import { apiClient } from "./client";

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
