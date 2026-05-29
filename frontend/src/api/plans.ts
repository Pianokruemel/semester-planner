import { apiClient } from "./client";
import { CourseColorTag, PlannerSnapshot, SnapshotCategory, SnapshotCourse, SnapshotExam, normalizePlannerSnapshot } from "./types";

export type BackendPlan = PlannerSnapshot & {
  id: string;
  name: string;
};

function normalizePlan(input: BackendPlan): BackendPlan {
  return {
    id: input.id,
    name: input.name,
    ...normalizePlannerSnapshot(input)
  };
}

export async function createPlan(preferredStudyProgramKey: string): Promise<BackendPlan> {
  const response = await apiClient.post<BackendPlan>("/plans", {
    preferred_study_program_key: preferredStudyProgramKey
  });
  return normalizePlan(response.data);
}

export async function fetchPlan(planId: string): Promise<BackendPlan> {
  const response = await apiClient.get<BackendPlan>(`/plans/${encodeURIComponent(planId)}`);
  return normalizePlan(response.data);
}

export async function fetchPlanByToken(token: string): Promise<BackendPlan> {
  const response = await apiClient.get<BackendPlan>(`/plans/by-token/${encodeURIComponent(token)}`);
  return normalizePlan(response.data);
}

export async function rotateShareToken(planId: string): Promise<BackendPlan> {
  const response = await apiClient.post<BackendPlan>(`/plans/${encodeURIComponent(planId)}/rotate-token`);
  return normalizePlan(response.data);
}

export async function updatePlanName(planId: string, name: string): Promise<BackendPlan> {
  const response = await apiClient.patch<BackendPlan>(`/plans/${encodeURIComponent(planId)}`, { name });
  return normalizePlan(response.data);
}

export async function updatePlanPreferredStudyProgram(
  planId: string,
  preferredStudyProgramKey: string
): Promise<BackendPlan> {
  const response = await apiClient.patch<BackendPlan>(`/plans/${encodeURIComponent(planId)}`, {
    preferred_study_program_key: preferredStudyProgramKey
  });
  return normalizePlan(response.data);
}

export async function createCategory(planId: string, payload: { name: string; color: string }): Promise<BackendPlan> {
  const response = await apiClient.post<BackendPlan>(`/plans/${encodeURIComponent(planId)}/categories`, payload);
  return normalizePlan(response.data);
}

export async function updateCategory(
  planId: string,
  payload: { id: string; name: string; color: string }
): Promise<BackendPlan> {
  const response = await apiClient.patch<BackendPlan>(
    `/plans/${encodeURIComponent(planId)}/categories/${encodeURIComponent(payload.id)}`,
    {
      name: payload.name,
      color: payload.color
    }
  );
  return normalizePlan(response.data);
}

export async function deleteCategory(planId: string, categoryId: string): Promise<BackendPlan> {
  const response = await apiClient.delete<BackendPlan>(
    `/plans/${encodeURIComponent(planId)}/categories/${encodeURIComponent(categoryId)}`
  );
  return normalizePlan(response.data);
}

export type CoursePayload = {
  name: string;
  abbreviation: string;
  cp: number;
  category_id: string;
  course_number: string | null;
  instructor?: string | null;
  color_tag?: CourseColorTag | null;
  appointments_raw: string;
};

export async function createCourse(planId: string, payload: CoursePayload): Promise<BackendPlan> {
  const response = await apiClient.post<BackendPlan>(`/plans/${encodeURIComponent(planId)}/courses`, payload);
  return normalizePlan(response.data);
}

export async function updateCourse(planId: string, id: string, payload: CoursePayload): Promise<BackendPlan> {
  const response = await apiClient.patch<BackendPlan>(
    `/plans/${encodeURIComponent(planId)}/courses/${encodeURIComponent(id)}`,
    payload
  );
  return normalizePlan(response.data);
}

export async function patchCourse(planId: string, id: string, payload: Partial<SnapshotCourse>): Promise<BackendPlan> {
  const response = await apiClient.patch<BackendPlan>(
    `/plans/${encodeURIComponent(planId)}/courses/${encodeURIComponent(id)}`,
    {
      name: payload.name,
      abbreviation: payload.abbreviation,
      cp: payload.cp,
      category_id: payload.category_id,
      course_number: payload.course_number,
      instructor: payload.instructor,
      color_tag: payload.color_tag,
      is_active: payload.is_active
    }
  );
  return normalizePlan(response.data);
}

export async function refreshCatalogCourse(planId: string, id: string): Promise<BackendPlan> {
  const response = await apiClient.post<BackendPlan>(
    `/plans/${encodeURIComponent(planId)}/courses/${encodeURIComponent(id)}/refresh-catalog`
  );
  return normalizePlan(response.data);
}

export async function deleteCourse(planId: string, id: string): Promise<BackendPlan> {
  const response = await apiClient.delete<BackendPlan>(`/plans/${encodeURIComponent(planId)}/courses/${encodeURIComponent(id)}`);
  return normalizePlan(response.data);
}

export async function putExam(planId: string, courseId: string, exam: SnapshotExam): Promise<BackendPlan> {
  const response = await apiClient.put<BackendPlan>(
    `/plans/${encodeURIComponent(planId)}/courses/${encodeURIComponent(courseId)}/exam`,
    exam
  );
  return normalizePlan(response.data);
}

export async function deleteExam(planId: string, courseId: string): Promise<BackendPlan> {
  const response = await apiClient.delete<BackendPlan>(
    `/plans/${encodeURIComponent(planId)}/courses/${encodeURIComponent(courseId)}/exam`
  );
  return normalizePlan(response.data);
}

export type ExamCandidateSource = {
  document_id: string;
  semester_key: string;
  semester_index: number;
  file_url: string;
  file_label: string;
  content_hash: string;
  fetched_at: string;
  parsed_at: string | null;
};

export type PlanExamCandidateGroup = {
  course_id: string;
  catalog_course_id: string;
  course_name: string;
  course_number: string | null;
  has_existing_exam: boolean;
  candidates: Array<{
    candidate_id: string;
    date: string;
    time_from: string;
    time_to: string;
    exam_title: string;
    appointment_type: string | null;
    lecturer: string | null;
    match_reasons: string[];
  }>;
};

export async function fetchExamCandidates(
  planId: string
): Promise<{ source: ExamCandidateSource | null; items: PlanExamCandidateGroup[] }> {
  const response = await apiClient.get<{ source: ExamCandidateSource | null; items: PlanExamCandidateGroup[] }>(
    `/plans/${encodeURIComponent(planId)}/exam-candidates`
  );
  return response.data;
}

export async function importCatalogCourse(
  planId: string,
  payload: {
    catalog_course_id: string;
    category_id?: string | null;
    abbreviation?: string;
    cp_override?: number;
    color_tag?: CourseColorTag | null;
    selected_subgroup_key?: string | null;
  }
): Promise<{ plan: BackendPlan; course_id: string }> {
  const response = await apiClient.post<{ plan: BackendPlan; course_id: string }>(
    `/plans/${encodeURIComponent(planId)}/courses/import-catalog`,
    payload
  );
  return {
    course_id: response.data.course_id,
    plan: normalizePlan(response.data.plan)
  };
}

export type { SnapshotCategory, SnapshotCourse };
