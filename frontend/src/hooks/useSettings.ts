import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { defaultSettings, Settings } from "../api/types";

const queryKey = ["settings"];

type UnknownFilters = Record<string, unknown>;

function normalizeSettings(payload: Partial<Settings> | undefined): Settings {
  const rawFilters = (payload?.active_filters ?? {}) as UnknownFilters;
  const hideTypesRaw = Array.isArray(rawFilters.hideTypes)
    ? rawFilters.hideTypes
    : Array.isArray(rawFilters.types)
      ? rawFilters.types
      : defaultSettings.active_filters.hideTypes;

  return {
    dark_mode: payload?.dark_mode ?? defaultSettings.dark_mode,
    show_full_name: payload?.show_full_name ?? defaultSettings.show_full_name,
    active_filters: {
      cp: Array.isArray(rawFilters.cp)
        ? rawFilters.cp.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
        : defaultSettings.active_filters.cp,
      hideTypes: hideTypesRaw.filter((value) => value === "Vorlesung" || value === "Uebung") as Array<
        "Vorlesung" | "Uebung"
      >,
      showRoom:
        typeof rawFilters.showRoom === "boolean" ? rawFilters.showRoom : defaultSettings.active_filters.showRoom,
      showType:
        typeof rawFilters.showType === "boolean" ? rawFilters.showType : defaultSettings.active_filters.showType,
      showTime:
        typeof rawFilters.showTime === "boolean" ? rawFilters.showTime : defaultSettings.active_filters.showTime
    }
  };
}

export function useSettings() {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get<Partial<Settings>>("/settings");
      return normalizeSettings(response.data);
    }
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Settings) => {
      await apiClient.put("/settings", settings);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    }
  });
}
