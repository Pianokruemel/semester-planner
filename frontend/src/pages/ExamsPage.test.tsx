import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannerCourse } from "../api/types";
import { useCourses } from "../hooks/useCourses";
import { parseExamWorkbook } from "../planner/examImport";
import { ExamsPage } from "./ExamsPage";
import { usePlannerStore } from "../planner/store";

vi.mock("../hooks/useCourses", () => ({
  useCourses: vi.fn()
}));

vi.mock("../planner/store", () => ({
  usePlannerStore: vi.fn()
}));

vi.mock("../planner/examImport", async () => {
  const actual = await vi.importActual<typeof import("../planner/examImport")>("../planner/examImport");

  return {
    ...actual,
    parseExamWorkbook: vi.fn()
  };
});

const mockedUseCourses = vi.mocked(useCourses);
const mockedUsePlannerStore = vi.mocked(usePlannerStore);
const mockedParseExamWorkbook = vi.mocked(parseExamWorkbook);

function makeCourse(overrides: Partial<PlannerCourse> = {}): PlannerCourse {
  return {
    id: overrides.id ?? "course-1",
    catalogCourseId: overrides.catalogCourseId ?? null,
    catalogStatus: overrides.catalogStatus ?? "manual",
    catalogSyncedAt: overrides.catalogSyncedAt ?? null,
    catalogLastScannedAt: overrides.catalogLastScannedAt ?? null,
    catalogLastScannedAtAtSync: overrides.catalogLastScannedAtAtSync ?? null,
    catalogHasUpdate: overrides.catalogHasUpdate ?? false,
    catalogIsModified: overrides.catalogIsModified ?? false,
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
    Element.prototype.scrollIntoView = vi.fn();
    mockedParseExamWorkbook.mockReset();
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

    expect(screen.queryByText("Gruen")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gespeicherte Prüfungen" })).toBeInTheDocument();
    expect(screen.getByText("Inaktiv")).toBeInTheDocument();
    expect(screen.getByText("Dieser Kurs ist inaktiv und beeinflusst die Konfliktbewertung nicht.")).toBeInTheDocument();
    expect(screen.getByText("IT-Sicherheit").closest("article")).toHaveClass("exam-card-green");
  });

  it("jumps to the manual editor and selects the clicked course", () => {
    mockedUseCourses.mockReturnValue({
      data: [
        makeCourse({ id: "course-1", name: "IT-Sicherheit", isActive: true, courseNumber: "20-00-1234" }),
        makeCourse({
          id: "course-2",
          name: "Netze",
          isActive: true,
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

    fireEvent.click(screen.getAllByRole("button", { name: "Im Formular bearbeiten" })[1]);

    expect(screen.getByLabelText("Kurs")).toHaveValue("course-2");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("shows the match reason in the import preview", async () => {
    mockedUseCourses.mockReturnValue({
      data: [makeCourse({ id: "course-1", name: "Einführung in die Kryptographie", courseNumber: null })],
      isLoading: false
    });
    mockedParseExamWorkbook.mockResolvedValue([
      {
        rowNumber: 2,
        weekday: "Mi",
        date: "2026-04-26",
        timeFrom: "10:00",
        timeTo: "12:00",
        appointmentType: "Klausur",
        lecturer: "Dr. Ada",
        courseName: "Einführung in die Kryptographie",
        extractedCourseNumbers: [],
        parseError: null
      }
    ]);

    render(
      <MemoryRouter>
        <ExamsPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Excel-Datei auswählen"), {
      target: {
        files: [new File(["dummy"], "exam.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })]
      }
    });

    expect(await screen.findByText("Match-Grund: Titeltreffer")).toBeInTheDocument();
  });
});
