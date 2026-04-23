import { useMemo } from "react";
import { PlannerCategory } from "../api/types";
import { CategoryInUseError, usePlannerStore } from "../planner/store";
import { useLocalMutation } from "./useLocalMutation";

export { CategoryInUseError };

export function useCategories() {
  const { snapshot } = usePlannerStore();

  const data = useMemo<PlannerCategory[]>(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.categories.map((category) => ({
      ...category,
      _count: {
        courses: snapshot.courses.filter((course) => course.category_id === category.id).length
      }
    }));
  }, [snapshot]);

  return {
    data,
    isLoading: false
  };
}

export function useCreateCategory() {
  const { createCategory } = usePlannerStore();

  return useLocalMutation(async (payload: { name: string; color: string }) => createCategory(payload));
}

export function useUpdateCategory() {
  const { updateCategory } = usePlannerStore();

  return useLocalMutation(async (payload: { id: string; name: string; color: string }) => updateCategory(payload));
}

export function useDeleteCategory() {
  const { deleteCategory } = usePlannerStore();

  return useLocalMutation(async (payload: { id: string; confirm?: boolean }) => deleteCategory(payload));
}
