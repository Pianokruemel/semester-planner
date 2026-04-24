import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannerCourse } from "../api/types";
import { useCourses } from "../hooks/useCourses";
import { ExamsPage } from "./ExamsPage";
import { usePlannerStore } from "../planner/store";

vi.mock("../hooks/useCourses", () => ({
  useCourses: vi.fn()
}));

vi.mock("../planner/store", () => ({
  usePlannerStore: vi.fn()
}));

const mockedUseCourses = vi.mocked(useCourses);
const mockedUsePlannerStore = vi.mocked(usePlannerStore);

function makeCourse(overrides: Partial<PlannerCourse> = {}): PlannerCourse {
  return {
    id: overrides.id ?? "course-1",
    name: overrides.name ?? "IT-Sicherheit",
    abbreviation: overrides.abbreviation ?? "ITS",
    cp: overrides.cp ?? 6,
    categoryId: overrides.categoryId ?? null,
    courseNumber: overrides.courseNumber ?? null,
    isActive: overrides.isActive ?? true,
    category: overrides.category ?? null,
    exam:
      overrides.exam ?? {
        date: "2026-07-10",
        timeFrom: "10:00",
        timeTo: "12:00"
      },
    appointments: overrides.appointments ?? []
  };
}

describe("ExamsPage", () => {
  beforeEach(() => {
    mockedUsePlannerStore.mockReturnValue({
      setCourseExam: vi.fn(),
      clearCourseExam: vi.fn(),
      applyImportedExams: vi.fn()
    } as unknown as ReturnType<typeof usePlannerStore>);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders saved exams and excludes inactive courses from conflict severity", () => {
    mockedUseCourses.mockReturnValue({
      data: [
        makeCourse({ id: "course-1", name: "IT-Sicherheit", isActive: true, courseNumber: "20-00-1234" }),
        makeCourse({
          id: "course-2",
          name: "Netze",
          isActive: false,
          courseNumber: "20-00-5678",
          exam: { date: "2026-07-10", timeFrom: "11:00", timeTo: "13:00" }
        })
      ],
      isLoading: false
    });

    render(
      <MemoryRouter>
        <ExamsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Gespeicherte Prüfungen" })).toBeInTheDocument();
    expect(screen.getByText("Gruen")).toBeInTheDocument();
    expect(screen.getByText("Inaktiv")).toBeInTheDocument();
    expect(screen.getByText("Dieser Kurs ist inaktiv und beeinflusst die Konfliktbewertung nicht.")).toBeInTheDocument();
  });
});