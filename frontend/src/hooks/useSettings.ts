import { Settings, SettingsPatch, mergeUiPreferencesPatch } from "../api/types";
import { usePlannerStore } from "../planner/store";
import { useLocalMutation } from "./useLocalMutation";

export function useSettings() {
  const { uiPreferences } = usePlannerStore();

  return {
    data: uiPreferences,
    isLoading: false
  };
}

export function useUpdateSettings() {
  const { uiPreferences, updateUiPreferences } = usePlannerStore();

  return useLocalMutation(async (patch: SettingsPatch): Promise<Settings> => {
    const next = mergeUiPreferencesPatch(uiPreferences, patch);
    updateUiPreferences(patch);
    return next;
  });
}
