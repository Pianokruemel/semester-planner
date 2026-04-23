import { parseAppointments } from "../planner/appointmentParser";
import { usePlannerStore } from "../planner/store";
import { useLocalMutation } from "./useLocalMutation";

export type CoursePayload = {
  name: string;
  abbreviation: string;
  cp: number;
  category_id: string | null;
  appointments_raw: string;
};

export function useCreateCourse() {
  const { createCourse } = usePlannerStore();

  return useLocalMutation(async (payload: CoursePayload) =>
    createCourse({
      name: payload.name,
      abbreviation: payload.abbreviation,
      cp: payload.cp,
      category_id: payload.category_id,
      appointments: parseAppointments(payload.appointments_raw)
    })
  );
}

export function useUpdateCourse() {
  const { updateCourse } = usePlannerStore();

  return useLocalMutation(async (payload: CoursePayload & { id: string }) =>
    updateCourse(payload.id, {
      name: payload.name,
      abbreviation: payload.abbreviation,
      cp: payload.cp,
      category_id: payload.category_id,
      appointments: parseAppointments(payload.appointments_raw)
    })
  );
}

export function useDeleteCourse() {
  const { deleteCourse } = usePlannerStore();

  return useLocalMutation(async (id: string) => deleteCourse(id));
}
