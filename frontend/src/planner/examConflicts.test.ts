import { describe, expect, it } from "vitest";
import type { PlannerCourse } from "../api/types";
import { buildExamConflictMap } from "./examConflicts";

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

describe("exam conflict calculation", () => {
  it("marks direct overlaps as red", () => {
    const conflicts = buildExamConflictMap([
      makeCourse({ id: "course-1" }),
      makeCourse({ id: "course-2", name: "Netze", exam: { date: "2026-07-10", timeFrom: "11:00", timeTo: "13:00" } })
    ]);

    expect(conflicts.get("course-1")?.severity).toBe("red");
  });

  it("marks gaps up to 24 hours as orange", () => {
    const conflicts = buildExamConflictMap([
      makeCourse({ id: "course-1", exam: { date: "2026-07-10", timeFrom: "10:00", timeTo: "12:00" } }),
      makeCourse({ id: "course-2", name: "Netze", exam: { date: "2026-07-11", timeFrom: "08:00", timeTo: "10:00" } })
    ]);

    expect(conflicts.get("course-1")?.severity).toBe("orange");
  });

  it("marks gaps up to 48 hours as yellow", () => {
    const conflicts = buildExamConflictMap([
      makeCourse({ id: "course-1", exam: { date: "2026-07-10", timeFrom: "10:00", timeTo: "12:00" } }),
      makeCourse({ id: "course-2", name: "Netze", exam: { date: "2026-07-11", timeFrom: "18:00", timeTo: "20:00" } })
    ]);

    expect(conflicts.get("course-1")?.severity).toBe("yellow");
  });

  it("marks larger gaps as green", () => {
    const conflicts = buildExamConflictMap([
      makeCourse({ id: "course-1", exam: { date: "2026-07-10", timeFrom: "10:00", timeTo: "12:00" } }),
      makeCourse({ id: "course-2", name: "Netze", exam: { date: "2026-07-14", timeFrom: "10:00", timeTo: "12:00" } })
    ]);

    expect(conflicts.get("course-1")?.severity).toBe("green");
  });

  it("ignores inactive courses when calculating conflicts", () => {
    const conflicts = buildExamConflictMap([
      makeCourse({ id: "course-1", exam: { date: "2026-07-10", timeFrom: "10:00", timeTo: "12:00" } }),
      makeCourse({
        id: "course-2",
        name: "Netze",
        isActive: false,
        exam: { date: "2026-07-10", timeFrom: "11:00", timeTo: "13:00" }
      })
    ]);

    expect(conflicts.get("course-1")?.severity).toBe("green");
    expect(conflicts.has("course-2")).toBe(false);
  });
});