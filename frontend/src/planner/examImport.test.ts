import { describe, expect, it } from "vitest";
import type { PlannerCourse } from "../api/types";
import { buildExamImportPreview, examWorkbookHeaders, parseExamWorksheetRows } from "./examImport";

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
    exam: overrides.exam ?? null,
    appointments: overrides.appointments ?? []
  };
}

function makeRows(...rows: unknown[][]) {
  return [examWorkbookHeaders.slice(), ...rows];
}

describe("exam import parsing", () => {
  it("parses a single bracket token and matches the course", () => {
    const parsedRows = parseExamWorksheetRows(
      makeRows(["Mo", "24.04.2026", "09:00", "11:00", "Klausur", "Dr. Ada", "Netze [20-00-1001]"])
    );
    const preview = buildExamImportPreview(parsedRows, [makeCourse({ id: "course-1", name: "Netze", courseNumber: "20-00-1001" })]);

    expect(parsedRows[0]?.extractedCourseNumbers).toEqual(["20-00-1001"]);
    expect(preview[0]?.status).toBe("matched");
    expect(preview[0]?.matchedCourseId).toBe("course-1");
    expect(preview[0]?.matchReasons).toEqual(["course-number-brackets"]);
  });

  it("extracts multiple bracket tokens from the course name", () => {
    const parsedRows = parseExamWorksheetRows(
      makeRows(["Di", "25.04.2026", "09:00", "11:00", "Klausur", "Dr. Ada", "Algo [20-00-1001] (20-00-1002)"])
    );

    expect(parsedRows[0]?.extractedCourseNumbers).toEqual(["20-00-1001", "20-00-1002"]);
  });

  it("keeps rows without bracket content unmatched", () => {
    const parsedRows = parseExamWorksheetRows(
      makeRows(["Mi", "26.04.2026", "10:00", "12:00", "Klausur", "Dr. Ada", "Algo ohne Nummer"])
    );
    const preview = buildExamImportPreview(parsedRows, [makeCourse({ courseNumber: "20-00-1001" })]);

    expect(preview[0]?.status).toBe("unmatched");
    expect(preview[0]?.message).toContain("Keine passende Kursnummer");
  });

  it("matches a course by exact long title", () => {
    const parsedRows = parseExamWorksheetRows(
      makeRows(["Mi", "26.04.2026", "10:00", "12:00", "Klausur", "Dr. Ada", "Einführung in die Kryptographie"])
    );
    const preview = buildExamImportPreview(parsedRows, [
      makeCourse({ id: "course-1", name: "Einführung in die Kryptographie", courseNumber: null })
    ]);

    expect(preview[0]?.status).toBe("matched");
    expect(preview[0]?.matchedCourseId).toBe("course-1");
    expect(preview[0]?.matchReasons).toEqual(["course-title-exact"]);
  });

  it("matches a course when the course number appears anywhere in the exam title", () => {
    const parsedRows = parseExamWorksheetRows(
      makeRows(["Mi", "26.04.2026", "10:00", "12:00", "Klausur", "Dr. Ada", "Klausur Einführung ITS 20-00-1001"])
    );
    const preview = buildExamImportPreview(parsedRows, [
      makeCourse({ id: "course-1", name: "Einführung in die Kryptographie", courseNumber: "20-00-1001" })
    ]);

    expect(preview[0]?.status).toBe("matched");
    expect(preview[0]?.matchedCourseId).toBe("course-1");
    expect(preview[0]?.matchReasons).toEqual(["course-number-title"]);
  });

  it("marks rows with missing required fields as invalid", () => {
    const parsedRows = parseExamWorksheetRows(makeRows(["Do", "", "10:00", "12:00", "Klausur", "Dr. Ada", "Algo [20-00-1001]"]));
    const preview = buildExamImportPreview(parsedRows, [makeCourse({ courseNumber: "20-00-1001" })]);

    expect(preview[0]?.status).toBe("invalid");
    expect(preview[0]?.message).toContain("Datum fehlt");
  });

  it("marks duplicate row matches to the same course as ambiguous", () => {
    const parsedRows = parseExamWorksheetRows(
      makeRows(
        ["Fr", "27.04.2026", "08:00", "10:00", "Klausur", "Dr. Ada", "Algo [20-00-1001]"],
        ["Fr", "28.04.2026", "12:00", "14:00", "Klausur", "Dr. Ada", "Algo [20-00-1001]"]
      )
    );
    const preview = buildExamImportPreview(parsedRows, [makeCourse({ id: "course-1", courseNumber: "20-00-1001" })]);

    expect(preview[0]?.status).toBe("ambiguous");
    expect(preview[1]?.status).toBe("ambiguous");
    expect(preview[0]?.matchedCourseId).toBe("course-1");
    expect(preview[1]?.matchedCourseId).toBe("course-1");
  });
});