import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";

export type CoursePayload = {
  name: string;
  abbreviation: string;
  cp: number;
  category_id: string | null;
  appointments_raw: string;
};

export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CoursePayload) => {
      const response = await apiClient.post("/courses", payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    }
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CoursePayload & { id: string }) => {
      const { id, ...body } = payload;
      const response = await apiClient.put(`/courses/${id}`, body);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    }
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/courses/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    }
  });
}
