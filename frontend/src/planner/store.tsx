import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createShareEnvelope, fetchShareEnvelope, isShareLocatorConflict, isShareOpenFailure } from "../api/shares";
import {
  PlannerSnapshot,
  SnapshotAppointment,
  SnapshotCategory,
  SnapshotCourse,
  UiPreferences,
  UiPreferencesPatch,
  createEmptyPlannerSnapshot,
  defaultUiPreferences,
  isPlannerSnapshotEmpty,
  mergeUiPreferencesPatch,
  normalizePlannerSnapshot,
  normalizeUiPreferences,
  plannerSnapshotFingerprint
} from "../api/types";
import { decryptPlannerSnapshot, deriveLocator, encryptPlannerSnapshot, generateShareCode } from "./shareCrypto";

const plannerDraftStorageKey = "semester-planner:draft:v1";
const uiPreferencesStorageKey = "semester-planner:ui-preferences:v1";

type PlannerSession = {
  snapshot: PlannerSnapshot;
  currentShareId: string | null;
  savedFingerprint: string | null;
  updatedAt: string;
};

type CourseMutationInput = {
  name: string;
  abbreviation: string;
  cp: number;
  category_id: string | null;
  appointments: SnapshotAppointment[];
};

type PlannerContextValue = {
  snapshot: PlannerSnapshot | null;
  uiPreferences: UiPreferences;
  hasCurrentPlanner: boolean;
  hasPersistedDraft: boolean;
  hasUnsavedChanges: boolean;
  currentShareId: string | null;
  startNewPlanner: () => void;
  resumePersistedDraft: () => void;
  updateUiPreferences: (patch: UiPreferencesPatch) => void;
  createCategory: (payload: { name: string; color: string }) => SnapshotCategory;
  updateCategory: (payload: { id: string; name: string; color: string }) => SnapshotCategory;
  deleteCategory: (payload: { id: string; confirm?: boolean }) => void;
  createCourse: (payload: CourseMutationInput) => SnapshotCourse;
  updateCourse: (id: string, payload: CourseMutationInput) => SnapshotCourse;
  deleteCourse: (id: string) => void;
  toggleCourse: (id: string) => SnapshotCourse;
  createShare: () => Promise<{ code: string }>;
  extendShare: () => Promise<{ code: string }>;
  openShare: (code: string) => Promise<void>;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonStorage(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeStoredSession(input: unknown): PlannerSession | null {
  if (!isRecord(input)) {
    return null;
  }

  try {
    return {
      snapshot: normalizePlannerSnapshot(input.snapshot),
      currentShareId: typeof input.currentShareId === "string" ? input.currentShareId : null,
      savedFingerprint: typeof input.savedFingerprint === "string" ? input.savedFingerprint : null,
      updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function ensureColor(color: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw new Error("Farbe muss als Hexwert vorliegen.");
  }

  return color;
}

function ensureSession(session: PlannerSession | null): PlannerSession {
  if (!session) {
    throw new Error("Bitte zuerst eine Planung erstellen oder öffnen.");
  }

  return session;
}

function ensureCoursePayload(session: PlannerSession, payload: CourseMutationInput): CourseMutationInput {
  const name = payload.name.trim();
  const abbreviation = payload.abbreviation.trim();

  if (!name) {
    throw new Error("Kursname darf nicht leer sein.");
  }

  if (!abbreviation) {
    throw new Error("Abkürzung darf nicht leer sein.");
  }

  if (!Number.isInteger(payload.cp) || payload.cp <= 0) {
    throw new Error("CP müssen eine positive ganze Zahl sein.");
  }

  if (payload.category_id && !session.snapshot.categories.some((category) => category.id === payload.category_id)) {
    throw new Error("Kategorie nicht gefunden.");
  }

  return {
    name,
    abbreviation,
    cp: payload.cp,
    category_id: payload.category_id,
    appointments: payload.appointments
  };
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
  const [session, setSession] = useState<PlannerSession | null>(() => normalizeStoredSession(readJsonStorage(plannerDraftStorageKey)));
  const [persistedDraft, setPersistedDraft] = useState<PlannerSession | null>(session);
  const [uiPreferences, setUiPreferences] = useState<UiPreferences>(() =>
    normalizeUiPreferences(readJsonStorage(uiPreferencesStorageKey) ?? defaultUiPreferences)
  );

  useEffect(() => {
    window.localStorage.setItem(uiPreferencesStorageKey, JSON.stringify(uiPreferences));
  }, [uiPreferences]);

  useEffect(() => {
    if (!session) {
      return;
    }

    window.localStorage.setItem(plannerDraftStorageKey, JSON.stringify(session));
    setPersistedDraft(session);
  }, [session]);

  const hasUnsavedChanges = useMemo(() => {
    if (!session) {
      return false;
    }

    const fingerprint = plannerSnapshotFingerprint(session.snapshot);
    return session.savedFingerprint ? fingerprint !== session.savedFingerprint : !isPlannerSnapshotEmpty(session.snapshot);
  }, [session]);

  function updateSession(nextSession: PlannerSession) {
    setSession({
      ...nextSession,
      snapshot: normalizePlannerSnapshot(nextSession.snapshot),
      updatedAt: new Date().toISOString()
    });
  }

  function startNewPlanner() {
    updateSession({
      snapshot: createEmptyPlannerSnapshot(),
      currentShareId: null,
      savedFingerprint: null,
      updatedAt: new Date().toISOString()
    });
  }

  function resumePersistedDraft() {
    if (!persistedDraft) {
      return;
    }

    updateSession(persistedDraft);
  }

  function updateUiPreferences(patch: UiPreferencesPatch) {
    setUiPreferences((current) => mergeUiPreferencesPatch(current, patch));
  }

  function createCategory(payload: { name: string; color: string }) {
    const current = ensureSession(session);
    const name = payload.name.trim();
    if (!name) {
      throw new Error("Name darf nicht leer sein.");
    }

    if (current.snapshot.categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Kategorie existiert bereits.");
    }

    const category = {
      id: crypto.randomUUID(),
      name,
      color: ensureColor(payload.color)
    } satisfies SnapshotCategory;

    updateSession({
      ...current,
      snapshot: {
        ...current.snapshot,
        categories: [...current.snapshot.categories, category]
      }
    });

    return category;
  }

  function updateCategory(payload: { id: string; name: string; color: string }) {
    const current = ensureSession(session);
    const target = current.snapshot.categories.find((category) => category.id === payload.id);
    if (!target) {
      throw new Error("Kategorie nicht gefunden.");
    }

    const name = payload.name.trim();
    if (!name) {
      throw new Error("Name darf nicht leer sein.");
    }

    if (
      current.snapshot.categories.some(
        (category) => category.id !== payload.id && category.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      throw new Error("Kategorie existiert bereits.");
    }

    const updated = {
      ...target,
      name,
      color: ensureColor(payload.color)
    } satisfies SnapshotCategory;

    updateSession({
      ...current,
      snapshot: {
        ...current.snapshot,
        categories: current.snapshot.categories.map((category) => (category.id === payload.id ? updated : category))
      }
    });

    return updated;
  }

  function deleteCategory(payload: { id: string; confirm?: boolean }) {
    const current = ensureSession(session);
    const affectedCourses = current.snapshot.courses.filter((course) => course.category_id === payload.id).map((course) => course.name);

    if (affectedCourses.length > 0 && !payload.confirm) {
      throw new CategoryInUseError(affectedCourses);
    }

    updateSession({
      ...current,
      snapshot: {
        ...current.snapshot,
        categories: current.snapshot.categories.filter((category) => category.id !== payload.id),
        courses: current.snapshot.courses.map((course) =>
          course.category_id === payload.id ? { ...course, category_id: null } : course
        )
      }
    });
  }

  function createCourse(payload: CourseMutationInput) {
    const current = ensureSession(session);
    const input = ensureCoursePayload(current, payload);
    const created = {
      id: crypto.randomUUID(),
      ...input,
      is_active: true
    } satisfies SnapshotCourse;

    updateSession({
      ...current,
      snapshot: {
        ...current.snapshot,
        courses: [...current.snapshot.courses, created]
      }
    });

    return created;
  }

  function updateCourse(id: string, payload: CourseMutationInput) {
    const current = ensureSession(session);
    const existing = current.snapshot.courses.find((course) => course.id === id);

    if (!existing) {
      throw new Error("Kurs nicht gefunden.");
    }

    const input = ensureCoursePayload(current, payload);
    const updated = {
      ...existing,
      ...input
    } satisfies SnapshotCourse;

    updateSession({
      ...current,
      snapshot: {
        ...current.snapshot,
        courses: current.snapshot.courses.map((course) => (course.id === id ? updated : course))
      }
    });

    return updated;
  }

  function deleteCourse(id: string) {
    const current = ensureSession(session);
    if (!current.snapshot.courses.some((course) => course.id === id)) {
      throw new Error("Kurs nicht gefunden.");
    }

    updateSession({
      ...current,
      snapshot: {
        ...current.snapshot,
        courses: current.snapshot.courses.filter((course) => course.id !== id)
      }
    });
  }

  function toggleCourse(id: string) {
    const current = ensureSession(session);
    const existing = current.snapshot.courses.find((course) => course.id === id);

    if (!existing) {
      throw new Error("Kurs nicht gefunden.");
    }

    const updated = {
      ...existing,
      is_active: !existing.is_active
    } satisfies SnapshotCourse;

    updateSession({
      ...current,
      snapshot: {
        ...current.snapshot,
        courses: current.snapshot.courses.map((course) => (course.id === id ? updated : course))
      }
    });

    return updated;
  }

  async function persistShare(parentSnapshotId: string | null) {
    const current = ensureSession(session);
    const snapshot = normalizePlannerSnapshot(current.snapshot);
    const savedFingerprint = plannerSnapshotFingerprint(snapshot);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateShareCode();
      const payload = await encryptPlannerSnapshot(snapshot, code, parentSnapshotId);

      try {
        const envelope = await createShareEnvelope(payload);
        updateSession({
          ...current,
          snapshot,
          currentShareId: envelope.id,
          savedFingerprint,
          updatedAt: new Date().toISOString()
        });
        return { code };
      } catch (error) {
        if (isShareLocatorConflict(error)) {
          continue;
        }

        throw new Error("Code konnte nicht erstellt werden.");
      }
    }

    throw new Error("Code konnte nicht erstellt werden.");
  }

  async function createShare() {
    return persistShare(null);
  }

  async function extendShare() {
    const current = ensureSession(session);
    if (!current.currentShareId) {
      throw new Error("Zum Erweitern muss zuerst ein Code erstellt oder geöffnet werden.");
    }

    return persistShare(current.currentShareId);
  }

  async function openShare(code: string) {
    try {
      const locator = await deriveLocator(code);
      const envelope = await fetchShareEnvelope(locator);
      const snapshot = await decryptPlannerSnapshot(envelope, code);

      updateSession({
        snapshot,
        currentShareId: envelope.id,
        savedFingerprint: plannerSnapshotFingerprint(snapshot),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      if (isShareOpenFailure(error) || error instanceof Error) {
        throw new Error("Code konnte nicht geöffnet werden.");
      }

      throw error;
    }
  }

  const value = useMemo<PlannerContextValue>(
    () => ({
      snapshot: session?.snapshot ?? null,
      uiPreferences,
      hasCurrentPlanner: session !== null,
      hasPersistedDraft: persistedDraft !== null,
      hasUnsavedChanges,
      currentShareId: session?.currentShareId ?? null,
      startNewPlanner,
      resumePersistedDraft,
      updateUiPreferences,
      createCategory,
      updateCategory,
      deleteCategory,
      createCourse,
      updateCourse,
      deleteCourse,
      toggleCourse,
      createShare,
      extendShare,
      openShare
    }),
    [hasUnsavedChanges, persistedDraft, session, uiPreferences]
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