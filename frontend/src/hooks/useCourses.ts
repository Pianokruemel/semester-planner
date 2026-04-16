import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { Course } from "../api/types";

const queryKey = ["courses"];

export function useCourses() {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get<Course[]>("/courses");
      return response.data;
    }
  });
}

export function useToggleCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (courseId: string) => {
      await apiClient.patch(`/courses/${courseId}/toggle`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    }
  });
}
