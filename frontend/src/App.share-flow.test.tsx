import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { defaultSettings } from "./api/types";
import { useSettings, useUpdateSettings } from "./hooks/useSettings";
import { usePlannerStore } from "./planner/store";

vi.mock("./hooks/useSettings", () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn()
}));

vi.mock("./planner/store", () => ({
  usePlannerStore: vi.fn()
}));

const mockedUseSettings = vi.mocked(useSettings);
const mockedUseUpdateSettings = vi.mocked(useUpdateSettings);
const mockedUsePlannerStore = vi.mocked(usePlannerStore);

const openShare = vi.fn();
const mutateSettings = vi.fn();
const startNewPlanner = vi.fn();
const resumePersistedDraft = vi.fn();
const createShare = vi.fn();
const extendShare = vi.fn();

afterEach(() => {
  cleanup();
});

function setupPlannerStore(overrides: Partial<ReturnType<typeof usePlannerStore>> = {}) {
  mockedUseSettings.mockReturnValue({
    data: defaultSettings,
    isLoading: false
  });
  mockedUseUpdateSettings.mockReturnValue({
    isPending: false,
    mutate: mutateSettings
    ,
    mutateAsync: vi.fn().mockResolvedValue(defaultSettings)
  } as ReturnType<typeof useUpdateSettings>);
  mockedUsePlannerStore.mockReturnValue({
    hasCurrentPlanner: false,
    hasPersistedDraft: false,
    hasUnsavedChanges: false,
    currentShareId: null,
    startNewPlanner,
    resumePersistedDraft,
    createShare,
    extendShare,
    openShare,
    ...overrides
  } as ReturnType<typeof usePlannerStore>);
}

function renderApp(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>
  );
}

describe("app share flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPlannerStore();
    openShare.mockResolvedValue(undefined);
    createShare.mockResolvedValue({ code: "abandon ability able about above absent absorb abstract" });
    extendShare.mockResolvedValue({ code: "abandon ability able about above absent absorb abstract" });
  });

  it("renders the simplified empty state with the main entry actions", () => {
    renderApp();

    expect(screen.getByRole("heading", { name: "Plane dein Semester ohne Konten und ohne Server-Klartext" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neue Planung" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Geteilten Plan öffnen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Code erstellen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Code erweitern" })).not.toBeInTheDocument();
  });

  it("opens a shared planner directly from the hash link", async () => {
    renderApp("/#code=abandon+ability+able+about+above+absent+absorb+abstract");

    await waitFor(() => {
      expect(openShare).toHaveBeenCalledWith("abandon ability able about above absent absorb abstract");
    });
  });

  it("accepts a full share URL in the open form", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Geteilten Plan öffnen" }));
    expect(
      screen.getByText(
        "Wenn du einen geteilten Plan bearbeitest, bleibt der ursprüngliche Link unverändert. Erst wenn du selbst wieder teilst, entsteht ein neuer Link für deine Version."
      )
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Link oder Acht-Wort-Code"), {
      target: {
        value: "http://localhost:3000/#code=abandon+ability+able+about+above+absent+absorb+abstract"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Plan öffnen" }));

    await waitFor(() => {
      expect(openShare).toHaveBeenCalledWith("abandon ability able about above absent absorb abstract");
    });
  });
});