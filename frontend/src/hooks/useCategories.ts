import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";

type CategoryWithCount = {
  id: string;
  name: string;
  color: string;
  _count?: {
    courses: number;
  };
};

const queryKey = ["categories"];

export function useCategories() {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get<CategoryWithCount[]>("/categories");
      return response.data;
    }
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name: string; color: string }) => {
      const response = await apiClient.post("/categories", payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    }
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: string; name: string; color: string }) => {
      const { id, ...body } = payload;
      const response = await apiClient.put(`/categories/${id}`, body);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    }
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: string; confirm?: boolean }) => {
      return apiClient.delete(`/categories/${payload.id}${payload.confirm ? "?confirm=true" : ""}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    }
  });
}
