import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { plannerSnapshotFingerprint, plannerSnapshotVersion, type PlannerSnapshot } from "./api/types";
import { PlannerProvider } from "./planner/store";

const plannerDraftStorageKey = "semester-planner:draft:v1";

function renderHydratedRoute(initialEntry: string, snapshot: PlannerSnapshot) {
  window.localStorage.setItem(
    plannerDraftStorageKey,
    JSON.stringify({
      snapshot,
      currentShareId: "share-1",
      savedFingerprint: plannerSnapshotFingerprint(snapshot),
      updatedAt: "2026-04-23T00:00:00.000Z"
    })
  );

  return render(
    <PlannerProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </PlannerProvider>
  );
}

describe("persisted session hydration routing", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the course edit route directly from a persisted draft", async () => {
    const courseId = "733c3d9c-1b33-4d26-8495-95f5457d90ca";
    const snapshot: PlannerSnapshot = {
      export_version: plannerSnapshotVersion,
      settings: {},
      categories: [
        {
          id: "category-1",
          name: "Sicherheit",
          color: "#6366F1"
        }
      ],
      courses: [
        {
          id: courseId,
          name: "IT-Sicherheit Vertiefung",
          abbreviation: "ITS",
          cp: 6,
          category_id: "category-1",
          is_active: true,
          appointments: [
            {
              date: "2026-04-27",
              time_from: "08:55",
              time_to: "10:35",
              room: "S311/08",
              type: "Vorlesung"
            }
          ]
        }
      ]
    };

    renderHydratedRoute(`/courses/${courseId}/edit`, snapshot);

    expect(await screen.findByRole("heading", { name: "Kurs bearbeiten" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("IT-Sicherheit Vertiefung")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ITS")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stundenplan ohne Server-Klartext" })).not.toBeInTheDocument();
  });
});