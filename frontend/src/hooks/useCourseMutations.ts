import { usePlannerStore } from "../planner/store";
import { useLocalMutation } from "./useLocalMutation";

export type CoursePayload = {
  name: string;
  abbreviation: string;
  cp: number;
  category_id: string | null;
  course_number: string | null;
  appointments_raw: string;
};

export function useCreateCourse() {
  const { createCourse } = usePlannerStore();

  return useLocalMutation(async (payload: CoursePayload) => createCourse(payload));
}

export function useUpdateCourse() {
  const { updateCourse } = usePlannerStore();

  return useLocalMutation(async (payload: CoursePayload & { id: string }) => updateCourse(payload.id, payload));
}

export function useDeleteCourse() {
  const { deleteCourse } = usePlannerStore();

  return useLocalMutation(async (id: string) => deleteCourse(id));
}

export function useRefreshCatalogCourse() {
  const { refreshCatalogCourse } = usePlannerStore();

  return useLocalMutation(async (id: string) => refreshCatalogCourse(id));
}
