import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BackendPlan,
  CoursePayload,
  createCategory as createCategoryRequest,
  createCourse as createCourseRequest,
  createPlan as createPlanRequest,
  deleteCategory as deleteCategoryRequest,
  deleteCourse as deleteCourseRequest,
  deleteExam as deleteExamRequest,
  fetchPlan,
  importCatalogCourse as importCatalogCourseRequest,
  patchCourse,
  putExam,
  refreshCatalogCourse as refreshCatalogCourseRequest,
  updateCategory as updateCategoryRequest,
  updateCourse as updateCourseRequest,
  updatePlanName
} from "../api/plans";
import {
  PlannerSnapshot,
  SnapshotCategory,
  SnapshotCourse,
  SnapshotExam,
  UiPreferences,
  UiPreferencesPatch,
  defaultUiPreferences,
  mergeUiPreferencesPatch,
  normalizeUiPreferences
} from "../api/types";

const planIdStorageKey = "semester-planner:plan-id";
const obsoleteDraftStorageKey = "semester-planner:draft:v1";
const uiPreferencesStorageKey = "semester-planner:ui-preferences:v1";

type PlannerContextValue = {
  snapshot: PlannerSnapshot | null;
  planId: string | null;
  planName: string | null;
  uiPreferences: UiPreferences;
  hasCurrentPlanner: boolean;
  hasPersistedDraft: boolean;
  hasUnsavedChanges: boolean;
  isLoadingPlan: boolean;
  startNewPlanner: () => Promise<void>;
  resumePersistedDraft: () => void;
  updateUiPreferences: (patch: UiPreferencesPatch) => void;
  renamePlan: (name: string) => Promise<void>;
  createCategory: (payload: { name: string; color: string }) => Promise<SnapshotCategory>;
  updateCategory: (payload: { id: string; name: string; color: string }) => Promise<SnapshotCategory>;
  deleteCategory: (payload: { id: string; confirm?: boolean }) => Promise<void>;
  createCourse: (payload: CoursePayload) => Promise<SnapshotCourse>;
  updateCourse: (id: string, payload: CoursePayload) => Promise<SnapshotCourse>;
  setCourseNumber: (id: string, courseNumber: string | null) => Promise<SnapshotCourse>;
  setCourseExam: (id: string, exam: SnapshotExam) => Promise<SnapshotCourse>;
  clearCourseExam: (id: string) => Promise<SnapshotCourse>;
  applyImportedExams: (payload: Array<{ courseId: string; exam: SnapshotExam }>) => Promise<SnapshotCourse[]>;
  deleteCourse: (id: string) => Promise<void>;
  toggleCourse: (id: string) => Promise<SnapshotCourse>;
  refreshCatalogCourse: (id: string) => Promise<SnapshotCourse>;
  importCatalogCourse: (payload: {
    catalog_course_id: string;
    category_id?: string | null;
    abbreviation?: string;
    cp_override?: number;
    selected_subgroup_key?: string | null;
  }) => Promise<{ courseId: string }>;
};

