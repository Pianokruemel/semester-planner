import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type BackendPlan,
  createPlan,
  deleteCourse as apiDeleteCourse,
  fetchPlan,
  fetchPlanByToken,
  importCatalogCourse,
  patchCourse
} from "../api/plans";
import type { CourseColorTag } from "../api/types";
import { toUICourses, type UICourse } from "./adapter";

const PLAN_ID_KEY = "semester-planner:plan-id";
const THEME_KEY = "semester-planner:theme";
const OBSOLETE_KEYS = ["semester-planner:draft:v1", "semester-planner:ui-preferences:v1"];

export type Theme = "light" | "dark";

type PlanContextValue = {
  planId: string | null;
  plan: BackendPlan | null;
  uiCourses: UICourse[];
  isLoading: boolean;
  error: string | null;
  theme: Theme;
  toggleTheme: () => void;

  startNewPlan: (preferredStudyProgramKey: string) => Promise<void>;
  loadPlanByToken: (token: string) => Promise<void>;
  resetPlan: () => void;

  toggleCourseActive: (courseId: string, isActive: boolean) => Promise<void>;
  removeCourse: (courseId: string) => Promise<void>;
  addCatalogCourse: (
    catalogCourseId: string,
    options?: {
      categoryId?: string | null;
      cpOverride?: number;
      colorTag?: CourseColorTag | null;
      selectedSubgroupKey?: string | null;
    }
  ) => Promise<string>;
  refresh: () => Promise<void>;
};

const PlanContext = createContext<PlanContextValue | null>(null);

function readStoredPlanId(): string | null {
  try {
    return window.localStorage.getItem(PLAN_ID_KEY);
  } catch {
    return null;
  }
}

function writeStoredPlanId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(PLAN_ID_KEY, id);
    else window.localStorage.removeItem(PLAN_ID_KEY);
  } catch {
    /* ignore */
  }
}

function readStoredTheme(): Theme {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

function writeStoredTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

function applyThemeAttr(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function clearObsoleteKeys() {
  try {
    OBSOLETE_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [planId, setPlanId] = useState<string | null>(() => readStoredPlanId());
  const [plan, setPlan] = useState<BackendPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => !!readStoredPlanId());
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    applyThemeAttr(theme);
    writeStoredTheme(theme);
  }, [theme]);

  useEffect(() => {
    clearObsoleteKeys();
  }, []);

  const loadPlan = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await fetchPlan(id);
      setPlan(fetched);
      setPlanId(fetched.id);
      writeStoredPlanId(fetched.id);
    } catch (e) {
      // 404 or anything else: clear state
      setPlan(null);
      setPlanId(null);
      writeStoredPlanId(null);
      const message = e instanceof Error ? e.message : "Plan konnte nicht geladen werden.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Boot: if we have a stored planId, load it.
  useEffect(() => {
    const stored = readStoredPlanId();
    if (stored) {
      void loadPlan(stored);
    } else {
      setIsLoading(false);
    }
  }, [loadPlan]);

  const startNewPlan = useCallback(async (preferredStudyProgramKey: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const created = await createPlan(preferredStudyProgramKey);
      setPlan(created);
      setPlanId(created.id);
      writeStoredPlanId(created.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Plan konnte nicht erstellt werden.";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPlanByToken = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await fetchPlanByToken(token);
      setPlan(loaded);
      setPlanId(loaded.id);
      writeStoredPlanId(loaded.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Plan nicht gefunden.";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPlan = useCallback(() => {
    writeStoredPlanId(null);
    setPlan(null);
    setPlanId(null);
    setError(null);
  }, []);

  const toggleCourseActive = useCallback(
    async (courseId: string, isActive: boolean) => {
      if (!planId) return;
      const updated = await patchCourse(planId, courseId, { is_active: isActive });
      setPlan(updated);
    },
    [planId]
  );

  const removeCourse = useCallback(
    async (courseId: string) => {
      if (!planId) return;
      const updated = await apiDeleteCourse(planId, courseId);
      setPlan(updated);
    },
    [planId]
  );

  const addCatalogCourse = useCallback(
    async (
      catalogCourseId: string,
      options?: {
        categoryId?: string | null;
        cpOverride?: number;
        colorTag?: CourseColorTag | null;
        selectedSubgroupKey?: string | null;
      }
    ): Promise<string> => {
      if (!planId) throw new Error("Kein Plan geladen.");
      const result = await importCatalogCourse(planId, {
        catalog_course_id: catalogCourseId,
        category_id: options?.categoryId ?? null,
        cp_override: options?.cpOverride,
        color_tag: options?.colorTag ?? null,
        selected_subgroup_key: options?.selectedSubgroupKey ?? null
      });
      setPlan(result.plan);
      return result.course_id;
    },
    [planId]
  );

  const refresh = useCallback(async () => {
    if (!planId) return;
    await loadPlan(planId);
  }, [planId, loadPlan]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const uiCourses = useMemo(() => (plan ? toUICourses(plan.courses) : []), [plan]);

  const value = useMemo<PlanContextValue>(
    () => ({
      planId,
      plan,
      uiCourses,
      isLoading,
      error,
      theme,
      toggleTheme,
      startNewPlan,
      loadPlanByToken,
      resetPlan,
      toggleCourseActive,
      removeCourse,
      addCatalogCourse,
      refresh
    }),
    [
      planId,
      plan,
      uiCourses,
      isLoading,
      error,
      theme,
      toggleTheme,
      startNewPlan,
      loadPlanByToken,
      resetPlan,
      toggleCourseActive,
      removeCourse,
      addCatalogCourse,
      refresh
    ]
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
