import { useMemo } from "react";
import { PlannerCourse, createAppointmentId } from "../api/types";
import { usePlannerStore } from "../planner/store";

export function useCourses() {
  const { snapshot } = usePlannerStore();

  const data = useMemo<PlannerCourse[]>(() => {
    if (!snapshot) {
      return [];
    }

    const categoryMap = new Map(snapshot.categories.map((category) => [category.id, category]));

    return snapshot.courses.map((course) => ({
      id: course.id,
      catalogCourseId: course.catalog_course_id,
      catalogStatus: course.catalog_status,
      catalogSyncedAt: course.catalog_synced_at,
      catalogLastScannedAt: course.catalog_last_scanned_at,
      catalogLastScannedAtAtSync: course.catalog_last_scanned_at_at_sync,
      catalogHasUpdate: course.catalog_has_update,
      catalogIsModified: course.catalog_is_modified,
      catalogSubgroupKey: course.catalog_subgroup_key,
      catalogSubgroupTitle: course.catalog_subgroup_title,
      catalogProgramKey: course.catalog_program_key,
      catalogProgramLabel: course.catalog_program_label,
      catalogProgramPoLabel: course.catalog_program_po_label,
      catalogProgramClassPath: course.catalog_program_class_path,
      catalogProgramModuleNumber: course.catalog_program_module_number,
      catalogProgramModuleTitle: course.catalog_program_module_title,
      name: course.name,
      abbreviation: course.abbreviation,
      cp: course.cp,
      categoryId: course.category_id,
      courseNumber: course.course_number,
      instructor: course.instructor,
      colorTag: course.color_tag,
      isActive: course.is_active,
      category: course.category_id ? categoryMap.get(course.category_id) ?? null : null,
      exam: course.exam
        ? {
            date: course.exam.date,
            timeFrom: course.exam.time_from,
            timeTo: course.exam.time_to
          }
        : null,
      appointments: course.appointments.map((appointment, index) => ({
        id: createAppointmentId(course.id, appointment, index),
        courseId: course.id,
        date: appointment.date,
        timeFrom: appointment.time_from,
        timeTo: appointment.time_to,
        room: appointment.room,
        type: appointment.type
      }))
    }));
  }, [snapshot]);

  return {
    data,
    isLoading: false
  };
}

export function useToggleCourse() {
  const { toggleCourse } = usePlannerStore();

  return {
    mutate(courseId: string) {
      toggleCourse(courseId);
    },
    async mutateAsync(courseId: string) {
      return toggleCourse(courseId);
    }
  };
}