function readJsonStorage(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStoredPlanId(): string | null {
  try {
    const value = window.localStorage.getItem(planIdStorageKey);
    return value && value.trim().length > 0 ? value : null;
  } catch {
    return null;
  }
}

function ensurePlanId(planId: string | null): string {
  if (!planId) {
    throw new Error("Bitte zuerst eine Planung erstellen.");
  }

  return planId;
}

function applyPlanStorage(plan: BackendPlan) {
  window.localStorage.setItem(planIdStorageKey, plan.id);
  window.localStorage.removeItem(obsoleteDraftStorageKey);
}

function findCourse(plan: BackendPlan | null, courseId: string): SnapshotCourse {
  const course = plan?.courses.find((entry) => entry.id === courseId);
  if (!course) {
    throw new Error("Kurs nicht gefunden.");
  }

  return course;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export class CategoryInUseError extends Error {
  public readonly affectedCourses: string[];

  constructor(affectedCourses: string[]) {
    super("Diese Kategorie ist in Verwendung.");
    this.name = "CategoryInUseError";
    this.affectedCourses = affectedCourses;
  }
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<BackendPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(() => readStoredPlanId());
  const [isLoadingPlan, setIsLoadingPlan] = useState(Boolean(planId));
  const [uiPreferences, setUiPreferences] = useState<UiPreferences>(() =>
    normalizeUiPreferences(readJsonStorage(uiPreferencesStorageKey) ?? defaultUiPreferences)
  );

  useEffect(() => {
    window.localStorage.setItem(uiPreferencesStorageKey, JSON.stringify(uiPreferences));
  }, [uiPreferences]);

  useEffect(() => {
    if (!planId) {
      setIsLoadingPlan(false);
      setPlan(null);
      return;
    }

    let isCurrent = true;
    setIsLoadingPlan(true);
    void fetchPlan(planId)
      .then((loadedPlan) => {
        if (!isCurrent) {
          return;
        }

        setPlan(loadedPlan);
        applyPlanStorage(loadedPlan);
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        window.localStorage.removeItem(planIdStorageKey);
        setPlanId(null);
        setPlan(null);
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingPlan(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [planId]);

  function setLoadedPlan(nextPlan: BackendPlan) {
    setPlan(nextPlan);
    setPlanId(nextPlan.id);
    applyPlanStorage(nextPlan);
  }

  async function startNewPlanner() {
    setLoadedPlan(await createPlanRequest());
  }

  function resumePersistedDraft() {
    const storedPlanId = readStoredPlanId();
    if (storedPlanId) {
      setPlanId(storedPlanId);
    }
  }

  function updateUiPreferences(patch: UiPreferencesPatch) {
    setUiPreferences((current) => mergeUiPreferencesPatch(current, patch));
  }

  async function renamePlan(name: string) {
    setLoadedPlan(await updatePlanName(ensurePlanId(planId), name));
  }

  async function createCategory(payload: { name: string; color: string }) {
    const nextPlan = await createCategoryRequest(ensurePlanId(planId), payload);
    setLoadedPlan(nextPlan);
    const category = nextPlan.categories.find((entry) => entry.name === payload.name) ?? nextPlan.categories[nextPlan.categories.length - 1];
    if (!category) {
      throw new Error("Kategorie konnte nicht erstellt werden.");
    }

    return category;
  }

  async function updateCategory(payload: { id: string; name: string; color: string }) {
    const nextPlan = await updateCategoryRequest(ensurePlanId(planId), payload);
    setLoadedPlan(nextPlan);
    const category = nextPlan.categories.find((entry) => entry.id === payload.id);
    if (!category) {
      throw new Error("Kategorie nicht gefunden.");
    }

    return category;
  }

  async function deleteCategory(payload: { id: string; confirm?: boolean }) {
    const affectedCourses = plan?.courses.filter((course) => course.category_id === payload.id).map((course) => course.name) ?? [];
    if (affectedCourses.length > 0 && !payload.confirm) {
      throw new CategoryInUseError(affectedCourses);
    }

    setLoadedPlan(await deleteCategoryRequest(ensurePlanId(planId), payload.id));
  }

  async function createCourse(payload: CoursePayload) {
    const nextPlan = await createCourseRequest(ensurePlanId(planId), payload);
    setLoadedPlan(nextPlan);
    const course = nextPlan.courses.find((entry) => entry.name === payload.name) ?? nextPlan.courses[nextPlan.courses.length - 1];
    if (!course) {
      throw new Error("Kurs konnte nicht erstellt werden.");
    }

    return course;
  }

  async function updateCourse(id: string, payload: CoursePayload) {
    const nextPlan = await updateCourseRequest(ensurePlanId(planId), id, payload);
    setLoadedPlan(nextPlan);
    return findCourse(nextPlan, id);
  }

  async function setCourseNumber(id: string, courseNumber: string | null) {
    const nextPlan = await patchCourse(ensurePlanId(planId), id, { course_number: courseNumber });
    setLoadedPlan(nextPlan);
    return findCourse(nextPlan, id);
  }

  async function setCourseExam(id: string, exam: SnapshotExam) {
    const nextPlan = await putExam(ensurePlanId(planId), id, exam);
    setLoadedPlan(nextPlan);
    return findCourse(nextPlan, id);
  }

  async function clearCourseExam(id: string) {
    const nextPlan = await deleteExamRequest(ensurePlanId(planId), id);
    setLoadedPlan(nextPlan);
    return findCourse(nextPlan, id);
  }

  async function applyImportedExams(payload: Array<{ courseId: string; exam: SnapshotExam }>) {
    const updatedCourses: SnapshotCourse[] = [];
    for (const entry of payload) {
      const nextPlan = await putExam(ensurePlanId(planId), entry.courseId, entry.exam);
      setLoadedPlan(nextPlan);
      updatedCourses.push(findCourse(nextPlan, entry.courseId));
    }

    return updatedCourses;
  }

  async function deleteCourse(id: string) {
    setLoadedPlan(await deleteCourseRequest(ensurePlanId(planId), id));
  }

  async function toggleCourse(id: string) {
    const course = findCourse(plan, id);
    const nextPlan = await patchCourse(ensurePlanId(planId), id, { is_active: !course.is_active });
    setLoadedPlan(nextPlan);
    return findCourse(nextPlan, id);
  }

  async function refreshCatalogCourse(id: string) {
    const nextPlan = await refreshCatalogCourseRequest(ensurePlanId(planId), id);
    setLoadedPlan(nextPlan);
    return findCourse(nextPlan, id);
  }

  async function importCatalogCourse(payload: {
    catalog_course_id: string;
    category_id?: string | null;
    abbreviation?: string;
    cp_override?: number;
    selected_subgroup_key?: string | null;
  }) {
    const result = await importCatalogCourseRequest(ensurePlanId(planId), payload);
    setLoadedPlan(result.plan);
    return { courseId: result.course_id };
  }

  const value = useMemo<PlannerContextValue>(
    () => ({
      snapshot: plan,
      planId,
      planName: plan?.name ?? null,
      uiPreferences,
      hasCurrentPlanner: Boolean(plan),
      hasPersistedDraft: Boolean(readStoredPlanId()),
      hasUnsavedChanges: false,
      isLoadingPlan,
      startNewPlanner,
      resumePersistedDraft,
      updateUiPreferences,
      renamePlan,
      createCategory,
      updateCategory,
      deleteCategory,
      createCourse,
      updateCourse,
      setCourseNumber,
      setCourseExam,
      clearCourseExam,
      applyImportedExams,
      deleteCourse,
      toggleCourse,
      refreshCatalogCourse,
      importCatalogCourse
    }),
    [isLoadingPlan, plan, planId, uiPreferences]
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlannerStore(): PlannerContextValue {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error("PlannerProvider fehlt.");
  }

  return context;
}
